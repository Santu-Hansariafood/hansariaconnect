# Background and offline synchronization

HansariaConnect is a web app/PWA. Its service worker registers a best-effort
15-minute Periodic Background Sync where the browser supports and permits it.
Browsers and Android battery settings control when that work actually runs, so
the interval is not guaranteed. While the app is open, it also refreshes on a
15-minute timer and immediately when the app returns to the foreground or the
network reconnects.

The service worker handles Web Push while the app is minimized or closed.
Incoming push wakes it to show the notification and asks any open app page to
refresh. Android Chrome delivers Web Push through its push service; this project
uses VAPID/Web Push rather than the Firebase JavaScript SDK.

Text messages and messages with an already-uploaded attachment that cannot be
sent are stored in IndexedDB and retried with Background Sync where supported,
or when the app is online again. View-once messages are not queued. Queued
messages are discarded when the user explicitly logs out.

For guaranteed Android schedules, even with the browser fully stopped, a native
Android client using WorkManager is required; that client is not part of this
repository.
