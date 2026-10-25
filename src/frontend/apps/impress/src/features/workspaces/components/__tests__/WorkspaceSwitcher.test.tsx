import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { useWorkspaceStore } from '../../stores/useWorkspaceStore';
import { WorkspaceSwitcher } from '../WorkspaceSwitcher';

const push = vi.fn();
vi.mock('next/router', async () => ({
  ...(await vi.importActual('next/router')),
  useRouter: () => ({ push, pathname: '/' }),
}));

const API = 'http://test.jest/api/v1.0';

describe('WorkspaceSwitcher', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.get(`${API}/workspaces/`, [
      { id: 'w-1', name: 'Acme', slug: 'acme' },
    ]);
    push.mockClear();
  });

  test('shows nothing outside workspaces', () => {
    useWorkspaceStore.getState().setCurrentWorkspaceId(null);
    render(<WorkspaceSwitcher />, { wrapper: AppWrapper });
    expect(screen.queryByText('My collaborations')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Workspace settings' }),
    ).toBeNull();
  });

  test('in a workspace: its name, its settings, and the way back', async () => {
    useWorkspaceStore.getState().setCurrentWorkspaceId('w-1');
    render(<WorkspaceSwitcher />, { wrapper: AppWrapper });

    expect(await screen.findByText('Acme')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Workspace settings' }));
    expect(push).toHaveBeenCalledWith('/workspaces/w-1/settings');

    fireEvent.click(screen.getByText('My collaborations'));
    expect(useWorkspaceStore.getState().currentWorkspaceId).toBeNull();
    expect(push).toHaveBeenCalledWith('/');
  });

  test('a workspace made after the list was loaded is asked for again', async () => {
    // The list loaded before the workspace was made, then with it
    fetchMock.removeRoutes();
    let calls = 0;
    fetchMock.get(`${API}/workspaces/`, () => {
      calls += 1;
      return calls === 1
        ? [{ id: 'w-1', name: 'Acme', slug: 'acme' }]
        : [
            { id: 'w-1', name: 'Acme', slug: 'acme' },
            { id: 'w-2', name: 'New Lab', slug: 'new-lab' },
          ];
    });
    useWorkspaceStore.getState().setCurrentWorkspaceId('w-2');
    render(<WorkspaceSwitcher />, { wrapper: AppWrapper });

    expect(await screen.findByText('New Lab')).toBeInTheDocument();
    expect(useWorkspaceStore.getState().currentWorkspaceId).toBe('w-2');
  });

  test('a workspace still missing once asked for again is forgotten', async () => {
    useWorkspaceStore.getState().setCurrentWorkspaceId('w-gone');
    render(<WorkspaceSwitcher />, { wrapper: AppWrapper });

    await waitFor(() =>
      expect(useWorkspaceStore.getState().currentWorkspaceId).toBeNull(),
    );
  });
});
