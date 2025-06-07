import type { NavigationProp } from "@react-navigation/native";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { NavigationParams } from "../types/payment";

export const PaymentCancelScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<NavigationParams>>();

  const handleRetry = (): void => {
    navigation.goBack();
  };

  const handleGoHome = (): void => {
    navigation.navigate("Home");
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.cancelIcon}>❌</Text>
        <Text style={styles.title}>Payment Cancelled</Text>
        <Text style={styles.message}>
          Your payment was cancelled. You can try again or return to the home
          screen.
        </Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
            <Text style={styles.homeButtonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

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
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 30,
    color: "#666",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 15,
  },
  retryButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  homeButton: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  homeButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "600",
  },
});
