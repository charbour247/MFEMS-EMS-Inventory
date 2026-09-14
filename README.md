# MFEMS Inventory Manager

A browser-based EMS inventory application prepared for deployment with GitHub Pages.

## Deploy

1. Create an empty GitHub repository.
2. Add it as this repository's `origin` and push `main`:

   ```sh
   git remote add origin https://github.com/OWNER/REPOSITORY.git
   git push -u origin main
   ```

3. In the GitHub repository, open **Settings > Pages** and set **Source** to **GitHub Actions**.
4. The **Deploy to GitHub Pages** workflow will publish the site. Its URL appears in the workflow summary.

Every later push to `main` redeploys the site automatically.

## Local preview

Use a local HTTP server rather than opening `index.html` as a `file://` URL. Run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/preview.ps1`, then open `http://127.0.0.1:8765/index.html`. The server binds only to this computer and serves only the app. Stop it with Ctrl+C.

The local VS Code **Inventory app (localhost)** debug configuration starts this server automatically. If needed, stop its background task using **Tasks: Terminate Task**. The `.vscode` directory is ignored by Git, so this configuration is local to this checkout.

Localhost has separate browser storage from the previous file URL and the hosted site. Sign in online to populate its cache; pending edits in the previous origin remain there.

## Device cache and Google Apps Script sync

The backend source is `EMS_Inventory_Google_Apps_Script.gs`. Copy it into the spreadsheet's Apps Script project, then use **Deploy > Manage deployments > Edit > New version > Deploy** to update the existing web app. Saving the editor alone does not update the deployed version. The app's configured `/exec` URL must match the active deployment.

The backend normalizes header capitalization and surrounding spaces and reports missing tabs or account columns. Users are read as displayed text; inventory quantities remain numeric. Format manually edited username and password cells as **Plain text** before entering them. If Sheets already removed leading zeros, re-enter the intended value; the script cannot recover lost characters. Password text and capitalization remain exact, and account status must be `Active`.

Run backend regression checks with `node tests/backend-regression.js`. A deployment returning HTTP 404 must be repaired in Apps Script; spreadsheet parsing changes cannot fix an unavailable deployment.

Sign in using an existing account from the Google Sheets Users tab (`name`, `username`, `password`, `role`, `status`). Every sign-in reads current database credentials and requires an `Active` account and a working connection. Usernames are case-insensitive; passwords remain case-sensitive. The login screen never creates a default or initial administrator account, and cached credentials do not authorize sign-in. Administrators must configure the first account in the Users tab.

The app displays locally cached inventory immediately after sign-in, then refreshes it from the existing Apps Script endpoint. Inventory and user changes are saved to a device cache before uploading. Failed uploads remain pending across page reloads and retry on sign-in, reconnect, window focus, or every 60 seconds while the app is visible. The Sync button also starts a retry and refresh. A status message shows whether data is synced or waiting.

Caches are separated by spreadsheet and tab names. Browser storage must be available to retain data after closing the page. This caches data only; it does not make the page or camera library available offline on a first visit.

The cache survives changes to the Apps Script deployment URL and automatically imports matching caches from the previous version. The login screen and dashboard show the number of items saved on the device, or a persistent storage error. A device without cached inventory starts empty instead of showing demo supplies. Reopen the app in the same browser profile at the same site address; another browser or site address has separate storage.

Run the cache regression checks with `node tests/cache-regression.js`. These simulate first login, reopening the page without a server connection, pending edits, old-cache migration, and unavailable or corrupt storage.

The existing `getData`, `saveInventory`, and `saveUsers` Apps Script actions are unchanged. Requests still transfer full datasets; the speed improvement is immediate local display and editing. The current API replaces whole datasets, so concurrent edits from multiple devices can still overwrite each other. Server-side versions or per-record updates would be needed to resolve those conflicts.

## Security notice

This is a client-side prototype. Account data is stored in the browser, where a technically capable user can inspect it. GitHub Pages cannot provide secure authentication. Do not store sensitive operational data without adding a secure backend and proper access controls.
