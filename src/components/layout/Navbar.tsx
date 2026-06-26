import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, Bell, Sun, Moon, User, LogOut, Settings,
  Check, X, Volume2, VolumeX, ShoppingBag, BellRing,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotification } from '../../context/NotificationContext';
import { useRestaurant } from '../../context/RestaurantContext';
import type { Order } from '../../types';

interface NavbarProps { onMenuClick: () => void; }

export function Navbar({ onMenuClick }: NavbarProps) {
  const { user, logout }       = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { restaurant }          = useRestaurant();
  const {
    unreadCount,
    isRinging,
    pendingOrders,
    acceptOrder,
    rejectOrder,
    soundEnabled,
    toggleSound,
    waiterRequests,
    dismissWaiterRequest,
    clearAllWaiterRequests,
  } = useNotification();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile]             = useState(false);
  const [rejectingOrder, setRejectingOrder]        = useState<Order | null>(null);
  const [rejectReason, setRejectReason]            = useState('');

  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef      = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node))
        setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setShowProfile(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAccept = async (orderId: string) => { await acceptOrder(orderId); };

  const handleReject = async () => {
    if (rejectingOrder && rejectReason.trim()) {
      await rejectOrder(rejectingOrder._id, rejectReason);
      setRejectingOrder(null);
      setRejectReason('');
    }
  };

  // Total notification count = pending orders + unread waiter requests
  const totalCount = unreadCount;
  const hasAny     = pendingOrders.length > 0 || waiterRequests.length > 0;

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-secondary-800/80 backdrop-blur-xl border-b border-secondary-200 dark:border-secondary-700">
        <div className="flex items-center justify-between px-4 lg:px-6 py-4">

          {/* Left — hamburger + restaurant name */}
          <div className="flex items-center gap-4">
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 rounded-xl hover:bg-secondary-100 dark:hover:bg-secondary-700 text-secondary-600 dark:text-secondary-400 transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-xl font-bold text-secondary-900 dark:text-white">
                {restaurant?.restaurantName || 'FlowUp Admin'}
              </h2>
              <p className="text-xs">
                {restaurant?.shopOpen
                  ? <span className="text-success-600">Restaurant Open</span>
                  : <span className="text-danger-600">Restaurant Closed</span>
                }
              </p>
            </div>
          </div>

          {/* Right — controls */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* Sound toggle */}
            <button onClick={toggleSound} className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors">
              {soundEnabled
                ? <Volume2 className="w-5 h-5 text-secondary-600 dark:text-secondary-400" />
                : <VolumeX className="w-5 h-5 text-danger-500" />
              }
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-secondary-100 dark:bg-secondary-700 hover:bg-secondary-200 dark:hover:bg-secondary-600 text-secondary-600 dark:text-secondary-400 transition-colors"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Notification bell */}
            <div ref={notificationRef} className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative p-2.5 rounded-xl transition-colors ${
                  isRinging
                    ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-600'
                    : 'bg-secondary-100 dark:bg-secondary-700 hover:bg-secondary-200 dark:hover:bg-secondary-600 text-secondary-600 dark:text-secondary-400'
                }`}
              >
                <Bell className={`w-5 h-5 ${isRinging ? 'animate-bounce' : ''}`} />
                {totalCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-danger-500 text-white text-xs font-bold animate-pulse">
                    {totalCount > 9 ? '9+' : totalCount}
                  </span>
                )}
              </button>

              {/* ── Notification dropdown ── */}
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0,  scale: 1    }}
                    exit={{   opacity: 0, y: 10, scale: 0.95  }}
                    className="absolute right-0 top-full mt-2 w-80 sm:w-96
                               bg-white dark:bg-secondary-800 rounded-2xl shadow-xl
                               border border-secondary-200 dark:border-secondary-700 overflow-hidden"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-secondary-200 dark:border-secondary-700">
                      <h3 className="font-semibold text-secondary-900 dark:text-white text-sm">
                        Notifications
                        {totalCount > 0 && (
                          <span className="ml-2 px-1.5 py-0.5 rounded-full bg-danger-100 text-danger-600 text-xs font-bold">
                            {totalCount}
                          </span>
                        )}
                      </h3>
                      {waiterRequests.length > 0 && (
                        <button
                          onClick={clearAllWaiterRequests}
                          className="text-xs text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-200 font-medium transition-colors"
                        >
                          Clear all
                        </button>
                      )}
                    </div>

                    {/* Body */}
                    <div className="max-h-96 overflow-y-auto divide-y divide-secondary-100 dark:divide-secondary-700">
                      {!hasAny ? (
                        <div className="p-8 text-center">
                          <Bell className="w-10 h-10 mx-auto text-secondary-300 dark:text-secondary-600 mb-2" />
                          <p className="text-secondary-500 dark:text-secondary-400 text-sm">No notifications</p>
                        </div>
                      ) : (
                        <>
                          {/* ── Waiter requests (persistent until cleared) ── */}
                          {waiterRequests.map((req) => (
                            <div
                              key={req._id}
                              className="flex items-start gap-3 px-4 py-3
                                         bg-orange-50/60 dark:bg-orange-900/10
                                         hover:bg-orange-50 dark:hover:bg-orange-900/20
                                         transition-colors"
                            >
                              {/* Orange bell icon */}
                              <div className="w-8 h-8 shrink-0 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mt-0.5">
                                <BellRing className="w-4 h-4 text-orange-500" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-secondary-900 dark:text-white">
                                  Table {req.tableNumber} — Needs assistance
                                </p>
                                <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-0.5">
                                  {req.customerName
                                    ? `Customer: ${req.customerName}`
                                    : 'Calling for a waiter'}
                                </p>
                                <p className="text-xs text-secondary-400 mt-0.5">
                                  {new Date(req.createdAt).toLocaleTimeString([], {
                                    hour: '2-digit', minute: '2-digit',
                                  })}
                                </p>
                              </div>

                              {/* Per-item clear button */}
                              <button
                                onClick={() => dismissWaiterRequest(req._id)}
                                className="shrink-0 p-1 rounded-lg
                                           hover:bg-orange-100 dark:hover:bg-orange-900/30
                                           text-secondary-400 hover:text-secondary-600
                                           transition-colors"
                                title="Dismiss"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}

                          {/* ── Pending food orders ── */}
                          {pendingOrders.map((order) => (
                            <div
                              key={order._id}
                              className="flex items-start gap-3 px-4 py-3
                                         bg-warning-50/60 dark:bg-warning-900/10
                                         hover:bg-warning-50 dark:hover:bg-warning-900/20
                                         transition-colors"
                            >
                              {/* Bag icon */}
                              <div className="w-8 h-8 shrink-0 rounded-lg bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center mt-0.5">
                                <ShoppingBag className="w-4 h-4 text-warning-600" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-secondary-900 dark:text-white">
                                  New Order — #{order.orderNumber}
                                </p>
                                <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-0.5">
                                  {order.customerId?.name || 'Guest'} · ₹{(order.totalAmount || 0).toFixed(0)}
                                  {order.tableNumber ? ` · Table ${order.tableNumber}` : ''}
                                </p>
                                <p className="text-xs text-secondary-400 mt-0.5">
                                  {new Date(order.createdAt).toLocaleTimeString([], {
                                    hour: '2-digit', minute: '2-digit',
                                  })}
                                </p>
                                {/* Accept / Reject inline */}
                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleAccept(order._id); }}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg
                                               bg-success-500 hover:bg-success-600
                                               text-white text-xs font-medium transition-colors"
                                  >
                                    <Check className="w-3 h-3" /> Accept
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setRejectingOrder(order); }}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg
                                               bg-danger-500 hover:bg-danger-600
                                               text-white text-xs font-medium transition-colors"
                                  >
                                    <X className="w-3 h-3" /> Reject
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile menu */}
            <div ref={profileRef} className="relative">
              <button
                onClick={() => setShowProfile(!showProfile)}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-primary-500 flex items-center justify-center text-white font-semibold">
                  {user?.name?.charAt(0) || 'A'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-secondary-900 dark:text-white">{user?.name || 'Admin'}</p>
                  <p className="text-xs text-secondary-500">Administrator</p>
                </div>
              </button>

              <AnimatePresence>
                {showProfile && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0,  scale: 1    }}
                    exit={{   opacity: 0, y: 10, scale: 0.95  }}
                    className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-secondary-800 rounded-xl shadow-xl border border-secondary-200 dark:border-secondary-700 overflow-hidden"
                  >
                    <div className="p-2">
                      <button onClick={() => setShowProfile(false)} className="sidebar-link w-full">
                        <User className="w-4 h-4" /> <span>Profile</span>
                      </button>
                      <button onClick={() => setShowProfile(false)} className="sidebar-link w-full">
                        <Settings className="w-4 h-4" /> <span>Settings</span>
                      </button>
                      <div className="border-t border-secondary-200 dark:border-secondary-700 my-2" />
                      <button
                        onClick={() => { logout(); setShowProfile(false); }}
                        className="sidebar-link w-full text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20"
                      >
                        <LogOut className="w-4 h-4" /> <span>Logout</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* Reject order modal */}
      <AnimatePresence>
        {rejectingOrder && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setRejectingOrder(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-secondary-800 rounded-2xl p-6"
            >
              <h3 className="text-lg font-bold text-secondary-900 dark:text-white mb-4">
                Reject Order #{rejectingOrder.orderNumber}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="label">Rejection Reason</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="input min-h-[100px]"
                    placeholder="e.g., Out of stock, Kitchen closed..."
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setRejectingOrder(null); setRejectReason(''); }} className="btn btn-secondary flex-1">Cancel</button>
                  <button onClick={handleReject} disabled={!rejectReason.trim()} className="btn btn-danger flex-1">Reject Order</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
