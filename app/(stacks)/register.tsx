import { authService } from "@/services/authServices.service";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function RegisterScreen() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    dob: "",
    address: "",
    avatarUrl: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleRegister = async () => {
    // Basic validation
    if (
      !form.email ||
      !form.password ||
      !form.fullName ||
      !form.phone ||
      !form.dob ||
      !form.address ||
      !form.avatarUrl
    ) {
      Alert.alert("Lỗi", "Vui lòng nhập đầy đủ thông tin");
      return;
    }

    setIsLoading(true);
    try {
      const response = await authService.register(form);
      if (response.success) {
        Alert.alert("Thành công", "Đăng ký thành công. Vui lòng đăng nhập.");
        router.replace("/(stacks)/login");
      } else {
        Alert.alert("Lỗi", response.message || "Đăng ký thất bại");
      }
    } catch (error) {
      Alert.alert("Lỗi", "Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8F5E8" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Text style={styles.title}>Đăng ký tài khoản</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập email"
              value={form.email}
              onChangeText={(v) => handleChange("email", v)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Mật khẩu</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập mật khẩu"
              value={form.password}
              onChangeText={(v) => handleChange("password", v)}
              secureTextEntry
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Họ và tên</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập họ và tên"
              value={form.fullName}
              onChangeText={(v) => handleChange("fullName", v)}
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Số điện thoại</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập số điện thoại"
              value={form.phone}
              onChangeText={(v) => handleChange("phone", v)}
              keyboardType="phone-pad"
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Ngày sinh (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="2000-01-01"
              value={form.dob}
              onChangeText={(v) => handleChange("dob", v)}
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Địa chỉ</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập địa chỉ"
              value={form.address}
              onChangeText={(v) => handleChange("address", v)}
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Avatar URL</Text>
            <TextInput
              style={styles.input}
              placeholder="https://example.com/avatar.jpg"
              value={form.avatarUrl}
              onChangeText={(v) => handleChange("avatarUrl", v)}
              autoCapitalize="none"
            />
          </View>
          <TouchableOpacity
            style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.registerButtonText}>Đăng ký</Text>
            )}
          </TouchableOpacity>
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Đã có tài khoản? </Text>
            <TouchableOpacity onPress={() => router.replace("/(stacks)/login")}>
              <Text style={styles.loginLink}>Đăng nhập</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8F5E8",
    marginBottom: 10
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 30,
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00A86B",
    marginBottom: 24,
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00A86L",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  registerButton: {
    backgroundColor: "#00A86B",
    paddingVertical: 16,
    borderRadius: 100,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  registerButtonDisabled: {
    backgroundColor: "#A0C4A7",
  },
  registerButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  loginText: {
    color: "#666666",
    fontSize: 14,
  },
  loginLink: {
    color: "#26D0CE",
    fontSize: 14,
    fontWeight: "600",
  },
});