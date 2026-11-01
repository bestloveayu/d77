# Android Browser Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in Android browser notifications to the existing private cloud management site.

**Architecture:** Store authenticated per-device subscriptions in the shared Durable Object. Deliver generic notifications through Web Push during existing refresh cycles; use a notification-only service worker.

**Tech Stack:** Cloudflare Workers, Durable Objects, browser Push API, jose; select a maintained Worker-compatible Web Push implementation after checking its official documentation.

**Spec:** `docs/browser-push-design.md`

## Global Constraints

- No changes to local orders, business spreadsheets or GAS.
- No customer names, contacts, products or amounts in notifications.
- No service-worker fetch handler or offline business-data cache.
- Permission is requested only after the user's explicit enable action.
- Honor existing event selections and Taipei quiet hours.
- Explicit logout disables the current device subscription.
- Deploy backend before frontend; physical Android delivery requires user testing.

## Review Focus

- A subscription registered by one account must not be readable or removable by another account.
- Arbitrary URLs and redirects must never become outbound push destinations.
- Closed pages remain eligible, but explicit logout must remove the device subscription.
- Expired subscriptions must be removed without interrupting snapshot refresh.
- Existing events must not create a notification flood when enabling a new device.

### Task 1: Subscription and Delivery Backend

**Files:** Create `worker/browser-push.mjs`, `tests/browser-push.test.mjs`; modify `worker/index.mjs`.

**Interfaces:** Authenticated status/register/remove/test routes use the verified user identity. `sendBrowserPush(subscription, env)` returns a delivery outcome without exposing secrets. Endpoint validation accepts only supported HTTPS browser push providers, with redirects disabled.

- [x] Write failing tests for account isolation, malformed destinations, redirect rejection, device limits, test rate limits, duplicate prevention, quiet hours and expired endpoints.
- [x] Run `node --test tests/browser-push.test.mjs` and confirm failure before implementation.
- [x] Implement private subscription storage and delivery using a documented standards-compatible library; keep VAPID private material in Worker secrets only.
- [x] Integrate new-event delivery into existing cron refresh, preserving preferences and isolating errors from snapshot collection.
- [x] Run backend tests and the complete `npm test` suite.

### Task 2: Browser Controls and Service Worker

**Files:** Create `public/push.js`, `public/sw.js`, `tests/push-ui.cjs`; modify `public/app.js`, `public/index.html` as needed.

**Interfaces:** `push.js` exposes enable, disable, status and test operations using the existing authenticated API client. Service worker receives generic push events and opens the site's notification page on click.

- [x] Write tests for unsupported browsers, permission denial, failed registration, enable/test/disable and explicit logout cleanup.
- [x] Run tests and confirm failure before implementation.
- [x] Add settings controls with distinct pending, enabled, disabled and error states; prevent duplicate clicks.
- [x] Register the notification-only service worker under the GitHub Pages repository scope; never cache business data.
- [x] Verify mobile layout, click routing and no private notification content using an isolated browser fixture.

### Task 3: Deployment and Acceptance

**Files:** Modify deployment documentation and versioned frontend references; keep credentials outside the public repository.

- [x] Generate VAPID credentials locally and install private material as Worker secrets without printing it.
- [x] Review changes for secrets, account isolation and unintended business-data writes.
- [x] Run all unit and relevant browser regressions; record actual results.
- [x] Deploy Worker, verify unauthorized endpoints reject requests, then publish frontend and verify Pages succeeds.
- [x] Provide Android instructions for enabling and testing notifications, including a page-closed delivery test. Mark physical delivery pending until the user confirms receipt.

