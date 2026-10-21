import { render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { SearchResults } from '../SearchResults';
import { SearchResult } from '../api';

vi.mock('next/router', async () => ({
  ...(await vi.importActual('next/router')),
  useRouter: () => ({ push: vi.fn(), pathname: '/' }),
}));

const doc = (id: string, title: string, kind: 'page' | 'space' = 'page') => ({
  id,
  title,
  kind,
  context: '',
  snippet: '',
  updated_at: '2026-10-21T08:00:00Z',
});

const result: SearchResult = {
  q: 'plan',
  involved: {
    workspaces: [
      { id: 'w-1', name: 'Planning', slug: 'planning', description: '' },
    ],
    spaces: [],
    pages: [doc('p-1', 'Launch plan')],
    labels: ['plan'],
  },
  visible: {
    workspaces: [
      { id: 'w-2', name: 'Open plans', slug: 'open', description: '' },
    ],
    spaces: [doc('s-1', 'Plans', 'space')],
    pages: [],
    labels: [],
  },
};

describe('SearchResults', () => {
  test('groups what one is part of, then what is open to them', () => {
    render(<SearchResults result={result} />, { wrapper: AppWrapper });

    const yours = screen.getByTestId('search-involved');
    const visible = screen.getByTestId('search-visible');
    expect(within(yours).getByText('Yours')).toBeVisible();
    expect(within(yours).getByText('Planning')).toBeVisible();
    expect(within(yours).getByText('Launch plan')).toBeVisible();
    expect(within(yours).getByText('#plan')).toBeVisible();
    expect(within(visible).getByText('Visible to you')).toBeVisible();
    expect(within(visible).getByText('Open plans')).toBeVisible();
    expect(within(visible).getByText('Plans')).toBeVisible();
    // Groups come in that order
    expect(
      yours.compareDocumentPosition(visible) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test('shows the workspaces one may join as the screen asks', () => {
    render(
      <SearchResults
        result={result}
        renderVisibleWorkspace={(workspace) => (
          <li key={workspace.id}>Card of {workspace.name}</li>
        )}
      />,
      { wrapper: AppWrapper },
    );

    expect(screen.getByText('Card of Open plans')).toBeVisible();
    // Those one is part of stay rows
    expect(screen.queryByText('Card of Planning')).toBeNull();
  });

  test('says when nothing is found', () => {
    const empty = { workspaces: [], spaces: [], pages: [], labels: [] };
    render(
      <SearchResults result={{ q: 'zz', involved: empty, visible: empty }} />,
      { wrapper: AppWrapper },
    );

    expect(screen.getByText('Nothing found for “zz”.')).toBeVisible();
  });
});
