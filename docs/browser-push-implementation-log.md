# Browser Push Implementation Log

- Local checkout has no Git metadata; changes will be published atomically through the existing GitHub connector workflow.
- Chose the Worker-compatible `@block65/webcrypto-web-push` 2.0.0 library for encryption and VAPID rather than custom cryptographic code.
- Backend subscription tests and browser-client tests were written and observed failing before implementation.
- Added a per-object promise queue to serialize subscription mutations without holding a Durable Object initialization lock during network calls.
- Independent review found revocation, delayed logout, stale-session enable and transient-delivery retry issues. Added reproducing tests and fixes. Pending notifications expire after 24 hours; the fixed notification tag coalesces provider retries.
- Generated VAPID keys directly into Worker secrets; private material was neither printed nor stored in source files.
- Simulated browser UI verifies enable/test/logout and layout at 320, 390 and 1440 pixels. Physical Android delivery is not established by these tests.
- Verification: 45 unit/security tests passed; push-settings and existing overview/order/inventory/swipe browser regressions passed. Worker version `dbe669fb-83aa-4254-baf9-de9a576b214e` deployed; anonymous push endpoints return 401, wrong origins return 403, and the private dispatch route is not publicly routable (404).

