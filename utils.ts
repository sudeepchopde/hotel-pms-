export const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateString;
  }
};

export const formatTime = (timeString: string | undefined): string => {
  if (!timeString) return "";
  return timeString; // Currently just returns as is, can be enhanced if needed
};

import { UserResponse } from "./types";

export const hasPermission = (
  user: UserResponse | null,
  requiredAction: string,
): boolean => {
  if (!user) return false;
  if (user.role === "admin") return true;

  // Check for exact permission match
  if (user.allowed_sections && user.allowed_sections.includes(requiredAction)) {
    return true;
  }

  // Check for legacy Section-based access
  // e.g. if requiredAction is 'frontdesk:view', and user has 'frontdesk', allow it.
  const sectionName = requiredAction.split(":")[0];
  if (user.allowed_sections && user.allowed_sections.includes(sectionName)) {
    return true;
  }

  return false;
};
