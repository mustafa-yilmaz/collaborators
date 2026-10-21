import {
  LEGAL_PAGES,
  LegalPage,
  MailLink,
  PageLink,
} from '@/features/legal/LegalPage';
import { NextPageWithLayout } from '@/types/next';

/** /legal-notice/: who runs the site, and who hosts it. English only for now. */
const Page: NextPageWithLayout = () => (
  <LegalPage title="Legal notice" updated="21 October 2026">
    <h2>Publisher</h2>
    <p>
      The website collaborators.community and its sub-domains are published by:
    </p>
    <ul>
      <li>The Collaborators founding team</li>
      <li>
        Email: <MailLink />
      </li>
    </ul>
    <p>
      For any question about the publisher, its address or the person
      responsible for the content, write to <MailLink />.
    </p>

    <h2>Hosting</h2>
    <p>The website is hosted by:</p>
    <ul>
      <li>Hetzner Online GmbH</li>
      <li>Industriestr. 25, 91710 Gunzenhausen, Germany</li>
      <li>
        <a
          href="https://www.hetzner.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          www.hetzner.com
        </a>
      </li>
    </ul>

    <h2>Content published by users</h2>
    <p>
      Pages, tables, comments, profiles and wikis are written by the people who
      use Collaborators, who are responsible for what they publish. To report
      content that is unlawful or infringes your rights, write to <MailLink />,
      with the address of the page and the reason. We look at every report and
      remove what must be removed.
    </p>

    <h2>Software</h2>
    <p>
      Collaborators is built on open-source software, notably{' '}
      <a
        href="https://github.com/suitenumerique/docs"
        target="_blank"
        rel="noopener noreferrer"
      >
        Docs
      </a>{' '}
      (La Suite numérique) and{' '}
      <a
        href="https://github.com/TypeCellOS/BlockNote"
        target="_blank"
        rel="noopener noreferrer"
      >
        BlockNote
      </a>
      , under their own licences. Unless otherwise stated, the code of the site
      is under the MIT licence.
    </p>

    <h2>Personal data and accessibility</h2>
    <p>
      How your personal data is handled is explained in the{' '}
      <PageLink href={LEGAL_PAGES.privacy}>privacy policy</PageLink>. How
      accessible the site is, in the{' '}
      <PageLink href={LEGAL_PAGES.accessibility}>
        accessibility statement
      </PageLink>
      .
    </p>
  </LegalPage>
);

export default Page;
