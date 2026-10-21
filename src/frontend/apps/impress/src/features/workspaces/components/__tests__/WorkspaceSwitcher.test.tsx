import { fireEvent, render, screen } from '@testing-library/react';
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
});
