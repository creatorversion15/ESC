import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { loadImageForPdf } from './certificatePdf';
import {
  buildMemberVerificationUrl,
  OFFICIAL_ESC_LOGO,
  OFFICIAL_ESC_WEBSITE,
  sanitizeMemberCardFilename,
} from './memberOnboardingLogic';

export interface MemberCardData {
  fullName: string;
  escMemberId: string;
  college: string;
  branch: string;
  academicYear: string;
  designation?: string;
  statusLabel: string;
  profilePhotoUrl: string;
  approvalDate?: string;
}

const CARD_W = 1050;
const CARD_H = 660;

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function loadImgElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function truncateCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  const raw = (text || '').trim();
  if (!raw) return '—';
  if (ctx.measureText(raw).width <= maxWidth) return raw;
  let cut = raw;
  while (cut.length > 3 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

function drawCardBaseBackground(ctx: CanvasRenderingContext2D) {
  // Deep obsidian black card background
  const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  bg.addColorStop(0, '#07090b');
  bg.addColorStop(0.55, '#0c1015');
  bg.addColorStop(1, '#080c0a');
  drawRoundedRectPath(ctx, 0, 0, CARD_W, CARD_H, 34);
  ctx.fillStyle = bg;
  ctx.fill();

  // Subtle architectural engineering grid
  ctx.save();
  drawRoundedRectPath(ctx, 0, 0, CARD_W, CARD_H, 34);
  ctx.clip();

  ctx.strokeStyle = 'rgba(57, 255, 20, 0.055)';
  ctx.lineWidth = 1;
  for (let gx = 42; gx < CARD_W; gx += 42) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, CARD_H);
    ctx.stroke();
  }
  for (let gy = 42; gy < CARD_H; gy += 42) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(CARD_W, gy);
    ctx.stroke();
  }

  // Subtle corner radial illumination
  const rad = ctx.createRadialGradient(CARD_W - 110, 80, 10, CARD_W - 110, 80, 360);
  rad.addColorStop(0, 'rgba(57, 255, 20, 0.14)');
  rad.addColorStop(1, 'rgba(57, 255, 20, 0)');
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Top precision neon-green accent stripe
  ctx.fillStyle = '#39FF14';
  ctx.fillRect(0, 0, CARD_W, 8);

  ctx.restore();

  // Clean outer border
  drawRoundedRectPath(ctx, 2, 2, CARD_W - 4, CARD_H - 4, 32);
  ctx.strokeStyle = 'rgba(57, 255, 20, 0.45)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

export async function renderMemberCardFrontCanvas(card: MemberCardData): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;

  drawCardBaseBackground(ctx);

  const [logoAsset, photoAsset] = await Promise.all([
    loadImageForPdf(OFFICIAL_ESC_LOGO),
    loadImageForPdf(card.profilePhotoUrl),
  ]);

  const [logoImg, photoImg] = await Promise.all([
    logoAsset ? loadImgElement(logoAsset.dataUrl) : Promise.resolve(null),
    photoAsset ? loadImgElement(photoAsset.dataUrl) : Promise.resolve(null),
  ]);

  // Header Bar: ESC Logo + Organization Title + Digital Member Identity
  const headerY = 46;
  drawRoundedRectPath(ctx, 48, headerY, 72, 72, 16);
  ctx.fillStyle = '#050608';
  ctx.fill();
  ctx.strokeStyle = 'rgba(57, 255, 20, 0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (logoImg) {
    ctx.drawImage(logoImg, 56, headerY + 8, 56, 56);
  } else {
    ctx.fillStyle = '#39FF14';
    ctx.font = '800 24px sans-serif';
    ctx.fillText('ESC', 61, headerY + 45);
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 26px "Plus Jakarta Sans", "Segoe UI", sans-serif';
  ctx.fillText('ENGINEERING STARTUP COMPANY', 140, headerY + 32);

  ctx.fillStyle = '#39FF14';
  ctx.font = '700 15px "JetBrains Mono", monospace';
  ctx.fillText('DIGITAL MEMBER IDENTITY', 140, headerY + 59);

  // Active status chip top-right
  const statusText = (card.statusLabel || 'ACTIVE').toUpperCase();
  ctx.font = '700 14px "JetBrains Mono", monospace';
  const statusW = Math.max(122, ctx.measureText(statusText).width + 44);
  const statusX = CARD_W - 48 - statusW;
  drawRoundedRectPath(ctx, statusX, headerY + 14, statusW, 38, 10);
  ctx.fillStyle = 'rgba(57, 255, 20, 0.14)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(57, 255, 20, 0.65)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#39FF14';
  ctx.textAlign = 'center';
  ctx.fillText(statusText, statusX + statusW / 2, headerY + 38);
  ctx.textAlign = 'left';

  // Hairline divider
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(48, 144);
  ctx.lineTo(CARD_W - 48, 144);
  ctx.stroke();

  // Left Column: High-Quality Member Portrait Photo
  const photoX = 48;
  const photoY = 178;
  const photoSize = 276;

  drawRoundedRectPath(ctx, photoX, photoY, photoSize, photoSize, 22);
  ctx.fillStyle = '#12161d';
  ctx.fill();

  if (photoImg) {
    ctx.save();
    drawRoundedRectPath(ctx, photoX + 4, photoY + 4, photoSize - 8, photoSize - 8, 19);
    ctx.clip();
    const scale = Math.max((photoSize - 8) / photoImg.width, (photoSize - 8) / photoImg.height);
    const dw = photoImg.width * scale;
    const dh = photoImg.height * scale;
    const dx = photoX + 4 + (photoSize - 8 - dw) / 2;
    const dy = photoY + 4 + (photoSize - 8 - dh) / 2;
    ctx.drawImage(photoImg, dx, dy, dw, dh);
    ctx.restore();
  }

  drawRoundedRectPath(ctx, photoX, photoY, photoSize, photoSize, 22);
  ctx.strokeStyle = 'rgba(57, 255, 20, 0.65)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Member ID Pill Box below photo
  drawRoundedRectPath(ctx, photoX, photoY + photoSize + 20, photoSize, 52, 12);
  ctx.fillStyle = '#121713';
  ctx.fill();
  ctx.strokeStyle = 'rgba(57, 255, 20, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#39FF14';
  ctx.font = '700 20px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(card.escMemberId || 'ESC-MEMBER', photoX + photoSize / 2, photoY + photoSize + 53);
  ctx.textAlign = 'left';

  // Right Column: Member Details
  const infoX = 368;
  const infoMaxW = CARD_W - infoX - 52;

  ctx.fillStyle = '#39FF14';
  ctx.font = '700 14px "JetBrains Mono", monospace';
  ctx.fillText(card.designation || 'ESC MEMBER', infoX, 204);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 40px "Plus Jakarta Sans", "Segoe UI", sans-serif';
  ctx.fillText(truncateCanvasText(ctx, card.fullName, infoMaxW), infoX, 256);

  // Structured details rows
  const drawField = (label: string, value: string, x: number, y: number, maxW: number) => {
    ctx.fillStyle = '#8b92a1';
    ctx.font = '600 13px "JetBrains Mono", monospace';
    ctx.fillText(label.toUpperCase(), x, y);

    ctx.fillStyle = '#f4f4f6';
    ctx.font = '600 22px "Plus Jakarta Sans", "Segoe UI", sans-serif';
    ctx.fillText(truncateCanvasText(ctx, value, maxW), x, y + 30);
  };

  drawField('College / University', card.college || 'Engineering Institution', infoX, 314, infoMaxW);
  drawField('Engineering Branch', card.branch || 'Engineering', infoX, 392, 340);
  drawField('Academic Year', card.academicYear || 'Student', infoX + 360, 392, infoMaxW - 360);
  drawField('Membership Status', card.statusLabel || 'Active', infoX, 470, 260);
  if (card.approvalDate) {
    const formattedDate = new Date(card.approvalDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    drawField('Approved Since', formattedDate, infoX + 280, 470, infoMaxW - 280);
  }

  // Footer Bar: Motto & Website
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(48, CARD_H - 76);
  ctx.lineTo(CARD_W - 48, CARD_H - 76);
  ctx.stroke();

  ctx.fillStyle = '#39FF14';
  ctx.font = '700 15px "JetBrains Mono", monospace';
  ctx.fillText('THINK. ENGINEER. BUILD. LAUNCH.', 48, CARD_H - 34);

  ctx.fillStyle = '#d4d4dc';
  ctx.font = '600 15px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(OFFICIAL_ESC_WEBSITE, CARD_W - 48, CARD_H - 34);
  ctx.textAlign = 'left';

  return canvas;
}

export async function renderMemberCardBackCanvas(card: MemberCardData): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;

  drawCardBaseBackground(ctx);

  const verificationUrl = buildMemberVerificationUrl(card.escMemberId);
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    width: 340,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#08090c',
      light: '#ffffff',
    },
  });
  const qrImg = await loadImgElement(qrDataUrl);

  // Header
  ctx.fillStyle = '#39FF14';
  ctx.font = '700 15px "JetBrains Mono", monospace';
  ctx.fillText('OFFICIAL VERIFICATION CREDENTIAL', 48, 72);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 28px "Plus Jakarta Sans", "Segoe UI", sans-serif';
  ctx.fillText('ENGINEERING STARTUP COMPANY (ESC)', 48, 112);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(48, 140);
  ctx.lineTo(CARD_W - 48, 140);
  ctx.stroke();

  // Left QR Card
  const qrBoxX = 56;
  const qrBoxY = 182;
  const qrBoxSize = 290;
  drawRoundedRectPath(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 20);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#39FF14';
  ctx.lineWidth = 3;
  ctx.stroke();

  if (qrImg) {
    ctx.drawImage(qrImg, qrBoxX + 14, qrBoxY + 14, qrBoxSize - 28, qrBoxSize - 28);
  }

  ctx.fillStyle = '#9ca3af';
  ctx.font = '600 13px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SCAN TO VERIFY MEMBERSHIP', qrBoxX + qrBoxSize / 2, qrBoxY + qrBoxSize + 34);
  ctx.textAlign = 'left';

  // Right Verification Details
  const rightX = 396;
  const rightMaxW = CARD_W - rightX - 52;

  ctx.fillStyle = '#8b92a1';
  ctx.font = '600 13px "JetBrains Mono", monospace';
  ctx.fillText('MEMBER NAME', rightX, 210);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 30px "Plus Jakarta Sans", "Segoe UI", sans-serif';
  ctx.fillText(truncateCanvasText(ctx, card.fullName, rightMaxW), rightX, 248);

  ctx.fillStyle = '#8b92a1';
  ctx.font = '600 13px "JetBrains Mono", monospace';
  ctx.fillText('UNIQUE ESC MEMBER ID', rightX, 298);
  ctx.fillStyle = '#39FF14';
  ctx.font = '700 26px "JetBrains Mono", monospace';
  ctx.fillText(card.escMemberId, rightX, 334);

  // Verification statement box
  drawRoundedRectPath(ctx, rightX, 366, rightMaxW, 152, 16);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = '#e4e4e7';
  ctx.font = '500 16px "Plus Jakarta Sans", "Segoe UI", sans-serif';
  const lines = [
    'This digital identity card certifies verified',
    'membership with Engineering Startup Company (ESC).',
    'Scan the QR code or verify this Member ID online at:',
  ];
  lines.forEach((line, idx) => {
    ctx.fillText(line, rightX + 20, 404 + idx * 28);
  });

  ctx.fillStyle = '#39FF14';
  ctx.font = '700 15px "JetBrains Mono", monospace';
  ctx.fillText(truncateCanvasText(ctx, `${OFFICIAL_ESC_WEBSITE}/#/verify`, rightMaxW - 40), rightX + 20, 496);

  // Footer Bar
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(48, CARD_H - 76);
  ctx.lineTo(CARD_W - 48, CARD_H - 76);
  ctx.stroke();

  ctx.fillStyle = '#9ca3af';
  ctx.font = '600 14px "JetBrains Mono", monospace';
  ctx.fillText('OFFICIAL DIGITAL CREDENTIAL · REAL-TIME REGISTRY BACKED', 48, CARD_H - 34);

  ctx.fillStyle = '#39FF14';
  ctx.font = '700 15px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(OFFICIAL_ESC_WEBSITE, CARD_W - 48, CARD_H - 34);
  ctx.textAlign = 'left';

  return canvas;
}

export async function downloadMemberCardPng(
  card: MemberCardData
): Promise<{ filename: string }> {
  const [frontCanvas, backCanvas] = await Promise.all([
    renderMemberCardFrontCanvas(card),
    renderMemberCardBackCanvas(card),
  ]);

  // Combine Front + Back vertically on a crisp dark presentation sheet for a complete high-res PNG
  const pad = 48;
  const gap = 36;
  const composite = document.createElement('canvas');
  composite.width = CARD_W + pad * 2;
  composite.height = CARD_H * 2 + pad * 2 + gap;
  const ctx = composite.getContext('2d')!;

  ctx.fillStyle = '#050608';
  ctx.fillRect(0, 0, composite.width, composite.height);
  ctx.drawImage(frontCanvas, pad, pad);
  ctx.drawImage(backCanvas, pad, pad + CARD_H + gap);

  const filename = sanitizeMemberCardFilename(card.fullName, card.escMemberId, 'png');
  const dataUrl = composite.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return { filename };
}

export async function downloadMemberCardPdf(
  card: MemberCardData
): Promise<{ filename: string }> {
  const [frontCanvas, backCanvas] = await Promise.all([
    renderMemberCardFrontCanvas(card),
    renderMemberCardBackCanvas(card),
  ]);

  const frontImg = frontCanvas.toDataURL('image/png');
  const backImg = backCanvas.toDataURL('image/png');

  // Landscape A4 sheet featuring crisp Front & Back official ESC Member Card
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Dark executive sheet header + crisp centered cards
  doc.setFillColor(11, 12, 14);
  doc.rect(0, 0, 210, 297, 'F');

  doc.setTextColor(57, 255, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ENGINEERING STARTUP COMPANY (ESC)', 105, 18, { align: 'center' });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('OFFICIAL DIGITAL MEMBER IDENTITY CARD', 105, 26, { align: 'center' });

  // Card dimensions on A4 (166mm × 104.3mm — exact CR80 aspect ratio)
  const pdfCardW = 166;
  const pdfCardH = (CARD_H / CARD_W) * pdfCardW;
  const x = (210 - pdfCardW) / 2;

  doc.setTextColor(156, 163, 175);
  doc.setFontSize(9);
  doc.text('CARD FRONT', x, 37);
  doc.addImage(frontImg, 'PNG', x, 40, pdfCardW, pdfCardH);

  doc.text('CARD BACK · QR VERIFICATION', x, 40 + pdfCardH + 14);
  doc.addImage(backImg, 'PNG', x, 40 + pdfCardH + 17, pdfCardW, pdfCardH);

  doc.setTextColor(156, 163, 175);
  doc.setFontSize(8);
  doc.text(
    `Verify online at https://${OFFICIAL_ESC_WEBSITE}/#/verify?member=${card.escMemberId}`,
    105,
    284,
    { align: 'center' }
  );

  const filename = sanitizeMemberCardFilename(card.fullName, card.escMemberId, 'pdf');
  doc.save(filename);
  return { filename };
}
