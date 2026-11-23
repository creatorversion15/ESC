import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  MapPin,
  Package,
  Plus,
  Truck,
} from 'lucide-react';
import type { MemberCardOrder } from '../../types';
import { buildMemberVerificationUrl } from '../../utils/memberOnboardingLogic';
import {
  CARD_ORDER_STATUS_LIST,
  formatFullDeliveryAddress,
  getCardOrderStatusLabel,
  getCardOrderStatusStep,
  getPaymentStatusLabel,
} from '../../utils/physicalCardOrderLogic';
import { EscMemberCardVisual } from '../DigitalMemberCardSection';

interface MemberCardOrdersPanelProps {
  orders: MemberCardOrder[];
  navigate: (path: string) => void;
}

const PROGRESS_STEPS = CARD_ORDER_STATUS_LIST.filter((s) => s.stepIndex > 0);

const OrderTrackingCard: React.FC<{ order: MemberCardOrder }> = ({ order }) => {
  const [cardSide, setCardSide] = useState<'front' | 'back'>('front');
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(buildMemberVerificationUrl(order.escMemberId), {
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#07090B', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [order.escMemberId]);

  const currentStep = getCardOrderStatusStep(order.orderStatus);
  const isRejected = order.orderStatus === 'rejected' || order.paymentStatus === 'rejected';

  const paymentBadgeClass =
    order.paymentStatus === 'verified'
      ? 'border-[#39FF14]/50 bg-[#39FF14]/15 text-[#39FF14]'
      : order.paymentStatus === 'rejected'
        ? 'border-red-500/60 bg-red-950/60 text-red-300'
        : 'border-amber-500/50 bg-amber-950/40 text-amber-300';

  const orderBadgeClass =
    order.orderStatus === 'delivered'
      ? 'border-[#39FF14]/60 bg-[#39FF14]/20 text-[#39FF14]'
      : order.orderStatus === 'rejected'
        ? 'border-red-500/60 bg-red-950/60 text-red-300'
        : 'border-sky-500/45 bg-sky-950/40 text-sky-300';

  return (
    <div
      data-testid={`member-card-order-${order.orderId}`}
      className="rounded-2xl border border-[#232834] bg-[#111318] p-5 sm:p-6 space-y-6"
    >
      {/* Top Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1f242e] pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-extrabold text-[#39FF14]">{order.orderId}</span>
            <span className="font-mono text-[11px] text-zinc-400">
              · Ordered {new Date(order.createdAt).toLocaleDateString()}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Member ID: <strong className="font-mono text-white">{order.escMemberId}</strong> · Amount Paid:{' '}
            <strong className="font-mono text-white">₹{order.amountInr}</strong> · UTR:{' '}
            <strong className="font-mono text-zinc-200">{order.transactionId}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] font-bold ${paymentBadgeClass}`}>
            Payment: {getPaymentStatusLabel(order.paymentStatus)}
          </span>
          <span className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] font-bold ${orderBadgeClass}`}>
            {getCardOrderStatusLabel(order.orderStatus)}
          </span>
        </div>
      </div>

      {/* Delivery Status Progress Timeline */}
      {isRejected ? (
        <div className="rounded-xl border border-red-800/70 bg-red-950/30 p-4 flex items-start gap-3 text-xs text-red-200">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-display font-bold text-white">Order Status: Rejected / Payment Issue</p>
            <p>
              {order.adminNotes ||
                'ESC Administration could not verify the submitted payment details. Please contact ESC Support with your Order ID and UTR number.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 block">
            Live Order Progress ({currentStep} of {PROGRESS_STEPS.length})
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {PROGRESS_STEPS.map((st) => {
              const completed = currentStep >= st.stepIndex;
              const isCurrent = currentStep === st.stepIndex;
              return (
                <div
                  key={st.value}
                  className={`rounded-xl border p-2.5 text-[10px] transition-colors ${
                    isCurrent
                      ? 'border-[#39FF14] bg-[#39FF14]/15 text-white'
                      : completed
                        ? 'border-[#39FF14]/35 bg-[#0e160f] text-zinc-200'
                        : 'border-[#1f232c] bg-[#0b0d12] text-zinc-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`font-mono font-bold ${
                        completed ? 'text-[#39FF14]' : 'text-zinc-600'
                      }`}
                    >
                      0{st.stepIndex}
                    </span>
                    {completed && <CheckCircle2 className="h-3 w-3 text-[#39FF14]" />}
                  </div>
                  <span className="font-semibold leading-tight block">{st.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Grid: Card Preview + Delivery & Courier Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Official Card Preview */}
        <div className="lg:col-span-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#39FF14]">
              Member Card Preview
            </span>
            <div className="inline-flex rounded-lg border border-[#252a36] bg-[#0b0d12] p-0.5 text-[10px] font-mono">
              <button
                type="button"
                onClick={() => setCardSide('front')}
                className={`rounded px-2 py-0.5 cursor-pointer ${
                  cardSide === 'front' ? 'bg-[#39FF14] text-black font-bold' : 'text-zinc-400'
                }`}
              >
                Front
              </button>
              <button
                type="button"
                onClick={() => setCardSide('back')}
                className={`rounded px-2 py-0.5 cursor-pointer ${
                  cardSide === 'back' ? 'bg-[#39FF14] text-black font-bold' : 'text-zinc-400'
                }`}
              >
                Back (QR)
              </button>
            </div>
          </div>

          <EscMemberCardVisual
            card={{
              fullName: order.fullName,
              escMemberId: order.escMemberId,
              college: order.college,
              branch: order.branch,
              academicYear: order.academicYear,
              designation: 'ESC MEMBER',
              statusLabel: 'Active',
              profilePhotoUrl: order.profilePhotoUrl,
            }}
            qrDataUrl={qrDataUrl}
            side={cardSide}
          />
        </div>

        {/* Order, Delivery & Courier Info */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="sm:col-span-2 rounded-xl border border-[#202531] bg-[#0c0e13] p-3.5 space-y-1">
            <span className="font-mono text-[10px] uppercase text-zinc-500 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-[#39FF14]" /> Home Delivery Address
            </span>
            <p className="text-zinc-200 leading-relaxed">{formatFullDeliveryAddress(order)}</p>
            <p className="font-mono text-[11px] text-zinc-400">
              Recipient: {order.fullName} · Mobile: {order.mobileNumber}
            </p>
          </div>

          <div className="rounded-xl border border-[#202531] bg-[#0c0e13] p-3.5">
            <span className="font-mono text-[10px] uppercase text-zinc-500 block">Amount &amp; UPI UTR</span>
            <p className="font-mono font-bold text-white mt-0.5">₹{order.amountInr}</p>
            <p className="font-mono text-[11px] text-zinc-400 break-all mt-0.5">
              UTR: {order.transactionId}
            </p>
          </div>

          <div className="rounded-xl border border-[#202531] bg-[#0c0e13] p-3.5">
            <span className="font-mono text-[10px] uppercase text-zinc-500 block">Order &amp; Dispatch Dates</span>
            <p className="text-zinc-200 mt-0.5">
              Ordered: <strong className="font-mono">{new Date(order.createdAt).toLocaleDateString()}</strong>
            </p>
            <p className="text-zinc-400 mt-0.5">
              Dispatched:{' '}
              <strong className="font-mono text-zinc-200">
                {order.dispatchDate || 'Awaiting Dispatch'}
              </strong>
            </p>
            {order.deliveredDate && (
              <p className="text-[#39FF14] mt-0.5">
                Delivered: <strong className="font-mono">{order.deliveredDate}</strong>
              </p>
            )}
          </div>

          <div className="sm:col-span-2 rounded-xl border border-[#202531] bg-[#0c0e13] p-3.5">
            <span className="font-mono text-[10px] uppercase text-zinc-500 flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-[#39FF14]" /> Courier &amp; Tracking Details
            </span>
            {order.courierCompany || order.trackingNumber ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-4">
                <div>
                  <span className="text-[10px] text-zinc-500 block">Courier Partner</span>
                  <span className="font-semibold text-white">{order.courierCompany || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 block">Tracking Number</span>
                  <span className="font-mono font-bold text-[#39FF14]">{order.trackingNumber || '—'}</span>
                </div>
              </div>
            ) : (
              <p className="text-zinc-400 mt-1">
                Courier partner and tracking number will appear here once ESC Admin dispatches your card.
              </p>
            )}
          </div>

          {order.adminNotes && !isRejected && (
            <div className="sm:col-span-2 rounded-xl border border-[#283529] bg-[#0e150f] p-3.5">
              <span className="font-mono text-[10px] uppercase text-[#39FF14] block mb-0.5">
                ESC Card Desk Update
              </span>
              <p className="text-zinc-200">{order.adminNotes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const MemberCardOrdersPanel: React.FC<MemberCardOrdersPanelProps> = ({
  orders,
  navigate,
}) => {
  return (
    <div className="space-y-5" data-testid="member-card-orders-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-[#39FF14]" /> Physical ESC Member Card Orders
          </h2>
          <p className="text-xs text-[#8e919b]">
            Track payment verification, card printing, dispatch date, and pan-India courier delivery for your official ESC Physical Member Card.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/verify')}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#39FF14] px-4 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#32e010] cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" /> Order Physical Member Card (₹151)
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-[#232731] bg-[#111317] p-10 text-center space-y-3">
          <Package className="h-9 w-9 text-zinc-600 mx-auto" />
          <p className="font-display text-base font-bold text-white">
            No physical member card orders yet
          </p>
          <p className="text-xs text-[#8e919b] max-w-md mx-auto">
            Get your official ESC Physical Member Card delivered to your doorstep anywhere in India for a flat ₹151.
          </p>
          <button
            type="button"
            onClick={() => navigate('/verify')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#39FF14] px-5 py-2.5 font-display text-xs font-bold uppercase text-black hover:bg-[#32e010] cursor-pointer"
          >
            <CreditCard className="h-4 w-4" /> ORDER YOUR PHYSICAL ESC MEMBER CARD
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {orders.map((order) => (
            <OrderTrackingCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
};
