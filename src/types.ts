/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: 'electronics' | 'kitchen';
  status: 'hot_sale' | 'stock_out' | 'stock_in';
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  totalAmount: number;
  name: string;
  phone: string;
  pincode: string;
  address: string;
  trackingNumber?: string; // India Post tracking number
  trackingStatus?: 'booked' | 'dispatched' | 'in_transit' | 'delivered';
  createdAt: string;
  emailSent?: boolean;
  notes?: string;
}

export interface AdminSettings {
  cloudinaryCloudName: string;
  cloudinaryPreset: string;
  cloudinaryApiKey?: string;
  cloudinaryApiSecret?: string;
  emailNotificationsEnabled: boolean;
  notificationEmail?: string;
  smtpUser?: string;
  smtpPass?: string;
}
