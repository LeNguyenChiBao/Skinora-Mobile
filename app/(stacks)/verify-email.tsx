import { refreshAuthState } from "@/utils/authEvents";
import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { authService } from "../../services/authServices.service";

export default function VerifyEmailScreen() {
  const { email, token } = useLocalSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    // Auto verify if token is provided (from email link)
    if (token) {
      console.log("📧 Auto-verifying with token from deep link:", token);
      handleVerifyEmail(token as string);
    }
  }, [token]);

  useEffect(() => {
    // Countdown timer for resend button
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);
  const handleVerifyEmail = async (verificationToken: string) => {
    setIsLoading(true);
    try {
      console.log(
        "🔄 Starting email verification with token:",
        verificationToken
      );
      const response = await authService.verifyEmail(verificationToken);
      console.log("📧 Verification response:", response);

      if (response.success) {
        Alert.alert(
          "✅ Xác thực thành công!",
          "Email của bạn đã được xác thực. Bạn có thể sử dụng đầy đủ tính năng của ứng dụng.",
          [
            {
              text: "Tiếp tục",
              onPress: () => {
                // Update user verification status locally if needed
                router.replace("/(tabs)/");
              },
            },
          ]
        );
      } else {
        Alert.alert(
          "❌ Xác thực thất bại",
          response.message ||
            "Có lỗi xảy ra khi xác thực email. Vui lòng thử lại.",
          [{ text: "Đóng" }]
        );
      }
    } catch (error: any) {
      console.error("❌ Email verification error:", error);
      Alert.alert(
        "❌ Xác thực thất bại",
        error.response?.data?.message ||
          "Có lỗi xảy ra khi xác thực email. Vui lòng thử lại.",
        [{ text: "Đóng" }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (countdown > 0) return;

    setIsResending(true);
    try {
      const response = await authService.resendVerification(email as string);

      if (response.success) {
        setCountdown(60); // 60 seconds countdown
        Alert.alert(
          "📧 Email đã được gửi lại",
          "Chúng tôi đã gửi lại email xác thực. Vui lòng kiểm tra hộp thư của bạn.",
          [{ text: "Đóng" }]
        );
      } else {
        Alert.alert(
          "❌ Gửi lại thất bại",
          response.message ||
            "Không thể gửi lại email xác thực. Vui lòng thử lại sau.",
          [{ text: "Đóng" }]
        );
      }
    } catch (error: any) {
      Alert.alert(
        "❌ Gửi lại thất bại",
        "Không thể gửi lại email xác thực. Vui lòng thử lại sau.",
        [{ text: "Đóng" }]
      );
    } finally {
      setIsResending(false);
    }
  };

  const handleLogout = async () => {
      Alert.alert("Đăng xuất", "Bạn có chắc chắn muốn đăng xuất?", [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đăng xuất",
          style: "destructive",
          onPress: async () => {
            try {
              await authService.logout();
              setTimeout(() => {
                refreshAuthState();
              }, 100);
            } catch (error) {
              console.error("Logout error:", error);
              setTimeout(() => {
                refreshAuthState();
              }, 100);
            }
          },
        },
      ]);
    };
  

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00A86B" />
          <Text style={styles.loadingText}>Đang xác thực email...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="mark-email-unread" size={80} color="#00A86B" />
          </View>
          <Text style={styles.title}>Xác thực Email</Text>
          <Text style={styles.subtitle}>
            Chúng tôi đã gửi email xác thực đến{"\n"}
            <Text style={styles.emailText}>{email}</Text>
          </Text>{" "}
          <Text style={styles.instruction}>
            Bạn cần xác thực email để có thể sử dụng ứng dụng. Vui lòng kiểm tra
            hộp thư và nhấn vào liên kết xác thực.
          </Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.resendButton,
                countdown > 0 && styles.disabledButton,
              ]}
              onPress={handleResendVerification}
              disabled={isResending || countdown > 0}
            >
              {isResending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.resendButtonText}>
                  {countdown > 0
                    ? `Gửi lại sau ${countdown}s`
                    : "Gửi lại email"}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleLogout()}>
              <Text>Logout</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.helpContainer}>
            <MaterialIcons name="help-outline" size={16} color="#666" />
            <Text style={styles.helpText}>
              Không nhận được email? Kiểm tra thư mục spam hoặc liên hệ hỗ trợ
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },
  emailText: {
    fontWeight: "600",
    color: "#00A86B",
  },
  instruction: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 40,
    paddingHorizontal: 16,
  },
  buttonContainer: {
    width: "100%",
    gap: 16,
    marginBottom: 40,
  },
  resendButton: {
    backgroundColor: "#00A86B",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  resendButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  helpContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    maxWidth: 300,
  },
  helpText: {
    marginLeft: 8,
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    lineHeight: 16,
  },
});
