import { paymentService } from "@/services/payment.service";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useMemo } from "react";
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const SEPAY_ACCOUNT_NUMBER = "0908705620"; // Số tài khoản nhận
const SEPAY_BANK_SHORT_NAME = "MB"; // Mã ngân hàng nhận

// Helper to remove currency formatting and get a number
const parseAmount = (priceString: string): number => {
  return parseInt(priceString.replace(/[^0-9]/g, ""), 10);
};

export default function PaymentQRScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    name: string;
    price: string;
    paymentId?: string;
    amount?: string;
    description?: string;
    subscriptionId?: string;
    orderCode?: string;
    bankAccount?: string;
    bankName?: string;
    accountName?: string;
    transferContent?: string;
  }>();

  const {
    id,
    name,
    price,
    transferContent,
    orderCode,
    bankAccount,
    bankName,
    accountName,
  } = params;

  // Nếu thiếu thông tin, báo lỗi
  if (!id || !name || !price || !transferContent) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Lỗi: Không tìm thấy thông tin gói.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const amount = parseAmount(price);

  // Tạo link QR Sepay dùng đúng transferContent từ BE
  const qrImageUrl = useMemo(() => {
    const searchParams = new URLSearchParams({
      acc: bankAccount || SEPAY_ACCOUNT_NUMBER,
      bank: bankName || SEPAY_BANK_SHORT_NAME,
      amount: amount.toString(),
      des: transferContent,
      template: "compact",
    });
    return `https://qr.sepay.vn/img?${searchParams.toString()}`;
  }, [amount, transferContent, bankAccount, bankName]);

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert("Đã sao chép", `${text} đã được sao chép vào bộ nhớ đệm.`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thanh toán QR</Text>
      </View>

      <View style={styles.content}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.instructionText}>
            Quét mã QR dưới đây bằng ứng dụng ngân hàng của bạn để hoàn tất
            thanh toán
          </Text>
          <View style={styles.qrContainer}>
            <Image source={{ uri: qrImageUrl }} style={styles.qrImage} />
          </View>
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={async () => {
              try {
                const { status } = await MediaLibrary.requestPermissionsAsync();
                if (status !== "granted") {
                  Alert.alert(
                    "Lỗi",
                    "Bạn cần cấp quyền truy cập thư viện ảnh để lưu ảnh."
                  );
                  return;
                }
                const fileUri = FileSystem.cacheDirectory + "qr-download.png";
                const downloadResumable = FileSystem.createDownloadResumable(
                  qrImageUrl,
                  fileUri
                );
                const downloadResult = await downloadResumable.downloadAsync();
                if (!downloadResult || !downloadResult.uri) {
                  Alert.alert("Lỗi", "Không thể tải ảnh. Vui lòng thử lại.");
                  return;
                }
                const asset = await MediaLibrary.createAssetAsync(
                  downloadResult.uri
                );
                Alert.alert("Thành công", "Đã lưu ảnh QR vào thư viện.");
              } catch (e) {
                Alert.alert("Lỗi", "Không thể lưu ảnh QR.");
              }
            }}
          >
            <Text style={styles.downloadButtonText}>Tải ảnh QR về máy</Text>
          </TouchableOpacity>

          <View style={styles.infoGroup}>
            <Text style={styles.infoLabel}>Gói đăng ký</Text>
            <Text style={styles.infoValue}>{name}</Text>
          </View>
          <View style={styles.infoGroup}>
            <Text style={styles.infoLabel}>Số tiền</Text>
            <TouchableOpacity
              onPress={() => copyToClipboard(amount.toString())}
            >
              <Text style={styles.infoValue}>
                {amount.toLocaleString("vi-VN")}đ 📋
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.infoGroup}>
            <Text style={styles.infoLabel}>Số tài khoản nhận</Text>
            <TouchableOpacity
              onPress={() => copyToClipboard(SEPAY_ACCOUNT_NUMBER)}
            >
              <Text style={styles.infoValue}>{SEPAY_ACCOUNT_NUMBER} 📋</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.infoGroup}>
            <Text style={styles.infoLabel}>Nội dung chuyển khoản</Text>
            <TouchableOpacity onPress={() => copyToClipboard(transferContent)}>
              <Text style={styles.infoValue}>{transferContent} 📋</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={async () => {
              try {
                const res = await paymentService.checkPaymentStatus(
                  transferContent
                );
                if (res.success && res.data.status === "completed") {
                  Alert.alert("Thành công", "Thanh toán thành công!", [
                    { text: "OK", onPress: () => router.replace("/(tabs)") },
                  ]);
                } else {
                  Alert.alert(
                    "Chưa hoàn tất",
                    "Thanh toán của bạn vẫn đang chờ xử lý. Vui lòng kiểm tra lại sau."
                  );
                }
              } catch (e) {
                Alert.alert(
                  "Lỗi",
                  "Không thể kiểm tra trạng thái thanh toán. Vui lòng thử lại."
                );
              }
            }}
          >
            <Text style={styles.confirmButtonText}>Tôi đã thanh toán</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    color: "#00A86B",
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    flex: 1,
    marginLeft: -30, // Adjust to center title properly
  },
  content: {
    flex: 1,
    padding: 30,
    alignItems: "center",
  },
  instructionText: {
    fontSize: 16,
    textAlign: "center",
    color: "#666",
    marginBottom: 20,
  },
  qrContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    backgroundColor: "#fff",
  },
  qrImage: {
    width: 280,
    height: 280,
  },
  downloadButton: {
    marginTop: 10,
    backgroundColor: "#26D0CE",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  downloadButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  infoGroup: {
    width: "100%",
    backgroundColor: "#f8f9fa",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 15,
  },
  infoLabel: {
    fontSize: 14,
    color: "#888",
    marginBottom: 5,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  confirmButton: {
    marginTop: 20,
    backgroundColor: "#00A86B",
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 100,
    width: "100%",
    alignItems: "center",
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },
});
