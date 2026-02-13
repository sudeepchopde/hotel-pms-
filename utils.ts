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
