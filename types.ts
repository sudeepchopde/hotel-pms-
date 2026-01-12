
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
  name?: string;
  phoneNumber?: string;
  email?: string;
  idType?: 'Aadhar' | 'Passport' | 'Driving License' | 'Voter ID' | 'Other';
  idNumber?: string;
  address?: string;
  nationality: string;
  gender?: 'Male' | 'Female' | 'Other';
  dob?: string;
  
  // Enhanced Form C Fields (Indian FRRO Requirements)
  passportNumber?: string;
  passportPlaceIssue?: string;
  passportIssueDate?: string;
  passportExpiry?: string;
  
  visaNumber?: string;
  visaType?: string; // e.g. Tourist, Business, Medical, E-Visa
  visaPlaceIssue?: string;
  visaIssueDate?: string;
  visaExpiry?: string;
  
  arrivedFrom?: string; // Last destination
  arrivalDateIndia?: string; // Date of entry into India
  arrivalPort?: string; // e.g. DEL, BOM
  nextDestination?: string;
  purposeOfVisit?: string;
  
  isFormCSubmitted?: boolean;
  
  // Scanned Document
  idImage?: string;
  idImageBack?: string;
  visaPage?: string;
}

export interface FolioItem {
  id: string;
  description: string;
  amount: number;
  category: 'F&B' | 'Laundry' | 'Room' | 'Other';
  timestamp: string;
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
  folio?: FolioItem[];
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
