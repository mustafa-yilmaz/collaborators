import { Button } from '@gouvfr-lasuite/ui-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components';
import { hasPlatformLevel, useAuth } from '@/features/auth';
import { PeopleDirectory } from '@/features/people/PeopleDirectory';

import { ManageCollaborators } from './ManageCollaborators';

/**
 * Collaborators: the screen of "My CO✍️✍️ABORATORS" (its heading spells the
 * logo; the tabs are plain words). Platform managers and the levels above
 * them also find "Manage Collaborators" there: everyone on the platform.
 */
export const CollaboratorsTabs = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tab, setTab] = useState<'mine' | 'manage'>('mine');

  if (!hasPlatformLevel(user, 'manager')) {
    return <PeopleDirectory />;
  }

  return (
    <Box $gap="md">
      <Box $direction="row" $gap="xs" role="tablist">
        <Button
          size="small"
          role="tab"
          aria-selected={tab === 'mine'}
          variant={tab === 'mine' ? 'primary' : 'tertiary'}
          onClick={() => setTab('mine')}
        >
          {t('My Collaborators', {
            description: 'Tab of the people one works with',
          })}
        </Button>
        <Button
          size="small"
          role="tab"
          aria-selected={tab === 'manage'}
          variant={tab === 'manage' ? 'primary' : 'tertiary'}
          onClick={() => setTab('manage')}
        >
          {t('Manage Collaborators', {
            description:
              'Tab listing everyone on the platform, for platform managers',
          })}
        </Button>
      </Box>
      {tab === 'mine' ? <PeopleDirectory /> : <ManageCollaborators />}
    </Box>
  );
};
