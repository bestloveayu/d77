# 0.5.0

- Selected-season transaction records from the existing read-only ledger snapshot. Entry beside overview seasonal finance; search name, purpose, item, notes and transaction ID; filter type and sort time. Rows remain separate, including rows sharing a transaction ID, to preserve ledger evidence.
- Optional 30-day login on this device. Only an application-specific random credential is persisted; Google ID tokens are never persisted. Server stores hashes, rechecks membership, enforces fixed expiry and revokes on logout. Up to 10 active device sessions per account.
- Storage-blocked browsers continue with memory-only login. Shared devices should not enable persistence. Clearing site data or using private browsing may require another login. A network failure during logout may prevent confirmed server revocation; the local UI is still cleared and warns accordingly.
- No GAS, sheet, local database, or push-key changes.

Validation: 61 Node tests; transaction/session UI including 320/390/1440 widths, reload restore, logout, blocked storage and permission revocation; overview and push UI regressions; Cloudflare push runtime test. All use synthetic test data. Real Google login retention requires user verification on their device.
