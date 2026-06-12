"""
Frosted Dreams — PYTHON BACKEND
Flask server with SQLite database
Routes: static pages, order placement, order lookup, admin
"""

import os
import json
import uuid
import sqlite3
import logging
from datetime import datetime
from functools import wraps

from flask import (
    Flask, request, jsonify,
    send_from_directory, render_template_string
)

# ─── APP CONFIG ─────────────────────────────────────────────────────────────
BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR   = os.path.join(BASE_DIR, "static")
DB_PATH      = os.path.join(BASE_DIR, "bakery.db")

app = Flask(
    __name__,
    template_folder=TEMPLATE_DIR,
    static_folder=STATIC_DIR,
    static_url_path="/static",
)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "lafarine-secret-2025")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)


# ─── DATABASE ────────────────────────────────────────────────────────────────
def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create tables if they don't exist."""
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS orders (
                id          TEXT PRIMARY KEY,
                created_at  TEXT NOT NULL,
                status      TEXT NOT NULL DEFAULT 'received',
                customer_name TEXT,
                customer_phone TEXT,
                customer_email TEXT,
                address     TEXT NOT NULL,
                items       TEXT NOT NULL,
                payment_method TEXT NOT NULL,
                subtotal    REAL NOT NULL,
                delivery    REAL NOT NULL DEFAULT 40,
                total       REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS order_timeline (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id    TEXT NOT NULL,
                status      TEXT NOT NULL,
                note        TEXT,
                updated_at  TEXT NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(id)
            );
        """)
    log.info("Database initialised at %s", DB_PATH)


# ─── HELPERS ─────────────────────────────────────────────────────────────────
def generate_order_id() -> str:
    """Return a short human-readable order ID like LF-A3X9KW."""
    return "LF-" + uuid.uuid4().hex[:6].upper()


def validate_order_payload(data: dict) -> list[str]:
    """Return a list of validation error messages (empty = valid)."""
    errors = []

    # Cart items
    items = data.get("items", [])
    if not items:
        errors.append("Cart is empty.")
    for item in items:
        if not item.get("name"):
            errors.append("Item name is missing.")
        if not isinstance(item.get("price"), (int, float)) or item["price"] <= 0:
            errors.append(f"Invalid price for item: {item.get('name', '?')}")
        if not isinstance(item.get("qty"), int) or item["qty"] <= 0:
            errors.append(f"Invalid quantity for item: {item.get('name', '?')}")

    # Address
    addr = data.get("address", {})
    required_addr = ["name", "phone", "street", "city", "state", "pin"]
    for field in required_addr:
        if not addr.get(field, "").strip():
            errors.append(f"Address field '{field}' is required.")

    # Payment
    valid_payments = {"gpay", "upi", "card", "cod"}
    if data.get("payment") not in valid_payments:
        errors.append(f"Invalid payment method: {data.get('payment')}")

    # Totals
    if not isinstance(data.get("total"), (int, float)) or data["total"] <= 0:
        errors.append("Invalid order total.")

    return errors


# ─── PAGE ROUTES ─────────────────────────────────────────────────────────────
@app.route("/")
def home():
    return send_from_directory(TEMPLATE_DIR, "index.html")


@app.route("/products")
@app.route("/products.html")
def products():
    return send_from_directory(TEMPLATE_DIR, "products.html")


@app.route("/checkout")
@app.route("/checkout.html")
def checkout():
    return send_from_directory(TEMPLATE_DIR, "checkout.html")


# Serve any template file directly (for development convenience)
@app.route("/<path:filename>")
def serve_template(filename):
    if filename.endswith(".html"):
        return send_from_directory(TEMPLATE_DIR, filename)
    return send_from_directory(BASE_DIR, filename)


# ─── API: PLACE ORDER ────────────────────────────────────────────────────────
@app.route("/api/place-order", methods=["POST"])
def place_order():
    try:
        data = request.get_json(force=True)
    except Exception:
        return jsonify({"success": False, "message": "Invalid JSON payload."}), 400

    errors = validate_order_payload(data)
    if errors:
        return jsonify({"success": False, "message": errors[0], "errors": errors}), 422

    order_id  = generate_order_id()
    now       = datetime.now().isoformat(timespec="seconds")
    addr      = data["address"]

    try:
        with get_db() as conn:
            conn.execute("""
                INSERT INTO orders
                    (id, created_at, status,
                     customer_name, customer_phone, customer_email,
                     address, items, payment_method,
                     subtotal, delivery, total)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                order_id, now, "received",
                addr.get("name", "").strip(),
                addr.get("phone", "").strip(),
                addr.get("email", "").strip(),
                json.dumps(addr),
                json.dumps(data["items"]),
                data["payment"],
                float(data.get("subtotal", 0)),
                float(data.get("delivery", 40)),
                float(data["total"]),
            ))
            conn.execute("""
                INSERT INTO order_timeline (order_id, status, note, updated_at)
                VALUES (?, ?, ?, ?)
            """, (order_id, "received", "Order placed successfully.", now))

        log.info("New order %s placed by %s — ₹%.0f via %s",
                 order_id, addr.get("name"), data["total"], data["payment"])

        return jsonify({
            "success":  True,
            "order_id": order_id,
            "message":  "Order placed successfully!",
            "estimated_delivery": "30–60 minutes",
        }), 201

    except sqlite3.Error as e:
        log.error("DB error placing order: %s", e)
        return jsonify({"success": False, "message": "Database error. Please try again."}), 500


# ─── API: GET ORDER STATUS ───────────────────────────────────────────────────
@app.route("/api/order/<order_id>", methods=["GET"])
def get_order(order_id):
    try:
        with get_db() as conn:
            row = conn.execute(
                "SELECT * FROM orders WHERE id = ?", (order_id,)
            ).fetchone()

            if not row:
                return jsonify({"success": False, "message": "Order not found."}), 404

            timeline = conn.execute(
                "SELECT status, note, updated_at FROM order_timeline WHERE order_id = ? ORDER BY id",
                (order_id,)
            ).fetchall()

        order = dict(row)
        order["items"]   = json.loads(order["items"])
        order["address"] = json.loads(order["address"])
        order["timeline"] = [dict(t) for t in timeline]

        return jsonify({"success": True, "order": order}), 200

    except sqlite3.Error as e:
        log.error("DB error fetching order %s: %s", order_id, e)
        return jsonify({"success": False, "message": "Database error."}), 500


# ─── API: UPDATE ORDER STATUS (Admin) ────────────────────────────────────────
VALID_STATUSES = {"received", "preparing", "out_for_delivery", "delivered", "cancelled"}

@app.route("/api/order/<order_id>/status", methods=["PATCH"])
def update_order_status(order_id):
    data   = request.get_json(force=True)
    status = data.get("status", "").strip()
    note   = data.get("note", "").strip()

    if status not in VALID_STATUSES:
        return jsonify({
            "success": False,
            "message": f"Invalid status. Choose from: {', '.join(VALID_STATUSES)}",
        }), 422

    now = datetime.now().isoformat(timespec="seconds")
    try:
        with get_db() as conn:
            result = conn.execute(
                "UPDATE orders SET status = ? WHERE id = ?", (status, order_id)
            )
            if result.rowcount == 0:
                return jsonify({"success": False, "message": "Order not found."}), 404

            conn.execute("""
                INSERT INTO order_timeline (order_id, status, note, updated_at)
                VALUES (?, ?, ?, ?)
            """, (order_id, status, note or f"Status updated to {status}.", now))

        log.info("Order %s status → %s", order_id, status)
        return jsonify({"success": True, "order_id": order_id, "status": status}), 200

    except sqlite3.Error as e:
        log.error("DB error updating order %s: %s", order_id, e)
        return jsonify({"success": False, "message": "Database error."}), 500


# ─── API: LIST ALL ORDERS (Admin dashboard) ──────────────────────────────────
@app.route("/api/orders", methods=["GET"])
def list_orders():
    status_filter = request.args.get("status")
    limit  = int(request.args.get("limit", 50))
    offset = int(request.args.get("offset", 0))

    query  = "SELECT * FROM orders"
    params: list = []

    if status_filter:
        query += " WHERE status = ?"
        params.append(status_filter)

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params += [limit, offset]

    try:
        with get_db() as conn:
            rows = conn.execute(query, params).fetchall()
            total_count = conn.execute(
                "SELECT COUNT(*) FROM orders" +
                (" WHERE status = ?" if status_filter else ""),
                ([status_filter] if status_filter else []),
            ).fetchone()[0]

        orders = []
        for row in rows:
            o = dict(row)
            o["items"]   = json.loads(o["items"])
            o["address"] = json.loads(o["address"])
            orders.append(o)

        return jsonify({
            "success": True,
            "orders":  orders,
            "total":   total_count,
            "limit":   limit,
            "offset":  offset,
        }), 200

    except sqlite3.Error as e:
        log.error("DB error listing orders: %s", e)
        return jsonify({"success": False, "message": "Database error."}), 500


# ─── API: REVENUE SUMMARY ────────────────────────────────────────────────────
@app.route("/api/stats", methods=["GET"])
def stats():
    try:
        with get_db() as conn:
            row = conn.execute("""
                SELECT
                    COUNT(*)                              AS total_orders,
                    COALESCE(SUM(total), 0)               AS total_revenue,
                    COALESCE(AVG(total), 0)               AS avg_order_value,
                    SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered,
                    SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled
                FROM orders
            """).fetchone()

        return jsonify({"success": True, "stats": dict(row)}), 200

    except sqlite3.Error as e:
        log.error("DB error fetching stats: %s", e)
        return jsonify({"success": False, "message": "Database error."}), 500


# ─── API: PRODUCTS (served from Python for dynamic use) ──────────────────────
PRODUCTS = [
    # Breads
    {"id": 1, "name": "Classic Sourdough",  "category": "bread",  "price": 180, "emoji": "🍞", "badge": "Bestseller",    "desc": "48-hour fermented loaf with crispy crust and chewy interior."},
    {"id": 2, "name": "French Baguette",    "category": "bread",  "price": 120, "emoji": "🥖", "badge": None,            "desc": "Traditional baguette — golden, crisp crust with a soft airy crumb."},
    {"id": 3, "name": "Multigrain Loaf",    "category": "bread",  "price": 160, "emoji": "🫓", "badge": None,            "desc": "Packed with seeds and whole grains. Nutritious and delicious."},
    # Pastries
    {"id": 4, "name": "Butter Croissant",   "category": "pastry", "price": 90,  "emoji": "🥐", "badge": "Chef's Pick",   "desc": "729 layers of pure French butter pastry. Flaky, golden perfection."},
    {"id": 5, "name": "Fruit Danish",       "category": "pastry", "price": 110, "emoji": "🥧", "badge": None,            "desc": "Seasonal fruits over cream cheese on a flaky pastry base."},
    {"id": 6, "name": "Glazed Doughnut",    "category": "pastry", "price": 70,  "emoji": "🍩", "badge": None,            "desc": "Classic ring doughnut with vanilla glaze."},
    # Cakes
    {"id": 7, "name": "Chocolate Fudge Cake","category": "cake",  "price": 650, "emoji": "🎂", "badge": "Popular",       "desc": "Rich Belgian chocolate layers with silky ganache frosting."},
    {"id": 8, "name": "Strawberry Shortcake","category": "cake",  "price": 550, "emoji": "🍰", "badge": None,            "desc": "Light vanilla sponge with fresh strawberries and whipped cream."},
    {"id": 9, "name": "Red Velvet Cupcakes","category": "cake",   "price": 280, "emoji": "🧁", "badge": None,            "desc": "Classic red velvet with smooth cream cheese frosting (pack of 4)."},
    # Cookies
    {"id":10, "name": "Choco Chip Cookies", "category": "cookie", "price": 200, "emoji": "🍪", "badge": "Bestseller",   "desc": "Crisp edges, chewy centres, loaded with chocolate chips (6 pcs)."},
    {"id":11, "name": "Blueberry Scones",   "category": "cookie", "price": 180, "emoji": "🫐", "badge": None,            "desc": "Tender, buttery scones with bursts of fresh blueberry (4 pcs)."},
    # Drinks
    {"id":12, "name": "Artisan Drip Coffee","category": "drink",  "price": 80,  "emoji": "☕", "badge": None,            "desc": "Single-origin beans, brewed fresh every hour."},
    {"id":13, "name": "Chai Latte",         "category": "drink",  "price": 90,  "emoji": "🍵", "badge": None,            "desc": "Spiced masala chai with steamed oat milk."},
]

@app.route("/api/products", methods=["GET"])
def get_products():
    category = request.args.get("category")
    if category:
        result = [p for p in PRODUCTS if p["category"] == category]
    else:
        result = PRODUCTS
    return jsonify({"success": True, "products": result, "count": len(result)}), 200


# ─── ERROR HANDLERS ──────────────────────────────────────────────────────────
@app.errorhandler(404)
def not_found(e):
    return jsonify({"success": False, "message": "Resource not found."}), 404


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"success": False, "message": "Method not allowed."}), 405


@app.errorhandler(500)
def internal_error(e):
    log.error("Internal server error: %s", e)
    return jsonify({"success": False, "message": "Internal server error."}), 500


# ─── ENTRY POINT ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    init_db()
    log.info("Starting La Farine Bakery server…")
    log.info("Open http://localhost:5000 in your browser")
    app.run(debug=True, host="0.0.0.0", port=5000)