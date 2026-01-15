import { Hotel, RoomType, OTAConnection, RateRulesConfig, Booking } from './types';

const API_BASE = '/api';

export const fetchHotels = async (): Promise<Hotel[]> => {
    const response = await fetch(`${API_BASE}/hotels`);
    if (!response.ok) throw new Error('Failed to fetch hotels');
    return response.json();
};

export const fetchRoomTypes = async (): Promise<RoomType[]> => {
    const response = await fetch(`${API_BASE}/room-types`);
    if (!response.ok) throw new Error('Failed to fetch room types');
    return response.json();
};

export const fetchConnections = async (): Promise<OTAConnection[]> => {
    const response = await fetch(`${API_BASE}/connections`);
    if (!response.ok) throw new Error('Failed to fetch connections');
    return response.json();
};

export const fetchRules = async (): Promise<RateRulesConfig> => {
    const response = await fetch(`${API_BASE}/rules`);
    if (!response.ok) throw new Error('Failed to fetch rules');
    return response.json();
};

export const fetchBookings = async (): Promise<Booking[]> => {
    const response = await fetch(`${API_BASE}/bookings`);
    if (!response.ok) throw new Error('Failed to fetch bookings');
    return response.json();
};
export const createBulkBookings = async (bookings: Booking[]): Promise<Booking[]> => {
    const response = await fetch(`${API_BASE}/bookings/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookings)
    });
    if (!response.ok) throw new Error('Failed to create bulk bookings');
    return response.json();
};

export const createBooking = async (booking: Booking): Promise<Booking> => {
    const response = await fetch(`${API_BASE}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking)
    });
    if (!response.ok) throw new Error('Failed to create booking');
    return response.json();
};
export const updateBooking = async (booking: Booking): Promise<Booking> => {
    const response = await fetch(`${API_BASE}/bookings/${booking.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking)
    });
    if (!response.ok) throw new Error('Failed to update booking');
    return response.json();
};

export const transferBooking = async (bookingId: string, transferData: {
    bookingId: string;
    newRoomTypeId: string;
    newRoomNumber: string;
    effectiveDate: string;
    keepRate: boolean;
    transferFolio: boolean;
}): Promise<Booking> => {
    const response = await fetch(`${API_BASE}/bookings/${bookingId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transferData)
    });
    if (!response.ok) throw new Error('Failed to transfer room');
    return response.json();
};
