import React from 'react';
import { CarrierType } from '../utils/ipUtils';

/**
 * Clean, official vector logo for OVHcloud.
 */
export const OvhLogo: React.FC<{ className?: string; size?: number; title?: string }> = ({
  className = '',
  size = 14,
  title = 'OVHcloud',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline-block shrink-0 ${className}`}
    style={{ width: size, height: size }}
    aria-label={title}
    role="img"
  >
    <title>{title}</title>
    <rect width="24" height="24" rx="5" fill="#0050D7" />
    <path
      d="M12 4.2L4.5 9.8V14.2L12 19.8L19.5 14.2V9.8L12 4.2ZM12 7.1L16.8 10.7L12 14.3L7.2 10.7L12 7.1Z"
      fill="#FFFFFF"
    />
    <path
      d="M12 9.5L14.2 11.2L12 12.9L9.8 11.2L12 9.5Z"
      fill="#00D1C1"
    />
  </svg>
);

/**
 * Clean, official vector logo for Hetzner Online.
 */
export const HetznerLogo: React.FC<{ className?: string; size?: number; title?: string }> = ({
  className = '',
  size = 14,
  title = 'Hetzner Online',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline-block shrink-0 ${className}`}
    style={{ width: size, height: size }}
    aria-label={title}
    role="img"
  >
    <title>{title}</title>
    <rect width="24" height="24" rx="5" fill="#D50C2D" />
    <path
      d="M6.5 5.5H9.2V10.2H14.8V5.5H17.5V18.5H14.8V12.8H9.2V18.5H6.5V5.5Z"
      fill="#FFFFFF"
    />
  </svg>
);

/**
 * Clean vector icon for non-OVH / third-party / custom guest networks.
 */
export const OtherNetworkLogo: React.FC<{ className?: string; size?: number; title?: string }> = ({
  className = '',
  size = 14,
  title = 'Other Network',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline-block shrink-0 ${className}`}
    style={{ width: size, height: size }}
    aria-label={title}
    role="img"
  >
    <title>{title}</title>
    <rect width="24" height="24" rx="5" fill="#4B5563" />
    <circle cx="12" cy="12" r="7.5" stroke="#FFFFFF" strokeWidth="1.5" />
    <ellipse cx="12" cy="12" rx="3.5" ry="7.5" stroke="#FFFFFF" strokeWidth="1.2" />
    <line x1="4.5" y1="12" x2="19.5" y2="12" stroke="#FFFFFF" strokeWidth="1.2" />
  </svg>
);

/**
 * Compact, neat logo badge component replacing verbose carrier text tags.
 */
export const CarrierLogoBadge: React.FC<{
  carrier: CarrierType;
  size?: number;
  showTooltip?: boolean;
  showText?: boolean;
}> = ({ carrier, size = 15, showTooltip = true, showText = false }) => {
  if (carrier === 'ovh') {
    return (
      <span
        title={showTooltip ? 'OVHcloud Network' : undefined}
        className="inline-flex items-center gap-1.5 align-middle select-none"
      >
        <OvhLogo size={size} />
        {showText && <span className="text-[11px] font-medium text-[#0050D7] dark:text-[#60a5fa]">OVH</span>}
      </span>
    );
  }

  if (carrier === 'hetzner') {
    return (
      <span
        title={showTooltip ? 'Hetzner Online Network' : undefined}
        className="inline-flex items-center gap-1.5 align-middle select-none"
      >
        <HetznerLogo size={size} />
        {showText && <span className="text-[11px] font-medium text-[#D50C2D] dark:text-[#f87171]">Hetzner</span>}
      </span>
    );
  }

  return (
    <span
      title={showTooltip ? 'Other / Non-OVH Network' : undefined}
      className="inline-flex items-center gap-1.5 align-middle select-none"
    >
      <OtherNetworkLogo size={size} />
      {showText && <span className="text-[11px] font-medium text-[#6b7280] dark:text-[#9ca3af]">Other</span>}
    </span>
  );
};
