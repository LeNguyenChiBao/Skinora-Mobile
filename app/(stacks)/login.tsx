import { authService } from "@/services/authServices.service";
import { Ionicons } from "@expo/vector-icons";
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

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Lỗi", "Vui lòng nhập đầy đủ thông tin");
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.login({ email, password });

      if (response.success && response.data) {
        console.log("Login successful, token stored");
        console.log("User:", response.data.user.fullName);

        // Navigate to main app immediately after successful login
        router.replace("/(tabs)");
      } else {
        Alert.alert("Lỗi", response.message || "Đăng nhập thất bại");
      }
    } catch (error) {
      console.error("Login error:", error);
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
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.subtitle}>
              Đăng nhập để tiếp tục sử dụng ứng dụng
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập email của bạn"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Mật khẩu</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? "eye-off" : "eye"}
                    size={20}
                    color="#999"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.loginButton,
                isLoading && styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.loginButtonText}>Đăng nhập</Text>
              )}
            </TouchableOpacity>

            <View>
              <Text style={styles.orText}>Hoặc đăng nhập bằng</Text>
            </View>

            <View style={styles.socialButtonContainer}>
              <TouchableOpacity
                style={styles.googleButton}
                onPress={() => {
                  /* Handle Google login */
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.socialButtonText}>G</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.facebookButton}
                onPress={() => {
                  /* Handle Facebook login */
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.socialButtonText}>F</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Chưa có tài khoản? </Text>
              <TouchableOpacity onPress={() => router.push("/(stacks)/register")}>
                <Text style={styles.signupLink}>Đăng ký ngay</Text>
              </TouchableOpacity>
            </View>
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
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 30,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 30,
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00A86B",
  },
  form: {
    flex: 1,
    justifyContent: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666666",
    textAlign: "center",
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00A86B",
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
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: 16,
  },
  orText: {
    textAlign: "center",
    fontSize: 14,
    color: "#666666",
    marginVertical: 10,
  },
  socialButtonContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 30,
  },
  googleButton: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#00A86B",
  },
  facebookButton: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#00A86B",
  },
  socialButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#00A86B",
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 30,
  },
  forgotPasswordText: {
    color: "#26D0CE",
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: "#00A86B",
    paddingVertical: 16,
    borderRadius: 100,
    alignItems: "center",
    marginBottom: 10,
  },
  loginButtonDisabled: {
    backgroundColor: "#A0C4A7",
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signupText: {
    color: "#666666",
    fontSize: 14,
  },
  signupLink: {
    color: "#26D0CE",
    fontSize: 14,
    fontWeight: "600",
  },
});
