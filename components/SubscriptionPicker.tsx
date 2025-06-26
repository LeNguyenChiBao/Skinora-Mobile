import paymentService from "@/services/payment.service";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { usePayment } from "../hooks/usePayment";
import type { SubscriptionPlan } from "../types/payment";

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "basic",
    name: "Basic Plan",
    price: "$9.99/month",
    features: ["Feature 1", "Feature 2", "Feature 3"],
  },
  {
    id: "premium",
    name: "Premium Plan",
    price: "$19.99/month",
    features: [
      "All Basic features",
      "Feature 4",
      "Feature 5",
      "Priority support",
    ],
  },
  {
    id: "pro",
    name: "Pro Plan",
    price: "$29.99/month",
    features: [
      "All Premium features",
      "Feature 6",
      "Feature 7",
      "Advanced analytics",
    ],
  },
];

export const SubscriptionPicker: React.FC = () => {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const { isLoading, error } = usePayment();
  const router = useRouter();

  const handleSubscribe = async (): Promise<void> => {
    if (!selectedPlan) {
      Alert.alert("Error", "Please select a subscription plan");
      return;
    }

    try {
      const res = await paymentService.createPayment({ planId: selectedPlan });
      console.log("API /payment/create response:", res);
      if (res && res.data) {
        router.push({
          pathname: "/(stacks)/payment-qr",
          params: {
            orderCode: res.data.orderCode,
            amount: res.data.amount,
            bankAccount: res.data.bankAccount,
            bankName: res.data.bankName,
            accountName: res.data.accountName,
            transferContent: res.data.transferContent,
          },
        });
      } else {
        Alert.alert("Error", "Không nhận được thông tin thanh toán từ server.");
      }
    } catch (err) {
      Alert.alert("Error", "Failed to create payment. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose Your Plan</Text>

      {SUBSCRIPTION_PLANS.map((plan: SubscriptionPlan) => (
        <TouchableOpacity
          key={plan.id}
          style={[
            styles.planCard,
            selectedPlan === plan.id && styles.selectedPlan,
          ]}
          onPress={() => setSelectedPlan(plan.id)}
        >
          <Text style={styles.planName}>{plan.name}</Text>
          <Text style={styles.planPrice}>{plan.price}</Text>
          <View style={styles.featuresContainer}>
            {plan.features.map((feature: string, index: number) => (
              <Text key={index} style={styles.feature}>
                • {feature}
              </Text>
            ))}
          </View>
        </TouchableOpacity>
      ))}

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[
          styles.subscribeButton,
          (isLoading || !selectedPlan) && styles.disabledButton,
        ]}
        onPress={handleSubscribe}
        disabled={isLoading || !selectedPlan}
      >
        <Text style={styles.subscribeButtonText}>
          {isLoading ? "Processing..." : "Subscribe Now"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  planCard: {
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    backgroundColor: "#fff",
  },
  selectedPlan: {
    borderColor: "#007AFF",
    backgroundColor: "#f0f8ff",
  },
  planName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
  planPrice: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "600",
    marginBottom: 10,
  },
  featuresContainer: {
    marginTop: 10,
  },
  feature: {
    fontSize: 14,
    color: "#666",
    marginBottom: 3,
  },
  subscribeButton: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  subscribeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: "red",
    textAlign: "center",
    marginTop: 10,
  },
});
