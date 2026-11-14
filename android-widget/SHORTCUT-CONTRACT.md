# Widget shortcut contract

Fixed origin: https://bestloveayu.github.io/d77/
Hash remains a bare page. Query parameters are UTF-8 percent encoded.

| Feed type | Structured identity | Destination | Action |
| --- | --- | --- | --- |
| rules | target.name = exact product.name | #rules + widgetProduct | view |
| rules-pending | target.id = order.id | #orders + widgetOrder + widgetFilter=rules | view |
| order | target.id = order.id | #orders + widgetOrder | view |
| shortage | target.name = exact product.name, if known | #inventory + widgetProduct + widgetFilter=shortage | view |

Action is carried in widgetAction. No widget token, contacts, rule URL, or email
content is passed. Browser login/authorization remains mandatory. Actions open
interfaces only; they must not send mail, mark rules sent, or mutate stock.
Unknown/missing metadata falls back to the existing page/filter link. Unknown
types never interpret target.id as an order (e.g. stock transaction IDs).
Product names and order IDs are never inferred from truncated titles or bodies.
Whole-row taps use view with blank action labels and no per-row action buttons.
Shortcut.url still accepts explicitly requested email and copy-rules actions.

## Backend patch required (not applied here)

worker/widget.mjs currently removes all target metadata. Preserve the following
in widgetSummary's explicitly projected feed rows (do not spread entire events):

- Events: type: e.type; target.id only for order/rules-pending when it is an
  authoritative order ID; target.name only for rules/shortage with exact product
  name. Resolve against snapshot where appropriate; never substitute transaction
  IDs, customer display names, event IDs, or truncated widgetFacts titles.
- Todos awaitingRules: type: 'rules-pending', target: {id: o.id}.
- Todos awaitingPurchase: type: 'order', target: {id: o.id}.
- Todos shortage: type: 'shortage', target: {name: o.name}.
- Todos awaitingShipment: retain page orders and filter registration; no email
  action unless it is actually rules-pending.
- Preserve exact values, not sanitized display-text copies. No contacts or raw
  source data are required. Missing metadata must stay absent.

Parent web handler consumes query only after authenticated refresh, validates
identity against current authorized snapshot, opens matching customer/editor or
product detail interface, and reports missing targets without choosing another row.

## Verification boundary

Host tests cover pure routing, escaping, target-type separation and fallback.
Android resource/Java/dex compilation and APK signature verification are build
checks, not launcher/device or authenticated web integration verification.
Pairing storage, package name, Vault, Session and API endpoints are unchanged.

