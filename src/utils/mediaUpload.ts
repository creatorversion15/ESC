import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

/**
 * Resizes and compresses a poster/banner image for Challenges, Events, or Opportunities.
 * Attempts Firebase Storage upload first (with short timeout) and falls back cleanly
 * to a compact JPEG/WebP Data URL within Firestore document size limits.
 */
export async function processAndUploadPosterImage(
  file: File,
  folder: 'challenges' | 'events' | 'opportunities'
): Promise<{ url: string; storedInCloud: boolean }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid PNG, JPG, SVG, or WebP image file.');
  }

  const maxW = 960;
  const maxH = 540;
  const objectUrl = URL.createObjectURL(file);

  try {
    const { blob, dataUrl } = await new Promise<{ blob: Blob; dataUrl: string }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width, maxH / img.height);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable for poster image compression.'));
          return;
        }
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        let encoded = canvas.toDataURL('image/webp', 0.82);
        if (!encoded.startsWith('data:image/webp')) {
          encoded = canvas.toDataURL('image/jpeg', 0.82);
        }
        if (encoded.length > 350000) {
          encoded = canvas.toDataURL('image/jpeg', 0.68);
        }

        canvas.toBlob(
          (b) => {
            if (!b) {
              reject(new Error('Failed to encode poster image.'));
              return;
            }
            resolve({ blob: b, dataUrl: encoded });
          },
          'image/jpeg',
          0.82
        );
      };
      img.onerror = () => reject(new Error('Could not decode selected poster image.'));
      img.src = objectUrl;
    });

    try {
      const ext = blob.type.includes('webp') ? 'webp' : 'jpg';
      const path = `esc-posters/${folder}/${Date.now()}.${ext}`;
      const sRef = storageRef(storage, path);
      const uploadTask = uploadBytes(sRef, blob, { contentType: blob.type || 'image/jpeg' }).then(() =>
        getDownloadURL(sRef)
      );
      const timeoutTask = new Promise<never>((_, reject) =>
        window.setTimeout(() => reject(new Error('Storage timeout')), 4500)
      );
      const cloudUrl = await Promise.race([uploadTask, timeoutTask]);
      return { url: cloudUrl, storedInCloud: true };
    } catch {
      return { url: dataUrl, storedInCloud: false };
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
