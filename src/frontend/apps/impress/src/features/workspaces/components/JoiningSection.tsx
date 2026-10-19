import {
  Button,
  Input,
  Select,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/ui-components';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, Text } from '@/components';
import { useClipboard } from '@/hooks';

import { useGroups, useJoinLinkMutations, useUpdateWorkspace } from '../api';
import { Workspace } from '../types';

type SectionProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
};

const SubHeading = ({ children }: { children: ReactNode }) => (
  <Text as="h3" $size="sm" $weight="700" $margin="none">
    {children}
  </Text>
);

/**
 * Workspace settings: joining without an invitation, by a join link or by
 * the domain of a verified email address (into an organisation group).
 */
export const JoiningSection = ({
  workspace,
  Section,
}: {
  workspace: Workspace;
  Section: (props: SectionProps) => ReactNode;
}) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const copyToClipboard = useClipboard();
  const [domain, setDomain] = useState('');
  const { mutate: updateWorkspace, isPending } = useUpdateWorkspace();
  const { renew, remove } = useJoinLinkMutations(workspace.id);
  const { data: groups = [] } = useGroups(workspace.id);

  if (!workspace.abilities.update) {
    return null;
  }

  const onError = (error?: { cause?: string[] }) =>
    toast(
      error?.cause?.[0] ??
        t('Something went wrong.', { description: 'Generic error message' }),
      VariantType.ERROR,
    );
  const link = workspace.join_token
    ? `${window.location.origin}/join/${workspace.join_token}/`
    : null;
  const setDomains = (domains: string[]) =>
    updateWorkspace(
      { id: workspace.id, join_domains: domains },
      { onError, onSuccess: () => setDomain('') },
    );

  return (
    <Section
      title={t('Joining', {
        description: 'Heading of how people join a workspace',
      })}
      description={t(
        'People join by signing in: with a link you give them, or automatically when their verified email is at your organisation’s domain.',
        { description: 'Explanation of joining a workspace' },
      )}
    >
      <Box $gap="xs">
        <SubHeading>
          {t('Join link', { description: 'Workspace join link' })}
        </SubHeading>
        {link ? (
          <>
            <Box
              $direction="row"
              $align="center"
              $gap="xs"
              $padding={{ horizontal: 'xs', vertical: '3xs' }}
              $css={css`
                border-radius: var(--c--globals--spacings--3xs);
                background: var(
                  --c--contextuals--background--semantic--contextual--primary
                );
              `}
            >
              <Icon iconName="link" $size="18px" $variation="secondary" />
              <Text $size="sm" $ellipsis $css="flex: 1; min-width: 0;">
                {link}
              </Text>
              <BoxButton
                aria-label={t('Copy the join link', {
                  description: 'Button copying the join link',
                })}
                title={t('Copy the join link', {
                  description: 'Button copying the join link',
                })}
                $padding="3xs"
                onClick={() =>
                  copyToClipboard(
                    link,
                    t('Link Copied !', {
                      description:
                        'Toast confirming a link was copied to the clipboard',
                    }),
                    t('Failed to copy link', {
                      description: 'Toast shown when copying a link failed',
                    }),
                  )
                }
              >
                <Icon
                  iconName="content_copy"
                  $size="18px"
                  $variation="secondary"
                />
              </BoxButton>
            </Box>
            <Text $size="xs" $variation="secondary">
              {t('Anyone with this link can join as a member once signed in.', {
                description: 'Explanation of the join link',
              })}
            </Text>
            <Box $direction="row" $gap="xs">
              <Button
                size="small"
                variant="secondary"
                onClick={() => renew.mutate(undefined, { onError })}
              >
                {t('New link', {
                  description: 'Button replacing the join link',
                })}
              </Button>
              <Button
                size="small"
                variant="secondary"
                color="error"
                onClick={() => remove.mutate(undefined, { onError })}
              >
                {t('Turn off', { description: 'Button turning a link off' })}
              </Button>
            </Box>
          </>
        ) : (
          <Box $direction="row">
            <Button
              size="small"
              variant="secondary"
              icon={<Icon iconName="add_link" $size="18px" $color="inherit" />}
              onClick={() => renew.mutate(undefined, { onError })}
            >
              {t('Create a join link', {
                description: 'Button creating a workspace join link',
              })}
            </Button>
          </Box>
        )}
      </Box>

      <Box $gap="xs">
        <SubHeading>
          {t('Joining by email domain', {
            description: 'Workspace joining by domain',
          })}
        </SubHeading>
        <Text $size="xs" $variation="secondary">
          {t(
            'Use the domain of your own verified email. Addresses anyone can get (Gmail, Outlook…) can’t be used.',
            { description: 'Rules of joining by domain' },
          )}
        </Text>
        {workspace.join_domains.length > 0 && (
          <Box $direction="row" $gap="2xs" $css="flex-wrap: wrap;">
            {workspace.join_domains.map((item) => (
              <Box
                key={item}
                $direction="row"
                $align="center"
                $gap="3xs"
                $padding={{ left: 'xs', right: '3xs', vertical: '4xs' }}
                $css={css`
                  border-radius: 999px;
                  border: 1px solid
                    var(--c--contextuals--border--surface--primary);
                `}
              >
                <Text $size="sm">@{item}</Text>
                <BoxButton
                  aria-label={t('Remove {{domain}}', {
                    description: 'Button removing a join domain',
                    domain: item,
                  })}
                  $padding="4xs"
                  onClick={() =>
                    setDomains(
                      workspace.join_domains.filter((other) => other !== item),
                    )
                  }
                >
                  <Icon iconName="close" $size="16px" $variation="secondary" />
                </BoxButton>
              </Box>
            ))}
          </Box>
        )}
        <Box $direction="row" $gap="sm" $align="flex-end">
          <Box $flex={1}>
            <Input
              fullWidth
              label={t('Domain, e.g. acme.org', {
                description: 'Label of the join domain field',
              })}
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && domain.trim()) {
                  setDomains([...workspace.join_domains, domain.trim()]);
                }
              }}
            />
          </Box>
          <Button
            disabled={!domain.trim() || isPending}
            onClick={() =>
              setDomains([...workspace.join_domains, domain.trim()])
            }
          >
            {t('Add', { description: 'Button adding a join domain' })}
          </Button>
        </Box>
        <Select
          fullWidth
          label={t('Also add them to the group', {
            description: 'Label of the organisation group of joiners',
          })}
          clearable={false}
          options={[
            {
              label: t('No group', { description: 'No organisation group' }),
              value: '',
            },
            ...groups.map((group) => ({ label: group.name, value: group.id })),
          ]}
          value={workspace.join_group ?? ''}
          onChange={(event) =>
            updateWorkspace(
              {
                id: workspace.id,
                join_group: (event.target.value as string) || null,
              },
              { onError },
            )
          }
        />
      </Box>
    </Section>
  );
};
