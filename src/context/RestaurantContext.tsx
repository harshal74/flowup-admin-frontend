import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

import API from "../lib/api";
import type { Restaurant } from "../types";

interface RestaurantContextType {
  restaurant: Restaurant | null;
  isLoading: boolean;

  updateRestaurant: (
    data: Partial<Restaurant>
  ) => Promise<{
    success: boolean;
    error?: string;
  }>;

  toggleOpen: () => Promise<void>;
  toggleFeedback: () => Promise<void>;
  toggleWhatsapp: () => Promise<void>;

  refreshRestaurant: () => Promise<void>;
}

const RestaurantContext =
  createContext<
    RestaurantContextType | undefined
  >(undefined);

export function RestaurantProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [restaurant, setRestaurant] =
    useState<Restaurant | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const fetchRestaurant =
    useCallback(async () => {
      try {
        setIsLoading(true);

        const response =
          await API.get("/settings");

        const data = response.data.data;
        setRestaurant(data);

        // Update browser tab title and favicon from restaurant settings
        if (data?.restaurantName) {
          document.title = `${data.restaurantName} — Admin`;
        }
        if (data?.restaurantLogo) {
          const link: HTMLLinkElement =
            document.querySelector("link[rel~='icon']") || document.createElement('link');
          link.rel = 'icon';
          link.href = data.restaurantLogo;
          document.head.appendChild(link);
        }
      } catch (error) {
        console.error(
          "Error fetching settings:",
          error
        );
      } finally {
        setIsLoading(false);
      }
    }, []);

  useEffect(() => {
    fetchRestaurant();
  }, [fetchRestaurant]);

  const updateRestaurant =
    async (
      data: Partial<Restaurant>
    ): Promise<{
      success: boolean;
      error?: string;
    }> => {
      try {
        await API.put(
          "/settings",
          data
        );

        await fetchRestaurant();

        return {
          success: true,
        };
      } catch (error: any) {
        return {
          success: false,
          error:
            error?.response?.data
              ?.message ||
            "Failed to update settings",
        };
      }
    };

  const toggleOpen = async () => {
    try {
      if (restaurant?.shopOpen) {
        await API.patch("/settings/close");
      } else {
        await API.patch("/settings/open");
      }
      await fetchRestaurant();
    } catch (error: any) {
      // BUG G FIX: surface error so caller can show toast
      console.error("toggleOpen error:", error);
      throw error;
    }
  };

  const toggleFeedback = async () => {
    try {
      await API.patch("/settings/feedback");
      await fetchRestaurant();
    } catch (error: any) {
      console.error("toggleFeedback error:", error);
      throw error;
    }
  };

  const toggleWhatsapp = async () => {
    try {
      await API.patch("/settings/whatsapp");
      await fetchRestaurant();
    } catch (error: any) {
      console.error("toggleWhatsapp error:", error);
      throw error;
    }
  };

  return (
    <RestaurantContext.Provider
      value={{
        restaurant,
        isLoading,
        updateRestaurant,
        toggleOpen,
        toggleFeedback,
        toggleWhatsapp,
        refreshRestaurant:
          fetchRestaurant,
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurant() {
  const context =
    useContext(
      RestaurantContext
    );

  if (!context) {
    throw new Error(
      "useRestaurant must be used within a RestaurantProvider"
    );
  }

  return context;
}