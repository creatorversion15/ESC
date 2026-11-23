import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CertificateRecord, CertificateSettings } from '../types';
import {
  DEFAULT_CERTIFICATE_LOGO,
  resolveCertificateRenderData,
} from '../utils/escLogic';
import { generateCertificateQrDataUrl } from '../utils/certificatePdf';

interface CertificateSheetProps {
  certificate: Partial<CertificateRecord>;
  settings?: Partial<CertificateSettings> | null;
  idAttr?: string;
  className?: string;
}

export const CertificateSheet: React.FC<CertificateSheetProps> = ({
  certificate,
  settings,
  idAttr,
  className = '',
}) => {
  const originUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://esc.community';
  const resolved = resolveCertificateRenderData(certificate, settings, originUrl);

  const isLight = resolved.templateStyle === 'ivory_executive';
  const isGrid = resolved.templateStyle === 'obsidian_grid';

  const [qrUrl, setQrUrl] = useState<string>('');
  const [logoSrc, setLogoSrc] = useState<string>(resolved.logoUrl || DEFAULT_CERTIFICATE_LOGO);

  useEffect(() => {
    setLogoSrc(resolved.logoUrl || DEFAULT_CERTIFICATE_LOGO);
  }, [resolved.logoUrl]);

  useEffect(() => {
    let active = true;
    generateCertificateQrDataUrl(resolved.verificationUrl, !isLight)
      .then((url) => {
        if (active) setQrUrl(url);
      })
      .catch(() => {
        if (active) setQrUrl('');
      });
    return () => {
      active = false;
    };
  }, [resolved.verificationUrl, isLight]);

  const bgClass = isLight
    ? 'bg-[#f7f7f3] text-[#0f1218]'
    : isGrid
    ? 'bg-[#090b0e] text-[#f4f4f0]'
    : 'bg-[#0d0f13] text-[#f4f4f0]';

  const cardClass = isLight
    ? 'bg-white border-[#1e222a]/20'
    : 'bg-[#13161c] border-[#2c313c]';

  const accentTextClass = isLight ? 'text-[#5b7d00]' : 'text-[#CCFF00]';
  const accentBorderClass = isLight ? 'border-[#5b7d00]' : 'border-[#CCFF00]';
  const accentBgClass = isLight ? 'bg-[#5b7d00]' : 'bg-[#CCFF00]';
  const mutedTextClass = isLight ? 'text-[#555c69]' : 'text-[#989eab]';
  const subtleBorderClass = isLight ? 'border-[#1e222a]/20' : 'border-[#2c313c]';

  return (
    <div
      id={idAttr}
      data-testid="certificate-sheet"
      style={{ containerType: 'inline-size' }}
      className={`relative w-full aspect-[297/210] overflow-hidden rounded-xl select-none shadow-2xl ${bgClass} ${className}`}
    >
      {/* Background grid texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundSize: isGrid ? '24px 24px' : '42px 42px',
          backgroundImage: isLight
            ? 'linear-gradient(to right, rgba(0,0,0,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.035) 1px, transparent 1px)'
            : 'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)',
        }}
      />

      {/* Outer hairline border */}
      <div className={`absolute inset-[3.2%] border ${subtleBorderClass} pointer-events-none`} />
      {/* Inner electric-lime accent frame */}
      <div className={`absolute inset-[4.3%] border-2 ${accentBorderClass} pointer-events-none`}>
        <div className={`h-[0.45cqw] w-full ${accentBgClass}`} />
      </div>

      {/* Certificate Canvas Content */}
      <div className="relative z-10 flex h-full w-full flex-col justify-between px-[6.8%] py-[5.8%]">
        {/* Header Row */}
        <div className={`flex items-center justify-between gap-[2cqw] border-b ${subtleBorderClass} pb-[1.4cqw]`}>
          <div className="flex items-center gap-[1.6cqw] min-w-0">
            <div className="flex h-[5.8cqw] w-[5.8cqw] shrink-0 items-center justify-center rounded-[1cqw] bg-black border border-[#2b2f38] p-[0.6cqw] shadow-md">
              <img
                src={logoSrc}
                alt="ESC Logo"
                onError={() => {
                  if (logoSrc !== DEFAULT_CERTIFICATE_LOGO) {
                    setLogoSrc(DEFAULT_CERTIFICATE_LOGO);
                  }
                }}
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="font-display text-[1.65cqw] font-extrabold uppercase tracking-wide truncate leading-tight">
                {resolved.organization}
              </p>
              <p className={`font-mono text-[1.12cqw] font-bold tracking-wider uppercase leading-tight mt-[0.25cqw] ${accentTextClass}`}>
                Official Verified Engineering Credential
              </p>
              <p className={`text-[1.05cqw] leading-tight mt-[0.2cqw] truncate ${mutedTextClass}`}>
                Issued: {resolved.issueDate} • Think. Engineer. Build. Launch.
              </p>
            </div>
          </div>

          {/* Right ID Pill */}
          <div className={`shrink-0 rounded-[1cqw] border px-[1.8cqw] py-[0.9cqw] text-center ${cardClass}`}>
            <span className={`block font-mono text-[0.95cqw] uppercase tracking-widest leading-tight ${mutedTextClass}`}>
              Certificate ID
            </span>
            <span className={`block font-mono text-[1.45cqw] font-bold leading-tight mt-[0.2cqw] ${resolved.status === 'valid' ? accentTextClass : 'text-red-500'}`}>
              {resolved.certId}
            </span>
            <span className={`block font-mono text-[0.9cqw] font-semibold leading-tight mt-[0.2cqw] ${resolved.status === 'valid' ? 'text-emerald-500' : 'text-red-500'}`}>
              {resolved.status === 'valid' ? 'STATUS: VERIFIED VALID' : 'STATUS: REVOKED'}
            </span>
          </div>
        </div>

        {/* Center Narrative */}
        <div className="my-auto flex flex-col items-center text-center gap-[0.9cqw] py-[0.6cqw]">
          <p className={`font-display text-[1.45cqw] font-bold uppercase tracking-[0.2em] leading-tight ${accentTextClass}`}>
            {resolved.certificateTitle}
          </p>
          <p className={`text-[1.15cqw] uppercase tracking-widest leading-tight ${mutedTextClass}`}>
            This credential is proudly presented to
          </p>

          <h2 className="font-display text-[4.4cqw] font-black tracking-tight leading-[1.08] px-[2cqw]">
            {resolved.studentName || 'Participant Name'}
          </h2>
          <div className={`h-[0.25cqw] w-[26cqw] ${accentBgClass} rounded-full`} />

          <p className={`text-[1.18cqw] leading-tight pt-[0.2cqw] ${mutedTextClass}`}>
            for outstanding engineering execution and contribution in
          </p>
          <p className="font-display text-[1.85cqw] font-bold max-w-[78%] leading-snug">
            {resolved.competitionName}
          </p>

          {/* Achievement Box */}
          <div className={`mt-[0.4cqw] w-[76%] rounded-[1cqw] border px-[2.4cqw] py-[1.1cqw] ${cardClass}`}>
            <span className={`block font-mono text-[0.92cqw] uppercase tracking-widest leading-tight ${mutedTextClass}`}>
              Achievement / Award Recognition
            </span>
            <p className={`font-display text-[1.38cqw] font-bold mt-[0.35cqw] leading-snug ${accentTextClass}`}>
              {resolved.achievement}
            </p>
          </div>
        </div>

        {/* Footer: Signature + Hash Meta + QR Code */}
        <div className="flex items-end justify-between gap-[2cqw] pt-[0.8cqw]">
          {/* Authorized Signature & Issuer */}
          <div className="w-[33%] space-y-[0.4cqw]">
            <div className="h-[4.6cqw] flex items-end">
              {resolved.signatureUrl ? (
                <div className={`${isLight ? '' : 'bg-[#f6f6f2] rounded-[0.5cqw] px-[0.8cqw] py-[0.3cqw]'} max-h-[4.6cqw] inline-flex items-center`}>
                  <img
                    src={resolved.signatureUrl}
                    alt={`${resolved.authorizedSigner} signature`}
                    className="max-h-[3.8cqw] w-auto object-contain"
                  />
                </div>
              ) : (
                <span className="font-serif italic text-[2.2cqw] opacity-90 leading-none">
                  {resolved.authorizedSigner}
                </span>
              )}
            </div>
            <div className={`border-t ${subtleBorderClass} pt-[0.6cqw]`}>
              <p className="font-display text-[1.35cqw] font-bold leading-tight truncate">
                {resolved.authorizedSigner}
              </p>
              <p className={`text-[1.05cqw] leading-tight truncate ${mutedTextClass}`}>
                {resolved.authorizedSignerTitle}
              </p>
            </div>
          </div>

          {/* Verification Anchor Box */}
          <div className={`flex flex-col items-center justify-center rounded-[1cqw] border px-[1.6cqw] py-[0.9cqw] text-center w-[35%] ${cardClass}`}>
            <span className={`font-mono text-[0.9cqw] uppercase tracking-wider leading-tight ${mutedTextClass}`}>
              Cryptographic Verification Anchor
            </span>
            <span className={`font-mono text-[1.25cqw] font-bold mt-[0.25cqw] leading-tight ${accentTextClass}`}>
              HASH: {resolved.verificationHash}
            </span>
            <span className="font-mono text-[1.02cqw] mt-[0.2cqw] leading-tight">
              ISSUED: {resolved.issueDate}
            </span>
            <span className={`font-mono text-[0.86cqw] mt-[0.2cqw] leading-tight ${mutedTextClass}`}>
              Scan QR or verify at ESC Registry
            </span>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center shrink-0">
            <div className={`rounded-[0.8cqw] border p-[0.45cqw] ${accentBorderClass} ${isLight ? 'bg-white' : 'bg-[#111419]'}`}>
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt={`QR Verification for ${resolved.certId}`}
                  className="h-[8.5cqw] w-[8.5cqw] block"
                />
              ) : (
                <div className="h-[8.5cqw] w-[8.5cqw] flex items-center justify-center font-mono text-[0.9cqw] text-zinc-500">
                  QR...
                </div>
              )}
            </div>
            <span className={`font-mono text-[0.88cqw] font-bold uppercase tracking-wider mt-[0.4cqw] ${mutedTextClass}`}>
              Scan to Verify
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface CertificatePrintPortalProps {
  certificate: Partial<CertificateRecord> | null;
  settings?: Partial<CertificateSettings> | null;
}

/**
 * Mounts an off-screen print portal revealed exclusively during @media print
 * when `body.esc-printing-cert` is active, ensuring spotless A4 landscape output.
 */
export const CertificatePrintPortal: React.FC<CertificatePrintPortalProps> = ({
  certificate,
  settings,
}) => {
  if (!certificate || typeof document === 'undefined') return null;

  return createPortal(
    <div className="esc-print-only-portal">
      <CertificateSheet
        idAttr="esc-print-certificate-sheet"
        certificate={certificate}
        settings={settings}
        className="!rounded-none !shadow-none"
      />
    </div>,
    document.body
  );
};

export function triggerA4LandscapePrint(onCleanup?: () => void): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  document.body.classList.add('esc-printing-cert');

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    document.body.classList.remove('esc-printing-cert');
    window.removeEventListener('afterprint', cleanup);
    onCleanup?.();
  };

  window.addEventListener('afterprint', cleanup);

  // Allow React portal paint & QR/image layout frame before opening browser print dialog
  window.setTimeout(() => {
    window.print();
    // Safety fallback if browser does not dispatch afterprint promptly
    window.setTimeout(cleanup, 1500);
  }, 150);
}
