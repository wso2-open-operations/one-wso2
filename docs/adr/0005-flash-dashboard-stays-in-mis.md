# The Flash Dashboard stays in the MIS app; One WSO2 ports the revenue screens only

Finance MIS's Flash Dashboard (the monthly P&L flash, its forecasts, its comments and its Excel
export) is not ported into One WSO2. It stays in the MIS app, as it is. One WSO2's Finance MIS is the
ARR, QRR and MRR Builds and ARR Analysis. Decided by the port's owner on 2026-09-24. It was a scope
decision, not a technical finding, taken after tickets 15, 16 and 18 had built the P&L, forecast
editing and export. That code is removed rather than left unreachable; it remains in history from
`53829f1` to `1083da9` if the decision is ever reversed.

## Consequences

- One WSO2 is configured for one MIS backend, the ARR service. The Flash and Admin services serve
  only the Flash Dashboard, so they have no config key, no guard and no service map.
- `/user-info` still returns both of MIS's privilege numbers, and One WSO2 reads only `987`. `789`
  opens nothing here. A Flash-only holder sees no MIS entry in One WSO2 and keeps using the MIS app,
  which is also why the "you have MIS access, just not to this screen" wording is gone.
- The MIS app cannot be retired while the Flash Dashboard lives in it. The parallel period
  ([ADR 0003](0003-bug-for-bug-parity-during-the-parallel-period.md)) ends for the revenue screens
  only.
- Ticket 17 (Flash comments) is won't-fix, and ticket 04, which asked whether the comments backend
  is alive, is moot. Ticket 19's parity check covers the revenue screens only.
- Kept from the Flash work: percentages in the Build's export are true Excel percentages (a ticket 18
  decision the ARR tables use). Removed with it: everything only the Flash used. That covers the
  Export menu, `BuildTable`'s one-column-per-group mode and clickable column headers, and the
  workbook's titles, fills and merges.
- `docs/ported-apps/mis.md` keeps its Flash sections as the record of the source's behaviour, each
  marked **Not ported**. One WSO2 does not link to the MIS app's Flash; that can be added later.
