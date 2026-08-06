import { Receipt, CreditCard } from "lucide-react";

interface BillingSummaryProps {
  selectedCount: number;
  subtotal: number;
  gst: number;
  discount: number;
  paymentMethod: string;
  loading: boolean;

  onDiscountChange: (value: number) => void;
  onPaymentMethodChange: (value: string) => void;
  onGenerateBill: () => void;
}

export default function BillingSummary({
  selectedCount,
  subtotal,
  gst,
  discount,
  paymentMethod,
  loading,
  onDiscountChange,
  onPaymentMethodChange,
  onGenerateBill,
}: BillingSummaryProps) {
  const grandTotal = Math.max(0, subtotal + gst - discount);

  return (
    <div className="card p-6 sticky top-6">

      <div className="flex items-center gap-2 mb-6">
        <Receipt className="w-5 h-5 text-primary-600" />
        <h2 className="text-lg font-bold">
          Bill Summary
        </h2>
      </div>

      {/* Selected Orders */}

      <div className="flex justify-between mb-3">

        <span className="text-secondary-500">
          Selected Orders
        </span>

        <span className="font-semibold">
          {selectedCount}
        </span>

      </div>

      {/* Subtotal */}

      <div className="flex justify-between mb-3">

        <span className="text-secondary-500">
          Subtotal
        </span>

        <span>
          ₹{subtotal.toFixed(2)}
        </span>

      </div>

      {/* GST */}

      <div className="flex justify-between mb-3">

        <span className="text-secondary-500">
          GST (5%)
        </span>

        <span>
          ₹{gst.toFixed(2)}
        </span>

      </div>

      {/* Discount */}

      <div className="mb-4">

        <label className="label">
          Discount
        </label>

        <input
          type="number"
          min={0}
          value={discount}
          onChange={(e) =>
            onDiscountChange(Math.max(0, Number(e.target.value)))
          }
          className="input"
          placeholder="0"
        />

      </div>

      {/* Payment */}

      <div className="mb-5">

        <label className="label">
          Payment Method
        </label>

        <select
          value={paymentMethod}
          onChange={(e) =>
            onPaymentMethodChange(e.target.value)
          }
          className="input"
        >
          <option value="Cash">
            Cash
          </option>

          <option value="UPI">
            UPI
          </option>

          <option value="Card">
            Card
          </option>
        </select>

      </div>

      <div className="border-t border-secondary-200 dark:border-secondary-700 pt-4">

        <div className="flex justify-between text-lg font-bold">

          <span>Grand Total</span>

          <span className="text-green-600">
            ₹{grandTotal.toFixed(2)}
          </span>

        </div>

      </div>

      <button
        onClick={onGenerateBill}
        disabled={selectedCount === 0 || loading}
        className="btn btn-primary w-full mt-6"
      >
        <CreditCard className="w-4 h-4" />

        {loading
          ? "Generating..."
          : "Generate Bill"}
      </button>

    </div>
  );
}