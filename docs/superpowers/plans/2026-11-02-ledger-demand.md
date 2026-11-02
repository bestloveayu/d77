# Ledger-Based Inventory Demand

**Goal:** Use selected-season sales ledger quantities as the sole inventory shipment source; keep new and used separate. Unify overview link typography and clarify order-work counters.

**Architecture:** Read stock across all-history ledger as before. Sum selected-season sales shipment quantities per uniquely matched canonical item, excluding explicitly general-sale records from GM demand. Do not add collaboration shipment totals. Positive shipment corrections reverse prior shipped units. Invalid or overshipped totals remain review. New demand uses ordered minus ledger shipped; secondhand shipment and stock stay separate, with unknown secondhand demand left unknown.

**Constraints:** No source writes, GAS, local DB, session or push-key changes. No new-estimate fallback from ordered-minus-stock. Existing ledger financial totals unchanged. Suppress historical shortage notifications on calculation-version migration.

- [x] Regression tests for 10 ordered / 2 shipped / 8 stock, mixed new/used, corrections, seasons and channel separation.
- [x] Ledger-only demand calculation and transparent detail fields.
- [x] Unified View All typography and pending-order terminology/counts using the proposed narrow purchase-pending definition; clarification was requested asynchronously and remains open.
- [ ] Provide metric button design suggestions; do not add unrelated features without approval.
- [ ] Verify, review, publish and check live asset/version.
