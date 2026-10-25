import {
  Button,
  Checkbox,
  Input,
  Modal,
  ModalSize,
  Radio,
  RadioGroup,
  TextArea,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/ui-components';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';
import { useDebounce } from 'use-debounce';

import { Box, Loading, Text } from '@/components';
import { PlatformRole, hasPlatformLevel, useAuth } from '@/features/auth';

import {
  PlatformPerson,
  SignInServerOutcome,
  useAppointPerson,
  usePlatformPeople,
  useRemovalPreview,
  useRemovePerson,
  useSuspendPerson,
} from './api';
import { usePlatformWords } from './words';

const errorCss = css`
  color: var(--c--contextuals--content--semantic--error--primary);
`;

/** A toast saying it is done, and whether the sign-in server followed. */
export const useOutcomeToast = () => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  return (done: string, outcome: SignInServerOutcome) => {
    if (outcome === 'failed' || outcome === 'not configured') {
      toast(
        `${done} ${t(
          'The sign-in server could not be updated: change the account there too.',
          {
            description: 'The account changed here, not at the sign-in server',
          },
        )}`,
        VariantType.WARNING,
      );
      return;
    }
    toast(done, VariantType.SUCCESS);
  };
};

const Dialog = ({
  title,
  onClose,
  confirm,
  children,
}: {
  title: string;
  onClose: () => void;
  confirm: ReactNode;
  children: ReactNode;
}) => {
  const { t } = useTranslation();
  return (
    <Modal
      isOpen
      closeOnClickOutside
      onClose={onClose}
      size={ModalSize.MEDIUM}
      title={
        <Text as="h1" $margin="0" $size="h6" $align="flex-start">
          {title}
        </Text>
      }
      rightActions={
        <>
          <Button variant="secondary" fullWidth autoFocus onClick={onClose}>
            {t('Cancel', {
              description: 'Button to dismiss a dialog without confirming',
            })}
          </Button>
          {confirm}
        </>
      }
    >
      <Box $gap="sm">{children}</Box>
    </Modal>
  );
};

const reasonLabel = (t: ReturnType<typeof useTranslation>['t']) =>
  t('Reason (optional, included in the email to them)', {
    description: 'Label of the reason given when suspending or removing',
  });

/** Suspend someone: signed out at once, until reinstated. */
export const SuspendDialog = ({
  person,
  onClose,
}: {
  person: PlatformPerson;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const suspend = useSuspendPerson();
  const outcomeToast = useOutcomeToast();
  const name = person.full_name || person.email;

  return (
    <Dialog
      title={t('Suspend {{name}}?', {
        description: 'Title of the dialog suspending an account',
        name,
      })}
      onClose={onClose}
      confirm={
        <Button
          color="error"
          fullWidth
          disabled={suspend.isPending}
          onClick={() =>
            suspend.mutate(
              { id: person.id, reason },
              {
                onSuccess: ({ sign_in_server }) => {
                  outcomeToast(
                    t('{{name}} is suspended.', {
                      description: 'Toast after suspending an account',
                      name,
                    }),
                    sign_in_server,
                  );
                  onClose();
                },
              },
            )
          }
        >
          {t('Suspend', { description: 'Button suspending an account' })}
        </Button>
      }
    >
      <Text $variation="secondary">
        {t(
          'They are signed out at once and can’t sign in until reinstated. Their pages stay as they are. They are told by email.',
          { description: 'Explanation in the dialog suspending an account' },
        )}
      </Text>
      <TextArea
        label={reasonLabel(t)}
        value={reason}
        maxLength={500}
        rows={3}
        onChange={(event) => setReason(event.target.value)}
      />
      {suspend.error && (
        <Text $size="sm" $css={errorCss}>
          {suspend.error.cause?.[0]}
        </Text>
      )}
    </Dialog>
  );
};

/** Choose who receives the pages: the viewer at first. */
const RecipientPicker = ({
  excludeId,
  recipient,
  onChange,
}: {
  excludeId: string;
  recipient: { id: string; name: string } | null;
  onChange: (recipient: { id: string; name: string }) => void;
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [debounced] = useDebounce(query.trim(), 250);
  const { data } = usePlatformPeople({
    q: debounced,
    role: '',
    status: 'approved',
    account: 'active',
  });
  const matches = debounced
    ? (data?.pages[0]?.results ?? [])
        .filter((person) => person.id !== excludeId)
        .slice(0, 5)
    : [];

  return (
    <Box $gap="2xs" $margin={{ left: '1.6rem' }} $css="align-self: stretch;">
      {recipient && (
        <Text $size="sm">
          {t('To: {{name}}', {
            description: 'Who receives the pages of a removed account',
            name: recipient.name,
          })}
        </Text>
      )}
      <Input
        fullWidth
        label={t('Someone else', {
          description: 'Search of another person to receive the pages',
        })}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {matches.map((person) => (
        <Button
          key={person.id}
          size="small"
          variant="tertiary"
          color="neutral"
          onClick={() => {
            onChange({
              id: person.id,
              name: person.full_name || person.email,
            });
            setQuery('');
          }}
        >
          {`${person.full_name || person.email} · ${person.email}`}
        </Button>
      ))}
    </Box>
  );
};

/** Remove someone: from the platform and the sign-in server, for good. */
export const RemoveDialog = ({
  person,
  onClose,
}: {
  person: PlatformPerson;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isOwner = hasPlatformLevel(user, 'owner');
  const name = person.full_name || person.email;
  const { data: preview, isLoading } = useRemovalPreview(person.id);
  const remove = useRemovePerson();
  const outcomeToast = useOutcomeToast();
  const [pages, setPages] = useState<'hand_over' | 'delete'>('hand_over');
  const [recipient, setRecipient] = useState<{
    id: string;
    name: string;
  } | null>(
    user
      ? {
          id: user.id,
          name: t('you', { description: 'The viewer, receiving pages' }),
        }
      : null,
  );
  const [reason, setReason] = useState('');
  const [block, setBlock] = useState(false);
  const ownsAlone =
    !!preview && (preview.pages_count > 0 || preview.workspaces.length > 0);
  const titles = (preview?.pages ?? [])
    .map(
      (page) =>
        page.title ||
        t('Untitled page', { description: 'A page without title' }),
    )
    .join(', ');

  return (
    <Dialog
      title={t('Remove {{name}}’s account?', {
        description: 'Title of the dialog removing an account',
        name,
      })}
      onClose={onClose}
      confirm={
        <Button
          color="error"
          fullWidth
          disabled={
            remove.isPending ||
            isLoading ||
            (pages === 'hand_over' && !recipient)
          }
          onClick={() =>
            remove.mutate(
              {
                id: person.id,
                pages,
                recipient: pages === 'hand_over' ? recipient?.id : undefined,
                reason,
                block,
              },
              {
                onSuccess: ({ sign_in_server }) => {
                  outcomeToast(
                    t('{{name}}’s account is removed.', {
                      description: 'Toast after removing an account',
                      name,
                    }),
                    sign_in_server,
                  );
                  onClose();
                },
              },
            )
          }
        >
          {t('Remove the account', {
            description: 'Button removing an account',
          })}
        </Button>
      }
    >
      <Text $variation="secondary">
        {t(
          'Their account is deleted from Collaborators and from the sign-in server; this can’t be undone. They are told by email.',
          { description: 'Explanation in the dialog removing an account' },
        )}
      </Text>
      {isLoading && <Loading />}
      {preview && !ownsAlone && (
        <Text $size="sm">
          {t('Nothing is left without an owner: they own nothing alone.', {
            description: 'A removed account owning nothing alone',
          })}
        </Text>
      )}
      {preview && ownsAlone && (
        <Box $gap="2xs">
          {preview.pages_count > 0 && (
            <Text $size="sm">
              {preview.pages_count === 1
                ? t(
                    'They alone own 1 page ({{total}} with the pages below it): {{titles}}',
                    {
                      description: 'The page a removed account owns alone',
                      total: preview.pages_with_subpages,
                      titles,
                    },
                  )
                : t(
                    'They alone own {{number}} pages ({{total}} with the pages below them): {{titles}}',
                    {
                      description: 'The pages a removed account owns alone',
                      number: preview.pages_count,
                      total: preview.pages_with_subpages,
                      titles,
                    },
                  )}
            </Text>
          )}
          {preview.workspaces.length > 0 && (
            <Text $size="sm">
              {t('They alone own these workspaces: {{names}}', {
                description: 'The workspaces a removed account owns alone',
                names: preview.workspaces
                  .map((workspace) => workspace.name)
                  .join(', '),
              })}
            </Text>
          )}
          <RadioGroup>
            <Radio
              name={`pages-${person.id}`}
              value="hand_over"
              checked={pages === 'hand_over'}
              onChange={() => setPages('hand_over')}
              label={t('Hand them over', {
                description: 'Choice: someone receives the pages',
              })}
            />
            {pages === 'hand_over' && (
              <RecipientPicker
                excludeId={person.id}
                recipient={recipient}
                onChange={setRecipient}
              />
            )}
            <Radio
              name={`pages-${person.id}`}
              value="delete"
              checked={pages === 'delete'}
              onChange={() => setPages('delete')}
              label={t(
                'Delete their pages for good, with the pages below them',
                {
                  description: 'Choice: the pages are deleted',
                },
              )}
            />
          </RadioGroup>
          {preview.workspaces.length > 0 && (
            <Text $size="xs" $variation="secondary">
              {t(
                'Workspaces are never deleted: they go to whoever receives the pages, or else to their next administrator or member, or else to you.',
                { description: 'What becomes of the workspaces' },
              )}
            </Text>
          )}
        </Box>
      )}
      <TextArea
        label={reasonLabel(t)}
        value={reason}
        maxLength={500}
        rows={3}
        onChange={(event) => setReason(event.target.value)}
      />
      {isOwner && (
        <Checkbox
          label={t('Also block {{email}}, so it can’t sign in again', {
            description: 'Checkbox blocking the email of a removed account',
            email: person.email,
          })}
          checked={block}
          onChange={(event) => setBlock(event.target.checked)}
        />
      )}
      {remove.error && (
        <Text $size="sm" $css={errorCss}>
          {remove.error.cause?.[0]}
        </Text>
      )}
    </Dialog>
  );
};

/** Give someone another level: those one may give, each explained. */
export const LevelDialog = ({
  person,
  onClose,
}: {
  person: PlatformPerson;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { levels } = usePlatformWords();
  const appoint = useAppointPerson();
  const [role, setRole] = useState<PlatformRole>(person.platform_role);
  const name = person.full_name || person.email;
  const help: Record<PlatformRole, string> = {
    collaborator: t('Anyone with an account.', {
      description: 'What the collaborator level does',
    }),
    manager: t('Approves new registrations and sees everyone.', {
      description: 'What the manager level does',
    }),
    administrator: t(
      'Also suspends and removes accounts, and appoints managers.',
      { description: 'What the administrator level does' },
    ),
    owner: t(
      'Also appoints administrators and owners, blocks emails, and has full rights in the admin site.',
      { description: 'What the owner level does' },
    ),
  };

  return (
    <Dialog
      title={t('Change {{name}}’s level', {
        description: 'Title of the dialog changing someone’s level',
        name,
      })}
      onClose={onClose}
      confirm={
        <Button
          fullWidth
          disabled={appoint.isPending || role === person.platform_role}
          onClick={() =>
            appoint.mutate(
              { id: person.id, role },
              {
                onSuccess: () => {
                  toast(
                    t('{{name}} is now: {{level}}.', {
                      description: 'Toast after changing someone’s level',
                      name,
                      level: levels[role],
                    }),
                    VariantType.SUCCESS,
                  );
                  onClose();
                },
              },
            )
          }
        >
          {t('Change the level', {
            description: 'Button confirming a new level',
          })}
        </Button>
      }
    >
      <Text $variation="secondary">
        {t(
          'Each level has the rights of the levels below it. They are told by email.',
          {
            description: 'Explanation in the dialog changing someone’s level',
          },
        )}
      </Text>
      <RadioGroup>
        {person.levels_you_may_give.map((level) => (
          <Box key={level} $gap="4xs">
            <Radio
              name={`level-${person.id}`}
              value={level}
              checked={role === level}
              onChange={() => setRole(level)}
              label={levels[level]}
            />
            <Text
              $size="xs"
              $variation="secondary"
              $margin={{ left: '1.6rem' }}
            >
              {help[level]}
            </Text>
          </Box>
        ))}
      </RadioGroup>
      {appoint.error && (
        <Text $size="sm" $css={errorCss}>
          {appoint.error.cause?.[0]}
        </Text>
      )}
    </Dialog>
  );
};
