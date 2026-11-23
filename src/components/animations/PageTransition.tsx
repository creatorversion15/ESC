import React, { useEffect, useState } from 'react';

interface PageTransitionProps {
  children: React.ReactNode;
  routeKey: string;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children, routeKey }) => {
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    setIsRendered(false);
    const raf = requestAnimationFrame(() => {
      setIsRendered(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [routeKey]);

  return (
    <div
      style={{
        opacity: isRendered ? 1 : 0,
        transform: isRendered ? 'translate3d(0, 0, 0)' : 'translate3d(0, 10px, 0)',
        transition: 'opacity 350ms cubic-bezier(0.16, 1, 0.3, 1), transform 350ms cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'opacity, transform',
      }}
      className="w-full"
    >
      {children}
    </div>
  );
};
