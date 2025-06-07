import { paymentService } from "@/services/payment.service";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking } from "react-native";

export const usePayment = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeepLink = async (event: { url: string }): Promise<void> => {
    const { url } = event;
    console.log("Deep link received:", url);

    if (url.includes("payment/success")) {
      const orderCode = url.split("orderCode=")[1]?.split("&")[0];
      if (orderCode) {
        await checkPaymentStatus(orderCode);
      } else {
        // Navigate to success even without orderCode
        router.push("/(stacks)/payment-success");
      }
    } else if (url.includes("payment/cancel")) {
      // Handle payment cancellation
      console.log("Payment cancelled by user");
      router.push("/(stacks)/payment-cancel");
    }
  };

  const checkPaymentStatus = async (orderCode: string): Promise<void> => {
    setIsLoading(true);

    try {
      // Only use basic status check
      const result = await paymentService.checkPaymentStatus(orderCode);
      console.log("Deep link payment check:", JSON.stringify(result, null, 2));

      const status = result.data?.status?.toLowerCase();
      if (result.success && (status === "paid" || status === "completed")) {
        // Clear pending payment on success
        await AsyncStorage.removeItem("pendingPayment");

        router.push({
          pathname: "/(stacks)/payment-success",
          params: { orderCode },
        });
        return;
      }

      // Handle other statuses
      if (status === "cancelled") {
        await AsyncStorage.removeItem("pendingPayment");
        router.push("/(stacks)/payment-cancel");
      } else {
        setError("Payment status: " + result.data?.status);
        // Don't navigate for pending - let user stay in app
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      console.error("Payment status check failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Check for initial URL when app starts
  useEffect(() => {
    const checkInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        handleDeepLink({ url: initialUrl });
      }
    };

    checkInitialURL();

    const subscription = Linking.addEventListener("url", handleDeepLink);
    return () => subscription?.remove();
  }, []);

  return {
    isLoading,
    error,
    clearError: () => setError(null),
  };
};
