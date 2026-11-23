import { jsPDF } from 'jspdf';
import type { PolicyDocument } from '../data/policies';

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Generates and downloads a branded A4 PDF for ESC Terms & Conditions or Privacy Policy.
 * Uses the exact PolicyDocument content displayed on the website.
 */
export async function downloadPolicyPdf(policy: PolicyDocument): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 18;
  const contentWidth = pageWidth - marginX * 2;
  const footerReserved = 18;

  const logoDataUrl = await loadImageAsDataUrl('/assets/aistudio/IMG_20261112_135951_2ec3259f.png');

  // --- First-page branded black header band ---
  const headerHeight = 44;
  doc.setFillColor(11, 12, 14); // #0b0c0e
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  // Neon green accent strip (#39FF14 / #CCFF00 ESC brand green)
  doc.setFillColor(57, 255, 20);
  doc.rect(0, headerHeight - 1.6, pageWidth, 1.6, 'F');

  // Logo badge
  if (logoDataUrl) {
    try {
      doc.setFillColor(0, 0, 0);
      doc.roundedRect(marginX, 9, 14, 14, 2, 2, 'F');
      doc.addImage(logoDataUrl, 'PNG', marginX + 1, 10, 12, 12);
    } catch {
      // Fallback monogram if PNG embedding fails
      doc.setFillColor(57, 255, 20);
      doc.roundedRect(marginX, 9, 14, 14, 2, 2, 'F');
      doc.setTextColor(11, 12, 14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('ESC', marginX + 7, 17.5, { align: 'center' });
    }
  } else {
    doc.setFillColor(57, 255, 20);
    doc.roundedRect(marginX, 9, 14, 14, 2, 2, 'F');
    doc.setTextColor(11, 12, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('ESC', marginX + 7, 17.5, { align: 'center' });
  }

  // Brand title & metadata in header
  doc.setTextColor(57, 255, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('ENGINEERING STARTUP COMPANY (ESC)', marginX + 18, 14);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(policy.shortTitle.toUpperCase(), marginX + 18, 21.5);

  doc.setTextColor(190, 196, 208);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(policy.subtitle, marginX, 30.5);

  // Version & Last Updated badge row
  doc.setTextColor(57, 255, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(
    `VERSION ${policy.version}   |   LAST UPDATED: ${policy.lastUpdated.toUpperCase()}`,
    marginX,
    37.5
  );

  // --- Full Document Title Bar ---
  let cursorY = headerHeight + 11;
  doc.setTextColor(15, 17, 21);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const titleLines = doc.splitTextToSize(policy.title, contentWidth);
  doc.text(titleLines, marginX, cursorY);
  cursorY += titleLines.length * 5.2 + 3;

  doc.setDrawColor(225, 229, 236);
  doc.setLineWidth(0.4);
  doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
  cursorY += 7;

  const ensureSpace = (neededMm: number) => {
    if (cursorY + neededMm > pageHeight - footerReserved) {
      doc.addPage();
      // Subtle top continuation header bar
      doc.setFillColor(11, 12, 14);
      doc.rect(0, 0, pageWidth, 12, 'F');
      doc.setFillColor(57, 255, 20);
      doc.rect(0, 12, pageWidth, 0.8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(`ESC — ${policy.shortTitle}`, marginX, 7.6);
      doc.setTextColor(180, 186, 196);
      doc.setFont('helvetica', 'normal');
      doc.text(`Version ${policy.version} • ${policy.lastUpdated}`, pageWidth - marginX, 7.6, {
        align: 'right',
      });
      cursorY = 22;
    }
  };

  // --- Numbered Policy Sections ---
  for (const section of policy.sections) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.8);
    const firstParaLines = doc.splitTextToSize(section.paragraphs[0] || '', contentWidth - 4);
    const minBlockHeight = 9 + Math.min(firstParaLines.length, 3) * 4.8;
    ensureSpace(minBlockHeight);

    // Numbered pill badge
    doc.setFillColor(11, 12, 14);
    doc.roundedRect(marginX, cursorY - 4.3, 7.5, 5.5, 1.2, 1.2, 'F');
    doc.setTextColor(57, 255, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.text(String(section.number), marginX + 3.75, cursorY - 0.5, { align: 'center' });

    // Section heading
    doc.setTextColor(15, 17, 21);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${section.number}. ${section.heading}`, marginX + 10, cursorY - 0.3);
    cursorY += 5.5;

    // Section paragraphs
    doc.setTextColor(45, 51, 61);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.8);

    for (const para of section.paragraphs) {
      const lines = doc.splitTextToSize(para, contentWidth - 2);
      const blockHeight = lines.length * 4.9 + 2.5;
      ensureSpace(blockHeight);
      doc.text(lines, marginX + 2, cursorY);
      cursorY += lines.length * 4.9 + 2.2;
    }

    cursorY += 3;
  }

  // --- Footer on every page ---
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(225, 229, 236);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 13, pageWidth - marginX, pageHeight - 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(100, 108, 120);
    doc.text(
      `Engineering Startup Company (ESC) • ${policy.shortTitle} (v${policy.version}, Updated ${policy.lastUpdated})`,
      marginX,
      pageHeight - 8
    );
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - marginX, pageHeight - 8, { align: 'right' });
  }

  doc.save(policy.pdfFilename);
}
