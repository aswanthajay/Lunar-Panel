/**
 * Utility functions for IP address evaluation and OVH subnet matching.
 */

export function ipToLong(ip: string): number {
  const clean = ip.split('/')[0].trim();
  const parts = clean.split('.').map(p => parseInt(p, 10));
  if (parts.length !== 4 || parts.some(isNaN)) return 0;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Checks if a given IP address belongs to any of the provided OVH CIDR subnets / IP blocks.
 */
export function isIpInSubnets(ip: string | null | undefined, subnets: string[]): boolean {
  if (!ip || !Array.isArray(subnets) || subnets.length === 0) return false;
  const cleanIp = ip.split('/')[0].trim();
  if (!cleanIp || !/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(cleanIp)) return false;

  try {
    const targetLong = ipToLong(cleanIp);
    for (const block of subnets) {
      const [subnet, maskStr] = block.trim().split('/');
      if (!subnet || !/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(subnet)) continue;
      const mask = maskStr !== undefined ? parseInt(maskStr, 10) : 32;
      if (mask === 32) {
        if (subnet === cleanIp) return true;
      } else {
        const subnetLong = ipToLong(subnet);
        const netmask = mask === 0 ? 0 : (~0 << (32 - mask)) >>> 0;
        if ((targetLong & netmask) === (subnetLong & netmask)) {
          return true;
        }
      }
    }
  } catch {
    return subnets.some(b => b.split('/')[0].trim() === cleanIp);
  }
  return false;
}

export type CarrierType = 'ovh' | 'hetzner' | 'custom';

export function getIpCarrierType(
  ip: string | null | undefined,
  ovhSubnets: string[] = [],
  hetznerSubnets: string[] = []
): {
  carrier: CarrierType;
  isOvh: boolean;
  isHetzner: boolean;
  label: string;
  shortLabel: string;
  badgeClass: string;
} {
  const isOvh = isIpInSubnets(ip, ovhSubnets);
  if (isOvh) {
    return {
      carrier: 'ovh',
      isOvh: true,
      isHetzner: false,
      label: 'OVHcloud IP',
      shortLabel: 'OVH IP',
      badgeClass: 'bg-[#dcfce7] dark:bg-[#064e3b]/50 text-[#15803d] dark:text-[#34d399] border-[#86efac] dark:border-[#059669]/50',
    };
  }

  const isHetzner = isIpInSubnets(ip, hetznerSubnets);
  if (isHetzner) {
    return {
      carrier: 'hetzner',
      isOvh: false,
      isHetzner: true,
      label: 'Hetzner Online IP',
      shortLabel: 'Hetzner IP',
      badgeClass: 'bg-[#dbeafe] dark:bg-[#1e3a8a]/50 text-[#1d4ed8] dark:text-[#60a5fa] border-[#93c5fd] dark:border-[#3b82f6]/50',
    };
  }

  return {
    carrier: 'custom',
    isOvh: false,
    isHetzner: false,
    label: 'Non-OVH IP',
    shortLabel: 'Non-OVH',
    badgeClass: 'bg-[#f3f4f6] dark:bg-[#262626] text-[#6b7280] dark:text-[#a1a1aa] border-[#d1d5db] dark:border-[#3f3f46]',
  };
}


/**
 * Numerically compares two IPv4 addresses (ascending).
 */
export function compareIps(a: string | null | undefined, b: string | null | undefined): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const numA = ipToLong(a);
  const numB = ipToLong(b);
  if (numA === 0 && numB === 0) return a.localeCompare(b);
  if (numA === 0) return 1;
  if (numB === 0) return -1;
  return numA - numB;
}

/**
 * Returns carrier priority for sorting: OVH (0) -> Hetzner (1) -> Other/Custom (2).
 */
export function getCarrierPriority(carrier: CarrierType | string | null | undefined): number {
  if (!carrier) return 2;
  const lower = String(carrier).toLowerCase();
  if (lower === 'ovh' || lower.includes('ovh')) return 0;
  if (lower === 'hetzner') return 1;
  return 2;
}

/**
 * Compares two items first by Carrier (OVH -> Hetzner -> Other), then numerically by IP address.
 */
export function compareCarrierAndIp(
  a: { ip?: string | null; carrier?: CarrierType | string },
  b: { ip?: string | null; carrier?: CarrierType | string }
): number {
  const prioA = getCarrierPriority(a.carrier);
  const prioB = getCarrierPriority(b.carrier);
  if (prioA !== prioB) {
    return prioA - prioB;
  }
  return compareIps(a.ip, b.ip);
}

export function getIpNetworkType(ip: string | null | undefined, subnets: string[]) {
  return getIpCarrierType(ip, subnets, []);
}

