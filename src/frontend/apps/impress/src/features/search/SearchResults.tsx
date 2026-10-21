import { useRouter } from 'next/router';
import { Fragment, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, Text } from '@/components';
import { labelHref } from '@/features/labels/LabelEditor';
import { useWorkspaceStore } from '@/features/workspaces/stores/useWorkspaceStore';

import {
  SearchDocument,
  SearchGroup,
  SearchResult,
  SearchWorkspace,
  isEmpty,
  searchHref,
} from './api';

const rowCss = css`
  display: flex;
  align-items: center;
  gap: var(--c--globals--spacings--sm);
  width: 100%;
  padding: var(--c--globals--spacings--2xs) var(--c--globals--spacings--xs);
  border-radius: var(--c--globals--spacings--3xs);
  text-align: left;
  color: inherit;
  &:hover,
  &:focus-visible {
    background-color: var(
      --c--contextuals--background--semantic--contextual--primary
    );
  }
`;

const ResultRow = ({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: string;
  title: string;
  detail?: string;
  onClick: () => void;
}) => (
  <Box as="li" $css="list-style: none;">
    <Box as="button" type="button" onClick={onClick} $css={rowCss}>
      <Icon iconName={icon} $size="22px" $variation="secondary" />
      <Box $flex={1} $css="min-width: 0;">
        <Text $size="sm" $weight="500" $ellipsis>
          {title}
        </Text>
        {detail && (
          <Text $size="xs" $variation="secondary" $ellipsis>
            {detail}
          </Text>
        )}
      </Box>
    </Box>
  </Box>
);

const Kind = ({ title, children }: { title: string; children: ReactNode }) => (
  <Box $gap="4xs">
    <Text
      as="h3"
      $size="xs"
      $weight="600"
      $variation="secondary"
      $margin="none"
      $padding={{ horizontal: 'xs' }}
      $css="text-transform: uppercase; letter-spacing: 0.04em;"
    >
      {title}
    </Text>
    <Box as="ul" $margin="none" $padding="none" $gap="4xs">
      {children}
    </Box>
  </Box>
);

/**
 * The results of the one search: what one is part of, then what is open to
 * them; in each, workspaces, spaces, pages and labels.
 */
export const SearchResults = ({
  result,
  onOpen,
  renderVisibleWorkspace,
}: {
  result: SearchResult;
  /** Called after opening a result (e.g. to close a dialog) */
  onOpen?: () => void;
  /**
   * How a workspace one may join shows, e.g. a card with "Ask to join";
   * otherwise a row leading to the Search screen, which shows that card.
   */
  renderVisibleWorkspace?: (workspace: SearchWorkspace) => ReactNode;
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { setCurrentWorkspaceId } = useWorkspaceStore();
  const go = (href: string) => {
    void router.push(href);
    onOpen?.();
  };
  const untitled = t('Untitled page', {
    description: 'Name of a page without title',
  });
  const documentRow = (doc: SearchDocument) => (
    <ResultRow
      key={doc.id}
      icon={doc.kind === 'space' ? 'folder' : 'description'}
      title={doc.title || untitled}
      detail={[doc.context, doc.snippet].filter(Boolean).join(' · ')}
      onClick={() => go(`/docs/${doc.id}/`)}
    />
  );

  const section = (title: string, group: SearchGroup, involved: boolean) =>
    isEmpty(group) ? null : (
      <Box
        $gap="xs"
        as="section"
        data-testid={`search-${involved ? 'involved' : 'visible'}`}
      >
        <Text as="h2" $size="sm" $weight="700" $margin="none">
          {title}
        </Text>
        {group.workspaces.length > 0 && !involved && renderVisibleWorkspace && (
          <Kind title={t('Workspaces', { description: 'Search results kind' })}>
            <Box as="ul" $gap="xs" $margin="none" $padding="none">
              {group.workspaces.map((workspace) => (
                <Fragment key={workspace.id}>
                  {renderVisibleWorkspace(workspace)}
                </Fragment>
              ))}
            </Box>
          </Kind>
        )}
        {group.workspaces.length > 0 &&
          (involved || !renderVisibleWorkspace) && (
            <Kind
              title={t('Workspaces', { description: 'Search results kind' })}
            >
              {group.workspaces.map((workspace) => (
                <ResultRow
                  key={workspace.id}
                  icon="workspaces"
                  title={workspace.name}
                  detail={workspace.description}
                  onClick={() => {
                    if (involved) {
                      setCurrentWorkspaceId(workspace.id);
                      go('/');
                    } else {
                      // Open to join: its card on the Search screen
                      go(searchHref(workspace.name));
                    }
                  }}
                />
              ))}
            </Kind>
          )}
        {group.spaces.length > 0 && (
          <Kind title={t('Spaces', { description: 'Search results kind' })}>
            {group.spaces.map(documentRow)}
          </Kind>
        )}
        {group.pages.length > 0 && (
          <Kind title={t('Pages', { description: 'Search results kind' })}>
            {group.pages.map(documentRow)}
          </Kind>
        )}
        {group.labels.length > 0 && (
          <Kind title={t('Labels', { description: 'Search results kind' })}>
            {group.labels.map((name) => (
              <ResultRow
                key={name}
                icon="sell"
                title={`#${name}`}
                onClick={() => go(labelHref(name))}
              />
            ))}
          </Kind>
        )}
      </Box>
    );

  if (isEmpty(result.involved) && isEmpty(result.visible)) {
    return (
      <Text $size="sm" $variation="secondary" $padding={{ horizontal: 'xs' }}>
        {t('Nothing found for “{{query}}”.', {
          description: 'Search without results',
          query: result.q,
        })}
      </Text>
    );
  }

  return (
    <Box $gap="md">
      {section(
        t('Yours', {
          description: 'Search results one is part of',
        }),
        result.involved,
        true,
      )}
      {section(
        t('Visible to you', {
          description: 'Search results one is not part of yet, but may see',
        }),
        result.visible,
        false,
      )}
    </Box>
  );
};
