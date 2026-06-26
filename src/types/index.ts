export interface Restaurant {
  restaurantId: string;

  restaurantName: string;
  restaurantLogo?: string;
  restaurantDescription?: string;

  whatsappNumber?: string;
  contactNumber?: string;
  email?: string;
  address?: string;

  shopOpen: boolean;

  feedbackEnabled: boolean;
  whatsappNotificationsEnabled: boolean;

  deliveryCharge: number;
  minimumOrderAmount: number;
  averagePreparationTime: number;

  openingTime: string;
  closingTime: string;

  currency: string;

  createdAt?: string;
  updatedAt?: string;
}

export interface AdminUser {
  _id?: string;

  name: string;
  email: string;

  role?: string;

  restaurantId: string;

  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  _id: string;

  restaurantId: string;

  name: string;
  description?: string;
  image?: string;

  displayOrder: number;

  isActive: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface MenuItem {
  _id: string;

  restaurantId: string;

  categoryId?: string;

  name: string;
  description?: string;

  image?: string;

  price: number;
  discountedPrice?: number;

  isVeg: boolean;
  isAvailable: boolean;
  isRecommended: boolean;

  createdAt: string;
  updatedAt: string;

  category?: Category;
}

export interface Customer {
  _id: string;

  restaurantId: string;

  name: string;

  mobile: string;

  address?: string;

  isBlocked: boolean;

  totalOrders: number;
  totalSpent: number;

  lastOrderAt?: string;

  /** Distinct order types this customer has used — populated by backend aggregation */
  orderTypes?: ('DINE_IN' | 'DELIVERY')[];

  createdAt: string;
  updatedAt?: string;
}

export type OrderStatus =
  | "PENDING"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export type OrderType =
  | "DINE_IN"
  | "DELIVERY";

export interface OrderItem {
  menuId: string;

  name: string;

  image?: string;

  price: number;

  quantity: number;

  subtotal: number;

  itemNote?: string;
}

export interface Order {
  _id: string;

  restaurantId: string;

  orderNumber: string;

  customerId?: Customer;

  orderType: OrderType;

  tableNumber?: number;

  items: OrderItem[];

  totalItems: number;

  subtotalAmount: number;

  deliveryCharge?: number;

  taxAmount?: number;

  discountAmount?: number;

  totalAmount: number;

  note?: string;

  address?: string;

  status: OrderStatus;

  paymentStatus?: string;

  estimatedTime?: number;

  feedbackSubmitted?: boolean;

  acceptedAt?: string;

  completedAt?: string;

  rejectedAt?: string;

  rejectionReason?: string;

  cancellationReason?: string;

  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;

  title: string;

  message: string;

  type?: string;

  isRead?: boolean;

  createdAt?: string;
}

export interface DashboardStats {
  totalOrders: number;

  totalRevenue: number;

  totalCustomers: number;

  pendingOrders: number;
}