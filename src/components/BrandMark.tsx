import React from 'react';

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({
  size = 'md',
  className = '',
}) => {
  const sizeMap = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };

  return (
    <div className={`relative ${sizeMap[size]} ${className}`}>
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 shadow-lg shadow-indigo-600/30" />
      <div className="absolute inset-[2px] rounded-[14px] bg-slate-950/80 ring-1 ring-white/10" />
      <div className="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 48 48" className="h-5 w-5 text-white" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="AcadPulse logo">
          <path d="M14 31L24 11L34 31" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18 26H30" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" />
          <path d="M24 31V23" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" />
          <circle cx="36" cy="12" r="3" fill="#A5B4FC" />
        </svg>
      </div>
    </div>
  );
};
