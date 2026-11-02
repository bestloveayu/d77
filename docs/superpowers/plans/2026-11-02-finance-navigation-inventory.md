# Finance Navigation and Inventory Visibility

**Goal:** Move transactions to the fifth navigation tab, retain overview finance, and make inventory shortages and stock-change ordering useful without inventing shipment evidence.

**Architecture:** Reuse the current transaction view and finance values; fifth tab becomes transactions, while notification history remains available as latest activity from overview. Preserve push APIs/settings. Inventory uses last nonzero valid ledger quantity change across all history for ordering. When complete shipment evidence is unavailable, show an explicitly estimated ordered-minus-new-stock deficit instead of hiding it; verified shipments still reduce remaining demand.

**Constraints:** Read-only business sources; no GAS or local database changes. Unknown shipment remains unknown. Existing session and push subscriptions retained. New shortage estimates establish a silent notification migration baseline.

- [x] Add shortage estimate / stock update-time fixtures and backend implementation.
- [x] Move navigation, swipe destination and push click target; finance above transaction search; remove settlement from details.
- [x] Make overview metrics links and align awaiting-shipment count/filter.
- [x] Test unit, responsive mobile/desktop, IME, swipe, session and push regressions.
- [ ] Review, publish and verify deployed assets; verify North Sea display where logged-in UI is available.
