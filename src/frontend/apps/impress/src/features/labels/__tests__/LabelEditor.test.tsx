import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, test } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { LabelEditor } from '../LabelEditor';

const API = 'http://test.jest/api/v1.0';
const URL = `${API}/documents/d-1/labels/`;

describe('LabelEditor', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  test('adds a suggested label and removes one', async () => {
    fetchMock.get(URL, { names: ['AI'], can_edit: true });
    fetchMock.get(`begin:${API}/labels/?q=`, [
      { name: 'AI', count: 4 },
      { name: 'Climate', count: 2 },
    ]);
    fetchMock.put(URL, { names: ['AI', 'Climate'], can_edit: true });

    render(<LabelEditor path="documents/d-1" />, { wrapper: AppWrapper });

    expect(await screen.findByText('#AI')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Add/ }));
    await userEvent.type(screen.getByLabelText('Add a label'), 'cli');
    // labels already there aren't suggested again
    await userEvent.click(await screen.findByText('#Climate'));

    await waitFor(() =>
      expect(
        JSON.parse(
          fetchMock.callHistory.lastCall(URL, { method: 'PUT' })?.options
            .body as string,
        ),
      ).toEqual({ names: ['AI', 'Climate'] }),
    );
    expect(await screen.findByTestId('label-Climate')).toBeInTheDocument();

    fetchMock.removeRoutes();
    fetchMock.put(URL, { names: ['Climate'], can_edit: true });
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove the label AI' }),
    );
    await waitFor(() =>
      expect(screen.queryByTestId('label-AI')).not.toBeInTheDocument(),
    );
  });

  test('readers see the labels without editing them', async () => {
    fetchMock.get(URL, { names: ['AI'], can_edit: false });

    render(<LabelEditor path="documents/d-1" />, { wrapper: AppWrapper });

    expect(await screen.findByText('#AI')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Add/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Remove the label AI' }),
    ).not.toBeInTheDocument();
  });
});
