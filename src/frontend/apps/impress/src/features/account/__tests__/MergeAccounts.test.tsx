import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, test } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { MergeAccounts } from '../MergeAccounts';

const API = 'http://test.jest/api/v1.0';

describe('Merging another account of one’s own', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.get(`${API}/config/`, {
      COLLABORATORS_SIGNIN_PROVIDERS: ['google', 'microsoft', 'linkedin'],
    });
  });

  test('one signs in with the other account to start', async () => {
    fetchMock.get(`${API}/users/me/merge/`, { proposal: null, notice: null });
    render(<MergeAccounts />, { wrapper: AppWrapper });

    expect(
      await screen.findByText('Merge another account of yours'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Sign in with the other account (LinkedIn)',
      }),
    ).toBeInTheDocument();
  });

  test('a merge waiting is shown, then confirmed', async () => {
    fetchMock.get(`${API}/users/me/merge/`, {
      proposal: {
        id: 'u-2',
        full_name: 'Ada Work',
        email: 'ada@work.example',
        pages: 3,
        shared_with_it: 2,
        workspaces: 1,
        groups: 0,
      },
      notice: null,
    });
    fetchMock.post(`${API}/users/me/merge/`, { merged: 'Ada Work' });
    render(<MergeAccounts />, { wrapper: AppWrapper });

    const proposal = await screen.findByTestId('merge-proposal');
    expect(proposal).toHaveTextContent(
      'Merge Ada Work (ada@work.example) into this account?',
    );
    expect(proposal).toHaveTextContent(
      'Pages it owns: 3 · shared with it: 2 · workspaces: 1 · groups: 0.',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Merge into this account' }),
    );

    await waitFor(() =>
      expect(
        fetchMock.callHistory
          .calls()
          .some(
            (call) =>
              call.url === `${API}/users/me/merge/` &&
              call.options.method?.toUpperCase() === 'POST',
          ),
      ).toBe(true),
    );
  });

  test('why nothing was proposed is said', async () => {
    fetchMock.get(`${API}/users/me/merge/`, {
      proposal: null,
      notice: {
        outcome: 'no_account',
        account: 'new@example.org',
        provider: 'google',
      },
    });
    render(<MergeAccounts />, { wrapper: AppWrapper });

    expect(
      await screen.findByText(/new@example.org opens no other Collaborators/),
    ).toBeInTheDocument();
  });
});
