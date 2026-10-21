import { useTranslation } from 'react-i18next';

import { Text } from '@/components';
import { Title } from '@/components/Title';

/**
 * "My CO✍️✍️ABORATORS": the list of the people one may see, named in the
 * style of the logo.
 */
export const MyCollaboratorsName = ({ size = '1em' }: { size?: string }) => {
  const { t } = useTranslation();
  return (
    <Text as="span" $display="inline-flex" $align="baseline" $gap="0.3em">
      {t('My', {
        description: 'First word of "My Collaborators", before the logo',
      })}
      <Title as="span" $size={size} $css="vertical-align: bottom;" />
    </Text>
  );
};
