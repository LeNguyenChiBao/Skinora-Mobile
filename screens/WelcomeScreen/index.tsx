import { useRouter } from "expo-router";
import React from "react";
import {
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#00A86B" />

      {/* Header */}
      <View style={styles.header}>
        <Image
          source={require("../../assets/images/Skinora.png")}
          style={styles.logo}
        />
        <Text style={styles.logoText}>Skinora</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>Chăm sóc da tự nhiên</Text>
        <Text style={styles.description}>
          Ứng dụng AI giúp bạn kiểm tra tình trạng da và nhận tư vấn chăm sóc da
          cá nhân hóa.
        </Text>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push("login")}
            activeOpacity={0.8}
          >
            <Text style={styles.loginButtonText}>Đăng nhập</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signUpButton}
            onPress={() => router.push("signup")}
            activeOpacity={0.8}
          >
            <Text style={styles.signUpButtonText}>Đăng ký</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => router.push("/(tabs)")}
        >
          <Text style={styles.skipButtonText}>Bỏ qua</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8F5E8",
  },
  header: {
    flex: 0.5,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  logoText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#00A86B",
  },
  content: {
    flex: 0.5,
    paddingHorizontal: 30,
    paddingTop: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00A86B",
    textAlign: "center",
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: "#666666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 40,
  },
  buttonContainer: {
    width: "70%",
    gap: 12,
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: "#00A86B",
    paddingVertical: 14,
    borderRadius: 100,
    alignItems: "center",
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  signUpButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    borderRadius: 100,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#26D0CE",
  },
  signUpButtonText: {
    color: "#26D0CE",
    fontSize: 16,
    fontWeight: "600",
  },
  skipButton: {
    marginTop: 10,
  },
  skipButtonText: {
    color: "#999999",
    fontSize: 14,
  },
});
