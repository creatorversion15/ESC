import React, { useRef } from 'react';
import { X, Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VideoModal: React.FC<VideoModalProps> = ({ isOpen, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-[#2b2f38] bg-[#0c0d10] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-[#1f2229] px-5 py-3.5 bg-[#121419]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2 w-2 rounded-full bg-[#CCFF00] animate-ping"></span>
            <span className="font-display text-sm font-bold tracking-tight text-white">
              ESC — Community Manifesto Showreel
            </span>
            <span className="rounded bg-[#232731] px-2 py-0.5 font-mono text-[10px] text-[#CCFF00]">
              OFFICIAL
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#9ca3af] hover:bg-[#1f2229] hover:text-white transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Video Player */}
        <div className="relative aspect-video w-full bg-black flex items-center justify-center">
          <video
            ref={videoRef}
            src="/assets/aistudio/WhatsApp_Video_2026-11-11_at_9.56.59_AM_828a432b.mp4"
            className="h-full w-full object-contain"
            controls
            autoPlay
            playsInline
          />
        </div>

        {/* Bottom Banner */}
        <div className="p-4 bg-[#0e1014] border-t border-[#1f2229] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="font-display text-xs font-semibold text-white">
              Empower. Start. Create.
            </p>
            <p className="text-[11px] text-[#8e919b]">
              Entrepreneurship and technical innovation, free for every engineering student.
            </p>
          </div>
          <a
            href="/apply"
            onClick={(e) => {
              e.preventDefault();
              onClose();
              window.location.hash = '/apply';
            }}
            className="rounded-lg bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] transition-colors"
          >
            Join The Movement
          </a>
        </div>
      </div>
    </div>
  );
};
