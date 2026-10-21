import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, StyledLink } from '@/components';
import { Empty, Row, TEXT_INDENT } from '@/features/dashboard/CardParts';

import { labelHref } from './LabelEditor';
import { useLabelCloud } from './api';

/**
 * The labels of what one is involved in, on the Search screen: a cloud (the
 * more used, the bigger), then the list by use.
 */
export const LabelsOverview = () => {
  const { t } = useTranslation();
  const { data = [], isLoading } = useLabelCloud();
  if (!isLoading && !data.length) {
    return (
      <Empty>
        {t('Labels you are involved with appear here.', {
          description: 'Empty labels card',
        })}
      </Empty>
    );
  }
  const max = Math.max(1, ...data.map((item) => item.count));
  const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));
  const byUse = [...data].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
  return (
    <>
      <Box
        $direction="row"
        $align="baseline"
        $gap="xs"
        $css={css`
          flex-wrap: wrap;
          row-gap: 4px;
          padding: var(--c--globals--spacings--xs);
          padding-left: ${TEXT_INDENT};
        `}
        data-testid="label-cloud"
      >
        {sorted.map((item) => {
          const weight = item.count / max;
          return (
            <StyledLink
              key={item.name}
              href={labelHref(item.name)}
              title={t('{{count}} uses', {
                description: 'How many items carry a label',
                count: item.count,
              })}
              $css={css`
                font-size: ${0.8 + weight * 0.9}rem;
                font-weight: ${weight > 0.6 ? 700 : weight > 0.3 ? 600 : 400};
                color: var(--c--contextuals--content--semantic--brand--primary);
                opacity: ${0.6 + weight * 0.4};
                text-decoration: none;
                &:hover {
                  text-decoration: underline;
                }
              `}
            >
              #{item.name}
            </StyledLink>
          );
        })}
      </Box>
      <Box $gap="4xs" data-testid="label-list">
        {byUse.map((item) => (
          <Row
            key={item.name}
            href={labelHref(item.name)}
            icon="sell"
            title={`#${item.name}`}
            detail={t('{{count}} uses', {
              description: 'How many items carry a label',
              count: item.count,
            })}
          />
        ))}
      </Box>
    </>
  );
};
