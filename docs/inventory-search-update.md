# Inventory Columns and Chinese Input Fix

Version: 0.3.2

- Inventory list displays ordered quantity, new stock and used stock separately. Existing stock values and shortage calculations are unchanged.
- Add ordered-quantity descending and total-stock descending sorting. Total stock means new plus used; existing stock ascending sorting uses the same total.
- Chinese IME composition in orders, inventory and rules searches must not trigger replacement of the active input. Pause list rendering during composition, then filter on completion. Preserve normal typing, caret and scroll behavior.
- Regression first reproduced the composing input being detached. Browser tests now assert its identity/focus during composition, committed Chinese filtering across all three pages, separate stock values, both new sorts and layouts at 320/390/1440 pixels.
- No Worker, spreadsheet, GAS or local-order-data changes.

