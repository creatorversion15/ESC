import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import type { CertificateRecord, CertificateSettings } from '../types';
import {
  DEFAULT_CERTIFICATE_LOGO,
  resolveCertificateRenderData,
  sanitizeCertificateFilename,
  validateCertificateForPdf,
  type ResolvedCertificateData,
} from './escLogic';

export interface LoadedImageAsset {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Loads any image URL (local asset, Firebase Storage URL, HTTPS, or data:image/*)
 * and normalizes it to a PNG data URL with exact natural dimensions for jsPDF.
 */
export async function loadImageForPdf(src: string): Promise<LoadedImageAsset | null> {
  const cleanSrc = (src || '').trim();
  if (!cleanSrc) return null;

  return new Promise((resolve) => {
    const img = new Image();
    if (!cleanSrc.startsWith('data:') && !cleanSrc.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }

    const timer = window.setTimeout(() => {
      resolve(null);
    }, 8000);

    img.onload = () => {
      window.clearTimeout(timer);
      try {
        const natW = img.naturalWidth || img.width || 240;
        const natH = img.naturalHeight || img.height || 120;
        const maxDim = 480;
        const scale = Math.min(1, maxDim / natW, maxDim / natH);
        const w = Math.max(1, Math.round(natW * scale));
        const h = Math.max(1, Math.round(natH * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/png');
        resolve({ dataUrl, width: w, height: h });
      } catch {
        // Fallback via fetch -> FileReader if crossOrigin canvas was tainted
        if (!cleanSrc.startsWith('data:')) {
          fetch(cleanSrc)
            .then((r) => (r.ok ? r.blob() : null))
            .then((blob) => {
              if (!blob) {
                resolve(null);
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === 'string') {
                  resolve({ dataUrl: reader.result, width: 240, height: 120 });
                } else {
                  resolve(null);
                }
              };
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(blob);
            })
            .catch(() => resolve(null));
        } else {
          resolve(null);
        }
      }
    };

    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };

    img.src = cleanSrc;
  });
}

/**
 * Generates a crisp verification QR code PNG data URL for any certificate.
 */
export async function generateCertificateQrDataUrl(
  verificationUrl: string,
  darkTheme: boolean = true
): Promise<string> {
  return QRCode.toDataURL(verificationUrl, {
    width: 320,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: darkTheme ? '#CCFF00' : '#0b0c0e',
      light: darkTheme ? '#111419' : '#ffffff',
    },
  });
}

/**
 * Resizes an uploaded logo or signature image to a clean, lightweight PNG data URL
 * and optionally uploads to Firebase Storage (falling back gracefully to inline PNG Data URL
 * if Storage rules or bucket CORS reject browser uploads).
 */
export async function processAndUploadCertificateAsset(
  file: File,
  kind: 'logo' | 'signature'
): Promise<{ url: string; storedInCloud: boolean }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid PNG, JPG, SVG, or WebP image file.');
  }

  const maxW = kind === 'logo' ? 420 : 560;
  const maxH = kind === 'logo' ? 420 : 220;

  const objectUrl = URL.createObjectURL(file);
  try {
    const resizedBlobAndData = await new Promise<{ blob: Blob; dataUrl: string }>((resolve, reject) => {
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
          reject(new Error('Canvas context unavailable for image processing.'));
          return;
        }
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/png');
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to encode processed PNG image.'));
              return;
            }
            resolve({ blob, dataUrl });
          },
          'image/png',
          0.92
        );
      };
      img.onerror = () => reject(new Error('Failed to read selected image file.'));
      img.src = objectUrl;
    });

    // Try Firebase Storage first with a tight timeout so it never hangs
    try {
      const refPath = `certificate-assets/${kind}_${Date.now()}.png`;
      const targetRef = storageRef(storage, refPath);
      const uploadPromise = uploadBytes(targetRef, resizedBlobAndData.blob, {
        contentType: 'image/png',
      }).then(() => getDownloadURL(targetRef));

      const timeoutPromise = new Promise<never>((_, reject) =>
        window.setTimeout(() => reject(new Error('Storage upload timeout')), 5000)
      );

      const downloadUrl = await Promise.race([uploadPromise, timeoutPromise]);
      // Verify the returned URL is canvas-readable; otherwise fall back to safe data URL
      const testLoad = await loadImageForPdf(downloadUrl);
      if (testLoad) {
        return { url: downloadUrl, storedInCloud: true };
      }
    } catch {
      // Fall back to compressed PNG data URL stored securely in certificateSettings
    }

    return { url: resizedBlobAndData.dataUrl, storedInCloud: false };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function fitTextWithinWidth(
  doc: jsPDF,
  text: string,
  maxWidth: number,
  maxFontSize: number,
  minFontSize: number
): number {
  let size = maxFontSize;
  while (size > minFontSize) {
    doc.setFontSize(size);
    if (doc.getTextWidth(text) <= maxWidth) {
      return size;
    }
    size -= 1;
  }
  return minFontSize;
}

/**
 * Generates an authentic, crisp A4 Landscape PDF (297mm × 210mm) using jsPDF vectors,
 * embedded ESC/custom logo, authorized signature, and QR code.
 * Throws descriptive errors if required fields are missing or PDF output fails validation.
 */
export async function buildCertificatePdfBlob(
  cert: Partial<CertificateRecord>,
  settings?: Partial<CertificateSettings> | null,
  originUrl?: string
): Promise<{ blob: Blob; filename: string; resolved: ResolvedCertificateData }> {
  const effectiveOrigin =
    originUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://esc.community');

  const resolved = resolveCertificateRenderData(cert, settings, effectiveOrigin);
  const validation = validateCertificateForPdf(resolved);
  if (!validation.valid) {
    throw new Error(validation.error || 'Certificate data is incomplete.');
  }

  const isLightTheme = resolved.templateStyle === 'ivory_executive';
  const isGridTheme = resolved.templateStyle === 'obsidian_grid';

  // Pre-load assets BEFORE PDF construction so no images ever appear blank
  const [logoAsset, fallbackLogoAsset, signatureAsset, qrDataUrl] = await Promise.all([
    loadImageForPdf(resolved.logoUrl),
    resolved.logoUrl !== DEFAULT_CERTIFICATE_LOGO ? loadImageForPdf(DEFAULT_CERTIFICATE_LOGO) : Promise.resolve(null),
    resolved.signatureUrl ? loadImageForPdf(resolved.signatureUrl) : Promise.resolve(null),
    generateCertificateQrDataUrl(resolved.verificationUrl, !isLightTheme),
  ]);

  const effectiveLogo = logoAsset || fallbackLogoAsset;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const W = 297;
  const H = 210;

  // Color Palette per template
  const bgRgb: [number, number, number] = isLightTheme
    ? [247, 247, 243]
    : isGridTheme
    ? [9, 11, 14]
    : [13, 15, 19];
  const cardBgRgb: [number, number, number] = isLightTheme
    ? [255, 255, 255]
    : [19, 22, 28];
  const primaryTextRgb: [number, number, number] = isLightTheme
    ? [15, 18, 24]
    : [244, 244, 240];
  const mutedTextRgb: [number, number, number] = isLightTheme
    ? [85, 92, 105]
    : [152, 158, 171];
  const borderRgb: [number, number, number] = isLightTheme
    ? [30, 34, 42]
    : [44, 49, 60];
  const accentRgb: [number, number, number] = isLightTheme
    ? [110, 150, 0]
    : [204, 255, 0];

  // 1. Background Fill
  doc.setFillColor(...bgRgb);
  doc.rect(0, 0, W, H, 'F');

  // Subtle architectural grid lines
  doc.setDrawColor(isLightTheme ? 232 : 24, isLightTheme ? 232 : 27, isLightTheme ? 228 : 34);
  doc.setLineWidth(0.2);
  const gridStep = isGridTheme ? 10 : 18;
  for (let gx = 10; gx < W; gx += gridStep) {
    doc.line(gx, 8, gx, H - 8);
  }
  for (let gy = 10; gy < H; gy += gridStep) {
    doc.line(8, gy, W - 8, gy);
  }

  // 2. Double Editorial Frame + Corner Calibration Brackets
  doc.setDrawColor(...borderRgb);
  doc.setLineWidth(0.6);
  doc.rect(9, 9, W - 18, H - 18);

  doc.setDrawColor(...accentRgb);
  doc.setLineWidth(0.8);
  doc.rect(12, 12, W - 24, H - 24);

  // Corner L-brackets
  const bracketLen = 7;
  doc.setLineWidth(1.4);
  // Top-left
  doc.line(9, 9, 9 + bracketLen, 9);
  doc.line(9, 9, 9, 9 + bracketLen);
  // Top-right
  doc.line(W - 9 - bracketLen, 9, W - 9, 9);
  doc.line(W - 9, 9, W - 9, 9 + bracketLen);
  // Bottom-left
  doc.line(9, H - 9 - bracketLen, 9, H - 9);
  doc.line(9, H - 9, 9 + bracketLen, H - 9);
  // Bottom-right
  doc.line(W - 9 - bracketLen, H - 9, W - 9, H - 9);
  doc.line(W - 9, H - 9 - bracketLen, W - 9, H - 9);

  // Top Accent Bar
  doc.setFillColor(...accentRgb);
  doc.rect(12, 12, W - 24, 2.2, 'F');

  // 3. Header Row: ESC Logo + Organization + Certificate ID Pill
  const topY = 22;
  if (effectiveLogo) {
    const maxLogoW = 20;
    const maxLogoH = 20;
    const ratio = Math.min(maxLogoW / effectiveLogo.width, maxLogoH / effectiveLogo.height);
    const drawW = effectiveLogo.width * ratio;
    const drawH = effectiveLogo.height * ratio;
    doc.setFillColor(0, 0, 0);
    doc.roundedRect(20, topY, 22, 22, 3, 3, 'F');
    doc.addImage(
      effectiveLogo.dataUrl,
      'PNG',
      20 + (22 - drawW) / 2,
      topY + (22 - drawH) / 2,
      drawW,
      drawH,
      undefined,
      'FAST'
    );
  } else {
    doc.setFillColor(12, 14, 18);
    doc.roundedRect(20, topY, 22, 22, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(204, 255, 0);
    doc.text('ESC', 31, topY + 13, { align: 'center' });
  }

  // Organization & Credential Label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...primaryTextRgb);
  doc.text(resolved.organization.toUpperCase(), 47, topY + 8);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...accentRgb);
  doc.text('OFFICIAL VERIFIED ENGINEERING CREDENTIAL', 47, topY + 14.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedTextRgb);
  doc.text(`Issued: ${resolved.issueDate}  •  Think. Engineer. Build. Launch.`, 47, topY + 20);

  // Right-Aligned Certificate ID & Status Pill
  const statusPillW = 68;
  const statusPillX = W - 20 - statusPillW;
  doc.setFillColor(...cardBgRgb);
  doc.setDrawColor(...borderRgb);
  doc.setLineWidth(0.4);
  doc.roundedRect(statusPillX, topY + 1, statusPillW, 20, 2.5, 2.5, 'FD');

  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedTextRgb);
  doc.text('CERTIFICATE ID', statusPillX + statusPillW / 2, topY + 7, { align: 'center' });

  const redRgb: [number, number, number] = [239, 68, 68];
  const emeraldRgb: [number, number, number] = [16, 185, 129];

  doc.setFont('courier', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...(resolved.status === 'valid' ? accentRgb : redRgb));
  doc.text(resolved.certId, statusPillX + statusPillW / 2, topY + 13.5, { align: 'center' });

  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...(resolved.status === 'valid' ? emeraldRgb : redRgb));
  doc.text(
    resolved.status === 'valid' ? 'STATUS: VERIFIED VALID' : 'STATUS: REVOKED',
    statusPillX + statusPillW / 2,
    topY + 18.5,
    { align: 'center' }
  );

  // Divider line below header
  doc.setDrawColor(...borderRgb);
  doc.setLineWidth(0.35);
  doc.line(20, 50, W - 20, 50);

  // 4. Main Certificate Body
  const centerX = W / 2;

  // Certificate Title
  doc.setFont('helvetica', 'bold');
  const titleSize = fitTextWithinWidth(doc, resolved.certificateTitle.toUpperCase(), W - 60, 14, 10);
  doc.setFontSize(titleSize);
  doc.setTextColor(...accentRgb);
  doc.text(resolved.certificateTitle.toUpperCase(), centerX, 61, { align: 'center' });

  // Certifies Line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...mutedTextRgb);
  doc.text('THIS CREDENTIAL IS PROUDLY PRESENTED TO', centerX, 71, { align: 'center' });

  // Participant Full Name (Prominent)
  doc.setFont('helvetica', 'bold');
  const nameSize = fitTextWithinWidth(doc, resolved.studentName, W - 56, 33, 18);
  doc.setFontSize(nameSize);
  doc.setTextColor(...primaryTextRgb);
  doc.text(resolved.studentName, centerX, 88, { align: 'center' });

  // Accent Underline beneath Recipient Name
  const nameLineW = Math.min(140, Math.max(75, doc.getTextWidth(resolved.studentName) + 18));
  doc.setDrawColor(...accentRgb);
  doc.setLineWidth(0.7);
  doc.line(centerX - nameLineW / 2, 92.5, centerX + nameLineW / 2, 92.5);

  // Competition / Program Line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...mutedTextRgb);
  doc.text('for outstanding engineering execution and contribution in', centerX, 101, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  const compText = resolved.competitionName;
  const compSize = fitTextWithinWidth(doc, compText, W - 56, 16, 11);
  doc.setFontSize(compSize);
  doc.setTextColor(...primaryTextRgb);
  doc.text(compText, centerX, 110, { align: 'center' });

  // Achievement / Award Box
  const achBoxW = W - 76;
  const achBoxX = (W - achBoxW) / 2;
  doc.setFillColor(...cardBgRgb);
  doc.setDrawColor(...borderRgb);
  doc.setLineWidth(0.45);
  doc.roundedRect(achBoxX, 117, achBoxW, 22, 3, 3, 'FD');

  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedTextRgb);
  doc.text('ACHIEVEMENT / AWARD RECOGNITION', centerX, 123, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  const achLines = doc.splitTextToSize(resolved.achievement, achBoxW - 14);
  doc.setFontSize(achLines.length > 1 ? 10.5 : 12);
  doc.setTextColor(...accentRgb);
  doc.text(achLines.slice(0, 2), centerX, achLines.length > 1 ? 129.5 : 132, { align: 'center' });

  // 5. Footer Area: Authorized Signature (Left), Verification Metadata (Center), QR Code (Right)
  const footerTop = 148;

  // Left: Authorized Signature + Issuer Name + Designation
  const sigBoxX = 24;
  const sigBoxW = 86;
  if (signatureAsset) {
    const maxSigW = 54;
    const maxSigH = 18;
    const ratio = Math.min(maxSigW / signatureAsset.width, maxSigH / signatureAsset.height);
    const drawW = signatureAsset.width * ratio;
    const drawH = signatureAsset.height * ratio;
    if (isLightTheme) {
      doc.addImage(signatureAsset.dataUrl, 'PNG', sigBoxX + 4, footerTop + (18 - drawH), drawW, drawH, undefined, 'FAST');
    } else {
      // Subtle crisp backing badge so dark-ink signatures remain sharp on dark certificates
      doc.setFillColor(246, 246, 242);
      doc.roundedRect(sigBoxX, footerTop, maxSigW + 8, 19, 2, 2, 'F');
      doc.addImage(
        signatureAsset.dataUrl,
        'PNG',
        sigBoxX + (maxSigW + 8 - drawW) / 2,
        footerTop + (19 - drawH) / 2,
        drawW,
        drawH,
        undefined,
        'FAST'
      );
    }
  } else {
    // Crisp typographic signature mark when no image is uploaded
    doc.setFont('times', 'italic');
    doc.setFontSize(17);
    doc.setTextColor(...primaryTextRgb);
    doc.text(resolved.authorizedSigner, sigBoxX + 2, footerTop + 14);
  }

  doc.setDrawColor(...borderRgb);
  doc.setLineWidth(0.5);
  doc.line(sigBoxX, footerTop + 21, sigBoxX + sigBoxW, footerTop + 21);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...primaryTextRgb);
  doc.text(resolved.authorizedSigner, sigBoxX, footerTop + 27);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...mutedTextRgb);
  const desigLines = doc.splitTextToSize(resolved.authorizedSignerTitle, sigBoxW + 8);
  doc.text(desigLines.slice(0, 2), sigBoxX, footerTop + 32);

  // Center: Verification Hash & Issue Date Summary
  const metaX = 122;
  doc.setFillColor(...cardBgRgb);
  doc.setDrawColor(...borderRgb);
  doc.setLineWidth(0.35);
  doc.roundedRect(metaX, footerTop + 4, 108, 30, 2.5, 2.5, 'FD');

  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedTextRgb);
  doc.text('CRYPTOGRAPHIC VERIFICATION ANCHOR', metaX + 54, footerTop + 10.5, { align: 'center' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...accentRgb);
  doc.text(`HASH: ${resolved.verificationHash}`, metaX + 54, footerTop + 17, { align: 'center' });

  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...primaryTextRgb);
  doc.text(`ISSUED: ${resolved.issueDate}`, metaX + 54, footerTop + 23, { align: 'center' });

  doc.setFontSize(6.5);
  doc.setTextColor(...mutedTextRgb);
  doc.text('Scan QR or verify online at ESC Registry', metaX + 54, footerTop + 29, { align: 'center' });

  // Right: QR Code
  const qrSize = 31;
  const qrX = W - 24 - qrSize;
  doc.setFillColor(isLightTheme ? 255 : 17, isLightTheme ? 255 : 20, isLightTheme ? 255 : 25);
  doc.setDrawColor(...accentRgb);
  doc.setLineWidth(0.5);
  doc.roundedRect(qrX - 2, footerTop + 1, qrSize + 4, qrSize + 4, 2, 2, 'FD');
  doc.addImage(qrDataUrl, 'PNG', qrX, footerTop + 3, qrSize, qrSize, undefined, 'FAST');

  doc.setFont('courier', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...mutedTextRgb);
  doc.text('SCAN TO VERIFY', qrX + qrSize / 2, footerTop + qrSize + 8.5, { align: 'center' });

  // Bottom Disclaimer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...mutedTextRgb);
  doc.text(
    'ESC verifies student engineering milestones & challenge outcomes within the ESC ecosystem. Independent community credential (non-degree).',
    centerX,
    H - 14.5,
    { align: 'center' }
  );

  // Convert to Blob & strictly verify PDF binary header
  const blob = doc.output('blob');
  if (!blob || blob.size < 1500) {
    throw new Error('Generated PDF appears empty. Please verify certificate details and try again.');
  }

  const headerSlice = await blob.slice(0, 5).text();
  if (!headerSlice.startsWith('%PDF-')) {
    throw new Error('Generated PDF failed binary integrity verification.');
  }

  const filename = sanitizeCertificateFilename(resolved.studentName, resolved.certId);
  return { blob, filename, resolved };
}

/**
 * Triggers a reliable cross-browser download (Windows, macOS, Android, iOS)
 * with delayed ObjectURL cleanup so browsers never abort the transfer mid-write.
 */
export function triggerBrowserBlobDownload(blob: Blob, filename: string): void {
  if (!blob || blob.size === 0) {
    throw new Error('Cannot download an empty file.');
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  window.setTimeout(() => {
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }, 60_000);
}

/**
 * Generates and immediately downloads an individual certificate PDF.
 */
export async function downloadCertificatePdf(
  cert: Partial<CertificateRecord>,
  settings?: Partial<CertificateSettings> | null,
  originUrl?: string
): Promise<{ filename: string; byteSize: number; resolved: ResolvedCertificateData }> {
  const { blob, filename, resolved } = await buildCertificatePdfBlob(cert, settings, originUrl);
  triggerBrowserBlobDownload(blob, filename);
  return { filename, byteSize: blob.size, resolved };
}

/**
 * Generates a ZIP archive containing individual A4 Landscape PDFs for all selected certificates.
 */
export async function downloadBulkCertificatesZip(
  certs: CertificateRecord[],
  settings?: Partial<CertificateSettings> | null,
  originUrl?: string,
  onProgress?: (done: number, total: number) => void
): Promise<{ zipFilename: string; count: number; totalBytes: number }> {
  if (!certs || certs.length === 0) {
    throw new Error('Select at least one certificate to export in bulk.');
  }

  const zip = new JSZip();
  const usedNames = new Map<string, number>();

  for (let i = 0; i < certs.length; i++) {
    const cert = certs[i];
    const { blob, filename } = await buildCertificatePdfBlob(cert, settings, originUrl);

    let finalName = filename;
    const seen = usedNames.get(filename) || 0;
    if (seen > 0) {
      finalName = filename.replace(/\.pdf$/i, `_${cert.certId || seen + 1}.pdf`);
    }
    usedNames.set(filename, seen + 1);

    const arrayBuffer = await blob.arrayBuffer();
    zip.file(finalName, arrayBuffer);
    onProgress?.(i + 1, certs.length);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  if (!zipBlob || zipBlob.size < 200) {
    throw new Error('Generated bulk ZIP archive was empty.');
  }

  const zipFilename = `ESC_Certificates_Bulk_${new Date().toISOString().slice(0, 10)}.zip`;
  triggerBrowserBlobDownload(zipBlob, zipFilename);

  return {
    zipFilename,
    count: certs.length,
    totalBytes: zipBlob.size,
  };
}
