import {
  Button,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/ui-components';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, Loading, Text } from '@/components';

import { useAssistants, useDisconnectAssistant } from './assistantsApi';

const addressCss = css`
  padding: var(--c--globals--spacings--xs) var(--c--globals--spacings--sm);
  border-radius: var(--c--globals--spacings--3xs);
  border: 1px solid var(--c--contextuals--border--surface--primary);
  font-family: monospace;
  word-break: break-all;
`;

const rowCss = css`
  border-top: 1px solid var(--c--contextuals--border--surface--primary);
  padding-top: var(--c--globals--spacings--xs);
`;

/**
 * "Connected assistants": connecting one's own AI assistant (Claude,
 * ChatGPT, Gemini) to the MCP server, which adds one's input to pages one
 * can edit; the assistants connected, each disconnected here.
 */
export const ConnectedAssistants = () => {
  const { t, i18n } = useTranslation();
  const { toast } = useToastProvider();
  const { data, isLoading, error } = useAssistants();
  const disconnect = useDisconnectAssistant();

  if (isLoading) {
    return <Loading />;
  }

  const steps: [string, string][] = [
    [
      'Claude',
      t(
        'Settings → Connectors → Add custom connector, then paste the address.',
        {
          description: 'How to connect Claude',
        },
      ),
    ],
    [
      'ChatGPT',
      t(
        'Settings → Connectors (developer mode) → Create, then paste the address.',
        {
          description: 'How to connect ChatGPT',
        },
      ),
    ],
    [
      'Gemini',
      t('In Gemini CLI, add the address as an MCP server (httpUrl).', {
        description: 'How to connect Gemini',
      }),
    ],
  ];

  return (
    <Box $gap="md" data-testid="connected-assistants">
      <Box $gap="xs">
        <Text as="h2" $size="h5" $weight="700" $margin="none">
          {t('Connect an assistant', {
            description: 'Heading of how to connect an AI assistant',
          })}
        </Text>
        <Text $size="sm" $variation="secondary">
          {t(
            'Your assistant adds your input at the end of a page you can edit, in a toggle heading with your name and email. It changes nothing else.',
            { description: 'What a connected assistant does' },
          )}
        </Text>
        {data && (
          <Box $direction="row" $align="center" $gap="xs" $wrap="wrap">
            <Text $css={addressCss} data-testid="mcp-url">
              {data.mcp_url}
            </Text>
            <Button
              size="small"
              variant="secondary"
              icon={
                <Icon iconName="content_copy" $size="18px" $color="inherit" />
              }
              onClick={() => {
                void navigator.clipboard?.writeText(data.mcp_url);
                toast(
                  t('Address copied.', { description: 'Toast after copying' }),
                  VariantType.SUCCESS,
                );
              }}
            >
              {t('Copy', { description: 'Button copying the address' })}
            </Button>
          </Box>
        )}
        <Box as="ul" $margin="none" $padding={{ left: 'md' }} $gap="3xs">
          {steps.map(([name, how]) => (
            <Text as="li" key={name} $size="sm">
              <b>{name}</b> — {how}
            </Text>
          ))}
        </Box>
        <Text $size="sm" $variation="secondary">
          {t(
            'Then sign in to Collaborators when your assistant asks, and approve it.',
            { description: 'Last step of connecting an assistant' },
          )}
        </Text>
        <Text $size="sm" $variation="secondary">
          {t(
            'Your assistant and any charges for it are between you and its provider; Collaborators neither charges nor pays for it.',
            { description: 'Who pays for an AI assistant' },
          )}
        </Text>
      </Box>
      <Box $gap="xs">
        <Text as="h2" $size="h5" $weight="700" $margin="none">
          {t('Connected', {
            description: 'Heading of the assistants connected',
          })}
        </Text>
        {error && (
          <Text $size="sm" $variation="secondary">
            {error.cause?.[0]}
          </Text>
        )}
        {data?.assistants.length === 0 && (
          <Text $size="sm" $variation="secondary">
            {t('No assistant connected yet.', {
              description: 'No AI assistant connected',
            })}
          </Text>
        )}
        {data?.assistants.map((assistant) => (
          <Box
            key={assistant.client_id}
            $direction="row"
            $align="center"
            $justify="space-between"
            $gap="sm"
            $css={rowCss}
            data-testid={`assistant-${assistant.client_id}`}
          >
            <Box>
              <Text $weight="600">{assistant.name}</Text>
              {assistant.approved_at && (
                <Text $size="xs" $variation="secondary">
                  {t('Approved on {{date}}', {
                    description: 'When an assistant was approved',
                    date: new Date(assistant.approved_at).toLocaleDateString(
                      i18n.language,
                      { dateStyle: 'medium' },
                    ),
                  })}
                </Text>
              )}
            </Box>
            <Button
              size="small"
              variant="secondary"
              color="error"
              disabled={disconnect.isPending}
              onClick={() => disconnect.mutate(assistant.client_id)}
            >
              {t('Disconnect', {
                description: 'Button disconnecting an assistant',
              })}
            </Button>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
