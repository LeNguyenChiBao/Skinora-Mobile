import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface VerificationBannerProps {
  user: {
    email: string;
    isVerified: boolean;
  } | null;
}

export default function VerificationBanner({ user }: VerificationBannerProps) {
  if (!user || user.isVerified) {
    return null;
  }

  const handleVerifyNow = () => {
    router.push({
      pathname: "/(stacks)/verify-email",
      params: { email: user.email },
    });
  };

  return (
    <View style={styles.banner}>
      <View style={styles.iconContainer}>
        <MaterialIcons name="warning" size={20} color="#FF9500" />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>Email chưa được xác thực</Text>
        <Text style={styles.subtitle}>
          Xác thực email để sử dụng đầy đủ tính năng
        </Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={handleVerifyNow}>
        <Text style={styles.buttonText}>Xác thực</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#FFF5E6",
    borderColor: "#FFE4B3",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    margin: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: "#666",
  },
  button: {
    backgroundColor: "#FF9500",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
});
