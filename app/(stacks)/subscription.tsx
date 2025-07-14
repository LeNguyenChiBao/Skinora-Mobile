import paymentService from "@/services/payment.service";
import { subscriptionService } from "@/services/subscription.service";
import { userService } from "@/services/user.service";
import type { SubscriptionPlan } from "@/types/subscription"; // Assuming this type exists
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const getFeaturesFromPlan = (plan: SubscriptionPlan): string[] => {
  const features = [];
  if (plan.description) {
    features.push(plan.description);
  }
  if (plan.aiUsageAmount) {
    features.push(`${plan.aiUsageAmount} lượt sử dụng AI`);
  }
  if (plan.meetingAmount) {
    features.push(`${plan.meetingAmount} cuộc hẹn`);
  }
  if (plan.duration) {
    const durationText =
      plan.duration >= 30
        ? `${Math.floor(plan.duration / 30)} tháng`
        : `${plan.duration} tháng`;
    features.push(`Thời hạn: ${durationText}`);
  }
  return features;
};

export default function SubscriptionScreen() {
  const router = useRouter();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false); // For subscribe button
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [user, setUser] = useState<UserSubscription | null>(null);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoadingPlans(true);
        const response = await subscriptionService.getPlans();
        if (response.success && Array.isArray(response.data)) {
          // Filter active plans and sort them
          const activePlans = response.data
            .filter((plan) => plan.isActive)
            .sort((a, b) => a.sortOrder - b.sortOrder);
          setPlans(activePlans);
        } else {
          Alert.alert("Lỗi", "Không thể tải danh sách gói đăng ký.");
        }
      } catch (error) {
        console.error("Failed to fetch subscription plans:", error);
        Alert.alert("Lỗi", "Gặp sự cố khi tải gói. Vui lòng thử lại.");
      } finally {
        setLoadingPlans(false);
      }
    };

    const fetchUser = async () => {
      try {
        const res = await userService.getCurrentUser();
        if (res.success) {
          setUser(res.data);
        }
      } catch (e) {
        // ignore
      }
    };

    fetchPlans();
    fetchUser();
  }, []);

  const handleSubscribe = async () => {
    if (!selectedPlanId) {
      Alert.alert("Lỗi", "Vui lòng chọn một gói đăng ký");
      return;
    }

    setIsLoading(true);
    try {
      const selectedPlan = plans.find((p) => p._id === selectedPlanId);
      if (!selectedPlan) {
        Alert.alert("Lỗi", "Không tìm thấy gói đăng ký.");
        return;
      }

      const payment = await paymentService.createPayment({
        subscriptionId: selectedPlan._id,
        planId: selectedPlan._id,
        description: selectedPlan.description,
      });

      if (payment && payment.data && payment.data.paymentId) {
        router.push({
          pathname: "/(stacks)/payment-qr",
          params: {
            id: payment.data.paymentId,
            name: selectedPlan.name,
            price: payment.data.amount?.toString(),
            paymentId: payment.data.paymentId,
            amount: payment.data.amount?.toString(),
            description: payment.data.description,
            subscriptionId: payment.data.subscriptionId,
            orderCode: payment.data.orderCode,
            bankAccount: payment.data.bankAccount,
            bankName: payment.data.bankName,
            accountName: payment.data.accountName,
            transferContent: payment.data.transferContent,
          },
        });
      } else {
        Alert.alert("Lỗi", "Không tạo được thanh toán. Vui lòng thử lại.");
      }
    } catch (error: any) {
      Alert.alert(
        "Lỗi",
        error?.message || "Không thể tạo thanh toán. Vui lòng thử lại."
      );
    } finally {
      setIsLoading(false);
    }
  };
  const handleGoBack = () => {
    router.back();
  };

  const isSubscribed = !!user?.currentSubscription;

  if (loadingPlans) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00A86B" />
        <Text>Đang tải danh sách gói...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Text style={styles.backButtonText}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chọn Gói Đăng Ký</Text>
        <Text style={styles.headerSubtitle}>
          Nâng cấp để trải nghiệm đầy đủ tính năng
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {plans.map((plan, index) => (
          <TouchableOpacity
            key={plan._id}
            style={[
              styles.planCard,
              selectedPlanId === plan._id && styles.selectedPlan,
              index === 1 && styles.popularPlan,
              isSubscribed && { opacity: 0.5 },
            ]}
            onPress={() => setSelectedPlanId(plan._id)}
            disabled={isSubscribed}
          >
            {index === 1 && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>Phổ biến nhất</Text>
              </View>
            )}

            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planPrice}>
              {plan.price.toLocaleString("vi-VN")}đ
            </Text>

            <View style={styles.featuresContainer}>
              {getFeaturesFromPlan(plan).map((feature, featureIndex) => (
                <View key={featureIndex} style={styles.featureRow}>
                  <Text style={styles.checkIcon}>✓</Text>
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            {selectedPlanId === plan._id && (
              <View style={styles.selectedIndicator}>
                <Text style={styles.selectedText}>Đã chọn</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[
            styles.subscribeButton,
            (!selectedPlanId || isLoading || isSubscribed) &&
              styles.disabledButton,
          ]}
          onPress={handleSubscribe}
          disabled={!selectedPlanId || isLoading || isSubscribed}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.subscribeButtonText}>Đăng Ký Ngay</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.termsText}>
          Bằng cách đăng ký, bạn đồng ý với{" "}
          <Text style={styles.linkText}>Điều khoản dịch vụ</Text> và{" "}
          <Text style={styles.linkText}>Chính sách bảo mật</Text> của chúng tôi.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    backgroundColor: "#00A86B",
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    marginBottom: 10,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#fff",
    opacity: 0.9,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  planCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  selectedPlan: {
    borderColor: "#00A86B",
    backgroundColor: "#f0fff4",
  },
  popularPlan: {
    borderColor: "#FFD700",
  },
  popularBadge: {
    position: "absolute",
    top: -8,
    right: 20,
    backgroundColor: "#FFD700",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    color: "#333",
    fontSize: 12,
    fontWeight: "600",
  },
  planName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 24,
    color: "#00A86B",
    fontWeight: "bold",
    marginBottom: 20,
  },
  featuresContainer: {
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  checkIcon: {
    color: "#00A86B",
    marginRight: 10,
    fontSize: 16,
  },
  featureText: {
    fontSize: 16,
    color: "#555",
    flex: 1,
  },
  selectedIndicator: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: "#00A86B",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  selectedText: {
    color: "#fff",
    fontWeight: "600",
  },
  subscribeButton: {
    backgroundColor: "#00A86B",
    padding: 16,
    borderRadius: 100,
    alignItems: "center",
    marginVertical: 20,
  },
  disabledButton: {
    backgroundColor: "#A0C4A7",
  },
  subscribeButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  termsText: {
    fontSize: 12,
    color: "#888",
    textAlign: "center",
    marginBottom: 30,
  },
  linkText: {
    color: "#00A86B",
    textDecorationLine: "underline",
  },
});
