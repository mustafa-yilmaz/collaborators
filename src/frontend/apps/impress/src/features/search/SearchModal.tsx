import { Modal, ModalSize } from '@gouvfr-lasuite/ui-components';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, Loading, StyledLink, Text } from '@/components';

import { SearchResults } from './SearchResults';
import { SEARCH_MIN_LENGTH, searchHref, useSearch } from './api';

/** Results per kind in the dialog; the Search screen shows more. */
const DIALOG_SIZE = 5;

/** Waits until typing pauses before searching. */
const useDebounced = (value: string, delay = 250) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

/**
 * The one search, in a dialog: the search icons (left panel, header) and
 * the dashboard's search box open it. "See all results" leads to the
 * Search screen of the left panel.
 */
export const SearchModal = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query.trim());
  const { data, isFetching } = useSearch(debounced, DIALOG_SIZE);
  const ready = debounced.length >= SEARCH_MIN_LENGTH;
  const label = t('Search', { description: 'Search box placeholder' });

  return (
    <Modal
      isOpen
      closeOnClickOutside
      onClose={onClose}
      size={ModalSize.LARGE}
      aria-label={label}
      title={
        <Text as="h1" $margin="0" $size="h6" $align="flex-start">
          {label}
        </Text>
      }
    >
      <Box $gap="sm" $padding={{ top: 'xs' }} data-testid="search-modal">
        <Box
          $direction="row"
          $align="center"
          $gap="xs"
          $padding={{ horizontal: 'sm', vertical: 'xs' }}
          $css={css`
            border: 1px solid var(--c--contextuals--border--surface--primary);
            border-radius: var(--c--globals--spacings--xs);
            &:focus-within {
              border-color: var(--c--globals--colors--brand-400);
            }
          `}
        >
          <Icon iconName="search" $size="20px" $variation="secondary" />
          <input
            autoFocus
            value={query}
            placeholder={label}
            aria-label={label}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                query.trim().length >= SEARCH_MIN_LENGTH
              ) {
                void router.push(searchHref(query.trim()));
                onClose();
              }
            }}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '1rem',
              color: 'inherit',
            }}
          />
          {isFetching && <Loading $height="20px" $width="20px" />}
        </Box>
        {!ready && (
          <Text $size="sm" $variation="secondary">
            {t(
              'Search the workspaces, spaces, pages and labels you are part of, and those open to you.',
              { description: 'Search dialog before typing' },
            )}
          </Text>
        )}
        {ready && data && (
          <Box $css="max-height: 60vh; overflow-y: auto;">
            <SearchResults result={data} onOpen={onClose} />
          </Box>
        )}
        {ready && (
          <Box $direction="row" $justify="flex-end">
            <StyledLink href={searchHref(debounced)} onClick={onClose}>
              <Text $size="sm" $theme="brand">
                {t('See all results', {
                  description:
                    'Link from the search dialog to the Search screen',
                })}
              </Text>
            </StyledLink>
          </Box>
        )}
      </Box>
    </Modal>
  );
};
