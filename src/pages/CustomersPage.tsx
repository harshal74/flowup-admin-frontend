import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Eye, UserX, UserCheck, Phone, Calendar,
  DollarSign, ShoppingBag, X, MapPin,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, Utensils, Bike,
} from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../lib/api';
import type { Customer, Order } from '../types';

type SortField      = 'name' | 'totalOrders' | 'totalSpent' | 'lastOrderAt' | 'createdAt';
type SortDir        = 'asc' | 'desc';
type OrderTypeFilter = '' | 'DINE_IN' | 'DELIVERY';

export function CustomersPage() {
  const [customers, setCustomers]         = useState<Customer[]>([]);
  const [isLoading, setIsLoading]         = useState(true);
  const [searchQuery, setSearchQuery]     = useState('');
  const [sortField, setSortField]         = useState<SortField>('lastOrderAt');
  const [sortDir, setSortDir]             = useState<SortDir>('desc');
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderTypeFilter>('');
  const [showFilters, setShowFilters]     = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders]     = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading]       = useState(false);
  const [showDrawer, setShowDrawer]             = useState(false);
  const [updatingId, setUpdatingId]             = useState<string | null>(null);

  useEffect(() => { fetchCustomers(); }, []);

  const fetchCustomers = async () => {
    try {
      setIsLoading(true);
      const res = await API.get('/customers');
      setCustomers(res.data.data || []);
    } catch {
      toast.error('Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleBlock = async (customer: Customer) => {
    try {
      setUpdatingId(customer._id);
      await API.patch(`/customers/${customer._id}/${customer.isBlocked ? 'unblock' : 'block'}`);
      toast.success(customer.isBlocked ? 'Customer unblocked' : 'Customer blocked');
      fetchCustomers();
      if (selectedCustomer?._id === customer._id) {
        setSelectedCustomer({ ...selectedCustomer, isBlocked: !customer.isBlocked });
      }
    } catch {
      toast.error('Failed to update customer');
    } finally {
      setUpdatingId(null);
    }
  };

  const openDrawer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerOrders([]);
    setShowDrawer(true);
    try {
      setOrdersLoading(true);
      const res = await API.get(`/customers/${customer._id}/orders`);
      setCustomerOrders(res.data.data || []);
    } catch {
      console.error('Failed to load orders');
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-primary-500" />
      : <ArrowDown className="w-3 h-3 text-primary-500" />;
  };

  // ── Filter + sort — works immediately from data returned by API ──
  const displayCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase();

    const filtered = customers.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(q) ||
        c.mobile.includes(q) ||
        (c.address || '').toLowerCase().includes(q);

      // orderTypes is populated by the backend aggregation on every load
      const matchType = !orderTypeFilter || (c.orderTypes ?? []).includes(orderTypeFilter as 'DINE_IN' | 'DELIVERY');

      return matchSearch && matchType;
    });

    return [...filtered].sort((a, b) => {
      let av: any, bv: any;
      if      (sortField === 'name')         { av = a.name.toLowerCase();   bv = b.name.toLowerCase(); }
      else if (sortField === 'totalOrders')  { av = a.totalOrders;          bv = b.totalOrders; }
      else if (sortField === 'totalSpent')   { av = a.totalSpent;           bv = b.totalSpent; }
      else if (sortField === 'lastOrderAt')  {
        av = a.lastOrderAt ? new Date(a.lastOrderAt).getTime() : 0;
        bv = b.lastOrderAt ? new Date(b.lastOrderAt).getTime() : 0;
      } else {
        av = new Date(a.createdAt).getTime();
        bv = new Date(b.createdAt).getTime();
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [customers, searchQuery, sortField, sortDir, orderTypeFilter]);

  const formatDate = (date?: string) =>
    date ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';

  const formatDateTime = (date?: string) =>
    date ? new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }) : 'N/A';

  // ── Loading skeleton ─────────────────────────────────────────
  if (isLoading) return (
    <div className="animate-pulse space-y-4">
      <div className="skeleton h-10 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="card p-6">
            <div className="skeleton h-16 w-16 rounded-full mx-auto mb-4" />
            <div className="skeleton h-4 w-24 mx-auto mb-2" />
            <div className="skeleton h-3 w-32 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">

      {/* ── Header ───────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Customers</h1>
        <p className="text-secondary-500 dark:text-secondary-400 text-sm">
          {customers.length} total · {customers.filter((c) => !c.isBlocked).length} active
        </p>
      </div>

      {/* ── Search + Filter toggle + Sort ────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-start sm:items-center">

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, phone or address…"
            className="input pl-10 py-2 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn text-sm py-2 ${orderTypeFilter ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Filter className="w-4 h-4" /> Filter
          {orderTypeFilter && (
            <span className="ml-1 text-xs bg-white/30 rounded-full px-1.5 py-0.5">1</span>
          )}
        </button>

        {orderTypeFilter && (
          <button onClick={() => setOrderTypeFilter('')} className="btn btn-secondary text-sm py-2">
            <X className="w-4 h-4" /> Clear
          </button>
        )}

        {/* Sort pills */}
        <div className="flex items-center gap-1 bg-secondary-100 dark:bg-secondary-700 rounded-xl px-2 py-1.5 flex-wrap">
          <span className="text-xs text-secondary-400 pr-1 shrink-0">Sort:</span>
          {([
            { field: 'name'        as SortField, label: 'Name'   },
            { field: 'lastOrderAt' as SortField, label: 'Recent' },
            { field: 'totalOrders' as SortField, label: 'Orders' },
            { field: 'totalSpent'  as SortField, label: 'Spent'  },
            { field: 'createdAt'   as SortField, label: 'Joined' },
          ]).map(({ field, label }) => (
            <button
              key={field}
              onClick={() => handleSort(field)}
              className={`flex items-center gap-0.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                sortField === field
                  ? 'bg-white dark:bg-secondary-600 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-200'
              }`}
            >
              {label} <SortIcon field={field} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Filter panel ─────────────────────────────────────── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="card p-4">
              <label className="label mb-3">Order Type Preference</label>
              <div className="flex gap-2 flex-wrap">
                {([
                  { value: '' as OrderTypeFilter,         label: 'All',      icon: null     },
                  { value: 'DINE_IN'  as OrderTypeFilter, label: 'Dine In',  icon: Utensils },
                  { value: 'DELIVERY' as OrderTypeFilter, label: 'Delivery', icon: Bike     },
                ]).map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setOrderTypeFilter(value)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                      orderTypeFilter === value
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'bg-secondary-50 dark:bg-secondary-700/50 text-secondary-600 dark:text-secondary-300 border-secondary-200 dark:border-secondary-600 hover:border-primary-300'
                    }`}
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Customer Grid ─────────────────────────────────────── */}
      {displayCustomers.length === 0 ? (
        <div className="card p-12 text-center">
          <UserCheck className="w-16 h-16 mx-auto text-secondary-300 dark:text-secondary-600 mb-4" />
          <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-2">No customers found</h3>
          <p className="text-secondary-500 dark:text-secondary-400 text-sm">
            {searchQuery || orderTypeFilter
              ? 'Try adjusting your search or filter'
              : 'Customers appear here when they place orders'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {displayCustomers.map((customer, index) => (
              <motion.div
                key={customer._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: Math.min(index * 0.04, 0.3) }}
                className={`card p-5 flex flex-col gap-4 ${customer.isBlocked ? 'opacity-60' : ''}`}
              >
                {/* Avatar + name */}
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0 ${
                    customer.isBlocked ? 'bg-red-500' : 'bg-primary-500'
                  }`}>
                    {customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-secondary-900 dark:text-white truncate">{customer.name}</h3>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      {customer.isBlocked && (
                        <span className="text-xs text-red-500 font-medium">Blocked</span>
                      )}
                      {/* Order type badges from aggregated data */}
                      {(customer.orderTypes ?? []).map((type) => (
                        <span key={type} className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          type === 'DINE_IN'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}>
                          {type === 'DINE_IN' ? 'Dine In' : 'Delivery'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Contact info */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-secondary-600 dark:text-secondary-400">
                    <Phone className="w-3.5 h-3.5 shrink-0 text-secondary-400" />
                    <span className="truncate">{customer.mobile}</span>
                  </div>
                  {customer.address && (
                    <div className="flex items-start gap-2 text-sm text-secondary-600 dark:text-secondary-400">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-secondary-400 mt-0.5" />
                      <span className="line-clamp-2">{customer.address}</span>
                    </div>
                  )}
                  {customer.lastOrderAt && (
                    <div className="flex items-center gap-2 text-xs text-secondary-400">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>Last order {formatDate(customer.lastOrderAt)}</span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-secondary-50 dark:bg-secondary-700/50 text-center">
                    <p className="text-lg font-bold text-secondary-900 dark:text-white">{customer.totalOrders}</p>
                    <p className="text-xs text-secondary-400">Orders</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-secondary-50 dark:bg-secondary-700/50 text-center">
                    <p className="text-lg font-bold text-green-600">₹{customer.totalSpent.toFixed(0)}</p>
                    <p className="text-xs text-secondary-400">Spent</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-auto">
                  <button onClick={() => openDrawer(customer)} className="btn btn-secondary flex-1 py-2 text-sm">
                    <Eye className="w-4 h-4" /> View
                  </button>
                  <button
                    onClick={() => handleToggleBlock(customer)}
                    disabled={updatingId === customer._id}
                    className={`btn flex-1 py-2 text-sm ${customer.isBlocked ? 'btn-success' : 'btn-danger'}`}
                  >
                    {customer.isBlocked
                      ? <><UserCheck className="w-4 h-4" /> Unblock</>
                      : <><UserX className="w-4 h-4" /> Block</>
                    }
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Customer Detail Drawer ────────────────────────────── */}
      <AnimatePresence>
        {showDrawer && selectedCustomer && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowDrawer(false)}
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white dark:bg-secondary-800 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-200 dark:border-secondary-700 shrink-0">
                <h2 className="text-lg font-bold text-secondary-900 dark:text-white">Customer Details</h2>
                <button
                  onClick={() => setShowDrawer(false)}
                  className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors"
                >
                  <X className="w-5 h-5 text-secondary-500" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">

                {/* Avatar */}
                <div className="text-center">
                  <div className={`w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center text-white font-bold text-2xl ${
                    selectedCustomer.isBlocked ? 'bg-red-500' : 'bg-primary-500'
                  }`}>
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="text-xl font-bold text-secondary-900 dark:text-white">{selectedCustomer.name}</h3>
                  <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                    {selectedCustomer.isBlocked && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                        Blocked
                      </span>
                    )}
                    {(selectedCustomer.orderTypes ?? []).map((type) => (
                      <span key={type} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        type === 'DINE_IN'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}>
                        {type === 'DINE_IN' ? 'Dine In' : 'Delivery'}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="card p-4 text-center">
                    <ShoppingBag className="w-5 h-5 mx-auto text-primary-500 mb-1.5" />
                    <p className="text-2xl font-bold text-secondary-900 dark:text-white">{selectedCustomer.totalOrders}</p>
                    <p className="text-xs text-secondary-400">Total Orders</p>
                  </div>
                  <div className="card p-4 text-center">
                    <DollarSign className="w-5 h-5 mx-auto text-green-500 mb-1.5" />
                    <p className="text-2xl font-bold text-secondary-900 dark:text-white">₹{selectedCustomer.totalSpent.toFixed(0)}</p>
                    <p className="text-xs text-secondary-400">Total Spent</p>
                  </div>
                </div>

                {/* Contact info */}
                <div className="card p-4 space-y-3">
                  <h3 className="font-semibold text-secondary-900 dark:text-white text-sm">Contact Information</h3>
                  <div className="flex items-center gap-3 text-sm text-secondary-700 dark:text-secondary-300">
                    <Phone className="w-4 h-4 text-secondary-400 shrink-0" />
                    <span>{selectedCustomer.mobile}</span>
                  </div>
                  {selectedCustomer.address ? (
                    <div className="flex items-start gap-3 text-sm text-secondary-700 dark:text-secondary-300">
                      <MapPin className="w-4 h-4 text-secondary-400 shrink-0 mt-0.5" />
                      <span>{selectedCustomer.address}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-sm text-secondary-400">
                      <MapPin className="w-4 h-4 shrink-0" />
                      <span className="italic">No address on file</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm text-secondary-700 dark:text-secondary-300">
                    <Calendar className="w-4 h-4 text-secondary-400 shrink-0" />
                    <span>Joined {formatDate(selectedCustomer.createdAt)}</span>
                  </div>
                  {selectedCustomer.lastOrderAt && (
                    <div className="flex items-center gap-3 text-sm text-secondary-700 dark:text-secondary-300">
                      <ShoppingBag className="w-4 h-4 text-secondary-400 shrink-0" />
                      <span>Last order {formatDateTime(selectedCustomer.lastOrderAt)}</span>
                    </div>
                  )}
                </div>

                {/* Order history */}
                <div className="card p-4">
                  <h3 className="font-semibold text-secondary-900 dark:text-white text-sm mb-3">
                    Order History
                    {customerOrders.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-secondary-400">
                        ({customerOrders.length} orders)
                      </span>
                    )}
                  </h3>
                  {ordersLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => <div key={i} className="skeleton h-14 w-full rounded-xl" />)}
                    </div>
                  ) : customerOrders.length === 0 ? (
                    <p className="text-sm text-secondary-400 text-center py-6">No orders yet</p>
                  ) : (
                    <div className="space-y-2">
                      {customerOrders.map((order) => (
                        <div
                          key={order._id}
                          className="flex items-center justify-between p-3 rounded-xl bg-secondary-50 dark:bg-secondary-700/50 gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-secondary-900 dark:text-white text-sm">
                                #{order.orderNumber}
                              </p>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                order.orderType === 'DINE_IN'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              }`}>
                                {order.orderType === 'DINE_IN' ? 'Dine In' : 'Delivery'}
                              </span>
                            </div>
                            <p className="text-xs text-secondary-400 mt-0.5">{formatDateTime(order.createdAt)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-semibold text-secondary-900 dark:text-white text-sm">
                              ₹{order.totalAmount.toFixed(2)}
                            </p>
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                              order.status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'  :
                              order.status === 'PENDING'   ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'  :
                              order.status === 'REJECTED'  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'          :
                              'bg-secondary-100 text-secondary-600 dark:bg-secondary-700 dark:text-secondary-300'
                            }`}>
                              {order.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Block / Unblock */}
                <button
                  onClick={() => handleToggleBlock(selectedCustomer)}
                  disabled={updatingId === selectedCustomer._id}
                  className={`btn w-full ${selectedCustomer.isBlocked ? 'btn-success' : 'btn-danger'}`}
                >
                  {selectedCustomer.isBlocked
                    ? <><UserCheck className="w-5 h-5" /> Unblock Customer</>
                    : <><UserX className="w-5 h-5" /> Block Customer</>
                  }
                </button>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
