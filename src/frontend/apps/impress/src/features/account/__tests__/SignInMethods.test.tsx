import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, test } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { SignInMethods } from '../SignInMethods';

const METHODS_URL = 'http://test.jest/api/v1.0/users/me/sign-in-methods/';

describe('SignInMethods', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.get('http://test.jest/api/v1.0/config/', {});
  });

  test('shows each provider with its logo, connected or not', async () => {
    fetchMock.get(METHODS_URL, {
      methods: [
        {
          provider: 'google',
          connected: false,
          account: '',
          more_accounts: [],
          can_add_accounts: false,
        },
        {
          provider: 'microsoft',
          connected: true,
          account: 'a@example.com',
          more_accounts: [],
          can_add_accounts: false,
        },
        {
          provider: 'linkedin',
          connected: true,
          account: 'a@example.com',
          more_accounts: [],
          can_add_accounts: false,
        },
      ],
      has_password: false,
      notice: null,
    });

    render(<SignInMethods />, { wrapper: AppWrapper });

    const google = await screen.findByTestId('sign-in-method-google');
    expect(within(google).getByText('Not connected')).toBeInTheDocument();
    expect(
      within(google).getByRole('button', { name: /Connect/ }),
    ).toBeEnabled();
    expect(google.querySelector('svg')).not.toBeNull();

    const microsoft = screen.getByTestId('sign-in-method-microsoft');
    expect(
      within(microsoft).getByText('Connected: a@example.com'),
    ).toBeInTheDocument();
    expect(
      within(microsoft).getByRole('button', { name: 'Disconnect' }),
    ).toBeEnabled();
    // two connected: no warning
    expect(
      screen.queryByTestId('hint-connect-accounts'),
    ).not.toBeInTheDocument();
  });

  test('never offers to disconnect the only way in', async () => {
    fetchMock.get(METHODS_URL, {
      methods: [
        {
          provider: 'google',
          connected: true,
          account: 'a@example.com',
          more_accounts: [],
          can_add_accounts: false,
        },
        {
          provider: 'microsoft',
          connected: false,
          account: '',
          more_accounts: [],
          can_add_accounts: false,
        },
      ],
      has_password: false,
      notice: null,
    });

    render(<SignInMethods />, { wrapper: AppWrapper });

    const google = await screen.findByTestId('sign-in-method-google');
    expect(
      within(google).getByRole('button', { name: 'Disconnect' }),
    ).toBeDisabled();
    // only one connected: warned that the others would be separate accounts
    expect(screen.getByTestId('hint-connect-accounts')).toHaveTextContent(
      'Good to know: signing in with another account',
    );
  });

  test('lists more Google accounts, adds and disconnects them', async () => {
    fetchMock.get(METHODS_URL, {
      methods: [
        {
          provider: 'google',
          connected: true,
          account: 'a@gmail.com',
          more_accounts: [{ id: 'id-1', account: 'a@acme.org' }],
          can_add_accounts: true,
        },
      ],
      has_password: false,
      notice: { outcome: 'added', provider: 'google', account: 'a@acme.org' },
    });
    fetchMock.delete(`${METHODS_URL}google/accounts/id-1/`, 204);

    render(<SignInMethods />, { wrapper: AppWrapper });

    expect(
      await screen.findByText('a@acme.org now signs you in here too.'),
    ).toBeInTheDocument();
    const extra = screen.getByTestId('sign-in-account-id-1');
    expect(
      within(extra).getByText('Also connected: a@acme.org'),
    ).toBeInTheDocument();
    // two ways in: the first one can go too
    expect(
      within(screen.getByTestId('sign-in-method-google')).getAllByRole(
        'button',
        { name: 'Disconnect' },
      )[0],
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Add another Google account' }),
    ).toBeInTheDocument();

    await userEvent.click(
      within(extra).getByRole('button', { name: 'Disconnect' }),
    );
    await waitFor(() =>
      expect(
        fetchMock.callHistory.called(`${METHODS_URL}google/accounts/id-1/`),
      ).toBe(true),
    );
  });
});
