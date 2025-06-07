import type { NavigationProp, RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { NavigationParams } from "../types/payment";

type PaymentSuccessRouteProp = RouteProp<NavigationParams, "PaymentSuccess">;

export const PaymentSuccessScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<NavigationParams>>();
  const route = useRoute<PaymentSuccessRouteProp>();
  const { orderCode } = route.params || {};

  const handleContinue = (): void => {
    navigation.navigate("Home"); // Navigate to your main screen
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.successIcon}>✅</Text>
        <Text style={styles.title}>Payment Successful!</Text>
        <Text style={styles.message}>
          Your subscription has been activated successfully.
        </Text>
        {orderCode && (
          <Text style={styles.orderCode}>Order Code: {orderCode}</Text>
        )}

        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
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
  successIcon: {
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
    marginBottom: 20,
    color: "#666",
  },
  orderCode: {
    fontSize: 14,
    color: "#888",
    marginBottom: 30,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
