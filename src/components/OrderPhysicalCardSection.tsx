import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  Edit3,
  ExternalLink,
  FileImage,
  Lock,
  MapPin,
  Package,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  Truck,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { apiRequest } from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import type { MemberCardOrder, SiteSettings } from '../types';
import {
  buildMemberVerificationUrl,
  getApplicationDisplayStatus,
} from '../utils/memberOnboardingLogic';
import {
  buildAndroidUpiIntentUri,
  buildUpiPaymentUri,
  DEFAULT_ESC_UPI_ID,
  DEFAULT_ESC_UPI_NOTE,
  DEFAULT_ESC_UPI_PAYEE,
  evaluatePhysicalCardOrderEligibility,
  formatFullDeliveryAddress,
  generateUpiOrderReference,
  getCardOrderStatusLabel,
  getPaymentStatusLabel,
  PHYSICAL_CARD_PRICE_INR,
  resolveConfiguredCardPrice,
  validateConfiguredUpiId,
  validateDeliveryDetails,
  validatePaymentScreenshotFile,
  validatePaymentSubmission,
} from '../utils/physicalCardOrderLogic';
import type { MemberCardData } from '../utils/memberCardExport';
import { EscMemberCardVisual } from './DigitalMemberCardSection';
import { ProfilePhotoUploaderModal } from './dashboard/ProfilePhotoUploaderModal';

interface OrderPhysicalCardSectionProps {
  navigate: (path: string) => void;
}

const INDIAN_STATES_AND_UTS = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

const SUPPORTED_UPI_APPS = [
  'Google Pay',
  'PhonePe',
  'Paytm',
  'BHIM UPI',
  'Amazon Pay',
  'Any UPI App',
];

/**
 * Safely compresses an uploaded JPG/JPEG/PNG payment screenshot client-side
 * so it stays crisp and readable for Admin verification while fitting comfortably
 * under server payload limits.
 */
async function compressScreenshotToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the payment screenshot file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Uploaded file could not be decoded as a valid image.'));
      img.onload = () => {
        const maxDim = 1280;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Browser canvas is unavailable for image processing.'));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const isPng = file.type === 'image/png' || /\.png$/i.test(file.name);
        // Prefer crisp JPEG for large screenshots so data URL stays compact (< 400KB)
        const jpegData = canvas.toDataURL('image/jpeg', 0.86);
        if (!isPng) {
          resolve(jpegData);
          return;
        }
        const pngData = canvas.toDataURL('image/png');
        resolve(pngData.length <= 650_000 ? pngData : jpegData);
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export const OrderPhysicalCardSection: React.FC<OrderPhysicalCardSectionProps> = ({ navigate }) => {
  const { user, profile, application, signInWithGoogle, updateUserProfile } = useAuth();
  const screenshotInputRef = useRef<HTMLInputElement | null>(null);
  const qrSectionRef = useRef<HTMLDivElement | null>(null);

  const [siteSettings, setSiteSettings] = useState<Partial<SiteSettings>>({
    upiId: DEFAULT_ESC_UPI_ID,
    upiPayeeName: DEFAULT_ESC_UPI_PAYEE,
    physicalCardPrice: PHYSICAL_CARD_PRICE_INR,
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<'form' | 'payment' | 'confirmed'>('form');
  const [cardPreviewSide, setCardPreviewSide] = useState<'front' | 'back'>('front');
  const [memberQrDataUrl, setMemberQrDataUrl] = useState('');
  const [upiQrDataUrl, setUpiQrDataUrl] = useState('');
  const [upiOrderRef, setUpiOrderRef] = useState('');
  const [showQrPanel, setShowQrPanel] = useState(true);
  const [payNowHint, setPayNowHint] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);

  // Step 1: Delivery & Member Form State
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [streetArea, setStreetArea] = useState('');
  const [cityVillage, setCityVillage] = useState('');
  const [district, setDistrict] = useState('');
  const [stateName, setStateName] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [college, setCollege] = useState('');
  const [branch, setBranch] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Step 2: UPI Payment Submission State
  const [transactionId, setTransactionId] = useState('');
  const [paymentScreenshotUrl, setPaymentScreenshotUrl] = useState('');
  const [paymentScreenshotName, setPaymentScreenshotName] = useState('');
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentErrors, setPaymentErrors] = useState<Record<string, string>>({});
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Step 3: Confirmation State
  const [submittedOrder, setSubmittedOrder] = useState<MemberCardOrder | null>(null);
  const [existingOrdersCount, setExistingOrdersCount] = useState<number>(0);

  // Fetch authoritative configurable UPI ID & price from server site settings
  useEffect(() => {
    apiRequest<SiteSettings>('/api/site-settings', { requireAuth: false })
      .then((res) => {
        if (res) {
          setSiteSettings((prev) => ({
            ...prev,
            ...res,
            upiId: typeof res.upiId === 'string' ? res.upiId.trim() : '',
            upiPayeeName: res.upiPayeeName?.trim() || DEFAULT_ESC_UPI_PAYEE,
            physicalCardPrice: resolveConfiguredCardPrice(res.physicalCardPrice),
          }));
        }
      })
      .catch(() => {})
      .finally(() => setSettingsLoaded(true));
  }, []);

  // Load existing order count for signed-in member
  useEffect(() => {
    if (!user) {
      setExistingOrdersCount(0);
      return;
    }
    apiRequest<MemberCardOrder[]>('/api/card-orders/my', { requireAuth: true })
      .then((orders) => {
        if (Array.isArray(orders)) setExistingOrdersCount(orders.length);
      })
      .catch(() => {});
  }, [user]);

  const upiValidation = useMemo(
    () => validateConfiguredUpiId(siteSettings.upiId),
    [siteSettings.upiId]
  );
  const configuredUpiId = upiValidation.upiId;
  const configuredPayeeName = siteSettings.upiPayeeName?.trim() || DEFAULT_ESC_UPI_PAYEE;
  const configuredPrice = resolveConfiguredCardPrice(siteSettings.physicalCardPrice);

  const upiPaymentUri = useMemo(
    () =>
      upiValidation.valid
        ? buildUpiPaymentUri({
            upiId: upiValidation.upiId,
            payeeName: configuredPayeeName,
            amountInr: configuredPrice,
            note: DEFAULT_ESC_UPI_NOTE,
            orderRef: upiOrderRef || undefined,
          })
        : null,
    [upiValidation.valid, upiValidation.upiId, configuredPayeeName, configuredPrice, upiOrderRef]
  );

  const androidIntentUri = useMemo(() => buildAndroidUpiIntentUri(upiPaymentUri), [upiPaymentUri]);

  const isMobileDevice = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  }, []);

  const isAndroidDevice = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /Android/i.test(navigator.userAgent || '');
  }, []);

  const eligibility = useMemo(
    () =>
      evaluatePhysicalCardOrderEligibility({
        isLoggedIn: Boolean(user),
        membershipStatus: profile?.membershipStatus || application?.status,
        accountStatus: profile?.accountStatus,
        escMemberId: profile?.escMemberId,
      }),
    [user, profile, application]
  );

  // Prefill member details whenever profile/application loads or modal opens
  const prefillFromProfile = () => {
    setFullName(profile?.fullName || application?.fullName || user?.displayName || '');
    setMobileNumber(profile?.phone || application?.phone || '');
    setCityVillage(profile?.city || application?.city || '');
    setStateName(profile?.state || application?.state || '');
    setCollege(profile?.college || application?.college || '');
    setBranch(profile?.branch || application?.branch || '');
    setAcademicYear(profile?.academicYear || application?.academicYear || '');
    setProfilePhotoUrl(profile?.profilePhotoUrl || '');
    setFormErrors({});
    setPaymentErrors({});
    setSubmitError(null);
  };

  useEffect(() => {
    if (profile || application || user) {
      setFullName((prev) => prev || profile?.fullName || application?.fullName || user?.displayName || '');
      setMobileNumber((prev) => prev || profile?.phone || application?.phone || '');
      setCityVillage((prev) => prev || profile?.city || application?.city || '');
      setStateName((prev) => prev || profile?.state || application?.state || '');
      setCollege((prev) => prev || profile?.college || application?.college || '');
      setBranch((prev) => prev || profile?.branch || application?.branch || '');
      setAcademicYear((prev) => prev || profile?.academicYear || application?.academicYear || '');
      setProfilePhotoUrl((prev) => prev || profile?.profilePhotoUrl || '');
    }
  }, [profile, application, user]);

  // Generate verification QR for live card preview
  useEffect(() => {
    if (!profile?.escMemberId) {
      setMemberQrDataUrl('');
      return;
    }
    let active = true;
    QRCode.toDataURL(buildMemberVerificationUrl(profile.escMemberId), {
      width: 280,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#07090B', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setMemberQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [profile?.escMemberId]);

  // Generate high-resolution scannable UPI Payment QR code directly from the exact UPI URI
  useEffect(() => {
    let active = true;
    if (!upiPaymentUri) {
      setUpiQrDataUrl('');
      return;
    }
    QRCode.toDataURL(upiPaymentUri, {
      width: 640,
      margin: 4,
      errorCorrectionLevel: 'H',
      type: 'image/png',
      color: { dark: '#000000', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setUpiQrDataUrl(url);
      })
      .catch(() => {
        if (active) setUpiQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [upiPaymentUri]);

  const previewCardData: MemberCardData | null = useMemo(() => {
    if (!profile?.escMemberId || !profilePhotoUrl) return null;
    return {
      fullName: fullName.trim() || profile.fullName || 'ESC Member',
      escMemberId: profile.escMemberId,
      college: college.trim() || profile.college || 'Engineering Institution',
      branch: branch.trim() || profile.branch || 'Engineering',
      academicYear: academicYear.trim() || profile.academicYear || 'Student',
      designation: 'ESC MEMBER',
      statusLabel: 'Active',
      profilePhotoUrl,
      approvalDate: profile.approvalDate,
    };
  }, [profile, fullName, college, branch, academicYear, profilePhotoUrl]);

  const handleOpenOrderFlow = () => {
    prefillFromProfile();
    setStep('form');
    setSubmittedOrder(null);
    setUpiOrderRef(generateUpiOrderReference(profile?.escMemberId));
    setShowQrPanel(true);
    setPayNowHint(null);
    setTransactionId('');
    setPaymentScreenshotUrl('');
    setPaymentScreenshotName('');
    setPaymentConfirmed(false);
    setModalOpen(true);
  };

  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateDeliveryDetails({
      fullName,
      email: profile?.email || user?.email || '',
      mobileNumber,
      addressLine1,
      streetArea,
      cityVillage,
      district,
      state: stateName,
      pinCode,
      college,
      branch,
      academicYear,
      profilePhotoUrl,
    });
    setFormErrors(check.errors);
    if (!check.isValid) return;
    if (!upiOrderRef) {
      setUpiOrderRef(generateUpiOrderReference(profile?.escMemberId));
    }
    setPayNowHint(null);
    setShowQrPanel(true);
    setSubmitError(null);
    setStep('payment');
  };

  const handleScreenshotSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validatePaymentScreenshotFile(file);
    if (!validation.valid) {
      setPaymentErrors((prev) => ({
        ...prev,
        paymentScreenshotUrl: validation.error || 'Only JPG, JPEG, or PNG screenshots are allowed.',
      }));
      return;
    }
    try {
      setUploadingScreenshot(true);
      const dataUrl = await compressScreenshotToDataUrl(file);
      setPaymentScreenshotUrl(dataUrl);
      setPaymentScreenshotName(file.name);
      setPaymentErrors((prev) => {
        const next = { ...prev };
        delete next.paymentScreenshotUrl;
        return next;
      });
    } catch (err: any) {
      setPaymentErrors((prev) => ({
        ...prev,
        paymentScreenshotUrl: err?.message || 'Failed to process payment screenshot.',
      }));
    } finally {
      setUploadingScreenshot(false);
      if (screenshotInputRef.current) screenshotInputRef.current.value = '';
    }
  };

  const handleCopyUpiId = async () => {
    if (!configuredUpiId) return;
    try {
      await navigator.clipboard.writeText(configuredUpiId);
      setCopiedUpi(true);
      window.setTimeout(() => setCopiedUpi(false), 2200);
    } catch {
      setCopiedUpi(false);
    }
  };

  const handleDownloadQrCode = () => {
    if (!upiQrDataUrl || !upiValidation.valid) return;
    const link = document.createElement('a');
    link.href = upiQrDataUrl;
    link.download = `ESC-UPI-QR-${configuredPrice}-${upiOrderRef || 'ORDER'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShowQrToggle = () => {
    setShowQrPanel(true);
    window.setTimeout(() => {
      qrSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  const handlePayNowClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!upiPaymentUri || !upiValidation.valid) {
      e.preventDefault();
      return;
    }
    if (!isMobileDevice) {
      e.preventDefault();
      setShowQrPanel(true);
      setPayNowHint(
        'Direct UPI apps open on mobile devices. Please scan the high-resolution UPI QR code below using Google Pay, PhonePe, Paytm, or BHIM on your phone, then enter your UTR number below.'
      );
      window.setTimeout(() => {
        qrSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
      return;
    }
    // On mobile/Android: let the native <a href="upi://pay?..."> trigger the OS UPI app selector,
    // and display a reliable fallback helper in case an in-app browser blocks custom schemes.
    setPayNowHint(
      'Opening your UPI app with ₹' +
        configuredPrice.toFixed(2) +
        ' prefilled. If your browser blocked automatic opening, tap "Try Android UPI Intent", download the QR to scan from gallery, or copy the UPI ID below.'
    );
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upiValidation.valid) {
      setSubmitError(
        upiValidation.error || 'Official ESC UPI ID is not configured. Payment submission is disabled.'
      );
      return;
    }
    const paymentCheck = validatePaymentSubmission({
      transactionId,
      paymentScreenshotUrl,
      paymentConfirmedByMember: paymentConfirmed,
    });
    setPaymentErrors(paymentCheck.errors);
    if (!paymentCheck.isValid) return;

    try {
      setSubmittingOrder(true);
      setSubmitError(null);

      const created = await apiRequest<MemberCardOrder>('/api/card-orders', {
        method: 'POST',
        requireAuth: true,
        body: {
          fullName: fullName.trim(),
          mobileNumber: mobileNumber.trim(),
          addressLine1: addressLine1.trim(),
          streetArea: streetArea.trim(),
          cityVillage: cityVillage.trim(),
          district: district.trim(),
          state: stateName.trim(),
          pinCode: pinCode.trim(),
          college: college.trim(),
          branch: branch.trim(),
          academicYear: academicYear.trim(),
          profilePhotoUrl,
          transactionId: transactionId.trim(),
          paymentScreenshotUrl,
          paymentConfirmedByMember: paymentConfirmed,
        },
      });

      setSubmittedOrder(created);
      setExistingOrdersCount((prev) => prev + 1);
      setStep('confirmed');
    } catch (err: any) {
      setSubmitError(err?.message || 'Could not submit your physical card order. Please review your details and try again.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const currentStatusDisplay = getApplicationDisplayStatus(
    profile?.membershipStatus || application?.status
  );

  const canClickSubmitPayment =
    upiValidation.valid &&
    transactionId.trim().length >= 6 &&
    paymentConfirmed &&
    !submittingOrder &&
    !uploadingScreenshot;

  return (
    <section
      id="order-physical-card"
      data-testid="order-physical-card-section"
      className="border-t border-[#222631] pt-12 mt-12 space-y-8"
    >
      {/* Section 3 Header */}
      <div className="text-center space-y-2.5">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#39FF14]/35 bg-[#0f1710] px-3.5 py-1 text-xs font-mono text-[#39FF14]">
          <Truck className="h-3.5 w-3.5" /> Section 3 · Pan-India Home Delivery
        </div>
        <h2 className="font-display text-2xl sm:text-4xl font-black tracking-tight text-white">
          ORDER PHYSICAL MEMBER CARD – HOME DELIVERY
        </h2>
        <p className="text-xs sm:text-sm text-[#9ca3af] max-w-xl mx-auto">
          Get your official ESC membership card delivered to your doorstep anywhere in India.
        </p>
      </div>

      {/* Main Feature Card */}
      <div className="rounded-2xl border border-[#242a35] bg-gradient-to-br from-[#101418] via-[#0e1116] to-[#0b0e12] p-6 sm:p-8 space-y-6 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Pitch & Pan-India Price */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-lg border border-[#39FF14]/50 bg-[#39FF14]/15 px-3 py-1 font-mono text-xs font-bold text-[#39FF14]">
                TOTAL ORDER AMOUNT: ₹{configuredPrice}
              </span>
              <span className="rounded-lg border border-[#2a303c] bg-[#151922] px-3 py-1 font-mono text-[11px] text-zinc-300">
                Flat Price Across India · Zero Extra Shipping
              </span>
            </div>

            <h3 className="font-display text-xl sm:text-2xl font-extrabold text-white leading-tight">
              Official PVC CR80 Engineering Startup Company Identity Card
            </h3>

            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              Printed with the exact official ESC Digital Member Card artwork — featuring your verified Member ID, portrait photograph, institution details, and live scannable verification QR code on the back. Delivered safely to any serviceable PIN code across India.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
              <div className="flex items-start gap-2.5 rounded-xl border border-[#1f2430] bg-[#0b0d12] p-3">
                <CreditCard className="h-4 w-4 text-[#39FF14] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">Official Double-Sided Print</span>
                  <span className="text-[11px] text-zinc-400">Matches your verified ESC Digital Member Card</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border border-[#1f2430] bg-[#0b0d12] p-3">
                <Truck className="h-4 w-4 text-[#39FF14] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">All-India Doorstep Delivery</span>
                  <span className="text-[11px] text-zinc-400">Flat ₹{configuredPrice} inclusive of printing &amp; courier</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border border-[#1f2430] bg-[#0b0d12] p-3">
                <ShieldCheck className="h-4 w-4 text-[#39FF14] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">Admin-Verified UPI Payment</span>
                  <span className="text-[11px] text-zinc-400">Pay via any UPI app &amp; submit UTR for verification</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border border-[#1f2430] bg-[#0b0d12] p-3">
                <Package className="h-4 w-4 text-[#39FF14] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">Live Dashboard Order Tracking</span>
                  <span className="text-[11px] text-zinc-400">Track status, dispatch date &amp; courier number</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right CTA & Eligibility Gate */}
          <div className="lg:col-span-5 rounded-2xl border border-[#222834] bg-[#0b0d12] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1d222c] pb-3.5">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 block">
                  Pan-India Flat Fee
                </span>
                <span className="font-display text-3xl font-black text-[#39FF14] tabular-nums">
                  ₹{configuredPrice}
                </span>
              </div>
              <div className="text-right">
                <span className="font-mono text-[10px] uppercase text-zinc-400 block">Delivery Charge</span>
                <span className="font-mono text-xs font-bold text-white">INCLUDED</span>
              </div>
            </div>

            {eligibility.eligible ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-[#39FF14]/35 bg-[#0e170f] p-3 text-xs flex items-start gap-2.5">
                  <BadgeCheck className="h-4 w-4 text-[#39FF14] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="font-semibold text-white block">
                      Eligible Verified Member ·{' '}
                      <span className="font-mono text-[#39FF14]">{profile?.escMemberId}</span>
                    </span>
                    <span className="text-[11px] text-zinc-300">
                      Your profile details will be prefilled automatically in the order form.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenOrderFlow}
                  data-testid="order-physical-card-cta"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#39FF14] px-5 py-3.5 font-display text-xs sm:text-sm font-black uppercase tracking-wide text-black hover:bg-[#32e010] shadow-[0_0_24px_rgba(57,255,20,0.22)] transition-all cursor-pointer"
                >
                  <CreditCard className="h-4 w-4 shrink-0" />
                  ORDER YOUR PHYSICAL ESC MEMBER CARD
                </button>

                {existingOrdersCount > 0 && (
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#2b313e] bg-[#141720] px-4 py-2.5 text-xs font-mono font-semibold text-zinc-200 hover:border-[#39FF14] hover:text-[#39FF14] cursor-pointer"
                  >
                    <Package className="h-3.5 w-3.5" />
                    Track My Card Orders ({existingOrdersCount}) in Dashboard
                  </button>
                )}
              </div>
            ) : (
              <div
                data-testid="physical-card-ineligible-box"
                data-reason={eligibility.reasonCode}
                className="space-y-4"
              >
                <div className="rounded-xl border border-[#272c38] bg-[#11141c] p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    {eligibility.reasonCode === 'not_logged_in' ? (
                      <UserCheck className="h-4 w-4 text-[#39FF14]" />
                    ) : (
                      <Lock className="h-4 w-4 text-amber-300" />
                    )}
                    <span>
                      {eligibility.reasonCode === 'not_logged_in'
                        ? 'Member Sign-In Required'
                        : 'Approved Active Membership Required'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{eligibility.message}</p>
                  {eligibility.reasonCode === 'pending_approval' && (
                    <p className="text-[11px] font-mono text-zinc-400">
                      Current Status: <strong className="text-white">{currentStatusDisplay}</strong>
                    </p>
                  )}
                </div>

                {eligibility.reasonCode === 'not_logged_in' ? (
                  <button
                    type="button"
                    onClick={() => signInWithGoogle()}
                    data-testid="order-physical-card-signin-btn"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#39FF14] px-5 py-3.5 font-display text-xs font-black uppercase tracking-wide text-black hover:bg-[#32e010] cursor-pointer"
                  >
                    <CreditCard className="h-4 w-4 shrink-0" />
                    ORDER YOUR PHYSICAL ESC MEMBER CARD
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled
                      data-testid="order-physical-card-cta"
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#2c313d] bg-[#161922] px-5 py-3 font-display text-xs font-bold uppercase tracking-wide text-zinc-500 cursor-not-allowed"
                    >
                      <Lock className="h-4 w-4 shrink-0" />
                      ORDER YOUR PHYSICAL ESC MEMBER CARD
                    </button>
                    {eligibility.reasonCode === 'pending_approval' && (
                      <button
                        type="button"
                        onClick={() => navigate('/dashboard')}
                        className="w-full rounded-xl border border-[#39FF14]/40 bg-[#101811] px-4 py-2 text-xs font-mono font-semibold text-[#39FF14] hover:bg-[#39FF14]/15 cursor-pointer"
                      >
                        Check Membership Status in Dashboard
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full Multi-Step Physical Member Card Order Modal */}
      {modalOpen &&
        eligibility.eligible &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="physical-card-order-modal-title"
            className="fixed inset-0 z-[105] flex items-start justify-center bg-black/85 p-3 sm:p-6 backdrop-blur-md overflow-y-auto"
          >
            <div className="w-full max-w-4xl rounded-2xl border border-[#262c38] bg-[#0d1015] shadow-2xl my-4 sm:my-8 overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between gap-4 border-b border-[#1f242f] bg-[#11141b] px-5 py-4 sm:px-7">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#39FF14] block">
                    Official ESC Physical Member Card · Pan-India Home Delivery
                  </span>
                  <h3
                    id="physical-card-order-modal-title"
                    className="font-display text-lg sm:text-xl font-extrabold text-white"
                  >
                    {step === 'form'
                      ? 'Step 1 of 2 · Member & Delivery Details'
                      : step === 'payment'
                        ? `Step 2 of 2 · Review & UPI Payment (₹${configuredPrice})`
                        : 'Order Submitted Successfully'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  aria-label="Close order modal"
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-[#1a1f2a] hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Step Progress Bar */}
              {step !== 'confirmed' && (
                <div className="grid grid-cols-2 border-b border-[#1f242f] bg-[#0b0d12] text-xs font-mono">
                  <div
                    className={`px-5 py-2.5 flex items-center gap-2 border-b-2 ${
                      step === 'form'
                        ? 'border-[#39FF14] text-[#39FF14] font-bold'
                        : 'border-transparent text-emerald-400'
                    }`}
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#39FF14]/20 text-[10px]">
                      {step === 'payment' ? '✓' : '1'}
                    </span>
                    Delivery &amp; Card Details
                  </div>
                  <div
                    className={`px-5 py-2.5 flex items-center gap-2 border-b-2 ${
                      step === 'payment'
                        ? 'border-[#39FF14] text-[#39FF14] font-bold'
                        : 'border-transparent text-zinc-500'
                    }`}
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px]">
                      2
                    </span>
                    Review &amp; Pay ₹{configuredPrice} via UPI
                  </div>
                </div>
              )}

              {/* STEP 1: ORDER FORM */}
              {step === 'form' && (
                <form onSubmit={handleProceedToPayment} className="p-5 sm:p-7 space-y-6 text-xs">
                  {/* Profile Photo & Member ID Card Strip */}
                  <div className="rounded-2xl border border-[#222834] bg-[#11151d] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {profilePhotoUrl ? (
                        <img
                          src={profilePhotoUrl}
                          alt={fullName || 'Member portrait'}
                          className="h-16 w-16 rounded-xl object-cover border-2 border-[#39FF14]/65 shrink-0"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-xl border-2 border-dashed border-amber-500/60 bg-amber-950/20 flex items-center justify-center text-amber-300 shrink-0">
                          <Camera className="h-6 w-6" />
                        </div>
                      )}
                      <div className="space-y-1">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#39FF14] block">
                          Profile Photograph for Printed Card *
                        </span>
                        <p className="text-white font-semibold">
                          {profilePhotoUrl
                            ? 'Member portrait ready for physical card print'
                            : 'Upload a clear portrait photo (JPG, JPEG, PNG, or WebP)'}
                        </p>
                        {formErrors.profilePhotoUrl && (
                          <p className="text-red-400 text-[11px]">{formErrors.profilePhotoUrl}</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPhotoModalOpen(true)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#39FF14]/50 bg-[#101911] px-4 py-2.5 font-mono text-xs font-semibold text-[#39FF14] hover:bg-[#39FF14]/15 shrink-0 cursor-pointer"
                    >
                      <Camera className="h-4 w-4" />
                      {profilePhotoUrl ? 'Change Photo' : 'Upload Photo'}
                    </button>
                  </div>

                  {/* Verified Member Identity Fields */}
                  <div className="space-y-3">
                    <h4 className="font-display text-sm font-bold text-white flex items-center gap-2">
                      <BadgeCheck className="h-4 w-4 text-[#39FF14]" /> Member Identity Details
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      <div>
                        <label className="block font-semibold text-zinc-200 mb-1">Full Name *</label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                          className="w-full rounded-xl border border-[#2b303c] bg-[#161922] px-3 py-2.5 text-white focus:border-[#39FF14] focus:outline-none"
                        />
                        {formErrors.fullName && (
                          <span className="text-[11px] text-red-400 mt-1 block">{formErrors.fullName}</span>
                        )}
                      </div>

                      <div>
                        <label className="block font-semibold text-zinc-200 mb-1">
                          Registered Email ID (Verified)
                        </label>
                        <input
                          type="email"
                          value={profile?.email || user?.email || ''}
                          readOnly
                          className="w-full rounded-xl border border-[#232732] bg-[#111319] px-3 py-2.5 text-zinc-400 cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-zinc-200 mb-1">
                          Official ESC Member ID
                        </label>
                        <input
                          type="text"
                          value={profile?.escMemberId || ''}
                          readOnly
                          className="w-full rounded-xl border border-[#39FF14]/35 bg-[#0e150f] px-3 py-2.5 font-mono font-bold text-[#39FF14] cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-zinc-200 mb-1">Mobile Number *</label>
                        <input
                          type="tel"
                          value={mobileNumber}
                          onChange={(e) => setMobileNumber(e.target.value)}
                          placeholder="10-digit Indian mobile number"
                          required
                          className="w-full rounded-xl border border-[#2b303c] bg-[#161922] px-3 py-2.5 text-white placeholder:text-zinc-500 focus:border-[#39FF14] focus:outline-none"
                        />
                        {formErrors.mobileNumber && (
                          <span className="text-[11px] text-red-400 mt-1 block">{formErrors.mobileNumber}</span>
                        )}
                      </div>

                      <div>
                        <label className="block font-semibold text-zinc-200 mb-1">College / University *</label>
                        <input
                          type="text"
                          value={college}
                          onChange={(e) => setCollege(e.target.value)}
                          required
                          className="w-full rounded-xl border border-[#2b303c] bg-[#161922] px-3 py-2.5 text-white focus:border-[#39FF14] focus:outline-none"
                        />
                        {formErrors.college && (
                          <span className="text-[11px] text-red-400 mt-1 block">{formErrors.college}</span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block font-semibold text-zinc-200 mb-1">Branch *</label>
                          <input
                            type="text"
                            value={branch}
                            onChange={(e) => setBranch(e.target.value)}
                            required
                            className="w-full rounded-xl border border-[#2b303c] bg-[#161922] px-3 py-2.5 text-white focus:border-[#39FF14] focus:outline-none"
                          />
                          {formErrors.branch && (
                            <span className="text-[11px] text-red-400 mt-1 block">{formErrors.branch}</span>
                          )}
                        </div>
                        <div>
                          <label className="block font-semibold text-zinc-200 mb-1">Academic Year *</label>
                          <input
                            type="text"
                            value={academicYear}
                            onChange={(e) => setAcademicYear(e.target.value)}
                            placeholder="e.g. 3rd Year"
                            required
                            className="w-full rounded-xl border border-[#2b303c] bg-[#161922] px-3 py-2.5 text-white focus:border-[#39FF14] focus:outline-none"
                          />
                          {formErrors.academicYear && (
                            <span className="text-[11px] text-red-400 mt-1 block">{formErrors.academicYear}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pan-India Home Delivery Address */}
                  <div className="space-y-3 border-t border-[#1e232e] pt-5">
                    <h4 className="font-display text-sm font-bold text-white flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#39FF14]" /> Home Delivery Address (India)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block font-semibold text-zinc-200 mb-1">
                          Complete House / Flat / Building Address *
                        </label>
                        <input
                          type="text"
                          value={addressLine1}
                          onChange={(e) => setAddressLine1(e.target.value)}
                          placeholder="e.g. Flat 402, Sunrise Residency / Hostel Block B"
                          required
                          className="w-full rounded-xl border border-[#2b303c] bg-[#161922] px-3 py-2.5 text-white placeholder:text-zinc-500 focus:border-[#39FF14] focus:outline-none"
                        />
                        {formErrors.addressLine1 && (
                          <span className="text-[11px] text-red-400 mt-1 block">{formErrors.addressLine1}</span>
                        )}
                      </div>

                      <div>
                        <label className="block font-semibold text-zinc-200 mb-1">
                          Street / Area / Landmark *
                        </label>
                        <input
                          type="text"
                          value={streetArea}
                          onChange={(e) => setStreetArea(e.target.value)}
                          placeholder="e.g. Near Engineering College Road, Shivajinagar"
                          required
                          className="w-full rounded-xl border border-[#2b303c] bg-[#161922] px-3 py-2.5 text-white placeholder:text-zinc-500 focus:border-[#39FF14] focus:outline-none"
                        />
                        {formErrors.streetArea && (
                          <span className="text-[11px] text-red-400 mt-1 block">{formErrors.streetArea}</span>
                        )}
                      </div>

                      <div>
                        <label className="block font-semibold text-zinc-200 mb-1">City / Village *</label>
                        <input
                          type="text"
                          value={cityVillage}
                          onChange={(e) => setCityVillage(e.target.value)}
                          placeholder="e.g. Pune"
                          required
                          className="w-full rounded-xl border border-[#2b303c] bg-[#161922] px-3 py-2.5 text-white placeholder:text-zinc-500 focus:border-[#39FF14] focus:outline-none"
                        />
                        {formErrors.cityVillage && (
                          <span className="text-[11px] text-red-400 mt-1 block">{formErrors.cityVillage}</span>
                        )}
                      </div>

                      <div>
                        <label className="block font-semibold text-zinc-200 mb-1">District *</label>
                        <input
                          type="text"
                          value={district}
                          onChange={(e) => setDistrict(e.target.value)}
                          placeholder="e.g. Pune"
                          required
                          className="w-full rounded-xl border border-[#2b303c] bg-[#161922] px-3 py-2.5 text-white placeholder:text-zinc-500 focus:border-[#39FF14] focus:outline-none"
                        />
                        {formErrors.district && (
                          <span className="text-[11px] text-red-400 mt-1 block">{formErrors.district}</span>
                        )}
                      </div>

                      <div>
                        <label className="block font-semibold text-zinc-200 mb-1">State / UT *</label>
                        <select
                          value={stateName}
                          onChange={(e) => setStateName(e.target.value)}
                          required
                          className="w-full rounded-xl border border-[#2b303c] bg-[#161922] px-3 py-2.5 text-white focus:border-[#39FF14] focus:outline-none"
                        >
                          <option value="">Select State / Union Territory</option>
                          {INDIAN_STATES_AND_UTS.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                        {formErrors.state && (
                          <span className="text-[11px] text-red-400 mt-1 block">{formErrors.state}</span>
                        )}
                      </div>

                      <div>
                        <label className="block font-semibold text-zinc-200 mb-1">PIN Code *</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={pinCode}
                          onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="6-digit PIN Code (e.g. 411005)"
                          required
                          className="w-full rounded-xl border border-[#2b303c] bg-[#161922] px-3 py-2.5 font-mono text-white placeholder:text-zinc-500 focus:border-[#39FF14] focus:outline-none"
                        />
                        {formErrors.pinCode && (
                          <span className="text-[11px] text-red-400 mt-1 block">{formErrors.pinCode}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#1e232e] pt-5">
                    <div className="font-mono text-xs text-zinc-300">
                      TOTAL ORDER AMOUNT:{' '}
                      <strong className="text-[#39FF14] text-sm">₹{configuredPrice}</strong>{' '}
                      <span className="text-zinc-500">(Flat Pan-India Delivery)</span>
                    </div>
                    <div className="flex items-center justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={() => setModalOpen(false)}
                        className="rounded-xl border border-[#2b303c] px-4 py-2.5 text-zinc-300 hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        data-testid="proceed-to-upi-payment-btn"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#39FF14] px-6 py-2.5 font-display text-xs font-black uppercase tracking-wide text-black hover:bg-[#32e010] cursor-pointer"
                      >
                        Continue to Payment <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* STEP 2: REVIEW + ESC UPI PAYMENT + TRANSACTION PROOF */}
              {step === 'payment' && (
                <form onSubmit={handleSubmitOrder} className="p-5 sm:p-7 space-y-6 text-xs">
                  {/* Review Delivery & Card Summary */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    <div className="lg:col-span-6 rounded-2xl border border-[#232835] bg-[#11141c] p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-[#1f2430] pb-2.5">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#39FF14]">
                          Review Delivery Details
                        </span>
                        <button
                          type="button"
                          onClick={() => setStep('form')}
                          className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-300 hover:text-[#39FF14] cursor-pointer"
                        >
                          <Edit3 className="h-3 w-3" /> Edit Details
                        </button>
                      </div>
                      <div className="space-y-1.5 text-zinc-300">
                        <p className="font-display text-sm font-bold text-white">
                          {fullName} · <span className="font-mono text-[#39FF14]">{profile?.escMemberId}</span>
                        </p>
                        <p>{college} · {branch} ({academicYear})</p>
                        <p className="font-mono text-[11px] text-zinc-400">
                          {profile?.email || user?.email} · +91 {mobileNumber.replace(/^\+?91/, '')}
                        </p>
                        <div className="rounded-xl border border-[#1e2430] bg-[#0b0d12] p-3 mt-2">
                          <span className="font-mono text-[10px] uppercase text-zinc-500 block mb-1">
                            Home Delivery Address
                          </span>
                          <p className="text-zinc-200 leading-relaxed">
                            {formatFullDeliveryAddress({
                              addressLine1,
                              streetArea,
                              cityVillage,
                              district,
                              state: stateName,
                              pinCode,
                            })}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Live Official ESC Card Preview */}
                    <div className="lg:col-span-6 rounded-2xl border border-[#232835] bg-[#11141c] p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#39FF14]">
                          Physical Card Print Preview
                        </span>
                        <div className="inline-flex rounded-lg border border-[#272c38] bg-[#0b0d12] p-0.5 text-[10px] font-mono">
                          <button
                            type="button"
                            onClick={() => setCardPreviewSide('front')}
                            className={`rounded-md px-2 py-0.5 cursor-pointer ${
                              cardPreviewSide === 'front' ? 'bg-[#39FF14] text-black font-bold' : 'text-zinc-400'
                            }`}
                          >
                            Front
                          </button>
                          <button
                            type="button"
                            onClick={() => setCardPreviewSide('back')}
                            className={`rounded-md px-2 py-0.5 cursor-pointer ${
                              cardPreviewSide === 'back' ? 'bg-[#39FF14] text-black font-bold' : 'text-zinc-400'
                            }`}
                          >
                            Back
                          </button>
                        </div>
                      </div>
                      {previewCardData && (
                        <EscMemberCardVisual
                          card={previewCardData}
                          qrDataUrl={memberQrDataUrl}
                          side={cardPreviewSide}
                        />
                      )}
                    </div>
                  </div>

                  {/* ESC-Branded UPI Payment Section */}
                  <div
                    data-testid="esc-upi-payment-checkout"
                    className="rounded-2xl border border-[#39FF14]/45 bg-[#06080b] p-5 sm:p-6 space-y-5 shadow-[0_0_40px_rgba(57,255,20,0.06)]"
                  >
                    {/* Header: COMPLETE YOUR PAYMENT */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                      <div className="space-y-1">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-[#39FF14] block">
                          Official ESC UPI Checkout · Pan-India Home Delivery
                        </span>
                        <h4 className="font-display text-xl sm:text-2xl font-black tracking-tight text-white">
                          COMPLETE YOUR PAYMENT
                        </h4>
                        <p className="text-xs sm:text-sm font-semibold text-zinc-200">
                          ESC Physical Member Card
                          {upiOrderRef && (
                            <span className="ml-2 font-mono text-[11px] font-normal text-zinc-400">
                              Ref: {upiOrderRef}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="self-start sm:self-center text-left sm:text-right rounded-xl border border-[#39FF14]/50 bg-[#39FF14]/12 px-4 py-2.5">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-300 block">
                          Total Amount
                        </span>
                        <span
                          data-testid="esc-upi-amount-display"
                          className="font-display text-2xl font-black text-[#39FF14] tabular-nums"
                        >
                          ₹{configuredPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Missing / Invalid UPI Configuration Guard */}
                    {settingsLoaded && !upiValidation.valid ? (
                      <div
                        data-testid="upi-config-error-banner"
                        className="rounded-2xl border border-red-600/60 bg-red-950/35 p-5 flex items-start gap-3 text-red-200"
                      >
                        <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h5 className="font-display text-sm font-bold text-white">
                            UPI Payment Temporarily Unavailable
                          </h5>
                          <p className="text-xs leading-relaxed text-red-200/90">
                            {upiValidation.error}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Payment Methods + Action Buttons */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                          {/* Left: Direct UPI App Payment + UPI ID + Action Buttons */}
                          <div className="md:col-span-7 space-y-4">
                            <div className="rounded-xl border border-white/10 bg-[#0c1016] p-4 space-y-2.5">
                              <span className="font-mono text-[10px] uppercase tracking-wider text-[#39FF14] block">
                                Payment Method
                              </span>
                              <ul className="space-y-1.5 text-xs text-zinc-200">
                                <li className="flex items-center gap-2">
                                  <Smartphone className="h-3.5 w-3.5 text-[#39FF14] shrink-0" />
                                  <span>Pay directly using UPI app.</span>
                                </li>
                                <li className="flex items-center gap-2">
                                  <QrCode className="h-3.5 w-3.5 text-[#39FF14] shrink-0" />
                                  <span>Scan QR code using any supported UPI app.</span>
                                </li>
                              </ul>
                            </div>

                            {/* Primary PAY NOW Deep Link + Quick Actions */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <a
                                href={upiPaymentUri || '#'}
                                onClick={handlePayNowClick}
                                data-testid="upi-pay-now-btn"
                                aria-disabled={!upiPaymentUri}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#39FF14] px-5 py-3.5 font-display text-xs sm:text-sm font-black uppercase tracking-wide text-black hover:bg-[#32e010] shadow-[0_0_24px_rgba(57,255,20,0.22)] transition-all cursor-pointer"
                              >
                                <ExternalLink className="h-4 w-4 shrink-0" />
                                PAY NOW
                              </a>

                              <button
                                type="button"
                                onClick={handleShowQrToggle}
                                data-testid="show-upi-qr-btn"
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#39FF14]/55 bg-[#0e1710] px-4 py-3.5 font-display text-xs font-extrabold uppercase tracking-wide text-[#39FF14] hover:bg-[#39FF14]/15 transition-all cursor-pointer"
                              >
                                <QrCode className="h-4 w-4 shrink-0" />
                                SHOW UPI QR CODE
                              </button>
                            </div>

                            {/* Mobile Deep-Link Fallback / Desktop Scan Hint */}
                            {payNowHint && (
                              <div className="rounded-xl border border-[#39FF14]/35 bg-[#0d1610] p-3.5 space-y-2.5 text-[11px] text-zinc-200 leading-relaxed">
                                <p>{payNowHint}</p>
                                {isAndroidDevice && androidIntentUri && (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <a
                                      href={androidIntentUri}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#39FF14]/60 bg-[#39FF14]/15 px-3 py-1.5 font-mono text-[11px] font-bold text-[#39FF14] hover:bg-[#39FF14]/25"
                                    >
                                      <Smartphone className="h-3.5 w-3.5" /> Try Android UPI Intent
                                    </a>
                                    <button
                                      type="button"
                                      onClick={handleDownloadQrCode}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-[11px] text-white hover:border-[#39FF14] cursor-pointer"
                                    >
                                      <Download className="h-3.5 w-3.5" /> Save QR &amp; Scan from Gallery
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Official ESC UPI ID + COPY UPI ID */}
                            <div className="space-y-1.5">
                              <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 block">
                                Official ESC UPI ID
                              </span>
                              <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 rounded-xl border border-[#39FF14]/45 bg-[#0b0e13] px-3.5 py-3">
                                <span
                                  data-testid="esc-configured-upi-id"
                                  className="font-mono text-sm sm:text-base font-bold text-white break-all"
                                >
                                  {configuredUpiId}
                                </span>
                                <button
                                  type="button"
                                  onClick={handleCopyUpiId}
                                  data-testid="copy-upi-id-btn"
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#39FF14] px-3.5 py-2 font-mono text-[11px] font-bold uppercase text-black hover:bg-[#32e010] shrink-0 cursor-pointer"
                                >
                                  {copiedUpi ? (
                                    <>
                                      <Check className="h-3.5 w-3.5" /> COPIED
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3.5 w-3.5" /> COPY UPI ID
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Supported UPI Apps Strip */}
                            <div className="space-y-1.5">
                              <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                                <Smartphone className="h-3.5 w-3.5 text-[#39FF14]" /> Supported UPI Apps
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {SUPPORTED_UPI_APPS.map((app) => (
                                  <span
                                    key={app}
                                    className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] text-zinc-200"
                                  >
                                    {app}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Right: High-Resolution Scannable UPI QR Code + DOWNLOAD QR CODE */}
                          <div
                            ref={qrSectionRef}
                            data-testid="esc-upi-qr-panel"
                            className={`md:col-span-5 flex flex-col items-center gap-3.5 rounded-2xl border border-[#39FF14]/40 bg-[#0b0e13] p-4 sm:p-5 ${
                              showQrPanel ? 'block' : 'hidden md:flex'
                            }`}
                          >
                            <div className="text-center space-y-0.5">
                              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#39FF14] block">
                                Scan &amp; Pay ₹{configuredPrice.toFixed(2)}
                              </span>
                              <span className="text-[11px] text-zinc-400">
                                Genuine NPCI UPI QR · {configuredPayeeName}
                              </span>
                            </div>

                            {/* Pure White Square Frame with ISO Quiet Zone & Crisp Pixelated Rendering */}
                            <div className="w-56 h-56 sm:w-60 sm:h-60 aspect-square rounded-2xl bg-white p-2.5 flex items-center justify-center shadow-[0_0_28px_rgba(57,255,20,0.2)]">
                              {upiQrDataUrl ? (
                                <img
                                  src={upiQrDataUrl}
                                  alt={`Scannable ESC UPI Payment QR Code for ₹${configuredPrice.toFixed(2)} to ${configuredUpiId}`}
                                  data-testid="esc-upi-qr-image"
                                  width={240}
                                  height={240}
                                  style={{ imageRendering: 'pixelated' }}
                                  className="w-full h-full aspect-square object-contain"
                                />
                              ) : (
                                <div className="flex flex-col items-center gap-2 text-zinc-700">
                                  <RefreshCw className="h-8 w-8 animate-spin" />
                                  <span className="font-mono text-[10px]">Generating QR...</span>
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={handleDownloadQrCode}
                              disabled={!upiQrDataUrl}
                              data-testid="download-upi-qr-btn"
                              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#39FF14]/50 bg-[#101911] px-4 py-2.5 font-mono text-[11px] font-bold uppercase text-[#39FF14] hover:bg-[#39FF14]/15 disabled:opacity-45 cursor-pointer"
                            >
                              <Download className="h-3.5 w-3.5" />
                              DOWNLOAD QR CODE
                            </button>
                          </div>
                        </div>

                        {/* Clear Post-Payment Return Instruction */}
                        <div className="rounded-xl border border-amber-500/40 bg-amber-950/25 px-4 py-3.5 flex items-start gap-2.5 text-xs text-amber-100 leading-relaxed">
                          <ShieldCheck className="h-4 w-4 text-[#39FF14] shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-white block">
                              After completing your payment, return to this page and enter your UPI Transaction ID / UTR number.
                            </strong>
                            <span className="text-[11px] text-amber-200/85">
                              Your order status starts as <strong>PENDING VERIFICATION</strong>. Only the ESC Admin manually verifies payments before card printing and pan-India dispatch.
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Payment Confirmation Form (UTR Mandatory, Screenshot Optional) */}
                  <div className="rounded-2xl border border-[#232835] bg-[#11141c] p-5 space-y-4">
                    <h4 className="font-display text-sm font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-[#39FF14]" /> Payment Confirmation Details
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-zinc-200 mb-1.5">
                          UPI Transaction ID / UTR Number <span className="text-[#39FF14]">* (Mandatory)</span>
                        </label>
                        <input
                          type="text"
                          value={transactionId}
                          onChange={(e) => setTransactionId(e.target.value)}
                          placeholder="Enter 12-digit UTR / UPI Ref No."
                          required
                          disabled={!upiValidation.valid}
                          data-testid="card-order-utr-input"
                          className="w-full rounded-xl border border-[#2b303c] bg-[#161922] px-3.5 py-2.5 font-mono text-white placeholder:text-zinc-500 focus:border-[#39FF14] focus:outline-none disabled:opacity-50"
                        />
                        {paymentErrors.transactionId && (
                          <span className="text-[11px] text-red-400 mt-1 block">
                            {paymentErrors.transactionId}
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block font-semibold text-zinc-200 mb-1.5">
                          Payment Screenshot <span className="text-zinc-400 font-normal">(Optional · JPG / JPEG / PNG)</span>
                        </label>
                        <input
                          ref={screenshotInputRef}
                          type="file"
                          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                          onChange={handleScreenshotSelected}
                          className="hidden"
                        />
                        {!paymentScreenshotUrl ? (
                          <button
                            type="button"
                            onClick={() => screenshotInputRef.current?.click()}
                            disabled={uploadingScreenshot || !upiValidation.valid}
                            data-testid="upload-payment-screenshot-btn"
                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#2f3644] bg-[#0e1219] px-4 py-2.5 font-mono text-xs font-semibold text-zinc-300 hover:border-[#39FF14]/60 hover:text-[#39FF14] disabled:opacity-50 cursor-pointer"
                          >
                            {uploadingScreenshot ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                            {uploadingScreenshot
                              ? 'Processing Screenshot...'
                              : 'Upload Payment Screenshot (Optional)'}
                          </button>
                        ) : (
                          <div className="flex items-center justify-between gap-2.5 rounded-xl border border-[#39FF14]/45 bg-[#0e160f] px-3 py-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={paymentScreenshotUrl}
                                alt="Payment screenshot preview"
                                className="h-10 w-10 rounded-lg object-cover border border-[#39FF14]/40 shrink-0"
                              />
                              <div className="min-w-0">
                                <span className="font-mono text-[11px] font-semibold text-[#39FF14] flex items-center gap-1 truncate">
                                  <FileImage className="h-3.5 w-3.5 shrink-0" />
                                  {paymentScreenshotName || 'Payment Screenshot Ready'}
                                </span>
                                <span className="text-[10px] text-zinc-400">Attached for Admin verification</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => screenshotInputRef.current?.click()}
                                className="rounded-lg border border-[#2c3340] bg-[#141820] px-2 py-1 font-mono text-[10px] text-zinc-200 hover:border-[#39FF14] cursor-pointer"
                              >
                                Replace
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPaymentScreenshotUrl('');
                                  setPaymentScreenshotName('');
                                }}
                                aria-label="Remove optional screenshot"
                                className="rounded-lg border border-red-900/60 bg-red-950/40 p-1 text-red-300 hover:bg-red-900/50 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                        {paymentErrors.paymentScreenshotUrl && (
                          <span className="text-[11px] text-red-400 mt-1 block">
                            {paymentErrors.paymentScreenshotUrl}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Mandatory Payment Confirmation Checkbox */}
                    <label className="flex items-start gap-2.5 rounded-xl border border-[#262d3a] bg-[#0c0f15] p-3.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={paymentConfirmed}
                        disabled={!upiValidation.valid}
                        onChange={(e) => setPaymentConfirmed(e.target.checked)}
                        data-testid="confirm-payment-151-checkbox"
                        className="mt-0.5 h-4 w-4 accent-[#39FF14] shrink-0"
                      />
                      <span className="text-xs font-semibold text-white">
                        I confirm that I have completed the payment of ₹{configuredPrice}.
                      </span>
                    </label>
                    {paymentErrors.paymentConfirmedByMember && (
                      <p className="text-[11px] text-red-400">{paymentErrors.paymentConfirmedByMember}</p>
                    )}

                    {submitError && (
                      <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-xs text-red-200 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                        <span>{submitError}</span>
                      </div>
                    )}
                  </div>

                  {/* Step 2 Footer */}
                  <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 border-t border-[#1e232e] pt-4">
                    <button
                      type="button"
                      onClick={() => setStep('form')}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#2b303c] px-4 py-2.5 text-zinc-300 hover:text-white cursor-pointer"
                    >
                      <ArrowLeft className="h-4 w-4" /> Edit Delivery Details
                    </button>
                    <button
                      type="submit"
                      disabled={!canClickSubmitPayment}
                      data-testid="submit-physical-card-order-btn"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#39FF14] px-6 py-3 font-display text-xs font-black uppercase tracking-wide text-black hover:bg-[#32e010] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {submittingOrder ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {submittingOrder ? 'Submitting Payment Details...' : 'SUBMIT PAYMENT DETAILS'}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: ORDER SUBMISSION CONFIRMATION */}
              {step === 'confirmed' && submittedOrder && (
                <div
                  data-testid="physical-card-order-confirmation"
                  className="p-6 sm:p-8 text-center space-y-6"
                >
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#39FF14]/50 bg-[#39FF14]/15 text-[#39FF14]">
                    <CheckCircle2 className="h-9 w-9" />
                  </div>

                  <div className="space-y-2 max-w-xl mx-auto">
                    <h4 className="font-display text-xl sm:text-2xl font-black text-white tracking-tight">
                      YOUR ESC MEMBER CARD ORDER HAS BEEN SUBMITTED SUCCESSFULLY!
                    </h4>
                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                      Thank you for ordering your official ESC Physical Member Card. Your payment details and delivery information have been submitted for verification.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-left max-w-2xl mx-auto text-xs">
                    <div className="rounded-xl border border-[#232935] bg-[#11141c] p-3.5">
                      <span className="font-mono text-[10px] uppercase text-zinc-500 block">Order ID</span>
                      <span className="font-mono text-sm font-bold text-[#39FF14]">
                        {submittedOrder.orderId}
                      </span>
                    </div>
                    <div className="rounded-xl border border-[#232935] bg-[#11141c] p-3.5">
                      <span className="font-mono text-[10px] uppercase text-zinc-500 block">Member Name</span>
                      <span className="font-semibold text-white">{submittedOrder.fullName}</span>
                    </div>
                    <div className="rounded-xl border border-[#232935] bg-[#11141c] p-3.5">
                      <span className="font-mono text-[10px] uppercase text-zinc-500 block">Member ID</span>
                      <span className="font-mono font-bold text-white">{submittedOrder.escMemberId}</span>
                    </div>
                    <div className="rounded-xl border border-[#232935] bg-[#11141c] p-3.5">
                      <span className="font-mono text-[10px] uppercase text-zinc-500 block">Amount</span>
                      <span className="font-mono font-bold text-white">₹{submittedOrder.amountInr}</span>
                    </div>
                    <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-3.5">
                      <span className="font-mono text-[10px] uppercase text-amber-300/80 block">
                        Payment Status
                      </span>
                      <span className="font-mono font-bold text-amber-300">
                        {getPaymentStatusLabel(submittedOrder.paymentStatus)}
                      </span>
                    </div>
                    <div className="rounded-xl border border-[#39FF14]/35 bg-[#0e160f] p-3.5">
                      <span className="font-mono text-[10px] uppercase text-zinc-400 block">
                        Order Status
                      </span>
                      <span className="font-mono font-bold text-[#39FF14]">
                        {getCardOrderStatusLabel(submittedOrder.orderStatus)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setModalOpen(false);
                        navigate('/dashboard');
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#39FF14] px-6 py-3 font-display text-xs font-black uppercase tracking-wide text-black hover:bg-[#32e010] cursor-pointer"
                    >
                      <Package className="h-4 w-4" /> Track Order in Member Dashboard
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      className="rounded-xl border border-[#2b303c] bg-[#141820] px-5 py-3 text-xs font-mono text-zinc-200 hover:border-[#39FF14] cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* Reusable Profile Photo Cropper Modal */}
      {user && (
        <ProfilePhotoUploaderModal
          isOpen={photoModalOpen}
          currentPhotoUrl={profilePhotoUrl}
          userUid={user.uid}
          onClose={() => setPhotoModalOpen(false)}
          onSavePhoto={async (photoUrl) => {
            setProfilePhotoUrl(photoUrl);
            setFormErrors((prev) => {
              const next = { ...prev };
              delete next.profilePhotoUrl;
              return next;
            });
            await updateUserProfile({
              profilePhotoUrl: photoUrl,
              profilePhotoUpdatedAt: new Date().toISOString(),
            }).catch(() => {});
          }}
        />
      )}
    </section>
  );
};
