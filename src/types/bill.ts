import { Order } from "./index";

export interface Bill {
  _id: string;

  invoiceNumber: string;

  restaurantId: string;

  tableNumber: number;

  orderIds: Order[];

  subtotal: number;

  gst: number;

  discount: number;

  grandTotal: number;

  paymentMethod: "Cash" | "UPI" | "Card";

  paymentStatus: "Pending" | "Paid";

  createdAt: string;

  updatedAt: string;
}

export interface BillingFilters {
  customer: string;
  table: string;
}

export interface BillingSummary {
  subtotal: number;
  gst: number;
  discount: number;
  grandTotal: number;
}