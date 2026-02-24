import requests
import json

BASE_URL = "http://localhost:8000/api"

def check_room_types():
    response = requests.get(f"{BASE_URL}/room-types")
    data = response.json()
    for rt in data:
        if rt.get('name') == 'Double Bed Room':
            print(json.dumps(rt, indent=2))

if __name__ == "__main__":
    check_room_types()
