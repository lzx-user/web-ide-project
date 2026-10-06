export const WORKSPACE_ROLES = ['owner', 'editor', 'viewer'] as const;

export type WorkspaceRole = typeof WORKSPACE_ROLES[number];

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return typeof value === 'string' && WORKSPACE_ROLES.includes(value as WorkspaceRole);
}

export function canEditWorkspace(role: WorkspaceRole): boolean {
  return role === 'owner' || role === 'editor';
}
