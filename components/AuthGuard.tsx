import { authEventEmitter } from "@/utils/authEvents";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useSegments } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    checkAuthStatus();
    // Lắng nghe sự kiện thay đổi trạng thái đăng nhập
    const unsubscribe = authEventEmitter.subscribe(() => {
      console.log("📡 Received auth state change event");
      checkAuthStatus();
    });
    return unsubscribe;
  }, []);

  // Lắng nghe thay đổi route để kiểm tra lại trạng thái auth nếu cần
  useEffect(() => {
    if (segments.length > 0) {
      const currentScreen = (segments as string[])[1] || "";
      const needsRecheck = ["login", "register", "welcome"].includes(
        currentScreen
      );
      if (needsRecheck) {
        console.log("🔄 Route changed to auth screen, re-checking auth...");
        checkAuthStatus();
      }
    }
  }, [segments]);

  useEffect(() => {
    if (!isLoading) {
      handleAuthRedirect();
    }
  }, [isLoading, isAuthenticated, segments]);

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const user = await AsyncStorage.getItem("user_data");
      console.log("🔍 Auth check - Token:", !!token, "User:", !!user);
      if (token && user) {
        const userData = JSON.parse(user);
        console.log(
          "👤 User data:",
          userData.fullName,
          "Verified:",
          userData.isVerified
        );
        if (!userData.isVerified) {
          console.log("📧 User needs email verification");
          setIsAuthenticated(false);
        } else {
          console.log("✅ User authenticated and verified");
          setIsAuthenticated(true);
        }
      } else {
        console.log("❌ No token or user found");
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("❌ Auth check error:", error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthRedirect = async () => {
    const inAuthGroup = segments[0] === "(stacks)";
    const inTabsGroup = segments[0] === "(tabs)";
    const currentScreen = (segments as string[])[1] || "";
    console.log("🔄 Auth redirect check:", {
      isAuthenticated,
      segments,
      inAuthGroup,
      inTabsGroup,
      currentScreen,
    });
    // Check if user has token but not verified
    const token = await AsyncStorage.getItem("auth_token");
    const user = await AsyncStorage.getItem("user_data");
    let needsVerification = false;
    if (token && user) {
      const userData = JSON.parse(user);
      needsVerification = !userData.isVerified;
    }
    if (!isAuthenticated) {
      if (needsVerification) {
        // User logged in but not verified - redirect to verify-email
        if (currentScreen !== "verify-email") {
          console.log("🔄 Redirecting to verify-email (needs verification)");
          const userData = JSON.parse(user!);
          router.replace({
            pathname: "/(stacks)/verify-email",
            params: { email: userData.email },
          });
        }
      } else {
        // User not logged in - redirect to welcome/login
        if (
          inTabsGroup ||
          (inAuthGroup &&
            ![
              "login",
              "register",
              "welcome",
              "forgot-password",
              "reset-password",
            ].includes(currentScreen))
        ) {
          console.log("🔄 Redirecting to welcome (not authenticated)");
          router.replace("/welcome");
        }
      }
    } else {
      // User is fully authenticated and verified
      if (!inTabsGroup && !inAuthGroup) {
        console.log("🔄 Redirecting to tabs (authenticated)");
        router.replace("/(tabs)/");
      } else if (
        inAuthGroup &&
        ["login", "register", "welcome", "verify-email"].includes(currentScreen)
      ) {
        console.log("🔄 Redirecting to tabs (already authenticated)");
        router.replace("/(tabs)/");
      }
    }
  };

  // Clear auth state function (for logout)
  const clearAuth = async () => {
    try {
      await AsyncStorage.removeItem("auth_token");
      await AsyncStorage.removeItem("user_data");
      setIsAuthenticated(false);
      router.replace("/welcome");
    } catch (error) {
      console.error("❌ Logout error:", error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00A86B" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
});

export { AuthGuard };
