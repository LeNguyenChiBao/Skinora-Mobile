import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Linking } from "react-native";

export const useEmailVerificationDeepLink = () => {
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Handle deep link when app is opened
    const handleDeepLink = (url: string) => {
      console.log("📧 Received deep link:", url);

      if (url.includes("verify-email")) {
        try {
          const urlObj = new URL(url);
          const token = urlObj.searchParams.get("token");

          if (token) {
            console.log("✅ Found verification token in deep link:", token);
            setIsProcessing(true);

            // Navigate to verify screen with token
            router.push({
              pathname: "/(stacks)/verify-email",
              params: { token },
            });
          } else {
            console.log("❌ No token found in verification deep link");
          }
        } catch (error) {
          console.error("❌ Error parsing verification deep link:", error);
          // Try alternative parsing for app scheme
          const match = url.match(/token=([^&]+)/);
          if (match) {
            const token = match[1];
            console.log("✅ Found token via regex:", token);
            setIsProcessing(true);

            router.push({
              pathname: "/(stacks)/verify-email",
              params: { token },
            });
          }
        }
      }
    };

    // Check if app was opened with a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Listen for incoming deep links while app is running
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleDeepLink(url);
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  return { isProcessing, setIsProcessing };
};
