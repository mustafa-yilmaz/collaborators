import {
  Button,
  Modal,
  ModalSize,
  Select,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/ui-components';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';
import { Doc } from '@/features/docs/doc-management';

import { usePageMoves, usePageSpaceLinks, useSpaces } from '../api';

interface PageToSpaceModalProps {
  page: Doc;
  /** Move the page into the space, or show it there too (a link) */
  mode: 'move' | 'link';
  onClose: () => void;
}

/**
 * Pick a space for a page: to move it there (it then belongs to that space),
 * or to show it there too, "Linked from" its home.
 */
export const PageToSpaceModal = ({
  page,
  mode,
  onClose,
}: PageToSpaceModalProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToastProvider();
  const { data: spaces = [] } = useSpaces({ mine: true });
  const { data: links } = usePageSpaceLinks(page.id);
  const { moveIntoSpace, link } = usePageMoves(page.id);
  const [spaceId, setSpaceId] = useState('');
  const isMove = mode === 'move';
  const mutation = isMove ? moveIntoSpace : link;

  const excluded = new Set([
    links?.home?.id,
    ...(isMove ? [] : (links?.links ?? []).map((item) => item.space.id)),
  ]);
  const choices = spaces.filter(
    (space) =>
      !excluded.has(space.id) &&
      (isMove ? space.abilities.move : space.abilities.update),
  );

  const title = isMove
    ? t('Move into a space', {
        description: 'Menu action moving a page into a space',
      })
    : t('Show in another space', {
        description: 'Menu action linking a page into another space',
      });

  return (
    <Modal
      isOpen
      closeOnClickOutside
      onClose={onClose}
      size={ModalSize.MEDIUM}
      aria-label={title}
      title={
        <Text as="h1" $margin="0" $size="h6" $align="flex-start">
          {title}
        </Text>
      }
      rightActions={
        <>
          <Button variant="secondary" fullWidth onClick={onClose}>
            {t('Cancel', {
              description: 'Button to dismiss a dialog without confirming',
            })}
          </Button>
          <Button
            fullWidth
            disabled={!spaceId || mutation.isPending}
            onClick={() =>
              mutation.mutate(
                { spaceId },
                {
                  onSuccess: () => {
                    onClose();
                    if (isMove) {
                      // The page is now in that space's tree
                      void router.replace(`/docs/${page.id}/`);
                    }
                  },
                  onError: (error) =>
                    toast(
                      error.cause?.[0] ??
                        t('Something went wrong.', {
                          description: 'Generic error message',
                        }),
                      VariantType.ERROR,
                    ),
                },
              )
            }
          >
            {isMove
              ? t('Move', { description: 'Button moving something' })
              : t('Show it there', {
                  description: 'Button linking a page into a space',
                })}
          </Button>
        </>
      }
    >
      <Box $gap="sm" $padding={{ top: 'xs' }}>
        <Text $variation="secondary" as="p" $margin="none">
          {isMove
            ? t(
                'The page and its subpages then belong to that space, and are shared like it.',
                { description: 'Explanation in the dialog moving a page' },
              )
            : t(
                'The same page (not a copy) is shown in that space too, as "Linked from" its home. Its members can read it; it is still edited and shared where it lives.',
                { description: 'Explanation in the dialog linking a page' },
              )}
        </Text>
        {choices.length ? (
          <Select
            fullWidth
            label={t('Space', { description: 'Label choosing a space' })}
            clearable={false}
            options={choices.map((space) => {
              const home = space.linked_workspaces.find((ws) => ws.is_home);
              return {
                value: space.id,
                label: home
                  ? `${space.title || '—'} · ${home.name}`
                  : space.title || '—',
              };
            })}
            value={spaceId}
            onChange={(event) => setSpaceId(event.target.value as string)}
          />
        ) : (
          <Text $size="sm">
            {isMove
              ? t('There is no space you can move pages into.', {
                  description: 'Shown when no space accepts the page',
                })
              : t('There is no other space where you can edit.', {
                  description: 'Shown when no space can show the page',
                })}
          </Text>
        )}
      </Box>
    </Modal>
  );
};
