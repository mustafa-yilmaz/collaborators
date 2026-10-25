import { useTranslation } from 'react-i18next';

import { PlatformRole } from '@/features/auth/api';

import { PlatformPerson, ReportReason } from './api';

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

/** Why a page is reported, as the screen says it. */
export const useReportReasons = () => {
  const { t } = useTranslation();
  const reasons: Record<ReportReason, string> = {
    spam: t('Spam or advertising', { description: 'Reason of a report' }),
    abuse: t('Abuse or harassment', { description: 'Reason of a report' }),
    illegal: t('Illegal content', { description: 'Reason of a report' }),
    personal_data: t('Someone’s personal data', {
      description: 'Reason of a report',
    }),
    copyright: t('Copyright infringement', {
      description: 'Reason of a report',
    }),
    other: t('Something else', { description: 'Reason of a report' }),
  };
  return reasons;
};
