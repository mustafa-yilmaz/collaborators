import { render, screen } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { SignIn } from '../SignIn';

vi.mock('next/router', async () => ({
  ...(await vi.importActual('next/router')),
  useRouter: () => ({
    pathname: '/signin',
    replace: vi.fn(),
  }),
}));

describe('SignIn', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    fetchMock.get('http://test.jest/api/v1.0/users/me/', 401);
    fetchMock.get('http://test.jest/api/v1.0/config/', {
      COLLABORATORS_SIGNIN_PROVIDERS: ['google', 'microsoft', 'linkedin'],
    });
  });

  test('shows each provider with its own logo', async () => {
    render(<SignIn />, { wrapper: AppWrapper });

    for (const [provider, name] of [
      ['google', 'Google'],
      ['microsoft', 'Microsoft'],
      ['linkedin', 'LinkedIn'],
    ]) {
      const button = await screen.findByTestId(`signin-${provider}`);
      expect(button).toHaveTextContent(`Continue with ${name}`);
      expect(button.querySelector('svg')).not.toBeNull();
    }
    expect(screen.queryByTestId('signin-password')).not.toBeInTheDocument();
  });
});
