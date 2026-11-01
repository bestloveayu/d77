# Android Browser Notifications

## Enable

1. Open https://bestloveayu.github.io/d77/ in Android Chrome.
2. Sign in using an authorized Google account.
3. Open Settings and select Enable notifications in the current-device section.
4. Allow notifications when Chrome asks.
5. Select Test notification. This explicit test bypasses quiet hours and event filters.

Each person enables notifications separately on their own phone. No separate app is required. Adding the site to the home screen is optional on Android.

## Controls

- The phone-push checkbox controls all devices belonging to the signed-in account. Save after changing preferences.
- Event selections and quiet hours use Taipei time. Defaults are 22:00 through 08:00.
- Disable current device removes only the current browser subscription.
- Explicit logout removes the current browser subscription; simply closing the page does not.
- At most five devices can be registered per account. A shared phone must disable the previous account's subscription before enabling a different account.

## Delivery

The default season is checked approximately every five minutes. Notifications show generic text only. Open the website and sign in to see details. Transient provider failures are retried with backoff, up to 24 hours; expired subscriptions are removed. Android battery restrictions, browser settings and network conditions can delay delivery. Provider acceptance is not proof of phone receipt.

No local-order, spreadsheet or GAS changes are required. The service worker has no fetch handler and does not cache business records.

## Acceptance Test

After receiving the first test, close the website tab, reopen it later, send another test, then immediately leave Chrome. Confirm the phone receives it while Chrome is in the background. Finally test a real new cloud event during non-quiet hours. Physical-device receipt remains unverified until the owner completes these checks.

## Deployment Credentials

`node scripts/setup-push.mjs` creates VAPID credentials only if neither key exists. Both values are installed directly as Worker secrets. Existing keys are preserved; never rotate them casually because existing subscriptions use the original public key. Never commit private keys or subscription endpoints.

