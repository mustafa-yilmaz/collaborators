import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { User } from '@/features/auth/api';
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
  full_name: 'Tom Test',
  email: 'tom@example.org',
  email_verified: true,
  platform_role: 'collaborator',
  registration_status: 'approved',
  created_at: '2026-10-20T10:00:00Z',
  last_login: '2026-10-21T10:00:00Z',
  workspaces: 1,
  pages: 1,
  suspended: false,
  can_manage: true,
  levels_you_may_give: ['collaborator', 'manager'],
};

const list = (people: object[]) =>
  fetchMock.get(`begin:${API}/platform/people/?`, {
    count: people.length,
    next: null,
    results: people,
  });

/** The body of the last POST to this address. */
const bodyOf = (url: string) =>
  JSON.parse(
    (fetchMock.callHistory
      .calls()
      .filter(
        (call) =>
          call.url === url && call.options.method?.toUpperCase() === 'POST',
      )
      .pop()?.options.body as string) || '{}',
  ) as Record<string, unknown>;

describe('Suspending, removing and blocking accounts', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    me.current = { id: 'me', platform_role: 'administrator' };
  });

  test('only people one may manage have actions', async () => {
    list([
      person,
      {
        ...person,
        id: 'u-2',
        full_name: 'Olga',
        can_manage: false,
        levels_you_may_give: [],
      },
    ]);
    render(<ManageCollaborators />, { wrapper: AppWrapper });

    const row = await screen.findByTestId('platform-person-u-1');
    expect(row).toHaveTextContent('Suspend');
    expect(row).toHaveTextContent('Remove');
    expect(screen.getByTestId('platform-person-u-2')).not.toHaveTextContent(
      'Suspend',
    );
    expect(screen.getByTestId('platform-person-u-2')).not.toHaveTextContent(
      'Level',
    );
  });

  test('appointing offers the levels one may give, explained', async () => {
    list([person]);
    fetchMock.post(`${API}/platform/people/u-1/level/`, {
      platform_role: 'manager',
    });
    render(<ManageCollaborators />, { wrapper: AppWrapper });

    fireEvent.click(await screen.findByRole('button', { name: 'Level' }));
    expect(
      await screen.findByText('Change Tom Test’s level'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Approves new registrations and sees everyone.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Owner' })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Manager' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change the level' }));

    await waitFor(() =>
      expect(bodyOf(`${API}/platform/people/u-1/level/`)).toEqual({
        role: 'manager',
      }),
    );
  });

  test('an owner changes another owner’s level, nothing else', async () => {
    me.current = { id: 'me', platform_role: 'owner' };
    list([
      {
        ...person,
        platform_role: 'owner',
        can_manage: false,
        levels_you_may_give: [
          'collaborator',
          'manager',
          'administrator',
          'owner',
        ],
      },
    ]);
    render(<ManageCollaborators />, { wrapper: AppWrapper });

    const row = await screen.findByTestId('platform-person-u-1');
    expect(row).toHaveTextContent('Level');
    expect(row).not.toHaveTextContent('Suspend');
    expect(row).not.toHaveTextContent('Remove');
  });

  test('a suspended person is marked and can be reinstated', async () => {
    list([{ ...person, suspended: true }]);
    fetchMock.post(`${API}/platform/people/u-1/reinstate/`, {
      sign_in_server: 'done',
    });
    render(<ManageCollaborators />, { wrapper: AppWrapper });

    const row = await screen.findByTestId('platform-person-u-1');
    expect(row).toHaveTextContent('Suspended');
    fireEvent.click(screen.getByRole('button', { name: 'Reinstate' }));

    await waitFor(() =>
      expect(
        fetchMock.callHistory.called(`${API}/platform/people/u-1/reinstate/`),
      ).toBe(true),
    );
  });

  test('suspending asks first, with a reason', async () => {
    list([person]);
    fetchMock.post(`${API}/platform/people/u-1/suspend/`, {
      sign_in_server: 'done',
    });
    render(<ManageCollaborators />, { wrapper: AppWrapper });

    fireEvent.click(await screen.findByRole('button', { name: 'Suspend' }));
    expect(await screen.findByText('Suspend Tom Test?')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Reason/), {
      target: { value: 'Spam' },
    });
    const confirm = screen.getAllByRole('button', { name: 'Suspend' });
    fireEvent.click(confirm[confirm.length - 1]);

    await waitFor(() =>
      expect(bodyOf(`${API}/platform/people/u-1/suspend/`)).toEqual({
        reason: 'Spam',
      }),
    );
  });

  test('removing tells what is left and hands it over to oneself first', async () => {
    list([person]);
    fetchMock.get(`${API}/platform/people/u-1/removal/`, {
      pages: [{ id: 'p-1', title: 'Roadmap' }],
      pages_count: 1,
      pages_with_subpages: 3,
      workspaces: [{ id: 'w-1', name: 'Acme' }],
    });
    fetchMock.post(`${API}/platform/people/u-1/remove/`, {
      sign_in_server: 'done',
    });
    render(<ManageCollaborators />, { wrapper: AppWrapper });

    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(
      await screen.findByText(
        'They alone own 1 page (3 with the pages below it): Roadmap',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('They alone own these workspaces: Acme'),
    ).toBeInTheDocument();
    expect(screen.getByText('To: you')).toBeInTheDocument();
    // Administrators don't block; owners do
    expect(screen.queryByText(/Also block/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove the account' }));

    await waitFor(() =>
      expect(bodyOf(`${API}/platform/people/u-1/remove/`)).toEqual({
        pages: 'hand_over',
        recipient: 'me',
        reason: '',
        block: false,
      }),
    );
  });

  test('owners alone find the blocked accounts, and block an email', async () => {
    list([]);
    fetchMock.get(`begin:${API}/people/directory/`, []);
    render(<CollaboratorsTabs />, { wrapper: AppWrapper });
    expect(screen.queryByRole('tab', { name: 'Blocked accounts' })).toBeNull();
  });

  test('an owner blocks an email', async () => {
    me.current = { id: 'me', platform_role: 'owner' };
    fetchMock.get(`begin:${API}/people/directory/`, []);
    fetchMock.get(`${API}/platform/blocked/`, [
      {
        id: 'b-1',
        email: 'old@example.org',
        reason: 'Spam',
        blocked_by: 'Olga <olga@example.org>',
        created_at: '2026-10-25T10:00:00Z',
        has_account: false,
      },
    ]);
    fetchMock.post(`${API}/platform/blocked/`, {
      id: 'b-2',
      email: 'new@example.org',
      reason: '',
      blocked_by: '',
      created_at: '2026-10-25T10:00:00Z',
      has_account: false,
    });
    render(<CollaboratorsTabs />, { wrapper: AppWrapper });

    fireEvent.click(screen.getByRole('tab', { name: 'Blocked accounts' }));
    expect(
      await screen.findByTestId('blocked-old@example.org'),
    ).toHaveTextContent('no account here');
    fireEvent.change(screen.getByLabelText('Email to block'), {
      target: { value: 'new@example.org' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Block' }));

    await waitFor(() =>
      expect(bodyOf(`${API}/platform/blocked/`)).toEqual({
        email: 'new@example.org',
        reason: '',
      }),
    );
  });
});
