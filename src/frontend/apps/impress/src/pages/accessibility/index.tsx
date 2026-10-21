import { LegalPage, MailLink } from '@/features/legal/LegalPage';
import { NextPageWithLayout } from '@/types/next';

/** /accessibility/: the accessibility statement. English only for now. */
const Page: NextPageWithLayout = () => (
  <LegalPage title="Accessibility statement" updated="21 October 2026">
    <p>
      We want Collaborators to be usable by everyone, including people who use a
      screen reader, a keyboard only, magnification or other assistive
      technologies. This statement applies to collaborators.community and its
      sub-domains.
    </p>

    <h2>Compliance status</h2>
    <p>
      The target is the Web Content Accessibility Guidelines (WCAG) 2.1, level
      AA, as required by the European standard EN 301 549.
    </p>
    <p>
      Collaborators has <strong>not been audited yet</strong>, so we cannot
      claim that it complies. It is built on Docs, from La Suite numérique,
      which was designed with accessibility in mind, but the features added
      since (tables, workspaces, profiles, wikis…) have not been checked
      systematically, and some parts may still be hard to use.
    </p>

    <h2>Feedback and contact</h2>
    <p>
      If you cannot use part of the site, or find an accessibility problem,
      please tell us at <MailLink />. Describe what you were trying to do, and
      the browser and assistive technology you use. We will answer, and help you
      reach the content another way in the meantime.
    </p>

    <h2>Enforcement</h2>
    <p>
      If you are not satisfied with our answer, you can contact the authority in
      charge of accessibility complaints where you live, if there is one.
    </p>

    <h2>Preparation of this statement</h2>
    <p>
      This statement was written on 20 October 2026, from our own review of the
      site. It will be updated after an audit.
    </p>
  </LegalPage>
);

export default Page;
