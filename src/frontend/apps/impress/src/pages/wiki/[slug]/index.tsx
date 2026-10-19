import { useRouter } from 'next/router';

import { LazyWikiView } from '@/features/publishing/wiki/LazyWikiView';
import { NextPageWithLayout } from '@/types/next';

/** /wiki/<slug>: the home page of a public wiki. */
const Page: NextPageWithLayout = () => {
  const { query } = useRouter();
  return typeof query.slug === 'string' ? (
    <LazyWikiView slug={query.slug} />
  ) : null;
};

export default Page;
