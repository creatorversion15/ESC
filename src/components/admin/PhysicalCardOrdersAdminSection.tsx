import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import {
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileDown,
  MapPin,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import type { CardOrderPaymentStatus, CardOrderStatus, MemberCardOrder } from '../../types';
import { buildMemberVerificationUrl } from '../../utils/memberOnboardingLogic';
import {
  downloadMemberCardPdf,
  downloadMemberCardPng,
  type MemberCardData,
} from '../../utils/memberCardExport';
import {
  buildCardOrdersCsv,
  CARD_ORDER_STATUS_LIST,
  formatFullDeliveryAddress,
  getCardOrderStatusLabel,
  getPaymentStatusLabel,
} from '../../utils/physicalCardOrderLogic';
import { EscMemberCardVisual } from '../DigitalMemberCardSection';

interface PhysicalCardOrdersAdminSectionProps {
  orders: MemberCardOrder[];
  setOrders: React.Dispatch<React.SetStateAction<MemberCardOrder[]>>;
  onRefresh: () => Promise<void>;
  onNotify: (type: 'success' | 'error', text: string) => void;
}

export const PhysicalCardOrdersAdminSection: React.FC<PhysicalCardOrdersAdminSectionProps> = ({
  orders,
  setOrders,
  onRefresh,
  onNotify,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | CardOrderStatus>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | CardOrderPaymentStatus>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Selected Order Management Modal
  const [selectedOrder, setSelectedOrder] = useState<MemberCardOrder | null>(null);
  const [editPaymentStatus, setEditPaymentStatus] = useState<CardOrderPaymentStatus>('pending_verification');
  const [editOrderStatus, setEditOrderStatus] = useState<CardOrderStatus>('order_received');
  const [editCourier, setEditCourier] = useState('');
  const [editTracking, setEditTracking] = useState('');
  const [editDispatchDate, setEditDispatchDate] = useState('');
  const [editDeliveredDate, setEditDeliveredDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingUpdate, setSavingUpdate] = useState(false);

  // Card Print Preview & Screenshot Zoom
  const [cardSide, setCardSide] = useState<'front' | 'back'>('front');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [exportingPng, setExportingPng] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [screenshotLightboxUrl, setScreenshotLightboxUrl] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const openOrderModal = (order: MemberCardOrder) => {
    setSelectedOrder(order);
    setEditPaymentStatus(order.paymentStatus);
    setEditOrderStatus(order.orderStatus);
    setEditCourier(order.courierCompany || '');
    setEditTracking(order.trackingNumber || '');
    setEditDispatchDate(order.dispatchDate || '');
    setEditDeliveredDate(order.deliveredDate || '');
    setEditNotes(order.adminNotes || '');
    setCardSide('front');
  };

  useEffect(() => {
    if (!selectedOrder?.escMemberId) {
      setQrDataUrl('');
      return;
    }
    let active = true;
    QRCode.toDataURL(buildMemberVerificationUrl(selectedOrder.escMemberId), {
      width: 280,
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
  }, [selectedOrder?.escMemberId]);

  const stats = useMemo(() => {
    const total = orders.length;
    const pendingVerify = orders.filter((o) => o.paymentStatus === 'pending_verification').length;
    const inProduction = orders.filter((o) =>
      ['payment_verified', 'card_processing', 'card_printed'].includes(o.orderStatus)
    ).length;
    const dispatchedOrDelivered = orders.filter((o) =>
      ['dispatched', 'out_for_delivery', 'delivered'].includes(o.orderStatus)
    ).length;
    return { total, pendingVerify, inProduction, dispatchedOrDelivered };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((o) => {
      if (orderStatusFilter !== 'all' && o.orderStatus !== orderStatusFilter) return false;
      if (paymentFilter !== 'all' && o.paymentStatus !== paymentFilter) return false;
      if (!q) return true;
      return (
        o.orderId.toLowerCase().includes(q) ||
        o.fullName.toLowerCase().includes(q) ||
        o.escMemberId.toLowerCase().includes(q) ||
        o.transactionId.toLowerCase().includes(q) ||
        o.email.toLowerCase().includes(q) ||
        o.pinCode.toLowerCase().includes(q) ||
        o.cityVillage.toLowerCase().includes(q)
      );
    });
  }, [orders, searchQuery, orderStatusFilter, paymentFilter]);

  const handleSaveOrderUpdate = async (
    override?: Partial<{
      paymentStatus: CardOrderPaymentStatus;
      orderStatus: CardOrderStatus;
    }>
  ) => {
    if (!selectedOrder) return;
    try {
      setSavingUpdate(true);
      const nextPayment = override?.paymentStatus ?? editPaymentStatus;
      const nextOrder = override?.orderStatus ?? editOrderStatus;

      const updated = await apiRequest<MemberCardOrder>(
        `/api/admin/card-orders/${encodeURIComponent(selectedOrder.id)}`,
        {
          method: 'PATCH',
          requireAuth: true,
          body: {
            paymentStatus: nextPayment,
            orderStatus: nextOrder,
            courierCompany: editCourier.trim(),
            trackingNumber: editTracking.trim(),
            dispatchDate: editDispatchDate.trim(),
            deliveredDate: editDeliveredDate.trim(),
            adminNotes: editNotes.trim(),
          },
        }
      );

      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setSelectedOrder(updated);
      setEditPaymentStatus(updated.paymentStatus);
      setEditOrderStatus(updated.orderStatus);
      onNotify(
        'success',
        `Updated ${updated.orderId} → ${getCardOrderStatusLabel(updated.orderStatus)} (Member notified).`
      );
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to update physical member card order.');
    } finally {
      setSavingUpdate(false);
    }
  };

  const handleExportCsv = () => {
    if (filteredOrders.length === 0) {
      onNotify('error', 'No card orders match the current filters to export.');
      return;
    }
    const csv = buildCardOrdersCsv(filteredOrders);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `esc_physical_card_orders_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('success', `Exported ${filteredOrders.length} card orders to CSV.`);
  };

  const buildPrintCardData = (order: MemberCardOrder): MemberCardData => ({
    fullName: order.fullName,
    escMemberId: order.escMemberId,
    college: order.college,
    branch: order.branch,
    academicYear: order.academicYear,
    designation: 'ESC MEMBER',
    statusLabel: 'Active',
    profilePhotoUrl: order.profilePhotoUrl,
  });

  const handleDownloadPrintPng = async () => {
    if (!selectedOrder) return;
    try {
      setExportingPng(true);
      const { filename } = await downloadMemberCardPng(buildPrintCardData(selectedOrder));
      onNotify('success', `Exported print-ready PNG: ${filename}`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to export print-ready PNG card.');
    } finally {
      setExportingPng(false);
    }
  };

  const handleDownloadPrintPdf = async () => {
    if (!selectedOrder) return;
    try {
      setExportingPdf(true);
      const { filename } = await downloadMemberCardPdf(buildPrintCardData(selectedOrder));
      onNotify('success', `Exported print-ready PDF: ${filename}`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to export print-ready PDF card.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleCopyDeliveryAddress = async () => {
    if (!selectedOrder) return;
    const text = `${selectedOrder.fullName}\n${formatFullDeliveryAddress(selectedOrder)}\nMobile: ${selectedOrder.mobileNumber}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(true);
      window.setTimeout(() => setCopiedAddress(false), 2000);
    } catch {
      setCopiedAddress(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-card-orders-section">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#222630] bg-[#101217] p-4">
          <span className="font-mono text-[10px] uppercase text-zinc-500 block">Total Card Orders</span>
          <p className="font-display text-2xl font-extrabold text-white mt-1 tabular-nums">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/35 bg-amber-950/15 p-4">
          <span className="font-mono text-[10px] uppercase text-amber-300/80 block">
            Pending Payment Verification
          </span>
          <p className="font-display text-2xl font-extrabold text-amber-300 mt-1 tabular-nums">
            {stats.pendingVerify}
          </p>
        </div>
        <div className="rounded-2xl border border-sky-500/35 bg-sky-950/15 p-4">
          <span className="font-mono text-[10px] uppercase text-sky-300/80 block">
            Verified &amp; In Production
          </span>
          <p className="font-display text-2xl font-extrabold text-sky-300 mt-1 tabular-nums">
            {stats.inProduction}
          </p>
        </div>
        <div className="rounded-2xl border border-[#39FF14]/35 bg-[#0e160f] p-4">
          <span className="font-mono text-[10px] uppercase text-[#39FF14]/80 block">
            Dispatched / Delivered
          </span>
          <p className="font-display text-2xl font-extrabold text-[#39FF14] mt-1 tabular-nums">
            {stats.dispatchedOrDelivered}
          </p>
        </div>
      </div>

      {/* Filter & Export Toolbar */}
      <div className="rounded-2xl border border-[#222630] bg-[#101217] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Order ID, Member Name, Member ID, UTR, PIN..."
              className="w-full rounded-xl border border-[#282d38] bg-[#151821] pl-9 pr-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-[#39FF14] focus:outline-none"
            />
          </div>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as any)}
            className="rounded-xl border border-[#282d38] bg-[#151821] px-3 py-2 text-xs text-white focus:border-[#39FF14] focus:outline-none"
          >
            <option value="all">All Payment Statuses</option>
            <option value="pending_verification">Pending Verification</option>
            <option value="verified">Payment Verified</option>
            <option value="rejected">Rejected / Issue</option>
          </select>

          <select
            value={orderStatusFilter}
            onChange={(e) => setOrderStatusFilter(e.target.value as any)}
            className="rounded-xl border border-[#282d38] bg-[#151821] px-3 py-2 text-xs text-white focus:border-[#39FF14] focus:outline-none"
          >
            <option value="all">All Order Statuses</option>
            {CARD_ORDER_STATUS_LIST.map((st) => (
              <option key={st.value} value={st.value}>
                {st.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={async () => {
              setRefreshing(true);
              try {
                await onRefresh();
              } finally {
                setRefreshing(false);
              }
            }}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#2a303c] bg-[#151821] px-3.5 py-2 text-xs font-mono text-zinc-200 hover:border-[#39FF14] cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#39FF14] px-4 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#32e010] cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" /> Export Orders CSV
          </button>
        </div>
      </div>

      {/* Orders Table */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-[#222630] bg-[#101217] p-12 text-center space-y-2">
          <CreditCard className="h-8 w-8 text-zinc-600 mx-auto" />
          <p className="text-sm font-semibold text-white">No physical member card orders found</p>
          <p className="text-xs text-zinc-500">
            Orders placed by approved ESC members on the Verify Certificate page will appear here immediately.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#222630] bg-[#101217] overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#1f2229] bg-[#151821] text-zinc-400 font-mono text-[10px] uppercase">
              <tr>
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Location &amp; PIN</th>
                <th className="px-4 py-3">Amount &amp; UTR</th>
                <th className="px-4 py-3">Payment Status</th>
                <th className="px-4 py-3">Order Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c1f26]">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-[#141720]">
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className="font-mono font-bold text-[#39FF14] block">{order.orderId}</span>
                    <span className="font-mono text-[10px] text-zinc-500">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      {order.profilePhotoUrl && (
                        <img
                          src={order.profilePhotoUrl}
                          alt={order.fullName}
                          className="h-8 w-8 rounded-lg object-cover border border-[#39FF14]/40 shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <span className="font-semibold text-white block truncate">{order.fullName}</span>
                        <span className="font-mono text-[10px] text-zinc-400 block">
                          {order.escMemberId} · {order.mobileNumber}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-zinc-300">
                    <span className="block truncate max-w-[180px]">
                      {order.cityVillage}, {order.state}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500">PIN: {order.pinCode}</span>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className="font-mono font-bold text-white block">₹{order.amountInr}</span>
                    <span className="font-mono text-[10px] text-zinc-400">{order.transactionId}</span>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span
                      className={`inline-flex rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold ${
                        order.paymentStatus === 'verified'
                          ? 'border-[#39FF14]/50 bg-[#39FF14]/15 text-[#39FF14]'
                          : order.paymentStatus === 'rejected'
                            ? 'border-red-500/60 bg-red-950/50 text-red-300'
                            : 'border-amber-500/50 bg-amber-950/40 text-amber-300'
                      }`}
                    >
                      {getPaymentStatusLabel(order.paymentStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className="inline-flex rounded-md border border-[#2b3140] bg-[#161a24] px-2 py-0.5 font-mono text-[10px] text-zinc-200">
                      {getCardOrderStatusLabel(order.orderStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openOrderModal(order)}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#39FF14] px-3 py-1.5 font-mono text-[11px] font-bold text-black hover:bg-[#32e010] cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" /> Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detailed Order Management Modal */}
      {selectedOrder &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-card-order-modal-title"
            className="fixed inset-0 z-[105] flex items-start justify-center bg-black/85 p-3 sm:p-6 backdrop-blur-md overflow-y-auto"
          >
            <div className="w-full max-w-5xl rounded-2xl border border-[#262c38] bg-[#0e1116] shadow-2xl my-4 sm:my-8 overflow-hidden text-xs">
              {/* Header */}
              <div className="flex items-center justify-between gap-4 border-b border-[#1f242f] bg-[#12161e] px-5 py-4 sm:px-6">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#39FF14] block">
                    Physical Member Card Order · {selectedOrder.orderId}
                  </span>
                  <h3
                    id="admin-card-order-modal-title"
                    className="font-display text-lg font-extrabold text-white"
                  >
                    {selectedOrder.fullName} ({selectedOrder.escMemberId})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-[#1c212c] hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-5 sm:p-6 space-y-6">
                {/* Top Row: Member & Delivery Info + Official Card Export */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <div className="lg:col-span-6 space-y-4">
                    <div className="rounded-2xl border border-[#222835] bg-[#12151d] p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase text-[#39FF14] flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" /> Member &amp; Shipping Address
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyDeliveryAddress}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#2b313e] bg-[#181c26] px-2.5 py-1 font-mono text-[10px] text-zinc-200 hover:border-[#39FF14] cursor-pointer"
                        >
                          {copiedAddress ? <Check className="h-3 w-3 text-[#39FF14]" /> : <Copy className="h-3 w-3" />}
                          {copiedAddress ? 'Copied' : 'Copy Address'}
                        </button>
                      </div>
                      <p className="text-white font-semibold">{selectedOrder.fullName}</p>
                      <p className="text-zinc-300 leading-relaxed">
                        {formatFullDeliveryAddress(selectedOrder)}
                      </p>
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1e232e] text-[11px]">
                        <div>
                          <span className="text-zinc-500 block">Mobile</span>
                          <span className="font-mono text-white">{selectedOrder.mobileNumber}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block">Email</span>
                          <span className="font-mono text-white break-all">{selectedOrder.email}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block">College</span>
                          <span className="text-zinc-200">{selectedOrder.college}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block">Branch &amp; Year</span>
                          <span className="text-zinc-200">
                            {selectedOrder.branch} ({selectedOrder.academicYear})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Payment Proof & Screenshot Verification */}
                    <div className="rounded-2xl border border-[#222835] bg-[#12151d] p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] uppercase text-[#39FF14] flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5" /> UPI Payment Proof
                        </span>
                        <span className="font-mono text-sm font-bold text-white">
                          ₹{selectedOrder.amountInr}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-zinc-500 block">UTR / Transaction ID</span>
                          <span className="font-mono font-bold text-[#39FF14] break-all">
                            {selectedOrder.transactionId}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block">UPI ID Paid To</span>
                          <span className="font-mono text-zinc-200 break-all">
                            {selectedOrder.upiIdUsed}
                          </span>
                        </div>
                      </div>

                      {selectedOrder.paymentScreenshotUrl ? (
                        <div className="space-y-2">
                          <span className="text-[10px] font-mono uppercase text-zinc-500 block">
                            Submitted Payment Screenshot (Click to Enlarge)
                          </span>
                          <button
                            type="button"
                            onClick={() => setScreenshotLightboxUrl(selectedOrder.paymentScreenshotUrl)}
                            className="group relative block w-full overflow-hidden rounded-xl border border-[#2a313f] bg-black cursor-pointer"
                          >
                            <img
                              src={selectedOrder.paymentScreenshotUrl}
                              alt={`Payment screenshot for ${selectedOrder.orderId}`}
                              className="max-h-52 w-full object-contain mx-auto"
                            />
                            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-black/80 px-2.5 py-1 font-mono text-[10px] text-[#39FF14] border border-[#39FF14]/40">
                              <ExternalLink className="h-3 w-3" /> View Full Size
                            </span>
                          </button>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-[#252b37] bg-[#0c0f15] px-3 py-2.5 text-[11px] text-zinc-400">
                          No payment screenshot uploaded (optional) — verify payment directly using the UTR / Transaction ID above.
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          disabled={savingUpdate}
                          onClick={() =>
                            handleSaveOrderUpdate({
                              paymentStatus: 'verified',
                              orderStatus:
                                editOrderStatus === 'order_received' ||
                                editOrderStatus === 'payment_verification_pending'
                                  ? 'payment_verified'
                                  : editOrderStatus,
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#39FF14] px-3.5 py-2 font-display text-[11px] font-bold uppercase text-black hover:bg-[#32e010] disabled:opacity-50 cursor-pointer"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Verify Payment
                        </button>
                        <button
                          type="button"
                          disabled={savingUpdate}
                          onClick={() =>
                            handleSaveOrderUpdate({
                              paymentStatus: 'rejected',
                              orderStatus: 'rejected',
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl border border-red-700/70 bg-red-950/50 px-3.5 py-2 font-display text-[11px] font-bold uppercase text-red-200 hover:bg-red-900/60 disabled:opacity-50 cursor-pointer"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject Payment
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Print-Ready Card + Fulfillment Controls */}
                  <div className="lg:col-span-6 space-y-4">
                    <div className="rounded-2xl border border-[#222835] bg-[#12151d] p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] uppercase text-[#39FF14]">
                          Print-Ready ESC Member Card
                        </span>
                        <div className="inline-flex rounded-lg border border-[#272c38] bg-[#0b0d12] p-0.5 text-[10px] font-mono">
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
                            Back
                          </button>
                        </div>
                      </div>

                      <EscMemberCardVisual
                        card={buildPrintCardData(selectedOrder)}
                        qrDataUrl={qrDataUrl}
                        side={cardSide}
                      />

                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={handleDownloadPrintPng}
                          disabled={exportingPng}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#2b3140] bg-[#161a24] px-3 py-2 font-mono text-[11px] font-semibold text-zinc-200 hover:border-[#39FF14] hover:text-white cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5 text-[#39FF14]" />
                          {exportingPng ? 'Exporting...' : 'Print PNG (Front+Back)'}
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadPrintPdf}
                          disabled={exportingPdf}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#2b3140] bg-[#161a24] px-3 py-2 font-mono text-[11px] font-semibold text-zinc-200 hover:border-[#39FF14] hover:text-white cursor-pointer"
                        >
                          <FileDown className="h-3.5 w-3.5 text-[#39FF14]" />
                          {exportingPdf ? 'Exporting...' : 'Print PDF (CR80 Sheet)'}
                        </button>
                      </div>
                    </div>

                    {/* Fulfillment & Status Update Form */}
                    <div className="rounded-2xl border border-[#222835] bg-[#12151d] p-4 space-y-3.5">
                      <span className="font-mono text-[10px] uppercase text-[#39FF14] flex items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5" /> Fulfillment &amp; Courier Tracking
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-zinc-200 mb-1">Payment Status</label>
                          <select
                            value={editPaymentStatus}
                            onChange={(e) => setEditPaymentStatus(e.target.value as CardOrderPaymentStatus)}
                            className="w-full rounded-xl border border-[#2b303c] bg-[#161a23] px-3 py-2 text-white focus:border-[#39FF14] focus:outline-none"
                          >
                            <option value="pending_verification">Pending Verification</option>
                            <option value="verified">Verified</option>
                            <option value="rejected">Rejected / Issue</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-zinc-200 mb-1">Order Status</label>
                          <select
                            value={editOrderStatus}
                            onChange={(e) => setEditOrderStatus(e.target.value as CardOrderStatus)}
                            className="w-full rounded-xl border border-[#2b303c] bg-[#161a23] px-3 py-2 text-white focus:border-[#39FF14] focus:outline-none"
                          >
                            {CARD_ORDER_STATUS_LIST.map((st) => (
                              <option key={st.value} value={st.value}>
                                {st.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-zinc-200 mb-1">Courier Company</label>
                          <input
                            type="text"
                            value={editCourier}
                            onChange={(e) => setEditCourier(e.target.value)}
                            placeholder="e.g. India Post Speed Post / Blue Dart / DTDC"
                            className="w-full rounded-xl border border-[#2b303c] bg-[#161a23] px-3 py-2 text-white placeholder:text-zinc-500 focus:border-[#39FF14] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-zinc-200 mb-1">Tracking Number</label>
                          <input
                            type="text"
                            value={editTracking}
                            onChange={(e) => setEditTracking(e.target.value)}
                            placeholder="Enter real AWB / tracking ID"
                            className="w-full rounded-xl border border-[#2b303c] bg-[#161a23] px-3 py-2 font-mono text-white placeholder:text-zinc-500 focus:border-[#39FF14] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-zinc-200 mb-1">Dispatch Date</label>
                          <input
                            type="date"
                            value={editDispatchDate}
                            onChange={(e) => setEditDispatchDate(e.target.value)}
                            className="w-full rounded-xl border border-[#2b303c] bg-[#161a23] px-3 py-2 text-white focus:border-[#39FF14] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-zinc-200 mb-1">Delivered Date</label>
                          <input
                            type="date"
                            value={editDeliveredDate}
                            onChange={(e) => setEditDeliveredDate(e.target.value)}
                            className="w-full rounded-xl border border-[#2b303c] bg-[#161a23] px-3 py-2 text-white focus:border-[#39FF14] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-zinc-200 mb-1">
                          Admin Notes (Shared in Member Status Update)
                        </label>
                        <textarea
                          rows={2}
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Optional note for member or verification details..."
                          className="w-full rounded-xl border border-[#2b303c] bg-[#161a23] px-3 py-2 text-white placeholder:text-zinc-500 focus:border-[#39FF14] focus:outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={savingUpdate}
                        onClick={() => handleSaveOrderUpdate()}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#39FF14] py-2.5 font-display text-xs font-black uppercase text-black hover:bg-[#32e010] disabled:opacity-50 cursor-pointer"
                      >
                        <Package className="h-4 w-4" />
                        {savingUpdate ? 'Saving & Notifying Member...' : 'Save Order Status & Notify Member'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Status History Timeline */}
                {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 && (
                  <div className="rounded-2xl border border-[#222835] bg-[#12151d] p-4 space-y-2">
                    <span className="font-mono text-[10px] uppercase text-zinc-400 block">
                      Order Audit Timeline
                    </span>
                    <div className="space-y-1.5">
                      {selectedOrder.statusHistory.map((h, idx) => (
                        <div
                          key={idx}
                          className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1e232e] pt-1.5 first:border-t-0 first:pt-0 text-[11px]"
                        >
                          <div className="text-zinc-300">
                            <strong className="text-[#39FF14]">
                              {getCardOrderStatusLabel(h.orderStatus)}
                            </strong>{' '}
                            · Payment: <strong className="text-white">{getPaymentStatusLabel(h.paymentStatus)}</strong>{' '}
                            <span className="text-zinc-400">by {h.changedBy}</span>
                            {h.note && <span className="text-zinc-400"> — {h.note}</span>}
                          </div>
                          <span className="font-mono text-[10px] text-zinc-500">
                            {new Date(h.timestamp).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Full-Size Payment Screenshot Lightbox */}
      {screenshotLightboxUrl &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Payment Screenshot Full Preview"
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
            onClick={() => setScreenshotLightboxUrl(null)}
          >
            <div
              className="relative max-w-4xl max-h-[90vh] rounded-2xl border border-[#39FF14]/45 bg-[#0c0e13] p-3"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setScreenshotLightboxUrl(null)}
                aria-label="Close screenshot preview"
                className="absolute -top-3 -right-3 rounded-full bg-[#39FF14] p-1.5 text-black shadow-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
              <img
                src={screenshotLightboxUrl}
                alt="Full size UPI payment screenshot"
                className="max-h-[84vh] max-w-full rounded-xl object-contain"
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
