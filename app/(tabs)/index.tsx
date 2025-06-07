import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { authService, User } from "@/services/authServices.service";
import Feather from "@expo/vector-icons/Feather";

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await authService.getUserData();
      setUser(userData);
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  const features = [
    {
      id: "chatbox",
      title: "AI Chatbox",
      description: "Tư vấn chăm sóc da với AI",
      icon: "chatbubbles",
      color: "#4285F4",
      route: "/chatbox",
    },
    {
      id: "doctors",
      title: "Bác sĩ da liễu",
      description: "Kết nối với bác sĩ chuyên khoa",
      icon: "medical",
      color: "#34A853",
      route: "/(stacks)/doctors-list",
    },
    {
      id: "appointment",
      title: "Đặt lịch hẹn",
      description: "Đặt lịch khám với bác sĩ",
      icon: "calendar",
      color: "#FBBC04",
      route: "/appointment",
    },
    {
      id: "subscription",
      title: "Gói đăng ký",
      description: "Nâng cấp tài khoản Premium",
      icon: "diamond",
      color: "#9C27B0",
      route: "/(stacks)/subscription",
    },
  ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Chào buổi sáng";
    if (hour < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8F5E8" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header with User Info */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <View style={styles.avatarContainer}>
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.defaultAvatar}>
                  <Ionicons name="person" size={32} color="#00A86B" />
                </View>
              )}
            </View>
            <View style={styles.greetingContainer}>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.userName}>
                {user?.fullName || "Người dùng"}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={24} color="#00A86L" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingButton}>
            <Feather name="settings" size={24} color="#00A86B" />
          </TouchableOpacity>
        </View>

        {/* Quick Scan Section */}
        <View style={styles.quickScanSection}>
          <TouchableOpacity
            style={styles.quickScanCard}
            onPress={() => router.push("/scanning")}
            activeOpacity={0.8}
          >
            <View style={styles.quickScanContent}>
              <View>
                <Text style={styles.quickScanTitle}>Quét da ngay</Text>
                <Text style={styles.quickScanSubtitle}>
                  Phân tích tình trạng da của bạn
                </Text>
              </View>
              <View style={styles.scanIconContainer}>
                <Ionicons name="scan" size={32} color="#FFFFFF" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Features Grid */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Dịch vụ chăm sóc da</Text>
          <View style={styles.featuresGrid}>
            {features.map((feature) => (
              <TouchableOpacity
                key={feature.id}
                style={styles.featureCard}
                onPress={() => router.push(feature.route as any)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.featureIcon,
                    { backgroundColor: feature.color },
                  ]}
                >
                  <Ionicons
                    name={feature.icon as any}
                    size={28}
                    color="#FFFFFF"
                  />
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>
                  {feature.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Activity Section */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Hoạt động gần đây</Text>
          <View style={styles.recentCard}>
            <Ionicons name="time-outline" size={20} color="#666" />
            <Text style={styles.recentText}>Chưa có hoạt động nào gần đây</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8F5E8",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#00A86B",
  },
  defaultAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#00A86B",
  },
  greetingContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 2,
  },
  userName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#00A86B",
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginLeft: 3,
  },
  quickScanSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  quickScanCard: {
    backgroundColor: "#00A86B",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#00A86B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  quickScanContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  quickScanTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  quickScanSubtitle: {
    fontSize: 14,
    color: "#E8F5E8",
  },
  scanIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  featuresSection: {
    paddingHorizontal: 20,
    marginTop: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00A86B",
    marginBottom: 16,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  featureCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333333",
    textAlign: "center",
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 12,
    color: "#666666",
    textAlign: "center",
    lineHeight: 16,
  },
  recentSection: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 100, // Space for floating tab bar
  },
  recentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  recentText: {
    fontSize: 14,
    color: "#666666",
    marginLeft: 10,
  },
});
