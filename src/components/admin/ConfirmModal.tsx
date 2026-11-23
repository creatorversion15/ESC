import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${
                danger ? 'bg-red-950/60 text-red-400' : 'bg-[#CCFF00]/15 text-[#CCFF00]'
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white">{title}</h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{message}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-zinc-500 hover:text-white p-1 cursor-pointer"
            aria-label="Close confirmation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#23262d] pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-[#2b2f38] px-4 py-2 text-xs text-zinc-300 hover:text-white cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-xl px-4 py-2 font-display text-xs font-bold uppercase cursor-pointer disabled:opacity-50 ${
              danger
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-[#CCFF00] text-black hover:bg-[#b8e600]'
            }`}
          >
            {busy ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
