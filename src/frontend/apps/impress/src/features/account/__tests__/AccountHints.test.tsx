import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { AccountHints } from '../AccountHints';
import { VISIT_GAP_MS, hideForThisVisit, touchVisit } from '../visit';

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
    window.localStorage.clear();
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.get(`${API}/users/me/`, { id: 'u-1', email: 'a@x.test' });
    fetchMock.get(`${API}/config/`, {
      COLLABORATORS_SIGNIN_PROVIDERS: ['google', 'microsoft', 'linkedin'],
    });
  });

  test('welcomes a new account first, until closed for this visit', async () => {
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
    // seen: the server remembers it, for the words of later visits
    expect(
      fetchMock.callHistory.called(`${API}/users/me/hints/`, {
        method: 'POST',
      }),
    ).toBe(true);
  });

  test('closed, the welcome stays hidden during the visit', async () => {
    fetchMock.get(`${API}/users/me/hints/`, { dismissed: ['welcome'] });
    fetchMock.get(`${API}/users/me/sign-in-methods/`, methods(['google']));
    hideForThisVisit('welcome');

    render(<AccountHints />, { wrapper: AppWrapper });

    expect(
      await screen.findByTestId('hint-connect-accounts'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('hint-welcome')).not.toBeInTheDocument();
  });

  test('the welcome comes back at the next visit, in returning words', async () => {
    fetchMock.get(`${API}/users/me/hints/`, { dismissed: ['welcome'] });
    fetchMock.get(`${API}/users/me/sign-in-methods/`, methods(['google']));
    // closed during a visit that ended (nobody there for longer than the gap)
    hideForThisVisit('welcome', Date.now() - VISIT_GAP_MS - 60_000);

    render(<AccountHints />, { wrapper: AppWrapper });

    const welcome = await screen.findByTestId('hint-welcome');
    expect(welcome).toHaveTextContent('Welcome back!');
    expect(welcome).toHaveTextContent(
      "You're signed in with the email address",
    );
    expect(welcome).toHaveTextContent('with the email address a@x.test.');
    expect(
      within(welcome).getByRole('button', { name: 'Close' }),
    ).toBeVisible();
  });

  test('suggests connecting only with a single provider connected', async () => {
    fetchMock.get(`${API}/users/me/hints/`, { dismissed: ['welcome'] });
    hideForThisVisit('welcome');
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
    touchVisit();
    hideForThisVisit('welcome');
    fetchMock.get(`${API}/users/me/sign-in-methods/`, methods(['google']));

    render(<AccountHints />, { wrapper: AppWrapper });

    const note = await screen.findByTestId('hint-connect-accounts');
    expect(
      within(note).queryByRole('button', { name: "Don't show again" }),
    ).not.toBeInTheDocument();
    expect(within(note).getByText('Sign-in methods')).toBeInTheDocument();
  });
});
