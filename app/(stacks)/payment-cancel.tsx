import { Stack, useRouter } from "expo-router";
import React from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function PaymentCancelScreen() {
  const router = useRouter();

  const handleRetry = (): void => {
    router.back();
  };

  const handleGoHome = (): void => {
    router.replace("/(tabs)");
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.cancelIcon}>❌</Text>
          <Text style={styles.title}>Thanh toán đã bị hủy</Text>
          <Text style={styles.message}>
            Giao dịch của bạn đã bị hủy. Bạn có thể thử lại hoặc quay về trang
            chủ.
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Thử lại</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
              <Text style={styles.homeButtonText}>Về trang chủ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  cancelIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
    color: "#333",
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 30,
    color: "#666",
    lineHeight: 24,
  },
  buttonContainer: {
    width: "100%",
    gap: 15,
  },
  retryButton: {
    backgroundColor: "#00A86B",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  homeButton: {
    backgroundColor: "#f0f0f0",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  homeButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "600",
  },
});
