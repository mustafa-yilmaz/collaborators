import { useTranslation } from 'react-i18next';

import { Box } from '@/components';
import {
  Doc,
  useCreateChildDocTree,
  useTrans,
} from '@/features/docs/doc-management';
import { useDocChildren } from '@/features/docs/doc-tree/api/useDocChildren';
import { LogoSquare } from '@/features/invitations/LogoPicker';
import { useDate } from '@/hooks/useDate';

import { useLinkedPages } from '../api';

import { ItemCard, Section } from './FolderItems';

/**
 * Collaborators: a space opens as a folder: below its own text (its
 * introduction), its pages as documents, and the pages of elsewhere linked
 * into it.
 */
export const SpaceContents = ({ space }: { space: Doc }) => {
  const { t } = useTranslation();
  const { untitledDocument } = useTrans();
  const { relativeDate } = useDate();
  const { data: children } = useDocChildren(
    { docId: space.id, page_size: 100 },
    { enabled: space.abilities.children_list },
  );
  const { data: linked = [] } = useLinkedPages(space.id);
  const createPage = useCreateChildDocTree(space.id);
  const pages = children?.results ?? [];

  return (
    <Box
      $padding={{ top: 'lg' }}
      $css="border-top: 1px solid var(--c--contextuals--border--surface--primary);"
    >
      <Section
        testId="space-pages"
        title={t('Pages', { description: 'Heading of the pages of a space' })}
        newLabel={t('New page', {
          description: 'Button creating a page in a space',
        })}
        onNew={
          space.abilities.children_create && !space.deleted_at
            ? () => void createPage()
            : undefined
        }
        empty={
          pages.length || linked.length
            ? null
            : t('No page in this space yet.', {
                description: 'Space without pages',
              })
        }
      >
        {pages.map((page) => (
          <ItemCard
            key={page.id}
            href={`/page/${page.id}/`}
            icon={
              <LogoSquare
                owner="documents"
                id={page.id}
                size={44}
                fallbackIcon="description"
              />
            }
            title={page.title || untitledDocument}
            details={relativeDate(page.updated_at)}
          />
        ))}
        {linked.map((link) => (
          <ItemCard
            key={link.link_id}
            href={`/page/${link.page.id}/`}
            icon={
              <LogoSquare
                owner="documents"
                id={link.page.id}
                size={44}
                fallbackIcon="link"
              />
            }
            title={link.page.title || untitledDocument}
            details={
              link.home
                ? t('Linked from {{space}}', {
                    description: 'A page of another space shown in this one',
                    space: link.home.title || untitledDocument,
                  })
                : t('Linked here', {
                    description: 'A page of elsewhere shown in this space',
                  })
            }
          />
        ))}
      </Section>
    </Box>
  );
};
