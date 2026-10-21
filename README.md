# T Solutions

The website is in `public/` and is deployed to GitHub Pages by the workflow in `.github/workflows/deploy-pages.yml`.

## Website address

After the workflow has deployed successfully, the website will be at:

https://tichangari5869-crypto.github.io/TSOLUTIONS/

## Enable GitHub Pages

In the repository's **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions**. The workflow deploys the contents of `public/` whenever a change is pushed to `main`.

## Secure Admin login

The Admin login at the bottom of the page uses Firebase email/password sign-in and Cloud Firestore. It can edit the site text and contact details, manage search shortcuts, add/edit/remove categories and services, and publish the changes. Before it can save changes:

1. Create a Firebase project and register a web app. Copy its `apiKey`, `authDomain`, `projectId`, and `appId` into `public/firebase-config.js`.
2. Enable **Authentication → Email/Password**. Create the admin account with a full email address and a strong password, verify that email, and copy the account's Firebase **UID** into `adminUid`. Do not use a short PIN as the website password.
3. Create the default **Cloud Firestore** database.
4. Replace `REPLACE_WITH_ADMIN_UID` in `firestore.rules` with the same admin UID, then publish these rules in **Firestore Database → Rules**.
5. Add `tichangari5869-crypto.github.io` to **Authentication → Settings → Authorized domains** if it is not already listed.
6. Commit and push the config and rules changes to `main`. The site will then load saved catalog changes from Firestore; otherwise it continues to use `public/services.json`.

The Firebase web config and admin UID are public by design. Firestore security rules restrict writes to the signed-in admin UID; do not make the catalog write rules public. The Admin panel can change the login only after the current email and password are re-entered. Email changes take effect after the verification link is confirmed.

To help Google discover the website, add its URL as a URL-prefix property in [Google Search Console](https://search.google.com/search-console/) and submit:

https://tichangari5869-crypto.github.io/TSOLUTIONS/sitemap.xml

Google decides when pages appear in search results. Indexing and ranking are not immediate or guaranteed.
