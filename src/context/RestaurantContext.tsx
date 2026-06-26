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

        setRestaurant(
          response.data.data
        );
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

  const toggleOpen =
    async () => {
      try {
        if (
          restaurant?.shopOpen
        ) {
          await API.patch(
            "/settings/close"
          );
        } else {
          await API.patch(
            "/settings/open"
          );
        }

        await fetchRestaurant();
      } catch (error) {
        console.error(error);
      }
    };

  const toggleFeedback =
    async () => {
      try {
        await API.patch(
          "/settings/feedback"
        );

        await fetchRestaurant();
      } catch (error) {
        console.error(error);
      }
    };

  const toggleWhatsapp =
    async () => {
      try {
        await API.patch(
          "/settings/whatsapp"
        );

        await fetchRestaurant();
      } catch (error) {
        console.error(error);
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