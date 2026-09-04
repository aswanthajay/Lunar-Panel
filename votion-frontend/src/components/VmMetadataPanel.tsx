import React from 'react';
import { ApiVmMetadata } from '../services/apiClient';

interface VmMetadataPanelProps {
  metadata: ApiVmMetadata | null;
  isLoading: boolean;
  error: string | null;
}

const valueOrUnavailable = (value: string | number | null | undefined) => value || 'Not reported';

const formatMemory = (memoryMb: number | null) => {
  if (!memoryMb) return 'Not reported';
  if (memoryMb >= 1024) return `${(memoryMb / 1024).toFixed(memoryMb % 1024 === 0 ? 0 : 1)} GB`;
  return `${memoryMb} MB`;
};

const DataPoint: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="min-w-0">
    <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#656b6b]">{label}</dt>
    <dd className={`mt-1 truncate text-xs text-[#1a1a1a] ${mono ? 'font-mono' : ''}`}>{value}</dd>
  </div>
);

export const VmMetadataPanel: React.FC<VmMetadataPanelProps> = ({ metadata, isLoading, error }) => (
  <section className="rounded-lg border border-[#dedfdf] bg-[#fbfaf9] p-4 sm:p-5" aria-labelledby="vm-metadata-title">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#dedfdf] pb-3">
      <div>
        <h4 id="vm-metadata-title" className="text-sm font-semibold tracking-tight text-[#1a1a1a]">Instance details</h4>
        <p className="mt-1 text-[11px] text-[#656b6b]">Network identity and hardware information for this server.</p>
      </div>
      {metadata && (
        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#656b6b]">
          Updated {new Date(metadata.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>

    {isLoading && !metadata && (
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 pt-4" aria-busy="true" aria-label="Loading instance details">
        {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-8 animate-pulse rounded bg-[#f1f1f1]" />)}
      </div>
    )}

    {!isLoading && error && !metadata && (
      <div className="theme-metadata-error" role="alert">
        <span className="theme-metadata-error-mark" aria-hidden="true">!</span>
        <div>
          <p className="theme-metadata-error-title">Instance details temporarily unavailable</p>
          <p className="theme-metadata-error-detail">{error}</p>
        </div>
      </div>
    )}

    {metadata && (
      <>
        <div className="grid grid-cols-1 gap-5 pt-4 lg:grid-cols-2 lg:gap-8">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h5 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#1a1a1a]">Network identity</h5>
            </div>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
              <DataPoint label="Primary IP" value={valueOrUnavailable(metadata.network.primaryIp)} mono />
              <DataPoint label="Cloud-Init IP" value={valueOrUnavailable(metadata.network.configuredIp)} mono />
              <DataPoint label="Gateway" value={valueOrUnavailable(metadata.network.gateway)} mono />
              <DataPoint label="MAC address" value={valueOrUnavailable(metadata.network.macAddress)} mono />
            </dl>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h5 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#1a1a1a]">Hardware profile</h5>
              <span className="font-mono text-[10px] text-[#656b6b]">{metadata.hardware.type.toUpperCase()}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
              <DataPoint label="vCPUs" value={valueOrUnavailable(metadata.hardware.vcpus)} mono />
              <DataPoint label="Memory" value={formatMemory(metadata.hardware.memoryMb)} mono />
              <DataPoint label="Machine" value={valueOrUnavailable(metadata.hardware.machine)} mono />
              <DataPoint label="CPU type" value={valueOrUnavailable(metadata.hardware.cpuType)} mono />
              <DataPoint label="Disk devices" value={metadata.hardware.disks.length || 'Not reported'} mono />
              <DataPoint label="Network adapters" value={metadata.hardware.networkAdapters || 'Not reported'} mono />
            </dl>
          </div>
        </div>

        {metadata.network.interfaces.length > 0 && (
          <div className="mt-5 border-t border-[#dedfdf] pt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h5 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#1a1a1a]">Interfaces</h5>
              <span className="text-[10px] text-[#656b6b]">{metadata.network.guestAgentAvailable ? 'Guest agent address available' : 'Configured values'}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-b border-[#dedfdf] text-[10px] uppercase tracking-[0.06em] text-[#656b6b]">
                    <th className="pb-2 pr-4 font-semibold">Interface</th>
                    <th className="pb-2 pr-4 font-semibold">IP address</th>
                    <th className="pb-2 pr-4 font-semibold">Gateway</th>
                    <th className="pb-2 pr-4 font-semibold">MAC address</th>
                    <th className="pb-2 font-semibold">Bridge</th>
                  </tr>
                </thead>
                <tbody>
                  {metadata.network.interfaces.map(entry => (
                    <tr key={`${entry.name}-${entry.macAddress || 'unknown'}`} className="border-b border-[#e9eaea] last:border-0">
                      <td className="py-2 pr-4 font-mono text-[#1a1a1a]">{entry.name}</td>
                      <td className="py-2 pr-4 font-mono text-[#1a1a1a]">{valueOrUnavailable(entry.ipAddress)}</td>
                      <td className="py-2 pr-4 font-mono text-[#1a1a1a]">{valueOrUnavailable(entry.gateway)}</td>
                      <td className="py-2 pr-4 font-mono text-[#1a1a1a]">{valueOrUnavailable(entry.macAddress)}</td>
                      <td className="py-2 font-mono text-[#656b6b]">{valueOrUnavailable(entry.bridge)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#dedfdf] pt-3 text-[10px] text-[#656b6b]">
          <span>Guest agent: {metadata.network.guestAgentAvailable ? 'Available' : 'Not available'}</span>
          <span>Ballooning: {metadata.hardware.ballooning === null ? 'Not reported' : metadata.hardware.ballooning ? 'Enabled' : 'Disabled'}</span>
          {metadata.hardware.qemuGuestAgent !== null && <span>Guest integration agent: {metadata.hardware.qemuGuestAgent ? 'Active' : 'Disabled'}</span>}
        </div>
      </>
    )}
  </section>
);
