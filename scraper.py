import os
import json
import requests
from bs4 import BeautifulSoup
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

def scrape_prices():
    url = "https://www.ammancity.gov.jo/ar/market/prices.aspx"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        
        rows = soup.find_all('tr')
        scraped_data = {}
        
        for row in rows:
            cols = row.find_all(['td', 'th'])
            if len(cols) >= 4:
                name = cols[0].text.strip()
                try:
                    # Column 3 usually contains the "Predominant Price" (السعر الأغلب)
                    price = float(cols[3].text.strip())
                    scraped_data[name] = price
                except ValueError:
                    continue
        return scraped_data
    except Exception as e:
        print(f"Scraping error: {e}")
        return {}

def update_firebase(scraped_data):
    cred_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if cred_json:
        cred = credentials.Certificate(json.loads(cred_json))
    elif os.path.exists("serviceAccountKey.json"):
        cred = credentials.Certificate("serviceAccountKey.json")
    elif os.path.exists("serviceAccountKey.json.json"):
        cred = credentials.Certificate("serviceAccountKey.json.json")
    else:
        print("Error: Missing FIREBASE_SERVICE_ACCOUNT environment variable or serviceAccountKey.json file.")
        return

    firebase_admin.initialize_app(cred)
    db = firestore.client()

    # Mapping Amman Gov Arabic names to your Ardi database IDs
    crop_map = {
        "بندورة": ("tomato", "Tomato", "طماطم"),
        "بطاطا": ("potatoes", "Potatoes", "بطاطا"),
        "خيار": ("cucumber", "Cucumber", "خيار"),
        "بصل": ("onions", "Onions", "بصل"),
        "كوسا": ("squash", "Squash", "كوسا"),
        "باذنجان": ("eggplant", "Eggplant", "باذنجان"),
        "فلفل": ("pepper", "Pepper", "فلفل"),
        "زهرة": ("cauliflower", "Cauliflower", "قرنبيط"),
        "ملفوف": ("cabbage", "Cabbage", "ملفوف"),
        "جزر": ("carrots", "Carrots", "جزر"),
        "فاصوليا": ("beans", "Beans", "فاصوليا"),
        "بطيخ": ("watermelon", "Watermelon", "بطيخ"),
        "عنب": ("grapes", "Grapes", "عنب"),
        "تفاح": ("apples", "Apples", "تفاح"),
        "خوخ": ("peaches", "Peaches", "خوخ"),
        "مشمش": ("apricots", "Apricots", "مشمش"),
        "ليمون": ("citrus", "Citrus", "حمضيات"),
    }

    col_ref = db.collection("market_prices")
    
    for ar_name, price in scraped_data.items():
        for key, (doc_id, name_en, name_ar) in crop_map.items():
            if key in ar_name:
                doc_ref = col_ref.document(doc_id)
                doc_snap = doc_ref.get()
                
                history = doc_snap.to_dict().get("history", []) if doc_snap.exists else []
                history.append(price)
                if len(history) > 10: history = history[-10:] # Keep last 10 days for ARIMA
                
                trend = "up" if len(history) >= 2 and history[-1] > history[-2] else ("down" if len(history) >= 2 and history[-1] < history[-2] else "flat")

                doc_ref.set({ "nameEn": name_en, "nameAr": name_ar, "price": price, "history": history, "trend": trend, "lastUpdated": datetime.utcnow().isoformat() }, merge=True)
                print(f"Updated {name_en} with price {price} JOD")
                break

if __name__ == "__main__":
    prices = scrape_prices()
    if prices: update_firebase(prices)
    else: print("No prices found. Amman Gov website might be down.")