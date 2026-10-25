import { render, screen } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { SpaceContents } from '../SpaceContents';
import { WorkspaceScreen } from '../WorkspaceScreen';

vi.mock('next/router', async () => ({
  ...(await vi.importActual('next/router')),
  useRouter: () => ({ push: vi.fn(), pathname: '/workspace/[id]' }),
}));

vi.mock('@/features/docs/doc-management', async () => ({
  ...(await vi.importActual('@/features/docs/doc-management')),
  useCreateChildDocTree: () => () => null,
}));

const API = 'http://test.jest/api/v1.0';
const NOW = new Date().toISOString();

const workspace = (update: boolean) => ({
  id: 'w-1',
  name: 'Acme',
  slug: 'acme',
  description: 'Our research lab',
  abilities: { update, spaces_create: true },
});

describe('A workspace and its spaces, as folders', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.get(`begin:${API}/workspaces/w-1/logo/`, 404);
    fetchMock.get(`begin:${API}/documents/`, (call) =>
      call.url.includes('/logo/')
        ? 404
        : call.url.includes('/labels/')
          ? { names: [], can_edit: false }
          : {
              count: 1,
              results: [{ id: 'p-9', title: 'Agenda', updated_at: NOW }],
            },
    );
    fetchMock.get(`${API}/workspaces/w-1/labels/`, {
      names: ['Climate'],
      can_edit: false,
    });
    fetchMock.get(`${API}/spaces/?workspace=w-1`, [
      {
        id: 's-1',
        title: 'Engineering',
        kind: 'space',
        updated_at: NOW,
        linked_workspaces: [{ id: 'w-1', name: 'Acme', is_home: true }],
      },
      {
        id: 's-2',
        title: 'Atlas',
        kind: 'space',
        updated_at: NOW,
        linked_workspaces: [{ id: 'w-2', name: 'Partner', is_home: true }],
      },
    ]);
    fetchMock.get(`${API}/spaces/?workspace=w-1&kind=page`, [
      { id: 'p-1', title: 'Charter', kind: 'page', updated_at: NOW },
    ]);
  });

  test('a workspace shows its spaces as folders and its own pages', async () => {
    fetchMock.get(`${API}/workspaces/`, [workspace(true)]);
    render(<WorkspaceScreen workspaceId="w-1" />, { wrapper: AppWrapper });

    expect(await screen.findByRole('heading', { name: 'Acme' })).toBeVisible();
    expect(screen.getByText('Our research lab')).toBeVisible();
    expect(await screen.findByTestId('label-Climate')).toBeInTheDocument();
    const engineering = await screen.findByRole('link', {
      name: /Engineering/,
    });
    expect(engineering).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/space\/s-1\/?$/),
    );
    expect(engineering.textContent).toContain('folder');
    expect(
      await screen.findByRole('link', { name: /Atlas.*Shared from Partner/ }),
    ).toHaveAttribute('href', expect.stringMatching(/^\/space\/s-2\/?$/));
    const charter = await screen.findByRole('link', { name: /Charter/ });
    expect(charter).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/page\/p-1\/?$/),
    );
    expect(charter.textContent).toContain('description');
    expect(
      screen.getByRole('button', { name: 'Workspace settings' }),
    ).toBeVisible();
    expect(screen.getByText('New space')).toBeVisible();
    expect(screen.getByText('New page')).toBeVisible();
  });

  test('members who may not change it get no settings', async () => {
    fetchMock.get(`${API}/workspaces/`, [workspace(false)]);
    render(<WorkspaceScreen workspaceId="w-1" />, { wrapper: AppWrapper });

    expect(await screen.findByRole('heading', { name: 'Acme' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Workspace settings' }),
    ).toBeNull();
  });

  test("a workspace one isn't in says so", async () => {
    fetchMock.get(`${API}/workspaces/`, []);
    render(<WorkspaceScreen workspaceId="w-1" />, { wrapper: AppWrapper });

    expect(
      await screen.findByText(/This workspace isn't one of yours/),
    ).toBeVisible();
  });

  test('a space lists its pages and those linked into it', async () => {
    fetchMock.get(`${API}/spaces/s-1/linked-pages/`, [
      {
        link_id: 'l-1',
        page: { id: 'p-5', title: 'Roadmap' },
        home: { id: 's-9', title: 'Board' },
      },
    ]);
    render(
      <SpaceContents
        space={
          {
            id: 's-1',
            kind: 'space',
            abilities: { children_list: true, children_create: true },
          } as never
        }
      />,
      { wrapper: AppWrapper },
    );

    expect(await screen.findByRole('link', { name: /Agenda/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/page\/p-9\/?$/),
    );
    expect(
      await screen.findByRole('link', { name: /Roadmap.*Linked from Board/ }),
    ).toHaveAttribute('href', expect.stringMatching(/^\/page\/p-5\/?$/));
    expect(screen.getByText('New page')).toBeVisible();
  });
});
