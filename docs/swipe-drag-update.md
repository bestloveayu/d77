# Finger-Tracking Page Transitions

Version: 0.3.1

## 0.3.3 Refinement

After inspecting the user's Telegram reference clip, use the live outgoing page rather than cloning its full DOM at the first drag. Keep adjacent panels flat with no decorative edge shadow. A short flick above 0.45 pixels/ms can commit once it has travelled 20 pixels; held drags still require the distance threshold. Settle duration responds to remaining distance and release velocity, bounded to 160-300 ms. Cancel both outgoing and incoming animations on completion or interruption so no filled transform survives a resize. Unit and browser tests cover short flicks, held snap-back, interruption cleanup and the existing circular/reduced-motion behavior. Physical Android smoothness remains subject to user feedback.

Replace the release-only fade with an inert, temporary pair of page previews that translate with the finger. The adjacent page is rendered from the already-loaded snapshot; this performs no cloud request or business-data write. Releasing past the threshold commits the page change; otherwise both panels return to their starting positions.

Keep the bottom navigation fixed, preserve circular navigation, exclude form controls and horizontal scrollers, and leave vertical scrolling native. Reduced-motion mode changes pages without a moving preview. Remove preview nodes on completion, cancellation, resizing, visibility loss or external navigation. Preview nodes are hidden from accessibility and cannot receive clicks.

Verification: unit tests for drag offsets and circular selection, browser checks for in-progress position before release, neighboring content, commit, snap-back, vertical scroll, cancellation, circular wrap and reduced motion. Existing overview, order, inventory and push controls are regression-tested separately. Physical Android touch feel still requires user feedback.

