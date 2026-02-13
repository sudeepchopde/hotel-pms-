import React, { useState, useMemo } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Printer,
  Search,
  User,
  Users,
  Globe,
  FileText,
  AlertCircle,
  Clock,
  CheckCircle2,
  ChevronRight,
  Filter,
  Download,
  History,
  XCircle,
  Plane,
} from "lucide-react";
import { Booking, SyncEvent, GuestDetails } from "../types";
import { formatDate } from "../utils";

interface ComplianceViewProps {
  syncEvents: SyncEvent[];
  setSyncEvents: React.Dispatch<React.SetStateAction<SyncEvent[]>>;
}

const ComplianceView: React.FC<ComplianceViewProps> = ({
  syncEvents,
  setSyncEvents,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "flagged" | "foreign">(
    "all",
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const allBookings = useMemo(() => {
    return syncEvents.filter((e) => e.type === "booking") as Booking[];
  }, [syncEvents]);

  const auditResults = useMemo(() => {
    const now = Date.now();
    const last24h = 24 * 60 * 60 * 1000;

    return allBookings.map((b) => {
      const isNew = now - b.timestamp < last24h;

      // Audit 1: Missing ID Scan
      // Only flag if guest is physically checked in and missing the scan image
      const missingID = b.status === "CheckedIn" && !b.guestDetails?.idImage;

      // Audit 2: Form C Compliance
      // Default to Indian if nationality is missing (matches UI default) to avoid false positives
      const nationality = b.guestDetails?.nationality || "Indian";
      const isForeigner = nationality.toLowerCase() !== "indian";

      // Enhanced Form C Check: Verify ALL mandatory fields, not just the flag
      const formCIncomplete =
        isForeigner &&
        (!b.guestDetails?.passportNumber ||
          !b.guestDetails?.passportExpiry ||
          !b.guestDetails?.visaNumber ||
          !b.guestDetails?.visaType ||
          !b.guestDetails?.arrivalPort ||
          !b.guestDetails?.arrivalDateIndia);

      // Note: Co-guest ID check removed - not required for compliance

      return {
        ...b,
        audit: {
          isNew,
          missingID,
          missingFormC: formCIncomplete,
          flagged: missingID || formCIncomplete,
        },
      };
    });
  }, [allBookings]);

  // The Master Guest Register (Flattened view of all guests)
  const masterRegister = useMemo(() => {
    const entries: {
      guestName: string;
      fatherOrHusbandName: string;
      nationality: string;
      idType: string;
      idNumber: string;
      room: string;
      type: "Primary" | "Co-Guest";
      bookingId: string;
      bookingDate: number;
      checkInDate: string;
      checkOutDate: string;
      status: string;
      isForeigner: boolean;
      address: string;
      arrivedFrom: string;
      purposeOfVisit: string;
      passport?: string;
    }[] = [];

    auditResults.forEach((b) => {
      // Add primary
      const pNat = b.guestDetails?.nationality || "Indian";
      const pAddr =
        [
          b.guestDetails?.address,
          b.guestDetails?.city,
          b.guestDetails?.state,
          b.guestDetails?.pinCode,
        ]
          .filter(Boolean)
          .join(", ") || "N/A";

      entries.push({
        guestName: b.guestName,
        fatherOrHusbandName: b.guestDetails?.fatherOrHusbandName || "-",
        nationality: pNat,
        idType: b.guestDetails?.idType || "Aadhar",
        idNumber: b.guestDetails?.idNumber || "PENDING",
        room: b.roomNumber || "TBD",
        type: "Primary",
        bookingId: b.id,
        bookingDate: b.timestamp,
        checkInDate: b.checkIn,
        checkOutDate: b.checkOut,
        status: b.status,
        isForeigner: pNat.toLowerCase() !== "indian",
        address: pAddr,
        arrivedFrom: b.guestDetails?.arrivedFrom || "-",
        purposeOfVisit: b.guestDetails?.purposeOfVisit || "Tourism",
        passport: b.guestDetails?.passportNumber,
      });

      // Add accessory
      b.accessoryGuests?.forEach((g) => {
        const gNat = g.nationality || "Indian";
        const gAddr =
          [g.address, g.city, g.state, g.pinCode].filter(Boolean).join(", ") ||
          "N/A";

        entries.push({
          guestName: g.name || "Unnamed",
          fatherOrHusbandName: g.fatherOrHusbandName || "-",
          nationality: gNat,
          idType: g.idType || "Aadhar",
          idNumber: g.idNumber || "PENDING",
          room: b.roomNumber || "TBD",
          type: "Co-Guest",
          bookingId: b.id,
          bookingDate: b.timestamp,
          checkInDate: b.checkIn,
          checkOutDate: b.checkOut,
          status: b.status,
          isForeigner: gNat.toLowerCase() !== "indian",
          address: gAddr,
          arrivedFrom: g.arrivedFrom || "-",
          purposeOfVisit: g.purposeOfVisit || "Tourism",
          passport: g.passportNumber,
        });
      });
    });

    return entries
      .filter((e) => {
        const matchSearch =
          e.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.room.includes(searchQuery);
        if (!matchSearch) return false;

        if (startDate && e.checkInDate < startDate) return false;
        if (endDate && e.checkInDate > endDate) return false;

        if (filterType === "foreign") return e.isForeigner;
        if (filterType === "flagged") return e.idNumber === "PENDING";
        return true;
      })
      .sort((a, b) => b.checkInDate.localeCompare(a.checkInDate));
  }, [auditResults, searchQuery, filterType, startDate, endDate]);

  const flaggedBookings = auditResults.filter(
    (b) => b.audit.flagged && b.audit.isNew,
  );

  const mtdStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let total = 0;
    let foreign = 0;

    allBookings.forEach((b) => {
      const isArrived = ["CheckedIn", "CheckedOut"].includes(b.status);
      if (!isArrived) return;

      const checkInDate = new Date(b.checkIn);
      if (
        checkInDate.getMonth() === currentMonth &&
        checkInDate.getFullYear() === currentYear
      ) {
        total++;
        const nat = b.guestDetails?.nationality || "Indian";
        if (nat.toLowerCase() !== "indian") foreign++;
      }
    });

    const percentage = total > 0 ? (foreign / total) * 100 : 0;
    return { total, foreign, percentage };
  }, [allBookings]);

  const handlePrintRegistry = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print the registry");
      return;
    }

    const dateRangeLabel =
      startDate || endDate
        ? `Period: ${startDate || "Start"} to ${endDate || "End"}`
        : "All Time";

    const htmlContent = `
         <html>
         <head>
            <title>Guest Register - Police Compliance</title>
            <style>
               body { font-family: sans-serif; font-size: 10px; padding: 20px; }
               table { width: 100%; border-collapse: collapse; margin-top: 20px; }
               th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
               th { background-color: #f0f0f0; font-weight: bold; }
               h2 { text-align: center; margin-bottom: 5px; }
               .meta { text-align: center; margin-bottom: 20px; font-size: 12px; color: #555; }
               tr:nth-child(even) { background-color: #f9f9f9; }
            </style>
         </head>
         <body>
            <h2>Guest Register</h2>
            <div class="meta">
               Generated on: ${new Date().toLocaleString()}<br>
               ${dateRangeLabel}<br>
               Total Entries: ${masterRegister.length}
            </div>
            <table>
               <thead>
                  <tr>
                     <th>S.No</th>
                     <th>Guest Name / Parent Name</th>
                     <th>Details</th>
                     <th>Address</th>
                     <th>Arrival</th>
                     <th>ID Proof</th>
                     <th>Room</th>
                     <th>Check-In</th>
                     <th>Check-Out</th>
                  </tr>
               </thead>
               <tbody>
                  ${masterRegister
                    .map(
                      (e, i) => `
                     <tr>
                        <td>${i + 1}</td>
                        <td>
                           <strong>${e.guestName}</strong><br/>
                           <span style="color: #666; font-size: 9px">F/H: ${e.fatherOrHusbandName}</span>
                        </td>
                        <td>
                           ${e.nationality}<br/>
                           ${e.type}
                        </td>
                        <td style="max-width: 150px; word-wrap: break-word;">${e.address}</td>
                        <td>
                           From: ${e.arrivedFrom}<br/>
                           Purp: ${e.purposeOfVisit}
                        </td>
                        <td>
                           ${e.idType}<br/>
                           <strong>${e.idNumber}</strong>
                        </td>
                        <td>${e.room}</td>
                        <td>${formatDate(e.checkInDate)}</td>
                        <td>${e.checkOutDate !== "-" ? formatDate(e.checkOutDate) : "Active"}</td>
                     </tr>
                  `,
                    )
                    .join("")}
               </tbody>
            </table>
            <script>
               window.onload = function() { window.print(); }
            </script>
         </body>
         </html>
      `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleExportFormCBatch = () => {
    // 1. Gather all foreign guests (primary + accessory) that match the filters
    const formCEntries: any[] = [];

    auditResults.forEach((b) => {
      // Check date filter
      if (startDate && b.checkIn < startDate) return;
      if (endDate && b.checkIn > endDate) return;

      // Primary Guest
      const pNat = b.guestDetails?.nationality || "Indian";
      if (pNat.toLowerCase() !== "indian") {
        formCEntries.push({
          type: "Primary",
          bookingId: b.id,
          name: b.guestName,
          nationality: pNat,
          ...b.guestDetails, // Spread all details
          checkIn: b.checkIn,
          checkOut: b.checkOut,
          room: b.roomNumber,
        });
      }

      // Accessory Guests
      b.accessoryGuests?.forEach((g) => {
        const gNat = g.nationality || "Indian";
        if (gNat.toLowerCase() !== "indian") {
          formCEntries.push({
            type: "Co-Guest",
            bookingId: b.id,
            name: g.name,
            nationality: gNat,
            ...g,
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            room: b.roomNumber,
          });
        }
      });
    });

    if (formCEntries.length === 0) {
      alert(
        "No foreign guests found in the selected period for Form C export.",
      );
      return;
    }

    // 2. Generate CSV
    const headers = [
      "Guest Name",
      "Gender",
      "Nationality",
      "Passport Number",
      "Passport Place of Issue",
      "Passport Issue Date",
      "Passport Expiry Date",
      "Visa Number",
      "Visa Type",
      "Visa Place of Issue",
      "Visa Issue Date",
      "Visa Expiry Date",
      "Arrived From",
      "Arrival Date India",
      "Arrival Port",
      "Next Destination",
      "Address in India",
      "City",
      "State",
      "Pin Code",
      "Phone",
      "Email",
      "Purpose of Visit",
      "Room Number",
      "Check-In Date",
      "Check-Out Date",
    ];

    const csvRows = [headers.join(",")];

    formCEntries.forEach((e) => {
      const row = [
        `"${e.name || ""}"`,
        `"${e.gender || ""}"`,
        `"${e.nationality || ""}"`,
        `"${e.passportNumber || ""}"`,
        `"${e.passportPlaceIssue || ""}"`,
        `"${e.passportIssueDate || ""}"`,
        `"${e.passportExpiry || ""}"`,
        `"${e.visaNumber || ""}"`,
        `"${e.visaType || ""}"`,
        `"${e.visaPlaceIssue || ""}"`,
        `"${e.visaIssueDate || ""}"`,
        `"${e.visaExpiry || ""}"`,
        `"${e.arrivedFrom || ""}"`,
        `"${e.arrivalDateIndia || ""}"`,
        `"${e.arrivalPort || ""}"`,
        `"${e.nextDestination || ""}"`,
        `"${e.address || ""}"`,
        `"${e.city || ""}"`,
        `"${e.state || ""}"`,
        `"${e.pinCode || ""}"`,
        `"${e.phoneNumber || ""}"`,
        `"${e.email || ""}"`,
        `"${e.purposeOfVisit || ""}"`,
        `"${e.room || ""}"`,
        `"${formatDate(e.checkIn) || ""}"`,
        `"${formatDate(e.checkOut) || ""}"`,
      ];
      csvRows.push(row.join(","));
    });

    // 3. Download
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Form_C_Batch_Export_${startDate || "All"}_to_${endDate || "All"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-emerald-600" />
            Police Compliance Center
          </h2>
          <p className="text-slate-500 mt-1 font-medium">
            Automated Form C processing and Master Guest Register audit.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handlePrintRegistry}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" /> Print Registry
          </button>
          <button
            onClick={handleExportFormCBatch}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-xs rounded-xl transition-all shadow-lg shadow-indigo-600/20"
          >
            <Download className="w-4 h-4" /> Export Form C Batch
          </button>
        </div>
      </header>

      {/* Compliance Audit Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" /> Master Guest
                  Register
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  Unified view of all occupants (Primary & Accessory)
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    From
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 outline-none w-24"
                  />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    To
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 outline-none w-24"
                  />
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Register..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
                  />
                </div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
                >
                  <option value="all">All Guests</option>
                  <option value="flagged">Missing ID</option>
                  <option value="foreign">Foreigners</option>
                </select>
              </div>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead className="bg-slate-50/50 sticky top-0 z-10">
                  <tr>
                    <th className="p-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      S.No
                    </th>
                    <th className="p-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      Guest Name / F/H Name
                    </th>
                    <th className="p-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      Address
                    </th>
                    <th className="p-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      Arrived From
                    </th>
                    <th className="p-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      Purpose
                    </th>
                    <th className="p-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      ID Proof
                    </th>
                    <th className="p-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      Room
                    </th>
                    <th className="p-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      Check-In
                    </th>
                    <th className="p-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      Check-Out
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {masterRegister.map((e, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-slate-50/30 transition-colors"
                    >
                      <td className="p-3">
                        <span className="text-[10px] font-black text-slate-400 tabular-nums">
                          {idx + 1}
                        </span>
                      </td>
                      <td className="p-3">
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {e.guestName}
                          </p>
                          <p className="text-[8px] font-bold text-slate-400">
                            F/H: {e.fatherOrHusbandName}
                          </p>
                          <p className="text-[7px] font-black uppercase text-slate-300">
                            {e.type} • {e.nationality}
                          </p>
                        </div>
                      </td>
                      <td className="p-3">
                        <p
                          className="text-[9px] font-bold text-slate-600 max-w-[150px] truncate"
                          title={e.address}
                        >
                          {e.address}
                        </p>
                      </td>
                      <td className="p-3">
                        <span className="text-[9px] font-bold text-slate-600">
                          {e.arrivedFrom}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-[9px] font-bold text-slate-600">
                          {e.purposeOfVisit}
                        </span>
                      </td>
                      <td className="p-3">
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase">
                            {e.idType}
                          </p>
                          <span
                            className={`text-[9px] font-bold ${e.idNumber === "PENDING" ? "text-red-500" : "text-slate-700"}`}
                          >
                            {e.idNumber}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">
                          #{e.room}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-[9px] font-bold text-slate-500 tabular-nums">
                          {["CheckedIn", "CheckedOut"].includes(e.status)
                            ? formatDate(e.checkInDate)
                            : "-"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-[9px] font-bold text-slate-500 tabular-nums">
                          {e.status === "CheckedOut"
                            ? formatDate(e.checkOutDate)
                            : "-"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Compliance Audit Section */}
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <ShieldAlert className="w-32 h-32" />
            </div>
            <h3 className="text-lg font-black tracking-tight uppercase mb-6 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" /> Compliance
              Audit (24h)
            </h3>

            <div className="space-y-4">
              {flaggedBookings.length > 0 ? (
                flaggedBookings.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3 hover:bg-white/10 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold">{b.guestName}</p>
                        <p className="text-[9px] text-slate-400 uppercase font-black">
                          Room {b.roomNumber || "Unassigned"} • {b.source}
                        </p>
                      </div>
                      <span className="text-[8px] px-1.5 py-0.5 bg-red-500 text-white rounded font-black uppercase">
                        Critical
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {b.audit.missingID && (
                        <div className="flex items-center gap-1.5 text-[8px] font-black uppercase text-red-400 bg-red-400/10 px-2 py-1 rounded border border-red-400/20">
                          <XCircle className="w-3 h-3" /> Missing ID Scan
                        </div>
                      )}
                      {b.audit.missingFormC && (
                        <div className="flex items-center gap-1.5 text-[8px] font-black uppercase text-amber-400 bg-amber-400/10 px-2 py-1 rounded border border-amber-400/20">
                          <Globe className="w-3 h-3" /> Form C Data Incomplete
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
                  <p className="text-sm font-bold">Audit Clean</p>
                  <p className="text-[10px] uppercase font-black mt-1">
                    All new arrivals compliant
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[2rem] p-6 space-y-6">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <History className="w-4 h-4" /> Reporting Stats
            </h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">
                  Total Foreign Arrivals (MTD)
                </span>
                <span className="text-sm font-black text-slate-800">
                  {mtdStats.foreign}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5">
                <div
                  className="bg-indigo-600 h-1.5 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${mtdStats.percentage}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-slate-400 text-right">
                {mtdStats.percentage.toFixed(1)}% of total arrivals
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplianceView;
