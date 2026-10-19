import dynamic from 'next/dynamic';

import { Loading } from '@/components';

/** The wiki reader, loaded in the browser only, like the editor it uses. */
export const LazyWikiView = dynamic(
  () =>
    import('./WikiView').then((mod) => ({
      default: mod.WikiView,
    })),
  { ssr: false, loading: () => <Loading $height="100vh" /> },
);
