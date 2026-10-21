import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      'Starred',
      'Owned by me',
      'Shared with me',
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

  test('restores the default order when it was changed', async () => {
    fetchMock.removeRoutes();
    fetchMock.get(`${API}/dashboard/sidebar/`, [
      'shared',
      'recent',
      'notifications',
      'explore',
      'starred',
      'owned',
    ]);
    fetchMock.put(`${API}/dashboard/sidebar/`, []);
    render(<LeftPanelTargetFilters />, { wrapper: AppWrapper });

    const restore = await screen.findByRole('button', {
      name: 'Restore the order',
    });
    expect(
      screen
        .getAllByRole('link')
        .map((link) => link.getAttribute('aria-label')),
    ).toEqual([
      'Shared with me',
      'Recent',
      'Notifications',
      'Search',
      'Starred',
      'Owned by me',
      'Trashbin',
    ]);

    fireEvent.click(restore);

    await waitFor(() =>
      expect(screen.getAllByRole('link')[0].getAttribute('aria-label')).toBe(
        'Recent',
      ),
    );
    expect(
      screen.queryByRole('button', { name: 'Restore the order' }),
    ).toBeNull();
  });

  test('offers no restore while the order is the default one', () => {
    render(<LeftPanelTargetFilters />, { wrapper: AppWrapper });

    expect(
      screen.queryByRole('button', { name: 'Restore the order' }),
    ).toBeNull();
  });
});
