import React, { useRef, useState } from 'react';

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  spotlightColor?: string;
}

export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = '',
  onClick,
  spotlightColor = 'rgba(204, 255, 0, 0.12)',
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Skip expensive 3D tilt on mobile/touch screens or reduced motion
    if (window.innerWidth < 1024 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMousePos({ x, y });

    // Calculate subtle 3D tilt (-4deg to +4deg)
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const tiltX = ((y - centerY) / centerY) * -4;
    const tiltY = ((x - centerX) / centerX) * 4;

    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
  };

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(0)`,
        transition: isHovered
          ? 'transform 0.12s ease-out, border-color 0.25s ease'
          : 'transform 0.4s ease-out, border-color 0.25s ease',
      }}
      className={`group relative overflow-hidden rounded-2xl border border-[#232731] bg-[#111317] ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {/* Radial Spotlight Follower */}
      {isHovered && (
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300 z-0"
          style={{
            background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, ${spotlightColor}, transparent 80%)`,
          }}
        />
      )}

      {/* Subtle border highlight */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl border border-transparent group-hover:border-[#CCFF00]/40 transition-colors duration-300 z-10"
      />

      {/* Card Content */}
      <div className="relative z-20 h-full w-full">
        {children}
      </div>
    </div>
  );
};
