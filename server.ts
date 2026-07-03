/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Product, Order, AdminSettings } from "./src/types";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc,
  updateDoc
} from "firebase/firestore";

const app = express();
const PORT = 3000;

// Body parsing
app.use(express.json());

// Firebase configuration loading from firebase-applet-config.json
const CONFIG_FILE = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseAppConfig: any = null;
if (fs.existsSync(CONFIG_FILE)) {
  try {
    firebaseAppConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch (err) {
    console.error("Error reading firebase-applet-config.json:", err);
  }
}

const firebaseApp = initializeApp(firebaseAppConfig || {
  projectId: "smartsupply-ee2a9",
  appId: "1:710761655183:web:32c24f45984710febc39fa",
  apiKey: "AIzaSyDNcEW7nf3zd3_OTFidWpXBbNYcxoOJCbE",
  authDomain: "smartsupply-ee2a9.firebaseapp.com",
  storageBucket: "smartsupply-ee2a9.firebasestorage.app",
  messagingSenderId: "710761655183"
});

const dbId = firebaseAppConfig?.firestoreDatabaseId || "(default)";
const firestoreDb = getFirestore(firebaseApp, dbId);

// Database file paths
const DATA_DIR = path.join(process.cwd(), "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial default products
const DEFAULT_PRODUCTS: Product[] = [
  {
    id: "prod_1",
    name: "Smart 4-in-1 Wireless Charging Dock",
    description: "Fast wireless charger for smartphones, smartwatches, and wireless earbuds. Features elegant ambient LED indicator and temperature control safeguards.",
    price: 1499,
    image: "https://images.unsplash.com/photo-1622445262465-2481c4574875?w=500&auto=format&fit=crop&q=60",
    category: "electronics",
    status: "hot_sale"
  },
  {
    id: "prod_2",
    name: "Submersible Smart Water Bottle Dispenser",
    description: "USB rechargeable automatic drinking water pump. Fits standard 20L jars, features dynamic touch sensory dispensing button.",
    price: 699,
    image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60",
    category: "kitchen",
    status: "hot_sale"
  },
  {
    id: "prod_3",
    name: "Deep Bass Portable Bluetooth Speaker",
    description: "IPX7 waterproof wireless speaker with dual passive radiators, 15W sound blast output, and up to 12 hours of rich musical playback.",
    price: 2499,
    image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&auto=format&fit=crop&q=60",
    category: "electronics",
    status: "stock_in"
  },
  {
    id: "prod_4",
    name: "Ultra Precision Digital Kitchen Food Scale",
    description: "High-accuracy kitchen scale with touch buttons, easy tare function, tempered glass surface, and multiple unit convertor measurements (g, ml, lb, oz).",
    price: 899,
    image: "https://images.unsplash.com/photo-1574783756214-4058d414e21e?w=500&auto=format&fit=crop&q=60",
    category: "kitchen",
    status: "stock_in"
  },
  {
    id: "prod_5",
    name: "Noise Cancelling True Wireless Earbuds",
    description: "Active Noise Cancelling (ANC) stereo sound pods. Crystal-clear call technology, fast type-C charge, and dynamic base drivers.",
    price: 3999,
    image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&auto=format&fit=crop&q=60",
    category: "electronics",
    status: "hot_sale"
  },
  {
    id: "prod_6",
    name: "Smart Rechargeable Electric Garlic Chopper",
    description: "Compact wireless onion, pepper, and garlic mincer. Stainless steel sharp blades, one-key activation, 250ml capacity kitchen saver.",
    price: 499,
    image: "https://images.unsplash.com/photo-1506368249639-73a05d6f6488?w=500&auto=format&fit=crop&q=60",
    category: "kitchen",
    status: "hot_sale"
  },
  {
    id: "prod_7",
    name: "Full HD Portable Pocket Projector",
    description: "Micro led cinema projector with dual speakers. Supports 1080p, easily connects to smartphones and laptops for movie nights.",
    price: 7999,
    image: "https://images.unsplash.com/photo-1535016120720-40c646be5580?w=500&auto=format&fit=crop&q=60",
    category: "electronics",
    status: "stock_out"
  },
  {
    id: "prod_8",
    name: "Stir-Automate Hands-Free Pan Stirrer",
    description: "Self-rotating electric saucepan mixer with three-speed vibration gears. Stir soup, curry, and sauces completely hands-free.",
    price: 1299,
    image: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=500&auto=format&fit=crop&q=60",
    category: "kitchen",
    status: "stock_in"
  }
];

// Helper functions to load/save data from Firestore with local file backup/fallback
async function loadProducts(): Promise<Product[]> {
  try {
    const colRef = collection(firestoreDb, "products");
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) {
      console.log("[Firestore] Seeding default products to Firestore...");
      for (const prod of DEFAULT_PRODUCTS) {
        await setDoc(doc(firestoreDb, "products", prod.id), prod);
      }
      return DEFAULT_PRODUCTS;
    }
    const products: Product[] = [];
    snapshot.forEach((docSnap) => {
      products.push(docSnap.data() as Product);
    });
    // Sort products so newer IDs or custom order remains consistent
    return products.sort((a, b) => b.id.localeCompare(a.id));
  } catch (e) {
    console.error("[Firestore] Error loading products:", e);
    // Local fallback
    try {
      if (!fs.existsSync(PRODUCTS_FILE)) {
        fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(DEFAULT_PRODUCTS, null, 2));
        return DEFAULT_PRODUCTS;
      }
      const data = fs.readFileSync(PRODUCTS_FILE, "utf-8");
      return JSON.parse(data);
    } catch (err) {
      return DEFAULT_PRODUCTS;
    }
  }
}

async function saveProducts(products: Product[]) {
  try {
    // Delete existing products first to keep in sync
    const colRef = collection(firestoreDb, "products");
    const snapshot = await getDocs(colRef);
    for (const docSnap of snapshot.docs) {
      await deleteDoc(doc(firestoreDb, "products", docSnap.id));
    }
    // Save new products
    for (const prod of products) {
      await setDoc(doc(firestoreDb, "products", prod.id), prod);
    }
  } catch (e) {
    console.error("[Firestore] Error saving products:", e);
  }
  // Local backup
  try {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
  } catch (e) {}
}

async function loadOrders(): Promise<Order[]> {
  try {
    const colRef = collection(firestoreDb, "orders");
    const snapshot = await getDocs(colRef);
    const orders: Order[] = [];
    snapshot.forEach((docSnap) => {
      orders.push(docSnap.data() as Order);
    });
    // Sort by createdAt descending
    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (e) {
    console.error("[Firestore] Error loading orders:", e);
    // Local fallback
    try {
      if (!fs.existsSync(ORDERS_FILE)) {
        return [];
      }
      const data = fs.readFileSync(ORDERS_FILE, "utf-8");
      return JSON.parse(data);
    } catch (err) {
      return [];
    }
  }
}

async function saveOrders(orders: Order[]) {
  try {
    for (const order of orders) {
      await setDoc(doc(firestoreDb, "orders", order.id), order);
    }
  } catch (e) {
    console.error("[Firestore] Error saving orders:", e);
  }
  // Local backup
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
  } catch (e) {}
}

async function saveOrder(order: Order) {
  try {
    await setDoc(doc(firestoreDb, "orders", order.id), order);
  } catch (e) {
    console.error("[Firestore] Error saving order:", e);
  }
  // Sync backup list
  try {
    const orders = await loadOrders();
    const exists = orders.some(o => o.id === order.id);
    const updated = exists ? orders.map(o => o.id === order.id ? order : o) : [order, ...orders];
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(updated, null, 2));
  } catch (e) {}
}

async function loadSettings(): Promise<AdminSettings> {
  const defaultSettings: AdminSettings = {
    cloudinaryCloudName: "",
    cloudinaryPreset: "",
    emailNotificationsEnabled: true
  };
  try {
    const docRef = doc(firestoreDb, "settings", "admin_settings");
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      await setDoc(docRef, defaultSettings);
      return defaultSettings;
    }
    return docSnap.data() as AdminSettings;
  } catch (e) {
    console.error("[Firestore] Error loading settings:", e);
    // Local fallback
    try {
      if (!fs.existsSync(SETTINGS_FILE)) {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
        return defaultSettings;
      }
      const data = fs.readFileSync(SETTINGS_FILE, "utf-8");
      return JSON.parse(data);
    } catch (err) {
      return defaultSettings;
    }
  }
}

async function saveSettings(settings: AdminSettings) {
  try {
    await setDoc(doc(firestoreDb, "settings", "admin_settings"), settings);
  } catch (e) {
    console.error("[Firestore] Error saving settings:", e);
  }
  // Local backup
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (e) {}
}

// Order Notifications Real-time Stream
let clients: express.Response[] = [];

function notifyClientsOfNewOrder(order: Order) {
  const message = `data: ${JSON.stringify(order)}\n\n`;
  clients.forEach((client) => {
    client.write(message);
  });
}

// Mail simulation records
let emailLogs: Array<{ id: string; to: string; subject: string; body: string; date: string }> = [];

// Middleware to check Admin Password (ss2468)
const checkAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const adminKey = req.headers["x-admin-key"];
  if (adminKey === "ss2468") {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized: Invalid Admin Password" });
  }
};

// ---------------- API ROUTES ----------------

// 1. Products API
app.get("/api/products", async (req, res) => {
  res.json(await loadProducts());
});

app.post("/api/products", checkAdmin, async (req, res) => {
  const { name, description, price, image, category, status } = req.body;
  if (!name || !price || !category || !status) {
    return res.status(400).json({ error: "Missing required product fields" });
  }

  const products = await loadProducts();
  const newProduct: Product = {
    id: "prod_" + Date.now(),
    name,
    description: description || "",
    price: Number(price),
    image: image || "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=500&auto=format&fit=crop&q=60",
    category,
    status
  };

  products.unshift(newProduct);
  await saveProducts(products);
  res.status(201).json(newProduct);
});

app.put("/api/products/:id", checkAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, price, image, category, status } = req.body;

  const products = await loadProducts();
  const index = products.findIndex((p) => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Product not found" });
  }

  products[index] = {
    ...products[index],
    name: name !== undefined ? name : products[index].name,
    description: description !== undefined ? description : products[index].description,
    price: price !== undefined ? Number(price) : products[index].price,
    image: image !== undefined ? image : products[index].image,
    category: category !== undefined ? category : products[index].category,
    status: status !== undefined ? status : products[index].status
  };

  await saveProducts(products);
  res.json(products[index]);
});

app.delete("/api/products/:id", checkAdmin, async (req, res) => {
  const { id } = req.params;
  const products = await loadProducts();
  const filtered = products.filter((p) => p.id !== id);

  if (products.length === filtered.length) {
    return res.status(404).json({ error: "Product not found" });
  }

  await saveProducts(filtered);
  res.json({ success: true, message: "Product deleted successfully" });
});

app.post("/api/products/reset", checkAdmin, async (req, res) => {
  await saveProducts(DEFAULT_PRODUCTS);
  res.json({ success: true, message: "Products restored to defaults successfully", products: DEFAULT_PRODUCTS });
});

// 2. Checkout API
app.post("/api/checkout", async (req, res) => {
  const { items, name, phone, pincode, address, notes } = req.body;

  if (!items || !items.length || !name || !phone || !pincode || !address) {
    return res.status(400).json({ error: "Missing order details. items, name, phone, pincode, address are required." });
  }

  const orders = await loadOrders();
  const products = await loadProducts();

  // Validate items & calculate total
  let totalAmount = 0;
  const orderItems = items.map((item: any) => {
    const product = products.find((p) => p.id === item.productId);
    const price = product ? product.price : item.price || 0;
    const productName = product ? product.name : item.productName || "Unknown Item";
    totalAmount += price * item.quantity;
    return {
      productId: item.productId,
      productName,
      quantity: item.quantity,
      price
    };
  });

  // India Post Tracking Number Template (e.g., IN202612345IN)
  const randomNum = Math.floor(10000000 + Math.random() * 90000000);
  const trackingNumber = `IN${randomNum}IN`;

  const newOrder: Order = {
    id: "ord_" + Math.floor(1000 + Math.random() * 9000),
    items: orderItems,
    totalAmount,
    name,
    phone,
    pincode,
    address,
    trackingNumber,
    trackingStatus: "booked",
    createdAt: new Date().toISOString(),
    notes: notes || "",
    emailSent: true
  };

  orders.unshift(newOrder);
  await saveOrder(newOrder);

  // Trigger real-time notifications for active admin dashboards
  notifyClientsOfNewOrder(newOrder);

  // Trigger simulated email notification dispatch
  const emailBody = `
Dear SmartSupply Admin,

A new order has been placed on your website!

------------------------------------------
ORDER SUMMARY (Order ID: ${newOrder.id})
------------------------------------------
Date: ${new Date(newOrder.createdAt).toLocaleDateString()}
Total: ₹${newOrder.totalAmount.toLocaleString()}

CUSTOMER SHIPPING DETAILS:
Name: ${newOrder.name}
Phone: ${newOrder.phone}
Pincode: ${newOrder.pincode}
Address: ${newOrder.address}

ITEMS ORDERED:
${newOrder.items.map(item => `- ${item.productName} (Qty: ${item.quantity}) - Price: ₹${item.price}`).join("\n")}

INDIA POST TRACKING NUMBER:
${newOrder.trackingNumber}

PACKER INSTRUCTIONS:
Please generate the shipping label from the SmartSupply Admin Panel. This order supports printing in A4 layout (5 labels per sheet).

Regards,
SmartSupply Automated System
  `;

  // Log to in-memory simulated email box
  emailLogs.unshift({
    id: "mail_" + Date.now(),
    to: "smartsupply36@gmail.com",
    subject: `[New Order Alert] Order ID: ${newOrder.id} - ₹${newOrder.totalAmount}`,
    body: emailBody,
    date: new Date().toISOString()
  });

  console.log(`[Email Dispatch] Email dispatched to smartsupply36@gmail.com for Order ${newOrder.id}`);

  res.status(201).json({
    success: true,
    message: "Order placed successfully",
    order: newOrder
  });
});

// 3. Admin Orders API
app.get("/api/orders", checkAdmin, async (req, res) => {
  let orders = await loadOrders();
  const { startDate, endDate } = req.query;

  if (startDate) {
    const start = new Date(startDate as string);
    orders = orders.filter(o => new Date(o.createdAt) >= start);
  }
  if (endDate) {
    const end = new Date(endDate as string);
    // Add 23:59:59 to make end date inclusive
    end.setHours(23, 59, 59, 999);
    orders = orders.filter(o => new Date(o.createdAt) <= end);
  }

  res.json(orders);
});

// 4. Client Order Tracking API
app.get("/api/orders/:id", async (req, res) => {
  const { id } = req.params;
  const orders = await loadOrders();
  const order = orders.find((o) => o.id === id || o.trackingNumber === id);

  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  res.json(order);
});

// 5. Update Order / Tracking Details (Admin protected)
app.put("/api/orders/:id/tracking", checkAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, phone, pincode, address, notes, trackingNumber, trackingStatus } = req.body;

  const orders = await loadOrders();
  const index = orders.findIndex((o) => o.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Order not found" });
  }

  orders[index] = {
    ...orders[index],
    name: name !== undefined ? name : orders[index].name,
    phone: phone !== undefined ? phone : orders[index].phone,
    pincode: pincode !== undefined ? pincode : orders[index].pincode,
    address: address !== undefined ? address : orders[index].address,
    notes: notes !== undefined ? notes : orders[index].notes,
    trackingNumber: trackingNumber !== undefined ? trackingNumber : orders[index].trackingNumber,
    trackingStatus: trackingStatus !== undefined ? trackingStatus : orders[index].trackingStatus
  };

  await saveOrder(orders[index]);
  res.json(orders[index]);
});

// Delete Order from Admin Panel (No history retained)
app.delete("/api/orders/:id", checkAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await deleteDoc(doc(firestoreDb, "orders", id));
    
    // Sync backup list
    const orders = await loadOrders();
    const filtered = orders.filter(o => o.id !== id);
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(filtered, null, 2));

    res.json({ success: true, message: "Order removed successfully" });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete order" });
  }
});

// 6. Settings API
app.get("/api/settings", async (req, res) => {
  res.json(await loadSettings());
});

app.post("/api/settings", checkAdmin, async (req, res) => {
  const { cloudinaryCloudName, cloudinaryPreset, emailNotificationsEnabled } = req.body;
  const settings = await loadSettings();

  const newSettings = {
    cloudinaryCloudName: cloudinaryCloudName !== undefined ? cloudinaryCloudName : settings.cloudinaryCloudName,
    cloudinaryPreset: cloudinaryPreset !== undefined ? cloudinaryPreset : settings.cloudinaryPreset,
    emailNotificationsEnabled: emailNotificationsEnabled !== undefined ? emailNotificationsEnabled : settings.emailNotificationsEnabled
  };

  await saveSettings(newSettings);
  res.json(newSettings);
});

// 7. Simulated Emails logs for SmartSupply Admin
app.get("/api/admin/emails", checkAdmin, (req, res) => {
  res.json(emailLogs);
});

// 8. Server-Sent Events (SSE) stream for Real-time push notifications
app.get("/api/notifications/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  clients.push(res);

  // Send initial ping to establish connection
  res.write("data: { \"status\": \"connected\" }\n\n");

  req.on("close", () => {
    clients = clients.filter((client) => client !== res);
  });
});

// Alternate Long Polling/Short Polling endpoint for network failure robustness
let lastOrderTimes: { [clientId: string]: number } = {};
app.get("/api/notifications/poll", async (req, res) => {
  const { clientId, since } = req.query;
  const orders = await loadOrders();
  const querySince = since ? Number(since) : Date.now() - 30000; // default last 30 sec

  const newOrders = orders.filter(o => new Date(o.createdAt).getTime() > querySince);
  res.json({
    newOrders,
    timestamp: Date.now()
  });
});

// ------------- VITE DEVELOPMENT / PRODUCTION MIDDLEWARE -------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Serve with Vite in development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`SmartSupply running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
