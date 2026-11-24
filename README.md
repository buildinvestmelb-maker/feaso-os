# feaso-os

Institutional-grade, Australia-wide property development feasibility, capital stack, and 10,000-run Monte Carlo risk workstation built to run both standalone and inside the **devaware-os** desktop iframe bridge (`@devaware/os-bridge`).

## Capabilities

- **Pure TypeScript Australian Financial Engine (`src/engine/`)**
  - **8-Jurisdiction Statutory Module (`auStatutory.ts`):** Editable progressive transfer duty brackets, foreign purchaser surcharges, annual land tax schedules, and state infrastructure levies (NSW HPC/s7.11, VIC GAIC/ICP, QLD ICN, WA DCP/MRIT, SA PlanSA, TAS Headworks, ACT LVC, NT Scheme).
  - **ATO GST Engine (`gstEngine.ts`):** GST Margin Scheme (`(Gross Sales − Original Land) / 11`), Full GST (`Gross Sales / 11`), and GST-Free / Exempt with 1/11th Input Tax Credits (ITCs) on GST-inclusive development outflows.
  - **Multi-Stage Monthly Cashflow & Capital Stack (`cashflowEngine.ts`):** Up to 60-month timeline, overlapping stages with normalized S-curve construction drawdowns, Senior Debt (LTC/LVR cap, establishment fee, line fee, monthly capitalised interest), Mezzanine tranche, exact annualised Project & Equity IRR, and 2-Tier JV profit-split waterfall (Preferred IRR hurdle → Sponsor promote).
  - **Goal-Seek Residual Land Value (`rlvSolver.ts`):** Iterative hybrid secant/bisection solver converging to exact RLV (`$`, `$/m²`, `$/lot`) for Target Dev Margin % or Target Equity IRR %.
  - **10,000-Run Monte Carlo Web Worker (`monteCarlo.ts`, `monteCarlo.worker.ts`):** Sub-500ms triangular distribution simulation across Construction Cost, End Sale Price, Interest Rate, and Sales Absorption Delay returning P10/P50/P90 RLV, Margin, and IRR, histogram buckets, and ranked Tornado deal-breakers.
- **Shared `devaware-os` Iframe Bridge (`src/bridge/useOSBridge.ts`)**
  - Emits `APP_READY` on mount, `APP_FOCUS` on `pointerdown`, and debounced `PROJECT_PATCH` + `NOTIFY` on recalculation.
  - Auto-syncs inbound `OS_INIT` / `OS_PROJECT_SYNC` (`earthworks`, `massing`, `environment`, `location.state`) with per-domain User Override toggles.
- **Exports:** 1-click Lender Summary PDF (`jspdf`) and Full Monthly Cashflow CSV.

## Scripts

```bash
npm run dev        # Local Vite dev server
npm run typecheck  # Strict TypeScript checking
npm run build      # Production build (tsc -b && vite build)
npm run test       # Vitest financial benchmark suite (tests/engine.test.ts)
npm run test:e2e   # Playwright E2E suite against vite preview (tests/app.spec.ts)
```
