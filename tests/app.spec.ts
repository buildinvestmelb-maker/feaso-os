import { expect, test } from '@playwright/test';

test.describe('feaso-os Institutional Workstation E2E', () => {
  test('renders cleanly at 820x580 OS window & desktop, switches states, runs 10,000-run Monte Carlo, and handles live OS_PROJECT_SYNC', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // 1. Start at devaware-os default window size (820x580)
    await page.setViewportSize({ width: 820, height: 580 });
    await page.goto('/', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('project-title')).toBeVisible();
    await expect(page.getByTestId('kpi-rlv')).toBeVisible();
    await expect(page.getByTestId('kpi-margin')).toBeVisible();
    await expect(page.getByTestId('kpi-irr')).toBeVisible();
    await expect(page.getByTestId('kpi-peak-debt')).toBeVisible();
    await expect(page.getByTestId('kpi-net-profit')).toBeVisible();
    await expect(page.getByTestId('kpi-p50-rlv')).toBeVisible();

    // 2. Test switching Australian states (NSW -> VIC -> QLD -> WA)
    const stateSelect = page.getByTestId('state-selector');
    const rlvCard = page.getByTestId('kpi-rlv');

    await expect(stateSelect).toHaveValue('NSW');
    const nswRlv = Number(await rlvCard.getAttribute('data-raw-value'));
    const nswDutyText = await page
      .getByTestId('statutory-stamp-duty')
      .textContent();
    expect(nswRlv).toBeGreaterThan(0);

    await stateSelect.selectOption('VIC');
    await expect(stateSelect).toHaveValue('VIC');
    const vicRlv = Number(await rlvCard.getAttribute('data-raw-value'));
    const vicDutyText = await page
      .getByTestId('statutory-stamp-duty')
      .textContent();
    expect(vicDutyText).not.toBe(nswDutyText);
    expect(vicRlv).not.toBe(nswRlv);

    await stateSelect.selectOption('WA');
    await expect(stateSelect).toHaveValue('WA');
    const waDutyText = await page
      .getByTestId('statutory-stamp-duty')
      .textContent();
    expect(waDutyText).not.toBe(vicDutyText);

    // 3. Navigate to Monthly Cashflow tab & verify chart + ledger
    await page.getByTestId('tab-cashflow').click();
    await expect(
      page.getByText('Monthly Cashflow S-Curve & Peak Debt Profile'),
    ).toBeVisible();
    await expect(
      page.getByText('Monthly Cashflow & Debt Waterfall Ledger'),
    ).toBeVisible();

    // 4. Navigate to Risk & Sensitivity tab and execute 10,000-run Monte Carlo simulation
    await page.getByTestId('tab-risk').click();
    const runMcBtn = page.getByTestId('run-monte-carlo-btn');
    await expect(runMcBtn).toBeVisible();
    await runMcBtn.click();

    const runtimeBadge = page.getByTestId('mc-runtime-badge');
    await expect(runtimeBadge).toBeVisible({ timeout: 10000 });
    await expect(runtimeBadge).toContainText('10,000 runs');

    await expect(page.getByTestId('mc-rlv-p10')).toBeVisible();
    await expect(page.getByTestId('mc-rlv-p50')).toBeVisible();
    await expect(page.getByTestId('mc-rlv-p90')).toBeVisible();
    await expect(page.getByTestId('tornado-chart')).toBeVisible();
    await expect(page.getByTestId('sensitivity-matrix')).toBeVisible();

    // 5. Return to Assumptions & simulate inbound OS_PROJECT_SYNC updating earthworks, massing & environment live
    await page.getByTestId('tab-assumptions').click();

    const beforeEwRaw = Number(
      await page
        .getByTestId('earthworks-total-cost')
        .getAttribute('data-raw-value'),
    );

    await page.evaluate(() => {
      window.postMessage(
        {
          type: 'OS_PROJECT_SYNC',
          sourceAppId: 'cutsheet-au',
          updatedAt: new Date().toISOString(),
          project: {
            projectId: 'deal-qld-sync-e2e',
            name: 'Brisbane West Live Bridge Site',
            location: {
              state: 'QLD',
              lga: 'Ipswich City Council',
              address: '310 Providence Parade, South Ripley QLD 4306',
            },
            geometry: {
              parcelId: 'Lot 8 SP 318422',
              grossAreaSqm: 54000,
              netDevelopableAreaSqm: 38900,
            },
            earthworks: {
              cutM3: 45000,
              fillM3: 18000,
              netSpoilM3: 27000,
              retainingWallLengthM: 640,
            },
            massing: {
              totalLotsOrUnits: 120,
              gfaSqm: 28000,
              nsaSqm: 24500,
              carBays: 140,
              roadLengthM: 1250,
            },
            environment: {
              acousticUpgradeRequired: true,
              bushfireAttackLevel: 'BAL-19',
              floodOverlay: false,
            },
          },
        },
        '*',
      );
    });

    // Verify OS Sync indicator, State badge, Earthworks cost, Massing totals, and Acoustic toggle updated live
    await expect(page.getByTestId('os-sync-indicator')).toContainText(
      'OS Sync',
    );
    await expect(page.getByTestId('project-title')).toHaveText(
      'Brisbane West Live Bridge Site',
    );
    await expect(stateSelect).toHaveValue('QLD');

    const afterEwRaw = Number(
      await page
        .getByTestId('earthworks-total-cost')
        .getAttribute('data-raw-value'),
    );
    expect(afterEwRaw).not.toBe(beforeEwRaw);
    // 45,000*24 + 18,000*28 + 27,000*65 + 640*900 = 1,080,000 + 504,000 + 1,755,000 + 576,000 = 3,915,000
    expect(afterEwRaw).toBe(3_915_000);

    await expect(page.getByTestId('massing-totals-summary')).toContainText(
      '120 units',
    );
    await expect(page.getByTestId('massing-totals-summary')).toContainText(
      '28,000 m² GFA',
    );
    await expect(page.getByTestId('massing-totals-summary')).toContainText(
      '140 bays',
    );
    await expect(page.getByTestId('massing-totals-summary')).toContainText(
      '1,250m roads',
    );
    await expect(page.getByTestId('acoustic-upgrade-toggle')).toBeChecked();

    // 6. Verify User Override toggle protects Earthworks from subsequent OS_PROJECT_SYNC
    await page.getByTestId('override-earthworks-btn').click();
    await expect(page.getByTestId('override-earthworks-btn')).toContainText(
      'User Override',
    );

    await page.evaluate(() => {
      window.postMessage(
        {
          type: 'OS_PROJECT_SYNC',
          sourceAppId: 'cutsheet-au',
          project: {
            earthworks: {
              cutM3: 1000,
              fillM3: 1000,
              netSpoilM3: 0,
            },
          },
        },
        '*',
      );
    });

    const lockedEwRaw = Number(
      await page
        .getByTestId('earthworks-total-cost')
        .getAttribute('data-raw-value'),
    );
    expect(lockedEwRaw).toBe(3_915_000);

    // 7. Click KPI Ribbon RLV card -> jumps to Glass-Box Audit with live SiteProject JSON
    await page.getByTestId('kpi-rlv').click();
    await expect(
      page.getByText('Residual Land Value (RLV) & Profit Equations'),
    ).toBeVisible();
    await expect(page.getByTestId('audit-inbound-json')).toContainText(
      'cutM3',
    );
    await expect(page.getByTestId('audit-outbound-json')).toContainText(
      'rlvAud',
    );

    // Zero console errors and zero uncaught page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
