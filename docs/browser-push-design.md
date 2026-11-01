# Android Browser Push

Status: deployed as 0.3.0. Automated verification passed; physical Android receipt awaits user acceptance. Existing ntfy integration remains disabled.

## User Experience

- Use browser Web Push, without a separate notification app.
- Each authorized member signs in on their own Android phone and selects Enable notifications in Settings.
- Request notification permission only after that explicit button press.
- Provide device subscription status, a test notification button and a disable button.
- Honor the existing event selections and Taipei quiet hours.
- Keep subscriptions active when the page is closed, subject to Android and browser restrictions. Explicit logout disables the current device subscription.
- Use only a generic notification indicating cloud updates. Never include customer names, contacts, products or amounts on the lock screen.
- Notification clicks open the existing site and require normal Google authentication before data can be read.

## Backend

- Reuse the Cloudflare Worker and private Durable Object storage.
- Add authenticated device registration, removal, status and rate-limited test endpoints.
- Bind each subscription to the authenticated user. Never accept a user identity supplied by the browser body.
- Validate push destinations against supported browser push services; reject arbitrary or private-network URLs and redirects.
- Generate VAPID credentials and store the private key only as a Worker secret, never in GitHub or browser code.
- Add a notification-only service worker, with no fetch handler and no offline caching of business data.
- Send notifications for new events in the default season during the existing approximately five-minute cloud refresh cycle. No historical notification flood.
- Isolate push failures from cloud reads and existing business operations. Remove expired endpoints on HTTP 404/410.
- No changes to the original local order application, business spreadsheets or GAS.

## Verification

- Test authentication, account isolation, endpoint validation, unsubscribe and duplicate prevention.
- Test quiet hours and existing event preferences.
- Test permission denied, unsupported browsers and subscription failure states.
- Verify service worker notification clicks and the absence of private business data in payloads or caches.
- Physical Android receipt with the page closed requires user acceptance testing; simulated tests do not establish device delivery.

## Deployment

Deploy the backend before the frontend. Keep push opt-in and disabled until a device has subscribed and its owner enables notifications. Do not enable browser notification permissions on the user's behalf.

