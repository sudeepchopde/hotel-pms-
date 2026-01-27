
import React, { useState, useEffect, useRef } from 'react';
import {
  X, User, Calendar, MapPin, Smartphone, Mail, FileBadge, XCircle,
  Bed, Users, Star, AlertCircle, CheckCircle2, CreditCard,
  Clock, ShieldAlert, Plus, Trash2, Edit3, MessageSquare, ChevronDown,
  Hash, LogIn, LogOut, FileText, ScanLine, Lock, Eye, Shield, FileImage, RotateCcw,
  Utensils, Coffee, Zap, Receipt, Globe, Plane, Briefcase, Sparkles, Sofa,
  Minus, ArrowRightCircle, AlertTriangle, Printer, Check, History, IndianRupee,
  Camera, Upload, Loader2, Keyboard, Save
} from 'lucide-react';
import { Booking, RoomType, SyncEvent, FolioItem, GuestDetails, Payment, PropertySettings } from '../types';
import { fetchGuestHistory, updateBooking, lookupGuest } from '../api';
import { NATIONALITIES } from '../constants';

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
  onUpdateBooking?: (booking: Booking) => void;
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
const MOCK_ID_IMAGE = null;

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
  onUpdateBooking,
  propertySettings
}) => {

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

  // New State for Integrated Check-in & Editing
  const [editableDetails, setEditableDetails] = useState<GuestDetails>(() => {
    const defaultDetails: GuestDetails = {
      name: booking.guestName,
      phoneNumber: '',
      email: '',
      idType: 'Aadhar',
      idNumber: '',
      address: '',
      dob: '',
      nationality: 'Indian',
      gender: 'Male',
      visaType: 'Tourist',
      purposeOfVisit: 'Tourism',
      arrivalPort: 'Delhi (DEL)'
    };
    if (booking.guestDetails) {
      return { ...defaultDetails, ...booking.guestDetails };
    }
    return defaultDetails;
  });

  const [idImages, setIdImages] = useState<{ front: string | null; back: string | null; visa: string | null; additional: string[]; formPages: string[] }>({
    front: booking.guestDetails?.idImage || null,
    back: booking.guestDetails?.idImageBack || null,
    visa: booking.guestDetails?.visaPage || null,
    additional: booking.guestDetails?.additionalDocs || [],
    formPages: booking.guestDetails?.formPages || []
  });

  const [ocrStep, setOcrStep] = useState<'idle' | 'scan_front' | 'scan_back' | 'scan_visa' | 'scan_additional' | 'scan_form' | 'processing' | 'success'>('idle');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isIdRevealed, setIsIdRevealed] = useState(booking.status !== 'CheckedIn' && booking.status !== 'CheckedOut');
  const [isIdMasked, setIsIdMasked] = useState(booking.status === 'CheckedIn' || booking.status === 'CheckedOut');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isAddingAccessory, setIsAddingAccessory] = useState(false);
  const [editingAccessoryIndex, setEditingAccessoryIndex] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteSide, setPendingDeleteSide] = useState<{ side: typeof activeSide; addIdx: number } | null>(null);

  // Repeat Guest Lookup State
  const [lookupResults, setLookupResults] = useState<any[]>([]);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [showLookupDropdown, setShowLookupDropdown] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isCameraActiveRef = useRef<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Stop camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Synchronize image state when side changes
  useEffect(() => {
    if (idImages.front && activeSide === 'front') setIsIdRevealed(true);
  }, [activeSide]);

  // Clear toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const details = editableDetails;

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
  const [checkoutDocs, setCheckoutDocs] = useState<{ invoice?: string; receipt?: string } | null>(
    (booking.invoicePath || booking.receiptPath) ? { invoice: booking.invoicePath, receipt: booking.receiptPath } : null
  );

  // OCR & Camera Logic
  const startCamera = async (step: typeof ocrStep) => {
    try {
      setOcrStep(step);
      setIsCameraActive(true);
      isCameraActiveRef.current = true;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access failed", err);
      setToastMessage("Could not access camera. Please upload manually.");
      setIsCameraActive(false);
      isCameraActiveRef.current = false;
      streamRef.current = null;
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    isCameraActiveRef.current = false;
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      const imgData = canvas.toDataURL('image/jpeg', 0.82);

      if (ocrStep === 'scan_front') {
        // First ID page - store as front, stay in camera for more pages
        if (!idImages.front) {
          setIdImages(prev => ({ ...prev, front: imgData }));
          setToastMessage("Page 1 captured! Add more pages or tap Finish.");
        } else if (!idImages.back) {
          setIdImages(prev => ({ ...prev, back: imgData }));
          setToastMessage("Page 2 captured! Add more pages or tap Finish.");
        } else {
          // Additional ID pages go to additional array
          setIdImages(prev => ({ ...prev, additional: [...prev.additional, imgData] }));
          setToastMessage(`Page ${3 + idImages.additional.length} captured! Add more or Finish.`);
        }
      } else if (ocrStep === 'scan_back') {
        setIdImages(prev => ({ ...prev, back: imgData }));
        setToastMessage("Back captured! Add more pages or tap Finish.");
      } else if (ocrStep === 'scan_visa') {
        setIdImages(prev => ({ ...prev, visa: imgData }));
        stopCamera();
        setOcrStep('success');
      } else if (ocrStep === 'scan_form') {
        setIdImages(prev => ({ ...prev, formPages: [...prev.formPages, imgData] }));
        // For form, we stay in camera mode to allow more pages
        setToastMessage(`Page ${idImages.formPages.length + 1} captured! Add more or Finish.`);
      } else if (ocrStep === 'scan_additional') {
        setIdImages(prev => ({ ...prev, additional: [...prev.additional, imgData] }));
        setToastMessage(`Additional page captured! Add more or Finish.`);
      }
    }
  };

  const finishScanning = async () => {
    stopCamera();
    if (ocrStep === 'scan_front' || ocrStep === 'scan_back') {
      setOcrStep('processing');
      try {
        if (idImages.front) {
          await analyzeIdImage(idImages.front.split(',')[1], 'id_front');
        }
        if (idImages.back) {
          await analyzeIdImage(idImages.back.split(',')[1], 'id_back');
        }
      } catch (e) {
        console.error("Scanning flow error", e);
      } finally {
        setOcrStep('success');
      }
    } else if (ocrStep === 'scan_form') {
      if (idImages.formPages.length > 0) {
        setOcrStep('processing');
        await analyzeFilledForm();
      } else {
        setOcrStep('success');
      }
    } else {
      setOcrStep('success');
    }
  };

  const analyzeIdImage = async (base64Img: string, type: 'id_front' | 'id_back' = 'id_front') => {
    try {
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Img, type })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Server Error: ${response.status}`);
      }

      const result = await response.json();
      const text = result.text;

      if (text) {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : text.replace(/```json\n?|\n?```/g, '').trim();

        try {
          const data = JSON.parse(jsonStr);
          setEditableDetails(prev => ({
            ...prev,
            name: data.name || data.Name || prev.name,
            idNumber: data.idNumber || data.ID_Number || prev.idNumber,
            address: data.address || data.Address || prev.address,
            dob: data.dob || data.DOB || prev.dob,
            gender: data.gender || data.Gender || prev.gender,
            nationality: data.nationality || data.Nationality || prev.nationality
          }));
          setToastMessage(`Processed ${type === 'id_front' ? 'Front' : 'Back'} of ID`);
          setIsIdRevealed(true);
        } catch (e) {
          console.error("JSON Parse Error", e);
          setToastMessage(`OCR Error: Could not parse ${type === 'id_front' ? 'Front' : 'Back'} ID data.`);
        }
      }
    } catch (err: any) {
      console.error("OCR failed", err);
      const errorMessage = err.message || "Unknown error";
      setToastMessage(`OCR Failed: ${errorMessage.substring(0, 40)}...`);
    }
  };

  const analyzeFilledForm = async () => {
    const base64Img = idImages.formPages[0];
    if (!base64Img) return;

    try {
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Img, type: 'form' })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Server Error: ${response.status}`);
      }

      const result = await response.json();
      const text = result.text;

      if (text) {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : text.replace(/```json\n?|\n?```/g, '').trim();

        try {
          const data = JSON.parse(jsonStr);
          setEditableDetails(prev => ({ ...prev, ...data }));
          setOcrStep('success');
          setToastMessage("Form analyzed successfully!");
        } catch (e) {
          console.error("JSON Parse Error", e);
          setToastMessage("OCR Error: Could not parse Form data.");
          setOcrStep('success');
        }
      }
    } catch (err: any) {
      console.error("Form OCR failed", err);
      setOcrStep('success');
      setToastMessage(`Form Analysis Failed: ${err.message}`);
    }
  };

  const handleInputChange = async (field: keyof GuestDetails, value: any) => {
    setEditableDetails(prev => ({ ...prev, [field]: value }));

    if (field === 'phoneNumber' && value && value.length >= 4) {
      setIsLookupLoading(true);
      try {
        const results = await lookupGuest(undefined, value);
        if (results && results.length > 0) {
          setLookupResults(results);
          setShowLookupDropdown(true);
        } else {
          setShowLookupDropdown(false);
        }
      } catch (err) {
        console.error("Lookup failed", err);
      } finally {
        setIsLookupLoading(false);
      }
    } else if (field === 'phoneNumber') {
      setShowLookupDropdown(false);
    }
  };

  const selectGuestFromLookup = (guest: any) => {
    setEditableDetails(prev => ({
      ...prev,
      profileId: guest.profileId || guest.id,
      name: guest.name || prev.name,
      phoneNumber: guest.phone_number || prev.phone_number,
      email: guest.email || prev.email,
      idType: guest.idType || prev.idType,
      idNumber: guest.idNumber || prev.idNumber,
      address: guest.address || prev.address,
      dob: guest.dob || prev.dob,
      nationality: guest.nationality || prev.nationality,
      gender: guest.gender || prev.gender,
      fatherOrHusbandName: guest.fatherOrHusbandName || prev.fatherOrHusbandName,
      city: guest.city || prev.city,
      state: guest.state || prev.state,
      pinCode: guest.pinCode || prev.pinCode,
      country: guest.country || prev.country
    }));

    setIdImages({
      front: guest.idImage || null,
      back: guest.idImageBack || null,
      visa: guest.visaPage || null,
      additional: guest.additionalDocs || [],
      formPages: guest.formPages || []
    });

    setShowLookupDropdown(false);
    setToastMessage(`Welcome back, ${guest.name}! Details auto-filled.`);
    if (guest.idImage) setIsIdRevealed(true);
  };

  const validateDetails = () => {
    const errors: string[] = [];

    // Mandatory for everyone
    if (!editableDetails.name) errors.push("Full Name");

    if (isAddingAccessory) {
      // Co-Guest / Accessory Rules: Only Name & DOB
      if (!editableDetails.dob) errors.push("Date of Birth");
    } else {
      // Primary Guest Rules: Strict
      if (!editableDetails.phoneNumber) errors.push("Mobile Number");
      if (!editableDetails.idType) errors.push("ID Type");
      if (!editableDetails.idNumber) errors.push("ID Number");
      if (!editableDetails.address) errors.push("Address");
      if (!idImages.front) errors.push("ID Front Scan");

      if (editableDetails.nationality !== 'Indian') {
        if (!editableDetails.passportNumber) errors.push("Passport Number");
        if (!idImages.visa) errors.push("Visa Page Scan");
      }
    }

    setValidationErrors(errors);

    // Auto-scroll to first error
    if (errors.length > 0) {
      setTimeout(() => {
        const firstErrorEl = document.querySelector('.ring-rose-200, .ring-rose-400');
        if (firstErrorEl) {
          firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }

    return errors.length === 0;
  };

  const resetToPrimaryGuest = () => {
    setIsAddingAccessory(false);
    setEditingAccessoryIndex(null);
    setEditableDetails(booking.guestDetails || {
      name: booking.guestName,
      phoneNumber: '',
      email: '',
      idType: 'Aadhar',
      idNumber: '',
      address: '',
      dob: '',
      nationality: 'Indian',
      gender: 'Male',
      visaType: 'Tourist',
      purposeOfVisit: 'Tourism',
      arrivalPort: 'Delhi (DEL)'
    });
    setIdImages({
      front: booking.guestDetails?.idImage || null,
      back: booking.guestDetails?.idImageBack || null,
      visa: booking.guestDetails?.visaPage || null,
      additional: booking.guestDetails?.additionalDocs || [],
      formPages: booking.guestDetails?.formPages || []
    });
    setValidationErrors([]);
  };

  const handleEditAccessory = (idx: number) => {
    const guest = booking.accessoryGuests?.[idx];
    if (!guest) return;
    setIsAddingAccessory(true);
    setEditingAccessoryIndex(idx);
    setEditableDetails(guest);
    setIdImages({
      front: guest.idImage || null,
      back: guest.idImageBack || null,
      visa: guest.visaPage || null,
      additional: guest.additionalDocs || [],
      formPages: guest.formPages || []
    });
    setValidationErrors([]);
    // Scroll to top or form section
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startAddingAccessory = () => {
    setIsAddingAccessory(true);
    setEditingAccessoryIndex(null);
    const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    setEditableDetails({
      name: '',
      phoneNumber: '',
      email: '',
      idType: 'Aadhar',
      idNumber: '',
      address: '',
      dob: '',
      nationality: 'Indian',
      gender: 'Male',
      visaType: 'Tourist',
      purposeOfVisit: 'Tourism',
      arrivalPort: 'Delhi (DEL)',
      arrivalTime: currentTime
    });
    setIdImages({ front: null, back: null, visa: null, additional: [], formPages: [] });
    setValidationErrors([]);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCheckInNow = async () => {
    if (!validateDetails()) {
      setToastMessage("Please complete all required fields and scans.");
      return;
    }

    let updated: Booking;

    if (isAddingAccessory) {
      const currentAccessories = [...(booking.accessoryGuests || [])];
      const guestWithDocs: GuestDetails = {
        ...editableDetails,
        idImage: idImages.front || undefined,
        idImageBack: idImages.back || undefined,
        visaPage: idImages.visa || undefined,
        additionalDocs: idImages.additional.length > 0 ? idImages.additional : undefined,
        formPages: idImages.formPages.length > 0 ? idImages.formPages : undefined,
      };

      if (editingAccessoryIndex !== null) {
        currentAccessories[editingAccessoryIndex] = guestWithDocs;
      } else {
        currentAccessories.push(guestWithDocs);
      }

      updated = {
        ...booking,
        accessoryGuests: currentAccessories,
        timestamp: Date.now()
      };
    } else {
      const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
      updated = {
        ...booking,
        status: booking.status === 'Confirmed' ? 'CheckedIn' : booking.status,
        guestName: editableDetails.name,
        guestDetails: {
          ...editableDetails,
          idImage: idImages.front || undefined,
          idImageBack: idImages.back || undefined,
          visaPage: idImages.visa || undefined,
          additionalDocs: idImages.additional.length > 0 ? idImages.additional : undefined,
          formPages: idImages.formPages.length > 0 ? idImages.formPages : undefined,
          arrivalTime: currentTime
        },
        timestamp: Date.now()
      };
    }

    try {
      if (onUpdateBooking) {
        onUpdateBooking(updated);
      } else {
        await updateBooking(updated);
        if (!isAddingAccessory && (booking.status === 'Confirmed' || booking.status === 'CheckedIn')) {
          onUpdateStatus(booking.id, 'CheckedIn');
        }
      }

      if (!isAddingAccessory && booking.status === 'Confirmed') {
        alert("Check-in successful! Guest is now In-House.");
      } else {
        setToastMessage(isAddingAccessory ? "Guest saved successfully!" : "Update successful!");
      }

      if (isAddingAccessory) {
        resetToPrimaryGuest();
      }
    } catch (err: any) {
      setToastMessage(`Error: ${err.message}`);
    }
  };

  const triggerFileUpload = () => fileInputRef.current?.click();
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const imgData = ev.target?.result as string;
        if (ocrStep === 'scan_front' || ocrStep === 'idle') {
          setIdImages(prev => ({ ...prev, front: imgData }));
          setOcrStep('processing');
          analyzeIdImage(imgData.split(',')[1]);
        } else if (ocrStep === 'scan_form') {
          setIdImages(prev => ({ ...prev, formPages: [...prev.formPages, imgData] }));
          setOcrStep('processing');
          analyzeFilledForm();
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleDeleteScan = () => {
    console.log("Delete scan triggered", { activeSide, activeAdditionalIndex });
    // Store which scan to delete and show confirmation modal
    setPendingDeleteSide({ side: activeSide, addIdx: activeAdditionalIndex });
    setShowDeleteConfirm(true);
  };

  const confirmDeleteScan = () => {
    if (!pendingDeleteSide) return;
    const { side, addIdx } = pendingDeleteSide;

    setIdImages(prev => {
      const updated = { ...prev };
      if (side === 'front') updated.front = null;
      else if (side === 'back') updated.back = null;
      else if (side === 'visa') updated.visa = null;
      else if (side === 'additional') {
        if (addIdx >= 100) {
          const idx = addIdx - 100;
          updated.formPages = updated.formPages.filter((_, i) => i !== idx);
        } else {
          updated.additional = updated.additional.filter((_, i) => i !== addIdx);
        }
        setActiveSide('front');
        setActiveAdditionalIndex(0);
      }
      return updated;
    });
    setToastMessage("Scan deleted. Remember to Save/Check-in to persist changes.");
    setShowDeleteConfirm(false);
    setPendingDeleteSide(null);
  };

  const isForeigner = (editableDetails.nationality || 'Indian').toLowerCase() !== 'indian';

  useEffect(() => {
    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const data = await fetchGuestHistory(booking.guestName, editableDetails?.phoneNumber, booking.id);
        setHistory(data);
      } catch (err) {
        console.error("Failed to load visit history:", err);
      } finally {
        setLoadingHistory(false);
      }
    };
    loadHistory();
  }, [booking.id, booking.guestName, editableDetails?.phoneNumber]);

  const frontSrc = idImages.front;
  const backSrc = idImages.back;
  const visaSrc = idImages.visa;

  const currentImageSrc = activeSide === 'front'
    ? frontSrc
    : activeSide === 'back'
      ? (backSrc || frontSrc)
      : activeSide === 'visa'
        ? (visaSrc || frontSrc)
        : (idImages.additional?.[activeAdditionalIndex] || frontSrc);

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
          <title>Payment Receipt - ${item.description}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Plus Jakarta Sans', sans-serif; -webkit-print-color-adjust: exact; }
            @media print { .no-print { display: none; } }
            .premium-gradient { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); }
          </style>
        </head>
        <body class="bg-white p-6 md:p-12 flex items-center justify-center min-h-screen">
          <div class="w-full max-w-sm border-2 border-slate-900 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden bg-white">
            <div class="absolute -top-12 -right-12 w-32 h-32 premium-gradient opacity-10 rounded-full blur-3xl"></div>
            
            <div class="text-center mb-10">
              <div class="inline-block px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[8px] font-black uppercase tracking-widest mb-4 border border-indigo-100">Official Receipt</div>
              <h1 class="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-tight">${propertySettings?.name || 'Hotel Satsangi'}</h1>
              <p class="text-[9px] font-bold text-slate-400 uppercase leading-relaxed mt-2">
                ${propertySettings?.address || 'Property Address Not Registered'}<br/>
                ${propertySettings?.phone ? 'Ph: ' + propertySettings.phone : ''} ${propertySettings?.email ? '• ' + propertySettings.email : ''}
              </p>
            </div>
            
            <div class="space-y-5 mb-10">
              <div class="flex justify-between items-baseline border-b border-slate-100 pb-3">
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Description</p>
                <p class="text-sm font-bold text-slate-800 uppercase">${item.description}</p>
              </div>
              <div class="flex justify-between items-baseline border-b border-slate-100 pb-3">
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</p>
                <p class="text-sm font-black text-slate-800 tabular-nums">${new Date(item.timestamp).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              </div>
              <div class="flex justify-between items-baseline border-b border-slate-100 pb-3">
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mode</p>
                <p class="text-sm font-black text-indigo-600 uppercase italic">${item.paymentMethod || 'Settled'}</p>
              </div>
            </div>

            <div class="bg-slate-950 rounded-3xl p-8 text-center mb-10 shadow-inner">
                <p class="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-2">Total Amount Paid</p>
                <div class="flex items-center justify-center gap-1">
                  <span class="text-lg font-black text-white opacity-50">₹</span>
                  <p class="text-3xl font-black text-white tabular-nums">${item.amount.toLocaleString()}</p>
                </div>
            </div>

            <div class="text-center space-y-6">
              <div class="flex items-center justify-center gap-2">
                <div class="px-3 py-1 bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200">
                  Trans. Verified
                </div>
              </div>
              <p class="text-[8px] font-bold text-slate-400 uppercase leading-relaxed max-w-[200px] mx-auto">
                Thank you for choosing ${propertySettings?.name || 'Hotel Satsangi'}.<br/>Generated via secure PMS Audit Protocol.
              </p>
            </div>

            <div class="mt-10 text-center no-print">
              <button onclick="window.print()" class="w-full py-4 premium-gradient text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 hover:scale-[1.02] active:scale-95 transition-all">
                Print Document
              </button>
            </div>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  };

  const handleCheckout = async () => {
    if (netOutstanding > 0) {
      setToastMessage(`Cannot check out. Outstanding balance: ₹${netOutstanding.toLocaleString()}. Please settle all payments first.`);
      return;
    }

    if (!confirm('Are you sure you want to finalize this booking and check out? This will generate a Tax Invoice and Receipt.')) return;

    try {
      const response = await fetch(`/api/bookings/${booking.id}/checkout`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Checkout failed');
      const data = await response.json();

      setCheckoutDocs({ invoice: data.invoicePath, receipt: data.receiptPath });

      // Locally update balance to zero to reflect immediate change
      if (booking.folio) {
        const settledFolio = booking.folio.map(f => ({ ...f, isPaid: true, paymentMethod: 'Settled' }));
        onUpdateFolio?.(booking.id, settledFolio);
      }

      // Update local status via parent
      onUpdateStatus?.(booking.id, 'CheckedOut');

      setToastMessage(`Checkout Successful! Invoice ${data.invoiceNumber || ''} generated.`);
    } catch (err: any) {
      console.error(err);
      setToastMessage(`Checkout failed: ${err.message || 'Please try again.'}`);
    }
  };

  const handleCancelBooking = async () => {
    if (!confirm('Are you sure you want to cancel this booking? This will release the room inventory.')) return;
    try {
      onUpdateStatus?.(booking.id, 'Cancelled');
      setToastMessage('Booking cancelled successfully.');
    } catch (err: any) {
      console.error(err);
      setToastMessage(`Cancellation failed: ${err.message || 'Please try again.'}`);
    }
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

    const invoiceHtml = `
      <html>
        <head>
          <title>Tax Invoice - ${booking.guestName}</title>
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
                  ${(propertySettings?.address || '').replace(/\n/g, '<br/>')}<br/>
                  ${propertySettings?.phone ? 'Ph: ' + propertySettings.phone : ''} ${propertySettings?.email ? '• ' + propertySettings.email : ''}<br/>
                  GSTIN: ${propertySettings?.gstNumber || '02AAACH2341M1Z1'}
                </p>
              </div>
              <div class="text-right">
                <h2 class="text-xl font-black text-indigo-600 uppercase tracking-[0.2em] mb-4">Tax Invoice</h2>
                <div class="space-y-1">
                  <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Invoice No</p>
                  <p class="text-sm font-black text-slate-900 uppercase">#${booking.invoiceNumber || ('INV-' + new Date().getFullYear() + '-' + (booking.id.split('-')[1]?.substring(0, 4) || 'TEMP'))}</p>
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
                  ${booking.guestDetails?.address || 'Address Not Provided'}<br/>
                  ${booking.guestDetails?.city ? booking.guestDetails.city + ', ' : ''}${booking.guestDetails?.country || ''}<br/>
                  Ph: ${booking.guestDetails?.phoneNumber || 'N/A'}
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
                  </tr>
                `).join('')}
              </tbody>
            </table>

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
                  <span class="text-xs font-black uppercase tracking-[0.2em] text-slate-900">Final Invoice Total</span>
                  <span class="text-xl font-black text-indigo-600 tabular-nums">₹${finalNetInvoiceTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
      idNumber: details?.idNumber ? `XXXX - XXXX - ${details.idNumber.slice(-4)} ` : '________________',
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
            ${(booking.accessoryGuests || []).map((guest, i) => `
              <div class="field">
                <div class="label">Co-Guest ${i + 1}</div>
                <div class="value">${guest.name}</div>
              </div>
            `).join('')}
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

        <div className="flex items-center gap-2">
          {/* Main Actions Group */}
          <div className="flex items-center gap-2 mr-4 border-r border-slate-200 pr-4">
            <button
              onClick={printRegCard}
              className="px-5 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Reg Card
            </button>
          </div>

          {/* Status & Check-in/Out Group */}
          <div className="flex items-center gap-3">
            {(booking.status === 'Confirmed' || isAddingAccessory) && (
              <button
                onClick={handleCheckInNow}
                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 ${isAddingAccessory ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
              >
                {isAddingAccessory ? <CheckCircle2 className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                {isAddingAccessory ? (editingAccessoryIndex !== null ? 'Save Changes' : 'Add Co-Guest') : 'Complete Check-In'}
              </button>
            )}

            {!isAddingAccessory && booking.status === 'CheckedIn' && (
              <button
                onClick={handleCheckInNow}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            )}

            {booking.status === 'CheckedIn' && (
              <button
                onClick={handleCheckout}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Check-Out
              </button>
            )}

            {booking.status === 'Confirmed' && (
              <button
                onClick={handleCancelBooking}
                className="px-6 py-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-100 transition-all shadow-sm flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Cancel Booking
              </button>
            )}

            <div className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all ${getStatusStyles(booking.status)}`}>
              {booking.status === 'Rejected' ? 'Warning/Unpaid' : booking.status === 'CheckedOut' ? 'Checked Out' : booking.status}
            </div>
          </div>
        </div>
      </header>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-8 custom-scrollbar">
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
                  <div className="flex-1 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="flex flex-col gap-3">
                      {isAddingAccessory && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full w-fit mb-2 border border-indigo-100 animate-in fade-in slide-in-from-left-2 transition-all">
                          <Users className="w-3 h-3" />
                          <span className="text-[9px] font-black uppercase tracking-[0.2em]">Editing Co-Guest Mode</span>
                          <button onClick={resetToPrimaryGuest} className="ml-2 hover:text-indigo-800"><X className="w-3 h-3" /></button>
                        </div>
                      )}
                      <div className="flex items-center gap-4 flex-1">
                        <input
                          type="text"
                          value={editableDetails.name || ''}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          placeholder="Guest Name *"
                          className={`text-4xl font-black text-slate-900 tracking-tight leading-tight bg-transparent border-b-2 transition-all px-2 flex-1 outline-none ring-offset-4 rounded-lg ${validationErrors.includes("Full Name") ? 'border-rose-300 bg-rose-50 ring-2 ring-rose-200' : 'border-transparent hover:border-indigo-300 focus:border-indigo-600'}`}
                        />
                        {booking.roomNumber && (
                          <span className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">
                            Room {booking.roomNumber}
                          </span>
                        )}
                      </div>

                      {/* Stay Dates Display */}
                      <div className="flex items-center gap-4 text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50/50 px-3 py-1.5 rounded-xl border border-indigo-100/50 w-fit">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          <span>In: {new Date(booking.checkIn).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                        <div className="w-1 h-1 rounded-full bg-indigo-200" />
                        <div className="flex items-center gap-1.5">
                          <LogOut className="w-3 h-3" />
                          <span>Out: {new Date(booking.checkOut).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Primary Resident
                        </span>
                        {editableDetails.profileId && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-widest border border-slate-200">
                            Profile ID: #{editableDetails.profileId}
                          </span>
                        )}
                        {/* VIP Toggle - next to nationality */}
                        {!isAddingAccessory && (
                          <button
                            onClick={() => onToggleVIP?.(booking.id)}
                            className={`p-1.5 rounded-lg transition-all shadow-sm border ${booking.isVIP
                              ? 'bg-violet-100 border-violet-200 text-violet-600'
                              : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}`}
                          >
                            <Star className={`w-4 h-4 ${booking.isVIP ? 'fill-current' : ''}`} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  {/* Row 1: Mobile and Father's Name side by side */}
                  {/* Mobile Number Field */}
                  <div className={`flex items-center gap-3 group p-4 rounded-2xl transition-all ${validationErrors.includes("Mobile Number") ? 'bg-rose-50 ring-2 ring-rose-200' : ''}`}>
                    <div className="p-2.5 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors"><Smartphone className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0 relative">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mobile Number {!isAddingAccessory && <span className="text-rose-500">*</span>}</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editableDetails.phoneNumber || ''}
                          onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                          onBlur={() => setTimeout(() => setShowLookupDropdown(false), 200)}
                          placeholder={isAddingAccessory ? "Optional" : "Required"}
                          className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 tabular-nums focus:ring-0 placeholder:text-slate-300"
                        />
                        {isLookupLoading && <Loader2 className="w-3 h-3 text-indigo-500 animate-spin" />}
                      </div>

                      {/* Lookup Results Dropdown */}
                      {showLookupDropdown && lookupResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[1000] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-3 bg-indigo-50 border-b border-indigo-100">
                            <p className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">Repeat Guest Found</p>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {lookupResults.map((guest, idx) => (
                              <button
                                key={idx}
                                onClick={() => selectGuestFromLookup(guest)}
                                className="w-full text-left p-4 hover:bg-slate-50 flex items-center gap-4 transition-colors border-b border-slate-50 last:border-0"
                              >
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
                                  {(guest.name || 'G').charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-black text-slate-900 truncate uppercase">{guest.name}</p>
                                    <span className="text-[8px] font-black text-slate-400">ID: #{guest.profileId || guest.id}</span>
                                  </div>
                                  <p className="text-[9px] font-bold text-slate-500 truncate">{guest.idType}: {guest.idNumber}</p>
                                </div>
                                <ArrowRightCircle className="w-4 h-4 text-indigo-500" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Father's/Husband's Name Field */}
                  <div className="flex items-center gap-3 group p-4 rounded-2xl transition-all">
                    <div className="p-2.5 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors"><Users className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Father's/Husband's Name</p>
                      <input
                        type="text"
                        value={editableDetails.fatherOrHusbandName || ''}
                        onChange={(e) => handleInputChange('fatherOrHusbandName', e.target.value)}
                        placeholder="Full Name"
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 tabular-nums focus:ring-0 placeholder:text-slate-300"
                      />
                    </div>
                  </div>

                  {/* Nationality Field */}
                  <div className="flex items-center gap-3 group p-4 rounded-2xl transition-all">
                    <div className="p-2.5 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors"><Globe className="w-4 h-4" /></div>
                    <div className="flex-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nationality</p>
                      <select
                        value={editableDetails.nationality || 'Indian'}
                        onChange={(e) => handleInputChange('nationality', e.target.value)}
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0 appearance-none cursor-pointer"
                      >
                        <option value="Indian">Indian</option>
                        <option value="American">American</option>
                        <option value="British">British</option>
                        <option value="Canadian">Canadian</option>
                        <option value="Australian">Australian</option>
                        <option value="German">German</option>
                        <option value="French">French</option>
                        <option value="Japanese">Japanese</option>
                        <option value="Chinese">Chinese</option>
                        <option value="Russian">Russian</option>
                        <option value="UAE">UAE</option>
                        <option value="Saudi">Saudi</option>
                        <option value="Nepalese">Nepalese</option>
                        <option value="Bangladeshi">Bangladeshi</option>
                        <option value="Sri Lankan">Sri Lankan</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  {/* Email Field */}
                  <div className="flex items-center gap-3 group p-4 rounded-2xl transition-all">
                    <div className="p-2.5 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors"><Mail className="w-4 h-4" /></div>
                    <div className="flex-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Email Address</p>
                      <input
                        type="email"
                        value={editableDetails.email || ''}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="Optional"
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 tabular-nums focus:ring-0 placeholder:text-slate-300"
                      />
                    </div>
                  </div>

                  {/* Date of Birth Field */}
                  <div className="flex items-center gap-3 group p-4 rounded-2xl transition-all">
                    <div className="p-2.5 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors"><Calendar className="w-4 h-4" /></div>
                    <div className="flex-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date of Birth <span className="text-rose-500">*</span></p>
                      <input
                        type="date"
                        value={editableDetails.dob || ''}
                        onChange={(e) => handleInputChange('dob', e.target.value)}
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 tabular-nums focus:ring-0"
                      />
                    </div>
                  </div>

                  {/* Gender Field */}
                  <div className="flex items-center gap-3 group p-4 rounded-2xl transition-all">
                    <div className="p-2.5 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors"><User className="w-4 h-4" /></div>
                    <div className="flex-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Gender</p>
                      <select
                        value={editableDetails.gender || 'Male'}
                        onChange={(e) => handleInputChange('gender', e.target.value)}
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 tabular-nums focus:ring-0 appearance-none cursor-pointer"
                      >
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className={`flex items-center gap-4 group p-4 rounded-2xl transition-all ${validationErrors.includes("ID Number") || validationErrors.includes("ID Type") ? 'bg-rose-50 ring-2 ring-rose-200' : ''}`}>
                    <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors"><FileBadge className="w-5 h-5" /></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <select
                          value={editableDetails.idType || ''}
                          onChange={(e) => handleInputChange('idType', e.target.value)}
                          className={`bg-transparent border-none p-0 text-[10px] font-black uppercase tracking-widest focus:ring-0 appearance-none cursor-pointer transition-colors ${validationErrors.includes("ID Type") ? 'text-rose-600' : 'text-slate-400'}`}
                        >
                          <option value="">Select ID Type {!isAddingAccessory ? '*' : ''}</option>
                          <option>Aadhar</option>
                          <option>Passport</option>
                          <option>DL</option>
                          <option>Voter ID</option>
                        </select>
                      </div>
                      <input
                        type="text"
                        value={isIdMasked && editableDetails.idNumber ? `XXXX-XXXX-${editableDetails.idNumber.slice(-4)}` : editableDetails.idNumber || ''}
                        onFocus={() => setIsIdMasked(false)}
                        onChange={(e) => handleInputChange('idNumber', e.target.value)}
                        placeholder={isAddingAccessory ? "Document #" : "Document # *"}
                        className="w-full bg-transparent border-none p-0 text-base font-bold text-slate-700 tabular-nums focus:ring-0 placeholder:text-slate-300"
                      />
                    </div>
                  </div>

                  <div className={`relative w-full h-64 bg-black rounded-2xl overflow-hidden shadow-md group/id ${validationErrors.includes("ID Front Scan") ? 'ring-2 ring-rose-400' : ''}`}>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />

                    {isCameraActive ? (
                      <div className="absolute inset-0 z-50 bg-black">
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="absolute inset-x-0 bottom-8 flex justify-center items-center gap-4">
                          <button onClick={stopCamera} className="p-4 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all"><X className="w-6 h-6" /></button>
                          <button onClick={captureImage} className="w-20 h-20 bg-white rounded-full border-8 border-indigo-400/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-2xl">
                            <div className="w-12 h-12 bg-indigo-600 rounded-full"></div>
                          </button>
                          {/* Finish button for ID scanning */}
                          {(ocrStep === 'scan_front' || ocrStep === 'scan_back') && (idImages.front || idImages.back) && (
                            <button
                              onClick={finishScanning}
                              className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl"
                            >
                              Finish ({(idImages.front ? 1 : 0) + (idImages.back ? 1 : 0) + idImages.additional.length} pgs)
                            </button>
                          )}
                          {/* Finish button for Form scanning */}
                          {ocrStep === 'scan_form' && idImages.formPages.length > 0 && (
                            <button
                              onClick={finishScanning}
                              className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl"
                            >
                              Finish ({idImages.formPages.length} pgs)
                            </button>
                          )}
                          <button onClick={triggerFileUpload} className="p-4 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all"><Upload className="w-6 h-6" /></button>
                        </div>
                        <div className="absolute top-4 left-4 right-4 text-center">
                          <span className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">
                            {ocrStep === 'scan_front'
                              ? `Scan ID (Page ${(idImages.front ? 1 : 0) + (idImages.back ? 1 : 0) + idImages.additional.length + 1})`
                              : ocrStep === 'scan_back'
                                ? `Scan ID Back`
                                : ocrStep === 'scan_form'
                                  ? `Scan Doc (Page ${idImages.formPages.length + 1})`
                                  : `Scanning ${ocrStep.replace('scan_', '').toUpperCase()}`}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <>
                        {(() => {
                          const src = activeSide === 'front' ? idImages.front
                            : activeSide === 'back' ? idImages.back
                              : activeSide === 'visa' ? idImages.visa
                                : (activeAdditionalIndex >= 100 ? idImages.formPages[activeAdditionalIndex - 100] : idImages.additional[activeAdditionalIndex]);

                          if (!src) return (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                              <div className="p-4 bg-white/5 rounded-3xl backdrop-blur-sm border border-white/10">
                                <FileImage className="w-10 h-10 text-slate-700" />
                              </div>
                              <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.2em]">No Document Scanned</p>
                            </div>
                          );

                          return (
                            <img
                              src={src}
                              alt="Scanned ID"
                              className={`w-full h-full object-cover transition-all duration-700 ${isIdRevealed ? 'blur-0 opacity-100' : 'blur-xl opacity-60'}`}
                            />
                          );
                        })()}

                        {!isIdRevealed ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 backdrop-blur-sm z-10 space-y-3 px-8 text-center">
                            <Lock className="w-8 h-8 text-slate-300" />
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">ID Documents Hidden <span className="text-rose-500">*</span></p>
                            <div className="flex gap-2">
                              <button onClick={handleRevealId} className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-[10px] font-black text-white uppercase tracking-widest">View ID</button>
                              <button onClick={() => startCamera('scan_front')} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <Camera className="w-3.5 h-3.5" /> Scan ID
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="absolute top-3 inset-x-3 flex items-start justify-between pointer-events-none z-[110]">
                            <div className="flex flex-wrap gap-2 pointer-events-auto">
                              <button onClick={() => setActiveSide('front')} className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase transition-all shadow-sm ${activeSide === 'front' ? 'bg-white text-indigo-600' : 'bg-black/40 text-white/70 hover:bg-black/60'}`}>Front</button>
                              <button onClick={() => setActiveSide('back')} className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase transition-all shadow-sm ${activeSide === 'back' ? 'bg-white text-indigo-600' : 'bg-black/40 text-white/70 hover:bg-black/60'}`}>Back</button>
                              {isForeigner && <button onClick={() => setActiveSide('visa')} className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase transition-all shadow-sm ${activeSide === 'visa' ? 'bg-white text-indigo-600' : 'bg-black/40 text-white/70 hover:bg-black/60'}`}>Visa</button>}
                              {idImages.formPages?.map((_, idx) => (
                                <button
                                  key={`form-${idx}`}
                                  onClick={() => { setActiveSide('additional'); setActiveAdditionalIndex(100 + idx); }}
                                  className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase transition-all shadow-sm ${activeSide === 'additional' && activeAdditionalIndex === (100 + idx) ? 'bg-emerald-600 text-white' : 'bg-black/40 text-white/70 hover:bg-black/60'}`}
                                >
                                  Form {idx + 1}
                                </button>
                              ))}
                              {idImages.additional?.map((_, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => { setActiveSide('additional'); setActiveAdditionalIndex(idx); }}
                                  className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase transition-all shadow-sm ${activeSide === 'additional' && activeAdditionalIndex === idx ? 'bg-indigo-600 text-white' : 'bg-black/40 text-white/70 hover:bg-black/60'}`}
                                >
                                  {idx + 1}
                                </button>
                              ))}
                            </div>

                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteScan();
                              }}
                              className="p-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all shadow-2xl active:scale-90 pointer-events-auto flex items-center justify-center border-2 border-white/20"
                              title="Delete this scan"
                            >
                              <Trash2 className="w-5 h-5 shadow-sm" />
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {ocrStep === 'processing' && (
                      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center z-[60] space-y-4">
                        <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
                        <p className="text-xs font-black text-white uppercase tracking-widest">Gemini AI OCR Processing...</p>
                      </div>
                    )}
                  </div>

                  {/* ACTION BUTTONS - Below ID Image */}
                  <div className="flex flex-col gap-3 mt-4">
                    <button
                      onClick={() => startCamera('scan_front')}
                      className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg"
                    >
                      <Camera className="w-4 h-4" />
                      Scan ID
                    </button>
                    <button
                      onClick={() => startCamera('scan_form')}
                      className="w-full py-3 bg-slate-700 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-600 transition-all flex items-center justify-center gap-2 shadow-lg"
                    >
                      <ScanLine className="w-4 h-4" />
                      Scan Doc
                    </button>
                    {isAddingAccessory && (
                      <>
                        <button
                          onClick={handleCheckInNow}
                          className="w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {editingAccessoryIndex !== null ? 'Save Changes' : 'Save Co-Guest'}
                        </button>
                        <button
                          onClick={resetToPrimaryGuest}
                          className="w-full py-3 bg-slate-100 text-slate-500 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all border border-slate-200"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {!isAddingAccessory && booking.status === 'Confirmed' && (
                      <div className="flex flex-col gap-3">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Complete check-in in the header above</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Consolidated Stay Details & Address */}
              <div className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Purpose of Visit</p>
                    <select
                      value={editableDetails.purposeOfVisit || 'Tourism'}
                      onChange={(e) => handleInputChange('purposeOfVisit', e.target.value)}
                      className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0 appearance-none cursor-pointer"
                    >
                      <option>Tourism</option>
                      <option>Business</option>
                      <option>Personal</option>
                      <option>Medical</option>
                      <option>Transit</option>
                    </select>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Arrived From</p>
                    <input
                      type="text"
                      value={editableDetails.arrivedFrom || ''}
                      onChange={(e) => handleInputChange('arrivedFrom', e.target.value)}
                      placeholder="City/Place"
                      className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0"
                    />
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Arrival Time</p>
                    <input
                      type="time"
                      value={editableDetails.arrivalTime || ''}
                      onChange={(e) => handleInputChange('arrivalTime', e.target.value)}
                      className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0"
                    />
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Next Destination</p>
                    <input
                      type="text"
                      value={editableDetails.nextDestination || ''}
                      onChange={(e) => handleInputChange('nextDestination', e.target.value)}
                      placeholder="City/Place"
                      className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0"
                    />
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Departure Date</p>
                    <input
                      type="date"
                      value={booking.checkOut}
                      readOnly
                      className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-400 focus:ring-0"
                    />
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Digital Signature</p>
                      {editableDetails.signature ? (
                        <img src={editableDetails.signature} alt="Signature" className="h-8 object-contain" />
                      ) : (
                        <p className="text-sm font-bold text-slate-300 italic">Required at Desk</p>
                      )}
                    </div>
                  </div>
                  <div className={`p-4 bg-slate-50 rounded-2xl border border-slate-100 md:col-span-3 transition-all ${validationErrors.includes("Address") ? 'bg-rose-50 ring-2 ring-rose-200' : ''}`}>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Permanent Residential Address {!isAddingAccessory && <span className="text-rose-500">*</span>}</p>
                    <textarea
                      value={editableDetails.address || ''}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      placeholder="Full residential address for police verification"
                      className="w-full bg-transparent border-none p-0 text-base font-bold text-slate-700 focus:ring-0 min-h-[80px] resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* FORM C - Foreigner Registration (only shows for non-Indian nationality) */}
              {editableDetails.nationality && editableDetails.nationality !== 'Indian' && (
                <div className="mt-6 p-6 bg-amber-50 rounded-2xl border border-amber-200">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-amber-100 rounded-xl text-amber-600">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-amber-900 tracking-tight">Form C - Foreigner Registration</h4>
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Required for Police Compliance</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-white rounded-xl border border-amber-100">
                      <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Passport Number</p>
                      <input
                        type="text"
                        value={editableDetails.passportNumber || ''}
                        onChange={(e) => handleInputChange('passportNumber', e.target.value)}
                        placeholder="Enter passport #"
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0"
                      />
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-amber-100">
                      <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Passport Issue Date</p>
                      <input
                        type="date"
                        value={editableDetails.passportIssueDate || ''}
                        onChange={(e) => handleInputChange('passportIssueDate', e.target.value)}
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0"
                      />
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-amber-100">
                      <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Passport Expiry Date</p>
                      <input
                        type="date"
                        value={editableDetails.passportExpiry || ''}
                        onChange={(e) => handleInputChange('passportExpiry', e.target.value)}
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0"
                      />
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-amber-100">
                      <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Place of Issue</p>
                      <input
                        type="text"
                        value={editableDetails.passportPlaceIssue || ''}
                        onChange={(e) => handleInputChange('passportPlaceIssue', e.target.value)}
                        placeholder="City/Country"
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0"
                      />
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-amber-100">
                      <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Visa Number</p>
                      <input
                        type="text"
                        value={editableDetails.visaNumber || ''}
                        onChange={(e) => handleInputChange('visaNumber', e.target.value)}
                        placeholder="Enter visa #"
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0"
                      />
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-amber-100">
                      <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Visa Type</p>
                      <select
                        value={editableDetails.visaType || 'Tourist'}
                        onChange={(e) => handleInputChange('visaType', e.target.value)}
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0 appearance-none cursor-pointer"
                      >
                        <option>Tourist</option>
                        <option>Business</option>
                        <option>Medical</option>
                        <option>Employment</option>
                        <option>Student</option>
                        <option>Transit</option>
                        <option>Conference</option>
                        <option>E-Visa</option>
                      </select>
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-amber-100">
                      <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Visa Issue Date</p>
                      <input
                        type="date"
                        value={editableDetails.visaIssueDate || ''}
                        onChange={(e) => handleInputChange('visaIssueDate', e.target.value)}
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0"
                      />
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-amber-100">
                      <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Visa Expiry Date</p>
                      <input
                        type="date"
                        value={editableDetails.visaExpiry || ''}
                        onChange={(e) => handleInputChange('visaExpiry', e.target.value)}
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0"
                      />
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-amber-100">
                      <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Visa Place of Issue</p>
                      <input
                        type="text"
                        value={editableDetails.visaPlaceIssue || ''}
                        onChange={(e) => handleInputChange('visaPlaceIssue', e.target.value)}
                        placeholder="Embassy/Consulate"
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0"
                      />
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-amber-100">
                      <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Port of Arrival</p>
                      <input
                        type="text"
                        value={editableDetails.arrivalPort || ''}
                        onChange={(e) => handleInputChange('arrivalPort', e.target.value)}
                        placeholder="Airport/Port"
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0"
                      />
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-amber-100">
                      <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Date of Arrival in India</p>
                      <input
                        type="date"
                        value={editableDetails.arrivalDateIndia || ''}
                        onChange={(e) => handleInputChange('arrivalDateIndia', e.target.value)}
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0"
                      />
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-amber-100">
                      <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Employment Details</p>
                      <input
                        type="text"
                        value={editableDetails.employmentDetails || ''}
                        onChange={(e) => handleInputChange('employmentDetails', e.target.value)}
                        placeholder="Employer/Business"
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0"
                      />
                    </div>
                  </div>

                  <div className="mt-4 p-4 bg-white rounded-xl border border-amber-100">
                    <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Address in India (if different from above)</p>
                    <textarea
                      value={editableDetails.addressInIndia || ''}
                      onChange={(e) => handleInputChange('addressInIndia', e.target.value)}
                      placeholder="Contact address during stay in India"
                      className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0 min-h-[60px] resize-none"
                    />
                  </div>
                </div>
              )}
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
                  <div key={idx} className={`p-4 border rounded-2xl transition-all group flex items-center justify-between ${editingAccessoryIndex === idx ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-200/50' : 'bg-slate-50 border-slate-100 hover:border-indigo-100'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shadow-sm ${editingAccessoryIndex === idx ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 group-hover:text-indigo-500'}`}>
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${editingAccessoryIndex === idx ? 'text-indigo-900' : 'text-slate-800'}`}>{guest.name}</p>
                        <p className={`text-[9px] font-black uppercase tracking-widest ${editingAccessoryIndex === idx ? 'text-indigo-400' : 'text-slate-400'}`}>{guest.idType}: {guest.idNumber || 'PENDING'}</p>
                      </div>
                    </div>
                    {!isAddingAccessory && (
                      <button onClick={() => handleEditAccessory(idx)} className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-white rounded-lg transition-all opacity-0 group-hover:opacity-100"><Edit3 className="w-4 h-4" /></button>
                    )}
                  </div>
                ))}
                {!isAddingAccessory && (
                  <button onClick={startAddingAccessory} className="p-4 border-2 border-dashed border-slate-100 rounded-2xl flex items-center justify-center gap-2 text-slate-400 hover:border-indigo-200 hover:text-indigo-500 transition-all">
                    <Plus className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">Add Co-Guest</span>
                  </button>
                )}
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
                        {(() => {
                          const totalNights = history.reduce((sum, h) => sum + Math.ceil((new Date(h.checkOut).getTime() - new Date(h.checkIn).getTime()) / (1000 * 3600 * 24)), 0);

                          const tiers = propertySettings?.loyaltyTiers || [];
                          if (tiers.length > 0) {
                            const sortedTiers = [...tiers].sort((a, b) => b.minNights - a.minNights);
                            const matchedTier = sortedTiers.find(t => totalNights >= t.minNights);
                            if (matchedTier) {
                              const colors: Record<string, string> = {
                                PLATINUM: 'bg-indigo-600 shadow-indigo-200',
                                'GOLD ELITE': 'bg-amber-500 shadow-amber-200',
                                SILVER: 'bg-slate-400 shadow-slate-200',
                                GOLD: 'bg-amber-500 shadow-amber-200'
                              };
                              const colorClass = colors[matchedTier.name] || 'bg-slate-500 shadow-slate-200';
                              return <span className={`px-2 py-1 ${colorClass} text-white text-[8px] font-black rounded-lg shadow-sm`}>{matchedTier.name}</span>;
                            }
                          }

                          if (totalNights >= 10) return <span className="px-2 py-1 bg-indigo-600 text-white text-[8px] font-black rounded-lg shadow-sm shadow-indigo-200">PLATINUM</span>;
                          if (totalNights >= 5) return <span className="px-2 py-1 bg-amber-500 text-white text-[8px] font-black rounded-lg shadow-sm shadow-amber-200">GOLD ELITE</span>;
                          if (totalNights >= 2) return <span className="px-2 py-1 bg-slate-400 text-white text-[8px] font-black rounded-lg shadow-sm shadow-slate-200">SILVER</span>;
                          return <span className="px-2 py-1 bg-slate-200 text-slate-600 text-[8px] font-black rounded-lg">REGULAR</span>;
                        })()}
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
                    {(booking.invoiceNumber || checkoutDocs?.invoice) && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Inv #</span>
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">{booking.invoiceNumber || (checkoutDocs?.invoice?.split('_').pop()?.split('.')[0])}</span>
                      </div>
                    )}
                    {checkoutDocs?.invoice && (
                      <a
                        href={`/billing/${checkoutDocs.invoice.split('/').pop()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-5 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-500/30 transition-all flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4" /> Tax Invoice PDF
                      </a>
                    )}
                    {checkoutDocs?.receipt && (
                      <a
                        href={`/billing/${checkoutDocs.receipt.split('/').pop()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-5 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-500/30 transition-all flex items-center gap-2"
                      >
                        <Receipt className="w-4 h-4" /> Receipt PDF
                      </a>
                    )}
                    {booking.status === 'CheckedIn' && (
                      <button onClick={handleCheckout} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/40">
                        <CheckCircle2 className="w-4 h-4" /> Finalize & Checkout
                      </button>
                    )}
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
                      <div className="flex items-baseline gap-4 mt-2 overflow-hidden">
                        <p className={`text-3xl md:text-4xl font-black tabular-nums tracking-tighter truncate ${netOutstanding <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
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
                                <div className={`w-1.5 h-1.5 rounded-full ${p.status === 'Completed' ? 'bg-emerald-500' : 'bg-rose-500'} `}></div>
                                <span className={`text-[10px] font-bold ${p.status === 'Completed' ? 'text-slate-200' : 'text-slate-500 line-through'} `}>₹{p.amount.toLocaleString()} via {p.method}</span>
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
                            <span className={`w-1 h-1 rounded-full ${cat === 'F&B' ? 'bg-orange-400' : 'bg-indigo-400'} `}></span>
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
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner ${item.category === 'F&B' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'} `}>
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
                                  className={`text-[8px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 transition-all px-2 py-1 rounded-md mt-1.5 ${item.isPaid ? 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/30' : 'text-rose-400 bg-rose-400/10 border border-rose-400/30 animate-pulse'} `}
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
                    <p className={`text-sm font-bold text-slate - 800 transition-all duration-200 ${isUpdatingBeds ? 'scale-110 text-indigo-600' : 'scale-100'} `}>
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
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${effectiveDate === booking.checkIn ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'} `}
                    >
                      Full Move
                    </button>
                    <button
                      onClick={() => setEffectiveDate(new Date().toISOString().split('T')[0])}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${effectiveDate !== booking.checkIn ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'} `}
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
                      className={`py-4 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${chargeCategory === cat ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200'} `}
                    >
                      {cat === 'F&B' ? <Coffee className="w-4 h-4" /> : cat === 'Laundry' ? <Sparkles className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                      <span className="text-[9px] font-black uppercase">{cat}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-4 p-5 bg-indigo-50 border-2 border-indigo-100 rounded-[2rem] cursor-pointer group hover:border-indigo-300 transition-all shadow-sm">
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isChargeInclusive ? 'bg-indigo-600 border-indigo-600 shadow-md' : 'bg-white border-indigo-200 group-hover:border-indigo-400'} `}>
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
                {targetFolioItem ? `Settling: ${targetFolioItem.description} ` : 'Adding Partial Payment to Bill'}
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
                      className={`py-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === m ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-200' : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200'} `}
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
      {toastMessage && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[20000] animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Delete Scan Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[25000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300 mx-4">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-rose-600" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Delete This Scan?</h3>
              <p className="text-sm text-slate-500">This will remove the {pendingDeleteSide?.side === 'additional' ? 'document page' : `${pendingDeleteSide?.side} scan`}. You'll need to scan again if needed.</p>
            </div>
            <div className="flex border-t border-slate-100">
              <button
                onClick={() => { setShowDeleteConfirm(false); setPendingDeleteSide(null); }}
                className="flex-1 py-4 text-sm font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteScan}
                className="flex-1 py-4 text-sm font-black text-rose-600 uppercase tracking-widest hover:bg-rose-50 transition-colors border-l border-slate-100"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

export default GuestProfilePage;
