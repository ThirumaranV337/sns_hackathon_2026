from marketplace_products import seed_marketplace_products


if __name__ == "__main__":
    count = seed_marketplace_products()
    print(f"Seeded {count} synthetic CampusRent products into complaints.db.")
