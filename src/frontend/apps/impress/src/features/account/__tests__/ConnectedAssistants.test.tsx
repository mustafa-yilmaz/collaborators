import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, test } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { ConnectedAssistants } from '../ConnectedAssistants';

const API = 'http://test.jest/api/v1.0';

describe('Connected assistants', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  test('the address to connect, the steps and who pays', async () => {
    fetchMock.get(`${API}/users/me/assistants/`, {
      mcp_url: 'https://collaborators.community/mcp',
      assistants: [],
    });
    render(<ConnectedAssistants />, { wrapper: AppWrapper });

    expect(await screen.findByTestId('mcp-url')).toHaveTextContent(
      'https://collaborators.community/mcp',
    );
    for (const name of ['Claude', 'ChatGPT', 'Gemini']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(
      screen.getByText(/Collaborators neither charges nor pays for it/),
    ).toBeInTheDocument();
    expect(screen.getByText('No assistant connected yet.')).toBeInTheDocument();
  });

  test('a connected assistant is disconnected', async () => {
    fetchMock.get(`${API}/users/me/assistants/`, {
      mcp_url: 'https://collaborators.community/mcp',
      assistants: [
        {
          client_id: 'abc-123',
          name: 'Claude',
          approved_at: 1792900000000,
          last_updated_at: null,
        },
      ],
    });
    fetchMock.delete(`${API}/users/me/assistants/abc-123/`, 204);
    render(<ConnectedAssistants />, { wrapper: AppWrapper });

    const row = await screen.findByTestId('assistant-abc-123');
    expect(row).toHaveTextContent('Approved on');
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

    await waitFor(() =>
      expect(
        fetchMock.callHistory.called(`${API}/users/me/assistants/abc-123/`),
      ).toBe(true),
    );
  });
});
