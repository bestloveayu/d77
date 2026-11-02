# Transactions and Persistent Login

**Goal:** Read selected-season ledger records and optionally retain login for 30 days.

**Architecture:** Reuse the read-only ledger snapshot. Issue a random revocable application session after Google verification; store only its hash on the backend. Google ID tokens remain memory-only. Explicit opt-in stores the application credential on this device, with a clear shared-device warning. This avoids cross-site cookie restrictions.

**Constraints:** No GAS, spreadsheet, local database, or VAPID changes. Recheck the allowlist and expiry on every session request. Logout revokes the session. Do not combine unrelated rows without a transaction ID. Preserve existing financial totals.

- [x] Add transaction parsing and fixtures for old/new note formats, settlements and missing IDs.
- [x] Add read-only list/detail with search, type/time filters and mobile layout.
- [x] Add 30-day session issuance, verification, revocation and expiry/security tests.
- [x] Add opt-in login persistence, restore and logout UI; never persist a Google token.
- [x] Run unit and isolated browser regression checks; review before deployment.

Review fixes: fail-safe storage access, explicit auth-revocation code clearing private UI, and memory-only fallback when device persistence is blocked. Google login and actual 30-day elapsed behavior still require real-device use; automated clocks verify expiry logic.
