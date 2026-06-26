import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  ShoppingBag,
  FolderTree,
  UtensilsCrossed,
  Users,
  Settings,
  LogOut,
  X,
  ChefHat,
  Bell,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useRestaurant } from '../../context/RestaurantContext';
import { useNotification } from '../../context/NotificationContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const menuItems = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    path: '/orders',
    label: 'Orders',
    icon: ShoppingBag,
  },
  {
    path: '/categories',
    label: 'Categories',
    icon: FolderTree,
  },
  {
    path: '/menu',
    label: 'Menu',
    icon: UtensilsCrossed,
  },
  {
    path: '/customers',
    label: 'Customers',
    icon: Users,
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: Settings,
  },
];


export function Sidebar({
  isOpen,
  onClose,
}: SidebarProps) {
  const { logout } = useAuth();
  const { restaurant } = useRestaurant();
  const { pendingOrders } = useNotification();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const handleNavClick = () => {
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
  x:
    typeof window !== "undefined" &&
    window.innerWidth >= 1024
      ? 0
      : isOpen
      ? 0
      : "-100%",
}}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
        }}
        className="
          fixed
          lg:static
          inset-y-0
          left-0
          z-50
          w-72
          lg:w-64
          bg-white
          dark:bg-secondary-800
          border-r
          border-secondary-200
          dark:border-secondary-700
          flex
          flex-col
          lg:translate-x-0
        "
      >
        {/* Header */}
        <div className="p-6 border-b border-secondary-200 dark:border-secondary-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
  className="
    w-10
    h-10
    rounded-xl
    overflow-hidden
    bg-white
    flex
    items-center
    justify-center
    border
    border-secondary-200
  "
>
  {restaurant?.restaurantLogo ? (
    <img
      src={restaurant.restaurantLogo}
      alt={
        restaurant.restaurantName ||
        "Restaurant Logo"
      }
      className="
        w-full
        h-full
        object-cover
      "
    />
  ) : (
    <ChefHat
      className="
        w-5
        h-5
        text-primary-500
      "
    />
  )}
</div>

              <div>
                <h1 className="font-bold text-lg text-secondary-900 dark:text-white">
                  FlowUp
                </h1>
                <p className="text-xs text-secondary-500">
                  Admin Panel
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Close Sidebar"
              className="
                lg:hidden
                p-2
                rounded-lg
                hover:bg-secondary-100
                dark:hover:bg-secondary-700
                text-secondary-500
              "
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Restaurant Info */}
        {restaurant && (
  <div
    className="
      px-4
      py-3
      mx-4
      mt-4
      rounded-xl
      bg-primary-50
      dark:bg-primary-900/20
    "
  >
    <p className="text-xs text-primary-600 dark:text-primary-400 font-medium">
      Restaurant
    </p>

    <p className="text-sm font-semibold text-secondary-900 dark:text-white truncate">
      {restaurant?.restaurantName || "Restaurant"}
    </p>

    <div className="flex items-center gap-1 mt-1">
      <span
        className={`w-2 h-2 rounded-full ${
          restaurant.shopOpen
            ? "bg-success-500"
            : "bg-danger-500"
        }`}
      />

      <span className="text-xs text-secondary-500 dark:text-secondary-400">
        {restaurant.shopOpen
          ? "Open"
          : "Closed"}
      </span>
    </div>
  </div>
)}

        {/* Navigation */}
       <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
  {menuItems.map((item) => {
    const hasPendingOrders =
      item.path === "/orders" &&
      (pendingOrders?.length || 0) > 0;

    return (
      <NavLink
        key={item.path}
        to={item.path}
        onClick={handleNavClick}
        className={({ isActive }) =>
          `
          sidebar-link
          ${isActive ? "active" : ""}
          ${
            hasPendingOrders
              ? "bg-warning-50 dark:bg-warning-900/20 border border-warning-300 dark:border-warning-700"
              : ""
          }
        `
        }
      >
        <item.icon className="w-5 h-5" />

        <span>{item.label}</span>

        {hasPendingOrders && (
          <span
            className="
              ml-auto
              min-w-[20px]
              h-5
              px-1
              flex
              items-center
              justify-center
              rounded-full
              bg-danger-500
              text-white
              text-xs
              font-bold
              animate-pulse
            "
          >
            {(pendingOrders?.length || 0) > 99
              ? "99+"
              : pendingOrders?.length || 0}
          </span>
        )}
      </NavLink>
    );
  })}
</nav>

        {/* New Orders Alert */}
        {pendingOrders.length > 0 && (
          <div
            className="
              px-4
              py-3
              mx-4
              mb-2
              rounded-xl
              bg-warning-50
              dark:bg-warning-900/20
              border
              border-warning-200
              dark:border-warning-800
            "
          >
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-warning-600 animate-bounce" />

              <span className="text-sm font-medium text-warning-700 dark:text-warning-400">
                {pendingOrders.length} new order
                {pendingOrders.length > 1 ? 's' : ''}!
              </span>
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="p-4 border-t border-secondary-200 dark:border-secondary-700">
          <button
            onClick={handleLogout}
            aria-label="Logout"
            className="
              sidebar-link
              w-full
              text-danger-600
              dark:text-danger-400
              hover:bg-danger-50
              dark:hover:bg-danger-900/20
            "
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </motion.aside>
    </>
  );
}