import requests

try:
    # 1. Create a dummy category
    print("Creating dummy category...")
    response = requests.post("https://marlet-ia.onrender.com/categorias", json={"nombre": "Categoria Dummy", "slug": "dummy"})
    if response.status_code != 200:
        print(f"Failed to create category: {response.text}")
        exit(1)
    
    cat_id = response.json()['id']
    print(f"Created category ID: {cat_id}")

    # 2. Delete the category
    print(f"Deleting category {cat_id}...")
    response = requests.delete(f"https://marlet-ia.onrender.com/categorias/{cat_id}")
    print(f"Delete status: {response.status_code}")
    print(f"Delete response: {response.text}")

    # 3. Check if it's gone from the list
    print("Checking list...")
    response = requests.get("https://marlet-ia.onrender.com/categorias")
    categories = response.json()
    found = any(c['id'] == cat_id for c in categories)
    
    if not found:
        print("SUCCESS: Category is not in the list.")
    else:
        print("FAILURE: Category is still in the list.")

except Exception as e:
    print(f"Error: {e}")
