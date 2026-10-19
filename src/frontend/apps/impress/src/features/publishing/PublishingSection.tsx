import { Select } from '@gouvfr-lasuite/ui-components';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, StyledLink, Text } from '@/components';
import { useUpdateWorkspace } from '@/features/workspaces/api';
import { PublishingPolicy, Workspace } from '@/features/workspaces/types';
import { useDate } from '@/hooks/useDate';

import { PublicationLogEntry, usePublicationLog } from './api';
import { wikiUrl } from './utils';

const useActionText = () => {
  const { t } = useTranslation();
  return (entry: PublicationLogEntry) => {
    const values = { name: entry.actor ?? '—' };
    switch (entry.action) {
      case 'page_published':
        return t('{{name}} published', {
          description: 'Publishing log: a page was made public',
          ...values,
        });
      case 'page_unpublished':
        return t('{{name}} unpublished', {
          description: 'Publishing log: a page stopped being public',
          ...values,
        });
      case 'wiki_published':
        return t('{{name}} published as a wiki', {
          description: 'Publishing log: a space was published as a wiki',
          ...values,
        });
      case 'wiki_updated':
        return t('{{name}} changed the wiki settings of', {
          description: 'Publishing log: the settings of a wiki changed',
          ...values,
        });
      case 'wiki_unpublished':
        return t('{{name}} unpublished the wiki', {
          description: 'Publishing log: a wiki was taken down',
          ...values,
        });
    }
  };
};

/**
 * Workspace settings: who may publish the workspace's pages and spaces to the
 * web, and the log of what was published.
 */
export const PublishingSection = ({
  workspace,
  Section,
}: {
  workspace: Workspace;
  Section: (props: {
    title: string;
    description?: string;
    children: React.ReactNode;
  }) => React.ReactNode;
}) => {
  const { t } = useTranslation();
  const { relativeDate } = useDate();
  const actionText = useActionText();
  const isAdmin = workspace.abilities.update;
  const { mutate: updateWorkspace } = useUpdateWorkspace();
  const { data: log = [] } = usePublicationLog(workspace.id, isAdmin);

  if (!isAdmin) {
    return null;
  }

  return (
    <Section
      title={t('Publishing', {
        description: 'Heading of the publishing settings of a workspace',
      })}
      description={t(
        'Pages and spaces can be published to the web, as public pages and wikis that anyone can read.',
        { description: 'Explanation of publishing in workspace settings' },
      )}
    >
      <Select
        fullWidth
        label={t('Who can publish', {
          description: 'Label of the publishing policy of a workspace',
        })}
        clearable={false}
        options={[
          {
            label: t('Space owners and administrators', {
              description: 'Publishing policy',
            }),
            value: 'space_admins',
          },
          {
            label: t('Workspace administrators only', {
              description: 'Publishing policy',
            }),
            value: 'workspace_admins',
          },
        ]}
        value={workspace.publishing_policy}
        onChange={(event) =>
          updateWorkspace({
            id: workspace.id,
            publishing_policy: event.target.value as PublishingPolicy,
          })
        }
      />
      <Box $gap="3xs">
        <Text as="h3" $size="sm" $weight="700" $margin="none">
          {t('Publishing log', {
            description: 'Heading of the log of publications',
          })}
        </Text>
        {log.length === 0 && (
          <Text $size="sm" $variation="secondary">
            {t('Nothing was published yet.', {
              description: 'Empty publishing log',
            })}
          </Text>
        )}
        <Box as="ul" $css="list-style: none; margin: 0; padding: 0;">
          {log.map((entry) => (
            <Box
              as="li"
              key={entry.id}
              $direction="row"
              $align="center"
              $gap="xs"
              $padding={{ vertical: '3xs' }}
              $css={css`
                border-bottom: 1px solid
                  var(--c--contextuals--border--surface--primary);
                &:last-child {
                  border-bottom: none;
                }
              `}
            >
              <Icon
                iconName={
                  entry.action.endsWith('unpublished') ? 'public_off' : 'public'
                }
                $size="18px"
                $variation="secondary"
              />
              <Text $size="sm" $css="flex: 1; min-width: 0;">
                {actionText(entry)}{' '}
                <StyledLink
                  href={
                    entry.details.slug && entry.action !== 'wiki_unpublished'
                      ? wikiUrl(entry.details.slug)
                      : `/docs/${entry.document.id}/`
                  }
                >
                  <Text as="span" $size="sm" $weight="600">
                    {entry.document.title ||
                      t('Untitled document', {
                        description: 'Name of a document without title',
                      })}
                  </Text>
                </StyledLink>
              </Text>
              <Text $size="xs" $variation="secondary">
                {relativeDate(entry.created_at)}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
    </Section>
  );
};
