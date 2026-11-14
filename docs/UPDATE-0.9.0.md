# 0.9.0 Mobile Email Preview

## Workflow

Select orders, open the existing image preview, adjust omitted/shortage lines,
then choose Email preview. Matching names AND Email addresses form one output
group; different recipients remain separate. Customer detail also has an Email
preview entry. No actual order merge occurs.

Copy or open the text in a mail application and send there. Only after verifying
the sent message, check the explicit confirmation and choose I have sent. Rules
may be individually selected for the manual report. Edited recipient addresses
cannot be reported against the original order.

This creates a Cloudflare manual activity and optional push notification, NOT
a formal rules receipt. Formal status requires desktop manual confirmation.
No Gmail send API, attachment upload, GAS edit, stock or money write is involved.
Refresh once after deployment to populate private recipient evidence.

## Widget

Install 0.3.3 over the current test APK; do not uninstall first. The signing key,
application ID and pairing storage are unchanged. Event quick actions open the
authorized web editor or rule link view. Browser login remains required; no
widget button sends email or confirms a receipt.

## Verification

Model/API tests and synthetic browser checks cover grouping, draft edits,
shortages, recipient isolation, report validation/idempotency and widget links.
Actual Android mail application handoff, physical launcher behavior and real
mail delivery are device acceptance checks, not established by those tests.

