import React, { useRef, useState } from 'react';

interface MagneticButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

export const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  onClick,
  className = '',
  variant = 'primary',
  type = 'button',
  disabled = false,
}) => {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Only apply magnetic pull on desktop and if reduced motion is disabled
    if (window.innerWidth < 1024 || window.matchMedia('(prefers-reduced-motion: reduce)').matches || disabled) {
      return;
    }

    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    // Dampen the magnetic pull to max 6px
    setPosition({ x: x * 0.22, y: y * 0.22 });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
    setIsHovered(false);
  };

  const baseStyles =
    'relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl font-display text-xs font-bold uppercase tracking-wider transition-all duration-200 select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#CCFF00]/60 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none';

  const variantStyles = {
    primary:
      'bg-[#CCFF00] text-black hover:bg-[#b8e600] shadow-lg shadow-[#CCFF00]/25 hover:shadow-xl hover:shadow-[#CCFF00]/40',
    secondary:
      'border border-[#303540] bg-[#14171d] text-white hover:border-[#CCFF00]/50 hover:bg-[#1b1e26] hover:text-[#CCFF00]',
    outline:
      'border border-[#303540] bg-[#14171d] text-white hover:border-[#CCFF00]/50 hover:bg-[#1b1e26] hover:text-[#CCFF00]',
    ghost:
      'border border-transparent bg-transparent text-[#9ca3af] hover:text-white hover:bg-zinc-800/40',
  };

  return (
    <button
      ref={buttonRef}
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        transition: isHovered ? 'transform 0.1s ease-out' : 'transform 0.35s ease-out',
      }}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      {/* Light sweep gleam across button */}
      <div
        className={`pointer-events-none absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-25deg] transition-transform duration-700 ${
          isHovered ? 'translate-x-[350%]' : '-translate-x-[150%]'
        }`}
      />
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
};
