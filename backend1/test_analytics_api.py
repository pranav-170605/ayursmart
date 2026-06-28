from app import app
import json

client = app.test_client()
with client.session_transaction() as sess:
    sess['is_admin'] = True

print("--- Testing /api/admin/stats ---")
res = client.get('/api/admin/stats')
print(json.dumps(res.get_json(), indent=2))

print("\n--- Testing /api/admin/appointments-chart ---")
res = client.get('/api/admin/appointments-chart')
data = res.get_json()
print(f"Labels count: {len(data['labels'])}")
print(f"Sample: {data['labels'][:5]}")

print("\n--- Testing /api/admin/patients-chart ---")
res = client.get('/api/admin/patients-chart')
data = res.get_json()
print(f"Labels count: {len(data['labels'])}")
print(f"Sample: {data['labels'][:5]}")
