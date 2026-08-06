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

// Called when admin clicks Cancel — reverses the bill
export const cancelBill = async (billId: string) => {
  const response = await API.delete(`/billing/${billId}`);
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
