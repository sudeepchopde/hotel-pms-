import React, { useEffect, useState } from "react";
import { Booking, PropertySettings } from "../types";
import { fetchPropertySettings, fetchBookings } from "../api";
import { FileBadge, Printer } from "lucide-react";

const GuestRegistrationForm: React.FC = () => {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [property, setProperty] = useState<PropertySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const bookingId = params.get("bookingId");

        const [settings, bookings] = await Promise.all([
          fetchPropertySettings(),
          fetchBookings(),
        ]);

        setProperty(settings);

        if (bookingId) {
          const found = bookings.find((b) => b.id === bookingId);
          if (found) setBooking(found);
        }
      } catch (err) {
        console.error("Failed to load form data", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <div className="p-10 text-center">Preparing form...</div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans p-8 print:p-0">
      {/* No-Print Header */}
      <div className="max-w-4xl mx-auto mb-8 flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileBadge className="w-6 h-6" /> Guest Registration Form
          </h1>
          <p className="text-slate-500">
            Print this form for the guest to fill out manually.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow hover:bg-indigo-700 transition flex items-center gap-2"
        >
          <Printer className="w-4 h-4" /> Print Form
        </button>
      </div>

      {/* Printable Area */}
      <div className="max-w-4xl mx-auto border-2 border-slate-900 p-8 print:border-0 print:w-full print:max-w-none">
        {/* Header */}
        <div className="text-center border-b-2 border-slate-200 pb-6 mb-8">
          <h2 className="text-3xl font-black uppercase tracking-tight mb-2">
            {property?.name || "HOTEL NAME"}
          </h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
            {property?.address || "Hotel Address"}
            <br />
            {property?.phone && `Ph: ${property.phone}`}{" "}
            {property?.email && `• ${property.email}`}
          </p>
          <div className="mt-4 inline-block px-4 py-1 border border-slate-300 rounded text-xs font-bold uppercase tracking-widest">
            Guest Registration Card
          </div>
        </div>

        {/* Pre-filled Office Use Section */}
        <div className="grid grid-cols-2 gap-8 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-200 print:bg-transparent print:border-slate-300">
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-600 block mb-1">
              Booking Conf.
            </label>
            <div className="font-mono font-bold text-lg">
              {booking?.id || "_________________"}
            </div>
          </div>
          <div className="flex gap-8">
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                Room No
              </label>
              <div className="font-mono font-bold text-lg">
                {booking?.roomNumber || "____"}
              </div>
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                Arrival
              </label>
              <div className="font-mono font-bold text-lg">
                {booking?.checkIn || "____/__/__"}
              </div>
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                Departure
              </label>
              <div className="font-mono font-bold text-lg">
                {booking?.checkOut || "____/__/__"}
              </div>
            </div>
          </div>
        </div>

        {/* Guest Input Fields - Designed for Handwriting */}
        <div className="space-y-8">
          {/* Section 1: Personal Details */}
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest border-l-4 border-indigo-500 pl-3 mb-6">
              Guest Personal Details
            </h3>
            <div className="grid grid-cols-1 gap-6">
              {/* Name Row */}
              <div className="flex items-end gap-4">
                <div className="w-32 shrink-0 pb-1 text-xs font-bold uppercase">
                  Full Name:
                </div>
                <div className="flex-1 border-b-2 border-slate-300 border-dashed h-8 relative">
                  <span className="absolute bottom-1 left-0 text-slate-300 text-xs italic pointer-events-none print:hidden">
                    (Write clearly in block letters)
                  </span>
                </div>
              </div>

              {/* Contact Row */}
              <div className="flex gap-8">
                <div className="flex-1 flex items-end gap-4">
                  <div className="w-32 shrink-0 pb-1 text-xs font-bold uppercase">
                    Mobile No:
                  </div>
                  <div className="flex-1 border-b-2 border-slate-300 border-dashed h-8"></div>
                </div>
                <div className="flex-1 flex items-end gap-4">
                  <div className="w-16 shrink-0 pb-1 text-xs font-bold uppercase">
                    Email:
                  </div>
                  <div className="flex-1 border-b-2 border-slate-300 border-dashed h-8"></div>
                </div>
              </div>

              {/* Address Row */}
              <div className="flex items-start gap-4">
                <div className="w-32 shrink-0 pt-4 text-xs font-bold uppercase">
                  Permanent
                  <br />
                  Address:
                </div>
                <div className="flex-1 space-y-6">
                  <div className="border-b-2 border-slate-300 border-dashed h-8"></div>
                  <div className="flex gap-4">
                    <div className="flex-1 border-b-2 border-slate-300 border-dashed h-8 relative">
                      <span className="absolute -bottom-4 left-0 text-[8px] text-slate-600 uppercase">
                        City
                      </span>
                    </div>
                    <div className="flex-1 border-b-2 border-slate-300 border-dashed h-8 relative">
                      <span className="absolute -bottom-4 left-0 text-[8px] text-slate-600 uppercase">
                        State
                      </span>
                    </div>
                    <div className="w-32 border-b-2 border-slate-300 border-dashed h-8 relative">
                      <span className="absolute -bottom-4 left-0 text-[8px] text-slate-600 uppercase">
                        Pin Code
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: ID & Compliance */}
          <div className="pt-4">
            <h3 className="text-sm font-black uppercase tracking-widest border-l-4 border-indigo-500 pl-3 mb-6">
              Identity Verification
            </h3>
            <div className="grid grid-cols-2 gap-12">
              <div className="space-y-6">
                <div className="flex items-end gap-4">
                  <div className="w-24 shrink-0 pb-1 text-xs font-bold uppercase">
                    ID Type:
                  </div>
                  <div className="flex-1 border-b-2 border-slate-300 border-dashed h-8 text-xs text-slate-400 pt-2 flex justify-between">
                    <span>□ Aadhar</span>
                    <span>□ Passport</span>
                    <span>□ Voter ID</span>
                  </div>
                </div>
                <div className="flex items-end gap-4">
                  <div className="w-24 shrink-0 pb-1 text-xs font-bold uppercase">
                    ID Number:
                  </div>
                  <div className="flex-1 border-b-2 border-slate-300 border-dashed h-8"></div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-end gap-4">
                  <div className="w-24 shrink-0 pb-1 text-xs font-bold uppercase">
                    Nationality:
                  </div>
                  <div className="flex-1 border-b-2 border-slate-300 border-dashed h-8"></div>
                </div>
                <div className="flex items-end gap-4">
                  <div className="w-24 shrink-0 pb-1 text-xs font-bold uppercase">
                    DOB:
                  </div>
                  <div className="flex-1 border-b-2 border-slate-300 border-dashed h-8 text-right text-xs text-slate-400">
                    DD / MM / YYYY
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Extra Info */}
          <div className="pt-4">
            <div className="grid grid-cols-3 gap-8">
              <div className="flex items-end gap-2">
                <div className="shrink-0 pb-1 text-xs font-bold uppercase">
                  Arrived From:
                </div>
                <div className="flex-1 border-b-2 border-slate-300 border-dashed h-8"></div>
              </div>
              <div className="flex items-end gap-2">
                <div className="shrink-0 pb-1 text-xs font-bold uppercase">
                  Next Dest:
                </div>
                <div className="flex-1 border-b-2 border-slate-300 border-dashed h-8"></div>
              </div>
              <div className="flex items-end gap-2">
                <div className="shrink-0 pb-1 text-xs font-bold uppercase">
                  Pax:
                </div>
                <div className="flex-1 border-b-2 border-slate-300 border-dashed h-8"></div>
              </div>
            </div>
          </div>

          {/* Section 4: Signature */}
          <div className="pt-12 mt-12 flex justify-between items-end">
            <div className="w-64 border-t-2 border-slate-900 pt-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest">
                Guest Signature
              </p>
            </div>

            <div className="text-right text-[10px] text-slate-500 max-w-xs">
              I agree to the terms and conditions and certify that the above
              information is true.
            </div>

            <div className="w-64 border-t-2 border-slate-900 pt-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest">
                Receptionist Signature
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center mt-8 print:hidden text-slate-400 text-sm">
        Tip: Print this form, have the guest fill it, then use "Scan Form" in
        the Profile to auto-import details.
      </div>
    </div>
  );
};

export default GuestRegistrationForm;
