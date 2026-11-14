# Widget 0.3.5 Display Labels

- Widget-only pending-rules details show item names/quantities without prices or totals.
- Widget purchase-event title changes from 下單已確認 to 待出貨.
- Unpurchased todo rows and native purchase summary label display 新增預購.
- Counts, task classification, historical events, web notification titles, ledger,
  stock, order and collaboration state are not modified.
- The 新增預購 summary retains awaitingPurchase semantics: it is not a count of
  just today's newly created orders.
- Native footer weights are balanced for three-digit counts, preserving fonts.
  Host font checks cover counts 0-999 at 320dp/default font scale; physical
  launchers and unusually large accessibility fonts remain device checks.

Install 0.3.5 over the existing APK; keep pairing. Refresh the widget once.
No GAS or desktop changes are needed for these widget display adjustments.

