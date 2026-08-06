import { Search, RefreshCw } from "lucide-react";

interface BillingFilterProps {
  customer: string;
  table: string;
  onCustomerChange: (value: string) => void;
  onTableChange: (value: string) => void;
  onRefresh: () => void;
}

export default function BillingFilter({
  customer,
  table,
  onCustomerChange,
  onTableChange,
  onRefresh,
}: BillingFilterProps) {
  return (
    <div className="flex flex-col lg:flex-row gap-4">

      {/* Customer Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />

        <input
          type="text"
          placeholder="Search customer..."
          value={customer}
          onChange={(e) =>
            onCustomerChange(e.target.value)
          }
          className="input pl-10"
        />
      </div>

      {/* Table Search */}
      <div className="w-full lg:w-48">
        <input
          type="number"
          placeholder="Table No."
          value={table}
          onChange={(e) =>
            onTableChange(e.target.value)
          }
          className="input"
        />
      </div>

      {/* Refresh */}
      <button
        onClick={onRefresh}
        className="btn btn-secondary"
      >
        <RefreshCw className="w-4 h-4" />

        Refresh
      </button>
    </div>
  );
}