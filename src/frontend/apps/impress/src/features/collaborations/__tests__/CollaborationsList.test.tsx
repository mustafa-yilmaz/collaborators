import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { CollaborationsList } from '../CollaborationsList';

vi.mock('next/router', async () => ({
  ...(await vi.importActual('next/router')),
  useRouter: () => ({ push: vi.fn(), pathname: '/' }),
}));

const API = 'http://test.jest/api/v1.0';

describe('CollaborationsList', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  test('lists workspaces, spaces and pages, with buttons creating them', async () => {
    fetchMock.get(`${API}/collaborations/?view=owned`, {
      view: 'owned',
      workspaces: [
        {
          id: 'w-1',
          name: 'Acme',
          slug: 'acme',
          role: 'owner',
          updated_at: '2026-10-20T08:00:00Z',
          is_favorite: false,
        },
      ],
      spaces: [],
      pages: [
        {
          id: 'p-1',
          title: 'Notes',
          kind: 'page',
          updated_at: '2026-10-20T08:00:00Z',
          is_owned: true,
          is_favorite: true,
        },
      ],
    });
    fetchMock.post(`${API}/workspaces/w-1/favorite/`, { is_favorite: true });

    render(<CollaborationsList view="owned" />, { wrapper: AppWrapper });

    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('No space here yet.')).toBeInTheDocument();
    for (const name of ['New workspace', 'New space', 'New page']) {
      expect(screen.getByRole('button', { name })).toBeVisible();
    }
    // Starred pages show it; a workspace can be starred from here
    expect(screen.getByRole('button', { name: 'Unstar' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Star' }));
    await waitFor(() =>
      expect(
        fetchMock.callHistory.called(`${API}/workspaces/w-1/favorite/`),
      ).toBe(true),
    );
  });

  test('other views have nothing to create', async () => {
    fetchMock.get(`${API}/collaborations/?view=shared`, {
      view: 'shared',
      workspaces: [],
      spaces: [],
      pages: [],
    });

    render(<CollaborationsList view="shared" />, { wrapper: AppWrapper });

    expect(await screen.findByText('No workspace here yet.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'New page' })).toBeNull();
  });

  test('as a summary: one plain list, the latest first, nothing to create', async () => {
    const page = (n: number) => ({
      id: `p-${n}`,
      title: `Page ${n}`,
      kind: 'page',
      updated_at: `2026-10-0${n}T08:00:00Z`,
      is_owned: true,
      is_favorite: false,
    });
    fetchMock.get(`${API}/collaborations/?view=owned`, {
      view: 'owned',
      workspaces: [
        {
          id: 'w-1',
          name: 'Acme',
          slug: 'acme',
          role: 'owner',
          updated_at: '2026-10-04T12:00:00Z',
          is_favorite: false,
        },
      ],
      spaces: [],
      pages: [1, 2, 3, 4, 5].map(page),
    });

    render(<CollaborationsList view="owned" summary={3} />, {
      wrapper: AppWrapper,
    });

    expect(await screen.findByText('Page 5')).toBeVisible();
    const titles = screen.getAllByRole('link').map((link) => link.textContent);
    expect(titles[0]).toContain('Page 5');
    expect(titles[1]).toContain('Acme');
    expect(titles[2]).toContain('Page 4');
    expect(screen.queryByText('Page 3')).toBeNull();
    // No groups in a summary
    expect(screen.queryByText('Workspaces')).toBeNull();
    expect(screen.queryByRole('button', { name: 'New page' })).toBeNull();
  });

  test('as a summary of nothing: says so once', async () => {
    fetchMock.get(`${API}/collaborations/?view=starred`, {
      view: 'starred',
      workspaces: [],
      spaces: [],
      pages: [],
    });

    render(<CollaborationsList view="starred" summary={3} />, {
      wrapper: AppWrapper,
    });

    expect(await screen.findByText('Nothing here yet.')).toBeVisible();
  });
});
