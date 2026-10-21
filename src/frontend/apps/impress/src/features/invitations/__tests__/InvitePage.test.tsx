import { render, screen } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import InvitePage from '@/pages/invite';
import { AppWrapper } from '@/tests/utils';

const API = 'http://test.jest/api/v1.0';

vi.mock('next/router', async () => ({
  ...(await vi.importActual('next/router')),
  useRouter: () => ({
    pathname: '/invite',
    query: { token: 'tok' },
    replace: vi.fn(),
  }),
}));

describe('Invite page', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.get(`${API}/config/`, {
      COLLABORATORS_SIGNIN_PROVIDERS: ['google', 'microsoft', 'linkedin'],
    });
    fetchMock.get(`${API}/invitations/tok/`, {
      kind: 'workspace',
      name: 'Acme',
      description: 'Rockets',
      issuer: 'Ada',
      email: 'new@example.com',
      has_logo: true,
      is_expired: false,
    });
  });

  test('signed out: what one is invited to, with its logo and the providers', async () => {
    fetchMock.get(`${API}/users/me/`, 401);

    render(<InvitePage />, { wrapper: AppWrapper });

    expect(
      await screen.findByRole('heading', { name: 'Acme' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Ada invited you to join the workspace'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('invitation-card').querySelector('img'),
    ).toHaveAttribute('src', `${API}/invitations/tok/logo/`);
    for (const provider of ['google', 'microsoft', 'linkedin']) {
      expect(screen.getByTestId(`invite-${provider}`)).toBeInTheDocument();
    }
  });

  test('signed in: one button accepts it', async () => {
    fetchMock.get(`${API}/users/me/`, {
      id: 'u-1',
      email: 'me@example.com',
      full_name: 'Me',
      registration_status: 'approved',
    });

    render(<InvitePage />, { wrapper: AppWrapper });

    expect(
      await screen.findByRole('button', { name: 'Accept and join' }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('invite-google')).not.toBeInTheDocument();
  });
});
