import React from 'react';

// The logo mark is a tiny sentiment map: the red-to-green bar, and an original (ring)
// moving to its translation (dot) along a dashed line, on a cyan-to-violet tile.
export const LogoMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="logo-tile" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#22d3ee" />
        <stop offset="0.55" stopColor="#38bdf8" />
        <stop offset="1" stopColor="#8b5cf6" />
      </linearGradient>
      <linearGradient id="logo-bar" x1="0" x2="1">
        <stop offset="0" stopColor="#f87171" />
        <stop offset="0.5" stopColor="#facc15" />
        <stop offset="1" stopColor="#4ade80" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#logo-tile)" />
    <rect x="2.5" y="2.5" width="43" height="43" rx="12.5" fill="none" stroke="#fff" strokeOpacity="0.35" />
    <rect x="10" y="10.5" width="28" height="3.6" rx="1.8" fill="url(#logo-bar)" />
    <path d="M15.5 34 L31 23.5" stroke="#fff" strokeWidth="2" strokeDasharray="2.6 2.6" strokeLinecap="round" opacity="0.85" />
    <circle cx="15.5" cy="34" r="4" fill="none" stroke="#fff" strokeWidth="2.2" />
    <circle cx="31" cy="23.5" r="4.6" fill="#fff" />
  </svg>
);

export const Wordmark: React.FC = () => (
  <h1 className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
    <LogoMark className="w-11 h-11 sm:w-14 sm:h-14 drop-shadow-[0_6px_18px_rgba(56,189,248,0.35)]" />
    <span className="font-logo text-[28px] sm:text-5xl tracking-tight leading-none whitespace-nowrap">
      <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-500 dark:from-cyan-300 dark:via-sky-300 dark:to-violet-300">
        Sentiment
      </span>{' '}
      <span className="font-light text-slate-700 dark:text-slate-200">Translator</span>
    </span>
  </h1>
);
