import { render, screen } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { LeftPanelTargetFilters } from '../LefPanelTargetFilters';

vi.mock('next/navigation', async () => ({
  ...(await vi.importActual('next/navigation')),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

const API = 'http://test.jest/api/v1.0';

describe('LeftPanelTargetFilters', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.get(`${API}/dashboard/sidebar/`, []);
  });

  test('lists the screens, Search among them and no Labels', () => {
    render(<LeftPanelTargetFilters />, { wrapper: AppWrapper });

    const names = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('aria-label'));
    expect(names).toEqual([
      'Recent',
      'Notifications',
      'Search',
      'Owned by me',
      'Shared with me',
      'Starred',
      'Trashbin',
    ]);
    expect(screen.getByRole('link', { name: 'Search' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/workspaces\/discover\/?$/),
    );
  });

  test('moves an item by its handle only, apart from its link', () => {
    render(<LeftPanelTargetFilters />, { wrapper: AppWrapper });

    const link = screen.getByRole('link', { name: 'Recent' });
    const handle = screen.getByRole('button', { name: 'Move Recent' });
    expect(link).not.toContainElement(handle);
    expect(handle).not.toContainElement(link);
    // The trash stays last: it has no handle
    expect(screen.queryByRole('button', { name: 'Move Trashbin' })).toBeNull();
  });
});
