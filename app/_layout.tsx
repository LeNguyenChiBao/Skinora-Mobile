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

import { CallIndicator } from "@/components/CallIndicator";
import { useCallIndicator } from "@/hooks/useCallIndicator";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useNotifications } from "@/hooks/useNotifications";
import { authService } from "@/services/authServices.service";

export default function RootLayout() {
  // Initialize notifications at app level
  useNotifications();

  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const callIndicator = useCallIndicator();

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
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
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
          {/* Global Call Indicator */}
          <CallIndicator
            isVisible={callIndicator.shouldShowIndicator}
            callDuration={callIndicator.callDuration}
            participantName={callIndicator.participantName}
            appointmentId={callIndicator.appointmentId}
            callData={callIndicator.callData}
          />
        </>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
