import { useRouter } from 'next/router';

import { LazyWikiView } from '@/features/publishing/wiki/LazyWikiView';
import { NextPageWithLayout } from '@/types/next';

/** /wiki/<slug>/<page id>: a page of a public wiki. */
const Page: NextPageWithLayout = () => {
  const { query } = useRouter();
  return typeof query.slug === 'string' && typeof query.pageId === 'string' ? (
    <LazyWikiView slug={query.slug} pageId={query.pageId} />
  ) : null;
};

export default Page;
