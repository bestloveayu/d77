# 0.6.2

Pending purchase now follows the displayed confirmed-purchase total of zero, rather than any incomplete purchase quantity. Orders with one or more confirmed purchased units are excluded even if not fully purchased. A zero total with missing purchase evidence is included as requested; this is not an assertion that no offline purchase occurred. Source conflict, active processing, invalid quantities and source issues remain excluded for review. Overview count and order filter share the predicate.

No ledger calculations, GAS, business-source data, sessions or notification preferences changed.

Validation: 86 unit/security tests and synthetic finance-navigation/follow-up browser tests passed.
