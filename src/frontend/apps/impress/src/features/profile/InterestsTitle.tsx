import { Trans } from 'react-i18next';

import { Text } from '@/components';
import { Title } from '@/components/Title';

/** "Interests (labels on CO✍️✍️ABORATORS)", on one row. */
export const InterestsTitle = () => (
  <Text
    as="span"
    dir="ltr"
    // inline: the words keep their spaces around the name
    $display="inline"
    $size="sm"
    $weight="700"
    $css="white-space: nowrap;"
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
