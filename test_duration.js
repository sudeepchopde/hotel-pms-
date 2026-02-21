const checkIn = "2026-02-20";
const checkOut = "2026-02-23";

const duration = Math.max(
  1,
  Math.ceil(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
      (1000 * 3600 * 24),
  ),
);

console.log("Duration:", duration);
