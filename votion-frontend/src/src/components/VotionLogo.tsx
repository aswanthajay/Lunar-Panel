import React, { useEffect, useState } from 'react';

export interface VotionLogoProps {
  className?: string;
  theme?: 'dark' | 'light';
  speedSeconds?: number;
  fontSize?: number;
  height?: number;
}

export const VotionLogo: React.FC<VotionLogoProps> = ({
  className = '',
  theme,
  speedSeconds = 3.6,
  fontSize = 15,
  height = 31,
}) => {
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>(() => {
    if (theme) return theme;
    if (typeof document !== 'undefined') {
      const isDocDark = document.documentElement.getAttribute('data-theme') === 'dark' || document.documentElement.classList.contains('dark');
      return isDocDark ? 'dark' : 'light';
    }
    return 'dark';
  });

  useEffect(() => {
    if (theme) {
      setCurrentTheme(theme);
      return;
    }

    const checkTheme = () => {
      const isDocDark = document.documentElement.getAttribute('data-theme') === 'dark' || document.documentElement.classList.contains('dark');
      setCurrentTheme(isDocDark ? 'dark' : 'light');
    };

    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

    window.addEventListener('votion:theme-change', checkTheme);
    return () => {
      observer.disconnect();
      window.removeEventListener('votion:theme-change', checkTheme);
    };
  }, [theme]);

  const isDark = currentTheme === 'dark';

  return (
    <div
      className={`votion-comet-logo ${className}`}
      style={{
        position: 'relative',
        height: `${height}px`,
        boxSizing: 'border-box',
        padding: '3px',
        backgroundColor: isDark ? '#3f3f46' : '#1a1a1a',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        userSelect: 'none',
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {/* Comet Light Beam */}
      <span
        style={{
          position: 'absolute',
          top: '-150%',
          left: '-150%',
          width: '400%',
          height: '400%',
          pointerEvents: 'none',
          zIndex: 1,
          background: `conic-gradient(
            from 0deg,
            transparent 0deg,
            transparent 285deg,
            rgba(255, 255, 255, 0.04) 292deg,
            rgba(255, 255, 255, 0.15) 315deg,
            rgba(255, 255, 255, 0.40) 338deg,
            rgba(255, 255, 255, 0.80) 352deg,
            rgba(255, 255, 255, 0.98) 358deg,
            #FFFFFF 359deg,
            #FFFFFF 360deg
          )`,
          animation: `cometGlide ${speedSeconds}s linear infinite`,
        }}
      />

      {/* Inner Pill & Typography */}
      <span
        style={{
          position: 'relative',
          zIndex: 2,
          height: '100%',
          width: '100%',
          backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
          color: isDark ? '#ededed' : '#1a1a1a',
          padding: '0 11px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif',
          fontSize: `${fontSize}px`,
          fontWeight: 800,
          letterSpacing: '-0.04em',
          textTransform: 'lowercase',
          lineHeight: 1,
          boxShadow: isDark
            ? 'inset 0 0 0 1px rgba(255, 255, 255, 0.04)'
            : 'inset 0 0 0 1px rgba(0, 0, 0, 0.04)',
        }}
      >
        votion
      </span>

      <style>{`
        @keyframes cometGlide {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default VotionLogo;
