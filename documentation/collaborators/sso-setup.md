# Sign-in providers (local development)

Collaborators accounts are created only by signing in through a provider: **Google**, **Microsoft** or **LinkedIn**. People sign in with their ordinary personal (or work) accounts. Only the owner of Collaborators registers it once at each provider, as below.

Locally, Keycloak (http://localhost:8083) sits between the app and the providers: you create an app at each provider you want, then give its credentials to Keycloak.

**Apple and X are not offered** (decided 2026-10-19): Apple needs a paid Apple Developer membership, and the X API is pay-per-use (about $0.01 per sign-in from prepaid credits).

Everything here is for **local development** (`localhost`). Production needs its own apps, or the same ones with the production redirect addresses added (see *Production* at the end).

## 1. Create the Google app

1. Open the [Google Cloud console](https://console.cloud.google.com/) and create a project (e.g. "Collaborators dev").
2. **Google Auth Platform → Get started**:
   - App name **Collaborators**, with your support email.
   - Audience **External**, so both personal Gmail and Google Workspace accounts can sign in.
   - Your contact email.
   - Agree to the Google API Services User Data Policy.
3. **Clients → Create client**:
   - Application type: **Web application**
   - Authorised redirect URI: `http://localhost:8083/realms/impress/broker/google/endpoint`
4. A window shows the **Client ID** and **Client secret**. Save both now (see step 4): the secret may not be shown again.
5. **Audience → Test users**: add the Google accounts that may sign in. The app starts in **Testing**, where only test users (up to 100) can sign in.
   - Publishing it for every Google account needs a public home page and privacy policy on a verified domain. That's done for production.

## 2. Create the Microsoft app

1. Microsoft registers apps only inside a **directory** (Entra ID tenant):
   - **Work or school account:** it already has one.
   - **Personal account (Outlook, Hotmail):** first sign up for a free Azure account at https://azure.microsoft.com/free with it. This creates a "Default Directory" you own; app registration and Microsoft sign-in cost nothing.
2. In the [Azure portal](https://portal.azure.com/) → **App registrations → New registration**:
   - Name: **Collaborators**.
   - Supported account types: **Any Entra ID Tenant + Personal Microsoft accounts**, so both work and personal accounts can sign in.
   - Redirect URI: platform **Web**, `http://localhost:8083/realms/impress/broker/microsoft/endpoint`
3. Copy the **Application (client) ID** from the Overview page.
4. **Certificates & secrets → New client secret** (e.g. "Keycloak dev", 180 days). Copy its **Value**, not the "Secret ID": it's shown only once. Make a new one before it expires.

## 3. Create the LinkedIn app

1. LinkedIn links every app to a LinkedIn **Page** you administer. It shows as the app's publisher; people still sign in with their personal profiles.
   - If you have no Page, create one for free from your personal account: [Create a Page](https://www.linkedin.com/company/setup/new/).
   - The Collaborators Page is https://www.linkedin.com/company/81666605/.
2. [LinkedIn Developers](https://www.linkedin.com/developers/apps) → **Create app**:
   - App name **Collaborators**.
   - **LinkedIn Page:** type the Page's address. If its name has emojis, use its numeric address (`https://www.linkedin.com/company/<id>/`).
   - An app logo (square, at least 100 px).
   - Agree to the API Terms of Use.
3. **Products** → **Sign In with LinkedIn using OpenID Connect** → Request access. It's granted at once, with the scopes `openid`, `profile` and `email`.
4. **Auth** → Authorized redirect URLs → add `http://localhost:8083/realms/impress/broker/linkedin/endpoint` → Update.
5. On the same page: the **Client ID**, and the **Primary Client Secret** (eye or copy icon).

## 4. Give the credentials to Keycloak

```bash
cp env.d/development/sso.local.dist env.d/development/sso.local
```

Fill in `env.d/development/sso.local` with the values of the providers you created, and leave the others empty. The file is gitignored, so the secrets never get committed.

To paste a secret without it showing on screen, use a command like this (here for Google; use the other variable names for the others):

```bash
read -rs "secret?Secret: " && sed -i '' "s|^GOOGLE_CLIENT_SECRET=.*|GOOGLE_CLIENT_SECRET=$secret|" env.d/development/sso.local
```

With the stack running (`make run`), run:

```bash
make sso-providers
```

It does the following:
- adds or updates the providers;
- turns off Keycloak's own "Register" form;
- asks for unverified emails (Microsoft) to be confirmed by a link before entering;
- sends Keycloak's emails to the dev mail catcher (http://localhost:1081);
- writes the list of providers to `env.d/development/common.local`.

Restart the backend to apply that list (`docker compose up -d app-dev`). Run the script again any time you change a credential.

## 5. Try it

Open http://localhost:3000 and click **Start collaborating**. The sign-in page shows one **Continue with …** button per provider, each going straight to it. Signing in creates your Collaborators account on the spot; there's no invitation step.

- **Testing a second account:** use an **Incognito window**. A browser already signed in to Collaborators, or to another Microsoft account, gets in the way.
- **Emails in development** (confirming an address, linking accounts) don't reach real inboxes. They land in the mail catcher at http://localhost:1081: open the link **in the same window** where the sign-in is waiting.

In development the page also has **Use a test account**. It opens Keycloak's own page, for the built-in dev accounts (see `docker/auth/realm.json`, whose emails count as verified). `COLLABORATORS_SIGNIN_PASSWORD` turns it on; it is off by default, so never in production.

## Notes

- **Linking accounts:** signing in with a second provider that gives the email of an existing account shows "Account already exists".
  - Choose **Add to existing account**, then confirm by signing in with the first method, or by the emailed link.
  - From then on, both providers sign in to the same account.
  - Google and LinkedIn emails are trusted as verified. Microsoft emails aren't (work accounts' are set by each organisation): the first time, Keycloak sends a link to confirm the address before entering.
- **Sign-in methods** in the account menu (bottom left) lists the providers, connected or not:
  - **Connect** asks to sign in with that provider once, then links it.
  - **Disconnect** removes one, never the last.
  - The backend reads and removes the links through Keycloak's admin API, with its own client `collaborators-backend`. `make sso-providers` creates it (with the dev secret already in `env.d/development/common`, `COLLABORATORS_KEYCLOAK_*`). In production, give that client its own secret.
  - Linking is allowed up to an hour after signing in (`max_auth_age` of Keycloak's `idp_link` action); later, Keycloak asks to sign in again first.
- **Joining workspaces:** in a workspace's settings, admins can create a **join link**. They can also open the workspace to an **email domain**, optionally adding joiners to an organisation group:
  - Whoever signs in with a verified email at that domain joins as a member.
  - An admin can only add the domain of their own verified email.
  - Public domains (Gmail, Outlook…) are refused.
- **Email invitations** to documents are turned off (`COLLABORATORS_EMAIL_INVITATIONS`). Documents are shared with people who already have an account.
- **No `acr_values` in development:** the upstream default (`eidas1`) makes Keycloak refuse linking with "strong authentication required", so `OIDC_AUTH_REQUEST_EXTRA_PARAMS` is empty.
- **Restricting Microsoft to one organisation:** put that tenant's id in `MICROSOFT_TENANT_ID` instead of `common`.

## Production

Once the production addresses exist, typically Keycloak at `https://auth.collaborators.community` with realm `collaborators`:

- **Redirect addresses:** add `https://<auth address>/realms/<realm>/broker/<google|microsoft|linkedin>/endpoint` at each provider, next to the local ones. Separate production apps are cleaner but not required.
- **Google:**
  - Fill in the Branding page with the home page and privacy policy (on the verified domain).
  - Then **Publish app**, so every Google account can sign in. Basic sign-in (name and email) needs no review.
- **Keycloak's emails:** set a real SMTP server instead of the mail catcher.
- **Backend client:** set a new secret for `collaborators-backend` and put it in `COLLABORATORS_KEYCLOAK_CLIENT_SECRET`.
- **Secrets:** keep them in the production secret store, never in the repository.
