
import React, { useState, useEffect } from 'react';
import {
  X, User, Calendar, MapPin, Smartphone, Mail, FileBadge,
  Bed, Users, Star, AlertCircle, CheckCircle2, CreditCard,
  Clock, ShieldAlert, Plus, Trash2, Edit3, MessageSquare, ChevronDown,
  Hash, LogIn, FileText, ScanLine, Lock, Eye, Shield, FileImage, RotateCcw,
  Utensils, Coffee, Zap, Receipt, Globe, Plane, Briefcase, Sparkles, Sofa,
  Minus, ArrowRightCircle, AlertTriangle, Printer, Check, History, IndianRupee
} from 'lucide-react';
import { Booking, RoomType, SyncEvent, FolioItem, GuestDetails, Payment, PropertySettings } from '../types';
import { fetchGuestHistory } from '../api';

interface GuestProfilePageProps {
  booking: Booking;
  roomTypes: RoomType[];
  relatedBookings?: Booking[];
  syncEvents?: SyncEvent[];
  onClose: () => void;
  onUpdateStatus: (bookingId: string, newStatus: string) => void;
  onToggleVIP?: (bookingId: string) => void;
  onToggleSettled?: (bookingId: string) => void;
  onCheckIn?: (booking: Booking, isAccessory?: boolean, accessoryIndex?: number) => void;
  onScanId?: (booking: Booking) => void;
  onEditInventory?: () => void;
  onUpdateExtraBeds?: (bookingId: string, count: number) => void;
  onRoomTransfer?: (bookingId: string, newRoomTypeId: string, newRoomNumber: string, effectiveDate: string, keepRate: boolean, transferFolio: boolean) => void;
  onSwitchBooking?: (booking: Booking) => void;
  onUpdateFolio?: (bookingId: string, updatedFolio: FolioItem[]) => void;
  onUpdateSpecialRequests?: (bookingId: string, requests: string) => void;
  onUpdatePayments?: (bookingId: string, payments: Payment[]) => void;
  propertySettings: PropertySettings | null;
}

const STATUS_OPTIONS = [
  { value: 'Confirmed', label: 'Confirmed', bg: 'bg-blue-500', text: 'text-white' },
  { value: 'Cancelled', label: 'Cancelled', bg: 'bg-red-500', text: 'text-white' },
  { value: 'CheckedIn', label: 'Checked In', bg: 'bg-emerald-500', text: 'text-white' },
  { value: 'CheckedOut', label: 'Checked Out', bg: 'bg-gray-400', text: 'text-white' },
  { value: 'Rejected', label: 'Warning/Unpaid', bg: 'bg-amber-500', text: 'text-white' }
];

const CURRENT_USER_PERMISSION = 2;
const MOCK_ID_IMAGE = "https://images.unsplash.com/photo-1548543604-a87c9909abec?q=80&w=2528&auto=format&fit=crop";

const GuestProfilePage: React.FC<GuestProfilePageProps> = ({
  booking,
  roomTypes,
  relatedBookings = [],
  syncEvents = [],
  onClose,
  onUpdateStatus,
  onToggleVIP,
  onToggleSettled,
  onCheckIn,
  onScanId,
  onEditInventory,
  onUpdateExtraBeds,
  onRoomTransfer,
  onSwitchBooking,
  onUpdateFolio,
  onUpdateSpecialRequests,
  onUpdatePayments,
  propertySettings
}) => {
  const [isIdRevealed, setIsIdRevealed] = useState(false);
  const [activeSide, setActiveSide] = useState<'front' | 'back' | 'visa' | 'additional'>('front');
  const [activeAdditionalIndex, setActiveAdditionalIndex] = useState<number>(0);
  const [isUpdatingBeds, setIsUpdatingBeds] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetRoomType, setTransferTargetRoomType] = useState<string>('');
  const [transferTargetRoom, setTransferTargetRoom] = useState<string>('');
  const [effectiveDate, setEffectiveDate] = useState<string>(booking.checkIn);
  const [keepRate, setKeepRate] = useState<boolean>(true);
  const [transferFolio, setTransferFolio] = useState<boolean>(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card'>('Cash');
  const [paymentCategory, setPaymentCategory] = useState<'Room' | 'Folio' | 'Extra' | 'Partial'>('Partial');
  const [showAddChargeModal, setShowAddChargeModal] = useState(false);
  const [chargeDescription, setChargeDescription] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeCategory, setChargeCategory] = useState<'F&B' | 'Laundry' | 'Other'>('Other');
  const [isChargeInclusive, setIsChargeInclusive] = useState(true);
  const [targetFolioItem, setTargetFolioItem] = useState<FolioItem | null>(null);

  const roomType = roomTypes.find(rt => rt.id === booking.roomTypeId);

  const getStatusStyles = (status: string) => {
    const opt = STATUS_OPTIONS.find(o => o.value === status) || STATUS_OPTIONS[0];
    return `${opt.bg} ${opt.text}`;
  };

  const handleRevealId = () => {
    if (CURRENT_USER_PERMISSION < 2) {
      alert("Access Denied: Permission Level 2 required to view unmasked PII.");
      return;
    }
    setIsIdRevealed(true);
  };

  const handleExtraBedsChange = (delta: number) => {
    const current = booking.extraBeds || 0;
    const next = Math.max(0, current + delta);

    // Visual feedback for activation
    setIsUpdatingBeds(true);
    onUpdateExtraBeds?.(booking.id, next);
    setTimeout(() => setIsUpdatingBeds(false), 200);
  };

  const unpaidFolioTotal = (booking.folio || []).filter(item => !item.isPaid).reduce((sum, item) => sum + item.amount, 0);
  const paidFolioTotal = (booking.folio || []).filter(item => item.isPaid).reduce((sum, item) => sum + item.amount, 0);

  // High-resiliency payment audit
  // 1. Map all payment IDs already tied to folio entries to avoid double counting
  const settledFolioPaymentIds = (booking.folio || []).filter(f => f.isPaid && f.paymentId).map(f => f.paymentId);

  // 2. Sum only "standalone" payments (those not specifically covering a folio item)
  const standalonePaymentsTotal = (booking.payments || [])
    .filter(p => p.status === 'Completed' && !settledFolioPaymentIds.includes(p.id))
    .reduce((sum, p) => sum + p.amount, 0);

  // 3. Final total reflects both standalone settlements and all paid folio items
  const totalPayments = standalonePaymentsTotal + paidFolioTotal;

  const nights = Math.max(1, Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 3600 * 24)));
  const roomRate = booking.source === 'Direct'
    ? (roomType?.basePrice || 0)
    : ((booking.amount || 0) / nights);

  const roomBaseTotal = booking.source === 'Direct'
    ? (roomRate * nights)
    : (booking.amount || 0);

  const totalBill = roomBaseTotal + (booking.folio || []).reduce((sum, item) => sum + item.amount, 0);
  const netOutstanding = totalBill - totalPayments;
  const grandTotal = roomBaseTotal + unpaidFolioTotal; // Keep for backward compatibility in UI where needed

  const [history, setHistory] = useState<Booking[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const details = booking.guestDetails;

  useEffect(() => {
    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const data = await fetchGuestHistory(booking.guestName, details?.phoneNumber, booking.id);
        setHistory(data);
      } catch (err) {
        console.error("Failed to load visit history:", err);
      } finally {
        setLoadingHistory(false);
      }
    };
    loadHistory();
  }, [booking.id, booking.guestName, details?.phoneNumber]);
  const isForeigner = (details?.nationality || 'Indian').toLowerCase() !== 'indian';

  const frontSrc = details?.idImage || MOCK_ID_IMAGE;
  const backSrc = details?.idImageBack;
  const visaSrc = details?.visaPage;

  const currentImageSrc = activeSide === 'front'
    ? frontSrc
    : activeSide === 'back'
      ? (backSrc || frontSrc)
      : activeSide === 'visa'
        ? (visaSrc || frontSrc)
        : (details?.additionalDocs?.[activeAdditionalIndex] || frontSrc);

  const handleAddCharge = () => {
    if (!chargeDescription || !chargeAmount) return;

    const newItem: FolioItem = {
      id: Math.random().toString(36).substring(2, 9),
      category: chargeCategory,
      description: chargeDescription,
      amount: parseFloat(chargeAmount),
      isInclusive: isChargeInclusive,
      timestamp: new Date().toISOString(),
      isPaid: false
    };

    const newFolio = [...(booking.folio || []), newItem];
    onUpdateFolio?.(booking.id, newFolio);

    // Reset and close
    setChargeDescription('');
    setChargeAmount('');
    setChargeCategory('Other');
    setIsChargeInclusive(true);
    setShowAddChargeModal(false);
  };

  const handleRecordPayment = () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    const newPayment: Payment = {
      id: Math.random().toString(36).substr(2, 9),
      amount,
      method: paymentMethod,
      timestamp: new Date().toISOString(),
      category: paymentCategory,
      description: targetFolioItem ? `Payment for ${targetFolioItem.description}` : 'Partial/General Payment',
      status: 'Completed'
    };

    const updatedPayments = [...(booking.payments || []), newPayment];
    onUpdatePayments?.(booking.id, updatedPayments);

    if (targetFolioItem) {
      const updatedFolio = (booking.folio || []).map(item =>
        item.id === targetFolioItem.id ? { ...item, isPaid: true, paymentMethod, paymentId: newPayment.id } : item
      );
      onUpdateFolio?.(booking.id, updatedFolio);
    }

    setShowPaymentModal(false);
    setPaymentAmount('');
    setTargetFolioItem(null);
  };

  const [isProcessingOnline, setIsProcessingOnline] = useState(false);

  const handleCollectOnline = async () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setIsProcessingOnline(true);

    try {
      // Step 1: Create Razorpay order via backend
      const response = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          bookingId: booking.id,
          description: `Payment for ${booking.guestName} - Room ${booking.roomNumber || 'TBD'}`
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create order');
      }

      const orderData = await response.json();

      // Step 2: Open Razorpay Checkout
      const options = {
        key: orderData.key_id,
        amount: orderData.amount * 100,
        currency: orderData.currency,
        name: propertySettings?.name || 'Hotel Payment',
        description: `Booking: ${booking.guestName}`,
        order_id: orderData.order_id,
        handler: async function (rzpResponse: any) {
          // Step 3: Verify payment on backend
          try {
            const verifyResponse = await fetch('/api/razorpay/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: rzpResponse.razorpay_order_id,
                razorpay_payment_id: rzpResponse.razorpay_payment_id,
                razorpay_signature: rzpResponse.razorpay_signature,
                bookingId: booking.id,
                amount
              })
            });

            if (verifyResponse.ok) {
              // Payment verified! Add to local state
              const newPayment: Payment = {
                id: rzpResponse.razorpay_payment_id,
                amount,
                method: 'Card',
                timestamp: new Date().toISOString(),
                category: 'Partial',
                description: 'Online Payment (Razorpay)',
                status: 'Completed'
              };
              const updatedPayments = [...(booking.payments || []), newPayment];
              onUpdatePayments?.(booking.id, updatedPayments);

              alert('Payment successful!');
              setShowPaymentModal(false);
              setPaymentAmount('');
            } else {
              alert('Payment verification failed. Please contact support.');
            }
          } catch (e) {
            console.error('Verification error:', e);
            alert('Payment completed but verification failed. Please check with support.');
          }
        },
        prefill: {
          name: booking.guestName,
          email: booking.guestDetails?.email || '',
          contact: booking.guestDetails?.phoneNumber || ''
        },
        theme: {
          color: '#4f46e5'
        },
        modal: {
          ondismiss: function () {
            setIsProcessingOnline(false);
          }
        }
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      console.error('Razorpay error:', error);
      alert(error.message || 'Failed to initiate payment. Please check Razorpay configuration.');
    } finally {
      setIsProcessingOnline(false);
    }
  };

  const handleUpdatePaymentStatus = (paymentId: string, newStatus: 'Refunded' | 'Cancelled') => {
    const updatedPayments = (booking.payments || []).map(p =>
      p.id === paymentId ? { ...p, status: newStatus } : p
    );
    onUpdatePayments?.(booking.id, updatedPayments);

    // If this payment was linked to a folio item, mark the item as unpaid again
    const linkedFolioItem = (booking.folio || []).find(item => item.paymentId === paymentId);
    if (linkedFolioItem) {
      const updatedFolio = (booking.folio || []).map(item =>
        item.id === linkedFolioItem.id ? { ...item, isPaid: false, paymentMethod: undefined, paymentId: undefined } : item
      );
      onUpdateFolio?.(booking.id, updatedFolio);
    }
  };

  const printReceipt = (item: FolioItem) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const receiptHtml = `
      <html>
        <head>
          <title>Receipt - ${item.description}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Inter', sans-serif; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body class="bg-white p-10 flex items-center justify-center min-h-screen">
          <div class="w-96 border-2 border-slate-900 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
            <div class="absolute top-0 right-0 p-4 opacity-5"><Receipt class="w-24 h-24" /></div>
            <div class="text-center mb-8">
              <h1 class="text-2xl font-black text-slate-900 tracking-tighter uppercase">${propertySettings?.name || 'Hotel Satsangi'}</h1>
              <p class="text-[10px] font-bold text-slate-500 uppercase leading-tight mt-1">
                ${propertySettings?.address || 'Near Main Chowk, Valley Road, Manali'}<br/>
                ${propertySettings?.phone ? 'Ph: ' + propertySettings.phone : ''} ${propertySettings?.email ? '• ' + propertySettings.email : ''}
              </p>
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-3">Official Payment Receipt</p>
            </div>
            
            <div class="space-y-4 mb-8">
              <div class="flex justify-between items-end border-b border-slate-100 pb-2">
                <p class="text-[9px] font-black text-slate-400 uppercase">Service</p>
                <p class="text-xs font-black text-slate-900 uppercase">${item.description}</p>
              </div>
              <div class="flex justify-between items-end border-b border-slate-100 pb-2">
                <p class="text-[9px] font-black text-slate-400 uppercase">Date</p>
                <p class="text-xs font-black text-slate-900">${new Date(item.timestamp).toLocaleDateString()}</p>
              </div>
              <div class="flex justify-between items-end border-b border-slate-100 pb-2">
                <p class="text-[9px] font-black text-slate-400 uppercase">Method</p>
                <p class="text-xs font-black text-indigo-600 uppercase">${item.paymentMethod || 'Settled'}</p>
              </div>
            </div>

            <div class="bg-slate-50 rounded-2xl p-6 text-center mb-8 border border-slate-100">
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Amount Paid</p>
                <p class="text-3xl font-black text-slate-900 tabular-nums">₹${item.amount.toLocaleString()}</p>
            </div>

            <div class="text-center">
              <div class="inline-block px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 mb-6">
                Status: Settled
              </div>
              <p class="text-[8px] font-bold text-slate-400 uppercase leading-relaxed">
                Thank you for choosing ${propertySettings?.name || 'Hotel Satsangi'}.<br/>This is a computer generated receipt.
              </p>
            </div>

            <div class="mt-8 text-center no-print">
              <button onclick="window.print()" class="px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Print Receipt</button>
            </div>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  };

  const printInvoice = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const roomGstRate = propertySettings?.gstRate || 12.0;
    const foodGstRate = propertySettings?.foodGstRate || 5.0;
    const otherGstRate = propertySettings?.otherGstRate || 18.0;

    // Room is always exclusive in this system (per standard reservation practice)
    const roomTax = roomBaseTotal * (roomGstRate / 100);

    let totalFolioTax = 0;
    let totalFolioBase = 0;

    const folioRows = (booking.folio || []).map(item => {
      const rate = item.category === 'F&B' ? foodGstRate : otherGstRate;
      let base, tax;

      if (item.isInclusive) {
        // Derive base from total (inclusive)
        base = item.amount / (1 + rate / 100);
        tax = item.amount - base;
      } else {
        // Add tax on top of base (exclusive)
        base = item.amount;
        tax = item.amount * (rate / 100);
      }

      totalFolioTax += tax;
      totalFolioBase += base;

      return {
        ...item,
        base,
        tax,
        rate,
        displayAmount: base + tax // Total for this item
      };
    });

    const netSubtotal = roomBaseTotal + totalFolioBase;
    const totalTax = roomTax + totalFolioTax;
    const finalNetInvoiceTotal = netSubtotal + totalTax;
    const cgst = totalTax / 2;
    const sgst = totalTax / 2;
    const balanceDue = finalNetInvoiceTotal - totalPayments;

    const invoiceHtml = `
      <html>
        <head>
          <title>Invoice - ${booking.guestName}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Inter', sans-serif; }
            @media print {
              .no-print { display: none; }
              body { padding: 0; margin: 0; }
            }
          </style>
        </head>
        <body class="bg-white p-10">
          <div class="max-w-4xl mx-auto border border-slate-200 p-12 rounded-3xl shadow-sm">
            <div class="flex justify-between items-start mb-16">
              <div>
                <h1 class="text-4xl font-black text-slate-900 tracking-tighter mb-2">${(propertySettings?.name || 'HOTEL SATSANGI').toUpperCase()}</h1>
                <p class="text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                  ${(propertySettings?.address || 'Near Main Chowk, Valley Road<br/>Manali, Himachal Pradesh - 175131').replace(/\n/g, '<br/>')}<br/>
                  ${propertySettings?.phone ? 'Ph: ' + propertySettings.phone : ''} ${propertySettings?.email ? '• ' + propertySettings.email : ''}<br/>
                  GSTIN: ${propertySettings?.gstNumber || '02AAACH2341M1Z1'}
                </p>
              </div>
              <div class="text-right">
                <h2 class="text-xl font-black text-indigo-600 uppercase tracking-[0.2em] mb-4">Invoice</h2>
                <div class="space-y-1">
                  <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Invoice No</p>
                  <p class="text-sm font-black text-slate-900 uppercase">#INV-${booking.id.split('-')[1]?.substring(0, 6) || '8721'}</p>
                </div>
                <div class="mt-4 space-y-1">
                  <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Date</p>
                  <p class="text-sm font-black text-slate-900">${new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-12 mb-16 border-y border-slate-100 py-10">
              <div>
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Guest Details</p>
                <h3 class="text-lg font-black text-slate-900 mb-1">${booking.guestName}</h3>
                <p class="text-xs font-bold text-slate-500 leading-relaxed">
                  ${details?.address || 'Address Not Provided'}<br/>
                  ${details?.city ? details.city + ', ' : ''}${details?.country || ''}<br/>
                  Ph: ${details?.phoneNumber || 'N/A'}
                </p>
              </div>
              <div class="text-right">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Stay Information</p>
                <div class="space-y-4">
                  <div class="flex justify-between text-xs font-bold">
                    <span class="text-slate-400 uppercase">Room No</span>
                    <span class="text-slate-900 font-black">#${booking.roomNumber || 'TBD'}</span>
                  </div>
                  <div class="flex justify-between text-xs font-bold">
                    <span class="text-slate-400 uppercase">Room Type</span>
                    <span class="text-slate-900 font-black">${roomType?.name || 'Standard'}</span>
                  </div>
                  <div class="flex justify-between text-xs font-bold">
                    <span class="text-slate-400 uppercase">Check-In</span>
                    <span class="text-slate-900 font-black">${new Date(booking.checkIn).toLocaleDateString()}</span>
                  </div>
                  <div class="flex justify-between text-xs font-bold">
                    <span class="text-slate-400 uppercase">Check-Out</span>
                    <span class="text-slate-900 font-black">${new Date(booking.checkOut).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <table class="w-full mb-16 px-4">
              <thead>
                <tr class="border-b-2 border-slate-900">
                  <th class="text-left py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Description</th>
                  <th class="text-center py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Qty</th>
                  <th class="text-right py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Rate</th>
                  <th class="text-right py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Amount</th>
                  <th class="text-right py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Paid</th>
                  <th class="text-right py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Balance</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr>
                  <td class="py-6">
                    <p class="text-sm font-black text-slate-900 uppercase">Room Rent</p>
                    <p class="text-[10px] font-bold text-slate-400 mt-0.5">Accommodation (${roomGstRate}% GST)</p>
                  </td>
                  <td class="py-6 text-center text-sm font-black text-slate-700 tabular-nums">${nights}</td>
                  <td class="py-6 text-right text-sm font-black text-slate-700 tabular-nums">₹${roomRate.toLocaleString()}</td>
                  <td class="py-6 text-right text-sm font-black text-slate-900 tabular-nums">₹${roomBaseTotal.toLocaleString()}</td>
                  <td class="py-6 text-right text-sm font-black text-emerald-600 tabular-nums">₹0.00</td>
                  <td class="py-6 text-right text-sm font-black text-slate-900 tabular-nums">₹${roomBaseTotal.toLocaleString()}</td>
                </tr>
                ${folioRows.map(item => `
                  <tr>
                    <td class="py-6">
                      <p class="text-sm font-black text-slate-900 uppercase">${item.description}</p>
                      <p class="text-[10px] font-bold text-slate-400 mt-0.5">${item.category} Service (${item.rate}% GST)</p>
                    </td>
                    <td class="py-6 text-center text-sm font-black text-slate-700 tabular-nums">1</td>
                    <td class="py-6 text-right text-sm font-black text-slate-700 tabular-nums">₹${item.base.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td class="py-6 text-right text-sm font-black text-slate-900 tabular-nums">₹${item.base.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td class="py-6 text-right text-sm font-black text-emerald-600 tabular-nums">₹${item.isPaid ? item.displayAmount.toLocaleString() : '0.00'}</td>
                    <td class="py-6 text-right text-sm font-black text-dark-900 tabular-nums">₹${item.isPaid ? '0.00' : item.displayAmount.toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            ${(booking.payments && booking.payments.length > 0) ? `
            <div class="mb-16">
              <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Payment History</h4>
              <table class="w-full border border-slate-100 rounded-2xl overflow-hidden">
                <thead class="bg-slate-50">
                  <tr>
                    <th class="text-left p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                    <th class="text-left p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Method</th>
                    <th class="text-left p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                    <th class="text-right p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${booking.payments.map(p => `
                    <tr>
                      <td class="p-4 text-xs font-bold text-slate-600">${new Date(p.timestamp).toLocaleDateString()}</td>
                      <td class="p-4 text-xs font-black text-indigo-600 uppercase">${p.method}</td>
                      <td class="p-4 text-xs font-medium text-slate-500">${p.description || 'General Payment'}</td>
                      <td class="p-4 text-right text-xs font-black text-slate-900">₹${p.amount.toLocaleString()}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            ` : ''}

            <div class="flex justify-end">
              <div class="w-80 space-y-4">
                <div class="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-400">
                  <span>Subtotal (Net)</span>
                  <span class="text-slate-900 font-black tabular-nums">₹${netSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div class="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-400">
                  <span>CGST</span>
                  <span class="text-slate-900 font-black tabular-nums">₹${cgst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div class="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-400">
                  <span>SGST</span>
                  <span class="text-slate-900 font-black tabular-nums">₹${sgst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div class="flex justify-between items-center py-4 border-y border-slate-200 mt-4">
                  <span class="text-xs font-black uppercase tracking-[0.2em] text-slate-900">Total Invoice Amount</span>
                  <span class="text-xl font-black text-slate-900 tabular-nums">₹${finalNetInvoiceTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div class="flex justify-between text-xs font-bold uppercase tracking-widest text-emerald-600">
                  <span>Total Payments</span>
                  <span class="font-black tabular-nums">- ₹${totalPayments.toLocaleString()}</span>
                </div>
                <div class="flex justify-between items-center py-6 border-t-2 border-slate-900 mt-2">
                  <span class="text-xs font-black uppercase tracking-[0.2em] text-slate-900">Balance Due</span>
                  <span class="text-3xl font-black text-indigo-600 tabular-nums">₹${balanceDue.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div class="mt-24 pt-12 border-t border-slate-100">
              <div class="grid grid-cols-2 gap-12">
                <div>
                  <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 font-black">Terms & Conditions</p>
                  <p class="text-[9px] font-bold text-slate-400 leading-relaxed uppercase">
                    1. Charges once billed are non-refundable.<br/>
                    2. Payment is due at the time of check-out.<br/>
                    3. Guest is responsible for any damage to hotel property.
                  </p>
                </div>
                <div class="text-right flex flex-col items-end">
                  <div class="w-32 h-16 border-b border-slate-900 mb-2"></div>
                  <p class="text-[9px] font-black text-slate-900 uppercase tracking-widest">Authorized Signature</p>
                </div>
              </div>
            </div>
            
            <div class="mt-12 text-center no-print">
              <button onclick="window.print()" class="px-8 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all">
                Print Invoice
              </button>
            </div>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(invoiceHtml);
    printWindow.document.close();
  };

  const printRegCard = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const details = booking.guestDetails;
    const data = {
      name: booking.guestName || '________________',
      id: booking.id,
      roomNumber: booking.roomNumber || 'Unassigned',
      nationality: details?.nationality || '________________',
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      phone: details?.phoneNumber || '________________',
      email: details?.email || '________________',
      address: details?.address || '________________________________________________',
      idType: details?.idType || '________________',
      idNumber: details?.idNumber ? `XXXX-XXXX-${details.idNumber.slice(-4)}` : '________________',
      purpose: details?.purposeOfVisit || '________________',
      from: details?.arrivedFrom || '________________'
    };

    const html = `
      <html>
        <head>
          <title>Guest Registration Card - ${data.name}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; line-height: 1.4; }
            .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            .hotel-name { font-size: 26px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #0f172a; margin-bottom: 4px; }
            .hotel-address { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 15px; }
            .title { font-size: 12px; color: #6366f1; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; border: 1px solid #e2e8f0; display: inline-block; padding: 4px 12px; rounded: 4px; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
            .field { border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
            .label { font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
            .value { font-size: 13px; font-weight: 700; color: #1e293b; margin-top: 2px; }
            .full-width { grid-column: span 2; }
            .section-title { font-size: 11px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin: 40px 0 15px 0; border-left: 4px solid #6366f1; padding-left: 10px; letter-spacing: 1px; }
            .signature-box { margin-top: 80px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 60px; }
            .sig-line { border-top: 1.5px solid #0f172a; padding-top: 10px; text-align: center; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #0f172a; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="hotel-name">${propertySettings?.name || 'Hotel Management System'}</div>
            <div class="hotel-address">${propertySettings?.address || 'Property Address Not Registered'}</div>
            <div class="title">Guest Registration Card (GRC)</div>
          </div>

          <div class="grid">
            <div class="field">
              <div class="label">Guest Name</div>
              <div class="value">${data.name}</div>
            </div>
            <div class="field">
              <div class="label">Booking Reference / ID</div>
              <div class="value">${data.id}</div>
            </div>
            <div class="field">
              <div class="label">Room Number</div>
              <div class="value">#${data.roomNumber}</div>
            </div>
            <div class="field">
              <div class="label">Nationality</div>
              <div class="value">${data.nationality}</div>
            </div>
            <div class="field">
              <div class="label">Date of Arrival</div>
              <div class="value">${data.checkIn}</div>
            </div>
            <div class="field">
              <div class="label">Exp. Date of Departure</div>
              <div class="value">${data.checkOut}</div>
            </div>
            <div class="field">
              <div class="label">Mobile Number</div>
              <div class="value">${data.phone}</div>
            </div>
            <div class="field">
              <div class="label">Email Address</div>
              <div class="value">${data.email}</div>
            </div>
            <div class="field full-width">
              <div class="label">Permanent Residential Address</div>
              <div class="value">${data.address}</div>
            </div>
          </div>

          <div class="section-title">Compliance & Verification</div>
          <div class="grid">
            <div class="field">
              <div class="label">Identity Document</div>
              <div class="value">${data.idType}</div>
            </div>
            <div class="field">
              <div class="label">ID Number (Masked)</div>
              <div class="value">${data.idNumber}</div>
            </div>
            <div class="field">
              <div class="label">Purpose of Visit</div>
              <div class="value">${data.purpose}</div>
            </div>
            <div class="field">
              <div class="label">Arrived From</div>
              <div class="value">${data.from}</div>
            </div>
          </div>

          <div class="signature-box" style="margin-top: 120px;">
            <div class="sig-line">Guest Signature</div>
            <div class="sig-line">Receptionist / Duty Manager</div>
          </div>

          <div style="margin-top: 50px; font-size: 8px; color: #94a3b8; text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
            Computer Generated Registration Card • No Signature Required for Record Purposes
          </div>

          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };


  return (
    <div className="fixed inset-0 z-[10000] bg-slate-50 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-slate-500" />
          </button>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Guest Profile & Booking Manager</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest tabular-nums">
              ID: #{booking.id.split('-')[1]?.slice(0, 8)} • {booking.source} Channel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <button className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all ${getStatusStyles(booking.status)}`}>
              {booking.status === 'Rejected' ? 'Warning/Unpaid' : booking.status === 'CheckedIn' ? 'In-House' : booking.status}
              <ChevronDown className="w-4 h-4" />
            </button>
            <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[101] p-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onUpdateStatus(booking.id, opt.value)}
                  className="w-full text-left p-3 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors"
                >
                  <div className={`w-3 h-3 rounded-full ${opt.bg}`}></div>
                  <span className="text-xs font-bold text-slate-700">{opt.label === 'Rejected' ? 'Warning/Unpaid' : opt.label}</span>
                </button>
              ))}
            </div>
          </div>



          <button
            onClick={printRegCard}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Reg Card
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 pb-24">

          <div className="lg:col-span-2 space-y-8">
            <section className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 shadow-inner relative overflow-hidden">
                    <User className="w-10 h-10" />
                    {booking.isVIP && (
                      <div className="absolute top-0 right-0 bg-violet-500 p-1 rounded-bl-lg">
                        <Star className="w-3 h-3 text-white fill-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-2xl font-black text-slate-900">{booking.guestName}</h3>
                        {booking.roomNumber && (
                          <span className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">
                            Room {booking.roomNumber}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Primary Resident
                        </span>
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100 uppercase tracking-widest">
                          {details?.nationality || 'Indian'}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons next to guest name */}
                    <div className="flex items-center gap-2 ml-4">

                      {onCheckIn && (
                        <button
                          onClick={() => onCheckIn(booking, false)}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md flex items-center gap-2"
                        >
                          <Edit3 className="w-4 h-4" />
                          Check In
                        </button>
                      )}
                      <button
                        onClick={() => onToggleVIP?.(booking.id)}
                        className={`p-2.5 rounded-xl transition-all shadow-sm border ${booking.isVIP
                          ? 'bg-violet-100 border-violet-200 text-violet-600'
                          : 'bg-slate-50 border-slate-100 text-slate-300 hover:text-violet-400 hover:border-violet-100'
                          }`}
                      >
                        <Star className={`w-5 h-5 ${booking.isVIP ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="flex items-center gap-4 group">
                    <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors"><Smartphone className="w-5 h-5" /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mobile Number</p>
                      <p className="text-sm font-bold text-slate-700 tabular-nums">{details?.phoneNumber || 'Not Provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 group">
                    <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors"><Mail className="w-5 h-5" /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</p>
                      <p className="text-sm font-bold text-slate-700 truncate max-w-[200px]">{details?.email || 'Not Provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 group">
                    <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors"><Users className="w-5 h-5" /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Father's/Husband's Name</p>
                      <p className="text-sm font-bold text-slate-700">{details?.fatherOrHusbandName || 'Not Provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 group">
                    <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors"><Calendar className="w-5 h-5" /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date of Birth</p>
                      <p className="text-sm font-bold text-slate-700 tabular-nums">{details?.dob || 'Not Disclosed'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 group">
                    <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors"><User className="w-5 h-5" /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gender</p>
                      <p className="text-sm font-bold text-slate-700">{details?.gender || 'Not Disclosed'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-4 group">
                    <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors"><FileBadge className="w-5 h-5" /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{details?.idType || 'Identification'}</p>
                      <p className="text-sm font-bold text-slate-700 tabular-nums">{details?.idNumber || 'Awaiting Verification'}</p>
                    </div>
                  </div>

                  <div className="relative w-full h-64 bg-slate-900 rounded-2xl overflow-hidden shadow-md group/id">
                    <img
                      src={currentImageSrc}
                      alt="Scanned ID"
                      className={`w-full h-full object-cover transition-all duration-700 ${isIdRevealed ? 'blur-0 opacity-100' : 'blur-xl opacity-60'}`}
                    />

                    {!isIdRevealed ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 backdrop-blur-sm z-10 space-y-3">
                        <Lock className="w-8 h-8 text-slate-300" />
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">PII Masked</p>
                        <button onClick={handleRevealId} className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-[10px] font-black text-white uppercase tracking-widest">View ID</button>
                      </div>
                    ) : (
                      <div className="absolute top-3 left-3 right-3 flex flex-wrap gap-2 z-20">
                        <button onClick={() => setActiveSide('front')} className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase transition-all shadow-sm ${activeSide === 'front' ? 'bg-white text-indigo-600' : 'bg-black/40 text-white/70 hover:bg-black/60'}`}>Front</button>
                        <button onClick={() => setActiveSide('back')} className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase transition-all shadow-sm ${activeSide === 'back' ? 'bg-white text-indigo-600' : 'bg-black/40 text-white/70 hover:bg-black/60'}`}>Back</button>
                        {isForeigner && <button onClick={() => setActiveSide('visa')} className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase transition-all shadow-sm ${activeSide === 'visa' ? 'bg-white text-indigo-600' : 'bg-black/40 text-white/70 hover:bg-black/60'}`}>Visa</button>}
                        {details?.additionalDocs?.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => { setActiveSide('additional'); setActiveAdditionalIndex(idx); }}
                            className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase transition-all shadow-sm ${activeSide === 'additional' && activeAdditionalIndex === idx ? 'bg-indigo-600 text-white' : 'bg-black/40 text-white/70 hover:bg-black/60'}`}
                          >
                            Page {idx + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Consolidated Stay Details & Address */}
              <div className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Purpose of Visit</p>
                    <p className="text-sm font-bold text-slate-700">{details?.purposeOfVisit || 'Not Declared'}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Arrived From</p>
                    <p className="text-sm font-bold text-slate-700">{details?.arrivedFrom || 'Not Recorded'}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Arrival Time</p>
                    <p className="text-sm font-bold text-slate-700 tabular-nums">
                      {booking.checkIn} {details?.arrivalTime ? `@ ${details.arrivalTime}` : ''}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Next Destination</p>
                    <p className="text-sm font-bold text-slate-700">{details?.destination || details?.nextDestination || 'Not Declared'}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Departure Date</p>
                    <p className="text-sm font-bold text-slate-700 tabular-nums">
                      {booking.status === 'CheckedOut' ? booking.checkOut : 'In-House'}
                      {details?.departureTime ? ` @ ${details.departureTime}` : ''}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Digital Signature</p>
                    {details?.signature ? (
                      <img src={details.signature} alt="Signature" className="h-8 object-contain" />
                    ) : (
                      <p className="text-sm font-bold text-slate-400 italic">Not Captured</p>
                    )}
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 md:col-span-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Permanent Residential Address</p>
                    <p className="text-sm font-bold text-slate-700">
                      {details?.address || 'N/A'}
                      {details?.city && `, ${details.city}`}
                      {details?.state && `, ${details.state}`}
                      {details?.pinCode && ` - ${details.pinCode}`}
                      {details?.country && `, ${details.country}`}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* CO-GUESTS (ACCESSORY GUESTS) */}
            <section className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                  <Users className="w-5 h-5 text-indigo-500" />
                  Accessory Guests
                </h3>
                <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {(booking.accessoryGuests?.length || 0)} Co-residents
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {booking.accessoryGuests && booking.accessoryGuests.map((guest, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-indigo-100 transition-all group flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors shadow-sm">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{guest.name}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{guest.idType}: {guest.idNumber || 'PENDING'}</p>
                      </div>
                    </div>
                    <button onClick={() => onCheckIn?.(booking, true, idx)} className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-white rounded-lg transition-all opacity-0 group-hover:opacity-100"><Edit3 className="w-4 h-4" /></button>
                  </div>
                ))}
                <button onClick={() => onCheckIn?.(booking, true)} className="p-4 border-2 border-dashed border-slate-100 rounded-2xl flex items-center justify-center gap-2 text-slate-400 hover:border-indigo-200 hover:text-indigo-500 transition-all">
                  <Plus className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Add Co-Guest</span>
                </button>
              </div>
            </section>

            {/* VISIT HISTORY SECTION */}
            <section className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Visit History</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Repeat Customer Journey</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {history.length} Previous {history.length === 1 ? 'Stay' : 'Stays'}
                  </span>
                </div>
              </div>

              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading history...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="bg-slate-50 rounded-3xl border border-dashed border-slate-200 p-12 text-center">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-4 shadow-sm">
                    <RotateCcw className="w-8 h-8" />
                  </div>
                  <h4 className="text-slate-900 font-black text-sm uppercase tracking-widest mb-1">First Time Guest</h4>
                  <p className="text-xs text-slate-400 font-medium">This is the guest's first recorded stay at Hotel Satsangi.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Lifetime Value Dashboard */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-slate-50 border border-slate-100 rounded-[2rem]">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lifetime Revenue</p>
                      <p className="text-2xl font-black text-slate-800 tabular-nums">
                        ₹{history.reduce((sum, h) => {
                          // Only count completed payments
                          const paidAmount = (h.payments || []).filter(p => p.status === 'Completed').reduce((s, p) => s + p.amount, 0);
                          return sum + paidAmount;
                        }, 0).toLocaleString()}
                      </p>
                      <div className="flex items-center gap-1 text-[8px] font-black text-emerald-600 uppercase tracking-tighter">
                        <CheckCircle2 className="w-2.5 h-2.5" /> All-Time Paid
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Stays</p>
                      <p className="text-2xl font-black text-indigo-600 tabular-nums">{history.length}</p>
                      <div className="flex items-center gap-1 text-[8px] font-black text-indigo-400 uppercase tracking-tighter">
                        <User className="w-2.5 h-2.5" /> Loyalty Count
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Nights</p>
                      <p className="text-2xl font-black text-slate-800 tabular-nums">
                        {history.reduce((sum, h) => sum + Math.ceil((new Date(h.checkOut).getTime() - new Date(h.checkIn).getTime()) / (1000 * 3600 * 24)), 0)}
                      </p>
                      <div className="flex items-center gap-1 text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                        <Bed className="w-2.5 h-2.5" /> Inventory Units
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Guest Category</p>
                      <div className="flex items-center gap-2 pt-1">
                        {history.length >= 3 ? (
                          <span className="px-2 py-1 bg-amber-500 text-white text-[8px] font-black rounded-lg shadow-sm shadow-amber-200">GOLD ELITE</span>
                        ) : (
                          <span className="px-2 py-1 bg-slate-200 text-slate-600 text-[8px] font-black rounded-lg">REGULAR</span>
                        )}
                      </div>
                      <p className="text-[8px] font-bold text-slate-400 uppercase mt-2">Personalized Member</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {history.map((past, idx) => {
                      const checkIn = new Date(past.checkIn);
                      const checkOut = new Date(past.checkOut);
                      const hNights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
                      // Calculate paid amount from completed payments only
                      const hPaidTotal = (past.payments || []).filter(p => p.status === 'Completed').reduce((s, p) => s + p.amount, 0);
                      // Calculate extras paid (folio items that are marked as paid)
                      const hExtrasPaid = (past.folio || []).filter(f => f.isPaid).reduce((s, f) => s + f.amount, 0);

                      return (
                        <div key={idx} className="group relative bg-white border border-slate-100 rounded-3xl p-6 hover:border-indigo-200 hover:shadow-xl transition-all">
                          <div className="flex flex-wrap items-start justify-between gap-6">
                            <div className="flex items-start gap-5">
                              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex flex-col items-center justify-center group-hover:bg-indigo-50 transition-colors shrink-0">
                                <p className="text-[10px] font-black text-slate-400 group-hover:text-indigo-600 uppercase pt-1">
                                  {checkIn.toLocaleDateString(undefined, { month: 'short' })}
                                </p>
                                <p className="text-xl font-black text-slate-800 group-hover:text-indigo-700 leading-none pb-1">
                                  {checkIn.getDate()}
                                </p>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                  <p className="text-base font-black text-slate-800 tracking-tight">
                                    {checkIn.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                                  </p>
                                  <ArrowRightCircle className="w-4 h-4 text-slate-300" />
                                  <p className="text-sm font-bold text-slate-400">
                                    {checkOut.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                                  </p>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <Bed className="w-3.5 h-3.5 text-indigo-400" /> Room {past.roomNumber || 'N/A'}
                                  </span>
                                  <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100/50">
                                    {hNights} {hNights === 1 ? 'Night' : 'Nights'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-8">
                              <div className="text-right">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Stay Total</p>
                                <p className="text-sm font-black text-slate-900 tabular-nums">₹{hPaidTotal.toLocaleString()}</p>
                                <p className="text-[8px] font-bold text-slate-400 uppercase">(Paid + ₹{hExtrasPaid.toLocaleString()} Extras)</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Booking Channel</p>
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter shadow-sm border ${past.source === 'Direct' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                                  }`}>
                                  {past.source}
                                </span>
                              </div>
                            </div>
                          </div>

                          {past.specialRequests && (
                            <div className="mt-5 pt-5 border-t border-slate-50 flex gap-3 italic">
                              <div className="p-1.5 bg-violet-50 rounded-lg text-violet-500 h-fit"><MessageSquare className="w-3.5 h-3.5" /></div>
                              <div>
                                <p className="text-[9px] font-black text-violet-400 uppercase tracking-[0.2em] mb-1">Previous Requests</p>
                                <p className="text-xs font-bold text-slate-500 line-clamp-2 leading-relaxed">&ldquo;{past.specialRequests}&rdquo;</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>


            {/* MERGED FOLIO & TRANSACTION LEDGER */}
            <section className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group mb-8">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Receipt className="w-32 h-32" />
              </div>

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                      <CreditCard className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black tracking-tight uppercase text-indigo-100 italic">Folio Status & Ledger</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Audit Protocol Layer active</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={printInvoice} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all flex items-center gap-2">
                      <Printer className="w-4 h-4" /> Invoice
                    </button>
                    <button onClick={() => setShowAddChargeModal(true)} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-indigo-900/40">
                      <Plus className="w-4 h-4" /> Add Charge
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                  {/* LEFT: Financial Summary */}
                  <div className="lg:col-span-4 space-y-8">
                    <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 shadow-inner relative overflow-hidden group/card">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/card:scale-110 transition-transform"><CheckCircle2 className="w-12 h-12 text-emerald-400" /></div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Net Outstanding</p>
                      <div className="flex items-baseline gap-4 mt-2">
                        <p className={`text-5xl font-black tabular-nums tracking-tighter ${netOutstanding <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ₹{netOutstanding.toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 mt-6">
                        {netOutstanding > 0 && (
                          <button
                            onClick={() => { setTargetFolioItem(null); setPaymentAmount(netOutstanding.toFixed(2)); setPaymentCategory('Partial'); setShowPaymentModal(true); }}
                            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-xl shadow-indigo-900/40 transition-all active:scale-95"
                          >
                            Pay Full Balance
                          </button>
                        )}
                        <button
                          onClick={() => { setTargetFolioItem(null); setPaymentAmount(''); setPaymentCategory('Partial'); setShowPaymentModal(true); }}
                          className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/10 transition-all"
                        >
                          Partial Pay
                        </button>
                      </div>

                      <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center text-center">
                        <div>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Total Payments</p>
                          <p className="text-sm font-black text-emerald-400 tabular-nums mt-1">₹{totalPayments.toLocaleString()}</p>
                        </div>
                        <div className="w-px h-8 bg-white/5"></div>
                        <div>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Total Bill</p>
                          <p className="text-sm font-black text-slate-200 tabular-nums mt-1">₹{totalBill.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    <div className="px-2 space-y-5">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white/5 rounded-lg border border-white/10"><Calendar className="w-4 h-4 text-indigo-400" /></div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stay Period</span>
                        </div>
                        <span className="text-xs font-bold text-slate-200 tabular-nums">{nights}n • {new Date(booking.checkIn).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white/5 rounded-lg border border-white/10"><Bed className="w-4 h-4 text-indigo-400" /></div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Room Rate</span>
                        </div>
                        <span className="text-xs font-bold text-slate-200 tabular-nums">₹{roomRate.toLocaleString()} / N</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white/5 rounded-lg border border-white/10"><Hash className="w-4 h-4 text-indigo-400" /></div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Base Total</span>
                        </div>
                        <span className="text-xs font-bold text-slate-200 tabular-nums">₹{roomBaseTotal.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Transaction Stream (Last 3) */}
                    {(booking.payments || []).length > 0 && (
                      <div className="pt-4 px-2 space-y-4">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] italic">Audit Stream</p>
                        <div className="space-y-2">
                          {(booking.payments || []).slice().reverse().slice(0, 3).map(p => (
                            <div key={p.id} className="flex items-center justify-between group/tx">
                              <div className="flex items-center gap-3">
                                <div className={`w-1.5 h-1.5 rounded-full ${p.status === 'Completed' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                <span className={`text-[10px] font-bold ${p.status === 'Completed' ? 'text-slate-200' : 'text-slate-500 line-through'}`}>₹{p.amount.toLocaleString()} via {p.method}</span>
                              </div>
                              <span className="text-[8px] font-black text-slate-500 uppercase">{new Date(p.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* RIGHT: Detailed Ledger */}
                  <div className="lg:col-span-8 space-y-6">
                    <div className="flex items-center justify-between mb-4 px-2">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Folio Entries ({booking.folio?.length || 0})</span>
                      </div>
                      <div className="flex gap-2">
                        {Array.from(new Set(booking.folio?.map(f => f.category) || [])).map(cat => (
                          <div key={cat} className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[8px] font-black uppercase text-slate-400">
                            <span className={`w-1 h-1 rounded-full ${cat === 'F&B' ? 'bg-orange-400' : 'bg-indigo-400'}`}></span>
                            {cat}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-3 custom-scrollbar-dark pb-4">
                      {booking.folio && booking.folio.length > 0 ? (
                        booking.folio.map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/[0.08] transition-all group/item shadow-sm">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner ${item.category === 'F&B' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'}`}>
                                {item.category === 'F&B' ? <Coffee className="w-5 h-5" /> : item.category === 'Room' ? <Bed className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-100 uppercase tracking-tight">{item.description}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest tabular-nums">{new Date(item.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                  <span className="w-1 h-1 bg-white/10 rounded-full"></span>
                                  <span className="text-[9px] font-black text-indigo-400/80 uppercase">{item.category}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="text-right">
                                <p className="text-base font-black text-white tabular-nums tracking-tighter">₹{item.amount.toLocaleString()}</p>
                                <button
                                  className={`text-[8px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 transition-all px-2 py-1 rounded-md mt-1.5 ${item.isPaid ? 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/30' : 'text-rose-400 bg-rose-400/10 border border-rose-400/30 animate-pulse'}`}
                                  onClick={() => {
                                    if (item.isPaid) {
                                      const newFolio = (booking.folio || []).map(f => f.id === item.id ? { ...f, isPaid: false, paymentMethod: undefined, paymentId: undefined } : f);
                                      onUpdateFolio?.(booking.id, newFolio);
                                    } else {
                                      setTargetFolioItem(item);
                                      setPaymentAmount(item.amount.toString());
                                      setPaymentCategory('Folio');
                                      setShowPaymentModal(true);
                                    }
                                  }}
                                >
                                  {item.isPaid ? (
                                    <div className="flex items-center gap-2">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>{item.paymentMethod || 'Settled'}</span>
                                      <Printer className="w-3 h-3 opacity-50 hover:opacity-100 transition-opacity ml-1" onClick={(e) => { e.stopPropagation(); printReceipt(item); }} />
                                    </div>
                                  ) : 'Mark as Paid'}
                                </button>
                              </div>
                              <button onClick={() => {
                                const isExtraBed = (item.category === 'Other' || item.category === 'Room') &&
                                  item.description?.toUpperCase().includes('EXTRA BED');

                                if (isExtraBed) {
                                  // Using the dedicated handler ensures both count and folio are updated atomically
                                  onUpdateExtraBeds?.(booking.id, 0);
                                } else {
                                  const newFolio = (booking.folio || []).filter(f => f.id !== item.id);
                                  onUpdateFolio?.(booking.id, newFolio);
                                }
                              }} className="p-2 text-white/10 hover:text-rose-400 hover:bg-white/5 rounded-xl transition-all opacity-0 group-hover/item:opacity-100">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-16 text-center border-2 border-dashed border-white/5 rounded-[2rem] bg-white/[0.02]">
                          <Receipt className="w-10 h-10 text-white/5 mx-auto mb-4" />
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">No Folio Entries Found</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* LINKED ROOMS (Multi-Room Booking) */}
            {relatedBookings.length > 1 && (
              <section className="bg-white rounded-[2.5rem] border-2 border-indigo-200 p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <Bed className="w-5 h-5 text-indigo-500" />
                    Linked Rooms
                  </h3>
                  <span className="px-3 py-1 bg-indigo-100 rounded-full text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                    {relatedBookings.length} Rooms in Reservation
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {relatedBookings.map((rb) => {
                    const rbRoomType = roomTypes.find(rt => rt.id === rb.roomTypeId);
                    const isCurrentRoom = rb.id === booking.id;
                    return (
                      <div
                        key={rb.id}
                        className={`p-4 rounded-2xl transition-all group flex items-center justify-between cursor-pointer ${isCurrentRoom
                          ? 'bg-indigo-50 border-2 border-indigo-300 ring-2 ring-indigo-100'
                          : 'bg-slate-50 border border-slate-100 hover:border-indigo-200'
                          }`}
                        onClick={() => !isCurrentRoom && onSwitchBooking?.(rb)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${isCurrentRoom ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 group-hover:text-indigo-500'
                            }`}>
                            <Bed className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">
                              #{rb.roomNumber || 'TBD'}
                              {isCurrentRoom && <span className="ml-2 text-[9px] text-indigo-600 uppercase">(Current)</span>}
                            </p>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              {rbRoomType?.name || 'Unknown'} • {rb.status}
                            </p>
                          </div>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${rb.status === 'CheckedIn' ? 'bg-emerald-500' :
                          rb.status === 'Confirmed' ? 'bg-blue-500' :
                            rb.status === 'CheckedOut' ? 'bg-slate-400' : 'bg-amber-500'
                          }`}></div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 pt-6 border-t border-slate-100 flex gap-3">
                  <button
                    onClick={() => setShowTransferModal(true)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowRightCircle className="w-4 h-4" /> Transfer Room
                  </button>
                </div>
              </section>
            )}

            {/* INTERNATIONAL REGISTRATION DATA (FORM C) */}
            {isForeigner && (
              <section className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3 mb-8">
                  <Globe className="w-5 h-5 text-amber-500" />
                  International Compliance (Form C)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                  <div className="space-y-8">
                    <div className="flex gap-4">
                      <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl shadow-sm border border-amber-100 h-fit"><FileBadge className="w-5 h-5" /></div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Passport Details</p>
                        <p className="text-sm font-bold text-slate-700">{details?.passportNumber || 'N/A'}</p>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Expiry</p>
                            <p className="text-[10px] font-bold text-slate-600">{details?.passportExpiry || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Issue Date</p>
                            <p className="text-[10px] font-bold text-slate-600">{details?.passportIssueDate || 'N/A'}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[8px] font-black text-slate-400 uppercase">Place of Issue</p>
                            <p className="text-[10px] font-bold text-slate-600">{details?.passportPlaceIssue || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shadow-sm border border-blue-100 h-fit"><Shield className="w-5 h-5" /></div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Visa Details ({details?.visaType || 'N/A'})</p>
                        <p className="text-sm font-bold text-slate-700">{details?.visaNumber || 'N/A'}</p>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Expiry</p>
                            <p className="text-[10px] font-bold text-slate-600">{details?.visaExpiry || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Issue Date</p>
                            <p className="text-[10px] font-bold text-slate-600">{details?.visaIssueDate || 'N/A'}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[8px] font-black text-slate-400 uppercase">Place of Issue</p>
                            <p className="text-[10px] font-bold text-slate-600">{details?.visaPlaceIssue || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-8">
                    <div className="flex gap-4">
                      <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shadow-sm border border-emerald-100 h-fit"><Plane className="w-5 h-5" /></div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Arrival Data</p>
                        <p className="text-sm font-bold text-slate-700">From {details?.arrivedFrom || 'N/A'}</p>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Date In India</p>
                            <p className="text-[10px] font-bold text-slate-600">{details?.arrivalDateIndia || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Arrival Port</p>
                            <p className="text-[10px] font-bold text-slate-600">{details?.arrivalPort || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="p-2.5 bg-slate-50 text-slate-600 rounded-xl shadow-sm border border-slate-100 h-fit"><Briefcase className="w-5 h-5" /></div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stay Objectives</p>
                        <p className="text-sm font-bold text-slate-700">{details?.purposeOfVisit || 'Tourism'}</p>
                        <div className="grid grid-cols-1 gap-2 mt-2">
                          <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Next Destination</p>
                            <p className="text-[10px] font-bold text-slate-600">{details?.nextDestination || 'Not Declared'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl shadow-sm border border-rose-100 h-fit"><User className="w-5 h-5" /></div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact in India</p>
                        <p className="text-sm font-bold text-slate-700">{details?.contactInIndiaName || 'Not Provided'}</p>
                        <div className="grid grid-cols-1 gap-2 mt-2">
                          <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Phone</p>
                            <p className="text-[10px] font-bold text-slate-600 tabular-nums">{details?.contactInIndiaPhone || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Address</p>
                            <p className="text-[10px] font-bold text-slate-600">{details?.contactInIndiaAddress || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {details?.isFormCSubmitted ? (
                      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Form C Submitted</span>
                        {details?.formCSubmissionDate && (
                          <span className="text-[9px] font-bold text-emerald-600 tabular-nums">{details.formCSubmissionDate}</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Pending Submission</span>
                      </div>
                    )}
                  </div>
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                    Submit Form C
                  </button>
                </div>
              </section>
            )}


          </div>

          <div className="space-y-8">


            {/* SPECIAL REQUESTS */}
            <section className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-violet-500" />
                  Guest Requests
                </h3>
                <div className="flex items-center gap-2 px-3 py-1 bg-violet-50 border border-violet-100 rounded-full">
                  <Zap className="w-3 h-3 text-violet-500" />
                  <span className="text-[9px] font-black text-violet-600 uppercase tracking-widest italic tracking-tighter">Syncing with OTA Data</span>
                </div>
              </div>
              <div className="relative group/req">
                <textarea
                  value={booking.specialRequests || ''}
                  onChange={(e) => onUpdateSpecialRequests?.(booking.id, e.target.value)}
                  placeholder="No special requirements shared. Type here to add notes..."
                  className="w-full min-h-[120px] p-5 bg-violet-50/50 border border-violet-100 rounded-2xl text-sm font-bold text-slate-700 leading-relaxed italic outline-none focus:border-violet-300 focus:bg-white transition-all resize-none placeholder:text-slate-400"
                />
                <div className="absolute top-2 right-2 p-2 opacity-10 group-hover/req:opacity-20 transition-opacity pointer-events-none">
                  <Sparkles className="w-8 h-8 text-violet-600" />
                </div>
              </div>
            </section>

            {/* EXTRA BED MANAGEMENT */}
            <section className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                  <Sofa className="w-5 h-5 text-indigo-500" />
                  Extra Bedding
                </h3>
                <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">
                  ₹{roomType?.extraBedCharge || 0} / bed
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                    <Bed className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stay Units</p>
                    <p className={`text-sm font-bold text-slate-800 transition-all duration-200 ${isUpdatingBeds ? 'scale-110 text-indigo-600' : 'scale-100'}`}>
                      {booking.extraBeds || 0} Beds Added
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-white rounded-xl p-1 shadow-sm border border-slate-200">
                  <button
                    onClick={() => handleExtraBedsChange(-1)}
                    className="p-2 text-slate-400 hover:text-red-500 transition-all active:scale-75"
                    aria-label="Decrease extra beds"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center text-sm font-black text-slate-700 tabular-nums">{booking.extraBeds || 0}</span>
                  <button
                    onClick={() => handleExtraBedsChange(1)}
                    className="p-2 text-slate-400 hover:text-emerald-500 transition-all active:scale-75"
                    aria-label="Increase extra beds"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Room Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-[10001] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Transfer Room</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Move guest or switch room mid-stay</p>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">From Current Room</p>
                  <p className="text-lg font-bold text-slate-900">#{booking.roomNumber} - {roomType?.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Stay Duration</p>
                  <p className="text-sm font-bold text-slate-700 uppercase">{booking.checkIn} → {booking.checkOut}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Transfer Type</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setEffectiveDate(booking.checkIn)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${effectiveDate === booking.checkIn ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
                    >
                      Full Move
                    </button>
                    <button
                      onClick={() => setEffectiveDate(new Date().toISOString().split('T')[0])}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${effectiveDate !== booking.checkIn ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
                    >
                      Switch Mid-stay
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Effective Date</label>
                  <input
                    type="date"
                    min={booking.checkIn}
                    max={booking.checkOut}
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full px-4 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">New Room Type</label>
                <select
                  value={transferTargetRoomType}
                  onChange={(e) => {
                    setTransferTargetRoomType(e.target.value);
                    setTransferTargetRoom('');
                  }}
                  className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-indigo-500"
                >
                  <option value="">Select room type...</option>
                  {roomTypes.map(rt => (
                    <option key={rt.id} value={rt.id}>{rt.name} - ₹{rt.basePrice}/night</option>
                  ))}
                </select>
              </div>

              {transferTargetRoomType && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Select Room</label>
                  <div className="grid grid-cols-5 gap-2">
                    {(() => {
                      const targetType = roomTypes.find(rt => rt.id === transferTargetRoomType);
                      const rooms = targetType?.roomNumbers || [];
                      return rooms.map(roomNum => {
                        const isOccupied = syncEvents.some(e =>
                          e.type === 'booking' &&
                          e.roomNumber === roomNum &&
                          e.id !== booking.id &&
                          e.status !== 'Cancelled' &&
                          e.status !== 'CheckedOut' &&
                          !(new Date(booking.checkOut) <= new Date(e.checkIn) || new Date(effectiveDate) >= new Date(e.checkOut))
                        );
                        const isSelected = transferTargetRoom === roomNum;
                        return (
                          <button
                            key={roomNum}
                            onClick={() => !isOccupied && setTransferTargetRoom(roomNum)}
                            disabled={isOccupied}
                            className={`p-3 rounded-xl text-sm font-bold transition-all ${isOccupied
                              ? 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200'
                              : isSelected
                                ? 'bg-indigo-600 text-white shadow-lg border border-indigo-700'
                                : 'bg-slate-50 text-slate-700 hover:bg-indigo-50 border border-slate-200'
                              }`}
                          >
                            {roomNum}
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={keepRate}
                    onChange={(e) => setKeepRate(e.target.checked)}
                    className="w-5 h-5 rounded-lg border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-600">Keep Current Rate</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase">Don't update invoice price</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={transferFolio}
                    onChange={(e) => setTransferFolio(e.target.checked)}
                    className="w-5 h-5 rounded-lg border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-600">Move Entire Folio</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase">Transfer all service bills</p>
                  </div>
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setShowTransferModal(false)}
                className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-widest text-[10px]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (transferTargetRoomType && transferTargetRoom && onRoomTransfer) {
                    onRoomTransfer(booking.id, transferTargetRoomType, transferTargetRoom, effectiveDate, keepRate, transferFolio);
                    setShowTransferModal(false);
                  }
                }}
                disabled={!transferTargetRoomType || !transferTargetRoom}
                className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {effectiveDate === booking.checkIn ? <ArrowRightCircle className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                {effectiveDate === booking.checkIn ? 'Move Room' : 'Switch Room Mid-Stay'}
              </button>
            </div>
          </div>
        </div>
      )
      }
      {/* Add Charge (Service) Modal */}
      {showAddChargeModal && (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
            <div className="p-8 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-600" />
                  Add Service Bill
                </h3>
                <button onClick={() => setShowAddChargeModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Add an unpaid charge to guest folio
              </p>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Edit3 className="w-3 h-3" /> Description
                </label>
                <input
                  type="text"
                  value={chargeDescription}
                  onChange={(e) => setChargeDescription(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:border-indigo-600 focus:ring-0 transition-all outline-none"
                  placeholder="e.g. In-Room Dining, Laundry, Extra Bed..."
                  autoFocus
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Receipt className="w-3 h-3" /> Amount (INR)
                </label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl font-black text-slate-300">₹</span>
                  <input
                    type="number"
                    value={chargeAmount}
                    onChange={(e) => setChargeAmount(e.target.value)}
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-2xl font-black text-slate-900 focus:border-indigo-600 focus:ring-0 transition-all outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Users className="w-3 h-3" /> Category
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['F&B', 'Laundry', 'Other'] as const).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setChargeCategory(cat)}
                      className={`py-4 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${chargeCategory === cat ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200'}`}
                    >
                      {cat === 'F&B' ? <Coffee className="w-4 h-4" /> : cat === 'Laundry' ? <Sparkles className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                      <span className="text-[9px] font-black uppercase">{cat}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-4 p-5 bg-indigo-50 border-2 border-indigo-100 rounded-[2rem] cursor-pointer group hover:border-indigo-300 transition-all shadow-sm">
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isChargeInclusive ? 'bg-indigo-600 border-indigo-600 shadow-md' : 'bg-white border-indigo-200 group-hover:border-indigo-400'}`}>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={isChargeInclusive}
                      onChange={(e) => setIsChargeInclusive(e.target.checked)}
                    />
                    {isChargeInclusive && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-indigo-900 group-hover:text-indigo-600 uppercase tracking-tight">Amount Includes GST</p>
                    <p className="text-[9px] font-bold text-indigo-400 uppercase leading-none mt-1">Check if tax is baked into this price</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="p-8 border-t border-slate-50 bg-slate-50 flex gap-4">
              <button
                onClick={() => setShowAddChargeModal(false)}
                className="flex-1 py-4 text-xs font-black text-slate-400 uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCharge}
                disabled={!chargeDescription || !chargeAmount}
                className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add to Folio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Processing Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
            <div className="p-8 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                  Record Payment
                </h3>
                <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                {targetFolioItem ? `Settling: ${targetFolioItem.description}` : 'Adding Partial Payment to Bill'}
              </p>
            </div>

            <div className="p-8 space-y-8">
              {/* Amount Input */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Receipt className="w-3 h-3" /> Amount (INR)
                </label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">₹</span>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full pl-12 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl text-3xl font-black text-slate-900 focus:border-indigo-600 focus:ring-0 transition-all outline-none"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>

              {/* Method Selection */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Shield className="w-3 h-3" /> Select Mode
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['Cash', 'UPI', 'Card'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setPaymentMethod(m)}
                      className={`py-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === m ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-200' : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200'}`}
                    >
                      {m === 'Cash' ? <Briefcase className="w-5 h-5" /> : m === 'UPI' ? <Smartphone className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                      <span className="text-[10px] font-black uppercase tracking-widest">{m}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-slate-50 bg-slate-50 space-y-4">
              {/* Online Payment Button */}
              <button
                onClick={handleCollectOnline}
                disabled={isProcessingOnline || !paymentAmount}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessingOnline ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4" />
                    Collect Online (Razorpay)
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-slate-200"></div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Or Record Offline</span>
                <div className="flex-1 h-px bg-slate-200"></div>
              </div>

              {/* Offline Payment Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-4 text-xs font-black text-slate-400 uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRecordPayment}
                  className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
                >
                  Record {paymentMethod} Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

export default GuestProfilePage;
