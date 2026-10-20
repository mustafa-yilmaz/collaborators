import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, test } from 'vitest';

import { User } from '@/features/auth/api';
import { AppWrapper } from '@/tests/utils';

import { RegistrationList } from '../RegistrationList';
import { RegistrationWaiting } from '../RegistrationWaiting';

const API = 'http://test.jest/api/v1.0';

const newcomer: User = {
  id: 'u-1',
  email: 'nina@example.org',
  full_name: 'Nina New',
  short_name: 'Nina',
  is_first_connection: true,
  registration_status: 'pending',
};

describe('Registrations', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  test('a newcomer waits, told they will get an email', () => {
    render(<RegistrationWaiting user={newcomer} />, { wrapper: AppWrapper });

    expect(
      screen.getByText('Your registration is waiting for approval'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('registration-waiting')).toHaveTextContent(
      'nina@example.org',
    );
    expect(screen.getByRole('button', { name: /Check again/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Sign out/ })).toBeVisible();
  });

  test('a declined newcomer is told, without waiting', () => {
    render(
      <RegistrationWaiting
        user={{ ...newcomer, registration_status: 'declined' }}
      />,
      { wrapper: AppWrapper },
    );

    expect(
      screen.getByText('Your registration was not accepted'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Check again/ })).toBeNull();
  });

  test('administrators approve a waiting registration', async () => {
    fetchMock.get(`${API}/registrations/?status=pending`, [
      {
        id: 'u-1',
        full_name: 'Nina New',
        email: 'nina@example.org',
        email_verified: true,
        status: 'pending',
        created_at: '2026-10-20T08:00:00Z',
      },
    ]);
    fetchMock.post(`${API}/registrations/u-1/approve/`, {
      id: 'u-1',
      status: 'approved',
    });

    render(<RegistrationList />, { wrapper: AppWrapper });

    const row = await screen.findByTestId('registration-u-1');
    expect(row).toHaveTextContent('Nina New');
    expect(row).toHaveTextContent('email verified by their provider');
    expect(screen.getByRole('button', { name: 'Decline' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() =>
      expect(
        fetchMock.callHistory.called(`${API}/registrations/u-1/approve/`),
      ).toBe(true),
    );
  });
});
