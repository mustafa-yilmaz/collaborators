import { render, screen } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, test } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { CARDS } from '../cards';

const API = 'http://test.jest/api/v1.0';
const card = CARDS.find((item) => item.id === 'notifications')!;

describe('Mentions, notifications and assignments card', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  test('says so when there is nothing yet', async () => {
    fetchMock.get(`${API}/notifications/`, []);
    fetchMock.get(`${API}/dashboard/assigned/`, []);

    render(<card.Body />, { wrapper: AppWrapper });

    expect(
      await screen.findByText('No mentions or assignments yet.'),
    ).toBeInTheDocument();
  });

  test('lists mentions and assignments together, newest first', async () => {
    fetchMock.get(`${API}/notifications/`, [
      {
        id: 'n-1',
        kind: 'mention',
        actor: { id: 'u-2', full_name: 'Ada' },
        document: { id: 'd-1', title: 'Plan' },
        workspace: null,
        anchor_id: 'b-9',
        thread_id: null,
        team: '',
        team_label: null,
        created_at: '2026-10-20T08:00:00Z',
        read_at: null,
      },
      {
        // the notification of an assignment shows as the assignment itself
        id: 'n-2',
        kind: 'assignment',
        actor: { id: 'u-2', full_name: 'Ada' },
        document: { id: 'd-1', title: 'Plan' },
        workspace: null,
        anchor_id: 'b-1',
        thread_id: null,
        team: '',
        team_label: null,
        created_at: '2026-10-21T08:00:00Z',
        read_at: null,
      },
    ]);
    fetchMock.get(`${API}/dashboard/assigned/`, [
      {
        id: 'a-1',
        document: { id: 'd-1', title: 'Plan' },
        anchor_id: 'b-1',
        row_label: 'Book the room',
        team_label: null,
        assigned_by: 'Ada',
        updated_at: '2026-10-21T08:00:00Z',
      },
    ]);

    render(<card.Body />, { wrapper: AppWrapper });

    const assignment = await screen.findByText('Book the room');
    const rows = screen.getAllByRole('link');
    // Two entries, then the link to the full list
    expect(rows).toHaveLength(3);
    expect(rows[2]).toHaveTextContent('See all');
    expect(rows[2]).toHaveAttribute('href', '/?target=notifications');
    expect(rows[0]).toContainElement(assignment);
    expect(rows[0]).toHaveTextContent('Assigned by Ada in Plan');
    expect(rows[0]).toHaveAttribute('href', '/docs/d-1#b-1');
  });
});
