import { PaymentResponse, PaymentStatusResponse } from "@/types/payment";
import { authService } from "./authServices.service";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export const paymentService = {
  createPayment: async (body: {
    subscriptionId?: string;
    planId?: string;
    description?: string;
  }): Promise<PaymentResponse> => {
    try {
      const token = await authService.getToken();

      console.log("Creating payment with body:", body);

      const response = await fetch(`${API_BASE_URL}/payment/create`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to create payment");
      }

      const data = await response.json();
      console.log("Payment response:", data);
      return data;
    } catch (error) {
      console.error("Error creating payment:", error);
      throw error;
    }
  },

  checkPaymentStatus: async (
    orderCode: string
  ): Promise<PaymentStatusResponse> => {
    try {
      const token = await authService.getToken();

      const response = await fetch(
        `${API_BASE_URL}/payment/check-status/${orderCode}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to check payment status");
      }

      return await response.json();
    } catch (error) {
      console.error("Error checking payment status:", error);
      throw error;
    }
  },

  refreshPaymentStatus: async (
    orderCode: string
  ): Promise<PaymentStatusResponse> => {
    try {
      const token = await authService.getToken();

      const response = await fetch(
        `${API_BASE_URL}/payment/refresh/${orderCode}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Refresh endpoint not implemented");
        }
        throw new Error(
          `HTTP ${response.status}: Failed to refresh payment status`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Error refreshing payment status:", error);
      throw error;
    }
  },

  verifyPaymentStatus: async (
    orderCode: string
  ): Promise<PaymentStatusResponse> => {
    try {
      const token = await authService.getToken();

      const response = await fetch(
        `${API_BASE_URL}/payment/verify/${orderCode}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Verify endpoint not implemented");
        }
        throw new Error(
          `HTTP ${response.status}: Failed to verify payment status`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Error verifying payment status:", error);
      throw error;
    }
  },
};

export default paymentService;
