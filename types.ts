export interface LoyaltyTier {
  name: string;
  minNights: number;
}

export interface PropertySettings {
  name: string;
  address: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  gstRate: number;
  foodGstRate?: number;
  otherGstRate?: number;
  geminiApiKey?: string;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  lastInvoiceNumber?: number;
  publicBaseUrl?: string;
  checkInTime?: string; // e.g. "12:00"
  checkOutTime?: string; // e.g. "11:00"
  loyaltyTiers?: LoyaltyTier[];
}

export interface Hotel {
  id: string;
  name: string;
  location: string;
  color: string;
  otaConfig: {
    expedia: string;
    booking: string;
    mmt: string;
  };
}

export interface RoomType {
  id: string;
  name: string;
  totalCapacity: number;
  basePrice: number;
  floorPrice: number;
  ceilingPrice: number;
  baseOccupancy: number;
  amenities: string[];
  roomNumbers?: string[];
  extraBedCharge?: number;
}

export interface SpecialEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  modifierType: 'percentage' | 'fixed';
  modifierValue: number; // e.g., 1.2 for +20% or 500 for +500 INR
}

export interface WeeklyRule {
  isActive: boolean;
  activeDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  modifierType: 'percentage' | 'fixed';
  modifierValue: number;
}

export interface RateRulesConfig {
  weeklyRules: WeeklyRule;
  specialEvents: SpecialEvent[];
}

export interface InventoryItem {
  date: string;
  roomTypeId: string;
  availableCount: number;
  price: number;
  isLocked: boolean;
  appliedRule?: string; // Name of the rule applied (e.g., 'Weekend', 'Diwali')
}

export type ChannelStatus = 'pending' | 'success' | 'error' | 'retrying' | 'waiting_retry' | 'stopped';

export interface GuestDetails {
  profileId?: number;
  name?: string;
  phoneNumber?: string;
  email?: string;
  idType?: 'Aadhar' | 'Passport' | 'Driving License' | 'Voter ID' | 'Other';
  idNumber?: string;
  nationality: string;
  gender?: 'Male' | 'Female' | 'Other';
  dob?: string;

  // ========== FORM B - General Guest Register Fields ==========
  serialNumber?: number; // Unique sequential number for the year
  fatherOrHusbandName?: string; // Traditional police register requirement

  // Permanent Address (Full)
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  country?: string;

  // Arrival Details
  arrivedFrom?: string; // City/place traveled from
  arrivalTime?: string; // Exact time of check-in (HH:MM)

  // Departure Details (filled at checkout)
  departureTime?: string; // Exact time of check-out (HH:MM)
  destination?: string; // Where going after leaving

  // Purpose
  purposeOfVisit?: 'Business' | 'Tourism' | 'Transit' | 'Personal' | 'Medical' | 'Other';

  // Signature
  signature?: string; // Base64 digital signature or path to image

  // ========== FORM C - Foreigner's Register Fields ==========
  // Passport Details
  passportNumber?: string;
  passportPlaceIssue?: string;
  passportIssueDate?: string;
  passportExpiry?: string;

  // Visa Details
  visaNumber?: string;
  visaType?: 'Tourist' | 'Business' | 'Medical' | 'E-Visa' | 'Employment' | 'Student' | 'Transit' | 'Other';
  visaPlaceIssue?: string;
  visaIssueDate?: string;
  visaExpiry?: string;

  // India Entry Details
  arrivalDateIndia?: string; // Date of entry into India
  arrivalPort?: string; // Port of Entry (e.g., DEL, BOM, CCU)

  // Next Destination (after leaving hotel)
  nextDestination?: string; // Specific address or city

  // Contact in India
  contactInIndiaName?: string; // Local reference name
  contactInIndiaPhone?: string; // Local reference phone
  contactInIndiaAddress?: string; // Local reference address

  // Employment Info
  employmentDetails?: string; // Employer or business info
  addressInIndia?: string; // Address during stay in India

  // Form C Submission Status
  isFormCSubmitted?: boolean;
  formCSubmissionDate?: string;

  // ========== Scanned Documents ==========
  idImage?: string;
  idImageBack?: string;
  visaPage?: string;
  additionalDocs?: string[];
  formPages?: string[];
}


export interface Payment {
  id: string;
  amount: number;
  method: 'Cash' | 'UPI' | 'Card';
  timestamp: string;
  category: 'Room' | 'Folio' | 'Extra' | 'Partial';
  description?: string;
  status: 'Completed' | 'Refunded' | 'Cancelled';
}

export interface FolioItem {
  id: string;
  description: string;
  amount: number;
  category: 'F&B' | 'Laundry' | 'Room' | 'Other';
  timestamp: string;
  isPaid?: boolean;
  isInclusive?: boolean; // If true, amount includes GST
  paymentMethod?: string;
  paymentId?: string; // Link to a Payment record if paid
}

export interface Booking {
  id: string;
  roomTypeId: string;
  roomNumber?: string; // Assigned specific unit (e.g., "101")
  guestName: string;
  source: 'MMT' | 'Booking.com' | 'Expedia' | 'Direct';
  status: 'Confirmed' | 'CheckedIn' | 'CheckedOut' | 'Cancelled' | 'Rejected';
  timestamp: number;
  checkIn: string;
  checkOut: string;
  reservationId?: string;
  channelSync?: Record<string, ChannelStatus>;
  amount?: number;
  rejectionReason?: string; // Specific reason why the system rejected the booking
  guestDetails?: GuestDetails;
  // Enhanced detail fields
  numberOfRooms?: number;
  pax?: number;
  accessoryGuests?: GuestDetails[];
  extraBeds?: number;
  specialRequests?: string;
  isVIP?: boolean;
  isSettled?: boolean;
  invoiceNumber?: string;
  invoicePath?: string;
  receiptPath?: string;
  isAutoGenerated?: boolean;
  externalReferenceId?: string;
  folio?: FolioItem[];
  payments?: Payment[];
}

export interface RateSyncEvent {
  id: string;
  type: 'rate_update';
  roomTypeId: string;
  newPrice: number;
  date?: string;
  timestamp: number;
  channelSync: Record<string, ChannelStatus>;
  channelPrices?: Record<string, number>; // Specific price sent to each channel after markup
  ruleApplied?: string;
}

export type SyncEvent = (Booking & { type: 'booking' }) | RateSyncEvent;

export interface SystemLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  message: string;
  data?: any;
}

export interface OTAConnection {
  id: string;
  name: string;
  key: string;
  isVisible: boolean;
  status: 'connected' | 'disconnected' | 'testing';
  lastValidated?: string;
  category?: string;
  markupType?: 'percentage' | 'fixed';
  markupValue?: number; // e.g., 5 for 5% or 500 for ₹500
  isStopped?: boolean; // Master switch to stop sales on this channel
}

export interface AnalyticsData {
  occupancyRate: number;
  revPar: number;
  adr: number;
  totalRevenue: number;
}

export interface VerificationAttempt {
  id: string;
  room_id: string;
  input_surname: string;
  status: 'SUCCESS' | 'FAIL' | 'LOCKED';
  ip_address: string;
  created_at: string;
}

export interface RoomSecurityStatus {
  room_id: string;
  isLocked: boolean;
  isQRDisabled: boolean;
  failCount: number;
}

export type NotificationType = 'reservation' | 'checkin' | 'checkout' | 'payment' | 'housekeeping' | 'guest_request' | 'system';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Notification {
  id: string;
  type: NotificationType;
  category: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: string;
  readAt?: string;
  bookingId?: string;
  roomNumber?: string;
  metadata?: Record<string, any>;
}

