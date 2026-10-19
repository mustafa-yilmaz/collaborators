import { User } from '@/features/auth';
import { Doc } from '@/features/docs/doc-management';

export enum WorkspaceRole {
  MEMBER = 'member',
  ADMIN = 'administrator',
  OWNER = 'owner',
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string;
  user_role: WorkspaceRole | null;
  abilities: {
    destroy: boolean;
    manage_accesses: boolean;
    manage_groups: boolean;
    partial_update: boolean;
    retrieve: boolean;
    spaces_create: boolean;
    update: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface WorkspaceAccess {
  id: string;
  user: User;
  role: WorkspaceRole;
  created_at: string;
}

export enum GroupKind {
  TEAM = 'team',
  ORGANIZATION = 'organization',
}

export interface Group {
  id: string;
  workspace: string;
  name: string;
  kind: GroupKind;
  description: string;
  team: string;
  nb_members: number;
  abilities: {
    destroy: boolean;
    manage_members: boolean;
    partial_update: boolean;
    retrieve: boolean;
    update: boolean;
  };
  created_at: string;
}

export interface GroupMembership {
  id: string;
  user: User;
  is_manager: boolean;
  created_at: string;
}

export interface LinkedWorkspace {
  id: string;
  name: string;
  slug: string;
  is_home: boolean;
}

export type Space = Doc & {
  linked_workspaces: LinkedWorkspace[];
};

export enum SpaceVisibility {
  PUBLIC = 'public',
  WORKSPACE = 'workspace',
  INVITED = 'invited',
}

/** A group, or all members of a workspace, that a role can be granted to. */
export interface GrantableTeam {
  team: string;
  label: string;
  kind: 'workspace' | GroupKind;
  workspace: { id: string; name: string };
  member_count: number;
}

export interface WorkspaceGrant {
  team: string;
  label: string;
  role: string;
}
