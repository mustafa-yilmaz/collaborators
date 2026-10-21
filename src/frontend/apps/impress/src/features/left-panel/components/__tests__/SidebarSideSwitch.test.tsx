import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, test } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { useSidebarSideStore } from '../../stores';
import { SidebarSideSwitch } from '../SidebarSideSwitch';

describe('SidebarSideSwitch', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
    // Signed in: the server keeps the side
    fetchMock.get('http://test.jest/api/v1.0/users/me/', {
      id: 'u-1',
      email: 'ada@example.com',
    });
    fetchMock.get('http://test.jest/api/v1.0/dashboard/sidebar/side/', {
      side: 'left',
    });
    fetchMock.put('http://test.jest/api/v1.0/dashboard/sidebar/side/', {
      side: 'right',
    });
    useSidebarSideStore.setState({ side: 'left' });
  });

  test('moves the panel to the right and back', async () => {
    render(<SidebarSideSwitch />, { wrapper: AppWrapper });

    const toggle = screen.getByRole('switch', { name: 'Sidebar on the right' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveAttribute('title', 'Move the sidebar to the right');

    await userEvent.click(toggle);

    expect(useSidebarSideStore.getState().side).toBe('right');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toHaveAttribute('title', 'Move the sidebar to the left');

    await userEvent.click(toggle);

    expect(useSidebarSideStore.getState().side).toBe('left');
  });
});
