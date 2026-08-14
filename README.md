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

Open `index.html` directly, or serve this directory with any static web server.

## Security notice

This is a client-side prototype. Account data is stored in the browser, where a technically capable user can inspect it. GitHub Pages cannot provide secure authentication. Do not store sensitive operational data without adding a secure backend and proper access controls.
