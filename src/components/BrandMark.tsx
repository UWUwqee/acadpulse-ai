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
      <div className="absolute inset-0 rounded-[16px] bg-gradient-to-br from-[#f8e7b6] via-[#d4a85e] to-[#8f6835] shadow-[0_10px_24px_rgba(206,154,78,0.22)]" />
      <div className="absolute inset-[2px] rounded-[13px] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.52),_rgba(15,23,42,0.9)_52%,_rgba(2,6,23,0.96))] ring-1 ring-white/15" />
      <div className="absolute inset-0 rounded-[16px] bg-[linear-gradient(135deg,rgba(255,255,255,0.32),transparent_40%,transparent_60%,rgba(255,255,255,0.16))]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 48 48" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="AcadPulse logo">
          <defs>
            <linearGradient id="brand-gold" x1="10" y1="10" x2="36" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fff8db" />
              <stop offset="0.34" stopColor="#f0d98f" />
              <stop offset="0.7" stopColor="#d4a653" />
              <stop offset="1" stopColor="#8e6b39" />
            </linearGradient>
          </defs>
          <path d="M14 31L24 12L34 31" stroke="url(#brand-gold)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18 25.5H30" stroke="url(#brand-gold)" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M24 31V22.5" stroke="url(#brand-gold)" strokeWidth="2.8" strokeLinecap="round" />
          <circle cx="35.5" cy="12.5" r="2.8" fill="#f8e9b3" />
        </svg>
      </div>
    </div>
  );
};
