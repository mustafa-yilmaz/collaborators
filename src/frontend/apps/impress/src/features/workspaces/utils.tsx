import { useTranslation } from 'react-i18next';

import { Icon } from '@/components';
import { LinkReach } from '@/features/docs/doc-management';

/** A small globe on spaces anyone can read. */
export const LinkReachIcon = ({ reach }: { reach: LinkReach }) => {
  const { t } = useTranslation();

  if (reach !== LinkReach.PUBLIC) {
    return null;
  }

  return (
    <Icon
      iconName="public"
      $size="16px"
      $variation="tertiary"
      aria-label={t('Public', { description: 'Space visibility option' })}
    />
  );
};
