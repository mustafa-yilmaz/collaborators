import { useTranslation } from 'react-i18next';

import { PlatformRole } from '@/features/auth/api';

import { PlatformPerson } from './api';

/**
 * The names of the levels (one word each) and registration statuses, as the
 * screen says them.
 */
export const usePlatformWords = () => {
  const { t } = useTranslation();
  const levels: Record<PlatformRole, string> = {
    collaborator: t('Collaborator', {
      description: 'Platform level: anyone with an account',
    }),
    manager: t('Manager', {
      description: 'Platform level: approves registrations',
    }),
    administrator: t('Administrator', {
      description: 'Platform level: suspends and removes accounts',
    }),
    owner: t('Owner', {
      description: 'Platform level: appoints administrators and owners',
    }),
  };
  const statuses: Record<PlatformPerson['registration_status'], string> = {
    approved: t('Approved', { description: 'Registration status' }),
    pending: t('Waiting for approval', { description: 'Registration status' }),
    declined: t('Declined', { description: 'Registration status' }),
  };
  return { levels, statuses };
};
