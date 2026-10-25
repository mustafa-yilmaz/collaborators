import {
  Button,
  Modal,
  ModalSize,
  Radio,
  RadioGroup,
  TextArea,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/ui-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components';

import { ReportReason, useReportPage } from './api';
import { useReportReasons } from './words';

const errorCss = css`
  color: var(--c--contextuals--content--semantic--error--primary);
`;

/** Report a page to the platform administrators: why, and what is wrong. */
export const ReportPageModal = ({
  docId,
  onClose,
}: {
  docId: string;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const reasons = useReportReasons();
  const report = useReportPage();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');

  return (
    <Modal
      isOpen
      closeOnClickOutside
      onClose={onClose}
      size={ModalSize.MEDIUM}
      title={
        <Text as="h1" $margin="0" $size="h6" $align="flex-start">
          {t('Report this page', {
            description: 'Title of the dialog reporting a page',
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
            disabled={!reason || report.isPending}
            onClick={() =>
              reason &&
              report.mutate(
                { docId, reason, details },
                {
                  onSuccess: () => {
                    toast(
                      t(
                        'Thank you: the platform administrators will review it.',
                        { description: 'Toast after reporting a page' },
                      ),
                      VariantType.SUCCESS,
                    );
                    onClose();
                  },
                },
              )
            }
          >
            {t('Report', { description: 'Button sending a report' })}
          </Button>
        </>
      }
    >
      <Box $gap="sm" data-testid="report-page">
        <Text $variation="secondary">
          {t(
            'The platform administrators see the page as it is now, and decide whether to take it down. Its owners don’t learn who reported it.',
            { description: 'Explanation in the dialog reporting a page' },
          )}
        </Text>
        <RadioGroup>
          {(Object.entries(reasons) as [ReportReason, string][]).map(
            ([value, label]) => (
              <Radio
                key={value}
                name={`report-${docId}`}
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
                label={label}
              />
            ),
          )}
        </RadioGroup>
        <TextArea
          label={t('What is wrong (optional)', {
            description: 'Label of the details of a report',
          })}
          value={details}
          maxLength={2000}
          rows={3}
          onChange={(event) => setDetails(event.target.value)}
        />
        {report.error && (
          <Text $size="sm" $css={errorCss}>
            {report.error.cause?.[0]}
          </Text>
        )}
      </Box>
    </Modal>
  );
};
