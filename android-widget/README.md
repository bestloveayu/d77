# D77 native widget source

Independent Java/platform-only Android app. Package `tw.d77.widget`; min SDK 26,
target/compile SDK 35. No dependency libraries, SDK downloads, Gradle files,
production fixtures, or continuous services are included.

## Integration / compile

Use this directory's AndroidManifest.xml and res/ plus Java sources under src/.
Generate `tw.d77.widget.R` with aapt2 against android-35/android.jar, compile Java
with Java 8 language support (lambdas), dex with d8 (min API 26), package, align,
and sign with the primary agent's Android toolchain. A standard Android application
module can instead point its sourceSets at these locations with namespace and
applicationId `tw.d77.widget`. No other namespace's R is referenced.

Optional host-only helper check:

```text
javac -d <temporary-output> src/tw/d77/widget/LayoutMetrics.java tests/LayoutMetricsTest.java
java -cp <temporary-output> LayoutMetricsTest
```

## Behavior

- Add the widget, enter the website's one-use 32-hex pairing code, select appearance,
  then Complete. Settings are per-widget; pairing/cache is shared by this app's widgets.
- Default 4x2, vertical resize only. Minimum-height breakpoints 190/270 dp show
  1/3/5 feed rows for small/medium/large; four footer counts always remain present.
  Feed alternates generic to-dos/activity, falling back to whichever is available.
- System/day/night appearance, forest green/offwhite and platform serif font.
  Android may substitute a CJK serif font depending on installed fonts.
- A persisted network-constrained JobScheduler job requests updates every 30 minutes
  (Android may defer). Refresh taps are debounced for 30 seconds per app process.
  A single executor serializes pairing, refresh and logout; receiver work uses goAsync.
- Token and full feed cache are AES/GCM encrypted with an Android Keystore key.
  Backups and cleartext traffic are disabled. Pairing input is not saved/autofilled;
  no credentials or response bodies are logged. HTTP redirects are rejected,
  connections have 12-second connect/read timeouts and responses have a 256 KiB cap.
- Network errors retain existing counts and mark cached state. HTTP 401 clears all
  credentials/cache and cancels polling. Local logout clears immediately within the
  serialized work queue; remote revocation failure is explicitly reported.
- Internal PendingIntents are immutable and explicit. Browser intents are issued
  only through a non-exported routing Activity to the fixed website and one of
  overview/orders/inventory; server-provided URLs cannot be opened.
- API feed strings are assumed to obey the specified generic-only server contract.
  The app does not request customer profiles, photos or names. It cannot reliably
  identify a personal name embedded in a server-supplied generic title/body.

## Required primary-agent checks

Android 35 aapt2 resource compilation/linking and javac compilation of all Java
sources passed with the supplied SDK/JDK. LayoutMetricsTest passed six boundaries.
Intermediate output is in `.compile/`; no installable APK/device validation has
been performed. Build and install on API 26 and 35; test launcher configuration completion/cancel, 4x2/4x3/4x4
and landscape sizes, font/display scaling, system night-mode switching, offline
cached counts, pairing/replay rejection, 401 reset, process death/reboot job restore,
manual refresh throttling, logout revocation, and all three browser destinations.
Real endpoint/authentication checks are deliberately not performed with live data.
Setup displays only paired/unpaired status and the session expiration, never an
account name or credential. Expiration accepts ISO-8601 or Unix seconds/milliseconds;
expired local state is cleared on render, setup or refresh. No native push is used.
System night-mode redraw relies on the launcher's widget update/configuration
delivery or the next periodic/manual refresh; verify launcher-specific behavior.
