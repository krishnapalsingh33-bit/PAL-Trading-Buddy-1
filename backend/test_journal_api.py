import requests


URL = "http://127.0.0.1:8000/v2/journal"


response = requests.get(
    URL,
    params={
        "days": 30,
    },
    timeout=30,
)


print("=" * 60)
print("JOURNAL API TEST")
print("=" * 60)

print("Status:", response.status_code)

print("=" * 60)
print("RESPONSE")
print("=" * 60)

print(response.json())