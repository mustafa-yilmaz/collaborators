import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { UserPicker } from '../UserPicker';

const API = 'http://test.jest/api/v1.0';

describe('UserPicker', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.get(`${API}/config/`, { API_USERS_SEARCH_QUERY_MIN_LENGTH: 3 });
  });

  test('an email finding nobody one may see is invited by email', async () => {
    fetchMock.get(`begin:${API}/users/`, []);
    const onInviteEmail = vi.fn();
    render(
      <UserPicker
        label="Add someone"
        onPick={vi.fn()}
        onInviteEmail={onInviteEmail}
      />,
      { wrapper: AppWrapper },
    );

    await userEvent.type(
      screen.getByLabelText('Add someone'),
      'New@Example.com',
    );
    await userEvent.click(
      await screen.findByRole('option', {
        name: 'Invite new@example.com by email',
      }),
    );

    expect(onInviteEmail).toHaveBeenCalledWith('new@example.com');
  });
});
