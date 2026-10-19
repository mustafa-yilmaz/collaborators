import { render, screen, within } from '@testing-library/react';
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
        { provider: 'google', connected: false, account: '' },
        { provider: 'microsoft', connected: true, account: 'a@example.com' },
        { provider: 'linkedin', connected: true, account: 'a@example.com' },
      ],
      has_password: false,
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
        { provider: 'google', connected: true, account: 'a@example.com' },
        { provider: 'microsoft', connected: false, account: '' },
      ],
      has_password: false,
    });

    render(<SignInMethods />, { wrapper: AppWrapper });

    const google = await screen.findByTestId('sign-in-method-google');
    expect(
      within(google).getByRole('button', { name: 'Disconnect' }),
    ).toBeDisabled();
    // only one connected: warned that the others would be separate accounts
    expect(screen.getByTestId('hint-connect-accounts')).toHaveTextContent(
      'Your other accounts are not connected yet',
    );
  });
});
