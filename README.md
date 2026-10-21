# T Solutions

The website is in `public/` and is deployed to GitHub Pages by the workflow in `.github/workflows/deploy-pages.yml`.

## Website address

After the workflow has deployed successfully, the website will be at:

https://tichangari5869-crypto.github.io/TSOLUTIONS/

## Enable GitHub Pages

In the repository's **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions**. The workflow deploys the contents of `public/` whenever a change is pushed to `main`.

## Secure Admin login

The Admin login at the bottom of the page uses Google sign-in and Cloud Firestore. Before it can save changes:

1. Create a Firebase project and register a web app. Copy its `apiKey`, `authDomain`, `projectId`, and `appId` into `public/firebase-config.js`. Set `adminEmail` to the verified Google account that should administer the site.
2. In Firebase Console, enable **Authentication → Google** and create the default **Cloud Firestore** database.
3. Replace `REPLACE_WITH_ADMIN_EMAIL` in `firestore.rules` with the same admin email, then publish these rules in **Firestore Database → Rules**.
4. Add `tichangari5869-crypto.github.io` to **Authentication → Settings → Authorized domains** if it is not already listed.
5. Commit and push the config and rules changes to `main`. The site will then load saved catalog changes from Firestore; otherwise it continues to use `public/services.json`.

The Firebase web config is public by design. Firestore security rules restrict writes to the verified admin account; do not make the catalog write rules public.

To help Google discover the website, add its URL as a URL-prefix property in [Google Search Console](https://search.google.com/search-console/) and submit:

https://tichangari5869-crypto.github.io/TSOLUTIONS/sitemap.xml

Google decides when pages appear in search results. Indexing and ranking are not immediate or guaranteed.
