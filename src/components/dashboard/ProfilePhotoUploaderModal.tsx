import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Move,
} from 'lucide-react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { validateProfilePhotoFile } from '../../utils/memberOnboardingLogic';

interface ProfilePhotoUploaderModalProps {
  isOpen: boolean;
  currentPhotoUrl?: string;
  userUid: string;
  onClose: () => void;
  onSavePhoto: (photoUrl: string) => Promise<void>;
}

const CROP_VIEWPORT_SIZE = 240;
const OUTPUT_SIZE = 480;

export const ProfilePhotoUploaderModal: React.FC<ProfilePhotoUploaderModalProps> = ({
  isOpen,
  currentPhotoUrl,
  userUid,
  onClose,
  onSavePhoto,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string>('');
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; origX: number; origY: number } | null>(null);
  const imgElementRef = useRef<HTMLImageElement | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setDragging(false);
    }
  }, [isOpen]);

  // Revoke object URL on cleanup
  useEffect(() => {
    return () => {
      if (rawImageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(rawImageSrc);
      }
    };
  }, [rawImageSrc]);

  if (!isOpen) return null;

  const baseCoverScale =
    naturalSize.w > 0 && naturalSize.h > 0
      ? Math.max(CROP_VIEWPORT_SIZE / naturalSize.w, CROP_VIEWPORT_SIZE / naturalSize.h)
      : 1;

  const clampOffset = (nx: number, ny: number, nextZoom: number) => {
    if (naturalSize.w === 0 || naturalSize.h === 0) return { x: 0, y: 0 };
    const renderedW = naturalSize.w * baseCoverScale * nextZoom;
    const renderedH = naturalSize.h * baseCoverScale * nextZoom;
    const maxX = Math.max(0, (renderedW - CROP_VIEWPORT_SIZE) / 2);
    const maxY = Math.max(0, (renderedH - CROP_VIEWPORT_SIZE) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, nx)),
      y: Math.max(-maxY, Math.min(maxY, ny)),
    };
  };

  const handleFileSelected = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const check = validateProfilePhotoFile({ type: file.type, name: file.name, size: file.size });
    if (!check.valid) {
      setError(check.error || 'Invalid image file.');
      return;
    }

    if (rawImageSrc.startsWith('blob:')) {
      URL.revokeObjectURL(rawImageSrc);
    }
    const objUrl = URL.createObjectURL(file);
    const probe = new Image();
    probe.onload = () => {
      setNaturalSize({ w: probe.naturalWidth || probe.width, h: probe.naturalHeight || probe.height });
      setRawImageSrc(objUrl);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    probe.onerror = () => {
      URL.revokeObjectURL(objUrl);
      setError('Could not read the selected image file. Please try another JPG, PNG, or WebP photo.');
    };
    probe.src = objUrl;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!rawImageSrc) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      origX: offset.x,
      origY: offset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset(clampOffset(dragStartRef.current.origX + dx, dragStartRef.current.origY + dy, zoom));
  };

  const handlePointerUp = () => {
    setDragging(false);
    dragStartRef.current = null;
  };

  const handleZoomChange = (nextZoom: number) => {
    const clampedZoom = Math.max(1, Math.min(3, nextZoom));
    setZoom(clampedZoom);
    setOffset((prev) => clampOffset(prev.x, prev.y, clampedZoom));
  };

  const handleSaveCroppedPhoto = async () => {
    if (!rawImageSrc || !imgElementRef.current || naturalSize.w === 0 || naturalSize.h === 0) {
      setError('Please select a profile photo to crop and save.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Unable to initialize image cropper.');
      }

      const ratio = OUTPUT_SIZE / CROP_VIEWPORT_SIZE;
      const drawW = naturalSize.w * baseCoverScale * zoom * ratio;
      const drawH = naturalSize.h * baseCoverScale * zoom * ratio;
      const drawX = (OUTPUT_SIZE - drawW) / 2 + offset.x * ratio;
      const drawY = (OUTPUT_SIZE - drawH) / 2 + offset.y * ratio;

      ctx.fillStyle = '#0b0c0e';
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      ctx.drawImage(imgElementRef.current, drawX, drawY, drawW, drawH);

      let dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      if (dataUrl.length > 260_000) {
        dataUrl = canvas.toDataURL('image/jpeg', 0.76);
      }

      // Attempt secure Firebase Storage upload with fast fallback to compact data URL
      let finalUrl = dataUrl;
      try {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.88)
        );
        if (blob && userUid) {
          const sRef = storageRef(storage, `esc-member-photos/${userUid}/profile_${Date.now()}.jpg`);
          const uploadPromise = uploadBytes(sRef, blob, { contentType: 'image/jpeg' }).then(() =>
            getDownloadURL(sRef)
          );
          const timeoutPromise = new Promise<never>((_, reject) =>
            window.setTimeout(() => reject(new Error('Storage upload timeout')), 4000)
          );
          finalUrl = await Promise.race([uploadPromise, timeoutPromise]);
        }
      } catch {
        // Fallback to compact cropped JPEG Data URL (persisted in both Firestore & Cloud SQL)
        finalUrl = dataUrl;
      }

      await onSavePhoto(finalUrl);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save profile photo. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderedW = naturalSize.w * baseCoverScale * zoom;
  const renderedH = naturalSize.h * baseCoverScale * zoom;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-photo-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[#262b36] bg-[#0e1015] p-6 shadow-2xl space-y-5 my-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#1f232c] pb-4">
          <div className="space-y-1">
            <h3
              id="profile-photo-modal-title"
              className="font-display text-lg font-bold text-white flex items-center gap-2"
            >
              <Camera className="h-5 w-5 text-[#39FF14]" />
              {currentPhotoUrl ? 'Update Profile Photo' : 'Upload Member Profile Photo'}
            </h3>
            <p className="text-xs text-[#9ca3af]">
              Upload a clear portrait photo (JPG, JPEG, PNG, or WebP). Drag to reposition and zoom to frame your face for your ESC profile and Digital Member Card.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close photo uploader"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-[#191d26] hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-800/70 bg-red-950/40 px-4 py-3 text-xs text-red-200 flex items-center gap-2"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* File Picker Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFileSelected(e.target.files?.[0])}
        />

        {/* Interactive Crop / Reposition Stage */}
        <div className="flex flex-col items-center space-y-4">
          {rawImageSrc ? (
            <>
              <div
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{ width: CROP_VIEWPORT_SIZE, height: CROP_VIEWPORT_SIZE }}
                className={`relative overflow-hidden rounded-2xl border-2 border-[#39FF14]/80 bg-[#08090c] select-none touch-none ${
                  dragging ? 'cursor-grabbing' : 'cursor-grab'
                }`}
              >
                <img
                  ref={imgElementRef}
                  src={rawImageSrc}
                  alt="Crop preview"
                  draggable={false}
                  style={{
                    width: `${renderedW}px`,
                    height: `${renderedH}px`,
                    maxWidth: 'none',
                    position: 'absolute',
                    left: `${(CROP_VIEWPORT_SIZE - renderedW) / 2 + offset.x}px`,
                    top: `${(CROP_VIEWPORT_SIZE - renderedH) / 2 + offset.y}px`,
                  }}
                />
                {/* Alignment crosshair guide */}
                <div className="pointer-events-none absolute inset-0 border border-white/15 rounded-2xl">
                  <div className="absolute inset-x-0 top-1/3 border-t border-white/15" />
                  <div className="absolute inset-x-0 top-2/3 border-t border-white/15" />
                  <div className="absolute inset-y-0 left-1/3 border-l border-white/15" />
                  <div className="absolute inset-y-0 left-2/3 border-l border-white/15" />
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <Move className="h-3.5 w-3.5 text-[#39FF14]" />
                <span>Drag image to reposition inside frame</span>
              </div>

              {/* Zoom Controls */}
              <div className="w-full max-w-xs space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                  <span>Zoom</span>
                  <span className="tabular-nums text-white">{zoom.toFixed(2)}x</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleZoomChange(zoom - 0.15)}
                    aria-label="Zoom out"
                    className="rounded-lg border border-[#2b303c] bg-[#161922] p-1.5 text-zinc-300 hover:border-[#39FF14] hover:text-white cursor-pointer"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <input
                    type="range"
                    aria-label="Zoom level"
                    min={1}
                    max={3}
                    step={0.05}
                    value={zoom}
                    onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                    className="flex-1 accent-[#39FF14] cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => handleZoomChange(zoom + 0.15)}
                    aria-label="Zoom in"
                    className="rounded-lg border border-[#2b303c] bg-[#161922] p-1.5 text-zinc-300 hover:border-[#39FF14] hover:text-white cursor-pointer"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setZoom(1);
                      setOffset({ x: 0, y: 0 });
                    }}
                    aria-label="Reset crop"
                    title="Reset crop"
                    className="rounded-lg border border-[#2b303c] bg-[#161922] p-1.5 text-zinc-300 hover:border-[#39FF14] hover:text-white cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-mono text-[#39FF14] hover:underline cursor-pointer"
              >
                Choose a Different Photo
              </button>
            </>
          ) : (
            <div className="w-full rounded-2xl border border-dashed border-[#2f3542] bg-[#12151c] p-8 text-center space-y-4">
              {currentPhotoUrl ? (
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={currentPhotoUrl}
                    alt="Current uploaded member photo"
                    className="h-24 w-24 rounded-2xl object-cover border-2 border-[#39FF14]/50"
                  />
                  <span className="text-[11px] font-mono text-zinc-400">
                    Current Saved Profile Photo
                  </span>
                </div>
              ) : (
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#39FF14]/10 text-[#39FF14]">
                  <Upload className="h-7 w-7" />
                </div>
              )}

              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">
                  {currentPhotoUrl ? 'Replace Your Profile Photo' : 'Select a Profile Photo'}
                </p>
                <p className="text-xs text-zinc-400">
                  JPG, JPEG, PNG, or WebP · Max 10 MB · Cropped cleanly to 1:1 portrait
                </p>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#39FF14] px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-black hover:bg-[#32e010] cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                Choose Photo File
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-[#1f232c] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#2b303c] px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!rawImageSrc || saving}
            onClick={handleSaveCroppedPhoto}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#39FF14] px-5 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#32e010] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4" />
            {saving ? 'Saving Photo...' : 'Save Profile Photo'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
