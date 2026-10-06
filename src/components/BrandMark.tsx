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
      <div className="absolute inset-0 rounded-[18px] bg-gradient-to-br from-[#f6e8b2] via-[#d9b76a] to-[#9b7a3f] shadow-[0_10px_26px_rgba(210,171,94,0.28)]" />
      <div className="absolute inset-[2px] rounded-[16px] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.45),_rgba(15,23,42,0.82)_40%,_rgba(2,6,23,0.96))] ring-1 ring-white/20" />
      <div className="absolute inset-0 rounded-[18px] bg-[linear-gradient(135deg,rgba(255,255,255,0.32),transparent_35%,transparent_65%,rgba(255,255,255,0.14))]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 48 48" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="AcadPulse logo">
          <defs>
            <linearGradient id="brand-gold" x1="8" y1="8" x2="38" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fff7d6" />
              <stop offset="0.32" stopColor="#f2dd96" />
              <stop offset="0.72" stopColor="#d2a34b" />
              <stop offset="1" stopColor="#8a6833" />
            </linearGradient>
          </defs>
          <path d="M14 31L24 12L34 31" stroke="url(#brand-gold)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18 25.5H30" stroke="url(#brand-gold)" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M24 31V22.5" stroke="url(#brand-gold)" strokeWidth="2.8" strokeLinecap="round" />
          <circle cx="35.5" cy="12.5" r="2.8" fill="#F7E9B7" />
        </svg>
      </div>
    </div>
  );
};
