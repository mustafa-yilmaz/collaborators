import { Button, Modal, ModalSize } from '@gouvfr-lasuite/ui-components';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** Ask before a destructive action. */
export const ConfirmModal = ({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: ConfirmModalProps) => {
  const { t } = useTranslation();

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
        <>
          <Button variant="secondary" fullWidth autoFocus onClick={onClose}>
            {t('Cancel', {
              description: 'Button to dismiss a dialog without confirming',
            })}
          </Button>
          <Button
            color="error"
            fullWidth
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Text $variation="secondary" as="p" $margin="none">
        {message}
      </Text>
    </Modal>
  );
};
