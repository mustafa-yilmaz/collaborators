import {
  LEGAL_PAGES,
  LegalPage,
  MailLink,
  PageLink,
  Placeholder,
} from '@/features/legal/LegalPage';
import { NextPageWithLayout } from '@/types/next';

/**
 * /privacy/: the privacy policy ("Personal data and cookies" in the footer),
 * also the privacy policy address given to Google, Microsoft and LinkedIn.
 * English only for now.
 */
const Page: NextPageWithLayout = () => (
  <LegalPage
    title="Privacy policy: personal data and cookies"
    updated="20 October 2026"
  >
    <p>
      Collaborators (collaborators.community) is a platform where people write
      pages and tables together, organise them in workspaces and spaces, and
      publish wikis. This page explains which personal data it keeps, why, for
      how long, and what you can ask us to do with it. It applies to the website
      and to everything served from collaborators.community and its sub-domains.
    </p>

    <h2>Who is responsible</h2>
    <p>
      The data controller is{' '}
      <Placeholder>
        name of the person or legal entity operating Collaborators
      </Placeholder>
      , <Placeholder>postal address</Placeholder>. See also the{' '}
      <PageLink href={LEGAL_PAGES.legalNotice}>legal notice</PageLink>.
    </p>
    <p>
      For any question about your data, or to use your rights, write to{' '}
      <MailLink />.
    </p>

    <h2>What we keep, and why</h2>

    <h3>Your account, from the sign-in provider</h3>
    <p>
      There is no Collaborators password: you sign in with an account you
      already have at Google, Microsoft or LinkedIn. The first time, this
      creates your Collaborators account. We only ask the provider for the basic
      sign-in information (the <code>openid</code>, <code>profile</code> and{' '}
      <code>email</code> permissions), and receive:
    </p>
    <ul>
      <li>your name;</li>
      <li>your email address, and whether the provider has verified it;</li>
      <li>
        the identifier the provider gives your account (a number or code that
        stays the same each time you sign in), so we recognise you next time;
      </li>
      <li>
        for Google Workspace and Microsoft work or school accounts: your
        organisation&apos;s domain or tenant identifier, so you can join the
        workspaces opened to your organisation.
      </li>
    </ul>
    <p>
      We never see your password at Google, Microsoft or LinkedIn. Our sign-in
      server, which we run ourselves on the same servers as the rest of the
      platform, keeps the link between your Collaborators account and each
      provider account you connected, and the tokens the provider returns at
      sign-in. If you connect several sign-in methods, we keep each of them so
      any of them opens your account.
    </p>

    <h3>Your profile</h3>
    <p>
      You may add to your profile a headline, an organisation, a location, a
      short biography, a website and interests. All of these are optional. Each
      piece, as well as your email address and the workspaces you belong to, has
      its own visibility, which you choose: public on the internet, everyone on
      Collaborators, the people you work with, or chosen workspaces and spaces.
      Your name always stays visible at least to the people you work with.
    </p>

    <h3>What you create and share</h3>
    <ul>
      <li>
        pages and tables you write or edit, their history, comments and
        reactions, and the files and images you upload into them;
      </li>
      <li>
        the workspaces, spaces and groups you belong to, your role in them, your
        requests to join, and the people you share pages with;
      </li>
      <li>the labels you create or attach, and your favourites;</li>
      <li>
        the pages you opened from a shared link, so they appear in your list;
      </li>
      <li>
        wikis you publish: once published, a wiki is public on the internet
        until you unpublish it.
      </li>
    </ul>
    <p>
      This content is visible to the people it is shared with, according to the
      sharing settings of each page, space and workspace.
    </p>

    <h3>Mentions and notifications</h3>
    <p>
      When someone mentions you (or a group you belong to), assigns you a table
      row, or asks to join a workspace you administer, we store a notification
      for you, with who did what and where. We may also send it to your email
      address; you can turn these emails off in your account.
    </p>

    <h3>Preferences</h3>
    <p>
      Your language, the layout of your dashboard, and whether you want emails.
      Some display settings (for example whether a panel is open) are only kept
      in your own browser.
    </p>

    <h3>Server logs</h3>
    <p>
      Like any website, our servers record technical information about each
      request: IP address, date and time, the address requested, the
      browser&apos;s user agent, and the result. We use these logs only to keep
      the service running and secure (finding errors, stopping abuse). They are
      kept in size-limited files that are overwritten automatically, usually
      within a few weeks.
    </p>

    <h2>Legal bases</h2>
    <ul>
      <li>
        <strong>Providing the service you signed up for</strong> (GDPR article
        6(1)(b)): your account, profile, content, notifications and preferences.
      </li>
      <li>
        <strong>Our legitimate interest</strong> in keeping the platform secure
        and working (article 6(1)(f)): server logs.
      </li>
      <li>
        <strong>Your consent</strong> (article 6(1)(a)): optional profile
        information you choose to make visible, and notification emails. You can
        change or withdraw these at any time.
      </li>
    </ul>

    <h2>Cookies and similar technologies</h2>
    <p>We only use what the platform needs to work:</p>
    <ul>
      <li>a session cookie that keeps you signed in;</li>
      <li>a security cookie protecting forms against forged requests;</li>
      <li>the sign-in server&apos;s own cookies, while you sign in;</li>
      <li>
        your browser&apos;s local storage, for display preferences and to load
        the app faster.
      </li>
    </ul>
    <p>
      There are <strong>no advertising, analytics or tracking cookies</strong>,
      no third-party trackers and no ads. As these cookies are strictly
      necessary, no consent banner is needed.
    </p>

    <h2>Where your data is kept</h2>
    <p>
      Everything (the database, uploaded files, the sign-in server and the logs)
      is hosted on servers rented from Hetzner Online GmbH, in the European
      Union (Falkenstein, Germany). Your data is not transferred outside the
      European Economic Area by us.
    </p>

    <h2>Who else receives data</h2>
    <p>We do not sell your data, and we do not share it for advertising.</p>
    <ul>
      <li>
        <strong>Hetzner Online GmbH</strong> hosts the servers (processor, under
        a data processing agreement).
      </li>
      <li>
        <strong>Brevo (Sendinblue SAS, France)</strong> sends notification and
        sign-in emails (processor, under a data processing agreement).
      </li>
      <li>
        <strong>Google, Microsoft and LinkedIn</strong> know that you signed in
        to Collaborators with them. They act under their own privacy policies.
      </li>
      <li>
        Other collaborators see what you share with them and the parts of your
        profile you let them see.
      </li>
      <li>Authorities, only where the law requires it.</li>
    </ul>

    <h2>Google user data</h2>
    <p>
      When you sign in with Google, Collaborators only receives your name, email
      address, account identifier and, for Google Workspace accounts, your
      organisation&apos;s domain. We use them only to sign you in, to show your
      name to the people you work with, and to let you join workspaces opened to
      your organisation. We do not use them for advertising, do not sell them,
      and do not share them with anyone except as described above.
      Collaborators&apos; use and transfer of information received from Google
      APIs adheres to the{' '}
      <a
        href="https://developers.google.com/terms/api-services-user-data-policy"
        target="_blank"
        rel="noopener noreferrer"
      >
        Google API Services User Data Policy
      </a>
      , including the Limited Use requirements.
    </p>

    <h2>How long we keep it</h2>
    <ul>
      <li>
        Account, profile, preferences and notifications: as long as your account
        exists.
      </li>
      <li>
        Content: as long as your account exists, or longer for content you
        shared into a workspace, which stays with that workspace. Deleted pages
        go to the trash first, and are removed for good later.
      </li>
      <li>Server logs: usually a few weeks, see above.</li>
      <li>Backups: 14 days, then deleted.</li>
    </ul>
    <p>
      When you ask us to delete your account, we delete it and your personal
      data within one month.
    </p>

    <h2>Your rights</h2>
    <p>Under the General Data Protection Regulation (GDPR), you may:</p>
    <ul>
      <li>get a copy of your personal data (access, and portability);</li>
      <li>have it corrected;</li>
      <li>have it deleted, including your whole account;</li>
      <li>have its use restricted, or object to it;</li>
      <li>withdraw your consent, for what is based on consent.</li>
    </ul>
    <p>
      You can change your profile, its visibility, your sign-in methods and your
      email preferences yourself, from your account. For anything else, write to{' '}
      <MailLink />. We answer within one month.
    </p>
    <p>
      You may also complain to a data protection authority, in particular the
      one where you live, or{' '}
      <Placeholder>
        the data protection authority of the operator&apos;s country
      </Placeholder>
      .
    </p>

    <h2>Security</h2>
    <p>
      All traffic is encrypted (HTTPS). Access to the servers is restricted to
      the administrators of the platform, and each page is only shown to the
      people it is shared with.
    </p>

    <h2>Changes to this policy</h2>
    <p>
      When this policy changes, we update this page and its date. Important
      changes are also announced on the platform.
    </p>
  </LegalPage>
);

export default Page;
