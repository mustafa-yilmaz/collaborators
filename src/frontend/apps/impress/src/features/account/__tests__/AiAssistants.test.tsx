import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, test } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { AiAssistants } from '../AiAssistants';

const API = 'http://test.jest/api/v1.0';

const approval = (fields: object) => ({
  client_id: 'c-1',
  name: 'Claude',
  connected: true,
  approved_at: 1792900000000,
  last_used_at: null,
  ...fields,
});

describe('AI assistants on the sign-in methods page', () => {
  beforeEach(() => {
    fetchMock.hardReset();
    fetchMock.mockGlobal();
  });

  test('the three, each with its status, and who pays', async () => {
    fetchMock.get(`${API}/users/me/assistants/`, {
      mcp_url: 'https://collaborators.community/mcp',
      tools: [
        { id: 'claude', name: 'Claude', approvals: [approval({})] },
        { id: 'chatgpt', name: 'ChatGPT', approvals: [] },
        {
          id: 'gemini',
          name: 'Gemini',
          approvals: [approval({ client_id: 'c-2', connected: false })],
        },
      ],
      others: [],
    });
    render(<AiAssistants />, { wrapper: AppWrapper });

    expect(await screen.findByTestId('ai-Claude')).toHaveTextContent(
      'Connected',
    );
    expect(screen.getByTestId('ai-ChatGPT')).toHaveTextContent('Not connected');
    expect(screen.getByTestId('ai-Gemini')).toHaveTextContent('Not in use');
    expect(
      screen.getByText(/Collaborators neither charges nor pays for it/),
    ).toBeInTheDocument();
  });

  test('connecting shows the address and where to paste it', async () => {
    fetchMock.get(`${API}/users/me/assistants/`, {
      mcp_url: 'https://collaborators.community/mcp',
      tools: [{ id: 'chatgpt', name: 'ChatGPT', approvals: [] }],
      others: [],
    });
    render(<AiAssistants />, { wrapper: AppWrapper });

    fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));

    expect(
      screen.getByText('https://collaborators.community/mcp'),
    ).toBeInTheDocument();
    expect(screen.getByText(/In ChatGPT: Settings/)).toBeInTheDocument();
  });

  test('disconnecting withdraws every approval of the assistant', async () => {
    fetchMock.get(`${API}/users/me/assistants/`, {
      mcp_url: 'https://collaborators.community/mcp',
      tools: [
        {
          id: 'claude',
          name: 'Claude',
          approvals: [approval({}), approval({ client_id: 'c-9' })],
        },
      ],
      others: [],
    });
    fetchMock.delete(`begin:${API}/users/me/assistants/`, 204);
    render(<AiAssistants />, { wrapper: AppWrapper });

    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));

    await waitFor(() =>
      expect(
        fetchMock.callHistory.called(`${API}/users/me/assistants/c-9/`),
      ).toBe(true),
    );
    expect(
      fetchMock.callHistory.called(`${API}/users/me/assistants/c-1/`),
    ).toBe(true);
  });
});
