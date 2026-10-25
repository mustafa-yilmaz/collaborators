import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

/** A newcomer's registration, as platform managers see it. */
export interface Registration {
  id: string;
  full_name: string;
  email: string;
  /** Their identity provider vouches for the email */
  email_verified: boolean;
  status: 'pending' | 'declined';
  created_at: string;
}

export type RegistrationStatus = Registration['status'];

export const KEY_REGISTRATIONS = 'registrations';

export const useRegistrations = (status: RegistrationStatus, enabled = true) =>
  useQuery<Registration[], APIError>({
    queryKey: [KEY_REGISTRATIONS, status],
    queryFn: async () => {
      const response = await fetchAPI(`registrations/?status=${status}`);
      if (!response.ok) {
        throw new APIError(
          'Failed to get the registrations',
          await errorCauses(response),
        );
      }
      return response.json() as Promise<Registration[]>;
    },
    enabled,
  });

/** Approve or decline a registration; the newcomer is told by email. */
export const useDecideRegistration = () => {
  const queryClient = useQueryClient();
  return useMutation<
    Registration,
    APIError,
    { id: string; decision: 'approve' | 'decline' }
  >({
    mutationFn: async ({ id, decision }) => {
      const response = await fetchAPI(`registrations/${id}/${decision}/`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new APIError(
          'Failed to decide on the registration',
          await errorCauses(response),
        );
      }
      return response.json() as Promise<Registration>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [KEY_REGISTRATIONS] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({
        queryKey: ['notifications-unread-count'],
      });
    },
  });
};
