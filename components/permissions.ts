export const PERMISSIONS = {
  FRONT_DESK: {
    VIEW: "frontdesk:view",
    CREATE_BOOKING: "frontdesk:create_booking",
    EDIT_BOOKING: "frontdesk:edit_booking",
    DELETE_BOOKING: "frontdesk:delete_booking",
    CHECK_IN: "frontdesk:check_in",
    CHECK_OUT: "frontdesk:check_out",
    PROCESS_REFUND: "frontdesk:process_refund",
  },
  DASHBOARD: {
    VIEW: "dashboard:view",
  },
  GUESTS: {
    VIEW: "guests:view",
    EDIT_GUEST: "guests:edit_guest",
    DELETE_GUEST: "guests:delete_guest",
  },
  KITCHEN: {
    VIEW: "kitchen:view",
    MANAGE_ORDERS: "kitchen:manage_orders",
  },
  HOUSEKEEPING: {
    VIEW: "housekeeping:view",
    UPDATE_STATUS: "housekeeping:update_status",
  },
  COMPLIANCE: {
    VIEW: "compliance:view",
    GENERATE_REPORTS: "compliance:generate_reports",
  },
  SECURITY: {
    VIEW: "security:view",
    MANAGE_ACCESS: "security:manage_access",
  },
  ANALYSIS: {
    VIEW: "analysis:view",
  },
  REPORTS: {
    VIEW: "reports:view",
    EXPORT: "reports:export",
  },
  SETTINGS: {
    VIEW: "settings:view",
    MANAGE_USERS: "settings:manage_users",
    MANAGE_RATES: "settings:manage_rates",
    MANAGE_INVENTORY: "settings:manage_inventory",
  },
};

export const PERMISSION_GROUPS = [
  {
    id: "frontdesk",
    label: "Front Desk",
    description: "Calendar, Bookings, and Daily Operations",
    actions: [
      { id: PERMISSIONS.FRONT_DESK.VIEW, label: "View Calendar & Bookings" },
      {
        id: PERMISSIONS.FRONT_DESK.CREATE_BOOKING,
        label: "Create New Bookings",
      },
      {
        id: PERMISSIONS.FRONT_DESK.EDIT_BOOKING,
        label: "Edit/Modify Bookings",
      },
      { id: PERMISSIONS.FRONT_DESK.CHECK_IN, label: "Check-In Guests" },
      { id: PERMISSIONS.FRONT_DESK.CHECK_OUT, label: "Check-Out & Invoice" },
      { id: PERMISSIONS.FRONT_DESK.PROCESS_REFUND, label: "Process Refunds" },
      {
        id: PERMISSIONS.FRONT_DESK.DELETE_BOOKING,
        label: "Delete Bookings (Critical)",
      },
    ],
  },
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Overview and Key Metrics",
    actions: [{ id: PERMISSIONS.DASHBOARD.VIEW, label: "View Dashboard" }],
  },
  {
    id: "guests",
    label: "Guest Management",
    description: "Guest Profiles and History",
    actions: [
      { id: PERMISSIONS.GUESTS.VIEW, label: "View Guest Profiles" },
      { id: PERMISSIONS.GUESTS.EDIT_GUEST, label: "Edit Guest Details" },
      { id: PERMISSIONS.GUESTS.DELETE_GUEST, label: "Delete Guest Profiles" },
    ],
  },
  {
    id: "kitchen",
    label: "Kitchen Order System",
    description: "KOTs and F&B Orders",
    actions: [
      { id: PERMISSIONS.KITCHEN.VIEW, label: "View Kitchen Display" },
      { id: PERMISSIONS.KITCHEN.MANAGE_ORDERS, label: "Update Order Status" },
    ],
  },
  {
    id: "housekeeping",
    label: "Housekeeping",
    description: "Room Status and Cleaning",
    actions: [
      { id: PERMISSIONS.HOUSEKEEPING.VIEW, label: "View Room Status" },
      {
        id: PERMISSIONS.HOUSEKEEPING.UPDATE_STATUS,
        label: "Update Cleaning Status",
      },
    ],
  },
  {
    id: "compliance",
    label: "Police Compliance",
    description: "Forms C/B and Reporting",
    actions: [
      { id: PERMISSIONS.COMPLIANCE.VIEW, label: "View Compliance Data" },
      {
        id: PERMISSIONS.COMPLIANCE.GENERATE_REPORTS,
        label: "Generate & Submit Reports",
      },
    ],
  },
  {
    id: "settings",
    label: "Settings & Admin",
    description: "System Configuration",
    actions: [
      { id: PERMISSIONS.SETTINGS.VIEW, label: "View Settings" },
      {
        id: PERMISSIONS.SETTINGS.MANAGE_RATES,
        label: "Manage Rates & Pricing",
      },
      {
        id: PERMISSIONS.SETTINGS.MANAGE_INVENTORY,
        label: "Manage Inventory & OTA",
      },
      {
        id: PERMISSIONS.SETTINGS.MANAGE_USERS,
        label: "Manage Users & Permissions",
      },
    ],
  },
];
