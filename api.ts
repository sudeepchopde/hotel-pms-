import {
  Hotel,
  RoomType,
  OTAConnection,
  RateRulesConfig,
  Booking,
  PropertySettings,
  Notification,
  FolioItem,
  RoomStatus,
} from "./types";

export const API_BASE_URL = "/api";

export const fetchPropertySettings = async (): Promise<PropertySettings> => {
  const response = await fetch(`${API_BASE_URL}/property`);
  if (!response.ok) throw new Error("Failed to fetch property settings");
  return response.json();
};

export const updatePropertySettings = async (
  settings: PropertySettings,
): Promise<PropertySettings> => {
  const response = await fetch(`${API_BASE_URL}/property`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!response.ok) throw new Error("Failed to update property settings");
  return response.json();
};

export const fetchHotels = async (): Promise<Hotel[]> => {
  const response = await fetch(`${API_BASE_URL}/hotels`);
  if (!response.ok) throw new Error("Failed to fetch hotels");
  return response.json();
};

export const fetchRoomTypes = async (): Promise<RoomType[]> => {
  const response = await fetch(`${API_BASE_URL}/room-types`);
  if (!response.ok) throw new Error("Failed to fetch room types");
  return response.json();
};
export const createRoomType = async (roomType: RoomType): Promise<RoomType> => {
  const response = await fetch(`${API_BASE_URL}/room-types`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(roomType),
  });
  if (!response.ok) throw new Error("Failed to create room type");
  return response.json();
};
export const updateRoomType = async (
  rtId: string,
  roomType: RoomType,
): Promise<RoomType> => {
  const response = await fetch(`${API_BASE_URL}/room-types/${rtId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(roomType),
  });
  if (!response.ok) throw new Error("Failed to update room type");
  return response.json();
};
export const deleteRoomType = async (rtId: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/room-types/${rtId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let message = "Failed to delete room type";
    if (errorData.detail) {
      message =
        typeof errorData.detail === "string"
          ? errorData.detail
          : JSON.stringify(errorData.detail);
    }
    throw new Error(message);
  }
};

export const fetchConnections = async (): Promise<OTAConnection[]> => {
  const response = await fetch(`${API_BASE_URL}/connections`);
  if (!response.ok) throw new Error("Failed to fetch connections");
  return response.json();
};

export const fetchRules = async (): Promise<RateRulesConfig> => {
  const response = await fetch(`${API_BASE_URL}/rules`);
  if (!response.ok) throw new Error("Failed to fetch rules");
  return response.json();
};

export const updateRules = async (
  rules: RateRulesConfig,
): Promise<RateRulesConfig> => {
  const response = await fetch(`${API_BASE_URL}/rules`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rules),
  });
  if (!response.ok) throw new Error("Failed to update rules");
  return response.json();
};

export const syncStrategy = async (): Promise<{
  success: boolean;
  message: string;
}> => {
  const response = await fetch(`${API_BASE_URL}/channels/sync/strategy`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to initiate strategy sync");
  return response.json();
};

export const fetchBookings = async (): Promise<Booking[]> => {
  const response = await fetch(`${API_BASE_URL}/bookings`);
  if (!response.ok) throw new Error("Failed to fetch bookings");
  return response.json();
};
export const createBulkBookings = async (
  bookings: Booking[],
): Promise<Booking[]> => {
  const response = await fetch(`${API_BASE_URL}/bookings/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bookings),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let message = "Failed to create bulk bookings";
    if (errorData.detail) {
      message =
        typeof errorData.detail === "string"
          ? errorData.detail
          : JSON.stringify(errorData.detail);
    }
    throw new Error(message);
  }
  return response.json();
};

export const createBooking = async (booking: Booking): Promise<Booking> => {
  const response = await fetch(`${API_BASE_URL}/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(booking),
  });
  if (!response.ok) throw new Error("Failed to create booking");
  return response.json();
};
export const updateBooking = async (booking: Booking): Promise<Booking> => {
  const response = await fetch(`${API_BASE_URL}/bookings/${booking.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(booking),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to update booking");
  }
  return response.json();
};

export const transferBooking = async (
  bookingId: string,
  transferData: {
    bookingId: string;
    newRoomTypeId: string;
    newRoomNumber: string;
    effectiveDate: string;
    keepRate: boolean;
    transferFolio: boolean;
  },
): Promise<Booking> => {
  const response = await fetch(
    `${API_BASE_URL}/bookings/${bookingId}/transfer`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transferData),
    },
  );
  if (!response.ok) throw new Error("Failed to transfer room");
  return response.json();
};

export const addFolioItem = async (
  bookingId: string,
  item: FolioItem,
): Promise<Booking> => {
  const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/folio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
  if (!response.ok) throw new Error("Failed to add folio item");
  return response.json();
};

export const lookupGuest = async (
  name?: string,
  phone?: string,
): Promise<any> => {
  const params = new URLSearchParams();
  if (name) params.append("name", name);
  if (phone) params.append("phone", phone);
  const response = await fetch(
    `${API_BASE_URL}/guest/lookup?${params.toString()}`,
  );
  if (!response.ok) return null;
  return response.json();
};

export const fetchGuestHistory = async (
  name: string,
  phone?: string,
  excludeBookingId?: string,
): Promise<Booking[]> => {
  const params = new URLSearchParams();
  params.append("name", name);
  if (phone) params.append("phone", phone);
  if (excludeBookingId) params.append("exclude_booking_id", excludeBookingId);
  const response = await fetch(
    `${API_BASE_URL}/guest/history?${params.toString()}`,
  );
  if (!response.ok) return [];
  return response.json();
};

// ========== NOTIFICATIONS API ==========

export const fetchNotifications = async (
  unreadOnly: boolean = false,
  typeFilter?: string,
  historyMode: boolean = false,
): Promise<Notification[]> => {
  const params = new URLSearchParams();
  if (unreadOnly) params.append("unread_only", "true");
  if (typeFilter) params.append("type_filter", typeFilter);
  if (historyMode) params.append("history_mode", "true");
  const response = await fetch(
    `${API_BASE_URL}/notifications?${params.toString()}`,
  );
  if (!response.ok) return [];
  return response.json();
};

export const fetchUnreadNotificationCount = async (): Promise<number> => {
  const response = await fetch(`${API_BASE_URL}/notifications/unread-count`);
  if (!response.ok) return 0;
  const data = await response.json();
  return data.count || 0;
};

export const markNotificationRead = async (
  notificationId: string,
): Promise<void> => {
  await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
    method: "PUT",
  });
};

export const markAllNotificationsRead = async (): Promise<void> => {
  await fetch(`${API_BASE_URL}/notifications/read-all`, {
    method: "PUT",
  });
};

export const dismissNotification = async (
  notificationId: string,
): Promise<void> => {
  await fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
    method: "DELETE",
  });
};

export const handleNotificationAction = async (
  notificationId: string,
  action: "yes" | "no",
): Promise<{ status: string; action: string }> => {
  const response = await fetch(
    `${API_BASE_URL}/notifications/${notificationId}/action?action=${action}`,
    {
      method: "POST",
    },
  );
  if (!response.ok) throw new Error("Failed to handle notification action");
  return response.json();
};

export const fetchRoomStatuses = async (): Promise<RoomStatus[]> => {
  const response = await fetch(`${API_BASE_URL}/room-status`);
  if (!response.ok) return [];
  return response.json();
};

export const updateRoomStatus = async (
  status: RoomStatus,
): Promise<RoomStatus> => {
  const response = await fetch(`${API_BASE_URL}/room-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(status),
  });
  if (!response.ok) throw new Error("Failed to update room status");
  return response.json();
};
