export type WorkspaceScope = {
  connectionId: string | null;
  name: string;
};

export const GLOBAL_WORKSPACE_SCOPE: WorkspaceScope = {
  connectionId: null,
  name: 'Global',
};

const STORAGE_KEY = 'votion_workspace_scope';

export function readWorkspaceScope(): WorkspaceScope {
  try {
    const rawValue = localStorage.getItem(STORAGE_KEY);
    if (!rawValue) return GLOBAL_WORKSPACE_SCOPE;

    const parsedValue = JSON.parse(rawValue) as Partial<WorkspaceScope>;
    if (typeof parsedValue.name !== 'string') return GLOBAL_WORKSPACE_SCOPE;

    return {
      connectionId: typeof parsedValue.connectionId === 'string' && parsedValue.connectionId.trim()
        ? parsedValue.connectionId.trim()
        : null,
      name: parsedValue.name.trim() || GLOBAL_WORKSPACE_SCOPE.name,
    };
  } catch {
    return GLOBAL_WORKSPACE_SCOPE;
  }
}

export function saveWorkspaceScope(scope: WorkspaceScope): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scope));
}
