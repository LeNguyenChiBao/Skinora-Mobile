import paymentService from "@/services/payment.service";
import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { usePayment } from "../hooks/usePayment";
import type { SubscriptionPlan } from "../types/payment";

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "basic",
    name: "Gói Cơ Bản",
    price: "99,000đ/tháng",
    features: [
      "Phân tích da cơ bản",
      "Lời khuyên chăm sóc da",
      "Theo dõi tiến trình",
      "Hỗ trợ email",
    ],
  },
  {
    id: "premium",
    name: "Gói Premium",
    price: "199,000đ/tháng",
    features: [
      "Tất cả tính năng Cơ Bản",
      "Phân tích da chi tiết với AI",
      "Tư vấn sản phẩm cá nhân hóa",
      "Theo dõi chi tiết",
      "Hỗ trợ ưu tiên",
    ],
  },
  {
    id: "pro",
    name: "Gói Pro",
    price: "299,000đ/tháng",
    features: [
      "Tất cả tính năng Premium",
      "Tư vấn từ chuyên gia da liễu",
      "Phân tích xu hướng da",
      "Báo cáo chi tiết hàng tuần",
      "Hỗ trợ 24/7",
    ],
  },
];

export const SubscriptionScreen: React.FC = () => {
  const navigation = useNavigation();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const { isLoading, error } = usePayment();

  const handleSubscribe = async (): Promise<void> => {
    if (!selectedPlan) {
      Alert.alert("Lỗi", "Vui lòng chọn một gói đăng ký");
      return;
    }

    try {
      await paymentService.createPayment(selectedPlan);
    } catch (err) {
      Alert.alert("Lỗi", "Không thể tạo thanh toán. Vui lòng thử lại.");
    }
  };

  const handleGoBack = (): void => {
    navigation.goBack();
  };

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
        {/* Plans */}
        {SUBSCRIPTION_PLANS.map((plan: SubscriptionPlan, index: number) => (
          <TouchableOpacity
            key={plan.id}
            style={[
              styles.planCard,
              selectedPlan === plan.id && styles.selectedPlan,
              index === 1 && styles.popularPlan, // Premium plan
            ]}
            onPress={() => setSelectedPlan(plan.id)}
          >
            {index === 1 && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>Phổ biến nhất</Text>
              </View>
            )}

            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planPrice}>{plan.price}</Text>

            <View style={styles.featuresContainer}>
              {plan.features.map((feature: string, featureIndex: number) => (
                <View key={featureIndex} style={styles.featureRow}>
                  <Text style={styles.checkIcon}>✓</Text>
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            {selectedPlan === plan.id && (
              <View style={styles.selectedIndicator}>
                <Text style={styles.selectedText}>Đã chọn</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Subscribe Button */}
        <TouchableOpacity
          style={[
            styles.subscribeButton,
            (!selectedPlan || isLoading) && styles.disabledButton,
          ]}
          onPress={handleSubscribe}
          disabled={!selectedPlan || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.subscribeButtonText}>Đăng Ký Ngay</Text>
          )}
        </TouchableOpacity>

        {/* Terms */}
        <Text style={styles.termsText}>
          Bằng cách đăng ký, bạn đồng ý với{" "}
          <Text style={styles.linkText}>Điều khoản dịch vụ</Text> và{" "}
          <Text style={styles.linkText}>Chính sách bảo mật</Text> của chúng tôi.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
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
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 12,
  },
  featureText: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  selectedIndicator: {
    backgroundColor: "#00A86B",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "center",
  },
  selectedText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  errorContainer: {
    backgroundColor: "#ffebee",
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: "#c62828",
    textAlign: "center",
    fontSize: 14,
  },
  subscribeButton: {
    backgroundColor: "#00A86B",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    marginVertical: 20,
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  subscribeButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  termsText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 30,
  },
  linkText: {
    color: "#00A86B",
    textDecorationLine: "underline",
  },
});
