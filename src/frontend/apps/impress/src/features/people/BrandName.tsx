import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@/components';
import { Title } from '@/components/Title';

/** The platform's name as its logo spells it, where only text fits. */
export const BRAND_NAME = 'CO✍️✍️ABORATORS';

/**
 * "My CO✍️✍️ABORATORS": the list of the people one may see, named in the
 * style of the logo.
 */
export const MyCollaboratorsName = ({ size = '1em' }: { size?: string }) => {
  const { t } = useTranslation();
  return (
    <Text
      as="span"
      // words in reading order, even in a panel mirrored on the right
      dir="ltr"
      $display="inline-flex"
      $direction="row"
      $align="baseline"
      $gap="0.3em"
      $css="white-space: nowrap;"
    >
      {t('My', {
        description: 'First word of "My Collaborators", before the logo',
      })}
      <Title as="span" $size={size} $css="vertical-align: bottom;" />
    </Text>
  );
};

/**
 * A sentence naming the platform, the name styled as the logo (colour,
 * italic, bold), on one row: its key holds "<brand/>".
 */
export const WithBrand = ({
  i18nKey,
  description,
}: {
  i18nKey: string;
  description: string;
}) => (
  <Text
    as="span"
    dir="ltr"
    // inline: the words keep their spaces around the name
    $display="inline"
    $css="white-space: nowrap;"
  >
    <Trans
      i18nKey={i18nKey}
      tOptions={{ description }}
      components={{ brand: <Title as="span" $size="1em" $display="inline" /> }}
    />
  </Text>
);
