import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
}

interface CircuitTrace {
  points: { x: number; y: number }[];
  progress: number;
  speed: number;
  length: number;
}

export const TechGridBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const isMobile = width < 768;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Particles: low count on mobile, max 36 on desktop
    const particleCount = prefersReducedMotion ? 0 : isMobile ? 12 : Math.min(Math.floor((width * height) / 38000), 38);
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        radius: Math.random() * 1.4 + 0.8,
        baseAlpha: Math.random() * 0.35 + 0.15,
      });
    }

    // Circuit Traces: orthogonal PCB-like pulses
    const traces: CircuitTrace[] = [];
    if (!prefersReducedMotion) {
      const traceCount = isMobile ? 2 : 4;
      for (let i = 0; i < traceCount; i++) {
        const startX = Math.random() * width;
        const startY = Math.random() * height;
        const p1 = { x: startX, y: startY };
        const p2 = { x: startX + (Math.random() > 0.5 ? 120 : -120), y: startY };
        const p3 = { x: p2.x, y: p2.y + (Math.random() > 0.5 ? 100 : -100) };
        const p4 = { x: p3.x + (Math.random() > 0.5 ? 140 : -140), y: p3.y };

        traces.push({
          points: [p1, p2, p3, p4],
          progress: Math.random(),
          speed: 0.002 + Math.random() * 0.002,
          length: 0.22,
        });
      }
    }

    let mouseX = width / 2;
    let mouseY = height / 2;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    if (!isMobile) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw circuit traces
      for (let i = 0; i < traces.length; i++) {
        const trace = traces[i];
        trace.progress += trace.speed;
        if (trace.progress > 1) trace.progress = 0;

        // Draw faint guide trace
        ctx.strokeStyle = 'rgba(204, 255, 0, 0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(trace.points[0].x, trace.points[0].y);
        for (let p = 1; p < trace.points.length; p++) {
          ctx.lineTo(trace.points[p].x, trace.points[p].y);
        }
        ctx.stroke();

        // Calculate active pulse position
        const totalSegments = trace.points.length - 1;
        const rawPos = trace.progress * totalSegments;
        const segIndex = Math.min(Math.floor(rawPos), totalSegments - 1);
        const segProg = rawPos - segIndex;

        const pA = trace.points[segIndex];
        const pB = trace.points[segIndex + 1];

        const pulseX = pA.x + (pB.x - pA.x) * segProg;
        const pulseY = pA.y + (pB.y - pA.y) * segProg;

        // Pulse glow point
        const pulseGradient = ctx.createRadialGradient(pulseX, pulseY, 0, pulseX, pulseY, 18);
        pulseGradient.addColorStop(0, 'rgba(204, 255, 0, 0.65)');
        pulseGradient.addColorStop(0.5, 'rgba(204, 255, 0, 0.2)');
        pulseGradient.addColorStop(1, 'transparent');

        ctx.fillStyle = pulseGradient;
        ctx.beginPath();
        ctx.arc(pulseX, pulseY, 18, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Draw particle network connections
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 100) {
            const alpha = (1 - dist / 100) * 0.1;
            ctx.strokeStyle = `rgba(204, 255, 0, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // 3. Draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!isMobile) {
          const dx = mouseX - p.x;
          const dy = mouseY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            p.x -= (dx / dist) * 0.2;
            p.y -= (dy / dist) * 0.2;
          }
        }

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.fillStyle = `rgba(204, 255, 0, ${p.baseAlpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (!isMobile) window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Precision Blueprint Grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30"></div>

      {/* Vertical Ambient Scanline Beam */}
      <div className="absolute inset-x-0 h-40 bg-gradient-to-b from-transparent via-[#CCFF00]/[0.025] to-transparent animate-scanline pointer-events-none"></div>

      {/* Particle & Circuit Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-65" />

      {/* Corner Engineering Markers */}
      <div className="hidden lg:block absolute top-20 left-6 font-mono text-[9px] text-zinc-600 tracking-wider">
        SYS_GRID // 40mm_STEP
      </div>
      <div className="hidden lg:block absolute top-20 right-6 font-mono text-[9px] text-zinc-600 tracking-wider">
        LAT 18.5204° N • LON 73.8567° E
      </div>
    </div>
  );
};
