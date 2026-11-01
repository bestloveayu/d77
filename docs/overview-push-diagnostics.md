# Overview Priority and Push Diagnostics

Version 0.4.1 rearranges the overview to latest activity, follow-up reminders, seasonal finance, shortage list, then summary metrics. Existing summary metrics are retained rather than deleted.

The owner reported the generic error "測試通知未送達，請稍後重試". This originates in the server-side exception path, not proof that the phone merely hid an accepted notification. Root cause is not yet established from that message alone.

Add authenticated VAPID key-pair validation and safe diagnostic codes for encryption, outbound connection, expired subscription and provider HTTP rejection. Never return private keys, subscription endpoints, raw provider responses or unfiltered exception messages. Existing keys are preserved; do not rotate or clear subscriptions without evidence.

Unit tests validate matching/mismatched synthetic key pairs and error display. A separately bundled workerd/Miniflare test verifies real library encryption and key validation using generated synthetic keys. These pass locally but do not prove the production device's push delivery. The owner has been asked to retry the test and provide the new diagnostic code.

