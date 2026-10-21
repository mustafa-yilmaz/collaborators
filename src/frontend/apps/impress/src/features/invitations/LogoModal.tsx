import { Button, Modal, ModalSize } from '@gouvfr-lasuite/ui-components';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';
import { Doc } from '@/features/docs/doc-management';

import { LogoPicker } from './LogoPicker';

/** The logo of a space or a page, from its menu. */
export const LogoModal = ({
  doc,
  onClose,
}: {
  doc: Doc;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const isSpace = doc.kind === 'space';
  const title = isSpace
    ? t('Logo of the space', { description: 'Title of the logo dialog' })
    : t('Logo of the page', { description: 'Title of the logo dialog' });

  return (
    <Modal
      isOpen
      closeOnClickOutside
      onClose={onClose}
      size={ModalSize.SMALL}
      aria-label={title}
      title={
        <Text as="h1" $margin="0" $size="h6" $align="flex-start">
          {title}
        </Text>
      }
      rightActions={
        <Button fullWidth onClick={onClose}>
          {t('Done', { description: 'Button closing a dialog' })}
        </Button>
      }
    >
      <Box $padding={{ top: 'xs' }}>
        <LogoPicker
          owner="documents"
          id={doc.id}
          canEdit={doc.abilities.partial_update}
          fallbackIcon={isSpace ? 'folder' : 'description'}
        />
      </Box>
    </Modal>
  );
};
