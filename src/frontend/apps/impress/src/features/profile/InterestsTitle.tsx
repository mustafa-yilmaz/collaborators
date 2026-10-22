import { Trans } from 'react-i18next';

import { Text } from '@/components';
import { Title } from '@/components/Title';

/** "Interests (labels on CO✍️✍️ABORATORS)", on one row. */
export const InterestsTitle = () => (
  <Text
    as="span"
    $display="inline-flex"
    $direction="row"
    $align="baseline"
    $size="sm"
    $weight="700"
    $css="white-space: nowrap; gap: 0.25em;"
  >
    <Trans
      i18nKey="Interests (labels on <brand/>)"
      tOptions={{ description: 'Heading of profile interests' }}
      components={{
        brand: <Title as="span" $size="1em" $display="inline" />,
      }}
    />
  </Text>
);
