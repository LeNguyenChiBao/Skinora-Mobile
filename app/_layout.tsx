import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import AuthGuard from "@/components/AuthGuard";
import { CallManager } from "@/components/CallManager";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useEmailVerificationDeepLink } from "@/hooks/useEmailVerificationDeepLink";
import { authService } from "@/services/authServices.service";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  // Initialize deep link handler
  useEmailVerificationDeepLink();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const loggedIn = await authService.isLoggedIn();
      setIsLoggedIn(loggedIn);
    } catch (error) {
      console.error("Error checking auth status:", error);
      setIsLoggedIn(false);
    }
  };

  if (!loaded || isLoggedIn === null) {
    // Show loading while checking auth status
    return null;
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthGuard>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <>
            <Stack
              screenOptions={{
                headerShown: false,
              }}
              initialRouteName={isLoggedIn ? "(tabs)" : "welcome"}
            >
              <Stack.Screen name="(stacks)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
            {/* Initialize call manager only when logged in */}
            {isLoggedIn && <CallManager />}
          </>
          <StatusBar style="auto" />
        </ThemeProvider>
      </AuthGuard>
    </GestureHandlerRootView>
  );
}
