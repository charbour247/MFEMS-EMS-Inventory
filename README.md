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

First-time users select **First time? Create Account** on the login screen, enter their name, choose a unique username and a password of at least 8 characters, and confirm the password. New accounts are saved in the Google Sheets Users tab as active **Inventory User** accounts. They can then sign in from any device with their chosen credentials. Usernames use 3–40 letters, numbers, dots, underscores, or hyphens and are checked case-insensitively for duplicates. Registration requires a connection and an existing Users tab with the required headers.

Deploy the updated `EMS_Inventory_Google_Apps_Script.gs` as a new version of your existing Apps Script web app and publish the updated `index.html` to enable registration. Keep the existing deployment URL. Until the backend is updated, account creation will report "Unknown action".

Every sign-in still reads current accounts from the Users tab (`name`, `username`, `password`, `role`, `status`) and requires an `Active` account and a working connection. Passwords remain case-sensitive. Self-registration never grants administrator access; administrators must configure the first administrator account in the Users tab. Cached credentials do not authorize sign-in. Registration uses the prototype's existing credential storage; it does not add secure server-side authentication.

The app displays locally cached inventory immediately after sign-in, then refreshes it from the existing Apps Script endpoint. Inventory and user changes are saved to a device cache before uploading. Failed uploads remain pending across page reloads and retry on sign-in, reconnect, window focus, or every 60 seconds while the app is visible. The Sync button also starts a retry and refresh. A status message shows whether data is synced or waiting.

Administrators can edit item names and par levels directly in the inventory table and change categories from a dropdown. Par levels accept whole numbers of zero or more; changing a par level immediately refreshes low-stock indicators and saves through the existing device cache and Google Sheets sync flow. Other users see read-only par levels. Existing category choices come from categories currently assigned to inventory items; select **Add category...** to create a new choice while assigning it. These edits use the existing inventory save and sync flow.

Caches are separated by spreadsheet and tab names. Browser storage must be available to retain data after closing the page. This caches data only; it does not make the page or camera library available offline on a first visit.

The cache survives changes to the Apps Script deployment URL and automatically imports matching caches from the previous version. The login screen and dashboard show the number of items saved on the device, or a persistent storage error. A device without cached inventory starts empty instead of showing demo supplies. Reopen the app in the same browser profile at the same site address; another browser or site address has separate storage.

Run the cache regression checks with `node tests/cache-regression.js`. These simulate first login, reopening the page without a server connection, pending edits, old-cache migration, and unavailable or corrupt storage.

The existing `getData`, `saveInventory`, and `saveUsers` Apps Script actions are unchanged. Requests still transfer full datasets; the speed improvement is immediate local display and editing. The current API replaces whole datasets, so concurrent edits from multiple devices can still overwrite each other. Server-side versions or per-record updates would be needed to resolve those conflicts.

## Low-stock email alerts

Alerts are configured in `LOW_STOCK_EMAIL` in `EMS_Inventory_Google_Apps_Script.gs` for **dfoley@martinsvilleva.gov**, the app's existing spreadsheet, and the **Inventory** tab.

1. Open the spreadsheet, then **Extensions > Apps Script**. Replace the backend code with the updated `EMS_Inventory_Google_Apps_Script.gs` and save.
2. Select **setupLowStockAlerts** in the function dropdown and click **Run**. Approve spreadsheet and email permissions using the Google account that should send the alerts. This creates a five-minute timer; running setup again from the same account does not add another timer.
3. Select **checkLowStockAlerts** and click **Run** for the first check. This sends a real email if any items are already below par. Check the recipient inbox and Apps Script **Executions** for errors.
4. Deploy a **New version** of the existing web app, keeping its URL, with **Execute as: Me** using the account that authorized email. This activates the email check directly in the backend's inventory save. The timer itself uses the saved editor code.

The checker groups newly low items into one email with names, locations, quantities, par levels, barcodes, and a spreadsheet link. It uses strictly **quantity < par**; the app's visual LOW status also includes equality. An item gets one alert while it remains low. After a check observes it at or above par, a later drop can generate another alert. The first check alerts for all items already below par. Restocking and dropping again entirely between checks cannot be detected. Every inventory row must have a unique barcode and numeric quantity/par values. Invalid data fails the check without resetting alert history.

The backend checks for alerts immediately after each successful inventory save, including stock changes and par edits. Direct sheet edits are detected by the five-minute backup timer; unsynced device edits cannot generate an alert yet. Both paths share alert history to prevent repeat emails. If an email fails, the inventory save still succeeds, the error appears in Apps Script Executions, and the timer can retry. No spreadsheet On edit trigger is needed. Email is sent under the executing Google account and is subject to its Apps Script email quota. Only one account should run setup. Deleting the **checkLowStockAlerts** timer stops backup checks; save-triggered alerts remain active in the deployed backend.

## Security notice

Signed-in users can open **My Account** to change their own password by entering their current password and confirming a new password of at least 8 characters. Changes require a connection and are confirmed only after Google Sheets saves them. The backend verifies the current password and active account and updates only that account's password cell.

To enable password changes, copy the updated `EMS_Inventory_Google_Apps_Script.gs` into the spreadsheet's Apps Script project and deploy a **New version** of the existing web app, keeping its deployment URL. Publish the updated `index.html` as well. An older backend reports "Unknown action" until redeployed.

This is a client-side prototype. Account data is stored in the browser, where a technically capable user can inspect it. GitHub Pages cannot provide secure authentication. Do not store sensitive operational data without adding a secure backend and proper access controls.
