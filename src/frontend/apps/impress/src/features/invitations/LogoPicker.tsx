import {
  Button,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/ui-components';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, Text } from '@/components';

import {
  LogoOwner,
  logoUrl,
  shrinkImage,
  useLogo,
  useLogoMutations,
} from './api';

/** The square showing a logo, or an icon standing for the item. */
export const LogoSquare = ({
  owner,
  id,
  size = 56,
  fallbackIcon,
}: {
  owner: LogoOwner;
  id: string;
  size?: number;
  fallbackIcon: string;
}) => {
  const { data } = useLogo(owner, id);
  return (
    <Box
      $width={`${size}px`}
      $height={`${size}px`}
      $align="center"
      $justify="center"
      $css={css`
        flex-shrink: 0;
        overflow: hidden;
        border-radius: var(--c--globals--spacings--xs);
        border: 1px solid var(--c--contextuals--border--surface--primary);
        background: var(
          --c--contextuals--background--semantic--contextual--primary
        );
      `}
    >
      {data?.exists ? (
        <img
          src={logoUrl(owner, id, data.version)}
          alt=""
          width={size}
          height={size}
          style={{ objectFit: 'contain', width: '100%', height: '100%' }}
        />
      ) : (
        <Icon
          iconName={fallbackIcon}
          $size={`${Math.round(size / 2)}px`}
          $variation="secondary"
        />
      )}
    </Box>
  );
};

/**
 * The logo of a workspace, a space or a page: shown in invitations and on
 * the page accepting them. Those who may change the item choose or remove it.
 */
export const LogoPicker = ({
  owner,
  id,
  canEdit,
  fallbackIcon,
}: {
  owner: LogoOwner;
  id: string;
  canEdit: boolean;
  fallbackIcon: string;
}) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const input = useRef<HTMLInputElement>(null);
  const { data } = useLogo(owner, id);
  const { set, remove } = useLogoMutations(owner, id);
  const failed = () =>
    toast(
      t('Choose a PNG, JPEG, WebP or GIF image.', {
        description: 'Toast when a logo could not be used',
      }),
      VariantType.ERROR,
    );

  return (
    <Box $direction="row" $align="center" $gap="sm">
      <LogoSquare owner={owner} id={id} fallbackIcon={fallbackIcon} />
      <Box $gap="3xs">
        <Text $size="xs" $variation="secondary">
          {t(
            'Shown in invitations and on the page where invited people sign up.',
            { description: 'Help text of a logo' },
          )}
        </Text>
        {canEdit && (
          <Box $direction="row" $gap="xs" $css="flex-wrap: wrap;">
            <Button
              size="small"
              variant="secondary"
              disabled={set.isPending}
              onClick={() => input.current?.click()}
            >
              {data?.exists
                ? t('Change the logo', {
                    description: 'Button choosing a logo',
                  })
                : t('Choose a logo', { description: 'Button choosing a logo' })}
            </Button>
            {data?.exists && (
              <Button
                size="small"
                variant="tertiary"
                color="neutral"
                onClick={() => remove.mutate()}
              >
                {t('Remove', { description: 'Button removing a logo' })}
              </Button>
            )}
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) {
                  return;
                }
                shrinkImage(file)
                  .then((dataUrl) => set.mutate(dataUrl, { onError: failed }))
                  .catch(failed);
              }}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};
