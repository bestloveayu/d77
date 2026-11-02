# Inventory Drilldown and Transaction Subtotals

**Goal:** Show outstanding shipment demand in inventory, polish actionable overview metrics, expose exact ledger evidence, and show filtered transaction subtotals.

**Architecture:** Preserve calculation logic. Attach exact contributing transaction IDs per new/used shipment bucket in the snapshot and per-person cash breakdowns on transactions. Frontend opens read-only ledger evidence for the selected product/condition. Shared pure helpers filter and subtotal transactions, keeping settlement outside income/cost profit. Existing seasonal finance stays unfiltered and separate from filtered subtotals.

**Constraints:** No business writes, GAS, local DB, session or push-key changes. New/used remain separate. Unknown money remains unknown rather than zero. Shipment corrections retain signed quantities. Filters and evidence must use the same snapshot.

- [x] Backend evidence IDs and per-person cash fields with regression tests.
- [x] Pure transaction filtering/subtotal helpers and invalid-value tests.
- [x] Inventory outstanding column and source-detail interaction.
- [x] Overview single-line label, equal number sizes, fixed responsive metric layout, border/chevron and 98%/120ms press feedback with reduced-motion support.
- [x] Filter subtotal band and person filter; preserve seasonal totals.
- [ ] Browser/mobile regression, review, deploy and public-asset verification.
