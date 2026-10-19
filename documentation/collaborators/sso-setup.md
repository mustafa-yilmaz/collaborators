# Sign-in providers (local development)

Collaborators accounts are created only by signing in through a provider: Google, Microsoft, Apple, LinkedIn or X. Locally, Keycloak (http://localhost:8083) sits between the app and the providers: you create an app at each provider you want, then give its credentials to Keycloak.

Everything here is for **local development** (`localhost`). Production needs its own apps with the real domain.

## 1. Create the Google app

1. Open the [Google Cloud console](https://console.cloud.google.com/) and create a project (e.g. "Collaborators dev").
2. **Google Auth Platform → Branding**: set the app name (Collaborators) and your support email.
3. **Audience**: choose **External**, so both personal Gmail and Google Workspace accounts can sign in. While the app is in "Testing", add the Google accounts you will test with under *Test users*.
4. **Clients → Create client**:
   - Application type: **Web application**
   - Authorised redirect URI: `http://localhost:8083/realms/impress/broker/google/endpoint`
5. Copy the **Client ID** and **Client secret**.

## 2. Create the Microsoft app

1. Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **App registrations → New registration**. A personal Microsoft account works for this; it gets a free default directory.
2. Name: Collaborators dev.
3. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**. This is what lets both work and personal accounts sign in.
4. Redirect URI: platform **Web**, `http://localhost:8083/realms/impress/broker/microsoft/endpoint`
5. After creating it, copy the **Application (client) ID** from the Overview page.
6. **Certificates & secrets → New client secret**. Copy the secret's **Value** right away; it's shown only once.
7. **API permissions**: check that `User.Read` (Microsoft Graph, delegated) is listed. It is by default.

## 3. Create the LinkedIn app

1. Open [LinkedIn Developers](https://www.linkedin.com/developers/apps) → **Create app** (it needs a LinkedIn company page; any page you manage works).
2. **Products**: add **Sign In with LinkedIn using OpenID Connect**.
3. **Auth** → Authorized redirect URL: `http://localhost:8083/realms/impress/broker/linkedin/endpoint`
4. Copy the **Client ID** and **Primary client secret**.

## 4. Create the X app

1. Open the [X developer portal](https://developer.x.com/) → a project and an app.
2. **User authentication settings**: OAuth 1.0a, **Request email from users** on, app type *Web App*.
   - Callback URL: `http://localhost:8083/realms/impress/broker/x/endpoint`
   - Website, terms and privacy URLs: X asks for them before it gives emails.
3. **Keys and tokens**: copy the **API Key** and **API Key Secret**.

X may give no email, or one it hasn't verified. Keycloak then asks the person for one. That email isn't trusted for linking accounts, nor for joining workspaces by domain.

## 5. Apple (optional, needs a public https address)

Keycloak has no Apple provider of its own:

1. Download the [Apple identity provider extension](https://github.com/klausbetz/apple-identity-provider-keycloak/releases) release made for Keycloak 26.3 (1.15.0 or 1.16.0). Put its `.jar` in `docker/auth/providers/` (gitignored), then restart Keycloak: `docker compose restart keycloak`.
2. In your [Apple Developer account](https://developer.apple.com/account/resources/identifiers/list) (paid membership):
   - Create a **Services ID** with **Sign in with Apple**.
   - Set its return URL to `https://<your public address>/realms/impress/broker/apple/endpoint`. Apple refuses `localhost` and `http`, so use a tunnel to your Keycloak.
3. **Keys** → create a key with Sign in with Apple. Download the `.p8` file and keep it outside the repository. Note the **Key ID** and your **Team ID**.

## 6. Give the credentials to Keycloak

```bash
cp env.d/development/sso.local.dist env.d/development/sso.local
```

Open `env.d/development/sso.local` and fill in the values of the providers you created; leave the others empty. For Apple, `APPLE_PRIVATE_KEY_FILE` is the path of the `.p8` file. This file is gitignored, so the secrets never get committed.

With the stack running (`make run`), run:

```bash
make sso-providers
```

It adds or updates the providers and turns off Keycloak's own "Register" form. It also sends Keycloak's emails to the dev mail catcher (http://localhost:1081), and writes the list of providers to `env.d/development/common.local`. Restart the backend to apply that list (`docker compose up -d app-dev`). Run the script again any time you change a credential.

## 7. Try it

Open http://localhost:3000 and click **Start collaborating**. The Collaborators sign-in page shows one **Continue with …** button per provider; each goes straight to that provider. Signing in creates your Collaborators account on the spot; there's no invitation step.

In development the page also has **Use a test account**. It opens Keycloak's own page, for the built-in dev accounts (see `docker/auth/realm.json`). `COLLABORATORS_SIGNIN_PASSWORD` turns it on; it is off by default, so never in production.

## Notes

- **Linking accounts:** signing in with a second provider that gives the email of an existing account offers to link them.
  - You confirm by signing in with the first method, or by a link sent to that email.
  - Google, Apple and LinkedIn emails are trusted as verified. Microsoft work-account emails (set by each organisation) and X emails aren't.
  - **Sign-in methods** in the account menu (bottom left) opens Keycloak's *Linked accounts* page: add or remove providers there. The page URL is `COLLABORATORS_ACCOUNT_URL`.
- **Joining workspaces:** in a workspace's settings, admins can create a **join link**. They can also open the workspace to an **email domain**, optionally adding joiners to an organisation group:
  - Whoever signs in with a verified email at that domain joins as a member.
  - An admin can only add the domain of their own verified email.
  - Public domains (Gmail, Outlook…) are refused.
- **Email invitations** to documents are turned off (`COLLABORATORS_EMAIL_INVITATIONS`). Documents are shared with people who already have an account.
- **Restricting Microsoft to one organisation:** put that tenant's id in `MICROSOFT_TENANT_ID` instead of `common`.
