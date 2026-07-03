/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Product, Order, AdminSettings, OrderItem } from "./types";
import ProductCatalog from "./components/ProductCatalog";
import {
  playNotificationChime,
  sendPushNotification,
  injectBrandFavicon,
  formatDate,
  formatToDateString
} from "./utils";
import {
  ShoppingBag,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  X,
  Lock,
  Settings,
  ClipboardList,
  Truck,
  Printer,
  Clock,
  ArrowLeft,
  Mail,
  Upload,
  Volume2,
  Bell,
  Sparkles,
  Filter,
  Calendar,
  CheckCircle2,
  Package,
  Search,
  Check,
  AlertCircle,
  Eye,
  Info,
  Edit
} from "lucide-react";

export default function App() {
  // Navigation & Screen views
  const [view, setView] = useState<"shop" | "tracking" | "admin">("shop");
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Cart State
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Checkout State
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutName, setCheckoutName] = useState("");
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [checkoutPincode, setCheckoutPincode] = useState("");
  const [checkoutAddress, setCheckoutAddress] = useState("");
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [lastPlacedOrder, setLastPlacedOrder] = useState<Order | null>(null);

  // Tracking Search
  const [trackingQuery, setTrackingQuery] = useState("");
  const [trackingResult, setTrackingResult] = useState<Order | null>(null);
  const [trackingError, setTrackingError] = useState("");
  const [trackingLoading, setTrackingLoading] = useState(false);

  // Admin Panel Auth
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState("");

  // Admin orders filter dates
  const [adminStartDate, setAdminStartDate] = useState("");
  const [adminEndDate, setAdminEndDate] = useState("");
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // New Admin Control Filter and Edit States
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<"all" | "booked" | "dispatched" | "in_transit" | "delivered">("all");
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Admin product edit states
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Cloudinary credentials & settings
  const [settings, setSettings] = useState<AdminSettings>({
    cloudinaryCloudName: "xgkuinaj",
    cloudinaryPreset: "",
    cloudinaryApiKey: "914875423422865",
    cloudinaryApiSecret: "8xODTzAoAH_h3cUG-A76_oPdmeE",
    emailNotificationsEnabled: true,
    notificationEmail: "dm8115589@gmail.com",
    smtpUser: "dm8115589@gmail.com",
    smtpPass: "zfqm cqdl obwu jsew"
  });

  // Simulated Admin Email inbox logs
  const [adminEmails, setAdminEmails] = useState<any[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<any | null>(null);

  // Real-time updates status
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [sseConnected, setSseConnected] = useState(false);

  // A4 Page Print selection
  const [selectedPrintOrders, setSelectedPrintOrders] = useState<string[]>([]);
  const [isPrintLayoutOpen, setIsPrintLayoutOpen] = useState(false);
  const [printOrientation, setPrintOrientation] = useState<"portrait" | "landscape">("portrait");

  // General Notification Banner
  const [appBanner, setAppBanner] = useState<{ message: string; type: "success" | "info" } | null>(null);

  // Audio interaction trigger helper
  const [audioPromptDismissed, setAudioPromptDismissed] = useState(false);

  // Load Initial Data
  useEffect(() => {
    fetchProducts();
    fetchSettings();
    injectBrandFavicon();

    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }

    // Set default dates for order filtering (last 30 days)
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    setAdminStartDate(formatToDateString(start));
    setAdminEndDate(formatToDateString(end));

    // Cart loading from localStorage
    const savedCart = localStorage.getItem("smartsupply_cart");
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Sync cart to localStorage
  useEffect(() => {
    localStorage.setItem("smartsupply_cart", JSON.stringify(cart));
  }, [cart]);

  // Real-time Event Stream (SSE) listener
  useEffect(() => {
    const sseUrl = "/api/notifications/stream";
    const eventSource = new EventSource(sseUrl);

    eventSource.onopen = () => {
      setSseConnected(true);
    };

    eventSource.onerror = () => {
      setSseConnected(false);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status === "connected") return;

        // Play chime immediately!
        playNotificationChime();

        // Browser push alert
        sendPushNotification(
          "🚨 New SmartSupply Order!",
          `Order ${data.id} placed by ${data.name} for ₹${data.totalAmount.toLocaleString()}`
        );

        // Notify user in UI
        showBanner(`🎉 New Order received! Order ID: ${data.id}`, "success");

        // Refresh orders if authenticated admin is viewing
        if (isAdminAuthenticated) {
          fetchAdminOrders();
          fetchAdminEmails();
        }
      } catch (e) {
        console.error("SSE parse error:", e);
      }
    };

    // Robust alternate background polling fallback for development environment reload
    const pollInterval = setInterval(() => {
      fetch("/api/notifications/poll?since=" + (Date.now() - 12000))
        .then((res) => res.json())
        .then((data) => {
          if (data.newOrders && data.newOrders.length > 0) {
            // Check if we already received SSE to prevent duplicate audio chime
            const localLoggedOrderIds = JSON.parse(localStorage.getItem("logged_order_ids") || "[]");
            let containsNew = false;
            
            data.newOrders.forEach((o: Order) => {
              if (!localLoggedOrderIds.includes(o.id)) {
                localLoggedOrderIds.push(o.id);
                containsNew = true;
              }
            });

            if (containsNew) {
              localStorage.setItem("logged_order_ids", JSON.stringify(localLoggedOrderIds));
              playNotificationChime();
              showBanner(`🎉 Fresh order arrived!`, "success");
              if (isAdminAuthenticated) {
                fetchAdminOrders();
                fetchAdminEmails();
              }
            }
          }
        })
        .catch(() => {});
    }, 10000);

    return () => {
      eventSource.close();
      clearInterval(pollInterval);
    };
  }, [isAdminAuthenticated, adminStartDate, adminEndDate]);

  // Fetch functions
  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch("/api/products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAdminOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch(`/api/orders?startDate=${adminStartDate}&endDate=${adminEndDate}`, {
        headers: { "x-admin-key": "ss2468" }
      });
      if (res.ok) {
        const data = await res.json();
        setAdminOrders(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchAdminEmails = async () => {
    try {
      const res = await fetch("/api/admin/emails", {
        headers: { "x-admin-key": "ss2468" }
      });
      if (res.ok) {
        const data = await res.json();
        setAdminEmails(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Banner feedback
  const showBanner = (message: string, type: "success" | "info" = "success") => {
    setAppBanner({ message, type });
    setTimeout(() => {
      setAppBanner(null);
    }, 5000);
  };

  // Cart operations
  const addToCart = (product: Product) => {
    if (product.status === "stock_out") return;

    // Play visual feedback/vibration
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { productId: product.id, productName: product.name, quantity: 1, price: product.price }];
    });
    showBanner(`Added ${product.name} to smart bag!`, "success");
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.productId === productId) {
            const nextQty = item.quantity + delta;
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const cartItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const getProductCartCount = (productId: string) => {
    const found = cart.find((item) => item.productId === productId);
    return found ? found.quantity : 0;
  };

  // Direct base64 browser image upload (Zero config needed, works everywhere)
  const handleDirectBase64Upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > 2 * 1024 * 1024) { // Limit to 2MB for Firestore/storage efficiency
      alert("Please upload an image smaller than 2MB.");
      return;
    }

    setIsUploadingImage(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditingProduct((prev) => ({ ...prev, image: reader.result as string }));
      setIsUploadingImage(false);
      showBanner("Image uploaded directly via browser!", "success");
    };
    reader.onerror = () => {
      alert("Failed to read image file.");
      setIsUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  // Secure Server-side Image Upload using pre-configured Cloudinary (No Preset Needed)
  const handleServerCloudinaryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > 8 * 1024 * 1024) { // Limit to 8MB
      alert("Please upload an image smaller than 8MB.");
      return;
    }

    setIsUploadingImage(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64data = reader.result as string;
        const res = await fetch("/api/upload-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ file: base64data }),
        });

        if (res.ok) {
          const data = await res.json();
          setEditingProduct((prev) => ({ ...prev, image: data.secure_url }));
          showBanner("Image uploaded successfully via Secure Cloudinary API!", "success");
        } else {
          const errData = await res.json();
          alert(`Server Upload error: ${errData.error || "Failed to upload"}`);
        }
      } catch (err) {
        alert("Failed to connect to server upload API.");
      } finally {
        setIsUploadingImage(false);
      }
    };
    reader.onerror = () => {
      alert("Failed to read image file.");
      setIsUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  // Image Upload Handler using Cloudinary Client Integration or link input
  const handleCloudinaryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!settings.cloudinaryCloudName || !settings.cloudinaryPreset) {
      alert("Please configure Cloudinary credentials (Cloud Name & Preset) in settings tab below first!");
      return;
    }

    setIsUploadingImage(true);
    const formData = new FormData();
    formData.append("file", files[0]);
    formData.append("upload_preset", settings.cloudinaryPreset);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${settings.cloudinaryCloudName}/image/upload`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setEditingProduct((prev) => ({ ...prev, image: data.secure_url }));
        showBanner("Image uploaded successfully to Cloudinary!", "success");
      } else {
        const errData = await res.json();
        alert(`Cloudinary error: ${errData.error?.message || "Check credentials configuration"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to connect to Cloudinary API. Check your internet connection.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Checkout submission
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutName || !checkoutPhone || !checkoutPincode || !checkoutAddress) {
      alert("Please fill all required shipping fields!");
      return;
    }

    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart,
          name: checkoutName,
          phone: checkoutPhone,
          pincode: checkoutPincode,
          address: checkoutAddress,
          notes: checkoutNotes
        })
      });

      if (res.ok) {
        const data = await res.json();
        setLastPlacedOrder(data.order);
        setCart([]); // Clear cart
        setIsCheckingOut(false);
        setIsCartOpen(false);
        showBanner("Order placed successfully! Check email notifications.", "success");
      } else {
        const err = await res.json();
        alert(err.error || "Checkout failed");
      }
    } catch (e) {
      console.error(e);
      alert("Network error occurred during checkout");
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Search/Track order from India Post format
  const handleTrackOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingQuery.trim()) return;

    setTrackingLoading(true);
    setTrackingError("");
    setTrackingResult(null);

    try {
      const res = await fetch(`/api/orders/${trackingQuery.trim()}`);
      if (res.ok) {
        const data = await res.json();
        setTrackingResult(data);
      } else {
        setTrackingError("No order or tracking details found for this input.");
      }
    } catch (er) {
      setTrackingError("Error fetching tracking database.");
    } finally {
      setTrackingLoading(false);
    }
  };

  // Authenticate Admin
  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === "ss2468") {
      setIsAdminAuthenticated(true);
      setAdminAuthError("");
      fetchAdminOrders();
      fetchAdminEmails();
      showBanner("Logged into SmartSupply Admin Console", "success");
    } else {
      setAdminAuthError("Invalid credentials. Enter authorized system key.");
    }
  };

  // Admin Product save (Add or Update)
  const saveProductConfig = async () => {
    if (!editingProduct?.name || !editingProduct?.price || !editingProduct?.category || !editingProduct?.status) {
      alert("Fill in name, price, category and stock status!");
      return;
    }

    const isEditing = !!editingProduct.id;
    const url = isEditing ? `/api/products/${editingProduct.id}` : "/api/products";
    const method = isEditing ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": "ss2468"
        },
        body: JSON.stringify(editingProduct)
      });

      if (res.ok) {
        showBanner(isEditing ? "Product updated!" : "New product created!", "success");
        setIsProductModalOpen(false);
        setEditingProduct(null);
        fetchProducts(); // reload
      } else {
        alert("Failed to save product details.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete product
  const deleteProductConfig = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
        headers: { "x-admin-key": "ss2468" }
      });

      if (res.ok) {
        showBanner("Product deleted successfully", "success");
        fetchProducts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Admin update order tracking status
  const updateOrderTrackingStatus = async (orderId: string, status: "booked" | "dispatched" | "in_transit" | "delivered") => {
    try {
      const res = await fetch(`/api/orders/${orderId}/tracking`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": "ss2468"
        },
        body: JSON.stringify({ trackingStatus: status })
      });

      if (res.ok) {
        showBanner("Order tracking state updated!", "success");
        fetchAdminOrders();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete order immediately (No history retained)
  const deleteOrderConfig = async (id: string) => {
    if (!confirm("Remove this order? This action is immediate and cannot be undone (No history retained).")) return;

    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "DELETE",
        headers: { "x-admin-key": "ss2468" }
      });

      if (res.ok) {
        showBanner("Order removed successfully", "success");
        fetchAdminOrders();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Full admin control order edit save
  const saveOrderEdits = async () => {
    if (!editingOrder) return;
    try {
      const res = await fetch(`/api/orders/${editingOrder.id}/tracking`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": "ss2468"
        },
        body: JSON.stringify(editingOrder)
      });
      if (res.ok) {
        showBanner(`Order ${editingOrder.id} has been fully modified!`, "success");
        setEditingOrder(null);
        fetchAdminOrders();
      } else {
        alert("Failed to save order updates.");
      }
    } catch (e) {
      console.error(e);
      alert("Error connection saving order updates.");
    }
  };

  // Restore Default Products
  const resetProductsToDefaults = async () => {
    if (!confirm("Are you sure you want to RESET all products to original store defaults? Your custom items will be cleared.")) return;
    try {
      const res = await fetch("/api/products/reset", {
        method: "POST",
        headers: { "x-admin-key": "ss2468" }
      });
      if (res.ok) {
        showBanner("Successfully restored products to default list!", "success");
        fetchProducts();
      } else {
        alert("Failed to reset products list.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Quick inline stock status changer
  const quickUpdateProductStatus = async (productId: string, status: "stock_in" | "stock_out" | "hot_sale") => {
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": "ss2468"
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        showBanner("Product stock state updated!", "success");
        fetchProducts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Quick inline price modifier
  const quickUpdateProductPrice = async (productId: string, newPrice: number) => {
    if (isNaN(newPrice) || newPrice <= 0) return;
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": "ss2468"
        },
        body: JSON.stringify({ price: newPrice })
      });
      if (res.ok) {
        showBanner("Product price modified!", "success");
        fetchProducts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Admin settings update
  const saveSettingsConfig = async () => {
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": "ss2468"
        },
        body: JSON.stringify(settings)
      });

      if (res.ok) {
        showBanner("System settings saved successfully", "success");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Request HTML5 Notifications
  const requestNotificationPermission = () => {
    if (!("Notification" in window)) {
      alert("This browser does not support desktop push notifications.");
      return;
    }
    Notification.requestPermission().then((permission) => {
      setNotificationPermission(permission);
      if (permission === "granted") {
        sendPushNotification("🔔 Notifications Enabled!", "You will receive real-time order notifications on this device.");
        playNotificationChime();
      }
    });
  };

  // Toggle order in printing queue
  const togglePrintOrder = (orderId: string) => {
    setSelectedPrintOrders((prev) => {
      if (prev.includes(orderId)) {
        return prev.filter((id) => id !== orderId);
      } else {
        return [...prev, orderId];
      }
    });
  };

  // Print a single order instantly
  const printSingleOrder = (orderId: string) => {
    setSelectedPrintOrders([orderId]);
    setIsPrintLayoutOpen(true);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Client-side filteredAdminOrders computation for admin dashboard controls
  const filteredAdminOrders = adminOrders.filter((order) => {
    const matchesStatus = orderStatusFilter === "all" || order.trackingStatus === orderStatusFilter;
    const q = orderSearchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      order.id.toLowerCase().includes(q) ||
      order.name.toLowerCase().includes(q) ||
      order.phone.toLowerCase().includes(q) ||
      order.pincode.toLowerCase().includes(q) ||
      order.address.toLowerCase().includes(q) ||
      (order.trackingNumber && order.trackingNumber.toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
  });

  // From Address constants
  const FROM_ADDRESS = {
    name: "Muhammed Muksith",
    address: "Vazhengal (H), Palliyalthodi, Near AMLP School, Kulukkallur P. O.",
    cityState: "Palakkad District, Kerala - 679337",
    phone: "+91 9539364862"
  };

  return (
    <div className="min-h-screen bg-brand-dark font-sans text-gray-100 flex flex-col justify-between selection:bg-brand-neon selection:text-brand-dark">
      
      {/* Real-time Order Alert Top Notification Banner */}
      {appBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 animate-bounce no-print">
          <div className="bg-brand-neon text-brand-dark font-bold py-3 px-4 rounded-xl shadow-[0_0_20px_rgba(204,255,0,0.6)] border-2 border-white flex items-center gap-3">
            <Bell className="w-5 h-5 text-brand-dark animate-swing shrink-0" />
            <div className="text-xs">{appBanner.message}</div>
          </div>
        </div>
      )}

      {/* HTML Audio Interaction Consent Popover */}
      {!audioPromptDismissed && (
        <div className="bg-brand-purple/95 border-b border-brand-neon/40 text-brand-neon-light py-2 px-4 text-center text-xs flex justify-center items-center gap-2 z-40 no-print">
          <Volume2 className="w-4 h-4 text-brand-neon animate-pulse shrink-0" />
          <span>Enable real-time sound chimes for incoming checkout orders:</span>
          <button
            onClick={() => {
              setAudioPromptDismissed(true);
              playNotificationChime(); // plays dynamic sound
            }}
            className="bg-brand-neon text-brand-dark font-black px-3 py-1 rounded hover:bg-brand-neon-light transition text-[10px]"
          >
            ACTIVATE SOUND 🔊
          </button>
        </div>
      )}

      {/* Main E-commerce Shop Wrapper */}
      <div className="flex-1 flex flex-col">
        
        {/* Navigation Bar */}
        <nav className="bg-brand-purple-dark/80 backdrop-blur-md sticky top-0 z-30 border-b border-brand-border/60 no-print">
          <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
            
            {/* Logo / Title */}
            <div
              onClick={() => setView("shop")}
              className="flex items-center gap-2 cursor-pointer group active:scale-95 transition-transform"
            >
              <div className="w-10 h-10 bg-gradient-to-tr from-brand-purple to-brand-purple-light rounded-xl flex items-center justify-center border border-brand-neon shadow-[0_0_15px_rgba(124,58,237,0.4)]">
                <span className="text-brand-neon font-display font-extrabold text-2xl group-hover:scale-110 transition-transform">S</span>
              </div>
              <div>
                <span className="font-display font-black text-xl tracking-tight text-white block">
                  smart<span className="text-brand-neon">supply</span>
                </span>
                <span className="text-[9px] uppercase tracking-widest text-brand-neon-light block font-mono">
                  Smart Tech & Kitchen
                </span>
              </div>
            </div>

            {/* Menu Nav Links */}
            <div className="flex items-center gap-3">
              <button
                id="nav-shop"
                onClick={() => setView("shop")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${
                  view === "shop"
                    ? "text-brand-neon border border-brand-neon/35 bg-brand-purple/40"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                Shop
              </button>

              <button
                id="nav-tracking"
                onClick={() => setView("tracking")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${
                  view === "tracking"
                    ? "text-brand-neon border border-brand-neon/35 bg-brand-purple/40"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                Track
              </button>

              <button
                id="nav-admin"
                onClick={() => setView("admin")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${
                  view === "admin"
                    ? "text-brand-neon border border-brand-neon/35 bg-brand-purple/40"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                Admin
              </button>

              {/* Cart Bubble Button */}
              <button
                id="btn-open-cart"
                onClick={() => setIsCartOpen(true)}
                className="relative bg-brand-neon text-brand-dark p-2.5 rounded-xl hover:bg-brand-neon-light transition duration-200 active:scale-95 shadow-[0_0_12px_rgba(204,255,0,0.3)] flex items-center justify-center"
              >
                <ShoppingCart className="w-5 h-5 text-brand-dark" />
                {cartItemsCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white font-extrabold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-brand-dark animate-pulse">
                    {cartItemsCount}
                  </span>
                )}
              </button>
            </div>

          </div>
        </nav>

        {/* --- CLIENT SHOP VIEW --- */}
        {view === "shop" && (
          <div className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full space-y-8 no-print">
            
            {/* Banner / Hero Section */}
            <div className="relative bg-brand-card/70 border border-brand-border/80 rounded-2xl overflow-hidden p-6 md:p-10 flex flex-col md:flex-row items-center gap-6 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
              {/* Neon Ambient Background */}
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-brand-purple-light opacity-10 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-brand-neon opacity-5 rounded-full blur-3xl"></div>

              <div className="flex-1 space-y-4 text-center md:text-left">
                <span className="inline-flex items-center gap-1 bg-brand-purple border border-brand-purple-glow text-brand-neon text-[10px] uppercase tracking-widest font-extrabold px-2.5 py-1 rounded-full">
                  <Sparkles className="w-3 h-3 text-brand-neon" /> Kerala's Premium Hub
                </span>
                <h1 className="font-display font-extrabold text-3xl md:text-5xl text-white tracking-tight leading-none">
                  Futuristic Electronics & <span className="text-brand-neon">Smart Kitchen</span> Gadgets
                </h1>
                <p className="text-gray-400 text-sm max-w-lg leading-relaxed">
                  Enhance your daily productivity and culinary workflow with cutting-edge tech. Secure payments, Indian Post tracking, and seamless live updates.
                </p>
                
                {/* Push Notification Toggle Promo */}
                <div className="pt-2 flex flex-wrap justify-center md:justify-start gap-3">
                  <button
                    onClick={requestNotificationPermission}
                    className="flex items-center gap-2 bg-brand-dark hover:bg-brand-dark/80 border border-brand-neon/40 text-brand-neon-light text-xs font-bold px-4 py-2 rounded-xl transition"
                  >
                    <Bell className="w-4 h-4 text-brand-neon" />
                    {notificationPermission === "granted" ? "Notifications Active" : "Allow Updates"}
                  </button>
                  <button
                    onClick={() => setView("tracking")}
                    className="flex items-center gap-2 bg-brand-purple/40 hover:bg-brand-purple/60 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
                  >
                    <Truck className="w-4 h-4 text-brand-purple-glow" /> Track India Post Package
                  </button>
                </div>
              </div>

              {/* Decorative Banner Image Slider (Interactive) */}
              <div className="w-full md:w-80 h-48 relative rounded-xl overflow-hidden bg-black/40 border border-brand-border flex items-center justify-center shrink-0">
                <div className="absolute inset-0 bg-gradient-to-t from-brand-dark to-transparent z-10"></div>
                <img
                  src="https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=500&auto=format&fit=crop&q=60"
                  alt="Feature banner"
                  className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute bottom-3 left-3 z-20 text-left">
                  <span className="bg-brand-neon text-brand-dark text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider">NEW LAUNCH</span>
                  <p className="text-white text-xs font-bold mt-1">Smart Ambient LED docks are now restocked!</p>
                </div>
              </div>
            </div>

            {/* Hot Sale Carousel Strip */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
                <h2 className="font-display font-extrabold text-xl text-white uppercase tracking-wider">🔥 Hot Selling Now</h2>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin">
                {products.filter(p => p.status === "hot_sale").map(p => (
                  <div
                    key={"hot-" + p.id}
                    onClick={() => {
                      const el = document.getElementById(`product-card-${p.id}`);
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                        el.classList.add("ring-2", "ring-brand-neon");
                        setTimeout(() => el.classList.remove("ring-2", "ring-brand-neon"), 2000);
                      }
                    }}
                    className="snap-start w-56 bg-brand-card/90 hover:bg-brand-card border border-brand-border hover:border-brand-purple-glow rounded-xl p-3 shrink-0 cursor-pointer transition-all hover:scale-[1.02] flex items-center gap-3"
                  >
                    <img src={p.image} className="w-12 h-12 rounded-lg object-cover shrink-0" alt="" />
                    <div className="overflow-hidden">
                      <h4 className="text-white font-bold text-xs truncate">{p.name}</h4>
                      <p className="text-brand-neon font-mono text-xs font-extrabold mt-1">₹{p.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Product Catalog Display */}
            {loadingProducts ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-3">
                <div className="w-10 h-10 border-4 border-brand-purple border-t-brand-neon rounded-full animate-spin"></div>
                <p className="text-gray-400 text-xs">Accessing SmartSupply dynamic database...</p>
              </div>
            ) : (
              <ProductCatalog
                products={products}
                addToCart={addToCart}
                cartCount={getProductCartCount}
              />
            )}
            
          </div>
        )}

        {/* --- CUSTOMER ORDER TRACKING VIEW --- */}
        {view === "tracking" && (
          <div className="flex-1 max-w-md mx-auto px-4 py-12 w-full space-y-6 no-print">
            <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-brand-purple opacity-20 rounded-full blur-2xl"></div>

              <div className="text-center space-y-2 mb-6">
                <div className="w-12 h-12 bg-brand-neon/10 rounded-full flex items-center justify-center mx-auto text-brand-neon border border-brand-neon/30">
                  <Truck className="w-6 h-6 text-brand-neon" />
                </div>
                <h2 className="font-display font-extrabold text-2xl text-white">Track India Post Parcel</h2>
                <p className="text-gray-400 text-xs">Enter your 4-digit Order ID or 12-character India Post Tracking Code</p>
              </div>

              {/* Track form */}
              <form onSubmit={handleTrackOrder} className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. ord_8471 or IN34918204IN"
                    value={trackingQuery}
                    onChange={(e) => setTrackingQuery(e.target.value)}
                    className="w-full bg-brand-dark/90 border border-brand-border rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-neon placeholder:text-gray-600 font-mono tracking-wider"
                  />
                </div>
                <button
                  type="submit"
                  disabled={trackingLoading}
                  className="w-full bg-brand-neon text-brand-dark font-extrabold uppercase py-3 rounded-xl hover:bg-brand-neon-light transition font-mono text-sm tracking-widest disabled:opacity-50"
                >
                  {trackingLoading ? "Retrieving Dispatch..." : "LOCATE CONSIGNMENT 🔎"}
                </button>
              </form>

              {trackingError && (
                <div className="mt-4 p-3 bg-red-950/40 border border-red-900 rounded-lg text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{trackingError}</span>
                </div>
              )}

              {/* Tracking Results Output */}
              {trackingResult && (
                <div className="mt-6 border-t border-brand-border/60 pt-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] text-gray-500 font-mono uppercase">CONSIGNMENT ID</span>
                      <p className="text-white font-extrabold text-sm font-mono tracking-wider">{trackingResult.trackingNumber || "N/A"}</p>
                    </div>
                    <span className="bg-brand-purple text-brand-neon text-[10px] font-bold px-2.5 py-1 rounded">
                      Order ID: {trackingResult.id}
                    </span>
                  </div>

                  {/* Custom progress visual status bar */}
                  <div className="space-y-4">
                    <span className="text-[10px] text-gray-500 font-mono uppercase block">SHIPPING STATUS (INDIA POST)</span>
                    
                    <div className="relative flex justify-between items-center">
                      <div className="absolute left-0 right-0 h-1 bg-brand-border top-1/2 -translate-y-1/2 z-0"></div>
                      <div
                        className="absolute left-0 h-1 bg-brand-neon top-1/2 -translate-y-1/2 z-0 transition-all duration-500"
                        style={{
                          width: 
                            trackingResult.trackingStatus === "booked" ? "0%" :
                            trackingResult.trackingStatus === "dispatched" ? "33%" :
                            trackingResult.trackingStatus === "in_transit" ? "66%" : "100%"
                        }}
                      ></div>

                      {/* Steps */}
                      {[
                        { key: "booked", label: "Booked" },
                        { key: "dispatched", label: "Dispatched" },
                        { key: "in_transit", label: "In Transit" },
                        { key: "delivered", label: "Delivered" }
                      ].map((step, idx) => {
                        const statusWeights = { booked: 1, dispatched: 2, in_transit: 3, delivered: 4 };
                        const currentWeight = statusWeights[trackingResult.trackingStatus || "booked"];
                        const isDone = (idx + 1) <= currentWeight;

                        return (
                          <div key={step.key} className="relative z-10 flex flex-col items-center">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                isDone ? "bg-brand-neon text-brand-dark" : "bg-brand-dark border border-brand-border text-gray-500"
                              }`}
                            >
                              {idx + 1}
                            </div>
                            <span className="text-[9px] font-bold mt-1 text-gray-400 font-mono">{step.label}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="bg-brand-dark/90 p-3 rounded-lg border border-brand-border space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Recipient:</span>
                        <span className="text-gray-300 font-semibold">{trackingResult.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Destination Pincode:</span>
                        <span className="text-gray-300 font-mono font-bold">{trackingResult.pincode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Delivery Address:</span>
                        <span className="text-gray-300 truncate max-w-[200px]">{trackingResult.address}</span>
                      </div>
                      <div className="flex justify-between border-t border-brand-border/40 pt-1 mt-1 font-bold">
                        <span className="text-gray-500">Amount Paid:</span>
                        <span className="text-brand-neon">₹{trackingResult.totalAmount.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="text-center">
                      <span className="text-[10px] text-gray-500 block">Carrier Agent: India Post Mail Express</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tracking search instructions */}
            <div className="bg-brand-card/40 border border-brand-border/60 rounded-xl p-4 text-xs text-gray-400 space-y-2">
              <h4 className="font-bold text-white flex items-center gap-1.5 uppercase font-mono text-[10px] text-brand-neon-light">
                <Info className="w-3.5 h-3.5 text-brand-neon" /> Dispatch Information
              </h4>
              <p>
                All items are boxed with high-security seals within 24 hours of checkout. Shipments are deposited directly at the Kulukkallur Post Office for express dispatch.
              </p>
            </div>
          </div>
        )}

        {/* --- ADMINISTRATIVE PANEL VIEW --- */}
        {view === "admin" && (
          <div className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full space-y-6 no-print">
            
            {/* Admin Authentication Box */}
            {!isAdminAuthenticated ? (
              <div className="max-w-md mx-auto bg-brand-card border border-brand-border rounded-2xl p-6 shadow-2xl space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-brand-purple rounded-xl flex items-center justify-center mx-auto text-brand-neon border border-brand-purple-light">
                    <Lock className="w-6 h-6 text-brand-neon" />
                  </div>
                  <h2 className="font-display font-extrabold text-2xl text-white">SmartSupply Admin Portal</h2>
                  <p className="text-gray-400 text-xs">Enter your authorization system credentials to manage database</p>
                </div>

                <form onSubmit={handleAdminAuth} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-brand-neon-light uppercase tracking-wider mb-1.5">System Admin Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-brand-neon text-sm placeholder:text-gray-700"
                    />
                  </div>

                  {adminAuthError && (
                    <div className="p-3 bg-red-950/40 border border-red-900 rounded-lg text-red-400 text-xs">
                      {adminAuthError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-brand-neon text-brand-dark font-extrabold uppercase py-3 rounded-xl hover:bg-brand-neon-light transition tracking-widest text-xs"
                  >
                    UNLOCK DATABASE ACCESS 🔑
                  </button>
                </form>
              </div>
            ) : (
              // FULL ADMIN SCREEN PANEL
              <div className="space-y-6">
                
                {/* Admin Subheader & Quick Status */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-brand-card border border-brand-border p-4 rounded-xl">
                  <div>
                    <h2 className="text-xl font-display font-black text-white">
                      🛠️ smartsupply<span className="text-brand-neon">.admin</span>
                    </h2>
                    <p className="text-xs text-gray-400">Authenticated Session: Mohammed Muksith (Kulukkallur P.O.)</p>
                  </div>
                  
                  {/* Status Indicator Lights */}
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-xs text-brand-neon font-bold">
                      <span className="w-2 h-2 rounded-full bg-brand-neon animate-pulse"></span>
                      Realtime SSE Stream Online
                    </span>
                    <button
                      onClick={() => setIsAdminAuthenticated(false)}
                      className="text-xs bg-brand-dark hover:bg-red-900/40 text-gray-400 hover:text-red-400 border border-brand-border px-3 py-1.5 rounded-lg transition"
                    >
                      Exit Admin
                    </button>
                  </div>
                </div>

                {/* Admin Statistics Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print">
                  <div className="bg-brand-card border border-brand-border p-4 rounded-xl shadow-sm flex items-center gap-3">
                    <div className="p-2.5 bg-yellow-500/10 text-yellow-600 rounded-lg">
                      <ShoppingBag className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 font-bold uppercase block">Total Sales</span>
                      <span className="text-lg font-black text-slate-900">₹{adminOrders.reduce((sum, o) => sum + o.totalAmount, 0).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                  <div className="bg-brand-card border border-brand-border p-4 rounded-xl shadow-sm flex items-center gap-3">
                    <div className="p-2.5 bg-yellow-500/10 text-yellow-600 rounded-lg">
                      <ClipboardList className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 font-bold uppercase block">Total Orders</span>
                      <span className="text-lg font-black text-slate-900">{adminOrders.length}</span>
                    </div>
                  </div>
                  <div className="bg-brand-card border border-brand-border p-4 rounded-xl shadow-sm flex items-center gap-3">
                    <div className="p-2.5 bg-yellow-500/10 text-yellow-600 rounded-lg">
                      <Sparkles className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 font-bold uppercase block">Avg Basket</span>
                      <span className="text-lg font-black text-slate-900">₹{(adminOrders.length > 0 ? Math.round(adminOrders.reduce((sum, o) => sum + o.totalAmount, 0) / adminOrders.length) : 0).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                  <div className="bg-brand-card border border-brand-border p-4 rounded-xl shadow-sm flex items-center gap-3">
                    <div className="p-2.5 bg-red-500/10 text-red-600 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 font-bold uppercase block">Out of Stock</span>
                      <span className="text-lg font-black text-slate-900">{products.filter(p => p.status === "stock_out").length} items</span>
                    </div>
                  </div>
                </div>

                {/* Grid Layout of Management Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* LEFT 2 COLUMNS: Orders management */}
                  <div className="lg:col-span-2 space-y-6">
                    
                    {/* Orders Dispatch & Printing Sheet Panel */}
                    <div className="bg-brand-card border border-brand-border rounded-2xl p-4 md:p-6 space-y-4">
                      
                      {/* Filter panel & print selector */}
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                          <h3 className="font-display font-extrabold text-lg text-white">📦 Customer Orders Queue</h3>
                          <p className="text-xs text-gray-400">Select multiple orders to assemble an A4 Print layout (5 labels per sheet)</p>
                        </div>

                        {/* Date Filter Inputs */}
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1 bg-brand-dark border border-brand-border p-1.5 rounded-lg text-xs">
                            <Calendar className="w-3.5 h-3.5 text-brand-neon" />
                            <input
                              type="date"
                              value={adminStartDate}
                              onChange={(e) => setAdminStartDate(e.target.value)}
                              className="bg-transparent text-white focus:outline-none text-xs w-24"
                            />
                            <span className="text-gray-500 text-[10px]">to</span>
                            <input
                              type="date"
                              value={adminEndDate}
                              onChange={(e) => setAdminEndDate(e.target.value)}
                              className="bg-transparent text-white focus:outline-none text-xs w-24"
                            />
                          </div>
                          
                          <button
                            onClick={fetchAdminOrders}
                            className="bg-brand-purple hover:bg-brand-purple-light border border-brand-purple-light/20 text-brand-neon text-xs font-bold p-2 rounded-lg transition"
                          >
                            Filter
                          </button>
                        </div>
                      </div>

                      {/* Search and Status Filters */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-brand-dark/40 p-3 rounded-xl border border-brand-border/60">
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500">
                            <Search className="w-4 h-4" />
                          </span>
                          <input
                            type="text"
                            placeholder="Search orders (Name, Phone, ID, Pincode, Address, Tracking)..."
                            value={orderSearchQuery}
                            onChange={(e) => setOrderSearchQuery(e.target.value)}
                            className="w-full bg-brand-dark border border-brand-border rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder:text-gray-500"
                          />
                        </div>
                        <div className="flex gap-2">
                          <select
                            value={orderStatusFilter}
                            onChange={(e) => setOrderStatusFilter(e.target.value as any)}
                            className="flex-1 bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-xs text-white"
                          >
                            <option value="all">All Tracking Statuses</option>
                            <option value="booked">Booked (New)</option>
                            <option value="dispatched">Dispatched</option>
                            <option value="in_transit">In Transit</option>
                            <option value="delivered">Delivered</option>
                          </select>
                        </div>
                      </div>

                      {/* Multi-Order Label Printing Trigger */}
                      <div className="bg-brand-purple-dark/60 border border-brand-border p-3 rounded-xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                        <div className="text-xs text-brand-neon-light font-medium flex-1">
                          Selected for printing: <span className="text-brand-neon font-black font-mono text-[14px] bg-brand-purple/20 px-1.5 py-0.5 rounded">{selectedPrintOrders.length}</span> orders
                          {selectedPrintOrders.length > 0 && selectedPrintOrders.length % 5 !== 0 && (
                            <span className="text-gray-400 text-[10px] mt-1 block">
                              (Tip: exactly 5 orders fit perfectly onto one A4 sheet. You have selected {selectedPrintOrders.length} orders which is {Math.ceil(selectedPrintOrders.length / 5)} sheets!)
                            </span>
                          )}
                          {selectedPrintOrders.length > 0 && selectedPrintOrders.length % 5 === 0 && (
                            <span className="text-brand-neon font-bold text-[10px] mt-1 block">
                              🎯 Optimal {selectedPrintOrders.length / 5}/{selectedPrintOrders.length / 5} full sheets load achieved! ({selectedPrintOrders.length} labels)
                            </span>
                          )}
                        </div>

                        {/* Quick Batch Selection Actions */}
                        <div className="flex flex-wrap gap-1.5 bg-brand-dark p-1 rounded-lg border border-brand-border/60">
                          <button
                            type="button"
                            onClick={() => {
                              const allIds = filteredAdminOrders.map(o => o.id);
                              setSelectedPrintOrders(allIds);
                              showBanner(`Selected all ${allIds.length} orders!`, "success");
                            }}
                            className="bg-brand-card hover:bg-brand-purple/20 text-gray-700 text-[10px] font-bold px-2 py-1 rounded border border-brand-border transition-all whitespace-nowrap"
                          >
                            All ({filteredAdminOrders.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const ids = filteredAdminOrders.slice(0, 5).map(o => o.id);
                              setSelectedPrintOrders(ids);
                              showBanner("Selected first 5 orders (1 Page)!", "success");
                            }}
                            className="bg-brand-card hover:bg-brand-purple/20 text-gray-700 text-[10px] font-bold px-2 py-1 rounded border border-brand-border transition-all"
                          >
                            Select 5
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const ids = filteredAdminOrders.slice(0, 10).map(o => o.id);
                              setSelectedPrintOrders(ids);
                              showBanner("Selected first 10 orders (2 Pages)!", "success");
                            }}
                            className="bg-brand-card hover:bg-brand-purple/20 text-gray-700 text-[10px] font-bold px-2 py-1 rounded border border-brand-border transition-all"
                          >
                            Select 10
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const ids = filteredAdminOrders.slice(0, 20).map(o => o.id);
                              setSelectedPrintOrders(ids);
                              showBanner("Selected first 20 orders (4 Pages)!", "success");
                            }}
                            className="bg-brand-card hover:bg-brand-purple/20 text-gray-700 text-[10px] font-bold px-2 py-1 rounded border border-brand-border transition-all"
                          >
                            Select 20
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPrintOrders([]);
                              showBanner("Cleared printing selection", "info");
                            }}
                            className="bg-brand-card hover:bg-red-50 text-red-600 text-[10px] font-bold px-2 py-1 rounded border border-brand-border transition-all"
                          >
                            Clear
                          </button>
                        </div>

                        {/* A4 Print Layout Orientation Toggle */}
                        <div className="flex items-center gap-1.5 bg-brand-dark/80 p-1 rounded-lg border border-brand-border/80 w-full lg:w-auto">
                          <span className="text-[10px] text-gray-500 font-mono font-bold px-2 uppercase whitespace-nowrap">Layout:</span>
                          <button
                            onClick={() => setPrintOrientation("portrait")}
                            className={`flex-1 lg:flex-initial px-2.5 py-1 text-[10px] font-extrabold rounded-md uppercase tracking-wider transition-all duration-200 ${
                              printOrientation === "portrait"
                                ? "bg-brand-neon text-brand-dark font-black shadow-md"
                                : "text-gray-400 hover:text-white"
                            }`}
                            title="Portrait Layout (1-Column Stack for standard printer feeds)"
                          >
                            Portrait 📄
                          </button>
                          <button
                            onClick={() => setPrintOrientation("landscape")}
                            className={`flex-1 lg:flex-initial px-2.5 py-1 text-[10px] font-extrabold rounded-md uppercase tracking-wider transition-all duration-200 ${
                              printOrientation === "landscape"
                                ? "bg-brand-neon text-brand-dark font-black shadow-md"
                                : "text-gray-400 hover:text-white"
                            }`}
                            title="Landscape Layout (2-Column Grid for wider label sheets)"
                          >
                            Landscape 📑
                          </button>
                        </div>

                        <div className="flex gap-2 w-full lg:w-auto">
                          <button
                            disabled={selectedPrintOrders.length === 0}
                            onClick={() => {
                              setIsPrintLayoutOpen(true);
                            }}
                            className="flex-1 lg:flex-initial flex items-center justify-center gap-1.5 bg-brand-neon text-brand-dark text-xs font-black px-4 py-2 rounded-lg uppercase tracking-wider disabled:opacity-40 transition whitespace-nowrap"
                          >
                            <Printer className="w-4 h-4" /> Print A4 PDF
                          </button>
                          <button
                            onClick={() => setSelectedPrintOrders([])}
                            className="bg-brand-dark text-gray-400 border border-brand-border text-xs font-bold px-3 py-2 rounded-lg hover:text-white whitespace-nowrap"
                          >
                            Reset
                          </button>
                        </div>
                      </div>

                      {/* Orders table */}
                      {loadingOrders ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <div className="w-8 h-8 border-2 border-brand-purple border-t-brand-neon rounded-full animate-spin"></div>
                        </div>
                      ) : filteredAdminOrders.length === 0 ? (
                        <div className="text-center py-16 border border-brand-border/40 border-dashed rounded-xl">
                          <Package className="w-12 h-12 text-brand-purple-glow mx-auto mb-2 animate-bounce" />
                          <p className="text-gray-400 text-sm">No orders registered matching your search filter rules.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {filteredAdminOrders.map((order) => {
                            const isSelected = selectedPrintOrders.includes(order.id);

                            return (
                              <div
                                key={order.id}
                                className={`border rounded-xl overflow-hidden transition-all duration-200 ${
                                  isSelected
                                    ? "bg-brand-purple/20 border-brand-neon"
                                    : "bg-brand-dark/50 border-brand-border/60 hover:border-brand-purple/60"
                                }`}
                              >
                                {/* Order header bar */}
                                <div className="p-3 bg-brand-card/90 border-b border-brand-border/40 flex flex-wrap justify-between items-center gap-2">
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => togglePrintOrder(order.id)}
                                      className="w-4 h-4 accent-brand-neon rounded cursor-pointer"
                                    />
                                    <div>
                                      <span className="font-mono text-xs font-black text-brand-neon-light uppercase tracking-wide">
                                        ID: {order.id}
                                      </span>
                                      <span className="text-[10px] text-gray-500 ml-2">
                                        {formatDate(order.createdAt)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-white font-black bg-brand-dark/80 px-2 py-1 rounded border border-brand-border">
                                      ₹{order.totalAmount.toLocaleString()}
                                    </span>
                                    <button
                                      onClick={() => printSingleOrder(order.id)}
                                      className="bg-brand-purple hover:bg-brand-purple-light text-brand-dark px-2 py-1.5 rounded border border-brand-border/20 flex items-center gap-1 transition"
                                      title="Print Single Shipping Label (Instant)"
                                    >
                                      <Printer className="w-3.5 h-3.5" />
                                      <span className="text-[10px] font-black uppercase">Print</span>
                                    </button>
                                    <button
                                      onClick={() => setEditingOrder(order)}
                                      className="text-yellow-600 hover:text-yellow-500 p-1.5 bg-brand-dark/50 rounded border border-brand-border/40 hover:bg-brand-dark"
                                      title="Edit Shipping/Consignment Details (Full Control)"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => deleteOrderConfig(order.id)}
                                      className="text-red-500 hover:text-red-400 p-1.5 bg-brand-dark/50 rounded border border-brand-border/40 hover:bg-brand-dark"
                                      title="Delete Order (No history retained)"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Order summary body */}
                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                  {/* Shipping information */}
                                  <div className="space-y-2 border-r border-brand-border/20 pr-0 md:pr-4">
                                    <div className="text-[10px] text-brand-neon font-bold uppercase font-mono">Recipient Address Details</div>
                                    <p className="text-white font-bold">{order.name}</p>
                                    <p className="text-gray-300 font-mono text-[11px]">Phone: {order.phone}</p>
                                    <p className="text-gray-300 font-mono text-[11px]">Pincode: {order.pincode}</p>
                                    <p className="text-gray-400 text-[11px] leading-relaxed">{order.address}</p>
                                    {order.notes && (
                                      <p className="p-1.5 bg-brand-dark rounded text-[10px] text-brand-neon-light italic">
                                        Notes: {order.notes}
                                      </p>
                                    )}
                                  </div>

                                  {/* Item inventory and India Post status updater */}
                                  <div className="space-y-3 flex flex-col justify-between">
                                    <div>
                                      <div className="text-[10px] text-brand-neon font-bold uppercase font-mono mb-1">Ordered Items</div>
                                      <div className="space-y-1">
                                        {order.items.map((it, idx) => (
                                          <div key={idx} className="flex justify-between text-gray-300 text-[11px]">
                                            <span>{it.productName} <span className="text-gray-500">x{it.quantity}</span></span>
                                            <span className="font-mono">₹{it.price * it.quantity}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Tracking dispatch controller */}
                                    <div className="bg-brand-dark/80 p-2.5 rounded-lg border border-brand-border space-y-2">
                                      <div className="flex justify-between items-center text-[10px]">
                                        <span className="text-gray-500 font-mono">INDIA POST CONSIGNMENT:</span>
                                        <span className="text-brand-neon font-mono font-bold">{order.trackingNumber || "N/A"}</span>
                                      </div>

                                      <div className="flex gap-1">
                                        {(["booked", "dispatched", "in_transit", "delivered"] as const).map((st) => (
                                          <button
                                            key={st}
                                            onClick={() => updateOrderTrackingStatus(order.id, st)}
                                            className={`flex-1 text-[9px] font-extrabold uppercase py-1 rounded transition ${
                                              order.trackingStatus === st
                                                ? "bg-brand-neon text-brand-dark font-black"
                                                : "bg-brand-purple/20 text-gray-400 hover:text-white"
                                            }`}
                                          >
                                            {st === "in_transit" ? "Transit" : st}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT SIDEBAR COLUMN: Product Manager & Settings */}
                  <div className="space-y-6">
                    
                    {/* Catalog Database Manager */}
                    <div className="bg-brand-card border border-brand-border rounded-2xl p-4 md:p-6 space-y-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-display font-extrabold text-lg text-white">⚙️ Products DB</h3>
                          <p className="text-xs text-gray-400">Modify dynamic shop catalog instantly</p>
                        </div>
                        <button
                          id="btn-add-product"
                          onClick={() => {
                            setEditingProduct({
                              name: "",
                              description: "",
                              price: 299,
                              image: "",
                              category: "electronics",
                              status: "stock_in"
                            });
                            setIsProductModalOpen(true);
                          }}
                          className="bg-brand-neon text-brand-dark font-black p-2 rounded-xl text-xs hover:bg-brand-neon-light transition flex items-center gap-1"
                        >
                          <Plus className="w-4 h-4 text-brand-dark" /> Add Item
                        </button>
                      </div>

                      {/* Dynamic Troubleshoot Restore */}
                      <div className="flex justify-between items-center bg-brand-dark/40 p-2 rounded-xl border border-brand-border/60">
                        <span className="text-[10px] text-gray-400 font-mono">Troubleshoot:</span>
                        <button
                          onClick={resetProductsToDefaults}
                          className="bg-red-950/40 border border-red-900 text-red-400 hover:bg-red-900/60 text-[10px] font-bold px-2 py-1 rounded transition uppercase"
                        >
                          🔄 Restore Store Defaults
                        </button>
                      </div>

                      {/* Small compact layout of existing items */}
                      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                        {products.map((p) => (
                          <div
                            key={p.id}
                            className="bg-brand-dark/60 border border-brand-border/40 p-3 rounded-lg flex flex-col gap-2.5 text-xs hover:border-brand-purple-light/40"
                          >
                            <div className="flex items-center gap-3">
                              <img src={p.image} className="w-10 h-10 object-cover rounded shrink-0 border border-brand-border" alt="" />
                              <div className="flex-1 overflow-hidden">
                                <h4 className="text-white font-bold truncate">{p.name}</h4>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-brand-neon font-bold font-mono">₹{p.price}</span>
                                  <span className={`text-[8px] font-bold px-1 rounded uppercase tracking-wider ${
                                    p.status === "hot_sale" ? "bg-red-600 text-white" :
                                    p.status === "stock_out" ? "bg-brand-dark border border-red-500 text-red-500" :
                                    "bg-green-600 text-white"
                                  }`}>
                                    {p.status.replace("_", " ")}
                                  </span>
                                </div>
                              </div>

                              <div className="flex gap-1 shrink-0">
                                <button
                                  onClick={() => {
                                    setEditingProduct(p);
                                    setIsProductModalOpen(true);
                                  }}
                                  className="bg-brand-purple/60 hover:bg-brand-purple text-brand-neon-light p-1 rounded hover:text-white"
                                  title="Edit full properties"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => deleteProductConfig(p.id)}
                                  className="bg-brand-dark border border-brand-border text-red-500 hover:text-red-400 p-1 rounded"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Inline Controllers (True Full Control) */}
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-brand-border/30">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] text-gray-500 font-bold uppercase whitespace-nowrap">Price:</span>
                                <input
                                  type="number"
                                  defaultValue={p.price}
                                  onBlur={(e) => quickUpdateProductPrice(p.id, Number(e.target.value))}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      quickUpdateProductPrice(p.id, Number((e.target as HTMLInputElement).value));
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                  className="w-full bg-brand-dark/90 px-1.5 py-0.5 rounded border border-brand-border text-brand-neon font-mono text-[10px] focus:ring-1 focus:ring-brand-neon focus:outline-none"
                                />
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] text-gray-500 font-bold uppercase whitespace-nowrap">Stock:</span>
                                <select
                                  value={p.status}
                                  onChange={(e) => quickUpdateProductStatus(p.id, e.target.value as any)}
                                  className="w-full bg-brand-dark/90 border border-brand-border text-[9px] rounded px-1.5 py-0.5 text-white font-medium focus:ring-1 focus:ring-brand-neon focus:outline-none"
                                >
                                  <option value="stock_in">In Stock</option>
                                  <option value="hot_sale">Hot Sale</option>
                                  <option value="stock_out">Out of Stock</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Email Log simulator panel */}
                    <div className="bg-brand-card border border-brand-border rounded-2xl p-4 md:p-6 space-y-4">
                      <div>
                        <h3 className="font-display font-extrabold text-base text-white">📧 Simulated Mail Dispatch</h3>
                        <p className="text-[11px] text-gray-400">Verifies automated receipts sent to <span className="text-brand-neon">smartsupply36@gmail.com</span></p>
                      </div>

                      {adminEmails.length === 0 ? (
                        <div className="text-center py-6 text-gray-500 text-xs italic">
                          No checkout emails logged in this session yet.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                          {adminEmails.map((mail) => (
                            <div
                              key={mail.id}
                              onClick={() => setSelectedEmail(mail)}
                              className={`p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                                selectedEmail?.id === mail.id
                                  ? "bg-brand-purple/20 border-brand-neon text-white"
                                  : "bg-brand-dark/50 border-brand-border/40 hover:border-brand-border text-gray-300"
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-brand-neon-light truncate max-w-[120px]">{mail.subject}</span>
                                <span className="text-[9px] text-gray-500">{new Date(mail.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                              </div>
                              <p className="text-[10px] text-gray-400 truncate mt-1">{mail.body.substring(0, 50)}...</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Cloudinary Config Integrator panel */}
                    <div className="bg-brand-card border border-brand-border rounded-2xl p-4 md:p-6 space-y-4">
                      <div>
                        <h3 className="font-display font-extrabold text-base text-white">⚡ Integration API Settings</h3>
                        <p className="text-[11px] text-gray-400">Add credentials for uploading files directly via Cloudinary. Method 2 (Secure Cloudinary) runs server-side and does not require an upload preset!</p>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Cloudinary Cloud Name</label>
                          <input
                            type="text"
                            placeholder="e.g. smartsupply-cloud"
                            value={settings.cloudinaryCloudName}
                            onChange={(e) => setSettings((prev) => ({ ...prev, cloudinaryCloudName: e.target.value }))}
                            className="w-full bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Cloudinary API Key</label>
                          <input
                            type="text"
                            placeholder="e.g. 1234567890"
                            value={settings.cloudinaryApiKey || ""}
                            onChange={(e) => setSettings((prev) => ({ ...prev, cloudinaryApiKey: e.target.value }))}
                            className="w-full bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Cloudinary API Secret</label>
                          <input
                            type="password"
                            placeholder="e.g. secret-key"
                            value={settings.cloudinaryApiSecret || ""}
                            onChange={(e) => setSettings((prev) => ({ ...prev, cloudinaryApiSecret: e.target.value }))}
                            className="w-full bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Cloudinary Upload Preset (Only for Client-side Method 3)</label>
                          <input
                            type="text"
                            placeholder="e.g. smartsupply-preset (unsigned)"
                            value={settings.cloudinaryPreset}
                            onChange={(e) => setSettings((prev) => ({ ...prev, cloudinaryPreset: e.target.value }))}
                            className="w-full bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-white"
                          />
                        </div>

                        <button
                          onClick={saveSettingsConfig}
                          className="w-full bg-brand-purple hover:bg-brand-purple-light text-brand-neon font-extrabold py-2 rounded-lg transition text-xs tracking-wider"
                        >
                          SAVE CONFIGURATION
                        </button>
                      </div>
                    </div>

                    {/* Gmail SMTP & Notification Settings panel */}
                    <div className="bg-brand-card border border-brand-border rounded-2xl p-4 md:p-6 space-y-4">
                      <div>
                        <h3 className="font-display font-extrabold text-base text-white">📧 Real Email Notification Settings</h3>
                        <p className="text-[11px] text-gray-400">Receive actual order notification emails instantly on checkout using Gmail SMTP.</p>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-brand-dark/40 border border-brand-border/30">
                          <div>
                            <span className="block text-xs font-bold text-white">Enable Email Dispatcher</span>
                            <span className="text-[9px] text-gray-400">Turn on/off real SMTP email notifications</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={settings.emailNotificationsEnabled}
                            onChange={(e) => setSettings((prev) => ({ ...prev, emailNotificationsEnabled: e.target.checked }))}
                            className="w-4 h-4 text-brand-neon rounded focus:ring-brand-neon"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Recipient Email Address</label>
                          <input
                            type="email"
                            placeholder="e.g. your-email@gmail.com"
                            value={settings.notificationEmail || ""}
                            onChange={(e) => setSettings((prev) => ({ ...prev, notificationEmail: e.target.value }))}
                            className="w-full bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Gmail SMTP Username (Sender)</label>
                          <input
                            type="email"
                            placeholder="e.g. sender-email@gmail.com"
                            value={settings.smtpUser || ""}
                            onChange={(e) => setSettings((prev) => ({ ...prev, smtpUser: e.target.value }))}
                            className="w-full bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Gmail App Password (16-char)</label>
                          <input
                            type="password"
                            placeholder="e.g. abcd efgh ijkl mnop"
                            value={settings.smtpPass || ""}
                            onChange={(e) => setSettings((prev) => ({ ...prev, smtpPass: e.target.value }))}
                            className="w-full bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-white"
                          />
                        </div>

                        <button
                          onClick={saveSettingsConfig}
                          className="w-full bg-brand-purple hover:bg-brand-purple-light text-brand-neon font-extrabold py-2 rounded-lg transition text-xs tracking-wider"
                        >
                          SAVE EMAIL CONFIGURATION
                        </button>
                      </div>
                    </div>

                  </div>

                </div>

              </div>
            )}

          </div>
        )}

      </div>

      {/* --- CLIENT SIDE BASKET / CART DRAWER OVERLAY --- */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-end no-print">
          <div className="w-full max-w-md bg-brand-card border-l border-brand-border h-full flex flex-col justify-between shadow-2xl relative">
            
            {/* Header */}
            <div className="p-4 border-b border-brand-border/60 flex justify-between items-center bg-brand-purple-dark/40">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-brand-neon" />
                <h3 className="font-display font-black text-white text-lg">My Smart Bag</h3>
              </div>
              <button
                id="btn-close-cart"
                onClick={() => setIsCartOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-brand-dark transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                  <div className="w-16 h-16 bg-brand-purple/20 rounded-full flex items-center justify-center text-brand-purple-glow">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-base">Your smart bag is empty</h4>
                    <p className="text-gray-500 text-xs mt-1">Browse our electronics & kitchen catalog to add smart devices</p>
                  </div>
                  <button
                    onClick={() => { setIsCartOpen(false); setView("shop"); }}
                    className="bg-brand-neon text-brand-dark font-extrabold px-6 py-2.5 rounded-xl text-xs hover:bg-brand-neon-light transition uppercase tracking-wider"
                  >
                    Explore Shop
                  </button>
                </div>
              ) : (
                cart.map((item) => {
                  const product = products.find((p) => p.id === item.productId);
                  return (
                    <div
                      key={item.productId}
                      className="bg-brand-dark/60 border border-brand-border/40 p-3 rounded-xl flex items-center gap-3"
                    >
                      <img
                        src={product?.image || "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=500&auto=format&fit=crop&q=60"}
                        alt={item.productName}
                        className="w-12 h-12 object-cover rounded-lg shrink-0 border border-brand-border/60"
                      />

                      <div className="flex-1 overflow-hidden">
                        <h4 className="text-white font-semibold text-xs truncate">{item.productName}</h4>
                        <p className="text-brand-neon font-mono text-xs font-extrabold mt-1">₹{item.price.toLocaleString()}</p>
                        
                        {/* Quantity stepper controls */}
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => updateCartQuantity(item.productId, -1)}
                            className="bg-brand-purple/40 text-brand-neon p-1 rounded hover:bg-brand-purple/60 transition"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-white font-mono text-xs font-bold w-4 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(item.productId, 1)}
                            className="bg-brand-purple/40 text-brand-neon p-1 rounded hover:bg-brand-purple/60 transition"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.productId)}
                        className="text-gray-500 hover:text-red-400 p-1.5 hover:bg-brand-dark rounded transition shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Summary bottom drawer footer */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-brand-border/60 bg-brand-purple-dark/60 space-y-4">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-gray-400">
                    <span>Shipping Speed:</span>
                    <span className="text-white font-bold">India Post Express (Free)</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Tax (GST Inclusive):</span>
                    <span className="text-white">0%</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-white border-t border-brand-border/20 pt-2">
                    <span>Total Amount:</span>
                    <span className="text-brand-neon font-display font-black text-lg">₹{cartTotal.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  id="btn-go-to-checkout"
                  onClick={() => setIsCheckingOut(true)}
                  className="w-full bg-brand-neon text-brand-dark font-black py-3 rounded-xl hover:bg-brand-neon-light transition uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                >
                  Proceed to Secure Checkout <ShoppingBag className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* --- SECURE CHECKOUT POPUP MODAL --- */}
      {isCheckingOut && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-brand-card border border-brand-border/80 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-4 bg-brand-purple border-b border-brand-border/60 flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-brand-neon" />
                <div>
                  <h3 className="font-display font-extrabold text-base leading-none">SmartSupply secure check-out</h3>
                  <span className="text-[10px] text-brand-neon-light font-mono">128-bit SSL encrypted</span>
                </div>
              </div>
              <button
                onClick={() => setIsCheckingOut(false)}
                className="text-white hover:text-brand-neon p-1 rounded-lg transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Checkout Form Content */}
            <form onSubmit={handleCheckoutSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              
              <div className="bg-brand-purple/20 p-3 rounded-xl border border-brand-purple-light/20 flex justify-between items-center">
                <div>
                  <p className="text-gray-400 text-[10px]">TOTAL CHECKOUT DEPOSIT</p>
                  <p className="text-white font-display font-black text-lg mt-0.5">₹{cartTotal.toLocaleString()}</p>
                </div>
                <div className="text-right text-[10px] text-brand-neon font-bold">
                  <span>{cartItemsCount} Smart Devices</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-brand-neon-light font-bold mb-1 uppercase tracking-wider text-[10px]">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter recipient's full name"
                    value={checkoutName}
                    onChange={(e) => setCheckoutName(e.target.value)}
                    className="w-full bg-brand-dark border border-brand-border rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-brand-neon"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-brand-neon-light font-bold mb-1 uppercase tracking-wider text-[10px]">Phone Number</label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +91 9539364862"
                      value={checkoutPhone}
                      onChange={(e) => setCheckoutPhone(e.target.value)}
                      className="w-full bg-brand-dark border border-brand-border rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-brand-neon font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-brand-neon-light font-bold mb-1 uppercase tracking-wider text-[10px]">Kerala Pincode</label>
                    <input
                      type="text"
                      required
                      pattern="[0-9]{6}"
                      placeholder="e.g. 679337"
                      value={checkoutPincode}
                      onChange={(e) => setCheckoutPincode(e.target.value)}
                      className="w-full bg-brand-dark border border-brand-border rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-brand-neon font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-brand-neon-light font-bold mb-1 uppercase tracking-wider text-[10px]">Detailed Shipping Address</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="House name, street detail, local landmark, district name"
                    value={checkoutAddress}
                    onChange={(e) => setCheckoutAddress(e.target.value)}
                    className="w-full bg-brand-dark border border-brand-border rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-brand-neon leading-relaxed"
                  ></textarea>
                </div>

                <div>
                  <label className="block text-brand-neon-light font-bold mb-1 uppercase tracking-wider text-[10px]">Instructions for Packer (Optional)</label>
                  <input
                    type="text"
                    placeholder="Leave at front desk, call before arrival, etc."
                    value={checkoutNotes}
                    onChange={(e) => setCheckoutNotes(e.target.value)}
                    className="w-full bg-brand-dark border border-brand-border rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-brand-neon"
                  />
                </div>
              </div>

              {/* Payment Mode Mock (Cash on Delivery / UPI) */}
              <div className="bg-brand-dark/80 p-3 rounded-xl border border-brand-border text-[11px] text-gray-400 space-y-1">
                <span className="font-bold text-white uppercase text-[10px]">Guaranteed Safe Payment Method</span>
                <p>📦 SmartSupply uses secure Cash-on-Delivery (COD) or UPI on Handover for all customers across Kerala.</p>
              </div>

              {/* Action buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCheckingOut(false)}
                  className="flex-1 bg-brand-dark border border-brand-border text-gray-400 font-bold py-3 rounded-xl text-center hover:text-white"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-order"
                  type="submit"
                  disabled={checkoutLoading}
                  className="flex-1 bg-brand-neon text-brand-dark font-black py-3 rounded-xl text-center hover:bg-brand-neon-light transition uppercase tracking-wider"
                >
                  {checkoutLoading ? "Processing..." : "CONFIRM COD ORDER"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* --- CONFIRMED SUCCESS ORDER DIALOG --- */}
      {lastPlacedOrder && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-brand-card border-2 border-brand-neon w-full max-w-md rounded-2xl p-6 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-brand-neon opacity-10 rounded-full blur-2xl"></div>

            <div className="w-16 h-16 bg-brand-neon/10 border border-brand-neon/40 rounded-full flex items-center justify-center mx-auto text-brand-neon mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h3 className="font-display font-extrabold text-2xl text-white">Order Placed Successfully!</h3>
            <p className="text-gray-400 text-xs mt-1">Receipt dispatched simulatedly to smartsupply36@gmail.com</p>

            <div className="my-6 bg-brand-dark/90 p-4 rounded-xl border border-brand-border space-y-2 text-left text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Order ID:</span>
                <span className="text-brand-neon font-mono font-bold">{lastPlacedOrder.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Consignment Code:</span>
                <span className="text-white font-mono font-bold">{lastPlacedOrder.trackingNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Deliver To:</span>
                <span className="text-white font-semibold">{lastPlacedOrder.name}</span>
              </div>
              <div className="flex justify-between border-t border-brand-border/30 pt-2 mt-2">
                <span className="text-gray-400 font-bold">Total Amount paid on COD:</span>
                <span className="text-brand-neon font-display font-black text-sm">₹{lastPlacedOrder.totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <p className="text-gray-400 text-xs leading-relaxed mb-6">
              Please write down your order details or take a screenshot. You can check package updates using our <strong>India Post Consignment tracking tool</strong> with your Order ID or tracking number.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setTrackingQuery(lastPlacedOrder.id);
                  setView("tracking");
                  setLastPlacedOrder(null);
                  handleTrackOrder({ preventDefault: () => {} } as any);
                }}
                className="flex-1 bg-brand-neon text-brand-dark font-black py-3 rounded-xl text-xs hover:bg-brand-neon-light transition uppercase tracking-widest"
              >
                TRACK PACKAGE 📦
              </button>
              <button
                onClick={() => setLastPlacedOrder(null)}
                className="bg-brand-dark border border-brand-border text-gray-400 font-bold px-4 rounded-xl text-xs hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD / EDIT PRODUCT DIALOG MODAL (ADMIN ONLY) --- */}
      {isProductModalOpen && editingProduct && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-brand-card border border-brand-border w-full max-w-md rounded-xl overflow-hidden shadow-2xl relative">
            
            <div className="p-4 bg-brand-purple text-white flex justify-between items-center font-bold">
              <span>{editingProduct.id ? "Edit Product DB" : "Add New Product"}</span>
              <button
                onClick={() => { setIsProductModalOpen(false); setEditingProduct(null); }}
                className="text-white hover:text-brand-neon"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-gray-400 mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Smart Wireless Chopper"
                  value={editingProduct.name || ""}
                  onChange={(e) => setEditingProduct((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-brand-dark border border-brand-border rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">Product Description</label>
                <textarea
                  placeholder="Details about product specifications..."
                  rows={2}
                  value={editingProduct.description || ""}
                  onChange={(e) => setEditingProduct((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-brand-dark border border-brand-border rounded px-3 py-2 text-white"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1">Product Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={editingProduct.price || 0}
                    onChange={(e) => setEditingProduct((prev) => ({ ...prev, price: Number(e.target.value) }))}
                    className="w-full bg-brand-dark border border-brand-border rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Category</label>
                  <select
                    value={editingProduct.category || "electronics"}
                    onChange={(e) => setEditingProduct((prev) => ({ ...prev, category: e.target.value as any }))}
                    className="w-full bg-brand-dark border border-brand-border rounded px-3 py-2 text-white"
                  >
                    <option value="electronics">🔌 Electronics</option>
                    <option value="kitchen">🍳 Smart Kitchen</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 mb-1">Stock Status Condition</label>
                <select
                  value={editingProduct.status || "stock_in"}
                  onChange={(e) => setEditingProduct((prev) => ({ ...prev, status: e.target.value as any }))}
                  className="w-full bg-brand-dark border border-brand-border rounded px-3 py-2 text-white"
                >
                  <option value="stock_in">🟢 In Stock (stock_in)</option>
                  <option value="hot_sale">🔥 Hot Sale (hot_sale)</option>
                  <option value="stock_out">🔴 Stock Out (stock_out)</option>
                </select>
              </div>

              {/* Dynamic Image Upload Widget using Cloudinary API or ImgBB/Hosting Link */}
              <div className="space-y-2 border border-brand-border/60 p-3 rounded bg-brand-dark/40">
                <div className="text-[10px] text-brand-neon font-bold uppercase font-mono">Product Visual Media Asset</div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-brand-neon mb-1 text-[9px] font-bold">📷 Cloudinary Secure Upload</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleServerCloudinaryUpload}
                      className="w-full text-[10px] text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-brand-neon file:text-brand-dark hover:file:bg-brand-neon-light cursor-pointer"
                    />
                    {isUploadingImage && <span className="text-[9px] text-brand-neon animate-pulse block mt-1">Uploading...</span>}
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-1 text-[9px] font-bold">🔗 ImgBB or Image Hosting Link</label>
                    <input
                      type="text"
                      placeholder="e.g. https://i.ibb.co/..."
                      value={editingProduct.image || ""}
                      onChange={(e) => setEditingProduct((prev) => ({ ...prev, image: e.target.value }))}
                      className="w-full bg-brand-dark border border-brand-border rounded px-2 py-1.5 text-white text-[11px]"
                    />
                  </div>
                </div>

                {editingProduct.image && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-brand-border/20">
                    <img src={editingProduct.image} className="w-8 h-8 rounded object-cover border border-brand-border" alt="" />
                    <span className="text-[9px] text-gray-400 truncate max-w-[200px]">{editingProduct.image}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setIsProductModalOpen(false); setEditingProduct(null); }}
                  className="flex-1 bg-brand-dark border border-brand-border text-gray-400 font-bold py-2 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={saveProductConfig}
                  className="flex-1 bg-brand-neon text-brand-dark font-black py-2 rounded uppercase"
                >
                  Save to DB
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* --- SIMULATED INDIVIDUAL EMAIL DETAIL MODAL --- */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-brand-card border border-brand-border w-full max-w-lg rounded-xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-brand-purple text-white flex justify-between items-center font-bold">
              <span className="flex items-center gap-2"><Mail className="w-4 h-4 text-brand-neon" /> Dispatch Receipt Log</span>
              <button onClick={() => setSelectedEmail(null)} className="text-white hover:text-brand-neon"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 text-xs space-y-4">
              <div className="bg-brand-dark/80 p-3 rounded space-y-1 text-[11px]">
                <div><span className="text-gray-500 font-mono">TO:</span> <span className="text-brand-neon-light font-bold">smartsupply36@gmail.com</span></div>
                <div><span className="text-gray-500 font-mono">SUBJECT:</span> <span className="text-white font-bold">{selectedEmail.subject}</span></div>
                <div><span className="text-gray-500 font-mono">DATE:</span> <span className="text-gray-400">{formatDate(selectedEmail.date)}</span></div>
              </div>
              <pre className="bg-brand-dark text-gray-300 p-4 rounded text-[11px] overflow-auto max-h-[300px] leading-relaxed font-mono whitespace-pre-wrap select-text">
                {selectedEmail.body}
              </pre>
              <div className="text-right">
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="bg-brand-neon text-brand-dark font-bold px-4 py-1.5 rounded text-xs hover:bg-brand-neon-light transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT CUSTOMER ORDER MODAL (FULL ADMIN CONTROL) --- */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-brand-card border border-brand-border w-full max-w-lg rounded-xl overflow-hidden shadow-2xl relative">
            
            <div className="p-4 bg-brand-purple text-white flex justify-between items-center font-bold border-b border-brand-border/40">
              <span className="flex items-center gap-2">🛠️ Full Admin Control: Edit Order {editingOrder.id}</span>
              <button
                onClick={() => setEditingOrder(null)}
                className="text-white hover:text-brand-neon transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 font-bold mb-1">Customer Name</label>
                  <input
                    type="text"
                    required
                    value={editingOrder.name || ""}
                    onChange={(e) => setEditingOrder((prev: any) => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-brand-dark border border-brand-border rounded px-3 py-2 text-white text-xs"
                  />
                </div>
                
                <div>
                  <label className="block text-gray-400 font-bold mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={editingOrder.phone || ""}
                    onChange={(e) => setEditingOrder((prev: any) => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-brand-dark border border-brand-border rounded px-3 py-2 text-white font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 font-bold mb-1">Postal Pincode</label>
                  <input
                    type="text"
                    required
                    value={editingOrder.pincode || ""}
                    onChange={(e) => setEditingOrder((prev: any) => ({ ...prev, pincode: e.target.value }))}
                    className="w-full bg-brand-dark border border-brand-border rounded px-3 py-2 text-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 font-bold mb-1">Tracking Status (India Post)</label>
                  <select
                    value={editingOrder.trackingStatus || "booked"}
                    onChange={(e) => setEditingOrder((prev: any) => ({ ...prev, trackingStatus: e.target.value }))}
                    className="w-full bg-brand-dark border border-brand-border rounded px-3 py-2 text-white text-xs font-bold"
                  >
                    <option value="booked">Booked (New)</option>
                    <option value="dispatched">Dispatched</option>
                    <option value="in_transit">In Transit</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 font-bold mb-1">India Post Consignment / Tracking Number</label>
                <input
                  type="text"
                  placeholder="e.g. EM953936486IN"
                  value={editingOrder.trackingNumber || ""}
                  onChange={(e) => setEditingOrder((prev: any) => ({ ...prev, trackingNumber: e.target.value }))}
                  className="w-full bg-brand-dark border border-brand-border rounded px-3 py-2 text-white font-mono text-xs text-brand-neon"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-bold mb-1">Full Delivery Address</label>
                <textarea
                  required
                  rows={3}
                  value={editingOrder.address || ""}
                  onChange={(e) => setEditingOrder((prev: any) => ({ ...prev, address: e.target.value }))}
                  className="w-full bg-brand-dark border border-brand-border rounded px-3 py-2 text-white text-xs leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-bold mb-1">Special Order Notes</label>
                <textarea
                  rows={2}
                  placeholder="Additional customer delivery notes..."
                  value={editingOrder.notes || ""}
                  onChange={(e) => setEditingOrder((prev: any) => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-brand-dark border border-brand-border rounded px-3 py-2 text-white text-xs italic"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-brand-border/30">
                <button
                  onClick={() => setEditingOrder(null)}
                  className="flex-1 bg-brand-dark border border-brand-border text-gray-400 font-bold py-2 rounded-xl text-xs hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={saveOrderEdits}
                  className="flex-1 bg-brand-neon text-brand-dark font-black py-2 rounded-xl text-xs uppercase hover:bg-brand-neon-light transition"
                >
                  Save Changes ✅
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* --- PRINT ONLY A4 SHIPPING LABELS SHEET (Exactly 5 per page) --- */}
      {isPrintLayoutOpen && (
        <>
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page {
                size: A4 ${printOrientation} !important;
                margin: 0 !important;
              }
              html, body {
                width: ${printOrientation === "landscape" ? "297mm" : "210mm"} !important;
                height: ${printOrientation === "landscape" ? "210mm" : "297mm"} !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
              }
              .print-page {
                width: ${printOrientation === "landscape" ? "297mm" : "210mm"} !important;
                height: ${printOrientation === "landscape" ? "210mm" : "297mm"} !important;
              }
              ${printOrientation === "landscape" ? `
              .print-page {
                display: grid !important;
                grid-template-columns: repeat(2, 1fr) !important;
                grid-template-rows: repeat(3, 1fr) !important;
                gap: 4mm !important;
                padding: 6mm !important;
                box-sizing: border-box !important;
              }
              .print-label-card {
                height: auto !important;
                max-height: 58mm !important;
                margin-bottom: 0 !important;
              }
              ` : ""}
            }
          ` }} />

          {/* Screen-only Interactive Print Preview Modal overlay */}
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/90 backdrop-blur-sm no-print flex flex-col items-center py-6 px-4">
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
              
              {/* Modal Header */}
              <div className="bg-slate-950 text-white px-6 py-4 flex flex-wrap justify-between items-center gap-4 border-b border-gray-800">
                <div>
                  <h3 className="font-display font-extrabold text-base tracking-tight flex items-center gap-2">
                    <span className="text-brand-neon">📄</span> A4 Label Sheet Print Preview ({printOrientation})
                  </h3>
                  <p className="text-xs text-gray-400">
                    Assembled <span className="text-brand-neon font-bold font-mono text-sm">{selectedPrintOrders.length}</span> labels into <span className="text-brand-neon font-bold font-mono text-sm">{Math.ceil(selectedPrintOrders.length / 5)}</span> A4 Sheets (5 labels per page)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setTimeout(() => window.print(), 100);
                    }}
                    className="bg-brand-neon hover:bg-brand-neon-light text-brand-dark px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 shadow-lg shadow-brand-neon/10"
                  >
                    <Printer className="w-4 h-4" /> Print / Save A4 PDF
                  </button>
                  <button
                    onClick={() => setIsPrintLayoutOpen(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-gray-300 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors"
                  >
                    Close Preview
                  </button>
                </div>
              </div>

              {/* PDF Settings Tutorial Banner */}
              <div className="bg-amber-50/90 border-b border-amber-200 p-4 text-xs text-amber-950">
                <div className="flex gap-2">
                  <span className="text-base">💡</span>
                  <div className="space-y-1">
                    <p className="font-bold">Simple Step-by-Step PDF Download & Share Instructions:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-900 leading-relaxed">
                      <li>Click the gold <strong>"Print / Save A4 PDF"</strong> button above.</li>
                      <li>In the print screen, change <strong>Destination</strong> to <strong>"Save as PDF"</strong> (or Microsoft Print to PDF).</li>
                      <li>Under <em>More Settings</em>: Ensure <strong>Paper Size is A4</strong>, Margins is <strong>Default (or None)</strong>, and check <strong>Background graphics</strong> to keep designs clean.</li>
                      <li>Click <strong>Save</strong> to get your clean PDF! You can now easily share it on WhatsApp, email, or print directly on A4 sheets.</li>
                    </ul>
                    {window.self !== window.top && (
                      <div className="bg-red-50 text-red-700 font-bold border border-red-200 p-2 rounded mt-2 text-[10px] flex items-center gap-1">
                        ⚠️ <strong>Notice:</strong> You are in a preview frame. If printing does not launch, click the "Open in new tab" icon at the top right of the screen first!
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Miniature A4 Pages List Mockup on screen */}
              <div className="p-6 bg-slate-100 max-h-[60vh] overflow-y-auto space-y-8 flex flex-col items-center">
                {(() => {
                  const printableOrders = adminOrders.filter((o) => selectedPrintOrders.includes(o.id));
                  const pages: Order[][] = [];
                  for (let i = 0; i < printableOrders.length; i += 5) {
                    pages.push(printableOrders.slice(i, i + 5));
                  }

                  return pages.map((pageOrders, pageIdx) => (
                    <div key={pageIdx} className="w-full max-w-[210mm] bg-white shadow-lg border border-gray-300 p-6 space-y-4 rounded-lg relative text-black">
                      <div className="absolute top-3 left-3 bg-slate-900 text-white text-[9px] font-bold font-mono px-2 py-0.5 rounded shadow z-10">
                        SHEET {pageIdx + 1} OF {pages.length} ({pageOrders.length} labels)
                      </div>
                      
                      <div className={`space-y-3 pt-6 ${printOrientation === "landscape" ? "grid grid-cols-2 gap-4 space-y-0" : ""}`}>
                        {pageOrders.map((order) => (
                          <div key={order.id} className="border-2 border-dashed border-gray-400 p-3.5 flex flex-col justify-between text-[11px] font-mono rounded bg-slate-50">
                            {/* Header */}
                            <div className="flex justify-between items-start border-b border-gray-300 pb-1.5 mb-1.5">
                              <div>
                                <h4 className="font-bold text-[10px] tracking-tight uppercase text-slate-800">SMARTSUPPLY INDIA POST LOGISTICS</h4>
                                <span className="text-[8px] block text-gray-500">Express Cash-on-Delivery Label</span>
                              </div>
                              <div className="text-right">
                                <span className="border border-slate-800 font-bold px-1.5 py-0.2 text-[9px] text-slate-800 rounded">COD</span>
                              </div>
                            </div>

                            {/* Addresses grid */}
                            <div className="grid grid-cols-2 gap-2 my-1 text-slate-700">
                              <div className="border-r border-gray-300 pr-2">
                                <span className="text-[7px] font-bold block text-gray-500">SENDER (FROM):</span>
                                <p className="font-bold text-[9px] text-slate-800">{FROM_ADDRESS.name}</p>
                                <p className="text-[8px] leading-tight">{FROM_ADDRESS.address}, {FROM_ADDRESS.cityState}</p>
                                <p className="text-[8px]">Ph: {FROM_ADDRESS.phone}</p>
                              </div>
                              <div className="pl-2">
                                <span className="text-[7px] font-bold block text-gray-500">RECIPIENT (TO):</span>
                                <p className="font-bold text-[9px] text-slate-900 uppercase underline">{order.name}</p>
                                <p className="text-[8px] leading-snug">{order.address}</p>
                                <p className="font-bold text-[8px] mt-0.5">PIN: {order.pincode}</p>
                                <p className="font-bold text-[8px]">Ph: {order.phone}</p>
                              </div>
                            </div>

                            {/* Footer info */}
                            <div className="border-t border-gray-300 pt-1.5 flex justify-between items-center text-[9px] text-slate-800">
                              <div>
                                <span className="font-bold block text-[8px]">ORDER: {order.id}</span>
                                <span className="text-[7px] text-gray-500">Items: {order.items.map((it) => `${it.productName} (x${it.quantity})`).join(", ")}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold block text-[10px]">TOTAL: ₹{order.totalAmount.toLocaleString()}</span>
                                <span className="text-[8px] font-bold block bg-slate-800 text-white px-1.5 py-0.2 mt-0.5 tracking-wider font-mono">
                                  {order.trackingNumber}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {/* Modal Footer Controls */}
              <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
                <button
                  onClick={() => setIsPrintLayoutOpen(false)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold px-4 py-2 rounded-xl text-xs transition"
                >
                  Cancel & Exit
                </button>
                <button
                  onClick={() => {
                    setTimeout(() => window.print(), 100);
                  }}
                  className="bg-brand-neon hover:bg-brand-neon-light text-brand-dark px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                >
                  Open Print / Save PDF 🖨️
                </button>
              </div>

            </div>
          </div>

          {/* This is the hidden block configured specifically for physical printing and PDF compiling */}
          <div className="print-only hidden">
            {/* Assemble orders into groups of 5 */}
            {(() => {
              const printableOrders = adminOrders.filter((o) => selectedPrintOrders.includes(o.id));
              const pages: Order[][] = [];
              for (let i = 0; i < printableOrders.length; i += 5) {
                pages.push(printableOrders.slice(i, i + 5));
              }

              return pages.map((pageOrders, pageIdx) => (
                <div key={pageIdx} className={`print-page bg-white text-black p-4 ${printOrientation === "landscape" ? "" : "space-y-3"}`}>
                {pageOrders.map((order) => (
                  <div key={order.id} className="print-label-card border-2 border-dashed border-black p-4 flex flex-col justify-between text-xs font-mono">
                    
                    {/* Header: Carrier Logo info */}
                    <div className="flex justify-between items-start border-b border-black pb-2 mb-2">
                      <div>
                        <h4 className="font-bold text-sm tracking-tight uppercase">SMARTSUPPLY INDIA POST LOGISTICS</h4>
                        <span className="text-[9px] block">Express Cash-on-Delivery Consignment Label</span>
                      </div>
                      <div className="text-right">
                        <span className="border border-black font-bold px-2 py-0.5 text-xs">COD</span>
                        <span className="text-[8px] block mt-1">Collect cash on handover</span>
                      </div>
                    </div>

                    {/* From & To Addresses */}
                    <div className="grid grid-cols-2 gap-4 flex-1">
                      
                      {/* Left: From Address */}
                      <div className="border-r border-black pr-2">
                        <span className="text-[8px] font-bold block mb-1">SENDER (FROM ADDRESS):</span>
                        <p className="font-bold text-[10px]">{FROM_ADDRESS.name}</p>
                        <p className="text-[9px] leading-tight text-gray-800">{FROM_ADDRESS.address}</p>
                        <p className="text-[9px] font-bold text-gray-800">{FROM_ADDRESS.cityState}</p>
                        <p className="text-[9px] font-bold">Ph: {FROM_ADDRESS.phone}</p>
                      </div>

                      {/* Right: To Address */}
                      <div className="pl-2">
                        <span className="text-[8px] font-bold block mb-1">RECIPIENT (TO SHIPPING ADDRESS):</span>
                        <p className="font-bold text-[11px] underline uppercase">{order.name}</p>
                        <p className="text-[10px] leading-snug">{order.address}</p>
                        <p className="font-bold text-[10px] tracking-wider mt-1">PIN: {order.pincode}</p>
                        <p className="font-bold text-[10px]">Ph: {order.phone}</p>
                      </div>

                    </div>

                    {/* Footer: Order Summary & Tracking */}
                    <div className="border-t border-black pt-2 mt-2 flex justify-between items-center text-[10px]">
                      <div>
                        <span className="font-bold block">ORDER NO: {order.id}</span>
                        <span className="text-[8px]">Items: {order.items.map((it) => `${it.productName} (x${it.quantity})`).join(", ")}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold block text-sm">TOTAL COD AMOUNT: ₹{order.totalAmount.toLocaleString()}</span>
                        <span className="text-[9px] font-bold block bg-black text-white px-2 py-0.5 mt-0.5 tracking-wider font-mono">
                          CONSIGNMENT NO: {order.trackingNumber}
                        </span>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
              ));
            })()}
          </div>
        </>
      )}

      {/* Footer Branding Area */}
      <footer className="bg-brand-dark/95 border-t border-brand-border/60 py-6 text-center text-xs text-gray-500 no-print">
        <div className="max-w-7xl mx-auto px-4 space-y-3">
          <div className="font-display font-extrabold text-sm tracking-tight text-white">
            smart<span className="text-brand-neon">supply</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            © 2026 SmartSupply India. High-efficiency automated logistics pipeline for Muhammed Muksith. <br />
            Powered by Google AI Studio Cloud Run Engine with full-stack Node & React synchronization.
          </p>
          <div className="flex justify-center gap-4 text-brand-neon-light font-semibold text-[10px] uppercase font-mono">
            <span>Electronics</span>
            <span>•</span>
            <span>Smart Kitchen</span>
            <span>•</span>
            <span>India Post Logistics</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
