# 0.9.1 Preview Navigation

- Customer detail has adjacent Email and order-image preview entries. Image
  preview uses the same draft-only shortage/removal controls as batch preview.
- Mobile batch action label is now 訂單圖片預覽. Desktop export code is unchanged.
- Widget 0.3.4 removes per-row action buttons. Whole-row taps open customer
  detail for pending rules or rule links/customer detail for rule updates.
- Old widget email/copy deep links also resolve to details, not editors.
- No GAS, desktop application, ledger, order, source mapping or notification
  state changes are included in this release.

Validated with model/API regression, synthetic browser navigation/image tests,
Android host tests, APK build and same signing-certificate verification.
Physical Android launcher acceptance is not established by these checks.

