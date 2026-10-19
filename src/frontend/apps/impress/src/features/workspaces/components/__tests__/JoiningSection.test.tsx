import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { ReactNode } from 'react';
import { beforeEach, describe, expect, test } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { Workspace, WorkspaceRole } from '../../types';
import { JoiningSection } from '../JoiningSection';

const API = 'http://test.jest/api/v1.0';

const Section = ({ children }: { title: string; children: ReactNode }) => (
  <section>{children}</section>
);

const workspace: Workspace = {
  id: 'ws-1',
  name: 'Acme',
  slug: 'acme',
  description: '',
  publishing_policy: 'space_admins',
  join_domains: [],
  join_group: null,
  join_organizations: [{ id: 'google:acme.org', name: 'acme.org' }],
  join_organization_choices: [
    { id: 'google:acme.org', name: 'acme.org' },
    { id: 'microsoft:t-1', name: 'contoso.com' },
  ],
  join_approval: true,
  join_token: null,
  pending_join_requests: 1,
  user_role: WorkspaceRole.OWNER,
  abilities: {
    destroy: true,
    manage_accesses: true,
    manage_groups: true,
    partial_update: true,
    retrieve: true,
    spaces_create: true,
    update: true,
  },
  created_at: '',
  updated_at: '',
};

describe('JoiningSection', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.get(`${API}/workspaces/ws-1/groups/`, []);
    fetchMock.get(`${API}/workspaces/ws-1/join-requests/`, [
      {
        id: 'req-1',
        user: { id: 'u-1', full_name: 'Bo Lee', email: 'bo@acme.org' },
        via: 'link',
        created_at: '',
      },
    ]);
  });

  test('lets admins approve requests and add their own organisations', async () => {
    fetchMock.post(`${API}/workspaces/ws-1/join-requests/req-1/approve/`, 204);
    fetchMock.patch(`${API}/workspaces/ws-1/`, workspace);

    render(<JoiningSection workspace={workspace} Section={Section} />, {
      wrapper: AppWrapper,
    });

    const requests = await screen.findByTestId('join-requests');
    expect(within(requests).getByText('Bo Lee')).toBeInTheDocument();
    await userEvent.click(
      within(requests).getByRole('button', { name: 'Approve' }),
    );
    await waitFor(() =>
      expect(
        fetchMock.callHistory.called(
          `${API}/workspaces/ws-1/join-requests/req-1/approve/`,
        ),
      ).toBe(true),
    );

    // the one already there is a chip; the other can be added
    expect(
      screen.getByText('Google Workspace acme.org', { selector: 'p, span' }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', {
        name: /Microsoft organisation contoso.com/,
      }),
    );
    await waitFor(() =>
      expect(
        JSON.parse(
          fetchMock.callHistory.lastCall(`${API}/workspaces/ws-1/`)?.options
            .body as string,
        ),
      ).toEqual({
        join_organizations: ['google:acme.org', 'microsoft:t-1'],
      }),
    );
  });
});
