import { authService } from "@/services/authServices.service";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function ScheduleScreen() {
  const handleLogout = async () => {
    Alert.alert("Đăng xuất", "Bạn có chắc chắn muốn đăng xuất?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đăng xuất",
        style: "destructive",
        onPress: async () => {
          try {
            await authService.logout();
            router.replace("/welcome");
          } catch (error) {
            console.error("Logout error:", error);
          }
        },
      },
    ]);
  };

  const handleSubscription = () => {
    router.push("/(stacks)/subscription");
  };

  const handleProfile = () => {
    router.push("/profile");
  };

  const handleSettings = () => {
    router.push("/settings");
  };

  const handleSupport = () => {
    router.push("/support");
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cá nhân</Text>
        <Text style={styles.subtitle}>Quản lý tài khoản của bạn</Text>
      </View>

      {/* Subscription Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gói đăng ký</Text>
        <TouchableOpacity
          style={styles.subscriptionCard}
          onPress={handleSubscription}
        >
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>💎 Premium Plan</Text>
            <Text style={styles.cardSubtitle}>
              Nâng cấp để trải nghiệm đầy đủ
            </Text>
            <Text style={styles.cardDescription}>
              Truy cập không giới hạn tất cả tính năng
            </Text>
          </View>
          <View style={styles.cardAction}>
            <Text style={styles.actionText}>Xem gói →</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Menu Options */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cài đặt tài khoản</Text>

        <TouchableOpacity style={styles.menuItem} onPress={handleProfile}>
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>👤</Text>
            <Text style={styles.menuText}>Thông tin cá nhân</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleSettings}>
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>⚙️</Text>
            <Text style={styles.menuText}>Cài đặt</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleSupport}>
          <View style={styles.menuLeft}>
            <Text style={styles.menuIcon}>💬</Text>
            <Text style={styles.menuText}>Hỗ trợ</Text>
          </View>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Logout Section */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    backgroundColor: "#00A86B",
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: "#FFFFFF",
    opacity: 0.8,
  },
  section: {
    marginTop: 20,
    marginHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  subscriptionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: "#FFD700",
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 12,
    color: "#999",
  },
  cardAction: {
    marginLeft: 16,
  },
  actionText: {
    fontSize: 14,
    color: "#00A86B",
    fontWeight: "600",
  },
  menuItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  menuText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  menuArrow: {
    fontSize: 20,
    color: "#999",
  },
  logoutButton: {
    backgroundColor: "#e74c3c",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    marginBottom: 30,
  },
  logoutButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
