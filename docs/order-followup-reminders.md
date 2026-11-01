# Confirmed Order Follow-Up Reminders

Approved behavior: notify once upon entry into a confirmed follow-up state, not every refresh. Surface the same classification in customer-order filters, overview reminders and notification preferences. This release does not write to business sheets, GAS or the local order application.

## Classification

- Registration: all ordered quantities have confirmed purchase counts; shipment counts are known and at least one line remains unregistered. Includes partially registered orders.
- Rules: purchases and shipment registration are complete; at least one explicitly required game's mail count is confirmed zero. Exempt games are excluded; partially mailed orders remain pending.
- Review: invalid or missing evidence, active/conflicting operations, order issues, unknown rule requirements or unknown mail counts. Unknown is not treated as zero.
- None: no confirmed follow-up task under the above rules.

## Rule Requirements

The optional cloud catalog column `不需寄送中文規則` is read without changing the spreadsheet. TRUE/是/1 marks exempt, FALSE/否/0 explicitly requires mail, and missing/blank/unrecognized values remain unknown. A local-only checkbox is not assumed to exist in cloud data. File presence alone does not prove whether rules must be mailed.

If the owner wants cloud classification for a game whose exemption is currently local-only, they must provide this explicit field in the cloud catalog or a future supported synchronization contract. This release does not create columns or change GAS. An already-mailed game needs no exemption assumption.

## Notification Semantics

- The first new-format snapshot establishes a silent baseline; no rollout flood.
- A transition into registration or rules-pending creates one new event.
- Staying in the same state produces no additional event.
- Leaving and later entering again creates a new entry event.
- Existing notification choices are preserved. Members must select the two new choices and save if they want those pushes. Existing push permission, current-device subscription, default-season monitoring and Taipei quiet hours still apply.
- Titles and lock-screen payloads remain generic; authenticated UI displays order details.

## Verification

Unit tests cover required/exempt/unknown requirements, missing/conflicting/active evidence, partial registration, baseline rollout and repeated/reentered states. Browser tests cover overview counts, direct filter links, review separation, notification choices and 320/390/1440 layouts. Actual phone delivery remains a device acceptance check.

Independent review identified that the old general pending filter omitted fully shipped orders with outstanding rules or unknown requirements. A reproducing regression test failed before correction; the overview attention count and general pending filter now share `needsAttention()` and retain these orders. All 53 unit/security tests pass, along with follow-up, overview, inventory/search, swipe and push-settings browser regressions.

