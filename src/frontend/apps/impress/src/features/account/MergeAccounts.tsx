import {
  Button,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/ui-components';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components';
import { useConfig } from '@/core';
import { ProviderLogo } from '@/features/signin/ProviderLogo';
import { PROVIDER_NAMES } from '@/features/signin/SignIn';

import {
  MergeNotice,
  useDecideMerge,
  useMergeProposal,
  useStartMerge,
} from './api';

const MERGE_PROVIDERS = ['google', 'microsoft', 'linkedin'];

const proposalCss = css`
  padding: var(--c--globals--spacings--sm);
  border-radius: var(--c--globals--spacings--3xs);
  border: 1px solid var(--c--contextuals--border--semantic--brand--primary);
`;

/** Why the account signed in with wasn't proposed, said once. */
const Notice = ({ notice }: { notice: MergeNotice }) => {
  const { t } = useTranslation();
  const values = {
    account: notice.account,
    provider: PROVIDER_NAMES[notice.provider] ?? notice.provider,
  };
  return (
    <Text role="status" $size="sm">
      {notice.outcome === 'same'
        ? t('{{account}} already opens this account: nothing to merge.', {
            description: 'Merging: the account signed in with is this one',
            ...values,
          })
        : notice.outcome === 'no_account'
          ? t(
              '{{account}} opens no other Collaborators account: nothing to merge. To sign in with it here, connect it above.',
              {
                description: 'Merging: the account signed in with has none',
                ...values,
              },
            )
          : notice.reason}
    </Text>
  );
};

/**
 * "Merge another account of yours": someone with a second Collaborators
 * account (under another email) signs in with it, which proves it is
 * theirs, then confirms: everything of it moves here and it goes.
 */
export const MergeAccounts = () => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { data: config } = useConfig();
  const { data } = useMergeProposal();
  const start = useStartMerge();
  const decide = useDecideMerge();
  const providers = (config?.COLLABORATORS_SIGNIN_PROVIDERS ?? []).filter(
    (provider) => MERGE_PROVIDERS.includes(provider),
  );
  const proposal = data?.proposal;

  if (!providers.length) {
    return null;
  }

  return (
    <Box as="section" $gap="xs" data-testid="merge-accounts">
      <Text as="h2" $size="h5" $weight="700" $margin={{ top: 'md' }}>
        {t('Merge another account of yours', {
          description: 'Heading of the section merging accounts',
        })}
      </Text>
      <Text $size="sm" $variation="secondary">
        {t(
          'If you also have a separate Collaborators account under another email, bring it into this one: its pages, workspaces, groups and notifications move here, and it goes. Sign in with it to show it is yours.',
          { description: 'Explanation of merging accounts' },
        )}
      </Text>
      {data?.notice && <Notice notice={data.notice} />}
      {proposal ? (
        <Box $gap="xs" $css={proposalCss} data-testid="merge-proposal">
          <Text $weight="600">
            {t('Merge {{name}} ({{email}}) into this account?', {
              description: 'Question confirming a merge',
              name: proposal.full_name || proposal.email,
              email: proposal.email,
            })}
          </Text>
          <Text $size="sm">
            {t(
              'Pages it owns: {{pages}} · shared with it: {{shared}} · workspaces: {{workspaces}} · groups: {{groups}}.',
              {
                description: 'What the account merged brings',
                pages: proposal.pages,
                shared: proposal.shared_with_it,
                workspaces: proposal.workspaces,
                groups: proposal.groups,
              },
            )}
          </Text>
          <Text $size="sm" $variation="secondary">
            {t(
              'They all move here, and it goes; signing in with it will open this account. This can’t be undone.',
              { description: 'What merging does' },
            )}
          </Text>
          <Box $direction="row" $gap="xs">
            <Button
              size="small"
              color="error"
              disabled={decide.isPending}
              onClick={() =>
                decide.mutate('merge', {
                  onSuccess: ({ merged }) =>
                    toast(
                      t('{{name}} is merged into this account.', {
                        description: 'Toast after merging accounts',
                        name: merged,
                      }),
                      VariantType.SUCCESS,
                    ),
                })
              }
            >
              {t('Merge into this account', {
                description: 'Button confirming a merge',
              })}
            </Button>
            <Button
              size="small"
              variant="secondary"
              disabled={decide.isPending}
              onClick={() => decide.mutate('cancel')}
            >
              {t('Cancel', {
                description: 'Button to dismiss a dialog without confirming',
              })}
            </Button>
          </Box>
        </Box>
      ) : (
        <Box $direction="row" $gap="xs" $wrap="wrap">
          {providers.map((provider) => (
            <Button
              key={provider}
              size="small"
              variant="secondary"
              disabled={start.isPending}
              icon={<ProviderLogo provider={provider} size={18} />}
              onClick={() => start.mutate(provider)}
            >
              {t('Sign in with the other account ({{provider}})', {
                description: 'Button starting a merge with a provider',
                provider: PROVIDER_NAMES[provider] ?? provider,
              })}
            </Button>
          ))}
        </Box>
      )}
      {(start.error ?? decide.error) && (
        <Text $size="sm" $theme="error" role="alert">
          {(start.error ?? decide.error)?.cause?.[0]}
        </Text>
      )}
    </Box>
  );
};
