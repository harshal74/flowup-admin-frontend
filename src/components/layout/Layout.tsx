import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { NewOrderAlert } from "../notifications/NewOrderAlert";
import { WaiterRequestToast } from "../notifications/WaiterRequestToast";

export function Layout() {
  const [sidebarOpen, setSidebarOpen] =
    useState(
      typeof window !== "undefined" &&
        window.innerWidth >= 1024
    );

  return (
    <div className="flex h-screen overflow-hidden bg-secondary-50 dark:bg-secondary-900">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {/* New order full-screen alert */}
      <NewOrderAlert />

      {/* Waiter request toasts — top-right stack, auto-dismiss after 4 s */}
      <WaiterRequestToast />
    </div>
  );
}