# Overview Priority and Push Diagnostics

Version 0.4.1 rearranges the overview to latest activity, follow-up reminders, seasonal finance, shortage list, then summary metrics. Existing summary metrics are retained rather than deleted.

The owner reported the generic error "測試通知未送達，請稍後重試". This originates in the server-side exception path, not proof that the phone merely hid an accepted notification. Root cause is not yet established from that message alone.

## 0.4.2 Root Cause and Correction

The owner subsequently reported `PUSH_NETWORK:TypeError`. A workerd regression reproduced the actual production send function rejecting its Request options: `redirect: error` is unsupported by Cloudflare's runtime, which accepts `follow` or `manual`. Node-only tests using a mocked fetch had missed this incompatibility.

Use `redirect: manual` instead, preserving the no-follow security boundary. Redirect responses remain non-successful HTTP results and are never followed to another destination. The workerd test now invokes the production `sendBrowserPush` function and validates its Request options, rather than checking encryption alone. It failed with the same network TypeError before correction and passes with manual redirect mode after correction. All 55 unit/security tests pass. Actual phone receipt still requires the owner's retry; provider or device-side failures may remain distinct from this corrected request-construction failure.

After deployment, the owner retried on the phone and reported that the test succeeded. Existing VAPID keys and device subscriptions were preserved.

Add authenticated VAPID key-pair validation and safe diagnostic codes for encryption, outbound connection, expired subscription and provider HTTP rejection. Never return private keys, subscription endpoints, raw provider responses or unfiltered exception messages. Existing keys are preserved; do not rotate or clear subscriptions without evidence.

Unit tests validate matching/mismatched synthetic key pairs and error display. A separately bundled workerd/Miniflare test verifies real library encryption and key validation using generated synthetic keys. These pass locally but do not prove the production device's push delivery. The owner has been asked to retry the test and provide the new diagnostic code.

