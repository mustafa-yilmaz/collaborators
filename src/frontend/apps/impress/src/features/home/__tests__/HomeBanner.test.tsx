import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import LegalNotice from '@/pages/legal-notice';
import { AppWrapper } from '@/tests/utils';

import HomeBanner, {
  COLLABORATORS_REPOSITORY_URL,
} from '../components/HomeBanner';

vi.mock('@/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core')>()),
  useConfig: () => ({ data: {} }),
}));

describe('Contributing and credits', () => {
  it('invites people to build Collaborators on GitHub or report an issue', () => {
    render(<HomeBanner />, { wrapper: AppWrapper });
    expect(
      screen.getByRole('link', { name: 'help build it on GitHub' }),
    ).toHaveAttribute('href', COLLABORATORS_REPOSITORY_URL);
    expect(
      screen.getByRole('link', { name: 'report an issue' }),
    ).toHaveAttribute('href', `${COLLABORATORS_REPOSITORY_URL}/issues`);
  });

  it('credits Docs by La Suite Numérique and BlockNote by TypeCellOS', () => {
    render(<LegalNotice />, { wrapper: AppWrapper });
    // The Software paragraph (the footer credits Docs too)
    const software = within(
      screen.getByText(/is built on open-source software/).closest('p')!,
    );
    const href = (name: string) =>
      software.getByRole('link', { name }).getAttribute('href');
    expect(href('Docs')).toBe('https://github.com/suitenumerique/docs');
    expect(href('La Suite Numérique')).toBe(
      'https://github.com/suitenumerique',
    );
    expect(href('BlockNote')).toBe('https://github.com/TypeCellOS/BlockNote');
    expect(href('TypeCellOS')).toBe('https://github.com/TypeCellOS');
  });
});
