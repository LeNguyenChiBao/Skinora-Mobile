import { SubscriptionPlansResponse } from "@/types/subscription";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export const subscriptionService = {
  getPlans: async (): Promise<SubscriptionPlansResponse> => {
    try {
      const response = await fetch(`${API_BASE_URL}/subscription/plans`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch subscription plans");
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching subscription plans:", error);
      throw error;
    }
  },
};
