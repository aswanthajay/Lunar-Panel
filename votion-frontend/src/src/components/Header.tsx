import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { apiClient, ApiTask, ApiProxmoxConnectionOverview } from '../services/apiClient';
import { NotificationBell } from './NotificationBell';
import { GLOBAL_WORKSPACE_SCOPE, type WorkspaceScope } from '../workspaceScope';

interface WorkspaceLocation {
  id: string;
  name: string;
  status: string;
  vmCount: number;
  nodeCount?: number;
}

interface HeaderProps {
  currentView: string;
  onNavigate: (view: any) => void;
  userRole: 'admin' | 'client';
  canSwitchToAdmin: boolean;
  onToggleRole: () => void;
  onOpenModal: (modalName: string) => void;
  onOpenAlertRules?: () => void;
  onToggleMobileSidebar: () => void;
  workspaceScope: WorkspaceScope;
  onWorkspaceScopeChange: (scope: WorkspaceScope) => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  currentView,
  onNavigate, 
  userRole, 
  canSwitchToAdmin,
  onToggleRole,
  onOpenModal,
  onOpenAlertRules,
  onToggleMobileSidebar,
  workspaceScope,
  onWorkspaceScopeChange,
}) => {
  const [tasksOpen, setTasksOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [workspaceOptionsLoaded, setWorkspaceOptionsLoaded] = useState(false);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<ApiTask | null>(null);
  const [liveTasks, setLiveTasks] = useState<ApiTask[]>([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [currentUserName, setCurrentUserName] = useState('');
  const [locations, setLocations] = useState<WorkspaceLocation[]>([]);

  const menuRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (workspaceRef.current && !workspaceRef.current.contains(event.target as Node)) {
        setWorkspaceMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadWorkspaceLocations = async (): Promise<WorkspaceLocation[]> => {
    if (userRole === 'admin') {
      const [connections, fleetVms] = await Promise.all([
        apiClient.getProxmoxConnectionOverview().catch(() => [] as ApiProxmoxConnectionOverview[]),
        apiClient.getVMs().catch(() => []),
      ]);
      if (connections.length > 0) {
        return connections.map(connection => ({
          id: connection.id,
          name: connection.name,
          status: connection.status,
          vmCount: connection.vmCount,
          nodeCount: connection.nodeCount,
        }));
      }

      const locationsById = new Map<string, WorkspaceLocation>();
      fleetVms.forEach(vm => {
        if (!vm.proxmoxConnectionId) return;
        const existing = locationsById.get(vm.proxmoxConnectionId);
        locationsById.set(vm.proxmoxConnectionId, {
          id: vm.proxmoxConnectionId,
          name: vm.proxmoxConnectionName || 'Service location',
          status: 'available',
          vmCount: (existing?.vmCount || 0) + 1,
        });
      });
      return [...locationsById.values()];
    }

    const clientVms = await apiClient.getClientVMs().catch(() => []);
    const locationsById = new Map<string, WorkspaceLocation>();
    clientVms.forEach(vm => {
      if (!vm.proxmoxConnectionId) return;
      const existing = locationsById.get(vm.proxmoxConnectionId);
      locationsById.set(vm.proxmoxConnectionId, {
        id: vm.proxmoxConnectionId,
        name: vm.proxmoxConnectionName || 'Service location',
        status: 'available',
        vmCount: (existing?.vmCount || 0) + 1,
      });
    });
    return [...locationsById.values()];
  };

  // Load live user name, tasks, and role-appropriate scope inventory.
  useEffect(() => {
    setWorkspaceOptionsLoaded(false);
    const loadHeaderData = async () => {
      try {
        const [profile, tasks, workspaceLocations, supportTickets] = await Promise.all([
          apiClient.getUserProfile(),
          apiClient.getTasks(),
          loadWorkspaceLocations(),
          apiClient.getSupportTickets().catch(() => []),
        ]);
        if (profile) {
          setCurrentUserName(profile.name || profile.email || 'Account');
        }
        if (tasks) {
          setLiveTasks(tasks);
        }
        setLocations(workspaceLocations);
        setWorkspaceOptionsLoaded(true);
        setInboxCount(Array.isArray(supportTickets) ? supportTickets.filter(ticket => ticket.unread).length : 0);
      } catch {
        // Fallback: read from localStorage
        const email = apiClient.getUserEmail();
        setCurrentUserName(email.split('@')[0] || 'Account');
        setWorkspaceOptionsLoaded(true);
      }
    };
    loadHeaderData();
    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      loadHeaderData();
    }, 10000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadHeaderData();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userRole]);

  useEffect(() => {
    if (!workspaceOptionsLoaded || !workspaceScope.connectionId || locations.length === 0) return;
    if (!locations.some(location => location.id === workspaceScope.connectionId)) {
      onWorkspaceScopeChange(GLOBAL_WORKSPACE_SCOPE);
    }
  }, [locations, onWorkspaceScopeChange, workspaceOptionsLoaded, workspaceScope.connectionId]);

  const filteredLocations = locations.filter(loc => loc.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const runningTasks = liveTasks.filter(t => t.status === 'running');
  const activeBadgeCount = runningTasks.length;

  return (
    <header className={`app-header ${currentView === 'overview' ? 'header-overview-context' : ''}`}>
      <div className="header-left">
        <button type="button" className="mobile-menu-trigger" onClick={onToggleMobileSidebar} aria-label="Open navigation menu" title="Open navigation menu">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        {/* VOTION Box Logo */}
        <button 
          onClick={() => onNavigate('overview')}
          className="brand-logo cursor-pointer" 
          title="Votion One™ Platform"
        >
          <div className="theme-brand-logo border-[3px] border-[#1a1a1a] bg-white px-3 py-0.5 text-base font-extrabold lowercase tracking-tight flex items-center justify-center">votion</div>
        </button>

        {/* WORKSPACE / COMPANY SELECTOR DROPDOWN */}
        <div className="header-workspace-menu-wrap" ref={workspaceRef}>
          <button 
            onClick={() => {
              setWorkspaceMenuOpen(!workspaceMenuOpen);
              setUserMenuOpen(false);
              setTasksOpen(false);
              setNotificationsOpen(false);
            }}
            className="header-workspace-control flex items-center gap-2 border border-[#1a1a1a] rounded-lg px-3 py-1 bg-white hover:bg-[#f1f1f1] transition-all cursor-pointer font-semibold text-sm text-[#1a1a1a]"
            title="Select Workspace or Company"
          >
            <span>{workspaceScope.name}</span>
            <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
          </button>

          {workspaceMenuOpen && (
            <div className="workspace-dropdown-menu absolute left-0 top-10 w-72 bg-white border border-[#dedfdf] rounded-xl shadow-2xl p-3 z-[200] text-sm flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-100">
              <div>
                <input
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border border-[#2563eb] focus:border-[#2563eb] rounded-lg px-3 py-2 text-xs outline-none bg-white text-[#1a1a1a] placeholder-[#a7aaaa]"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-[#1a1a1a] px-2 py-1">Global</span>
                <button 
                  className={`block w-full text-left px-3 py-2 rounded text-xs transition-colors ${
                    workspaceScope.connectionId === null ? 'bg-[#f1f1f1] font-semibold text-[#1a1a1a]' : 'text-[#656b6b] hover:bg-[#f1f1f1] hover:text-[#1a1a1a]'
                  }`}
                  onClick={() => {
                    onWorkspaceScopeChange(GLOBAL_WORKSPACE_SCOPE);
                    setSearchQuery('');
                    setWorkspaceMenuOpen(false);
                  }}
                >
                  <span>Global</span>
                  <span className="mt-0.5 block text-[10px] font-normal text-[#8a9090]">All accessible infrastructure</span>
                  {workspaceScope.connectionId === null && <span className="ml-2 text-[#16a34a] font-bold">✓</span>}
                </button>
              </div>
              <div className="flex flex-col gap-1 border-t border-[#dedfdf] pt-2">
                <span className="text-xs font-bold text-[#1a1a1a] px-2 py-1">Service locations</span>
                {!workspaceOptionsLoaded ? (
                  <div className="px-2 py-2 text-xs text-[#a7aaaa]">Loading accessible locations…</div>
                ) : filteredLocations.length > 0 ? filteredLocations.map(loc => (
                  <button
                    key={loc.id}
                    onClick={() => {
                      onWorkspaceScopeChange({ connectionId: loc.id, name: loc.name });
                      setSearchQuery('');
                      setWorkspaceMenuOpen(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors cursor-pointer flex items-center justify-between ${
                      workspaceScope.connectionId === loc.id ? 'bg-[#f1f1f1] font-semibold text-[#1a1a1a]' : 'text-[#656b6b] hover:bg-[#f1f1f1] hover:text-[#1a1a1a]'
                    }`}
                  >
                    <span className="min-w-0"><span className="block truncate">{loc.name}</span><span className="mt-0.5 block text-[10px] font-normal text-[#8a9090]">{loc.vmCount} service{loc.vmCount === 1 ? '' : 's'}{loc.nodeCount !== undefined ? ` · ${loc.nodeCount} node${loc.nodeCount === 1 ? '' : 's'}` : ''}</span></span>
                    {workspaceScope.connectionId === loc.id && <span className="ml-2 text-[#10b981] font-bold">✓</span>}
                  </button>
                )) : (
                  <div className="px-2 py-2 text-xs text-[#a7aaaa]">
                    {userRole === 'admin' ? 'No cluster connections are configured yet.' : 'No service locations are assigned to this account.'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ADMIN vs CLIENT ROLE SWITCHER */}
        {canSwitchToAdmin && (
          <button 
            onClick={onToggleRole}
            className="header-role-switcher px-3 py-1.5 rounded-md text-[13px] font-semibold flex items-center gap-2 transition-colors border cursor-pointer bg-[#fbfaf9] text-[#1a1a1a] border-[#dedfdf] hover:bg-[#f1f1f1]"
            title={userRole === 'admin' ? 'Switch to client workspace' : 'Switch to administrator workspace'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3l4 4-4 4" />
              <path d="M3 7h18" />
              <path d="M7 21l-4-4 4-4" />
              <path d="M21 17H3" />
            </svg>
            <span>{userRole === 'admin' ? 'Switch to Client View' : 'Switch to Admin View'}</span>
          </button>
        )}
      </div>

      <div className="header-right relative" ref={menuRef}>
        {/* ALERT RULES MANAGEMENT — Admin only */}
        {userRole === 'admin' && onOpenAlertRules && (
          <button 
            onClick={onOpenAlertRules}
            className="header-alert-control cursor-pointer hidden md:inline-flex"
            title="Manage alert thresholds and notification rules"
            aria-label="Manage alert rules"
          >
            <SlidersHorizontal size={15} strokeWidth={1.8} aria-hidden="true" />
            <span>Alert Rules</span>
          </button>
        )}

        {/* NOTIFICATION BELL — live unread count from PostgreSQL */}
        <NotificationBell
          open={notificationsOpen}
          onToggle={() => {
            setNotificationsOpen(previous => !previous);
            setTasksOpen(false);
            setUserMenuOpen(false);
            setWorkspaceMenuOpen(false);
          }}
            onClose={() => setNotificationsOpen(false)}
          />

        {/* TASKS BUTTON — Live data from /api/v1/tasks */}
        <div className="header-task-menu-wrap">
          <button
            onClick={() => {
              setTasksOpen(!tasksOpen);
              setNotificationsOpen(false);
              setUserMenuOpen(false);
              setWorkspaceMenuOpen(false);
            }}
            className="header-task-control header-btn relative cursor-pointer"
          >
            <span>Tasks</span>
            {activeBadgeCount > 0 && <span className="task-count" aria-label={`${activeBadgeCount} active tasks`}>{activeBadgeCount > 9 ? '9+' : activeBadgeCount}</span>}
            <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
          </button>

          {/* Tasks Dropdown Drawer — Live tasks from PostgreSQL */}
          {tasksOpen && (
            <div className="tasks-dropdown-menu active">
              <div className="tasks-header">
                Active background tasks{liveTasks.length > 0 ? ` · ${liveTasks.length}` : ''}
              </div>

              {liveTasks.length === 0 ? (
                <div className="tasks-empty-state">
                  <span className="tasks-empty-mark" aria-hidden="true">✓</span>
                  <p>No active tasks</p>
                  <span>Background work will appear here.</span>
                </div>
              ) : (
                liveTasks.map(task => (
                  <div
                    key={task.id}
                    className="task-item cursor-pointer mt-2"
                    onClick={() => { setSelectedTaskDetail(task); setTasksOpen(false); }}
                  >
                    <div className="task-title-line">
                      <span>{task.name}</span>
                      <span className={`task-status-tag ${
                        task.status === 'completed' ? 'bg-[#dcfce7] text-[#15803d]' :
                        task.status === 'failed' ? 'bg-[#fef2f2] text-[#dc2626]' :
                        'bg-[#fef3c7] text-[#b45309]'
                      }`}>
                        {task.status === 'running' ? `${task.progressPct}%` : task.status}
                      </span>
                    </div>
                    <div className="task-progress-bar">
                      <div
                        className={`task-progress-fill ${
                          task.status === 'completed' ? 'bg-[#10b981]' :
                          task.status === 'failed' ? 'bg-[#ef4444]' : ''
                        }`}
                        style={{ width: `${task.progressPct || 0}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* DOWNLOADS BUTTON */}
        <button 
          onClick={() => onOpenModal('downloads')}
          className="header-secondary-control header-link cursor-pointer"
        >
          <span>Downloads</span>
        </button>

        {/* UPGRADE LINK */}
        <button 
          onClick={() => onOpenModal('upgrade')}
          className="header-secondary-control header-link cursor-pointer"
        >
          <span>Upgrade</span>
        </button>

        {/* USER PROFILE BUTTON — Live user name from PostgreSQL */}
        <div className="header-user-menu-wrap relative">
          <button 
            onClick={() => {
              setUserMenuOpen(!userMenuOpen);
              setTasksOpen(false);
              setNotificationsOpen(false);
              setWorkspaceMenuOpen(false);
            }}
            className={`header-user-trigger flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all cursor-pointer ${
              userMenuOpen 
                ? 'border-[#1a1a1a] bg-[#f1f1f1] text-[#1a1a1a]' 
                : 'border-transparent text-[#1a1a1a] hover:bg-[#f1f1f1]'
            }`}
          >
            <span>{currentUserName || apiClient.getUserEmail().split('@')[0]}</span>
            <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
          </button>

          {userMenuOpen && (
            <div className="header-user-menu absolute right-0 top-11 w-56 bg-white border border-[#dedfdf] rounded-lg shadow-xl py-2 z-[350] text-sm text-[#1a1a1a]">
              
              {canSwitchToAdmin && (
                <>
                  <button 
                    onClick={() => { onToggleRole(); setUserMenuOpen(false); }}
                    className="w-full text-left px-4 py-2 hover:bg-[#f1f1f1] transition-colors font-semibold text-[#2563eb] flex items-center justify-between cursor-pointer"
                    title={userRole === 'admin' ? 'Open the client workspace' : 'Open the administrator workspace'}
                  >
                    <span>{userRole === 'admin' ? 'Switch to Client View' : 'Switch to Admin View'}</span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17 3l4 4-4 4" />
                      <path d="M3 7h18" />
                      <path d="M7 21l-4-4 4-4" />
                      <path d="M21 17H3" />
                    </svg>
                  </button>

                  <div className="my-1 border-t border-[#dedfdf]"></div>
                </>
              )}

              <button 
                onClick={() => { onNavigate('user-settings'); setUserMenuOpen(false); }}
                className="w-full text-left px-4 py-2 hover:bg-[#f1f1f1] transition-colors cursor-pointer"
              >
                User settings
              </button>

              {userRole === 'admin' && (
                <button 
                  onClick={() => { onNavigate('system-settings'); setUserMenuOpen(false); }}
                  className="w-full text-left px-4 py-2 hover:bg-[#f1f1f1] transition-colors cursor-pointer"
                >
                  System settings
                </button>
              )}

              {/* Inbox — opens the dedicated ticket workspace */}
              <button 
                onClick={() => { onNavigate('support'); setUserMenuOpen(false); }}
                className="w-full text-left px-4 py-2 hover:bg-[#f1f1f1] transition-colors flex items-center gap-2 cursor-pointer"
              >
                <span>Inbox</span>
                <span className="bg-[#2563eb] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {inboxCount}
                </span>
              </button>

              <button 
                onClick={() => { onOpenModal('dataroom'); setUserMenuOpen(false); }}
                className="w-full text-left px-4 py-2 hover:bg-[#f1f1f1] transition-colors cursor-pointer"
              >
                Data room
              </button>

              <button 
                onClick={() => { onNavigate('support'); setUserMenuOpen(false); }}
                className="w-full text-left px-4 py-2 hover:bg-[#f1f1f1] transition-colors flex items-center justify-between cursor-pointer"
              >
                <span>{userRole === 'admin' ? 'Ticket management' : 'Support tickets'}</span>
                {inboxCount > 0 && (
                  <span className="bg-[#2563eb] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {inboxCount}
                  </span>
                )}
              </button>

              <button 
                onClick={() => { onOpenModal('help'); setUserMenuOpen(false); }}
                className="w-full text-left px-4 py-2 hover:bg-[#f1f1f1] transition-colors cursor-pointer"
              >
                VOTION Help
              </button>

              <button 
                onClick={() => { onOpenModal('pricing'); setUserMenuOpen(false); }}
                className="w-full text-left px-4 py-2 hover:bg-[#f1f1f1] transition-colors cursor-pointer"
              >
                Plans and pricing
              </button>

              <button 
                onClick={() => { onOpenModal('release-notes'); setUserMenuOpen(false); }}
                className="w-full text-left px-4 py-2 hover:bg-[#f1f1f1] transition-colors cursor-pointer"
              >
                Release notes
              </button>

              <a
                href="/legal/terms"
                className="block w-full px-4 py-2 text-left hover:bg-[#f1f1f1] transition-colors"
              >
                Terms and privacy
              </a>

              {/* Log out — clears session */}
              <button 
                onClick={() => {
                  localStorage.removeItem('votion_jwt_token');
                  localStorage.removeItem('votion_user_email');
                  localStorage.removeItem('votion_user_role');
                  setUserMenuOpen(false);
                  onNavigate('login');
                }}
                className="w-full text-left px-4 py-2 hover:bg-[#f1f1f1] transition-colors font-medium text-[#dc2626] cursor-pointer"
              >
                Log out
              </button>

            </div>
          )}
        </div>
      </div>

      {/* TASK DETAIL DRAWER MODAL — Live PostgreSQL task data */}
      {selectedTaskDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1500] flex items-center justify-center p-6">
          <div className="w-full max-w-[480px] bg-white border border-[#dedfdf] rounded-xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#dedfdf] pb-3">
              <h3 className="text-base font-bold text-[#1a1a1a]">{selectedTaskDetail.name}</h3>
              <button onClick={() => setSelectedTaskDetail(null)} className="text-[#656b6b] font-bold cursor-pointer">✕</button>
            </div>
            <div className="bg-[#fbfaf9] border border-[#dedfdf] rounded-lg p-3 text-xs flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[#656b6b]">Region</span>
                <span className="font-mono font-bold text-[#1a1a1a]">{selectedTaskDetail.node}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#656b6b]">Status</span>
                <span className={`font-bold uppercase text-[11px] px-2 py-0.5 rounded ${
                  selectedTaskDetail.status === 'completed' ? 'bg-[#dcfce7] text-[#15803d]' :
                  selectedTaskDetail.status === 'failed' ? 'bg-[#fef2f2] text-[#dc2626]' :
                  'bg-[#fef3c7] text-[#b45309]'
                }`}>
                  {selectedTaskDetail.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#656b6b]">Progress</span>
                <span className="font-mono font-bold text-[#1a1a1a]">{selectedTaskDetail.progressPct}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#656b6b]">Started</span>
                <span className="font-mono text-[#1a1a1a]">{new Date(selectedTaskDetail.startTime).toLocaleString()}</span>
              </div>
              {/* Progress Bar */}
              <div className="mt-1 w-full bg-[#dedfdf] rounded-full h-1.5">
                <div 
                  className={`h-1.5 rounded-full ${
                    selectedTaskDetail.status === 'completed' ? 'bg-[#10b981]' :
                    selectedTaskDetail.status === 'failed' ? 'bg-[#ef4444]' : 'bg-[#f59e0b]'
                  }`}
                  style={{ width: `${selectedTaskDetail.progressPct}%` }}
                ></div>
              </div>
            </div>
            <div className="flex items-center justify-end pt-2">
              <button onClick={() => setSelectedTaskDetail(null)} className="btn-primary">Close Details</button>
            </div>
          </div>
        </div>
      )}

    </header>
  );
};
