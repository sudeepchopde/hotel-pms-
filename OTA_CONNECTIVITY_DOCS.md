# Connectivity Technical Specifications for MakeMyTrip (MMT) Integration

This document outlines the technical implementation details for the 2-way XML connectivity between **Hotel Sathi PMS** and **MakeMyTrip (MMT)**.

## 1. Integration Scope

This integration supports a full 2-way synchronization:

- **ARI (Availability, Rates, Inventory):** PMS pushes real-time updates to MMT.
- **Bookings:** PMS receives real-time booking notifications (New/Modify/Cancel) from MMT via webhook.

## 2. API Protocol & Standards

We adhere to the **OpenTravel Alliance (OTA)** standards for all XML communications.

- **Protocol:** HTTPS (TLS 1.2+)
- **Format:** OTA XML (Version 2003/05)
- **Architecture:**
  - **Push:** PMS $\to$ MMT ARI API (RESTful POST)
  - **Pull/Push:** MMT $\to$ PMS Webhook (RESTful POST)

### Supported OTA Messages

| Message Type            | Description                             | Direction     |
| :---------------------- | :-------------------------------------- | :------------ |
| `OTA_HotelRatePlanRQ`   | Update Nightly Rates & Restrictions     | PMS $\to$ MMT |
| `OTA_HotelAvailNotifRQ` | Update Inventory Counts & Stop Sell     | PMS $\to$ MMT |
| `OTA_HotelResNotifRQ`   | Receive Bookings (Commit/Modify/Cancel) | MMT $\to$ PMS |

---

## 3. Connectivity Endpoints

### 3.1. Booking Notification Webhook (Inbound)

MMT should push booking XML payloads to this endpoint.

**Production URL:**

```
https://api.your-hotel-domain.com/api/channels/webhooks/mmt/booking
```

**Staging / Test URL:**

```
https://staging.your-hotel-domain.com/api/channels/webhooks/mmt/booking
```

> **Note:** Replace `api.your-hotel-domain.com` with your actual secure server domain.

### 3.2. ARI Push Endpoints (Outbound)

Our PMS pushes updates to the standard MMT ARI v2 endpoints:

- **Production:** `https://connect.makemytrip.com/ari/v2`
- **Sandbox:** `https://sandbox-connect.makemytrip.com/ari/v2`

---

## 4. Authentication & Security

### 4.1. Inbound Authentication (MMT $\to$ PMS)

We verify authorized requests from MMT using strict IP whitelisting and/or Basic Auth if required by your specific integration tier.

- **Preferred Method:** IP Whitelisting (Please provide MMT's outbound IP ranges).
- **Alternative:** HMAC Signature validation if supported.

### 4.2. Outbound Authentication (PMS $\to$ MMT)

We authenticate our pushes using the standard MMT HMAC-SHA256 signature mechanism.

- **Headers:**
  - `X-MMT-API-Key`: Provided by MMT
  - `X-MMT-Signature`: `HMAC-SHA256(api_secret, api_key + timestamp)`
  - `X-MMT-Timestamp`: ISO 8601 UTC
  - `X-MMT-Hotel-ID`: Hotel Code

### 4.3. Data Security

- **Encryption:** All data in transit is encrypted via TLS 1.2+.
- **Standard:** PCI-DSS compliant handling of guest data.

---

## 5. Implementation Details

### 5.1. Rate Updates (`OTA_HotelRatePlanRQ`)

Support for:

- Base Rate (Single/Double)
- Extra Adult / Extra Child Rates
- Rate Plans per Room Type

### 5.2. Availability Updates (`OTA_HotelAvailNotifRQ`)

Support for:

- Inventory Counts (Absolute)
- Stop Sell / Open Sell (Master/Arrival/Departure)
- Minimum/Maximum Length of Stay (MinLOS/MaxLOS)

### 5.3. Booking Handling (`OTA_HotelResNotifRQ`)

We process the standard OTA reservation structure:

- `UniqueID` (Reservation ID)
- `ResStatus` (Commit, Modify, Cancel)
- `RoomStay/Total` (Price & Currency)
- `Customer` (Guest Details)

---

## 6. Infrastructure Requirements

The PMS is hosted on a secure, private cloud infrastructure with:

- **Uptime:** 99.9%
- **SSL Certificate:** Valid trusted certificate (e.g., Let's Encrypt / DigiCert)
- **Static IP:** Available for whitelisting on MMT firewall.
