# Email Parsing Setup Guide

Your PMS system is configured to receive and parse booking confirmation emails using the `/api/webhooks/inbound-email` endpoint.

## Recommended Service: Postmark (Inbound Webhooks)

This implementation uses the **Postmark Inbound Email** format. Follow these steps to set it up:

### 1. Sign Up for Postmark

- Create an account at [postmarkapp.com](https://postmarkapp.com/).
- Navigate to the **Servers** tab and add a new Server for your hotel.

### 2. Configure Inbound Stream

- Go to the **Settings** or **Domains** section of your new server.
- Add an **Inbound Stream** (or use the Default Inbound Stream).
- Set the **Receive Domains** to your domain (e.g., `hotelsatsangi.com` or a subdomain like `inbound.hotelsatsangi.com`).

### 3. Add MX Record (DNS)

- Postmark will provide you with an **MX Record** (e.g., `inbound.postmarkapp.com`) for your domain/subdomain.
- Log into your domain registrar (GoDaddy, Namecheap, etc.) or DNS provider.
- Add an **MX** record pointing to the Postmark inbound server.
  - If using a subdomain (`inbound.hotelsatsangi.com`), set the Host to `inbound` and Value to the MX address.
  - **Important:** If using your root domain (`hotelsatsangi.com`), replacing your MX record will break your regular email (Outlook/Gmail). Use a subdomain (like `inbound.hotelsatsangi.com`) or set up forwarding rules in your email provider to forward booking emails to a specific Postmark address (`<something>@inbound.postmarkapp.com`).

### 4. Configure Webhook URL (in Postmark)

- In the **Inbound Stream** settings in Postmark, find the **Webhook** section.
- Add your deployed API URL where Postmark should POST the email JSON.
  - **URL:** `https://your-deployment-url.vercel.app/api/webhooks/inbound-email` (Replace `your-deployment-url` with your actual Vercel domain).
  - Ensure the request format is set to **JSON**.

### 5. Final Step: Start Forwarding

- Once everything is set up, verify your domain in Postmark.
- Send a test email to `reservations@inbound.hotelsatsangi.com` (or whatever address you configured).
- Wait a few moments and check your PMS notifications or bookings to see if it was parsed.

## Alternative: Forwarding Rule (Recommended for existing email)

If you already use `reservations@hotelsatsangi.com` with Gmail/Outlook:

1. Set up a forwarding rule in your email provider.
2. Forward strictly booking emails (filter by subject line or sender) to your Postmark inbound address (e.g., `yourserverhash@inbound.postmarkapp.com`).
3. Postmark receives the forward, parses it to JSON, and POSTs it to your PMS webhook.

## Troubleshooting

- **Gemini API Key:** Ensure your `GEMINI_API_KEY` is set in Vercel environment variables or Property Settings, as the system uses Google Gemini AI to extract booking details from the raw email text.
