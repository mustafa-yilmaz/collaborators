import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { readTarget } from '@/docs/doc-management';
import { DocDefaultFilter } from '@/docs/doc-management/types';
import { User, hasPlatformLevel } from '@/features/auth/api';
import { AppWrapper } from '@/tests/utils';

import { CollaboratorsTabs } from '../CollaboratorsTabs';
import { ManageCollaborators } from '../ManageCollaborators';

const API = 'http://test.jest/api/v1.0';

const me: { current: Partial<User> } = { current: {} };

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: me.current, authenticated: true }),
}));

const person = {
  id: 'u-1',
  full_name: 'Zoë Zeta',
  email: 'zoe@example.org',
  email_verified: true,
  platform_role: 'administrator',
  registration_status: 'pending',
  created_at: '2026-10-20T10:00:00Z',
  last_login: null,
  workspaces: 2,
  pages: 5,
};

describe('Manage Collaborators', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.get(`begin:${API}/people/directory/`, []);
  });

  test('the levels go up from collaborator to owner', () => {
    expect(hasPlatformLevel({ platform_role: 'owner' }, 'manager')).toBe(true);
    expect(hasPlatformLevel({ platform_role: 'manager' }, 'manager')).toBe(
      true,
    );
    expect(
      hasPlatformLevel({ platform_role: 'manager' }, 'administrator'),
    ).toBe(false);
    expect(hasPlatformLevel({}, 'manager')).toBe(false);
    expect(hasPlatformLevel(undefined, 'manager')).toBe(false);
  });

  test('the screen is at ?target=collaborators; the former address opens it', () => {
    expect(DocDefaultFilter.PEOPLE).toBe('collaborators');
    expect(readTarget('people')).toBe(DocDefaultFilter.PEOPLE);
    expect(readTarget('collaborators')).toBe(DocDefaultFilter.PEOPLE);
    expect(readTarget('starred')).toBe(DocDefaultFilter.STARRED);
    expect(readTarget(null)).toBeNull();
  });

  test('a collaborator sees only the people they may see', () => {
    me.current = { platform_role: 'collaborator' };
    render(<CollaboratorsTabs />, { wrapper: AppWrapper });

    expect(screen.getByTestId('people-directory')).toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: 'Manage Collaborators' }),
    ).toBeNull();
  });

  test('a platform manager opens Manage Collaborators', async () => {
    me.current = { platform_role: 'manager' };
    fetchMock.get(`begin:${API}/platform/people/`, {
      count: 1,
      next: null,
      results: [person],
    });
    render(<CollaboratorsTabs />, { wrapper: AppWrapper });

    fireEvent.click(screen.getByRole('tab', { name: 'Manage Collaborators' }));

    const row = await screen.findByTestId('platform-person-u-1');
    expect(row).toHaveTextContent('Zoë Zeta');
    expect(row).toHaveTextContent('Platform administrator');
    expect(row).toHaveTextContent('Waiting for approval');
    expect(row).toHaveTextContent('zoe@example.org');
    expect(row).toHaveTextContent('5 pages owned');
    expect(row).toHaveTextContent('2 workspaces');
    expect(screen.getByText('1 person')).toBeInTheDocument();
  });

  test('filters by level and registration go to the server', async () => {
    fetchMock.get(`begin:${API}/platform/people/`, {
      count: 0,
      next: null,
      results: [],
    });
    render(<ManageCollaborators />, { wrapper: AppWrapper });
    await screen.findByText('0 people');

    fireEvent.click(screen.getByRole('button', { name: 'Platform owner' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Waiting for approval' }),
    );

    await waitFor(() =>
      expect(
        fetchMock.callHistory
          .calls()
          .some(
            (call) =>
              call.url.includes('role=owner') &&
              call.url.includes('status=pending'),
          ),
      ).toBe(true),
    );
  });
});
