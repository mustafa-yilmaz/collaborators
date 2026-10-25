import {
  Button,
  Modal,
  ModalSize,
  TextArea,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/ui-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Loading, StyledLink, Text } from '@/components';

import { ContentReport, useDecideReport, useReports } from './api';
import { useReportReasons } from './words';

const cardCss = css`
  border-top: 1px solid var(--c--contextuals--border--surface--primary);
  padding-top: var(--c--globals--spacings--xs);
`;

const excerptCss = css`
  white-space: pre-wrap;
  max-height: 240px;
  overflow-y: auto;
  padding: var(--c--globals--spacings--xs);
  border-radius: var(--c--globals--spacings--3xs);
  background: var(--c--contextuals--background--surface--tertiary);
`;

/** Take a page down: the note is told to its owners. */
const TakeDownDialog = ({
  report,
  onClose,
}: {
  report: ContentReport;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const decide = useDecideReport();
  const [note, setNote] = useState('');

  return (
    <Modal
      isOpen
      closeOnClickOutside
      onClose={onClose}
      size={ModalSize.MEDIUM}
      title={
        <Text as="h1" $margin="0" $size="h6" $align="flex-start">
          {t('Take “{{title}}” down?', {
            description: 'Title of the dialog taking a reported page down',
            title: report.document?.title || report.document_title,
          })}
        </Text>
      }
      rightActions={
        <>
          <Button variant="secondary" fullWidth autoFocus onClick={onClose}>
            {t('Cancel', {
              description: 'Button to dismiss a dialog without confirming',
            })}
          </Button>
          <Button
            color="error"
            fullWidth
            disabled={decide.isPending}
            onClick={() =>
              decide.mutate(
                { id: report.id, decision: 'take-down', note },
                {
                  onSuccess: () => {
                    toast(
                      t('The page is taken down.', {
                        description: 'Toast after taking a page down',
                      }),
                      VariantType.SUCCESS,
                    );
                    onClose();
                  },
                },
              )
            }
          >
            {t('Take it down', {
              description: 'Button taking a reported page down',
            })}
          </Button>
        </>
      }
    >
      <Box $gap="sm">
        <Text $variation="secondary">
          {t(
            'The page goes to the trash with the pages below it, and its owners can’t restore it; you can put it back while it is there. Its owners and the people who reported it are told by email.',
            { description: 'Explanation in the dialog taking a page down' },
          )}
        </Text>
        <TextArea
          label={t('Reason (optional, told to its owners)', {
            description: 'Label of the reason for taking a page down',
          })}
          value={note}
          maxLength={500}
          rows={3}
          onChange={(event) => setNote(event.target.value)}
        />
      </Box>
    </Modal>
  );
};

const ReportCard = ({ report }: { report: ContentReport }) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToastProvider();
  const reasons = useReportReasons();
  const decide = useDecideReport();
  const [takingDown, setTakingDown] = useState(false);
  const date = (value: string) =>
    new Date(value).toLocaleString(i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  const document = report.document;
  const title =
    document?.title ||
    report.document_title ||
    t('Untitled page', { description: 'A page without title' });
  const onError = (error: { cause?: string[] }) =>
    toast(error.cause?.[0] ?? '', VariantType.ERROR);

  return (
    <Box $gap="2xs" $css={cardCss} data-testid={`report-${report.id}`}>
      <Box $direction="row" $align="baseline" $gap="xs" $wrap="wrap">
        {document && !document.deleted ? (
          <StyledLink href={`/page/${document.id}/`} $css="color: inherit;">
            <Text $weight="600">{title}</Text>
          </StyledLink>
        ) : (
          <Text $weight="600">{title}</Text>
        )}
        <Text $size="sm" $weight="600">
          {reasons[report.reason]}
        </Text>
      </Box>
      <Text $size="xs" $variation="secondary">
        {[
          t('Reported by {{name}} on {{date}}', {
            description: 'Who reported a page, and when',
            name: report.reporter || '?',
            date: date(report.created_at),
          }),
          document?.owners.length
            ? t('owned by {{names}}', {
                description: 'The owners of a reported page',
                names: document.owners.join(', '),
              })
            : '',
          !document
            ? t('the page no longer exists', {
                description: 'A reported page deleted for good',
              })
            : '',
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {report.details && <Text $size="sm">“{report.details}”</Text>}
      {report.excerpt && (
        <details>
          <summary>
            <Text as="span" $size="sm">
              {t('The page’s text when it was reported', {
                description: 'Summary of the text kept with a report',
              })}
            </Text>
          </summary>
          <Text as="div" $size="sm" $css={excerptCss}>
            {report.excerpt}
          </Text>
        </details>
      )}
      {report.status === 'open' ? (
        <Box $direction="row" $gap="xs">
          <Button
            size="small"
            variant="secondary"
            disabled={decide.isPending}
            onClick={() =>
              decide.mutate({ id: report.id, decision: 'dismiss' }, { onError })
            }
          >
            {t('Dismiss', {
              description: 'Button: nothing to take down in a report',
            })}
          </Button>
          {document && (
            <Button
              size="small"
              variant="secondary"
              color="error"
              onClick={() => setTakingDown(true)}
            >
              {t('Take the page down', {
                description: 'Button taking a reported page down',
              })}
            </Button>
          )}
        </Box>
      ) : (
        <Box $direction="row" $align="center" $gap="xs" $wrap="wrap">
          <Text $size="xs" $variation="secondary">
            {[
              report.status === 'dismissed'
                ? t('Dismissed by {{name}}', {
                    description: 'Who dismissed a report',
                    name: report.resolved_by,
                  })
                : t('Taken down by {{name}}', {
                    description: 'Who took a reported page down',
                    name: report.resolved_by,
                  }),
              report.resolved_at && date(report.resolved_at),
              report.resolution_note,
              report.status === 'taken_down' && document && !document.taken_down
                ? t('put back since', {
                    description: 'A page taken down, then put back',
                  })
                : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {document?.taken_down && (
            <Button
              size="small"
              variant="secondary"
              disabled={decide.isPending}
              onClick={() =>
                decide.mutate(
                  { id: report.id, decision: 'put-back' },
                  { onError },
                )
              }
            >
              {t('Put the page back', {
                description: 'Button undoing taking a page down',
              })}
            </Button>
          )}
        </Box>
      )}
      {takingDown && (
        <TakeDownDialog report={report} onClose={() => setTakingDown(false)} />
      )}
    </Box>
  );
};

/** "Reports", for platform administrators and owners. */
export const Reports = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'open' | 'decided'>('open');
  const { data, isLoading } = useReports(status);

  return (
    <Box $gap="sm" data-testid="reports">
      <Box $direction="row" $gap="xs">
        <Button
          size="small"
          variant={status === 'open' ? 'primary' : 'tertiary'}
          onClick={() => setStatus('open')}
        >
          {t('To decide', { description: 'Tab of the open reports' })}
        </Button>
        <Button
          size="small"
          variant={status === 'decided' ? 'primary' : 'tertiary'}
          onClick={() => setStatus('decided')}
        >
          {t('Decided', { description: 'Tab of the decided reports' })}
        </Button>
      </Box>
      {isLoading && <Loading />}
      {data?.length === 0 && (
        <Text $size="sm" $variation="secondary">
          {status === 'open'
            ? t('No report to decide on.', {
                description: 'No open report',
              })
            : t('No report was decided yet.', {
                description: 'No decided report',
              })}
        </Text>
      )}
      {data?.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}
    </Box>
  );
};
