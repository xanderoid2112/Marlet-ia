import requests

try:
    # 1. Delete product 50
    print("Deleting product 50...")
    response = requests.delete("https://marlet-ia.onrender.com/productos/50")
    print(f"Delete status: {response.status_code}")
    print(f"Delete response: {response.text}")

    # 2. Check if it's gone from the list
    print("Checking list...")
    response = requests.get("https://marlet-ia.onrender.com/productos")
    products = response.json().get("productos", [])
    found = any(p['id'] == 50 for p in products)
    
    if not found:
        print("SUCCESS: Product 50 is not in the list.")
    else:
        print("FAILURE: Product 50 is still in the list.")

except Exception as e:
    print(f"Error: {e}")
