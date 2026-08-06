import React from "react";
import { Eye } from "lucide-react";
import { Order } from "../../types";

interface BillingTableProps {
  orders: Order[];
  selectedOrders: string[];
  onSelectOrder: (orderId: string) => void;
  onSelectAll: () => void;
  onViewOrder: (order: Order) => void;
  loading: boolean;
}

export default function BillingTable({
  orders,
  selectedOrders,
  onSelectOrder,
  onSelectAll,
  onViewOrder,
  loading,
}: BillingTableProps) {
  if (loading) {
    return (
      <div className="card p-8 text-center">
        <p className="text-secondary-500">
          Loading unpaid orders...
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">

      <div className="overflow-x-auto">

        <table className="w-full">

          <thead className="bg-secondary-50 dark:bg-secondary-700">

            <tr>

              <th className="px-4 py-3">

                <input
                  type="checkbox"
                  checked={
                    orders.length > 0 &&
                    selectedOrders.length === orders.length
                  }
                  onChange={onSelectAll}
                />

              </th>

              <th className="px-4 py-3 text-left">
                Order
              </th>

              <th className="px-4 py-3 text-left">
                Customer
              </th>

              <th className="px-4 py-3 text-left">
                Table
              </th>

              <th className="px-4 py-3 text-left">
                Amount
              </th>

              <th className="px-4 py-3 text-left">
                Date
              </th>

              <th className="px-4 py-3 text-center">
                View
              </th>

            </tr>

          </thead>

          <tbody>

            {orders.length === 0 ? (

              <tr>

                <td
                  colSpan={7}
                  className="text-center py-10 text-secondary-500"
                >
                  No unpaid orders found.
                </td>

              </tr>

            ) : (

              orders.map((order) => (

                <tr
                  key={order._id}
                  className="border-b hover:bg-secondary-50 dark:hover:bg-secondary-700/30"
                >

                  <td className="px-4 py-4">

                    <input
                      type="checkbox"
                      checked={selectedOrders.includes(order._id)}
                      onChange={() =>
                        onSelectOrder(order._id)
                      }
                    />

                  </td>

                  <td className="px-4 py-4 font-semibold">
                    #{order.orderNumber}
                  </td>

                  <td className="px-4 py-4">

                    <div>

                      <p className="font-medium">
                        {order.customerId?.name}
                      </p>

                      <p className="text-xs text-secondary-500">
                        {order.customerId?.mobile}
                      </p>

                    </div>

                  </td>

                  <td className="px-4 py-4">

                    {order.tableNumber
                      ? `T-${order.tableNumber}`
                      : "-"}

                  </td>

                  <td className="px-4 py-4 font-semibold text-green-600">

                    ₹{order.totalAmount.toFixed(2)}

                  </td>

                  <td className="px-4 py-4 text-secondary-500">

                    {new Date(
                      order.createdAt
                    ).toLocaleString()}

                  </td>

                  <td className="px-4 py-4 text-center">
                    <button
                      onClick={() => onViewOrder(order)}
                      className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors"
                      title="View order details"
                    >
                      <Eye className="w-4 h-4 text-secondary-500" />
                    </button>
                  </td>

                </tr>

              ))

            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}