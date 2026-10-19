import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { AccountHints } from '../AccountHints';

vi.mock('next/router', async () => ({
  ...(await vi.importActual('next/router')),
  useRouter: () => ({ pathname: '/', replace: vi.fn() }),
}));

const API = 'http://test.jest/api/v1.0';

const methods = (connected: string[]) => ({
  methods: ['google', 'microsoft', 'linkedin'].map((provider) => ({
    provider,
    connected: connected.includes(provider),
    account: '',
  })),
  has_password: false,
});

describe('AccountHints', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.get(`${API}/users/me/`, { id: 'u-1', email: 'a@x.test' });
    fetchMock.get(`${API}/config/`, {
      COLLABORATORS_SIGNIN_PROVIDERS: ['google', 'microsoft', 'linkedin'],
    });
  });

  test('welcomes a new account first, until closed', async () => {
    fetchMock.get(`${API}/users/me/hints/`, { dismissed: [] });
    fetchMock.post(`${API}/users/me/hints/`, { dismissed: ['welcome'] });
    fetchMock.get(`${API}/users/me/sign-in-methods/`, methods(['google']));

    render(<AccountHints />, { wrapper: AppWrapper });

    expect(await screen.findByTestId('hint-welcome')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));

    // then the suggestion to connect another account
    expect(
      await screen.findByTestId('hint-connect-accounts'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('hint-welcome')).not.toBeInTheDocument();
  });

  test('suggests connecting only with a single provider connected', async () => {
    fetchMock.get(`${API}/users/me/hints/`, { dismissed: ['welcome'] });
    fetchMock.get(
      `${API}/users/me/sign-in-methods/`,
      methods(['google', 'linkedin']),
    );

    render(<AccountHints />, { wrapper: AppWrapper });

    await waitFor(() =>
      expect(
        fetchMock.callHistory.called(`${API}/users/me/sign-in-methods/`),
      ).toBe(true),
    );
    expect(
      screen.queryByTestId('hint-connect-accounts'),
    ).not.toBeInTheDocument();
  });

  test('the note about other accounts stays until one is connected', async () => {
    // closed for good before it lost its close button: shown all the same
    fetchMock.get(`${API}/users/me/hints/`, {
      dismissed: ['welcome', 'connect-accounts'],
    });
    fetchMock.get(`${API}/users/me/sign-in-methods/`, methods(['google']));

    render(<AccountHints />, { wrapper: AppWrapper });

    const note = await screen.findByTestId('hint-connect-accounts');
    expect(
      within(note).queryByRole('button', { name: "Don't show again" }),
    ).not.toBeInTheDocument();
    expect(within(note).getByText('Sign-in methods')).toBeInTheDocument();
  });
});
