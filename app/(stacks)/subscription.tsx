import { usePayment } from "@/hooks/usePayment";
import { paymentService } from "@/services/payment.service";
import { subscriptionService } from "@/services/subscription.service";
import { userService } from "@/services/user.service";
import type { SubscriptionPlan } from "@/types/subscription";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function SubscriptionScreen() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [pendingPayment, setPendingPayment] = useState<{
    orderCode: string;
    planId: string;
  } | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<any | null>(
    null
  );
  const [loadingUser, setLoadingUser] = useState(true);

  usePayment(); // Add payment hook for deep link handling

  useEffect(() => {
    fetchPlans();
    checkCurrentSubscription();
  }, []);

  // Check for pending payment when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      checkPendingPayment();
    }, [])
  );

  // Listen for app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
    return () => subscription?.remove();
  }, []);

  const handleAppStateChange = (nextAppState: string) => {
    if (nextAppState === "active") {
      // App came back to foreground, check for pending payment
      setTimeout(() => {
        checkPendingPayment();
      }, 1000); // Delay to ensure app is fully active
    }
  };

  const checkPendingPayment = async () => {
    try {
      const pending = await AsyncStorage.getItem("pendingPayment");
      if (pending) {
        const paymentData = JSON.parse(pending);
        setPendingPayment(paymentData);

        // Auto check payment status without bothering user
        await autoCheckPaymentStatus(paymentData.orderCode);
      }
    } catch (error) {
      console.error("Error checking pending payment:", error);
    }
  };

  const autoCheckPaymentStatus = async (orderCode: string) => {
    try {
      console.log("Auto checking payment status for order:", orderCode);

      // Step 1: Check payment status
      let result = await paymentService.checkPaymentStatus(orderCode);
      console.log("Payment check result:", JSON.stringify(result, null, 2));

      const status = result.data?.status?.toLowerCase();
      if (result.success && (status === "paid" || status === "completed")) {
        // Payment completed - show success and navigate
        Alert.alert(
          "Thanh toán thành công!",
          "Gói đăng ký đã được kích hoạt.",
          [
            {
              text: "OK",
              onPress: () => {
                clearPendingPayment();
                router.push({
                  pathname: "/(stacks)/payment-success",
                  params: { orderCode },
                });
              },
            },
          ]
        );
        return;
      }

      // Step 2: If pending, verify with backend
      if (result.success && status === "pending") {
        console.log("Payment pending, verifying with backend...");

        try {
          const verifyResult = await paymentService.verifyPaymentStatus(
            orderCode
          );
          console.log("Verify result:", JSON.stringify(verifyResult, null, 2));

          const verifyStatus = verifyResult.data?.status?.toLowerCase();
          if (
            verifyResult.success &&
            (verifyStatus === "paid" || verifyStatus === "completed")
          ) {
            Alert.alert(
              "Thanh toán thành công!",
              "Gói đăng ký đã được kích hoạt.",
              [
                {
                  text: "OK",
                  onPress: () => {
                    clearPendingPayment();
                    router.push({
                      pathname: "/(stacks)/payment-success",
                      params: { orderCode },
                    });
                  },
                },
              ]
            );
            return;
          }
        } catch (verifyError) {
          console.log("Verify endpoint failed:", verifyError);
        }

        // Step 3: Check again after delay if still pending
        setTimeout(async () => {
          try {
            const delayedCheck = await paymentService.checkPaymentStatus(
              orderCode
            );
            const delayedStatus = delayedCheck.data?.status?.toLowerCase();
            if (
              delayedCheck.success &&
              (delayedStatus === "paid" || delayedStatus === "completed")
            ) {
              Alert.alert(
                "Thanh toán thành công!",
                "Gói đăng ký đã được kích hoạt.",
                [
                  {
                    text: "OK",
                    onPress: () => {
                      clearPendingPayment();
                      router.push({
                        pathname: "/(stacks)/payment-success",
                        params: { orderCode },
                      });
                    },
                  },
                ]
              );
            }
          } catch (delayedCheckError) {
            console.error("Delayed payment check failed:", delayedCheckError);
          }
        }, 3000);

        console.log("Payment still pending, will continue monitoring...");
      }

      // Handle failed/cancelled payments
      if (result.success && (status === "cancelled" || status === "failed")) {
        Alert.alert(
          "Thanh toán thất bại",
          "Giao dịch đã bị hủy hoặc thất bại.",
          [{ text: "OK", onPress: () => clearPendingPayment() }]
        );
      }
    } catch (error) {
      console.error("Auto payment check failed:", error);
      // Don't alert user for network errors, just keep pending state
    }
  };

  const checkPaymentStatus = async (orderCode: string) => {
    setIsLoading(true);

    try {
      await autoCheckPaymentStatus(orderCode);
    } catch (err) {
      console.error("Payment status check failed:", err);
      Alert.alert(
        "Lỗi kết nối",
        "Không thể kiểm tra trạng thái thanh toán. Vui lòng kiểm tra kết nối mạng và thử lại.",
        [
          { text: "Hủy", style: "cancel" },
          { text: "Thử lại", onPress: () => checkPaymentStatus(orderCode) },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const manualVerifyPayment = async (orderCode: string) => {
    setIsLoading(true);

    try {
      // Step 1: Check current status
      console.log("Manual check: Checking payment status...");
      let result = await paymentService.checkPaymentStatus(orderCode);
      console.log("Manual check result:", JSON.stringify(result, null, 2));

      const status = result.data?.status?.toLowerCase();
      if (result.success && (status === "paid" || status === "completed")) {
        Alert.alert(
          "Xác minh thành công",
          "Thanh toán đã được xác minh và kích hoạt!",
          [
            {
              text: "OK",
              onPress: () => {
                clearPendingPayment();
                router.push({
                  pathname: "/(stacks)/payment-success",
                  params: { orderCode },
                });
              },
            },
          ]
        );
        return;
      }

      // Step 2: If not paid, try verify
      console.log("Manual check: Payment not completed, verifying...");
      const verifyResult = await paymentService.verifyPaymentStatus(orderCode);
      console.log(
        "Manual verify result:",
        JSON.stringify(verifyResult, null, 2)
      );

      const verifyStatus = verifyResult.data?.status?.toLowerCase();
      if (
        verifyResult.success &&
        (verifyStatus === "paid" || verifyStatus === "completed")
      ) {
        Alert.alert(
          "Xác minh thành công",
          "Thanh toán đã được xác minh và kích hoạt!",
          [
            {
              text: "OK",
              onPress: () => {
                clearPendingPayment();
                router.push({
                  pathname: "/(stacks)/payment-success",
                  params: { orderCode },
                });
              },
            },
          ]
        );
      } else {
        Alert.alert(
          "Chưa tìm thấy thanh toán",
          `Trạng thái hiện tại: ${result.data?.status}. OrderCode: ${orderCode}. Vui lòng kiểm tra lại hoặc liên hệ hỗ trợ.`
        );
      }
    } catch (error) {
      console.error("Manual verification failed:", error);
      Alert.alert(
        "Lỗi",
        "Không thể xác minh thanh toán. Vui lòng liên hệ hỗ trợ."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const clearPendingPayment = async () => {
    try {
      await AsyncStorage.removeItem("pendingPayment");
      setPendingPayment(null);
    } catch (error) {
      console.error("Error clearing pending payment:", error);
    }
  };

  const fetchPlans = async () => {
    try {
      setLoadingPlans(true);
      const response = await subscriptionService.getPlans();

      if (response.success) {
        // Sort plans by sortOrder and filter active plans
        const activePlans = response.data
          .filter((plan) => plan.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        setPlans(activePlans);
      } else {
        Alert.alert("Lỗi", "Không thể tải danh sách gói đăng ký");
      }
    } catch (error) {
      console.error("Error fetching plans:", error);
      Alert.alert("Lỗi", "Không thể tải danh sách gói đăng ký");
    } finally {
      setLoadingPlans(false);
    }
  };

  const checkCurrentSubscription = async () => {
    try {
      setLoadingUser(true);
      const userResponse = await userService.getCurrentUser();

      if (userResponse.success && userResponse.data.currentSubscription) {
        setCurrentSubscription(userResponse.data.currentSubscription);
        console.log(
          "User has active subscription:",
          userResponse.data.currentSubscription
        );
      }
    } catch (error) {
      console.error("Error checking current subscription:", error);
    } finally {
      setLoadingUser(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN");
  };

  const getCurrentPlanId = (): string | null => {
    return currentSubscription?.planId?._id || null;
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);
  };

  const formatDuration = (duration: number): string => {
    if (duration >= 30) {
      const months = Math.floor(duration / 30);
      return `${months} tháng`;
    }
    return `${duration} ngày`;
  };

  const getFeatures = (plan: SubscriptionPlan): string[] => {
    return [
      `${plan.aiUsageAmount} lượt sử dụng AI`,
      `${plan.meetingAmount} cuộc hẹn`,
      `Thời hạn: ${formatDuration(plan.duration)}`,
      plan.description,
    ].filter(Boolean);
  };

  const handleSubscribe = async (): Promise<void> => {
    if (!selectedPlan) {
      Alert.alert("Lỗi", "Vui lòng chọn một gói đăng ký");
      return;
    }

    setIsLoading(true);

    try {
      // Create payment using the payment service
      const paymentResponse = await paymentService.createPayment(selectedPlan);

      if (paymentResponse.success && paymentResponse.data?.paymentUrl) {
        // Store pending payment info
        const paymentData = {
          orderCode: paymentResponse.data.orderCode,
          planId: selectedPlan,
          timestamp: Date.now(),
        };

        await AsyncStorage.setItem(
          "pendingPayment",
          JSON.stringify(paymentData)
        );
        setPendingPayment(paymentData);

        // Open PayOS payment page
        const result = await WebBrowser.openBrowserAsync(
          paymentResponse.data.paymentUrl
        );

        // If user closed the browser manually, check payment status
        if (result.type === "cancel") {
          setTimeout(() => {
            Alert.alert(
              "Thanh toán chưa hoàn thành",
              "Bạn có muốn kiểm tra trạng thái thanh toán không?",
              [
                { text: "Không", style: "cancel" },
                {
                  text: "Kiểm tra",
                  onPress: () => checkPaymentStatus(paymentData.orderCode),
                },
              ]
            );
          }, 500);
        }
      } else {
        Alert.alert("Lỗi", "Không thể tạo liên kết thanh toán");
      }
    } catch (err) {
      console.error("Payment creation error:", err);
      Alert.alert("Lỗi", "Không thể tạo thanh toán. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = (): void => {
    router.back();
  };

  if (loadingPlans || loadingUser) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Chọn Gói Đăng Ký</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00A86L" />
            <Text style={styles.loadingText}>Đang tải thông tin...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chọn Gói Đăng Ký</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>
            Nâng cấp để trải nghiệm đầy đủ tính năng
          </Text>

          {/* Pending Payment Alert */}
          {pendingPayment && (
            <View style={styles.pendingPaymentCard}>
              <Text style={styles.pendingTitle}>⏳ Giao dịch đang chờ</Text>
              <Text style={styles.pendingText}>
                Mã giao dịch: {pendingPayment.orderCode}
              </Text>
              <Text style={styles.pendingSubtext}>
                Hệ thống đang tự động kiểm tra trạng thái thanh toán...
              </Text>
              <View style={styles.pendingButtonContainer}>
                <TouchableOpacity
                  style={styles.checkStatusButton}
                  onPress={() => checkPaymentStatus(pendingPayment.orderCode)}
                  disabled={isLoading}
                >
                  <Text style={styles.checkStatusText}>
                    {isLoading ? "Đang kiểm tra..." : "Kiểm tra ngay"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={clearPendingPayment}
                >
                  <Text style={styles.clearButtonText}>Hủy giao dịch</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {plans.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                Không có gói đăng ký nào khả dụng
              </Text>
            </View>
          ) : (
            <>
              {/* Plans */}
              {plans.map((plan: SubscriptionPlan, index: number) => {
                const isCurrentPlan = getCurrentPlanId() === plan._id;
                const hasActiveSubscription = !!currentSubscription;

                return (
                  <TouchableOpacity
                    key={plan._id}
                    style={[
                      styles.planCard,
                      selectedPlan === plan._id &&
                        !hasActiveSubscription &&
                        styles.selectedPlan,
                      index === 1 && styles.popularPlan,
                      isCurrentPlan && styles.activePlan,
                      hasActiveSubscription &&
                        !isCurrentPlan &&
                        styles.disabledPlan,
                    ]}
                    onPress={() => {
                      if (!hasActiveSubscription) {
                        setSelectedPlan(plan._id);
                      }
                    }}
                    disabled={hasActiveSubscription}
                  >
                    {index === 1 &&
                      !isCurrentPlan &&
                      !hasActiveSubscription && (
                        <View style={styles.popularBadge}>
                          <Text style={styles.popularText}>Phổ biến nhất</Text>
                        </View>
                      )}

                    {isCurrentPlan && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeText}>Đang sử dụng</Text>
                      </View>
                    )}

                    {hasActiveSubscription && !isCurrentPlan && (
                      <View style={styles.disabledBadge}>
                        <Text style={styles.disabledText}>Không khả dụng</Text>
                      </View>
                    )}

                    <Text
                      style={[
                        styles.planName,
                        hasActiveSubscription &&
                          !isCurrentPlan &&
                          styles.disabledText,
                      ]}
                    >
                      {plan.name}
                    </Text>
                    <Text
                      style={[
                        styles.planPrice,
                        hasActiveSubscription &&
                          !isCurrentPlan &&
                          styles.disabledPrice,
                      ]}
                    >
                      {formatPrice(plan.price)}
                    </Text>

                    <View style={styles.featuresContainer}>
                      {getFeatures(plan).map(
                        (feature: string, featureIndex: number) => (
                          <View key={featureIndex} style={styles.featureRow}>
                            <Text
                              style={[
                                styles.checkIcon,
                                hasActiveSubscription &&
                                  !isCurrentPlan &&
                                  styles.disabledIcon,
                              ]}
                            >
                              ✓
                            </Text>
                            <Text
                              style={[
                                styles.featureText,
                                hasActiveSubscription &&
                                  !isCurrentPlan &&
                                  styles.disabledText,
                              ]}
                            >
                              {feature}
                            </Text>
                          </View>
                        )
                      )}
                    </View>

                    {selectedPlan === plan._id && !hasActiveSubscription && (
                      <View style={styles.selectedIndicator}>
                        <Text style={styles.selectedText}>Đã chọn</Text>
                      </View>
                    )}

                    {isCurrentPlan && (
                      <View style={styles.activeIndicator}>
                        <Text style={styles.activeIndicatorText}>
                          Đang hoạt động
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}

              {/* Subscribe Button */}
              <TouchableOpacity
                style={[
                  styles.subscribeButton,
                  (!selectedPlan || isLoading || !!currentSubscription) &&
                    styles.disabledButton,
                ]}
                onPress={handleSubscribe}
                disabled={!selectedPlan || isLoading || !!currentSubscription}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : currentSubscription ? (
                  <Text style={styles.subscribeButtonText}>
                    Đã có gói đăng ký
                  </Text>
                ) : (
                  <Text style={styles.subscribeButtonText}>Đăng Ký Ngay</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Terms */}
          <Text style={styles.termsText}>
            Bằng cách đăng ký, bạn đồng ý với{" "}
            <Text style={styles.linkText}>Điều khoản dịch vụ</Text> và{" "}
            <Text style={styles.linkText}>Chính sách bảo mật</Text> của chúng
            tôi.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    backgroundColor: "#00A86B",
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 30,
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
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  pendingPaymentCard: {
    backgroundColor: "#fff3cd",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#ffc107",
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#856404",
    marginBottom: 8,
  },
  pendingText: {
    fontSize: 14,
    color: "#856404",
    marginBottom: 12,
  },
  checkStatusButton: {
    backgroundColor: "#ffc107",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  checkStatusText: {
    color: "#212529",
    fontSize: 14,
    fontWeight: "600",
  },
  pendingButtonContainer: {
    gap: 8,
  },
  verifyButton: {
    backgroundColor: "#17a2b8",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  verifyButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  clearButton: {
    backgroundColor: "#dc3545",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  clearButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  pendingSubtext: {
    fontSize: 12,
    color: "#856404",
    marginBottom: 12,
    fontStyle: "italic",
  },
  currentSubscriptionCard: {
    backgroundColor: "#d4edda",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#28a745",
  },
  currentSubscriptionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#155724",
    marginBottom: 8,
  },
  currentSubscriptionText: {
    fontSize: 14,
    color: "#155724",
    marginBottom: 8,
  },
  currentSubscriptionId: {
    fontSize: 12,
    color: "#155724",
    fontStyle: "italic",
  },
  currentSubscriptionUsage: {
    fontSize: 12,
    color: "#155724",
    marginBottom: 4,
  },
  activePlan: {
    borderColor: "#28a745",
    backgroundColor: "#f8fff9",
  },
  activeBadge: {
    position: "absolute",
    top: -8,
    left: 20,
    backgroundColor: "#28a745",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  activeIndicator: {
    backgroundColor: "#28a745",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "center",
  },
  activeIndicatorText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  subscriptionNote: {
    fontSize: 12,
    color: "#155724",
    fontStyle: "italic",
    marginTop: 8,
    textAlign: "center",
  },
  disabledPlan: {
    backgroundColor: "#f8f9fa",
    borderColor: "#dee2e6",
    opacity: 0.6,
  },
  disabledBadge: {
    position: "absolute",
    top: -8,
    right: 20,
    backgroundColor: "#6c757d",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  disabledText: {
    color: "#6c757d",
  },
  disabledPrice: {
    color: "#6c757d",
  },
  disabledIcon: {
    color: "#6c757d",
  },
});
