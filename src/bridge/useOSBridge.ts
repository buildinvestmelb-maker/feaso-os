import { useEffect, useRef } from 'react';
import { useFeasoStore } from '../store/useFeasoStore';
import type {
  ChildToHostMessage,
  HostToChildMessage,
  SiteFeasibilityPatch,
  SiteProject,
} from './types';

const APP_ID = 'feaso-os' as const;
const PATCH_DEBOUNCE_MS = 260;

function isHostToChildMessage(data: unknown): data is HostToChildMessage {
  if (!data || typeof data !== 'object') return false;
  const msg = data as Record<string, unknown>;
  return (
    msg.type === 'OS_INIT' ||
    msg.type === 'OS_PROJECT_SYNC' ||
    msg.type === 'OS_RENDER_STATE' ||
    msg.type === 'OS_PAYLOAD'
  );
}

/**
 * Shared devaware-os iframe postMessage bridge hook.
 * - Safe no-op for outbound parent calls when running standalone.
 * - Emits APP_READY on mount and APP_FOCUS on pointerdown.
 * - Listens for OS_INIT, OS_PROJECT_SYNC, OS_RENDER_STATE, and OS_PAYLOAD.
 * - Auto-syncs inbound SiteProject metrics into live feasibility line items
 *   (respecting per-group user override flags).
 * - Emits debounced PROJECT_PATCH + NOTIFY back to devaware-os on recalculation.
 */
export function useOSBridge(): void {
  const inputs = useFeasoStore((s) => s.inputs);
  const cashflow = useFeasoStore((s) => s.cashflow);
  const rlv = useFeasoStore((s) => s.rlv);
  const monteCarloResult = useFeasoStore((s) => s.monteCarloResult);
  const applyInboundSiteProject = useFeasoStore(
    (s) => s.applyInboundSiteProject,
  );
  const setBridgeStatus = useFeasoStore((s) => s.setBridgeStatus);
  const recordOutboundPatch = useFeasoStore((s) => s.recordOutboundPatch);

  const hostOriginRef = useRef<string>('*');
  const lastPatchHashRef = useRef<string>('');
  const mountedRef = useRef<boolean>(false);

  const postToParent = (message: ChildToHostMessage) => {
    if (
      typeof window === 'undefined' ||
      !window.parent ||
      window.parent === window
    ) {
      return;
    }
    try {
      window.parent.postMessage(message, hostOriginRef.current || '*');
    } catch {
      // Safe fallback to wildcard origin if hostOrigin changed
      try {
        window.parent.postMessage(message, '*');
      } catch {
        // Ignore standalone / blocked postMessage errors
      }
    }
  };

  // 1. Mount handshake (APP_READY), pointerdown focus (APP_FOCUS), and inbound OS listeners
  useEffect(() => {
    const embedded =
      typeof window !== 'undefined' && window.parent !== window;

    setBridgeStatus({
      mode: embedded ? 'embedded' : 'standalone',
    });

    const handlePointerDown = () => {
      postToParent({ type: 'APP_FOCUS', appId: APP_ID });
    };

    const handleMessage = (event: MessageEvent) => {
      if (!isHostToChildMessage(event.data)) return;
      const msg = event.data;

      if (event.origin && event.origin !== 'null') {
        hostOriginRef.current = event.origin;
      }

      switch (msg.type) {
        case 'OS_INIT': {
          setBridgeStatus({
            mode: embedded ? 'embedded' : 'standalone',
            connected: true,
            renderActive: msg.active !== false,
            hostOrigin: event.origin || null,
            windowId: msg.windowId ?? null,
          });
          if (msg.project) {
            applyInboundSiteProject(msg.project, 'OS_INIT');
          }
          break;
        }

        case 'OS_PROJECT_SYNC': {
          if (msg.project) {
            const source = msg.sourceAppId || 'OS_PROJECT_SYNC';
            const updated = applyInboundSiteProject(msg.project, source);
            if (updated.length > 0) {
              postToParent({
                type: 'NOTIFY',
                level: 'info',
                title: 'Feaso OS Synced',
                message: `Updated ${updated.join(', ')} from ${source}`,
              });
            }
          }
          break;
        }

        case 'OS_RENDER_STATE': {
          setBridgeStatus({ renderActive: Boolean(msg.active) });
          break;
        }

        case 'OS_PAYLOAD': {
          const p = msg.payload;
          if (p && typeof p === 'object') {
            const synthesized: SiteProject = {
              name: typeof p.siteName === 'string' ? p.siteName : undefined,
              location:
                typeof p.state === 'string'
                  ? {
                      state: p.state as NonNullable<SiteProject['location']>['state'],
                      lga: typeof p.lga === 'string' ? p.lga : undefined,
                      address:
                        typeof p.address === 'string' ? p.address : undefined,
                    }
                  : undefined,
              earthworks:
                typeof p.cutM3 === 'number' ||
                typeof p.fillM3 === 'number' ||
                typeof p.netSpoilM3 === 'number'
                  ? {
                      cutM3: typeof p.cutM3 === 'number' ? p.cutM3 : undefined,
                      fillM3:
                        typeof p.fillM3 === 'number' ? p.fillM3 : undefined,
                      netSpoilM3:
                        typeof p.netSpoilM3 === 'number'
                          ? p.netSpoilM3
                          : undefined,
                      retainingWallCostAud:
                        typeof p.retainingWallCostAud === 'number'
                          ? p.retainingWallCostAud
                          : undefined,
                    }
                  : undefined,
            };
            applyInboundSiteProject(synthesized, 'OS_PAYLOAD');
          }
          break;
        }
      }
    };

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('message', handleMessage);

    // Notify devaware-os host that feaso-os is ready to receive OS_INIT
    postToParent({
      type: 'APP_READY',
      appId: APP_ID,
      version: '1.0.0',
    });

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('message', handleMessage);
    };
  }, [applyInboundSiteProject, setBridgeStatus]);

  // 2. Debounced outbound PROJECT_PATCH + NOTIFY whenever feasibility results recalculate
  useEffect(() => {
    const irrValue = cashflow.equityIrrPct ?? cashflow.projectIrrPct ?? null;
    const p50Rlv = monteCarloResult ? Math.round(monteCarloResult.rlv.p50) : null;

    const feasibilityPatch: SiteFeasibilityPatch = {
      rlvAud: Math.round(rlv.rlvAud),
      devMarginPct: Number(cashflow.devMarginPct.toFixed(2)),
      irrPct: irrValue !== null ? Number(irrValue.toFixed(2)) : null,
      peakDebtAud: Math.round(cashflow.peakDebtAud),
      p50RlvAud: p50Rlv,
      // devaware-os compatibility fields
      residualLandValueAud: Math.round(rlv.rlvAud),
      rlvPerSqmAud: Math.round(rlv.rlvPerSqmGrossAud),
      grossRealisationAud: Math.round(cashflow.grossRealisationAud),
      totalDevelopmentCostAud: Math.round(cashflow.totalDevelopmentCostAud),
      statutoryContributionsAud: Math.round(
        cashflow.infrastructureLevy.totalLevyAud,
      ),
      stampDutyRatePct: Number(cashflow.stampDuty.effectiveRatePct.toFixed(2)),
      targetMarginPct: inputs.targetMarginPct,
      profitOnCostPct: Number(cashflow.devMarginPct.toFixed(2)),
      gstScheme:
        inputs.gstScheme === 'full-gst' ? 'full-gst' : 'margin-scheme',
    };

    const hash = JSON.stringify(feasibilityPatch);
    if (hash === lastPatchHashRef.current) return;

    const timer = window.setTimeout(() => {
      const isInitialMountEmit = !mountedRef.current;
      mountedRef.current = true;
      lastPatchHashRef.current = hash;
      recordOutboundPatch(feasibilityPatch);

      postToParent({
        type: 'PROJECT_PATCH',
        sourceAppId: APP_ID,
        patch: {
          feasibility: feasibilityPatch,
        },
      });

      if (!isInitialMountEmit) {
        const rlvM = (feasibilityPatch.rlvAud / 1e6).toFixed(2);
        const irrTxt =
          feasibilityPatch.irrPct !== null
            ? `${feasibilityPatch.irrPct.toFixed(1)}% IRR`
            : 'N/A IRR';
        postToParent({
          type: 'NOTIFY',
          level: 'success',
          title: 'Feaso OS Recalculated',
          message: `RLV $${rlvM}M • ${feasibilityPatch.devMarginPct.toFixed(1)}% Margin • ${irrTxt}`,
        });
      }
    }, PATCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [
    inputs.gstScheme,
    inputs.targetMarginPct,
    cashflow.devMarginPct,
    cashflow.equityIrrPct,
    cashflow.projectIrrPct,
    cashflow.peakDebtAud,
    cashflow.grossRealisationAud,
    cashflow.totalDevelopmentCostAud,
    cashflow.infrastructureLevy.totalLevyAud,
    cashflow.stampDuty.effectiveRatePct,
    rlv.rlvAud,
    rlv.rlvPerSqmGrossAud,
    monteCarloResult,
    recordOutboundPatch,
  ]);
}
