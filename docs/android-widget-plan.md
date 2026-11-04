# Android Widget V1

Approved direction: read-only native Android 4x2 widget, resizable through 4x3 and 4x4. Main content is prioritized outstanding work followed by recent activity. Compact counts remain at the bottom. Day/night, cached offline state, timestamp, refresh and browser deep links are included. No names, contact details, amounts or business mutations on the widget.

## Implementation

1. Dedicated widget credential service: authenticated browser issues a random one-use 5-minute pairing code; native redemption grants only widget-summary reads for 30 days. Store only hashes server-side. Revocation and allowlist enforcement on every read. No Google private keys or web sessions in APK.
2. Shared backend produces a minimized summary from existing season snapshots and event feeds using the same pending-order predicates. Unknown values are not zeroed.
3. Browser settings offers explicit device authorization, copying code, and revoke-all widget devices. Keep ordinary login and browser push unchanged.
4. Platform Java app, RemoteViews and JobScheduler: Android Keystore encryption, no app backup, strict fixed HTTPS API. Periodic 30-minute requests and manual refresh. No exact real-time promise or native FCM in V1.
5. Build with official SDK and existing JDK, verify APK signature and manifest. Unit/security regression tests before backend deployment. Actual launcher resizing, battery behavior and Android installation require a real phone.

## Verification

- Pairing expiration, one-time concurrency, scope restriction, allowlist removal, rate limits and revocation.
- Widget counts match dashboard predicates and no private order content enters summary.
- Existing worker tests remain passing.
- Compile APK and verify signing; never package credentials or signing keys in source archive.
