# Sign in with Google and Microsoft (local development)

Collaborators accounts are created only by signing in through a provider. Locally, Keycloak (http://localhost:8083) sits between the app and the providers: you create one app at Google and one at Microsoft, then give their credentials to Keycloak.

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

## 3. Give the credentials to Keycloak

```bash
cp env.d/development/sso.local.dist env.d/development/sso.local
```

Open `env.d/development/sso.local` and paste the four values (Google client id and secret, Microsoft client id and secret). This file is gitignored, so the secrets never get committed.

With the stack running (`make run`), run:

```bash
make sso-providers
```

It adds or updates the two providers and turns off Keycloak's own "Register" form. Run it again any time you change a credential.

## 4. Try it

Open http://localhost:3000 and click **Login**. The Keycloak sign-in page shows **Google** and **Microsoft** buttons. Signing in with either creates your Collaborators account on the spot; there's no invitation step.

The username/password form on that page is still there for the built-in dev accounts (`impress` / `impress`). A Collaborators-branded sign-in page with only the provider buttons is planned for a later phase.

## Notes

- **Linking accounts:** Google's email addresses are trusted. If you later sign in with Microsoft using the same email, Keycloak asks you to confirm by signing in with the first method. Microsoft work-account emails are set by each organisation and aren't verified by Microsoft, so they're not trusted automatically.
- **Restricting Microsoft to one organisation:** put that tenant's id in `MICROSOFT_TENANT_ID` instead of `common`.
- Apple, LinkedIn and X come in a later phase (see `SPEC.md`, delivery phase 6).
