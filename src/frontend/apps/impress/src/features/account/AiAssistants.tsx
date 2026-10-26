import {
  Button,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/ui-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, Text } from '@/components';
import { useDate } from '@/hooks/useDate';

import {
  AssistantApproval,
  useAssistants,
  useDisconnectAssistant,
} from './assistantsApi';

const rowCss = css`
  border-top: 1px solid var(--c--contextuals--border--surface--primary);
  padding-top: var(--c--globals--spacings--xs);
`;

const addressCss = css`
  padding: var(--c--globals--spacings--3xs) var(--c--globals--spacings--xs);
  border-radius: var(--c--globals--spacings--3xs);
  border: 1px solid var(--c--contextuals--border--surface--primary);
  font-family: monospace;
  word-break: break-all;
`;

/** Where to paste the address, assistant by assistant. */
const useWhere = () => {
  const { t } = useTranslation();
  return {
    claude: t(
      'In Claude: Settings → Connectors → Add custom connector, then paste the address.',
      { description: 'How to connect Claude' },
    ),
    chatgpt: t(
      'In ChatGPT: Settings → Connectors (developer mode) → Create, then paste the address.',
      { description: 'How to connect ChatGPT' },
    ),
    gemini: t('In Gemini CLI: add the address as an MCP server (httpUrl).', {
      description: 'How to connect Gemini',
    }),
  } as Record<string, string>;
};

/** "Connected · last used …", "Not in use", or "Not connected". */
const useStatus = () => {
  const { t, i18n } = useTranslation();
  const { relativeDate } = useDate();
  return (approvals: AssistantApproval[]) => {
    const live = approvals.find((approval) => approval.connected);
    if (live) {
      return {
        connected: true,
        text: live.last_used_at
          ? t('Connected · last used {{when}}', {
              description: 'An assistant connected and used',
              when: relativeDate(live.last_used_at),
            })
          : t('Connected', { description: 'An assistant connected' }),
      };
    }
    if (approvals.length) {
      const approved = approvals[0].approved_at;
      return {
        connected: false,
        text: approved
          ? t('Not in use (approved on {{date}})', {
              description:
                'An assistant approved whose session is gone: removed or idle',
              date: new Date(approved).toLocaleDateString(i18n.language, {
                dateStyle: 'medium',
              }),
            })
          : t('Not in use', { description: 'An assistant approved, idle' }),
      };
    }
    return {
      connected: false,
      text: t('Not connected', { description: 'An assistant not connected' }),
    };
  };
};

const Row = ({
  name,
  approvals,
  where,
  address,
}: {
  name: string;
  approvals: AssistantApproval[];
  where?: string;
  address: string;
}) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const statusOf = useStatus();
  const disconnect = useDisconnectAssistant();
  const [opened, setOpened] = useState(false);
  const status = statusOf(approvals);

  return (
    <Box $gap="2xs" $css={rowCss} data-testid={`ai-${name}`}>
      <Box $direction="row" $align="center" $justify="space-between" $gap="sm">
        <Box $direction="row" $align="center" $gap="xs">
          <Icon iconName="smart_toy" $size="20px" $variation="secondary" />
          <Box>
            <Text $weight="600">{name}</Text>
            <Text
              $size="xs"
              $theme={status.connected ? 'success' : undefined}
              $variation={status.connected ? undefined : 'secondary'}
            >
              {status.text}
            </Text>
          </Box>
        </Box>
        {approvals.length ? (
          <Button
            size="small"
            variant="secondary"
            color="error"
            disabled={disconnect.isPending}
            onClick={() =>
              disconnect.mutate(
                approvals.map((approval) => approval.client_id),
                {
                  onSuccess: () =>
                    toast(
                      t('{{name}} is disconnected.', {
                        description: 'Toast after disconnecting an assistant',
                        name,
                      }),
                      VariantType.SUCCESS,
                    ),
                },
              )
            }
          >
            {t('Disconnect', {
              description: 'Button disconnecting an assistant',
            })}
          </Button>
        ) : (
          where && (
            <Button
              size="small"
              variant="secondary"
              aria-expanded={opened}
              onClick={() => setOpened((value) => !value)}
            >
              {t('Connect', { description: 'Button: how to connect' })}
            </Button>
          )
        )}
      </Box>
      {opened && where && (
        <Box $gap="2xs" $padding={{ left: 'xl' }}>
          <Box $direction="row" $align="center" $gap="xs" $wrap="wrap">
            <Text $size="sm" $css={addressCss}>
              {address}
            </Text>
            <Button
              size="small"
              variant="tertiary"
              icon={
                <Icon iconName="content_copy" $size="18px" $color="inherit" />
              }
              onClick={() => {
                void navigator.clipboard?.writeText(address);
                toast(
                  t('Address copied.', { description: 'Toast after copying' }),
                  VariantType.SUCCESS,
                );
              }}
            >
              {t('Copy', { description: 'Button copying the address' })}
            </Button>
          </Box>
          <Text $size="sm">{where}</Text>
          <Text $size="xs" $variation="secondary">
            {t('Then sign in to Collaborators when it asks, and approve it.', {
              description: 'Last step of connecting an assistant',
            })}
          </Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * "AI assistants" on the sign-in methods page: Claude, ChatGPT and Gemini,
 * each connected (approved, with a live session), not in use (approved,
 * its session gone), or not connected, with how to connect it; any other
 * assistant approved; and who pays for them.
 */
export const AiAssistants = () => {
  const { t } = useTranslation();
  const { data, error } = useAssistants();
  const where = useWhere();

  return (
    <Box as="section" $gap="xs" data-testid="ai-assistants">
      <Text as="h2" $size="h5" $weight="700" $margin={{ top: 'md' }}>
        {t('AI assistants', {
          description: 'Heading of the AI assistants on the sign-in page',
        })}
      </Text>
      <Text $size="sm" $variation="secondary">
        {t(
          'Your own assistant can add your input at the end of a page you can edit, in a toggle heading with your name and email. It changes nothing else.',
          { description: 'What a connected assistant does' },
        )}
      </Text>
      {error && (
        <Text $size="sm" $variation="secondary">
          {error.cause?.[0]}
        </Text>
      )}
      {data?.tools.map((tool) => (
        <Row
          key={tool.id}
          name={tool.name}
          approvals={tool.approvals}
          where={where[tool.id]}
          address={data.mcp_url}
        />
      ))}
      {data?.others.map((other) => (
        <Row
          key={other.client_id}
          name={other.name}
          approvals={[other]}
          address={data.mcp_url}
        />
      ))}
      <Text $size="xs" $variation="secondary">
        {t(
          'Your assistant and any charges for it are between you and its provider; Collaborators neither charges nor pays for it.',
          { description: 'Who pays for an AI assistant' },
        )}
      </Text>
    </Box>
  );
};
