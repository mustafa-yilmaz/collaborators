import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { ForMeList } from '../ForMeList';
import { NotificationBell } from '../NotificationBell';

const API = 'http://test.jest/api/v1.0';

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'me' }, authenticated: true }),
}));

const notification = (id: string, title: string, read: boolean) => ({
  id,
  kind: 'mention',
  actor: { id: 'u-1', full_name: 'Ada' },
  document: { id: 'd-1', title },
  workspace: null,
  anchor_id: '',
  thread_id: null,
  team: '',
  team_label: null,
  created_at: '2026-10-26T10:00:00Z',
  read_at: read ? '2026-10-26T11:00:00Z' : null,
});

const called = (url: string) =>
  fetchMock.callHistory.calls().some((call) => call.url === url);

describe('Notifications: See all, and the Active and Read tabs', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.get(`${API}/notifications/preferences/`, { email: false });
    fetchMock.get(`${API}/dashboard/assigned/`, []);
  });

  test('the summary always leads to the screen, even empty', async () => {
    fetchMock.get(`${API}/notifications/`, []);
    render(<ForMeList />, { wrapper: AppWrapper });

    expect(
      await screen.findByText('No mentions or assignments yet.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See all' })).toHaveAttribute(
      'href',
      '/?target=notifications',
    );
  });

  test('the screen shows the unread, then the read ones', async () => {
    fetchMock.get(`${API}/notifications/?unread=true`, [
      notification('n-1', 'Plan', false),
    ]);
    fetchMock.get(`${API}/notifications/?read=true`, [
      notification('n-2', 'Old notes', true),
    ]);
    render(<ForMeList full />, { wrapper: AppWrapper });

    expect(await screen.findByText(/Plan/)).toBeInTheDocument();
    expect(screen.queryByText(/Old notes/)).toBeNull();
    expect(screen.getByRole('tab', { name: 'Active' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.queryByRole('link', { name: 'See all' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Read' }));

    expect(await screen.findByText(/Old notes/)).toBeInTheDocument();
    expect(screen.queryByText(/Plan/)).toBeNull();
    expect(called(`${API}/notifications/?read=true`)).toBe(true);
    // Nothing to mark as read among the read ones
    expect(screen.queryByText('Mark all as read')).toBeNull();
  });

  test('empty tabs say so', async () => {
    fetchMock.get(`${API}/notifications/?unread=true`, []);
    fetchMock.get(`${API}/notifications/?read=true`, []);
    render(<ForMeList full />, { wrapper: AppWrapper });

    expect(
      await screen.findByText(
        'Nothing new: no unread notification, nothing assigned.',
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Read' }));
    expect(
      await screen.findByText('No read notification yet.'),
    ).toBeInTheDocument();
  });

  test('the bell shows See all above its list', async () => {
    fetchMock.get(`${API}/notifications/unread-count/`, { count: 0 });
    fetchMock.get(`${API}/notifications/`, []);
    render(<NotificationBell />, { wrapper: AppWrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    await waitFor(() =>
      expect(screen.getAllByRole('link', { name: 'See all' })).toHaveLength(1),
    );
    expect(screen.getByRole('link', { name: 'See all' })).toHaveAttribute(
      'href',
      '/?target=notifications',
    );
  });
});
