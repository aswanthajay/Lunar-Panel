/**
 * Production API Client for Lunar Panel
 * Connects the Vite React frontend to the Express backend through the deployment-aware API base URL.
 * with automated retries, JWT authorization header injection, and persistent database store.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export interface ApiNode {
  id?: string;
  node: string;
  nodeName?: string;
  ip?: string;
  ipAddress?: string;
  status: 'online' | 'offline' | 'maintenance';
  cpuUsagePct: number;
  cpuCores?: number;
  ramUsageBytes: number;
  ramTotalBytes: number;
  storageUsageGb?: number;
  storageTotalGb?: number;
  rootUsedGb?: number;
  rootTotalGb?: number;
  uptimeSeconds: number;
  platformVersion: string;
  zfsHealth?: string;
  zfsPoolStatus?: string;
}

export interface ApiClusterOverview {
  clusterStatus: {
    clusterName: string;
    totalNodes: number;
    onlineNodes: number;
    status: string;
  };
  totalNodes: number;
  totalCpuPct: number;
  totalCpuCores?: number;
  totalRamUsedGb: number;
  totalRamMaxGb: number;
  totalStorageUsedGb?: number;
  totalStorageTotalGb?: number;
  totalVMsCount: number;
  runningVMsCount: number;
  suspendedVMsCount: number;
  zfsPoolStatus: string;
}

export interface ApiVM {
  /** Stable identity: connection ID + node + VMID. VMID alone is not globally unique. */
  vmKey?: string;
  vmid: number;
  name: string;
  type: 'qemu' | 'lxc';
  node: string;
  nodeDisplayName?: string | null;
  displayNode?: string | null;
  displayCpuModel?: string | null;
  proxmoxConnectionId?: string | null;
  proxmoxConnectionName?: string | null;
  ownerEmail: string;
  status: 'running' | 'stopped' | 'paused';
  cpus: number;
  memory: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime: number;
  ipAddress?: string;
  macAddress?: string | null;
  cpuUsagePct?: number;
  ramUsageBytes?: number;
  diskUsageBytes?: number;
  netInBytes?: number;
  netOutBytes?: number;
  diskReadBytes?: number;
  diskWriteBytes?: number;
  live?: {
    cpuPct?: number;
    memUsedMb?: number;
    netInBytes?: number;
    netOutBytes?: number;
  };
  os?: string;
  expiryDate?: string;
  isSuspended?: boolean;
  createdAt?: string;
}

export interface ApiVmMetadata {
  network: {
    source: 'cloud-init' | 'guest-agent' | 'proxmox-config' | 'unavailable';
    primaryIp: string | null;
    configuredIp: string | null;
    gateway: string | null;
    macAddress: string | null;
    interfaces: Array<{
      name: string;
      macAddress: string | null;
      bridge: string | null;
      ipAddress: string | null;
      gateway: string | null;
      source: 'cloud-init' | 'guest-agent' | 'proxmox-config';
    }>;
    guestAgentAvailable: boolean;
  };
  hardware: {
    type: 'qemu' | 'lxc';
    vcpus: number | null;
    sockets: number | null;
    coresPerSocket: number | null;
    memoryMb: number | null;
    ballooning: boolean | null;
    machine: string | null;
    bios: string | null;
    cpuType: string | null;
    bootOrder: string | null;
    disks: Array<{ device: string; storage: string | null; sizeGb: number | null }>;
    networkAdapters: number;
    qemuGuestAgent: boolean | null;
    osType: string | null;
    features: string[];
  };
  fetchedAt: string;
}

export interface ApiNavigationUsage {
  key: string;
  type: 'destination' | 'vm';
  vmid: number | null;
  name: string | null;
  status: string | null;
  node?: string | null;
  proxmoxConnectionId?: string | null;
  proxmoxConnectionName?: string | null;
  usageCount: number;
  lastUsedAt: string;
}

export type ApiTeamAccessScope = 'readonly' | 'power' | 'full';

export interface ApiTeamAccessMember {
  id: number;
  vmid: number;
  userEmail: string;
  userName?: string | null;
  scope: ApiTeamAccessScope;
  invitedBy?: string | null;
  acceptedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiTeamInvitation {
  id: string;
  vmid: number;
  inviteeEmail: string;
  scope: ApiTeamAccessScope;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
  sentAt?: string | null;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  isActive: boolean;
}

export interface ApiTeamAccessOverview {
  vms: ApiVM[];
  members: ApiTeamAccessMember[];
  invitations: ApiTeamInvitation[];
}

export interface ApiAccount {
  id: number;
  email: string;
  name: string;
  role: 'administrator' | 'moderator' | 'user' | 'admin' | 'client';
  phone?: string;
  supportPinConfigured?: boolean;
  twoFactorActive?: boolean;
  sshKeys?: string;
  created_at?: string;
}

export interface ApiProxmoxConnection {
  id: string;
  name: string;
  host_ip: string;
  port: number;
  token_id: string;
  ssl_fingerprint: string;
  status: string;
  last_tested: string | null;
  node_display_name?: string | null;
}

export interface ApiProxmoxConnectionOverview extends ApiProxmoxConnection {
  created_at?: string | null;
  vmCount: number;
  runningVmCount: number;
  nodeCount: number;
  lastInventoryAt?: string | null;
}

export interface ApiAuditLog {
  id: string;
  timestamp: string;
  userEmail: string;
  action: string;
  target: string;
  details: string;
  status: 'success' | 'warning' | 'failed';
}

export interface ApiTask {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  progressPct: number;
  node: string;
  startTime: string;
}

export interface ApiNotification {
  id: number;
  accountEmail: string;
  ruleId?: number;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical' | string;
  isRead: boolean;
  createdAt: string;
}

export type BillingCurrency = 'INR' | 'USD' | 'EUR';

export interface ApiPricingPlan {
  id: string;
  name: string;
  currency: BillingCurrency;
  monthlyPriceCents: number;
  vcpuLimit: number;
  ramGb: number;
  diskGb: number;
  bandwidthGb: number | null;
  isActive: boolean;
  sortOrder: number;
}

export interface ApiFleetDdosStatus {
  isAnyUnderAttack: boolean;
  activeAttacksCount: number;
  attacks: Array<{
    ip: string;
    block?: string;
    state: string;
    mode: 'automatic' | 'permanent';
    carrier?: 'ovh' | 'hetzner' | 'other';
    inBps?: number;
    droppedBps?: number;
    passedBps?: number;
    inPps?: number;
    vectors?: string[];
    startedAt?: string;
    vm?: {
      vmid: number;
      name: string;
      node: string;
      ownerEmail?: string;
    } | null;
  }>;
  totalInboundRateBps: number;
  totalScrubbedRateBps: number;
  totalPassedRateBps: number;
  checkedAt: string;
  checkedBlocksCount: number;
}

export interface ApiBillingInvoice {
  id: string;
  accountEmail: string;
  vmid: number;
  vmName?: string;
  planId?: string;
  planName?: string;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  dueAt: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  outstandingCents: number;
  currency: string;
  status: string;
  paidAt?: string;
  lastReminderAt?: string;
  suspensionEligibleAt?: string;
  notes?: string;
}

export interface ApiBillingSummary {
  invoiceCount: number;
  vmCount: number;
  billedCents: number;
  collectedCents: number;
  outstandingCents: number;
  overdueCount: number;
  overdueCents: number;
  suspendedInvoiceCount: number;
  monthlyCostCents: number;
  estimatedGrossProfitCents: number;
  collectedGrossProfitCents: number;
  estimatedMarginPercent: number;
  reportingCurrency: BillingCurrency;
  inrBilledPaise: number;
  inrCollectedPaise: number;
  inrOutstandingPaise: number;
  inrGrossProfitPaise: number;
  inrCollectedGrossProfitPaise: number;
  projectedInrRevenuePaise: number;
  projectedInrGrossProfitPaise: number;
  projectedInrMarginPercent: number | null;
  projectedRevenueByCurrency: Record<string, { cents: number; assignmentCount: number }>;
  monthlySharedCostPaise: number;
  monthlyServerCostPaise: number;
  monthlyIpCostPaise: number;
  totalInrCostPaise: number;
  unmappedServerCostProfileCount?: number;
  totalServerCapacityVms: number;
  totalAssignedServerVms: number;
  totalRunningServerVms: number;
  availableServerCapacityVms: number;
  totalRunningIpCount: number;
  totalAssignedIpCount: number;
  totalIncludedIpCount: number;
  billableIpCount: number;
  billableRunningIpCount: number;
  revenueByCurrency: Array<{ currency: BillingCurrency; invoiceCount: number; billedCents: number; collectedCents: number; outstandingCents: number }>;
}

export interface ApiBillingConfig {
  automationEnabled: boolean;
  reminderEmailsEnabled: boolean;
  suspensionExecutionEnabled: boolean;
  daysBeforeDue: number;
  gracePeriodDays: number;
  suspendAfterDaysOverdue: number;
  taxRatePercent: number;
  currency: BillingCurrency;
}

export interface ApiVmBillingProfile {
  vmid: number;
  vmName?: string;
  ownerEmail?: string;
  proxmoxConnectionId?: string | null;
  connectionName?: string | null;
  planId?: string;
  planName?: string;
  customMonthlyPriceCents: number | null;
  monthlyPriceCents: number;
  currency?: BillingCurrency;
  billingStatus: string;
  billingCycleDay: number;
  gracePeriodDays: number | null;
  nextDueAt?: string;
  ipCount: number;
}

export interface ApiBillingCostBase {
  id: string;
  name: string;
  monthlyCostCents: number;
  allocationMethod: string;
  currency: BillingCurrency;
  isActive: boolean;
}

export interface ApiBillingServerCost {
  id: string;
  name: string;
  nodeName: string | null;
  rawNodeName: string | null;
  proxmoxConnectionId: string | null;
  connectionName: string | null;
  legacyNeedsAssignment: boolean;
  monthlyCostPaise: number;
  ipCostPaise: number;
  plannedVmCapacity: number;
  includedIpCount: number;
  assignedVmCount: number;
  runningVmCount: number;
  runningIpCount: number;
  assignedIpCount: number;
  isActive: boolean;
}

export interface ApiBillingServerProfitability {
  serverId: string;
  serverName: string;
  nodeName: string | null;
  rawNodeName: string | null;
  proxmoxConnectionId: string | null;
  connectionName: string | null;
  legacyNeedsAssignment: boolean;
  hasCostProfile: boolean;
  invoiceCount: number;
  billedPaise: number;
  collectedPaise: number;
  outstandingPaise: number;
  projectedRevenuePaise: number;
  projectedGrossProfitPaise: number;
  projectedRevenueByCurrency: Record<string, { cents: number; assignmentCount: number }>;
  serverCostPaise: number;
  ipCostPaise: number;
  sharedCostPaise: number;
  totalCostPaise: number;
  grossProfitPaise: number;
  marginPercent: number | null;
  runningVmCount: number;
  assignedVmCount: number;
  plannedVmCapacity: number;
  availableVmCapacity: number;
  runningIpCount: number;
  assignedIpCount: number;
  includedIpCount: number;
  billableIpCount: number;
  breakEvenStatus: 'configure_costs' | 'no_revenue' | 'profitable' | 'loss' | string;
}

export interface ApiProxmoxVmIdentityConflict {
  vmid: number;
  existingConnectionId: string;
  existingConnectionName: string | null;
  incomingConnectionId: string;
  incomingConnectionName: string | null;
  existingVmName: string | null;
  incomingVmName: string | null;
  rawNodeName: string | null;
  detectedAt: string;
}

export interface ApiBillingSuspensionAction {
  id: string;
  invoice_id?: string;
  vmid: number;
  status: 'pending' | 'executed' | 'reversed' | 'failed' | string;
  reason?: string;
  requested_at?: string;
  executed_at?: string;
  reversed_at?: string;
  actor_email?: string;
  error_message?: string;
  account_email?: string;
  total_cents?: number;
  paid_cents?: number;
  vm_name?: string;
}

export type SupportTicketStatus = 'open' | 'in-progress' | 'replied' | 'resolved' | 'closed';
export type SupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ApiSupportTicket {
  id: string;
  ticket_number?: string;
  subject: string;
  category: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  vmid?: number;
  userEmail?: string;
  assignedTo?: string | null;
  createdAt: string;
  updatedAt?: string;
  replyCount?: number;
  lastReplyAt?: string;
  lastReplyRole?: 'admin' | 'client' | null;
  unread?: boolean;
}

export interface ApiSupportAgent {
  email: string;
  name?: string;
  role: string;
}

export interface ApiTicketReply {
  id: string;
  ticketId: string;
  senderEmail: string;
  senderRole: 'admin' | 'client';
  message: string;
  timestamp: string;
}

export interface ApiReimageRequest {
  id: string;
  vmid: number;
  vmName?: string;
  vmType?: 'qemu' | 'lxc';
  ownerEmail?: string;
  requesterEmail: string;
  requestedOs: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';
  requesterNote?: string;
  reviewerEmail?: string;
  reviewerNote?: string;
  createdAt: string;
  reviewedAt?: string;
  cancelledAt?: string;
  completedAt?: string;
  completedBy?: string;
  completionNote?: string;
}

export type ReimageExecutionState = 'created' | 'preflight_passed' | 'awaiting_confirmation' | 'queued' | 'processing' | 'verifying' | 'awaiting_cutover_confirmation' | 'cutover_processing' | 'completed' | 'failed' | 'blocked' | 'cancelled';

export interface ApiReimageExecution {
  id: string;
  requestId: string;
  vmid: number;
  vmName?: string;
  vmType?: 'qemu' | 'lxc';
  ownerEmail?: string;
  requesterEmail?: string;
  requestedOs?: string;
  requestStatus?: string;
  imageProfileId?: string;
  imageProfileVersion?: string;
  state: ReimageExecutionState;
  planHash?: string;
  operatorEmail?: string;
  operatorConfirmedAt?: string;
  preflightSnapshot?: Record<string, unknown>;
  backupReference?: string;
  currentStep?: string;
  attemptCount: number;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  queuedAt?: string;
  completedAt?: string;
  blockedAt?: string;
}

class ApiClient {
  private cache = new Map<string, { data: string, timestamp: number, promise: Promise<string> | null }>();

  private async swrFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    if (init?.method && init.method.toUpperCase() !== 'GET') {
      return this.apiFetch(input, init);
    }

    const url = input.toString();
    const cached = this.cache.get(url);
    const now = Date.now();

    // 2 second fresh window to dedupe rapid interval polls
    if (cached && (now - cached.timestamp < 2000) && cached.data) {
      return new Response(cached.data, { headers: { 'content-type': 'application/json' } });
    }

    if (cached && cached.promise) {
      const text = await cached.promise;
      return new Response(text, { headers: { 'content-type': 'application/json' } });
    }

    const promise = this.apiFetch(input, init).then(async (res) => {
      if (res.ok) {
        const text = await res.text();
        this.cache.set(url, { data: text, timestamp: Date.now(), promise: null });
        return text;
      }
      this.cache.delete(url);
      throw res;
    });

    this.cache.set(url, { data: cached?.data || '', timestamp: now, promise });

    try {
      const text = await promise;
      return new Response(text, { headers: { 'content-type': 'application/json' } });
    } catch (err) {
      if (err instanceof Response) return err;
      throw err;
    }
  }
  private getToken(): string | null {
    return localStorage.getItem('votion_jwt_token');
  }

  public getUserEmail(): string {
    return localStorage.getItem('votion_user_email') || 'client@votioncloud.org';
  }

  public getUserRole(): string {
    return localStorage.getItem('votion_user_role') || 'client';
  }

  private notifyAuthExpired(response: Response): void {
    if (response.status === 401 && this.getToken()) {
      window.dispatchEvent(new CustomEvent('votion:auth-expired'));
    }
  }

  private async apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    const externalSignal = init?.signal;
    const abortFromCaller = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', abortFromCaller, { once: true });
    }

    try {
      const response = await globalThis['fetch'](input, { ...init, signal: controller.signal });
      this.notifyAuthExpired(response);
      return response;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('The request timed out. Please try again.');
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', abortFromCaller);
    }
  }

  private async readTicketResponse(response: Response): Promise<any> {
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      throw new Error(data.error || data.message || `Ticket request failed (HTTP ${response.status})`);
    }
    return data;
  }

  private async readApiResponse(response: Response, fallbackMessage: string): Promise<any> {
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      throw new Error(data.error || data.message || `${fallbackMessage} (HTTP ${response.status})`);
    }
    return data;
  }

  private getHeaders(extra: Record<string, string> = {}): HeadersInit {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      'x-user-email': this.getUserEmail(),
      'x-user-role': this.getUserRole(),
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...extra,
    };
  }

  /**
   * PROMPT 5: Client Portal Specific Methods
   */
  async getClientVmInventory(connectionId?: string): Promise<{ vms: ApiVM[]; clusterStorage?: { totalGb: number; usedGb: number; freeGb: number; usagePct: number } | null; providerAvailable: boolean }> {
    const query = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : '';
    const res = await this.swrFetch(`${API_BASE_URL}/client/vms${query}`, {
      headers: this.getHeaders(),
    });
    const data = await this.readApiResponse(res, 'Unable to load client virtual machines.');
    return {
      vms: data.data || [],
      clusterStorage: data.clusterStorage || null,
      providerAvailable: data.providerAvailable !== false,
    };
  }

  async getClientVMs(connectionId?: string): Promise<ApiVM[]> {
    const { vms } = await this.getClientVmInventory(connectionId);
    return vms;
  }

  async getTeamAccessOverview(): Promise<ApiTeamAccessOverview> {
    const res = await this.swrFetch(`${API_BASE_URL}/client/team-access`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to load team access.');
    return data.data as ApiTeamAccessOverview;
  }

  async grantTeamAccess(input: { vmid: number; email: string; scope: ApiTeamAccessScope }): Promise<{ kind: 'member' | 'invitation'; message: string }> {
    const res = await this.apiFetch(`${API_BASE_URL}/client/team-access`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(input),
    });
    const data = await this.readApiResponse(res, 'Unable to grant team access.');
    return { kind: data.data?.kind, message: data.message || 'Team access updated.' };
  }

  async updateTeamAccess(vmid: number, memberId: number, scope: ApiTeamAccessScope): Promise<{ message: string }> {
    const res = await this.apiFetch(`${API_BASE_URL}/client/team-access/vms/${vmid}/members/${memberId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ scope }),
    });
    const data = await this.readApiResponse(res, 'Unable to update team access.');
    return { message: data.message || 'Team member access updated.' };
  }

  async revokeTeamAccess(vmid: number, memberId: number): Promise<{ message: string }> {
    const res = await this.apiFetch(`${API_BASE_URL}/client/team-access/vms/${vmid}/members/${memberId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    const data = await this.readApiResponse(res, 'Unable to revoke team access.');
    return { message: data.message || 'Team member access revoked.' };
  }

  async revokeTeamInvitation(invitationId: string): Promise<{ message: string }> {
    const res = await this.swrFetch(`${API_BASE_URL}/client/team-access/invitations/${encodeURIComponent(invitationId)}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    const data = await this.readApiResponse(res, 'Unable to revoke the pending invitation.');
    return { message: data.message || 'Pending invitation revoked.' };
  }

  async getVmReimageRequests(vmid: number, proxmoxConnectionId?: string | null): Promise<ApiReimageRequest[]> {
    const qs = proxmoxConnectionId ? `?connectionId=${encodeURIComponent(proxmoxConnectionId)}` : '';
    const headers = { ...this.getHeaders(), ...(proxmoxConnectionId ? { 'x-proxmox-connection-id': proxmoxConnectionId } : {}) };
    const res = await this.apiFetch(`${API_BASE_URL}/client/vms/${vmid}/reimage-requests${qs}`, {
      headers,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.error || `Reimage request lookup failed (HTTP ${res.status})`);
    }
    return data.data || [];
  }

  async createVmReimageRequest(vmid: number, requestedOs: string, reason?: string, proxmoxConnectionId?: string | null) {
    const qs = proxmoxConnectionId ? `?connectionId=${encodeURIComponent(proxmoxConnectionId)}` : '';
    const headers = { ...this.getHeaders(), ...(proxmoxConnectionId ? { 'x-proxmox-connection-id': proxmoxConnectionId } : {}) };
    const res = await this.apiFetch(`${API_BASE_URL}/client/vms/${vmid}/reimage-requests${qs}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ targetOS: requestedOs, reason, proxmoxConnectionId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.error || `Reimage request failed (HTTP ${res.status})`);
    }
    return data as { success: true; message: string; data: ApiReimageRequest };
  }

  async cancelVmReimageRequest(vmid: number, requestId: string, proxmoxConnectionId?: string | null) {
    const qs = proxmoxConnectionId ? `?connectionId=${encodeURIComponent(proxmoxConnectionId)}` : '';
    const headers = { ...this.getHeaders(), ...(proxmoxConnectionId ? { 'x-proxmox-connection-id': proxmoxConnectionId } : {}) };
    const res = await this.swrFetch(`${API_BASE_URL}/client/vms/${vmid}/reimage-requests/${encodeURIComponent(requestId)}/cancel${qs}`, {
      method: 'POST',
      headers,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.error || `Reimage request cancellation failed (HTTP ${res.status})`);
    }
    return data as { success: true; message: string; data: ApiReimageRequest };
  }

  async getAdminReimageRequests(status?: ApiReimageRequest['status']): Promise<ApiReimageRequest[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await this.apiFetch(`${API_BASE_URL}/admin/reimage-requests${query}`, {
      headers: this.getHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.error || `Reimage queue request failed (HTTP ${res.status})`);
    }
    return data.data || [];
  }

  async reviewAdminReimageRequest(requestId: string, decision: 'approved' | 'rejected', reviewerNote?: string) {
    const res = await this.swrFetch(`${API_BASE_URL}/admin/reimage-requests/${encodeURIComponent(requestId)}/review`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ decision, reviewerNote }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.error || `Reimage request review failed (HTTP ${res.status})`);
    }
    return data as { success: true; message: string; data: ApiReimageRequest };
  }

  async completeAdminReimageRequest(requestId: string, completionNote?: string) {
    const res = await this.swrFetch(`${API_BASE_URL}/admin/reimage-requests/${encodeURIComponent(requestId)}/complete`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ completionNote }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.error || `Unable to complete reimage request (HTTP ${res.status})`);
    }
    return data as { success: true; message: string; data: ApiReimageRequest };
  }

  async getOperatorApprovedReimageRequests(): Promise<ApiReimageRequest[]> {
    const res = await this.swrFetch(`${API_BASE_URL}/operator/reimage-requests`, { headers: this.getHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.error || `Operator queue request failed (HTTP ${res.status})`);
    return data.data || [];
  }

  async getOperatorReimageExecutions(state?: ReimageExecutionState): Promise<ApiReimageExecution[]> {
    const query = state ? `?state=${encodeURIComponent(state)}` : '';
    const res = await this.swrFetch(`${API_BASE_URL}/operator/reimage-executions${query}`, { headers: this.getHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.error || `Operator execution history failed (HTTP ${res.status})`);
    return data.data || [];
  }

  async createOperatorReimageExecution(requestId: string) {
    const res = await this.swrFetch(`${API_BASE_URL}/operator/reimage-requests/${encodeURIComponent(requestId)}/executions`, { method: 'POST', headers: this.getHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.error || `Execution creation failed (HTTP ${res.status})`);
    return data as { success: true; execution: ApiReimageExecution; planHash: string; executionEnabled: boolean; message: string };
  }

  async preflightOperatorReimageExecution(executionId: string) {
    const res = await this.swrFetch(`${API_BASE_URL}/operator/reimage-executions/${encodeURIComponent(executionId)}/preflight`, { method: 'POST', headers: this.getHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.error || `Preflight failed (HTTP ${res.status})`);
    return data as { success: true; execution: ApiReimageExecution; planHash: string; executionEnabled: boolean; message: string };
  }

  async confirmOperatorReimageExecution(executionId: string, input: { planHash: string; confirmationPhrase: string; expectedVmid: number; expectedImageProfileVersion: string }) {
    const res = await this.swrFetch(`${API_BASE_URL}/operator/reimage-executions/${encodeURIComponent(executionId)}/confirm`, { method: 'POST', headers: this.getHeaders(), body: JSON.stringify(input) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.error || `Execution confirmation failed (HTTP ${res.status})`);
    return data as { success: true; execution: ApiReimageExecution; executionEnabled: boolean; message: string };
  }

  async cancelOperatorReimageExecution(executionId: string) {
    const res = await this.swrFetch(`${API_BASE_URL}/operator/reimage-executions/${encodeURIComponent(executionId)}/cancel`, { method: 'POST', headers: this.getHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.error || `Execution cancellation failed (HTTP ${res.status})`);
    return data as { success: true; execution: ApiReimageExecution; message: string };
  }

  async getVMMetadata(vmid: number, proxmoxConnectionId?: string | null, node?: string | null): Promise<ApiVmMetadata> {
    const params = new URLSearchParams();
    if (proxmoxConnectionId) params.set('connectionId', proxmoxConnectionId);
    if (node) params.set('node', node);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const headers = {
      ...this.getHeaders(),
      ...(proxmoxConnectionId ? { 'x-proxmox-connection-id': proxmoxConnectionId } : {}),
      ...(node ? { 'x-proxmox-node': node } : {}),
    };
    const res = await this.swrFetch(`${API_BASE_URL}/client/vms/${vmid}/metadata${qs}`, {
      headers,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || `VM metadata request failed (HTTP ${res.status})`);
    }
    return data.data as ApiVmMetadata;
  }

  async getVMMetrics(vmid: number, proxmoxConnectionId?: string | null, node?: string | null) {
    const params = new URLSearchParams();
    if (proxmoxConnectionId) params.set('connectionId', proxmoxConnectionId);
    if (node) params.set('node', node);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const headers = {
      ...this.getHeaders(),
      ...(proxmoxConnectionId ? { 'x-proxmox-connection-id': proxmoxConnectionId } : {}),
      ...(node ? { 'x-proxmox-node': node } : {}),
    };
    const res = await this.apiFetch(`${API_BASE_URL}/client/vms/${vmid}/metrics${qs}`, {
      headers,
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || `Metrics request failed (HTTP ${res.status})`);
    }
    return data;
  }

  async getVMTelemetry(vmid: number, proxmoxConnectionId?: string | null, node?: string | null) {
    const params = new URLSearchParams();
    if (proxmoxConnectionId) params.set('connectionId', proxmoxConnectionId);
    if (node) params.set('node', node);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const headers = {
      ...this.getHeaders(),
      ...(proxmoxConnectionId ? { 'x-proxmox-connection-id': proxmoxConnectionId } : {}),
      ...(node ? { 'x-proxmox-node': node } : {}),
    };
    const res = await this.apiFetch(`${API_BASE_URL}/client/vms/${vmid}/telemetry${qs}`, {
      headers,
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || `Telemetry request failed (HTTP ${res.status})`);
    }
    return data;
  }

  async executeClientPowerAction(vmid: number, action: 'start' | 'stop' | 'reboot' | 'shutdown', proxmoxConnectionId?: string | null) {
    const qs = proxmoxConnectionId ? `?connectionId=${encodeURIComponent(proxmoxConnectionId)}` : '';
    const headers = { ...this.getHeaders(), ...(proxmoxConnectionId ? { 'x-proxmox-connection-id': proxmoxConnectionId } : {}) };
    const res = await this.apiFetch(`${API_BASE_URL}/client/vms/${vmid}/power${qs}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, proxmoxConnectionId }),
    });
    return await res.json();
  }

  /**
   * PROMPT 4: Admin Allocation, Expiry & Suspension Methods
   */
  async assignServerToUser(assignData: { vmid?: number; name?: string; targetEmail: string; cpus?: number; memoryGb?: number; diskGb?: number; expiryDays?: number; os?: string }) {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/vms/assign`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(assignData),
    });
    return await res.json();
  }

  async getClientVmBillingProfiles(): Promise<ApiVmBillingProfile[]> {
    const res = await this.swrFetch(`${API_BASE_URL}/client/billing/vm-profiles`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to load your billing profile.');
    return data.data || [];
  }

  async getBillingPlans(): Promise<ApiPricingPlan[]> {
    const res = await this.swrFetch(`${API_BASE_URL}/billing/plans`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to load pricing plans.');
    return data.data || [];
  }

  async getBillingSummary(): Promise<ApiBillingSummary> {
    const res = await this.swrFetch(`${API_BASE_URL}/billing/summary`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to load billing summary.');
    return data.data;
  }

  async getBillingInvoices(status?: string): Promise<ApiBillingInvoice[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await this.swrFetch(`${API_BASE_URL}/billing/invoices${query}`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to load invoices.');
    return data.data || [];
  }

  async getBillingConfig(): Promise<ApiBillingConfig> {
    const res = await this.swrFetch(`${API_BASE_URL}/billing/config`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to load billing policy.');
    return data.data;
  }

  async updateBillingConfig(patch: Partial<ApiBillingConfig> & { confirmation?: string }): Promise<ApiBillingConfig> {
    const res = await this.apiFetch(`${API_BASE_URL}/billing/config`, { method: 'PUT', headers: this.getHeaders(), body: JSON.stringify(patch) });
    const data = await this.readApiResponse(res, 'Unable to update billing policy.');
    return data.data;
  }

  async upsertBillingPlan(plan: Partial<ApiPricingPlan>): Promise<ApiPricingPlan> {
    const res = await this.apiFetch(`${API_BASE_URL}/billing/plans`, { method: 'POST', headers: this.getHeaders(), body: JSON.stringify(plan) });
    const data = await this.readApiResponse(res, 'Unable to save pricing plan.');
    return data.data;
  }

  async toggleBillingPlan(id: string, isActive: boolean): Promise<ApiPricingPlan> {
    const res = await this.swrFetch(`${API_BASE_URL}/billing/plans/${encodeURIComponent(id)}`, { method: 'PATCH', headers: this.getHeaders(), body: JSON.stringify({ isActive }) });
    const data = await this.readApiResponse(res, 'Unable to update pricing plan.');
    return data.data;
  }

  async getBillingCostBases(): Promise<ApiBillingCostBase[]> {
    const res = await this.swrFetch(`${API_BASE_URL}/billing/cost-bases`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to load cost bases.');
    return data.data || [];
  }

  async upsertBillingCostBase(cost: Partial<ApiBillingCostBase>): Promise<ApiBillingCostBase> {
    const res = await this.apiFetch(`${API_BASE_URL}/billing/cost-bases`, { method: 'POST', headers: this.getHeaders(), body: JSON.stringify(cost) });
    const data = await this.readApiResponse(res, 'Unable to save cost basis.');
    return data.data;
  }

  async getBillingServerCosts(): Promise<ApiBillingServerCost[]> {
    const res = await this.swrFetch(`${API_BASE_URL}/billing/server-costs`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to load dedicated-server costs.');
    return data.data || [];
  }

  async upsertBillingServerCost(cost: Partial<ApiBillingServerCost>): Promise<ApiBillingServerCost> {
    const res = await this.apiFetch(`${API_BASE_URL}/billing/server-costs`, { method: 'POST', headers: this.getHeaders(), body: JSON.stringify(cost) });
    const data = await this.readApiResponse(res, 'Unable to save dedicated-server cost.');
    return data.data;
  }

  async getBillingServerProfitability(): Promise<ApiBillingServerProfitability[]> {
    const res = await this.swrFetch(`${API_BASE_URL}/billing/server-profitability`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to load server profitability.');
    return data.data || [];
  }

  async deleteBillingServerCost(id: string): Promise<{ id: string; name: string; nodeName: string }> {
    const res = await this.swrFetch(`${API_BASE_URL}/billing/server-costs/${encodeURIComponent(id)}`, { method: 'DELETE', headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to delete dedicated-server cost.');
    return data.data;
  }

  async getVmBillingProfiles(): Promise<ApiVmBillingProfile[]> {
    const res = await this.swrFetch(`${API_BASE_URL}/billing/vm-profiles`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to load VM billing profiles.');
    return data.data || [];
  }

  async updateVmBillingProfile(vmid: number, profile: Partial<ApiVmBillingProfile>, proxmoxConnectionId?: string | null): Promise<ApiVmBillingProfile> {
    const connId = proxmoxConnectionId || profile.proxmoxConnectionId;
    const query = connId ? `?connectionId=${encodeURIComponent(connId)}` : '';
    const headers = { ...this.getHeaders(), ...(connId ? { 'x-proxmox-connection-id': connId } : {}) };
    const res = await this.apiFetch(`${API_BASE_URL}/billing/vms/${vmid}/profile${query}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ ...profile, ...(connId ? { proxmoxConnectionId: connId } : {}) }),
    });
    const data = await this.readApiResponse(res, 'Unable to save VM billing profile.');
    return data.data;
  }

  async recordBillingPayment(invoiceId: string, amountCents: number, notes?: string): Promise<ApiBillingInvoice> {
    const res = await this.swrFetch(`${API_BASE_URL}/billing/invoices/${encodeURIComponent(invoiceId)}/payment`, { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ amountCents, method: 'manual', notes }) });
    const data = await this.readApiResponse(res, 'Unable to record payment.');
    return data.data;
  }

  async getBillingSuspensionActions(status?: string): Promise<ApiBillingSuspensionAction[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await this.swrFetch(`${API_BASE_URL}/billing/suspension-actions${query}`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to load suspension actions.');
    return data.data || [];
  }

  async reverseBillingSuspension(actionId: string): Promise<{ success: boolean; data?: ApiVM; message?: string }> {
    const res = await this.swrFetch(`${API_BASE_URL}/billing/suspension-actions/${encodeURIComponent(actionId)}/reverse`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ confirmation: 'RESTORE_PAID_SERVICE' }),
    });
    return await this.readApiResponse(res, 'Unable to restore paid service.');
  }

  async updateServerExpiry(vmid: number, additionalDays: number, proxmoxConnectionId?: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/vms/${vmid}/expiry`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ additionalDays, proxmoxConnectionId }),
    });
    return await res.json();
  }

  async toggleServerSuspend(vmid: number, suspend: boolean, proxmoxConnectionId?: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/vms/${vmid}/suspend`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ suspend, proxmoxConnectionId }),
    });
    return await res.json();
  }

  /**
   * PROMPT 3: Admin Node Monitoring & Cluster Overview APIs
   */
  async getAdminNodes(connectionId?: string): Promise<ApiNode[]> {
    const query = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : '';
    const res = await this.swrFetch(`${API_BASE_URL}/admin/nodes${query}`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to load cluster nodes.');
    return data.data || [];
  }

  async getClusterOverview(connectionId?: string): Promise<ApiClusterOverview | null> {
    const query = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : '';
    const res = await this.swrFetch(`${API_BASE_URL}/admin/cluster/overview${query}`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to load cluster overview.');
    return data.data || null;
  }

  /**
   * Strict Login Authentication Endpoint
   */
  async login(email: string, password: string): Promise<{ success: boolean; token?: string; user?: any; error?: string, twoFactorRequired?: boolean, tempToken?: string }> {
    try {
      const res = await this.apiFetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('votion_jwt_token', data.token);
        localStorage.setItem('votion_user_email', data.user.email);
        localStorage.setItem('votion_user_role', data.user.role);
        return data;
      }
      return { success: false, error: data.error || 'Invalid credentials' };
    } catch (err) {
      return {
        success: false,
        error: 'Invalid email address or password. Please verify your credentials or use Account Recovery.',
      };
    }
  }

    async getInitialAdminSetupStatus(): Promise<{ success: boolean; setupAvailable: boolean; expiresAt: string | null; error?: string }> {
    try {
      const res = await this.apiFetch(`${API_BASE_URL}/auth/setup/status`, {
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return { success: false, setupAvailable: false, expiresAt: null, error: data.error || 'Unable to check setup status.' };
      }
      return { success: true, setupAvailable: Boolean(data.setupAvailable), expiresAt: data.expiresAt || null };
    } catch (error) {
      return { success: false, setupAvailable: false, expiresAt: null, error: error instanceof Error ? error.message : 'Unable to check setup status.' };
    }
  }

  async completeInitialAdminSetup(token: string, password: string): Promise<{ success: boolean; token?: string; user?: ApiAccount; error?: string }> {
    try {
      const res = await this.apiFetch(`${API_BASE_URL}/auth/setup/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.user || !data.token) {
        return { success: false, error: data.error || 'Unable to complete administrator setup.' };
      }
      localStorage.setItem('votion_jwt_token', data.token);
      localStorage.setItem('votion_user_email', data.user.email);
      localStorage.setItem('votion_user_role', data.user.role);
      return { success: true, token: data.token, user: data.user as ApiAccount };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unable to complete administrator setup.' };
    }
  }

  /**
   * User Registration Endpoint
   */
  async register(name: string, email: string, password: string) {

    try {
      const res = await this.apiFetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await this.readApiResponse(res, 'Registration failed.');
      if (res.ok && data.success) {
        if (data.user) {
          localStorage.setItem('votion_jwt_token', data.token);
          localStorage.setItem('votion_user_email', data.user.email);
          localStorage.setItem('votion_user_role', data.user.role);
        }
        return data;
      }
      return { success: false, error: data.error || 'Registration failed' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error. Please check your connection and try again.' };
    }
  }

  async verifyRegistrationEmail(email: string, verificationToken: string, otp: string) {
    try {
      const res = await this.apiFetch(`${API_BASE_URL}/auth/register/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, verificationToken, otp }),
      });
      const data = await this.readApiResponse(res, 'Unable to verify your email address.');
      if (res.ok && data.success && data.user) {
        localStorage.setItem('votion_jwt_token', data.token);
        localStorage.setItem('votion_user_email', data.user.email);
        localStorage.setItem('votion_user_role', data.user.role);
        return data;
      }
      return { success: false, error: data.error || 'Unable to verify your email address.' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error. Please check your connection and try again.' };
    }
  }

    async getNavigationUsage(): Promise<ApiNavigationUsage[]> {
    const res = await this.swrFetch(`${API_BASE_URL}/client/navigation-usage`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to load personalized navigation.');
    return Array.isArray(data.data) ? data.data as ApiNavigationUsage[] : [];
  }

  async recordNavigationUsage(item: { itemKey: string; itemType: 'destination' | 'vm'; vmid?: number }) {
    try {
      const res = await this.apiFetch(`${API_BASE_URL}/client/navigation-usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.getHeaders() },
        body: JSON.stringify(item),
      });
      if (!res.ok && res.status !== 204) {
        return;
      }
      window.dispatchEvent(new Event('votion-navigation-usage'));
    } catch {
      // Telemetry should never disrupt navigation or pollute the console
    }
  }

  /**
   * Fetch Live User Profile from PostgreSQL
   */

  async getUserProfile(email?: string): Promise<ApiAccount | null> {
    const targetEmail = email || this.getUserEmail();
    const res = await this.swrFetch(`${API_BASE_URL}/user/profile?email=${encodeURIComponent(targetEmail)}`, {
      headers: this.getHeaders(),
    });
    const data = await res.json();
    return data.data || null;
  }

  /**
   * Update User Profile & Name/Phone in PostgreSQL
   */
  async updateUserProfile(profileData: { email?: string; name?: string; phone?: string; supportPin?: string; sshKeys?: string }) {
    const email = profileData.email || this.getUserEmail();
    const res = await this.apiFetch(`${API_BASE_URL}/user/profile`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ ...profileData, email }),
    });
    return await res.json();
  }

  /**
   * Change Password Endpoint with PBKDF2 Hashing
   */
  async changePassword(currentPassword: string, newPassword: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/user/change-password`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email: this.getUserEmail(), currentPassword, newPassword }),
    });
    return await res.json();
  }

  /**
   * Regenerate Support PIN in PostgreSQL
   */
  async regenerateSupportPin() {
    const res = await this.apiFetch(`${API_BASE_URL}/user/regenerate-pin`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email: this.getUserEmail() }),
    });
    return await res.json();
  }

  /**
   * Toggle 2FA State in PostgreSQL
   */
  async toggle2FA(active: boolean, stepUp?: { currentPassword: string; totpCode: string }) {
    const res = await this.apiFetch(`${API_BASE_URL}/user/2fa/toggle`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email: this.getUserEmail(), active, ...stepUp }),
    });
    return await res.json();
  }

  /**
   * SUPPORT TICKET SYSTEM METHODS
   */
  async getSupportTickets(filters: { search?: string; status?: string; priority?: string; assignedTo?: string } = {}): Promise<ApiSupportTicket[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const res = await this.swrFetch(`${API_BASE_URL}/support/tickets${suffix}`, { headers: this.getHeaders() });
    const data = await this.readTicketResponse(res);
    return Array.isArray(data.data) ? data.data : [];
  }

  async getSupportAgents(): Promise<ApiSupportAgent[]> {
    const res = await this.swrFetch(`${API_BASE_URL}/support/tickets/agents`, { headers: this.getHeaders() });
    const data = await this.readTicketResponse(res);
    return Array.isArray(data.data) ? data.data : [];
  }

  async getTicketDetails(ticketId: string): Promise<{ ticket: ApiSupportTicket; replies: ApiTicketReply[] } | null> {
    const res = await this.swrFetch(`${API_BASE_URL}/support/tickets/${ticketId}`, { headers: this.getHeaders() });
    const data = await this.readTicketResponse(res);
    return data.data || null;
  }

  async createSupportTicket(subject: string, category: string, priority: SupportTicketPriority, vmid?: number, message?: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/support/tickets`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ subject, category, priority, vmid, message }),
    });
    return await this.readTicketResponse(res);
  }

  async addTicketReply(ticketId: string, message: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/support/tickets/${ticketId}/replies`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ message }),
    });
    return await this.readTicketResponse(res);
  }

  async updateTicketStatus(ticketId: string, status: SupportTicketStatus) {
    const res = await this.apiFetch(`${API_BASE_URL}/support/tickets/${ticketId}/status`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ status }),
    });
    return await this.readTicketResponse(res);
  }

  async updateTicketPriority(ticketId: string, priority: SupportTicketPriority) {
    const res = await this.apiFetch(`${API_BASE_URL}/support/tickets/${ticketId}/priority`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ priority }),
    });
    return await this.readTicketResponse(res);
  }

  async assignTicket(ticketId: string, assigneeEmail: string | null) {
    const res = await this.apiFetch(`${API_BASE_URL}/support/tickets/${ticketId}/assignment`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ assigneeEmail }),
    });
    return await this.readTicketResponse(res);
  }

  async markTicketRead(ticketId: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/support/tickets/${ticketId}/read`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return await this.readTicketResponse(res);
  }

  /**
   * VM & EXPIRY SUSPENSION METHODS
   */
  async suspendVM(vmid: number, suspend: boolean, proxmoxConnectionId?: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/vms/${vmid}/suspend`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ suspend, proxmoxConnectionId }),
    });
    return await res.json();
  }

  async extendVMExpiry(vmid: number, additionalDays: number, proxmoxConnectionId?: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/vms/${vmid}/extend`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ additionalDays, proxmoxConnectionId }),
    });
    return await res.json();
  }

  async reinstallVMOS(vmid: number, targetOS: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/vms/${vmid}/reinstall`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ targetOS }),
    });
    return await res.json();
  }

  /**
   * Fetch Registered Accounts
   */
  async getAccounts(): Promise<ApiAccount[]> {
    const res = await this.swrFetch(`${API_BASE_URL}/accounts`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to load accounts.');
    return data.data || [];
  }

  /**
   * Fetch PVE Nodes Matrix from Express API
   */
  async getNodes(): Promise<ApiNode[]> {
    const res = await this.swrFetch(`${API_BASE_URL}/nodes`, { headers: this.getHeaders() });
    const data = await res.json();
    return data.data || [];
  }

  /**
   * Reboot Node Signal
   */
  async rebootNode(nodeId: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/nodes/${nodeId}/reboot`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return await res.json();
  }

  /**
   * Fetch VM Allocations from Express API
   */
  async getVMs(ownerEmail?: string, connectionId?: string): Promise<ApiVM[]> {
    const params = new URLSearchParams();
    if (ownerEmail) params.set('ownerEmail', ownerEmail);
    if (connectionId) params.set('connectionId', connectionId);
    const query = params.toString();

    // Check admin endpoint first (if admin session), then general /vms
    const endpoints = [
      query ? `${API_BASE_URL}/admin/vms?${query}` : `${API_BASE_URL}/admin/vms`,
      query ? `${API_BASE_URL}/vms?${query}` : `${API_BASE_URL}/vms`,
    ];

    for (const url of endpoints) {
      try {
        const res = await this.swrFetch(url, { headers: this.getHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.data)) return data.data;
          if (data && Array.isArray(data.vms)) return data.vms;
        }
      } catch {
        // Try next candidate endpoint
      }
    }
    return [];
  }

  /**
   * Admin Reassign VM Ownership by VMID
   */

  async unassignVM(vmid: number, proxmoxConnectionId: string, reason: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/vms/${vmid}/unassign`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ proxmoxConnectionId, reason }),
    });
    return await res.json();
  }

  async getVmAssignmentHistory(vmid: number, proxmoxConnectionId: string) {
    const res = await this.swrFetch(`${API_BASE_URL}/vms/${vmid}/assignment-history?proxmoxConnectionId=${encodeURIComponent(proxmoxConnectionId)}`, {
      headers: this.getHeaders(),
    });
    const data = await this.readApiResponse(res, 'Unable to load assignment history.');
    return data.data || [];
  }

  async searchAccounts(q: string): Promise<Array<{ id: number; email: string; name: string; role: string; vm_count: number }>> {
    const res = await this.swrFetch(`${API_BASE_URL}/accounts/search?q=${encodeURIComponent(q)}`, {
      headers: this.getHeaders(),
    });
    const data = await this.readApiResponse(res, 'Unable to search accounts.');
    return data.data || [];
  }

  async assignVM(vmid: number, targetEmail: string, expiry?: { mode: 'keep' | 'never' | 'custom'; date?: string }, proxmoxConnectionId?: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/vms/${vmid}/assign`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ targetEmail, expiryMode: expiry?.mode, expiryDate: expiry?.date, proxmoxConnectionId }),
    });
    return await res.json();
  }

  /**
   * Admin Delete VM Allocation by VMID
   */
  async deleteVM(vmid: number, proxmoxConnectionId?: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/vms/${vmid}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return await res.json();
  }

  /**
   * Provision New VM/LXC Container & Assign to Account by VMID
   */
  async provisionVM(vmData: { vmid?: number; name: string; type: string; node: string; ownerEmail?: string; cpus: number; memoryGb: number; diskGb: number; expiryDays?: number; os?: string }) {
    const res = await this.apiFetch(`${API_BASE_URL}/vms`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(vmData),
    });
    return await res.json();
  }

  /**
   * Trigger VM Lifecycle Action via Express Backend
   */
  async executeVMAction(node: string, vmid: number, type: 'qemu' | 'lxc', action: 'start' | 'stop' | 'reboot' | 'shutdown') {
    const res = await this.apiFetch(`${API_BASE_URL}/vms/${vmid}/action`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ node, type, action }),
    });
    return await res.json();
  }

  /**
   * Inject SSH Keys via Cloud-Init
   */
  async injectCloudInitSsh(vmid: number, proxmoxConnectionId?: string | null) {
    const qs = proxmoxConnectionId ? `?connectionId=${encodeURIComponent(proxmoxConnectionId)}` : '';
    const headers = { ...this.getHeaders(), ...(proxmoxConnectionId ? { 'x-proxmox-connection-id': proxmoxConnectionId } : {}) };
    const res = await this.apiFetch(`${API_BASE_URL}/client/vms/${vmid}/cloud-init/sync-ssh${qs}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ proxmoxConnectionId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to inject SSH keys');
    return data;
  }

  /**
   * Reset VM Password (Cloud-Init + QEMU Agent Live Update)
   */
  async resetVmPassword(vmid: number, password: string, proxmoxConnectionId?: string | null) {
    const qs = proxmoxConnectionId ? `?connectionId=${encodeURIComponent(proxmoxConnectionId)}` : '';
    const headers = { ...this.getHeaders(), ...(proxmoxConnectionId ? { 'x-proxmox-connection-id': proxmoxConnectionId } : {}) };
    const res = await this.apiFetch(`${API_BASE_URL}/client/vms/${vmid}/password${qs}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ password, proxmoxConnectionId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to reset password');
    return data;
  }

  /**
   * Execute Command in VNC Terminal Console
   */
  async executeVncCommand(vmid: number, command: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/vms/${vmid}/vnc/cmd`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ command }),
    });
    return await res.json();
  }

  /**
   * Fetch ISO & Software Downloads
   */
  async getDownloads() {
    const res = await this.swrFetch(`${API_BASE_URL}/downloads`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to load downloads.');
    return Array.isArray(data.data) ? data.data : [];
  }

  /**
   * Fetch Data Room Verification Documents
   */
  async getDataRoom() {
    const res = await this.swrFetch(`${API_BASE_URL}/dataroom`, { headers: this.getHeaders() });
    const data = await res.json();
    return data.data || [];
  }

  /**
   * Fetch Cluster Pricing & Tier Plans
   */
  async getPricing(): Promise<ApiPricingPlan[]> {
    const res = await this.swrFetch(`${API_BASE_URL}/pricing`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to load upgrade plans.');
    return Array.isArray(data.data) ? data.data as ApiPricingPlan[] : [];
  }

  /**
   * Fetch Engine Release Notes
   */
  async getReleaseNotes() {
    const res = await this.swrFetch(`${API_BASE_URL}/release-notes`, { headers: this.getHeaders() });
    const data = await res.json();
    return data.data || [];
  }

  /**
   * Fetch Terms & Privacy SLA
   */
  async getTerms() {
    const res = await this.swrFetch(`${API_BASE_URL}/terms`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to load terms.');
    return data.data || { title: 'VOTION Terms', sections: [] };
  }

  async requestUpgrade(plan: ApiPricingPlan) {
    const price = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: plan.currency,
      maximumFractionDigits: 2,
    }).format(plan.monthlyPriceCents / 100);
    const details = [
      `Plan ID: ${plan.id}`,
      `Listed monthly price: ${price} ${plan.currency}`,
      `vCPUs: ${plan.vcpuLimit}`,
      `RAM: ${plan.ramGb} GB`,
      `Storage: ${plan.diskGb} GB`,
      plan.bandwidthGb === null ? 'Transfer: Unlimited' : `Transfer: ${plan.bandwidthGb} GB`,
    ].join('; ');
    return this.createSupportTicket(
      `Upgrade request: ${plan.name}`,
      'Quota Upgrade',
      'high',
      undefined,
      `Please review my request for the ${plan.name} plan. ${details}. Please confirm availability, billing, and next steps.`,
    );
  }

  /**
   * Trigger ZFS Scrub via Express Backend
   */
  async triggerZfsScrub() {
    const res = await this.apiFetch(`${API_BASE_URL}/storage/zfs/scrub`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return await res.json();
  }

  /**
   * Fetch TimescaleDB Telemetry History
   */
  async getTelemetryHistory() {
    const res = await this.swrFetch(`${API_BASE_URL}/telemetry/history`, { headers: this.getHeaders() });
    const data = await res.json();
    return data.data || [];
  }

  /**
   * Fetch Tasks List
   */
  async getTasks(): Promise<ApiTask[]> {
    const res = await this.swrFetch(`${API_BASE_URL}/tasks`, { headers: this.getHeaders() });
    const data = await res.json();
    return data.data || [];
  }

  /**
   * Fetch Cluster Audit Logs
   */
  async getAuditLogs(): Promise<ApiAuditLog[]> {
    const res = await this.swrFetch(`${API_BASE_URL}/audit-logs`, { headers: this.getHeaders() });
    const data = await res.json();
    return data.data || [];
  }

  // ==========================================
  // ADVANCED USER MANAGEMENT
  // ==========================================
  async getAdminUsers(): Promise<ApiAccount[]> {
    const res = await this.swrFetch(`${API_BASE_URL}/admin/users`, { headers: this.getHeaders() });
    return await res.json();
  }

  async createAdminUser(payload: any) {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/users`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return await res.json();
  }

  async updateAdminUserRole(userId: number, role: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ role }),
    });
    return await res.json();
  }

  async deleteAdminUser(userId: number) {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/users/${userId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return await res.json();
  }

  // ==========================================
  // CLUSTER CONNECTIONS MANAGER
  // ==========================================
  async getProxmoxVmIdentityConflicts(): Promise<ApiProxmoxVmIdentityConflict[]> {
    const res = await this.swrFetch(`${API_BASE_URL}/admin/proxmox/vm-identity-conflicts`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to load VM identity diagnostics.');
    return data.data || [];
  }

  async getProxmoxConnections(): Promise<ApiProxmoxConnection[]> {
    const res = await this.swrFetch(`${API_BASE_URL}/admin/proxmox`, { headers: this.getHeaders() });
    let payload: unknown;

    try {
      payload = await res.json();
    } catch {
      throw new Error(`Connection service returned HTTP ${res.status}`);
    }

    if (!res.ok) {
      const error = payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error?: unknown }).error || '')
        : '';
      throw new Error(error || `Connection service returned HTTP ${res.status}`);
    }

    if (!Array.isArray(payload)) {
      throw new Error('Connection service returned an invalid response');
    }

    return payload as ApiProxmoxConnection[];
  }

  async getProxmoxConnectionOverview(): Promise<ApiProxmoxConnectionOverview[]> {
    const res = await this.swrFetch(`${API_BASE_URL}/admin/proxmox/overview`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to load connection health overview.');
    return Array.isArray(data.data) ? data.data : [];
  }

  async testStoredProxmoxConnection(id: string) {
    const res = await this.swrFetch(`${API_BASE_URL}/admin/proxmox/${encodeURIComponent(id)}/test`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return await this.readApiResponse(res, 'Unable to test Proxmox connection.');
  }

  async addProxmoxConnection(payload: any) {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/proxmox`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return await res.json();
  }

  async deleteProxmoxConnection(id: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/proxmox/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return await res.json();
  }

  async testProxmoxConnection(payload: { host_ip: string; port: number; token_id: string; token_secret: string; ssl_fingerprint?: string }) {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/proxmox/test`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return await res.json();
  }

  async fetchProxmoxFingerprint(payload: { host_ip: string; port: number }): Promise<{ success: boolean; fingerprint?: string; message?: string; error?: string }> {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/proxmox/fingerprint`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return await this.readApiResponse(res, 'Unable to retrieve the Proxmox certificate fingerprint.');
  }

  // ==========================================
  // USER SECURITY & SETTINGS ENDPOINTS
  // ==========================================
  async changePrimaryEmail(newEmail: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/user/change-email`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email: this.getUserEmail(), newEmail: newEmail.toLowerCase().trim() }),
    });
    return await res.json();
  }

  async getSecondaryEmails() {
    const res = await this.swrFetch(`${API_BASE_URL}/user/secondary-emails?email=${encodeURIComponent(this.getUserEmail())}`, {
      headers: this.getHeaders(),
    });
    const data = await res.json();
    return data.data || [];
  }

  async addSecondaryEmail(secondaryEmail: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/user/secondary-emails`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email: this.getUserEmail(), secondaryEmail }),
    });
    return await res.json();
  }

  async removeSecondaryEmail(secondaryEmail: string) {
    const res = await this.swrFetch(`${API_BASE_URL}/user/secondary-emails/${encodeURIComponent(secondaryEmail)}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return await res.json();
  }

  async setup2FA() {
    const res = await this.apiFetch(`${API_BASE_URL}/user/2fa/setup`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email: this.getUserEmail() }),
    });
    return await res.json();
  }

  async verify2FA(totpCode: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/user/2fa/verify`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email: this.getUserEmail(), totpCode }),
    });
    return await res.json();
  }

  async triggerPbsBackup() {
    const res = await this.apiFetch(`${API_BASE_URL}/pbs/backup`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return await res.json();
  }

  async getPasskeys() {
    const res = await this.swrFetch(`${API_BASE_URL}/user/passkeys?email=${encodeURIComponent(this.getUserEmail())}`, {
      headers: this.getHeaders(),
    });
    const data = await res.json();
    return data.data || [];
  }

  async registerPasskey(credentialId: string, keyName: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/user/passkeys`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email: this.getUserEmail(), credentialId, keyName }),
    });
    return await res.json();
  }

  async deletePasskey(credentialId: string) {
    const res = await this.swrFetch(`${API_BASE_URL}/user/passkeys/${encodeURIComponent(credentialId)}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return await res.json();
  }

  async getPasskeyChallenge(email?: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/auth/passkey/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return await res.json();
  }

  async loginWithPasskey(payload: { credentialId: string; clientDataJSON?: string; authenticatorData?: string; signature?: string }) {
    const res = await this.apiFetch(`${API_BASE_URL}/auth/login/passkey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  }

  async startRemoteSession() {
    const res = await this.apiFetch(`${API_BASE_URL}/user/remote-session/start`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email: this.getUserEmail() }),
    });
    return await res.json();
  }

  async getActiveRemoteSession() {
    const res = await this.swrFetch(`${API_BASE_URL}/user/remote-session/active?email=${encodeURIComponent(this.getUserEmail())}`, {
      headers: this.getHeaders(),
    });
    return await res.json();
  }

  async disconnectRemoteSession() {
    const res = await this.apiFetch(`${API_BASE_URL}/user/remote-session/disconnect`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email: this.getUserEmail() }),
    });
    return await res.json();
  }

  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await this.apiFetch(`${API_BASE_URL}/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
        'x-user-email': this.getUserEmail(),
      },
      body: formData,
    });
    return await res.json();
  }

  async getUploadedFiles() {
    const res = await this.apiFetch(`${API_BASE_URL}/files/list`, {
      headers: this.getHeaders(),
    });
    const data = await res.json();
    return data.data || [];
  }

  // ==========================================
  // VM SNAPSHOTS / BACKUPS
  // ==========================================
  async getVmSnapshots(vmid: number, proxmoxConnectionId?: string | null) {
    const qs = proxmoxConnectionId ? `?connectionId=${encodeURIComponent(proxmoxConnectionId)}` : '';
    const headers = { ...this.getHeaders(), ...(proxmoxConnectionId ? { 'x-proxmox-connection-id': proxmoxConnectionId } : {}) };
    const res = await this.swrFetch(`${API_BASE_URL}/vms/${vmid}/snapshots${qs}`, { headers });
    const data = await res.json();
    return data.data || [];
  }

  async createVmSnapshot(vmid: number, name: string, description: string, proxmoxConnectionId?: string | null) {
    const qs = proxmoxConnectionId ? `?connectionId=${encodeURIComponent(proxmoxConnectionId)}` : '';
    const headers = { ...this.getHeaders(), ...(proxmoxConnectionId ? { 'x-proxmox-connection-id': proxmoxConnectionId } : {}) };
    const res = await this.apiFetch(`${API_BASE_URL}/vms/${vmid}/snapshots${qs}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, description, proxmoxConnectionId }),
    });
    return await res.json();
  }

  async deleteVmSnapshot(vmid: number, name: string, proxmoxConnectionId?: string | null) {
    const qs = proxmoxConnectionId ? `?connectionId=${encodeURIComponent(proxmoxConnectionId)}` : '';
    const headers = { ...this.getHeaders(), ...(proxmoxConnectionId ? { 'x-proxmox-connection-id': proxmoxConnectionId } : {}) };
    const res = await this.swrFetch(`${API_BASE_URL}/vms/${vmid}/snapshots/${encodeURIComponent(name)}${qs}`, {
      method: 'DELETE',
      headers,
    });
    return await res.json();
  }

  // ==========================================
  // VM FIREWALL RULES
  // ==========================================
  async getFirewallRules(vmid: number, proxmoxConnectionId?: string | null) {
    const qs = proxmoxConnectionId ? `?connectionId=${encodeURIComponent(proxmoxConnectionId)}` : '';
    const headers = { ...this.getHeaders(), ...(proxmoxConnectionId ? { 'x-proxmox-connection-id': proxmoxConnectionId } : {}) };
    const res = await this.swrFetch(`${API_BASE_URL}/client/vms/${vmid}/firewall${qs}`, { headers });
    return await res.json();
  }

  async toggleFirewall(vmid: number, enable: boolean, proxmoxConnectionId?: string | null) {
    const qs = proxmoxConnectionId ? `?connectionId=${encodeURIComponent(proxmoxConnectionId)}` : '';
    const headers = { ...this.getHeaders(), ...(proxmoxConnectionId ? { 'x-proxmox-connection-id': proxmoxConnectionId } : {}) };
    const res = await this.apiFetch(`${API_BASE_URL}/client/vms/${vmid}/firewall/toggle${qs}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ enable, proxmoxConnectionId }),
    });
    return await res.json();
  }

  async addFirewallRule(vmid: number, rule: { action: string; type: string; proto?: string; dport?: string; enable?: boolean; comment?: string }, proxmoxConnectionId?: string | null) {
    const qs = proxmoxConnectionId ? `?connectionId=${encodeURIComponent(proxmoxConnectionId)}` : '';
    const headers = { ...this.getHeaders(), ...(proxmoxConnectionId ? { 'x-proxmox-connection-id': proxmoxConnectionId } : {}) };
    const res = await this.apiFetch(`${API_BASE_URL}/client/vms/${vmid}/firewall${qs}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...rule, proxmoxConnectionId }),
    });
    return await res.json();
  }

  async deleteFirewallRule(vmid: number, pos: number, proxmoxConnectionId?: string | null) {
    const qs = proxmoxConnectionId ? `?connectionId=${encodeURIComponent(proxmoxConnectionId)}` : '';
    const headers = { ...this.getHeaders(), ...(proxmoxConnectionId ? { 'x-proxmox-connection-id': proxmoxConnectionId } : {}) };
    const res = await this.apiFetch(`${API_BASE_URL}/client/vms/${vmid}/firewall/${pos}${qs}`, {
      method: 'DELETE',
      headers,
    });
    return await res.json();
  }

  // ==========================================
  
  // USER EDIT + PASSWORD RESET (ADMIN)
  async updateAdminUser(userId: number, payload: { name?: string; email?: string; role?: string; phone?: string }) {
    try {
      const res = await this.apiFetch(`${API_BASE_URL}/admin/users/${userId}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  }

  async resetAdminUserPassword(userId: number, newPassword: string, confirmPassword: string) {
    try {
      const res = await this.apiFetch(`${API_BASE_URL}/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ newPassword, confirmPassword }),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  }

  // CLUSTER CONNECTION EDIT
  async updateProxmoxConnection(id: string, payload: any) {
    try {
      const res = await this.apiFetch(`${API_BASE_URL}/admin/proxmox/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  }

  // AUDIT LOGS
  async getFilteredAuditLogs(params: { action?: string; user_email?: string; status?: string; q?: string; limit?: number; offset?: number } = {}) {
    try {
      const qs = new URLSearchParams();
      if (params.action) qs.set('action', params.action);
      if (params.user_email) qs.set('user_email', params.user_email);
      if (params.status) qs.set('status', params.status);
      if (params.q) qs.set('q', params.q);
      if (params.limit) qs.set('limit', String(params.limit));
      if (params.offset) qs.set('offset', String(params.offset));
      const res = await this.swrFetch(`${API_BASE_URL}/audit-logs/filtered?${qs.toString()}`, { headers: this.getHeaders() });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error. Please check your connection.', total: 0, data: [] };
    }
  }

  async getAuditLogStats() {
    try {
      const res = await this.swrFetch(`${API_BASE_URL}/audit-logs/stats`, { headers: this.getHeaders() });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error.', data: { total: 0, byAction: [], byStatus: [], byUser: [] } };
    }
  }

  // MAIL TEMPLATES
  async getMailTemplates() {
    try {
      const res = await this.swrFetch(`${API_BASE_URL}/admin/mail-templates`, { headers: this.getHeaders() });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error.', data: [] };
    }
  }

  async updateMailTemplate(key: string, payload: { subject?: string; body?: string; enabled?: boolean }) {
    try {
      const res = await this.swrFetch(`${API_BASE_URL}/admin/mail-templates/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error.' };
    }
  }

  // MAIL NOTIFICATIONS
  async getMailNotifications() {
    try {
      const res = await this.swrFetch(`${API_BASE_URL}/admin/settings/mail-notifications`, { headers: this.getHeaders() });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error.', data: {} };
    }
  }

  async updateMailNotifications(payload: any) {
    try {
      const res = await this.apiFetch(`${API_BASE_URL}/admin/settings/mail-notifications`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error.' };
    }
  }

  // PLATFORM SETTINGS
  async getPublicPlatformSettings() {
    try {
      const res = await this.swrFetch(`${API_BASE_URL}/settings/public`);
      return await res.json();
    } catch {
      return { success: false, error: 'Network error.', data: { faviconUrl: '/votion-logo-metallic.png', timezone: 'Asia/Kolkata' } };
    }
  }
  async getPlatformSettings() {
    try {
      const res = await this.swrFetch(`${API_BASE_URL}/admin/settings/platform`, { headers: this.getHeaders() });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error.', data: null };
    }
  }
  async savePlatformSettings(payload: { faviconUrl: string; timezone: string }) {
    try {
      const res = await this.apiFetch(`${API_BASE_URL}/admin/settings/platform`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error.' };
    }
  }
  // SMTP (API v1)
  async getSmtpConfig() {
    try {
      const res = await this.swrFetch(`${API_BASE_URL}/admin/settings/smtp`, { headers: this.getHeaders() });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error.', data: null };
    }
  }

  async saveSmtpConfig(config: any) {
    try {
      const res = await this.apiFetch(`${API_BASE_URL}/admin/settings/smtp`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(config),
      });
      return await res.json();
    } catch {
      return { success: false, error: 'Network error.' };
    }
  }

  async testSmtp(testEmail: string) {
    try {
      const res = await this.apiFetch(`${API_BASE_URL}/admin/settings/smtp/test`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ testEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        return { success: false, error: data.error || data.message || `SMTP test failed (HTTP ${res.status}).` };
      }
      return data;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unable to reach the Votion API while testing SMTP.' };
    }
  }

// ALERT RULES & NOTIFICATIONS
  // ==========================================
  async getAlertRules() {
    const res = await this.swrFetch(`${API_BASE_URL}/alert-rules`, { headers: this.getHeaders() });
    return await res.json();
  }

  async createAlertRule(rule: any) {
    const res = await this.apiFetch(`${API_BASE_URL}/alert-rules`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(rule),
    });
    return await res.json();
  }

  async updateAlertRule(id: number, rule: any) {
    const res = await this.apiFetch(`${API_BASE_URL}/alert-rules/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(rule),
    });
    return await res.json();
  }

  async deleteAlertRule(id: number) {
    const res = await this.apiFetch(`${API_BASE_URL}/alert-rules/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return await res.json();
  }

  async getNotifications(unreadOnly: boolean = false): Promise<{ success: boolean; unreadCount: number; count: number; data: ApiNotification[] }> {
    const res = await this.swrFetch(`${API_BASE_URL}/notifications?unreadOnly=${unreadOnly}`, { headers: this.getHeaders() });
    return await res.json();
  }

  async markNotificationsRead(ids?: number[]) {
    const res = await this.apiFetch(`${API_BASE_URL}/notifications/read`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ids: ids || [] }),
    });
    return await res.json();
  }

  async deleteNotification(id: number) {
    const res = await this.apiFetch(`${API_BASE_URL}/notifications/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return await res.json();
  }

  async clearNotifications() {
    const res = await this.apiFetch(`${API_BASE_URL}/notifications/clear`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return await res.json();
  }

  // ==========================================
  // TELEMETRY EXPORT
  // ==========================================
  async getTelemetryHistoryFull() {
    const res = await this.swrFetch(`${API_BASE_URL}/telemetry/history`, { headers: this.getHeaders() });
    return await res.json();
  }

  async downloadTelemetryReport(hours: number, vmid?: number) {
    const query = new URLSearchParams({ hours: String(hours) });
    if (vmid) query.set('vmid', String(vmid));
    const res = await this.swrFetch(`${API_BASE_URL}/telemetry/report?${query.toString()}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error(`Telemetry report request failed (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `votion-performance-report-${vmid ? `vm${vmid}-` : ''}${hours}h-${Date.now()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async downloadTelemetryExport(format: 'csv' | 'json' = 'csv', range: '1h' | '24h' | '7d' = '24h') {
    const url = `${API_BASE_URL}/telemetry/export?format=${format}&range=${range}`;
    if (format === 'csv') {
      window.open(url, '_blank');
      return;
    }
    const res = await this.swrFetch(url, { headers: this.getHeaders() });
    const json = await res.json();
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lunar-telemetry-${range}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async downloadVmTelemetryExport(vmid: number, format: 'csv' | 'json' = 'csv', range: '1h' | '24h' | '7d' = '24h') {
    const token = this.getToken();
    const url = `${API_BASE_URL}/client/vms/${vmid}/export?format=${format}&range=${range}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
    if (format === 'csv') {
      window.open(url, '_blank');
      return;
    }
    const res = await this.swrFetch(url, { headers: this.getHeaders() });
    const json = await res.json();
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vm-${vmid}-telemetry-${range}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  private async automationFetch(path: string, options: RequestInit = {}) {
    const headers = new Headers(this.getHeaders());
    new Headers(options.headers || {}).forEach((value, key) => headers.set(key, value));
    const res = await this.apiFetch(`${API_ORIGIN}/api/automation${path}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Automation request failed (${res.status})`);
    return data;
  }

  async checkRescue(vmid: number) { return this.automationFetch(`/vms/${vmid}/rescue/check`); }
  async enterRescueMode(vmid: number) { return this.automationFetch(`/vms/${vmid}/rescue/enter`, { method: 'POST' }); }
  async exitRescueMode(vmid: number) { return this.automationFetch(`/vms/${vmid}/rescue/exit`, { method: 'POST' }); }
  async getBandwidth(vmid: number) { return this.automationFetch(`/vms/${vmid}/bandwidth`); }
  async getQuota(vmid: number) { return this.automationFetch(`/vms/${vmid}/quota`); }
  async setQuota(vmid: number, bandwidthGb: number) { return this.automationFetch(`/vms/${vmid}/quota`, { method: 'PUT', body: JSON.stringify({ bandwidthGb }) }); }
  async getRdnsRequests(vmid: number) { return this.automationFetch(`/vms/${vmid}/rdns-requests`); }
  async requestRdns(vmid: number, ip: string, ptr: string) { return this.automationFetch(`/vms/${vmid}/rdns`, { method: 'POST', body: JSON.stringify({ ip, ptr }) }); }
  async getAppCatalogWithTemplates(vmid: number) { return this.automationFetch(`/apps/catalog?withTemplates=1&vmid=${vmid}`); }
  async deployApp(appId: string, vmid: number) { return this.automationFetch(`/apps/${encodeURIComponent(appId)}/deploy`, { method: 'POST', body: JSON.stringify({ vmid }) }); }
  async getUserApiKeys() { return this.automationFetch('/user/api-keys'); }
  async createApiKey(name: string, scope: 'read' | 'power' | 'full') { return this.automationFetch('/user/api-keys', { method: 'POST', body: JSON.stringify({ name, scope }) }); }
  async deleteApiKey(id: number) { return this.automationFetch(`/user/api-keys/${id}`, { method: 'DELETE' }); }
  async getSubUsers(vmid: number) { return this.automationFetch(`/vms/${vmid}/sub-users`); }
  async addSubUser(vmid: number, email: string, scope: 'readonly' | 'power' | 'full') { return this.automationFetch(`/vms/${vmid}/sub-users`, { method: 'POST', body: JSON.stringify({ email, scope }) }); }
  async updateSubUser(vmid: number, id: number, scope: 'readonly' | 'power' | 'full') { return this.automationFetch(`/vms/${vmid}/sub-users/${id}`, { method: 'PUT', body: JSON.stringify({ scope }) }); }
  async removeSubUser(vmid: number, id: number) { return this.automationFetch(`/vms/${vmid}/sub-users/${id}`, { method: 'DELETE' }); }

  // --- OVH Settings (Admin) ---
  async getOvhSettings() {
    const res = await this.swrFetch(`${API_BASE_URL}/admin/settings/ovh`, { headers: this.getHeaders() });
    return await res.json();
  }

  async saveOvhSettings(settings: any) {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/settings/ovh`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(settings)
    });
    return await res.json();
  }

  async testOvhSettings() {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/settings/ovh/test`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    return await res.json();
  }

  async generateOvhConsumerKey(endpoint?: string, applicationKey?: string): Promise<{ success: boolean; consumerKey?: string; validationUrl?: string; error?: string }> {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/settings/ovh/generate-key`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ endpoint, applicationKey }),
    });
    return await res.json();
  }

  // --- OVH Client VM IP controls ---
  async getOvhStatus(vmid: number) {
    const res = await this.swrFetch(`${API_BASE_URL}/client/vms/${vmid}/ovh/status`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to fetch OVH status.');
    return data.data;
  }

  async setOvhRdns(vmid: number, reverse: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/client/vms/${vmid}/ovh/rdns`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ reverse })
    });
    return await res.json();
  }

  async setOvhDdos(vmid: number, mode: 'automatic' | 'permanent') {
    const res = await this.apiFetch(`${API_BASE_URL}/client/vms/${vmid}/ovh/ddos`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ mode })
    });
    return await res.json();
  }

  async toggleOvhFirewall(vmid: number, enabled: boolean) {
    const res = await this.apiFetch(`${API_BASE_URL}/client/vms/${vmid}/ovh/firewall/toggle`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ enabled })
    });
    return await res.json();
  }


  async unblockOvhAntiHack(vmid: number) {
    return await this.apiFetch(`${API_BASE_URL}/client/vms/${vmid}/ovh/unblock`, { method: 'POST', headers: this.getHeaders() });
  }
  
  async unblockOvhAntiHackGlobal(ip: string) {
    return await this.swrFetch(`${API_BASE_URL}/api/ovh/ip/${encodeURIComponent(ip)}/unblock`, { method: 'POST', headers: this.getHeaders() });
  }

  async getOvhFirewallRules(vmid: number) {
    const res = await this.swrFetch(`${API_BASE_URL}/client/vms/${vmid}/ovh/firewall/rules`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to fetch OVH firewall rules.');
    return data.data || [];
  }

  async addOvhFirewallRule(vmid: number, rule: any) {
    const res = await this.apiFetch(`${API_BASE_URL}/client/vms/${vmid}/ovh/firewall/rules`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(rule)
    });
    return await res.json();
  }

  async deleteOvhFirewallRule(vmid: number, sequence: number) {
    const res = await this.apiFetch(`${API_BASE_URL}/client/vms/${vmid}/ovh/firewall/rules/${sequence}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return await res.json();
  }

  async getOvhGameRules(vmid: number) {
    const res = await this.swrFetch(`${API_BASE_URL}/client/vms/${vmid}/ovh/game-ddos`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to fetch OVH game DDoS rules.');
    return data.data || [];
  }

  async addOvhGameRule(vmid: number, rule: any) {
    const res = await this.apiFetch(`${API_BASE_URL}/client/vms/${vmid}/ovh/game-ddos`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(rule)
    });
    return await res.json();
  }

  async deleteOvhGameRule(vmid: number, ruleId: number) {
    const res = await this.apiFetch(`${API_BASE_URL}/client/vms/${vmid}/ovh/game-ddos/${ruleId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return await res.json();
  }

  // --- OVH Admin IP Manager controls ---
  async getAdminOvhIps(): Promise<string[]> {
    const res = await this.swrFetch(`${API_BASE_URL}/admin/ovh/ips`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to fetch OVH account IPs.');
    return data.data || [];
  }

  async getAdminOvhStatus(ip: string) {
    const res = await this.swrFetch(`${API_BASE_URL}/admin/ovh/status?ip=${encodeURIComponent(ip)}`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to fetch OVH status.');
    return data.data;
  }

  async unblockAdminOvhAntiHack(ip: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/ovh/antihack/unblock`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ip })
    });
    return await res.json();
  }

  async setAdminOvhRdns(ip: string, reverse: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/ovh/rdns`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ip, reverse })
    });
    return await res.json();
  }

  async setAdminOvhDdos(ip: string, mode: 'automatic' | 'permanent') {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/ovh/ddos`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ip, mode })
    });
    return await res.json();
  }

  async createAdminOvhMac(ip: string, mac?: string, syncToVm = true): Promise<{ success: boolean; data?: { ip: string; macAddress: string; serviceName?: string; syncedToVm: boolean }; message?: string; error?: string }> {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/ovh/mac/create`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ip, mac, syncToVm })
    });
    return await res.json();
  }

  async resetAdminOvhMac(ip: string, mac?: string, syncToVm = true): Promise<{ success: boolean; data?: { ip: string; macAddress: string; serviceName?: string; syncedToVm: boolean }; message?: string; error?: string }> {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/ovh/mac/reset`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ip, mac, syncToVm })
    });
    return await res.json();
  }

  async setAdminOvhMitigationProfile(ip: string, timeout: number) {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/ovh/mitigation-profile`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ip, timeout })
    });
    return await res.json();
  }

  async getAdminOvhAttacks(ip: string): Promise<{
    ip: string;
    isUnderAttack: boolean;
    mitigationState: string;
    mitigationMode: 'automatic' | 'permanent';
    autoMitigationTimeout: number;
    liveTraffic: {
      inBps: number;
      outBps: number;
      droppedBps: number;
      passedBps: number;
      inPps: number;
      droppedPps: number;
    } | null;
    liveStatsSeries: Array<{ timestamp: number; inBps: number; droppedBps: number; passedBps: number; pps: number }>;
    events: Array<{
      id: string | number;
      startDate: string;
      endDate?: string | null;
      durationSeconds?: number;
      attackType: string;
      vectors: string[];
      peakBps: number;
      peakPps: number;
      totalDroppedBytes: number;
      totalPassedBytes: number;
      status: 'mitigating' | 'resolved';
    }>;
  }> {
    const res = await this.swrFetch(`${API_BASE_URL}/admin/ovh/attacks?ip=${encodeURIComponent(ip)}`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to fetch attack telemetry.');
    return data.data;
  }

  async getAdminOvhAttackEventStats(ip: string, eventId: string | number) {
    const res = await this.swrFetch(`${API_BASE_URL}/admin/ovh/attacks/events/${encodeURIComponent(String(eventId))}/stats?ip=${encodeURIComponent(ip)}`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to fetch attack event stats.');
    return data.data || [];
  }

  async getAdminFleetDdosStatus(): Promise<ApiFleetDdosStatus> {
    try {
      const res = await this.swrFetch(`${API_BASE_URL}/admin/ddos/fleet-status`, { headers: this.getHeaders() });
      const data = await this.readApiResponse(res, 'Unable to fetch fleet DDoS status.');
      return data.data;
    } catch {
      return {
        isAnyUnderAttack: false,
        activeAttacksCount: 0,
        attacks: [],
        totalInboundRateBps: 0,
        totalScrubbedRateBps: 0,
        totalPassedRateBps: 0,
        checkedAt: new Date().toISOString(),
        checkedBlocksCount: 0,
      };
    }
  }

  async toggleAdminOvhFirewall(ip: string, enabled: boolean) {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/ovh/firewall/toggle`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ip, enabled })
    });
    return await res.json();
  }

  async getAdminOvhFirewallRules(ip: string) {
    const res = await this.swrFetch(`${API_BASE_URL}/admin/ovh/firewall/rules?ip=${encodeURIComponent(ip)}`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to fetch OVH firewall rules.');
    return data.data || [];
  }

  async addAdminOvhFirewallRule(ip: string, rule: any) {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/ovh/firewall/rules`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ip, ...rule })
    });
    return await res.json();
  }

  async deleteAdminOvhFirewallRule(ip: string, sequence: number) {
    const res = await this.swrFetch(`${API_BASE_URL}/admin/ovh/firewall/rules/${sequence}?ip=${encodeURIComponent(ip)}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return await res.json();
  }

  async getAdminOvhGameRules(ip: string) {
    const res = await this.swrFetch(`${API_BASE_URL}/admin/ovh/game-ddos?ip=${encodeURIComponent(ip)}`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to fetch OVH game DDoS rules.');
    return data.data || [];
  }

  async addAdminOvhGameRule(ip: string, rule: any) {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/ovh/game-ddos`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ip, ...rule })
    });
    return await res.json();
  }

  async deleteAdminOvhGameRule(ip: string, ruleId: number) {
    const res = await this.swrFetch(`${API_BASE_URL}/admin/ovh/game-ddos/${ruleId}?ip=${encodeURIComponent(ip)}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return await res.json();
  }

  // --- Hetzner Admin Settings & IP Controls ---
  async getHetznerConfig() {
    const res = await this.swrFetch(`${API_BASE_URL}/admin/settings/hetzner`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to fetch Hetzner configuration.');
    return data.data;
  }

  async saveHetznerConfig(config: { enabled: boolean; user: string; password?: string }) {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/settings/hetzner`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(config)
    });
    return await res.json();
  }

  async testHetznerConnection() {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/settings/hetzner/test`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    return await res.json();
  }

  async getAdminHetznerIps(): Promise<{ ips: Array<{ ip: string; serverIp?: string; serverNumber?: number; locked?: boolean; separateMac?: string | null }>; subnets: Array<{ ip: string; mask: number; serverIp?: string; serverNumber?: number; failover?: boolean; locked?: boolean }> }> {
    const res = await this.swrFetch(`${API_BASE_URL}/admin/hetzner/ips`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to fetch Hetzner account IPs.');
    return data.data || { ips: [], subnets: [] };
  }

  async getAdminHetznerStatus(ip: string) {
    const res = await this.swrFetch(`${API_BASE_URL}/admin/hetzner/status?ip=${encodeURIComponent(ip)}`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to fetch Hetzner status.');
    return data.data;
  }

  async setAdminHetznerRdns(ip: string, reverse: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/hetzner/rdns`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ip, reverse })
    });
    return await res.json();
  }

  async generateAdminHetznerMac(ip: string, syncToVm: boolean = true) {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/hetzner/mac/generate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ip, syncToVm })
    });
    return await res.json();
  }

  async deleteAdminHetznerMac(ip: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/admin/hetzner/mac/delete`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ip })
    });
    return await res.json();
  }

  // --- Hetzner Client VM Controls ---
  async getClientHetznerStatus(vmid: number) {
    const res = await this.swrFetch(`${API_BASE_URL}/client/vms/${vmid}/hetzner/status`, { headers: this.getHeaders() });
    const data = await this.readApiResponse(res, 'Unable to fetch VM Hetzner network status.');
    return data.data;
  }

  async setClientHetznerRdns(vmid: number, reverse: string) {
    const res = await this.apiFetch(`${API_BASE_URL}/client/vms/${vmid}/hetzner/rdns`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ reverse })
    });
    return await res.json();
  }

  async generateClientHetznerMac(vmid: number) {
    const res = await this.apiFetch(`${API_BASE_URL}/client/vms/${vmid}/hetzner/mac/generate`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    return await res.json();
  }

  async deleteClientHetznerMac(vmid: number) {
    const res = await this.apiFetch(`${API_BASE_URL}/client/vms/${vmid}/hetzner/mac/delete`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    return await res.json();
  }
}

export const apiClient = new ApiClient();
