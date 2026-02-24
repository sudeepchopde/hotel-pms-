import requests
import json

BASE_URL = "http://localhost:8000/api"
BOOKING_ID = "direct-1771942171589-0"

def fix_booking():
    print(f"Fetching booking {BOOKING_ID}...")
    # There is no direct GET /api/bookings/{id} in main.py, so we fetch all and find it
    response = requests.get(f"{BASE_URL}/bookings")
    bookings = response.json()
    booking = next((b for b in bookings if b['id'] == BOOKING_ID), None)
    
    if not booking:
        print("Booking not found.")
        return

    print(f"Current amount: {booking.get('amount')}")
    print(f"Current folio: {json.dumps(booking.get('folio'), indent=2)}")
    
    # Update amount to 2000 (800 + 200 extra) * 2 nights
    booking['amount'] = 2000
    
    print("Sending PUT request to update booking and regenerate folio...")
    update_res = requests.put(f"{BASE_URL}/bookings/{BOOKING_ID}", json=booking)
    
    if update_res.status_code == 200:
        updated_booking = update_res.json()
        print(f"Success! Updated amount: {updated_booking.get('amount')}")
        print(f"Updated folio: {json.dumps(updated_booking.get('folio'), indent=2)}")
    else:
        print(f"Failed to update booking: {update_res.status_code}")
        print(update_res.text)

if __name__ == "__main__":
    fix_booking()
