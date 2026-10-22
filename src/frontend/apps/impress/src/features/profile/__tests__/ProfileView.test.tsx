import { render, screen, within } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import ProfilePage from '@/pages/profile';
import { AppWrapper } from '@/tests/utils';

const API = 'http://test.jest/api/v1.0';

vi.mock('next/router', async () => ({
  ...(await vi.importActual('next/router')),
  useRouter: () => ({
    query: { id: 'u-2' },
    push: vi.fn(),
    pathname: '/profile',
  }),
}));

describe('Profile view', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  test('names the pieces kept from the viewer, without their content', async () => {
    fetchMock.get(`${API}/profiles/u-2/`, {
      id: 'u-2',
      full_name: 'Ada Lovelace',
      is_me: false,
      headline: 'Grant writer',
      organization: '',
      location: '',
      bio: '',
      website: '',
      email: '',
      interests: [],
      hidden: ['email', 'location'],
      workspaces: [],
      spaces: [{ id: 's-1', title: 'Open space' }],
      pages: [],
    });

    render(<ProfilePage />, { wrapper: AppWrapper });

    const fields = await screen.findByTestId('profile-fields');
    expect(within(fields).getByText('Email')).toBeInTheDocument();
    expect(within(fields).getByText('Location')).toBeInTheDocument();
    expect(within(fields).getAllByText('Not shared with you')).toHaveLength(2);
    expect(within(fields).getByText('Grant writer')).toBeInTheDocument();
    // Visible but empty: not listed
    expect(within(fields).queryByText('Website')).not.toBeInTheDocument();
    expect(screen.getByText('Open space')).toBeInTheDocument();
  });

  test('ends with WorkSpaces, Spaces and Pages, even empty', async () => {
    fetchMock.get(`${API}/profiles/u-2/`, {
      id: 'u-2',
      full_name: 'Ada Lovelace',
      is_me: false,
      headline: '',
      organization: '',
      location: '',
      bio: '',
      website: '',
      email: '',
      interests: [],
      hidden: [],
      workspaces: [],
      spaces: [],
      pages: [],
    });

    render(<ProfilePage />, { wrapper: AppWrapper });

    const section = await screen.findByTestId('profile-collaborations');
    for (const heading of ['WorkSpaces', 'Spaces', 'Pages']) {
      expect(within(section).getByText(heading)).toBeInTheDocument();
    }
    expect(within(section).getAllByText('None to show')).toHaveLength(3);
  });
});
