import { Box, SCREEN_MAX_WIDTH, Text } from '@/components';
import { DocDefaultFilter, useTrans } from '@/features/docs/doc-management';
import { DocsGrid } from '@/features/docs/docs-grid';
import { LabelsOverview } from '@/features/labels/LabelsOverview';
import { ForMeList } from '@/features/notifications/ForMeList';
import { useResponsiveStore } from '@/stores/useResponsiveStore';

import { CollaborationsList } from './CollaborationsList';
import { CollaborationsView } from './api';

const VIEWS: Partial<Record<DocDefaultFilter, CollaborationsView>> = {
  [DocDefaultFilter.ALL_DOCS]: 'recent',
  [DocDefaultFilter.MY_DOCS]: 'owned',
  [DocDefaultFilter.SHARED_WITH_ME]: 'shared',
  [DocDefaultFilter.STARRED]: 'starred',
};

/**
 * What a list of "My collaborations" in the left panel shows: workspaces,
 * spaces and pages; everything for me; the labels; or the trash.
 */
export const CollaborationsScreen = ({
  target,
}: {
  target: DocDefaultFilter;
}) => {
  const { transFilter } = useTrans();
  const { isMobile } = useResponsiveStore();
  const view = VIEWS[target];

  if (target === DocDefaultFilter.TRASHBIN) {
    return <DocsGrid target={target} />;
  }

  return (
    <Box
      $width="100%"
      $maxWidth={SCREEN_MAX_WIDTH}
      $margin={{ horizontal: 'auto' }}
      $padding={{ horizontal: isMobile ? 'sm' : 'lg', vertical: 'lg' }}
      $gap="md"
      $css="overflow-y: auto;"
    >
      <Text as="h1" $size="h4" $margin="none">
        {transFilter(target)}
      </Text>
      {view && <CollaborationsList view={view} />}
      {target === DocDefaultFilter.NOTIFICATIONS && <ForMeList full />}
      {target === DocDefaultFilter.LABELS && <LabelsOverview />}
    </Box>
  );
};
