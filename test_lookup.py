
import requests
import json

base_url = "https://hotel-pms-delta.vercel.app/api" # User's Vercel URL from previous summary

def check_lookup(phone):
    print(f"Checking lookup for: {phone}")
    resp = requests.get(f"{base_url}/guest/lookup?phone={phone}")
    print(f"Status: {resp.status_code}")
    print(f"Data: {json.dumps(resp.json(), indent=2)}")

if __name__ == "__main__":
    check_lookup("5555555")
    check_lookup("7777777")
