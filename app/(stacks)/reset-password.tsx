import { authService } from "@/services/authServices.service";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function ResetPasswordScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleResetPassword = async () => {
    if (!otp || !newPassword) {
      Alert.alert("Lỗi", "Vui lòng nhập đầy đủ OTP và mật khẩu mới");
      return;
    }
    setIsLoading(true);
    const res = await authService.resetPasswordOtp({
      email: email || "",
      otp,
      newPassword,
    });
    setIsLoading(false);
    if (res.success) {
      Alert.alert(
        "Thành công",
        Array.isArray(res.message) ? res.message.join(", ") : res.message,
        [
          {
            text: "Đăng nhập",
            onPress: () => router.replace("/login"),
          },
        ]
      );
    } else {
      Alert.alert(
        "Lỗi",
        Array.isArray(res.message) ? res.message.join(", ") : res.message
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.title}>Đặt lại mật khẩu</Text>
        <Text style={styles.subtitle}>
          Nhập mã OTP đã gửi về email và mật khẩu mới
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Mã OTP"
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
        />
        <TextInput
          style={styles.input}
          placeholder="Mật khẩu mới"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        <TouchableOpacity
          style={styles.button}
          onPress={handleResetPassword}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? "Đang đổi..." : "Đổi mật khẩu"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E8F5E8", justifyContent: "center" },
  form: {
    margin: 24,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#00A86B",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
    marginBottom: 24,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  button: {
    backgroundColor: "#00A86B",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
