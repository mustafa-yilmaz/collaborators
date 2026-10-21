import { Button, ButtonProps } from '@gouvfr-lasuite/ui-components';
import { t } from 'i18next';
import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';

import SearchSVG from '@/assets/icons/ui-kit/zoom-rounded.svg';
import { useDocStore } from '@/docs/doc-management';
import { useAuth } from '@/features/auth';
import { useCmdK } from '@/hooks/useCmdK';

// Signed in: the one search (workspaces, spaces, pages, labels); on a
// public page signed out, the search of that page's tree
const SearchModal = dynamic(
  () =>
    import('@/features/search/SearchModal').then((mod) => ({
      default: mod.SearchModal,
    })),
  { ssr: false },
);

const DocSearchModal = dynamic(
  () =>
    import('./DocSearchModal').then((mod) => ({
      default: mod.DocSearchModal,
    })),
  { ssr: false },
);

export const DocSearchButtonModal = ({ ...props }: ButtonProps) => {
  const { currentDoc } = useDocStore();
  const { authenticated } = useAuth();
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const canSearch = authenticated || currentDoc?.abilities.search;

  const openSearchModal = useCallback(() => {
    const isEditorToolbarOpen =
      document.getElementsByClassName('bn-formatting-toolbar').length > 0;
    if (isEditorToolbarOpen) {
      return;
    }

    setIsSearchModalOpen(true);
  }, []);

  const closeSearchModal = useCallback(() => {
    setIsSearchModalOpen(false);
  }, []);

  useCmdK(openSearchModal);

  if (!canSearch) {
    return null;
  }

  return (
    <>
      <Button
        data-testid="search-docs-button"
        onClick={openSearchModal}
        size="medium"
        color="brand"
        variant="tertiary"
        aria-label={t('Search', {
          description: 'Accessible name of the button opening the doc search',
        })}
        icon={<SearchSVG aria-hidden="true" width={24} height={24} />}
        {...props}
      />
      {isSearchModalOpen && authenticated && (
        <SearchModal onClose={closeSearchModal} />
      )}
      {isSearchModalOpen && !authenticated && (
        <DocSearchModal
          onClose={closeSearchModal}
          isOpen={isSearchModalOpen}
          doc={currentDoc}
          defaultFilters="all"
        />
      )}
    </>
  );
};
