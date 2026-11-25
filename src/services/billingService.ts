import API from "../lib/api";

export const getUnpaidOrders = async (customer = "", table = "") => {
  const params = new URLSearchParams();
  if (customer) params.append("customer", customer);
  if (table)    params.append("table", table);
  const response = await API.get(`/billing/orders?${params.toString()}`);
  return response.data;
};

export const generateBill = async (data: {
  orderIds: string[];
  discount?: number;
  paymentMethod?: string;
}) => {
  const response = await API.post("/billing/generate", data);
  return response.data;
};

// Called when admin clicks OK after payment
export const confirmPayment = async (billId: string) => {
  const response = await API.patch(`/billing/${billId}/confirm`);
  return response.data;
};

// Split a Pending bill (EQUAL / BY_ITEM / CUSTOM), or { splitType: "NONE" } to undo
export const splitBill = async (billId: string, data: object) => {
  const response = await API.patch(`/billing/${billId}/split`, data);
  return response.data;
};

// Mark one person's share as paid; response.billPaid === true when the bill is closed
export const confirmSplitPayment = async (billId: string, splitId: string, paymentMethod: string) => {
  const response = await API.patch(`/billing/${billId}/splits/${splitId}/confirm`, { paymentMethod });
  return response.data;
};

// Called when admin clicks Cancel — reverses the bill
export const cancelBill = async (billId: string) => {
  const response = await API.delete(`/billing/${billId}`);
  return response.data;
};

// Generated but not fully paid bills (incl. part-paid split bills)
export const getPendingBills = async () => {
  const response = await API.get("/billing/pending");
  return response.data;
};

export const getBillHistory = async () => {
  const response = await API.get("/billing/history");
  return response.data;
};

export const getBillById = async (billId: string) => {
  const response = await API.get(`/billing/${billId}`);
  return response.data;
};
