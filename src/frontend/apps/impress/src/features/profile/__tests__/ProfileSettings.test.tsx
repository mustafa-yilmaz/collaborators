import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, test } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { ProfileSettings } from '../ProfileSettings';
import { PROFILE_FIELDS } from '../api';

const API = 'http://test.jest/api/v1.0';
const URL = `${API}/profiles/me/`;

const me = {
  id: 'u-1',
  full_name: 'Ada Lovelace',
  is_me: true,
  headline: '',
  organization: '',
  location: '',
  bio: '',
  website: '',
  email: 'ada@acme.org',
  interests: ['AI'],
  workspaces: [],
  visibility: Object.fromEntries(
    PROFILE_FIELDS.map((field) => [
      field,
      { level: 'platform', workspaces: [], spaces: [] },
    ]),
  ),
  workspace_choices: [{ id: 'w-1', name: 'Acme' }],
  space_choices: [],
};

describe('ProfileSettings', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  test('saves the pieces, the interests and who sees them', async () => {
    fetchMock.get(URL, me);
    fetchMock.put(URL, me);
    // Interests are among the labels already used
    fetchMock.get('begin:http://test.jest/api/v1.0/labels/?q=', [
      { name: 'Climate', count: 3 },
    ]);

    render(<ProfileSettings />, { wrapper: AppWrapper });

    await userEvent.type(
      await screen.findByLabelText('e.g. Proposal writer, open science'),
      'Grant writer',
    );
    await userEvent.type(screen.getByLabelText('Find a label to add'), 'clim');
    await userEvent.click(
      await screen.findByRole('button', { name: '#Climate' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(fetchMock.callHistory.called(URL, { method: 'PUT' })).toBe(true),
    );
    const body = JSON.parse(
      fetchMock.callHistory.lastCall(URL, { method: 'PUT' })?.options
        .body as string,
    );
    expect(body.headline).toBe('Grant writer');
    expect(body.interests).toEqual(['AI', 'Climate']);
    expect(body.visibility.email.level).toBe('platform');
  });

  test('interests: only labels already used', async () => {
    fetchMock.get(URL, me);
    fetchMock.get('begin:http://test.jest/api/v1.0/labels/?q=', []);

    render(<ProfileSettings />, { wrapper: AppWrapper });

    await userEvent.type(
      await screen.findByLabelText('Find a label to add'),
      'Brand new{Enter}',
    );

    expect(
      await screen.findByText(
        'No such label yet: interests are chosen among the labels already used on the platform.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('#Brand new')).not.toBeInTheDocument();
  });
});
