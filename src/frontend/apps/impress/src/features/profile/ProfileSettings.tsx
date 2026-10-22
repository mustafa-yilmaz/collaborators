import {
  Button,
  Checkbox,
  Input,
  Select,
  TextArea,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/ui-components';
import { ReactNode, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, Loading, StyledLink, Text } from '@/components';
import { Title } from '@/components/Title';
import { useLabelSuggestions } from '@/features/labels/api';
import { BRAND_NAME } from '@/features/people/BrandName';

import {
  Audience,
  AudienceSetting,
  MyProfile,
  ProfileField,
  Reach,
  profileHref,
  useMyProfile,
} from './api';

type Visibility = Record<ProfileField, AudienceSetting>;

const fieldCss = css`
  border-top: 1px solid var(--c--contextuals--border--surface--primary);
  padding-top: var(--c--globals--spacings--sm);
`;

/** Who sees one piece of the profile. */
const AudiencePicker = ({
  field,
  setting,
  profile,
  onChange,
}: {
  field: ProfileField;
  setting: AudienceSetting;
  profile: MyProfile;
  onChange: (setting: AudienceSetting) => void;
}) => {
  const { t } = useTranslation();
  const options: { value: Audience; label: string }[] = [
    {
      value: 'public',
      label: t('Public on the internet', {
        description: 'Visibility: anyone, even without an account',
      }),
    },
    {
      value: 'platform',
      label: t('Everyone on {{brand}}', {
        description: 'Visibility: every signed-in collaborator',
        brand: BRAND_NAME,
      }),
    },
    {
      value: 'colleagues',
      label: t('People I work with on {{brand}}', {
        description: 'Visibility: people sharing a workspace or page',
        brand: BRAND_NAME,
      }),
    },
    {
      value: 'selected',
      label: t('Chosen workspaces and spaces', {
        description: 'Visibility: members of chosen workspaces and spaces',
      }),
    },
  ];
  const toggle = (key: 'workspaces' | 'spaces', id: string, on: boolean) =>
    onChange({
      ...setting,
      [key]: on
        ? [...setting[key], id]
        : setting[key].filter((other) => other !== id),
    });

  return (
    <Box $gap="2xs">
      <Select
        fullWidth
        label={t('Who sees it', {
          description: 'Label choosing who sees a piece of a profile',
        })}
        clearable={false}
        options={options}
        value={setting.level}
        onChange={(event) =>
          onChange({ ...setting, level: event.target.value as Audience })
        }
      />
      {setting.level === 'selected' && (
        <Box $gap="3xs" $padding={{ left: 'xs' }}>
          {profile.workspace_choices.map((workspace) => (
            <Checkbox
              key={workspace.id}
              label={workspace.name}
              checked={setting.workspaces.includes(workspace.id)}
              onChange={(event) =>
                toggle('workspaces', workspace.id, event.target.checked)
              }
            />
          ))}
          {profile.space_choices.map((space) => (
            <Checkbox
              key={space.id}
              label={`${space.title || '—'} (${t('space', {
                description: 'Kind of a chosen audience',
              })})`}
              checked={setting.spaces.includes(space.id)}
              onChange={(event) =>
                toggle('spaces', space.id, event.target.checked)
              }
            />
          ))}
          {field === 'name' && (
            <Text $size="xs" $variation="secondary">
              {t('People you work with always see your name.', {
                description: 'Rule: a profile cannot be fully hidden',
              })}
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
};

const Field = ({
  title,
  children,
  picker,
  note,
}: {
  title: ReactNode;
  children?: ReactNode;
  /** The audience of the piece, in the right column */
  picker?: ReactNode;
  /** Explanations under both columns */
  note?: ReactNode;
}) => (
  <Box $gap="xs" $css={fieldCss}>
    <Text $weight="700" $size="sm">
      {title}
    </Text>
    {/* Two columns: the piece, and who sees it (an empty one keeps it half) */}
    <Box
      $direction="row"
      $gap="sm"
      $css="flex-wrap: wrap; & > * { flex: 1 1 260px; }"
    >
      <Box $gap="2xs">{children}</Box>
      <Box>{picker}</Box>
    </Box>
    {note}
  </Box>
);

/** One's profile: each piece, and who sees it. */
export const ProfileSettings = () => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { query, update } = useMyProfile();
  const profile = query.data;
  const [text, setText] = useState({
    headline: '',
    organization: '',
    location: '',
    bio: '',
    website: '',
  });
  const [interests, setInterests] = useState<string[]>([]);
  const [interest, setInterest] = useState('');
  const { data: suggestions = [] } = useLabelSuggestions(
    interest.trim().replace(/^#/, ''),
    !!interest.trim(),
  );
  const [visibility, setVisibility] = useState<Visibility>();
  const [reach, setReach] = useState<Reach>('colleagues');

  useEffect(() => {
    if (profile) {
      setText({
        headline: profile.headline,
        organization: profile.organization,
        location: profile.location,
        bio: profile.bio,
        website: profile.website,
      });
      setInterests(profile.interests);
      setVisibility(profile.visibility);
      setReach(profile.reach ?? 'colleagues');
    }
  }, [profile]);

  if (!profile || !visibility) {
    return <Loading />;
  }

  const picker = (field: ProfileField) => (
    <AudiencePicker
      field={field}
      setting={visibility[field]}
      profile={profile}
      onChange={(setting) => setVisibility({ ...visibility, [field]: setting })}
    />
  );
  const input = (key: keyof typeof text, label: string) => (
    <Input
      fullWidth
      label={label}
      value={text[key]}
      onChange={(event) => setText({ ...text, [key]: event.target.value })}
    />
  );
  // Collaborators: interests are labels already used on the platform
  const addInterest = (name: string) => {
    if (
      !interests.some((other) => other.toLowerCase() === name.toLowerCase())
    ) {
      setInterests([...interests, name]);
    }
    setInterest('');
  };
  const labelChoices = suggestions.filter(
    (item) =>
      !interests.some(
        (other) => other.toLowerCase() === item.name.toLowerCase(),
      ),
  );

  return (
    <Box $gap="sm" data-testid="profile-settings">
      <Text $variation="secondary">
        {t(
          'Choose who sees each piece of your profile. Your name is always shown to the people you work with.',
          { description: 'Introduction of the profile settings' },
        )}{' '}
        <StyledLink href={profileHref(profile.id)}>
          <Text as="span" $theme="brand">
            {t('See my profile', {
              description: 'Link to one’s own profile page',
            })}
          </Text>
        </StyledLink>
      </Text>
      <Field
        title={t('Who can find me and invite me', {
          description: 'Profile setting: who may find someone',
        })}
        note={
          <Text $size="xs" $variation="secondary">
            {t(
              'Others find you by name (to share with you, to invite you, in My Collaborators) only if you share something, unless you open it wider. It also limits who sees each piece below. Anyone can still invite your email address.',
              { description: 'Explanation of the reach of a profile' },
            )}
          </Text>
        }
      >
        <Select
          fullWidth
          label={t('Who can find me', {
            description: 'Label of the reach choice of a profile',
          })}
          clearable={false}
          options={[
            {
              value: 'colleagues',
              label: t('People I share a workspace, space or page with', {
                description: 'Reach: only the people one works with',
              }),
            },
            {
              value: 'platform',
              label: t('Everyone on {{brand}}', {
                description: 'Reach: every signed-in collaborator',
                brand: BRAND_NAME,
              }),
            },
            {
              value: 'public',
              label: t('Public on the internet', {
                description: 'Reach: anyone, even without an account',
              }),
            },
          ]}
          value={reach}
          onChange={(event) => setReach(event.target.value as Reach)}
        />
      </Field>
      <Field
        title={t('Name', { description: 'Profile field: the name' })}
        picker={picker('name')}
      >
        <Input
          fullWidth
          label={t('Name', { description: 'Profile field: the name' })}
          value={profile.full_name}
          disabled
          text={t('From the account you sign in with.', {
            description: 'Help of the read-only name of a profile',
          })}
        />
      </Field>
      <Field
        title={t('Email', { description: 'Profile field' })}
        picker={picker('email')}
      >
        <Input
          fullWidth
          label={t('Email', { description: 'Profile field' })}
          value={profile.email}
          disabled
          text={t('The address you sign in with: it can’t be changed here.', {
            description: 'Help of the read-only email of a profile',
          })}
        />
      </Field>
      <Field
        title={t('Website', { description: 'Profile field' })}
        picker={picker('website')}
      >
        {input('website', 'https://…')}
      </Field>
      <Field
        title={
          <Trans
            i18nKey="Interests (labels in <brand/>)"
            tOptions={{ description: 'Heading of profile interests' }}
            components={{
              brand: <Title as="span" $size="1em" $display="inline" />,
            }}
          />
        }
        picker={picker('interests')}
      >
        <Box $direction="row" $gap="2xs" $css="flex-wrap: wrap;">
          {interests.map((name) => (
            <Box
              key={name}
              $direction="row"
              $align="center"
              $gap="4xs"
              $padding={{ left: 'xs', right: '3xs', vertical: '4xs' }}
              $css="border-radius: 999px; background: var(--c--contextuals--background--semantic--contextual--primary);"
            >
              <Text $size="xs" $theme="brand">
                #{name}
              </Text>
              <BoxButton
                aria-label={t('Remove the label {{name}}', {
                  description: 'Button removing a label',
                  name,
                })}
                $padding="4xs"
                onClick={() =>
                  setInterests(interests.filter((other) => other !== name))
                }
              >
                <Icon iconName="close" $size="14px" $variation="secondary" />
              </BoxButton>
            </Box>
          ))}
        </Box>
        <Input
          fullWidth
          label={t('Find a label to add', {
            description: 'Label of the field adding a profile interest',
          })}
          value={interest}
          onChange={(event) => setInterest(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              const typed = interest.trim().replace(/^#/, '').toLowerCase();
              const match =
                labelChoices.find(
                  (item) => item.name.toLowerCase() === typed,
                ) ?? labelChoices[0];
              if (match) {
                addInterest(match.name);
              }
            }
          }}
        />
        {interest.trim() && (
          <Box $direction="row" $gap="2xs" $css="flex-wrap: wrap;">
            {labelChoices.map((item) => (
              <BoxButton
                key={item.name}
                onClick={() => addInterest(item.name)}
                $padding={{ horizontal: 'xs', vertical: '4xs' }}
                $css="border-radius: 999px; border: 1px solid var(--c--contextuals--border--surface--primary);"
              >
                <Text $size="xs" $theme="brand">
                  #{item.name}
                </Text>
              </BoxButton>
            ))}
            {!labelChoices.length && (
              <Text $size="xs" $variation="secondary">
                {t(
                  'No such label yet: interests are chosen among the labels already used on the platform.',
                  { description: 'Profile interests: no matching label' },
                )}
              </Text>
            )}
          </Box>
        )}
      </Field>
      <Field
        title={t('Headline', { description: 'Profile field' })}
        picker={picker('headline')}
      >
        {input(
          'headline',
          t('e.g. Grant writer, open science', {
            description: 'Placeholder of the profile headline',
          }),
        )}
      </Field>
      <Field
        title={t('Organisation', { description: 'Profile field' })}
        picker={picker('organization')}
      >
        {input(
          'organization',
          t('Organisation', { description: 'Profile field' }),
        )}
      </Field>
      <Field
        title={t('Location', { description: 'Profile field' })}
        picker={picker('location')}
      >
        {input('location', t('City, country', { description: 'Location' }))}
      </Field>
      <Field
        title={t('About', { description: 'Profile field: biography' })}
        picker={picker('bio')}
      >
        <TextArea
          label={t('A few words about you', {
            description: 'Label of the profile biography',
          })}
          value={text.bio}
          maxLength={2000}
          rows={4}
          onChange={(event) => setText({ ...text, bio: event.target.value })}
        />
      </Field>
      <Box $direction="row" $justify="flex-end" $css={fieldCss}>
        <Button
          disabled={update.isPending}
          onClick={() =>
            update.mutate(
              { ...text, interests, visibility, reach },
              {
                onSuccess: () =>
                  toast(
                    t('Your profile is saved.', {
                      description: 'Toast after saving the profile',
                    }),
                    VariantType.SUCCESS,
                  ),
                onError: (error) =>
                  toast(
                    error.cause?.[0] ??
                      t('Something went wrong.', {
                        description: 'Generic error message',
                      }),
                    VariantType.ERROR,
                  ),
              },
            )
          }
        >
          {t('Save', { description: 'Button saving a change' })}
        </Button>
      </Box>
    </Box>
  );
};
