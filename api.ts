import { Hotel, RoomType, OTAConnection, RateRulesConfig, Booking, PropertySettings } from './types';

const API_BASE = '/api';

export const fetchPropertySettings = async (): Promise<PropertySettings> => {
    const response = await fetch(`${API_BASE}/property`);
    if (!response.ok) throw new Error('Failed to fetch property settings');
    return response.json();
};

export const updatePropertySettings = async (settings: PropertySettings): Promise<PropertySettings> => {
    const response = await fetch(`${API_BASE}/property`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    });
    if (!response.ok) throw new Error('Failed to update property settings');
    return response.json();
};

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
export const createRoomType = async (roomType: RoomType): Promise<RoomType> => {
    const response = await fetch(`${API_BASE}/room-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roomType)
    });
    if (!response.ok) throw new Error('Failed to create room type');
    return response.json();
};
export const updateRoomType = async (rtId: string, roomType: RoomType): Promise<RoomType> => {
    const response = await fetch(`${API_BASE}/room-types/${rtId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roomType)
    });
    if (!response.ok) throw new Error('Failed to update room type');
    return response.json();
};
export const deleteRoomType = async (rtId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/room-types/${rtId}`, {
        method: 'DELETE'
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let message = 'Failed to delete room type';
        if (errorData.detail) {
            message = typeof errorData.detail === 'string'
                ? errorData.detail
                : JSON.stringify(errorData.detail);
        }
        throw new Error(message);
    }
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
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let message = 'Failed to create bulk bookings';
        if (errorData.detail) {
            message = typeof errorData.detail === 'string'
                ? errorData.detail
                : JSON.stringify(errorData.detail);
        }
        throw new Error(message);
    }
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

export const lookupGuest = async (name?: string, phone?: string): Promise<any> => {
    const params = new URLSearchParams();
    if (name) params.append('name', name);
    if (phone) params.append('phone', phone);
    const response = await fetch(`${API_BASE}/guest/lookup?${params.toString()}`);
    if (!response.ok) return null;
    return response.json();
};

export const fetchGuestHistory = async (name: string, phone?: string, excludeBookingId?: string): Promise<Booking[]> => {
    const params = new URLSearchParams();
    params.append('name', name);
    if (phone) params.append('phone', phone);
    if (excludeBookingId) params.append('exclude_booking_id', excludeBookingId);
    const response = await fetch(`${API_BASE}/guest/history?${params.toString()}`);
    if (!response.ok) return [];
    return response.json();
};
