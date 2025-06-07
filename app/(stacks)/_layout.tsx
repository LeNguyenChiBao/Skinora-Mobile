import { Stack } from "expo-router";

export default function StackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
      }}
    >
      <Stack.Screen
        options={{
          title: "Đăng nhập",
          headerStyle: {
            backgroundColor: "#E8F5E8",
          },
          headerTintColor: "#00A86B",
        }}
        name="login"
      />
      <Stack.Screen
        options={{
          title: "Đăng ký",
          headerStyle: {
            backgroundColor: "#E8F5E8",
          },
          headerTintColor: "#00A86B",
        }}
        name="register"
      />

      <Stack.Screen
        options={{
          title: "Quên mật khẩu",
          headerStyle: {
            backgroundColor: "#E8F5E8",
          },
          headerTintColor: "#00A86B",
        }}
        name="forgot-password"
      />
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="skin-analysis" options={{ headerShown: false }} />
      <Stack.Screen name="my-appointments" options={{ headerShown: false }} />
      <Stack.Screen name="book-appointment" options={{ headerShown: false }} />
      <Stack.Screen name="doctor-detail" options={{ headerShown: false }} />
      <Stack.Screen name="doctor-chat" options={{ headerShown: false }} />
      <Stack.Screen name="video-call" options={{ headerShown: false }} />
    </Stack>
  );
}
