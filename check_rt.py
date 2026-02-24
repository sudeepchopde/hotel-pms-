import requests
import json

BASE_URL = "http://localhost:8000/api"

def check_room_types():
    print("Checking room types from API...")
    try:
        response = requests.get(f"{BASE_URL}/room-types")
        if response.status_code == 200:
            data = response.json()
            for rt in data:
                print(f"Room Type: {rt.get('name')}")
                print(f"  basePrice: {rt.get('basePrice')}")
                print(f"  extraAdultRate: {rt.get('extraAdultRate')}")
                print(f"  extraChildRate: {rt.get('extraChildRate')}")
                print(f"  Full JSON: {json.dumps(rt)}")
                print("-" * 20)
        else:
            print(f"Error: {response.status_code}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_room_types()
