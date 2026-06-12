# 🥐 Frosted Dreams Bakery — Full Stack Web App

A professional 3-page bakery e-commerce website built with HTML/CSS/JS (frontend) and Python Flask (backend).

---

## Project Structure

```
BAKE/
├── static/                ← Static files folder
│   ├── css/               ← CSS folder
│   │   └── style.css      ← Full stylesheet for all pages
│   └── js/                ← JavaScript folder
│       ├── checkout.js    ← Checkout, payment & validation logic
│       └── main.js        ← Cart, filters, navbar & animations
├── templates/             ← HTML templates folder
│   ├── checkout.html      ← Checkout page
│   ├── index.html         ← Home / Landing page
│   └── products.html      ← Products & cart page
├── app.py                 ← Flask backend (Python)
├── bakery.db              ← SQLite database
├── Procfile               ← Render deployment start command
├── README.md              ← Project documentation
└── requirements.txt       ← Python dependencies
```

---

## Quick Start

### 1. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the server

```bash
python app.py
```

### 3. Open in browser

```
http://localhost:5000
```

---

## Features

### Frontend
- **Page 1 — Welcome:** Animated hero, floating bread icons, features strip, about section, testimonials
- **Page 2 — Products:** Filter tabs (All/Breads/Pastries/Cakes/Cookies/Drinks), product cards, slide-in cart sidebar with quantity controls
- **Page 3 — Checkout:** 4-step animated stepper (Cart Review → Address → Payment → Confirmation)
- **Payment options:** Google Pay (UPI), Other UPI, Credit/Debit Card, Cash on Delivery
- **Cart persistence:** Cart saved to `localStorage` across pages

### Backend (Flask)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Welcome page |
| GET | `/products` | Products page |
| GET | `/checkout` | Checkout page |
| POST | `/api/place-order` | Place a new order |
| GET | `/api/order/<id>` | Get order details + timeline |
| PATCH | `/api/order/<id>/status` | Update order status |
| GET | `/api/orders` | List all orders (admin) |
| GET | `/api/stats` | Revenue & order stats |
| GET | `/api/products` | Product catalogue (JSON) |

### Database (SQLite)
- **orders** table — stores all order data
- **order_timeline** table — tracks status changes per order

---

## API Examples

### Place Order
```bash
curl -X POST http://localhost:5000/api/place-order \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"name": "Butter Croissant", "price": 90, "qty": 2}],
    "address": {
      "name": "Priya Sharma", "phone": "9876543210",
      "email": "priya@email.com", "street": "12 Anna Nagar",
      "area": "RS Puram", "city": "Coimbatore",
      "state": "Tamil Nadu", "pin": "641002"
    },
    "payment": "gpay",
    "subtotal": 180,
    "delivery": 40,
    "total": 220
  }'
```

### Get Order
```bash
curl http://localhost:5000/api/order/LF-A3X9KW
```

### Update Status
```bash
curl -X PATCH http://localhost:5000/api/order/LF-A3X9KW/status \
  -H "Content-Type: application/json" \
  -d '{"status": "out_for_delivery", "note": "Driver assigned"}'
```

### View All Orders
```bash
curl http://localhost:5000/api/orders
curl http://localhost:5000/api/orders?status=received
```

---

## Order Status Flow
```
received → preparing → out_for_delivery → delivered
                    ↘ cancelled
```