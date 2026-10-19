import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, test } from 'vitest';

import { Doc } from '@/docs/doc-management';
import { AppWrapper } from '@/tests/utils';

import { WhoCanSee } from '../components/WhoCanSee';

const API = 'http://test.jest/api/v1.0';
const doc = { id: 'd-1', kind: 'space', depth: 1 } as unknown as Doc;

const state = (value: string) => ({
  value,
  link_role: 'reader',
  options: ['public', 'platform', 'workspace:w-1', 'invited'],
  workspaces: { 'workspace:w-1': 'Acme' },
  space: null,
  can_change: true,
});

describe('WhoCanSee', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  test('offers the choices and opens a space to its workspace', async () => {
    fetchMock.get(`${API}/documents/d-1/visibility/`, state('invited'));
    fetchMock.put(`${API}/documents/d-1/visibility/`, state('workspace:w-1'));

    render(<WhoCanSee doc={doc} />, { wrapper: AppWrapper });

    expect(await screen.findByText('Who can see this?')).toBeInTheDocument();
    for (const label of [
      'Public on the internet',
      'Everyone on Collaborators',
      'Members of Acme',
      'Only invited people',
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByLabelText('Only invited people')).toBeChecked();

    await userEvent.click(screen.getByLabelText('Members of Acme'));

    await waitFor(() =>
      expect(screen.getByLabelText('Members of Acme')).toBeChecked(),
    );
    expect(
      JSON.parse(
        fetchMock.callHistory.lastCall(`${API}/documents/d-1/visibility/`)
          ?.options.body as string,
      ),
    ).toEqual({ value: 'workspace:w-1', link_role: 'reader' });
  });
});
