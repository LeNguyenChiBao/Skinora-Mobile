import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AnalysisResult,
  analyzeImage,
  checkAnalysisEligibility,
  translateSubscriptionMessage,
  uploadImageToFirebase
} from "../../services/scanning.service";

export default function ScanningScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [firebaseUrl, setFirebaseUrl] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedFaceArea, setSelectedFaceArea] = useState<string | null>(null);
  const [showModel, setShowModel] = useState<boolean>(true);
  const [showProductModal, setShowProductModal] = useState<boolean>(false);
  const [eligibilityLoading, setEligibilityLoading] = useState<boolean>(false);
  const [eligibilityChecked, setEligibilityChecked] = useState<boolean>(false);
  const [canAnalyze, setCanAnalyze] = useState<boolean>(false);
  const [eligibilityMessage, setEligibilityMessage] = useState<string>("");

  useEffect(() => {
    (async () => {
      // Request camera and media library permissions
      const cameraPermission =
        await ImagePicker.requestCameraPermissionsAsync();
      const mediaLibraryPermission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (
        cameraPermission.status !== "granted" ||
        mediaLibraryPermission.status !== "granted"
      ) {
        alert("Permission to access camera and media library is required!");
      }

      // Check eligibility when screen loads
      await checkEligibility();
    })();
  }, []);

  const takePicture = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // Keep for backward compatibility
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
        uploadToFirebase(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error taking picture:", error);
      Alert.alert("Error", "Failed to take picture");
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // Keep for backward compatibility
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
        uploadToFirebase(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const uploadToFirebase = async (uri: string) => {
    setUploading(true);
    setPrediction(null);

    try {
      const downloadUrl = await uploadImageToFirebase(uri);
      console.log("File uploaded to Firebase:", downloadUrl);
      setFirebaseUrl(downloadUrl);
    } catch (error) {
      console.error("Error uploading to Firebase:", error);
      Alert.alert("Error", "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const analyzeSkin = async () => {
    if (!image) {
      Alert.alert("No image", "Please take or select an image first");
      return;
    }

    // Check eligibility before analysis
    if (!eligibilityChecked) {
      await checkEligibility();
    }

    if (!canAnalyze) {
      Alert.alert(
        "Không thể phân tích", 
        eligibilityMessage || translateSubscriptionMessage("You are not eligible for skin analysis at this time")
      );
      return;
    }

    setLoading(true);

    try {
      // Send the local image directly - don't use the Firebase URL
      const result = await analyzeImage(image);
      console.log("Prediction result:", result);

      // Add console.log to see recommended products
      if (result.data?.recommendedProducts) {
        console.log(
          "prediction.data.recommendedProducts.length:",
          result.data.recommendedProducts.length
        );
        console.log(
          "prediction.data.recommendedProducts:",
          result.data.recommendedProducts
        );
      }

      setPrediction(result);

      // If analysis failed due to eligibility issues, refresh eligibility status
      if (!result.success && result.error && (
          result.error.includes("đăng ký") || 
          result.error.includes("lượt phân tích") || 
          result.error.includes("gói"))) {
        console.log("Analysis failed due to eligibility, refreshing eligibility status");
        await checkEligibility();
      }
    } catch (error) {
      console.error("Prediction failed:", error);
      Alert.alert("Error", "Skin analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFaceAreaSelected = (point: {
    x: number;
    y: number;
    z: number;
    area: string;
  }) => {
    setSelectedFaceArea(point.area);
    console.log("Selected face area:", point);
  };

  const proceedToImageCapture = () => {
    if (!selectedFaceArea) {
      Alert.alert(
        "Chưa chọn vùng",
        "Vui lòng chọn vùng da cần phân tích trước"
      );
      return;
    }
    setShowModel(false);
  };

  const checkEligibility = async () => {
    setEligibilityLoading(true);
    try {
      const result = await checkAnalysisEligibility();

      if ('error' in result) {
        setCanAnalyze(false);
        setEligibilityMessage(result.error);
        // Don't show alert on initial load, only show when user tries to analyze
      } else {
        setCanAnalyze(result.data.canAnalyze);
        setEligibilityMessage(translateSubscriptionMessage(result.data.message));
        
        // Don't show alert on initial load if user can't analyze
        // The alert will be shown when they try to analyze
      }
      setEligibilityChecked(true);
    } catch (error) {
      console.error("Error checking eligibility:", error);
      setCanAnalyze(false);
      setEligibilityMessage(translateSubscriptionMessage("Failed to check analysis eligibility"));
      // Don't show alert on initial load
    } finally {
      setEligibilityLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Phân tích da</Text>
          <Text style={styles.subtitle}>
            {showModel
              ? "Chọn vùng da cần phân tích"
              : "Upload a clear photo of your skin for analysis"}
          </Text>

          {/* Eligibility Status Banner */}
          {eligibilityLoading ? (
            <View style={styles.eligibilityBanner}>
              <ActivityIndicator size="small" color="#4285F4" />
              <Text style={styles.eligibilityText}>Đang kiểm tra quyền phân tích...</Text>
            </View>
          ) : eligibilityChecked && (
            <View style={[
              styles.eligibilityBanner, 
              canAnalyze ? styles.eligibilitySuccess : styles.eligibilityError
            ]}>
              <Ionicons 
                name={canAnalyze ? "checkmark-circle" : "alert-circle"} 
                size={16} 
                color={canAnalyze ? "#00A86B" : "#e74c3c"} 
              />
              <Text style={[
                styles.eligibilityText,
                canAnalyze ? styles.eligibilitySuccessText : styles.eligibilityErrorText
              ]}>
                {eligibilityMessage}
              </Text>
              {!canAnalyze && (
                <TouchableOpacity 
                  style={styles.refreshEligibilityButton}
                  onPress={checkEligibility}
                >
                  <Ionicons name="refresh" size={14} color="#e74c3c" />
                </TouchableOpacity>
              )}
            </View>
          )}

          <>
            <View style={styles.imageContainer}>
              {image ? (
                <>
                  <Image source={{ uri: image }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => {
                      setImage(null);
                      setFirebaseUrl(null);
                      setPrediction(null);
                    }}
                  >
                    <Ionicons name="close-circle" size={28} color="#fff" />
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.placeholderContainer}>
                  <Ionicons name="image-outline" size={50} color="#a0a0a0" />
                  <Text style={styles.placeholderText}>Bạn chưa chọn ảnh</Text>
                  <Text style={styles.placeholderSubtext}>
                    Chụp hoặc tải ảnh từ thư viện để phân tích
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.button}
                onPress={takePicture}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="camera"
                  size={22}
                  color="white"
                  style={styles.buttonIcon}
                />
                <Text style={styles.buttonText}>Chụp ảnh</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={pickImage}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="images"
                  size={22}
                  color="white"
                  style={styles.buttonIcon}
                />
                <Text style={styles.buttonText}>Thư viện</Text>
              </TouchableOpacity>
            </View>

            {uploading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4285F4" />
                <Text style={styles.loadingText}>Đang tải ảnh...</Text>
              </View>
            ) : (
              firebaseUrl && (
                <TouchableOpacity
                  style={[
                    styles.analyzeButton,
                    (loading || !canAnalyze) && styles.disabledButton,
                  ]}
                  onPress={analyzeSkin}
                  disabled={loading || !canAnalyze}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <>
                      <ActivityIndicator
                        size="small"
                        color="#fff"
                        style={styles.buttonLoader}
                      />
                      <Text style={styles.analyzeButtonText}>Đang phân tích...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons
                        name="scan-outline"
                        size={24}
                        color="white"
                        style={styles.buttonIcon}
                      />
                      <Text style={styles.analyzeButtonText}>Phân tích da</Text>
                    </>
                  )}
                </TouchableOpacity>
              )
            )}

            {selectedFaceArea && (
              <View style={styles.selectedAreaInfo}>
                <Text style={styles.selectedAreaText}>
                  Đang phân tích vùng: {selectedFaceArea}
                </Text>
                <TouchableOpacity
                  style={styles.changeAreaButton}
                  onPress={() => setShowModel(true)}
                >
                  <Text style={styles.changeAreaButtonText}>Đổi vùng</Text>
                </TouchableOpacity>
              </View>
            )}

            {prediction && (
              <View style={styles.predictionContainer}>
                <View style={styles.predictionHeader}>
                  <Ionicons
                    name={
                      prediction.error ? "alert-circle" : "checkmark-circle"
                    }
                    size={24}
                    color={prediction.error ? "#e74c3c" : "#34A853"}
                  />
                  <Text style={styles.predictionTitle}>Kết quả</Text>
                  <Text>{prediction.data?.result}</Text>
                </View>

                {prediction.error ? (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{prediction.error}</Text>
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={analyzeSkin}
                    >
                      <Text style={styles.retryButtonText}>Thử lại</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  prediction.success &&
                  prediction.data && (
                    <View style={styles.resultContainer}>
                      <Text style={styles.predictionText}>
                        Kết quả phân tích:
                      </Text>
                      <Text style={styles.skinType}>
                        {prediction.data.skinType}
                      </Text>
                      <Text style={styles.confidenceText}>
                        {prediction.data.result}
                      </Text>

                      <TouchableOpacity
                        style={styles.viewResultButton}
                        onPress={() => setShowProductModal(true)}
                      >
                        <Ionicons
                          name="eye-outline"
                          size={20}
                          color="#00A86B"
                          style={styles.buttonIcon}
                        />
                        <Text style={styles.viewResultButtonText}>
                          Xem chi tiết kết quả
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )
                )}
              </View>
            )}
          </>
        </View>
      </ScrollView>

      {/* Analysis Result Modal */}
      <Modal
        visible={showProductModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProductModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kết quả phân tích</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowProductModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Analysis Result Section */}
              {prediction?.data && (
                <View style={styles.analysisResultSection}>
                  <View style={styles.resultHeader}>
                    <Ionicons name="scan-outline" size={24} color="#00A86B" />
                    <Text style={styles.sectionTitle}>
                      Kết quả phân tích da
                    </Text>
                  </View>

                  <View style={styles.resultCard}>
                    <Text style={styles.skinTypeLabel}>Loại da:</Text>
                    <Text style={styles.skinTypeValue}>
                      {prediction.data.skinType}
                    </Text>
                    <Text style={styles.resultDescription}>
                      {prediction.data.result}
                    </Text>
                  </View>
                </View>
              )}

              {/* Recommended Products Section */}
              {prediction?.data?.recommendedProducts &&
                prediction.data.recommendedProducts.length > 0 && (
                  <View style={styles.productsSection}>
                    <View style={styles.resultHeader}>
                      <Ionicons name="bag-outline" size={24} color="#00A86B" />
                      <Text style={styles.sectionTitle}>
                        Sản phẩm được đề xuất (
                        {prediction.data.recommendedProducts.length})
                      </Text>
                    </View>

                    {prediction.data.recommendedProducts.map(
                      (product, index) => (
                        <View key={index} style={styles.productItem}>
                          <View style={styles.productInfo}>
                            <Text style={styles.productName}>
                              {typeof product.productId === 'object' && product.productId?.productName ||
                                product.productName ||
                                `Sản phẩm ${index + 1}`}
                            </Text>
                            <Text style={styles.productBrand}>
                              {typeof product.productId === 'object' && product.productId?.brand ||
                                product.brand}
                            </Text>
                            <Text style={styles.productDescription}>
                              {product.reason || "Phù hợp với loại da của bạn"}
                            </Text>
                            {((typeof product.productId === 'object' && product.productId?.price) || product.price) && (
                              <Text style={styles.productPrice}>
                                {new Intl.NumberFormat("vi-VN", {
                                  style: "currency",
                                  currency: "VND",
                                }).format(
                                  (typeof product.productId === 'object' && product.productId?.price) || product.price
                                )}
                              </Text>
                            )}
                          </View>
                          <TouchableOpacity style={styles.viewProductButton}>
                            <Text style={styles.viewProductButtonText}>
                              Xem
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )
                    )}
                  </View>
                )}
            </ScrollView>

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowProductModal(false)}
            >
              <Text style={styles.closeModalButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f7f9fc",
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 100, // Add padding to avoid tab bar overlap
  },
  container: {
    flex: 1,
    padding: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
    textAlign: "center",
  },
  imageContainer: {
    width: "100%",
    height: 340,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#e1e4e8",
    marginBottom: 24,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  removeImageBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
  },
  placeholderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  placeholderText: {
    color: "#666",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 12,
  },
  placeholderSubtext: {
    color: "#999",
    fontSize: 14,
    marginTop: 6,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#4285F4",
    padding: 16,
    borderRadius: 12,
    width: "48%",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    shadowColor: "#4285F4",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  secondaryButton: {
    backgroundColor: "#5f6368",
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  analyzeButton: {
    backgroundColor: "#34A853",
    padding: 18,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#34A853",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  analyzeButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 18,
  },
  disabledButton: {
    backgroundColor: "#a0c4a0",
    shadowOpacity: 0.1,
  },
  buttonLoader: {
    marginRight: 10,
  },
  loadingContainer: {
    alignItems: "center",
    marginTop: 24,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  predictionContainer: {
    marginTop: 32,
    marginBottom: 24,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  predictionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  predictionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginLeft: 8,
    color: "#333",
  },
  resultContainer: {
    alignItems: "center",
  },
  predictionText: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
  },
  skinType: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#34A853",
    textTransform: "capitalize",
    marginVertical: 12,
    textAlign: "center",
  },
  confidenceText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
    fontStyle: "italic",
  },
  tipContainer: {
    backgroundColor: "#f0f7f0",
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    width: "100%",
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 22,
  },
  errorContainer: {
    alignItems: "center",
  },
  errorText: {
    color: "#e74c3c",
    fontWeight: "bold",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#e74c3c",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  modelContainer: {
    width: "100%",
    marginBottom: 24,
  },
  proceedButton: {
    backgroundColor: "#00A86B",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  proceedButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  skipModelButton: {
    padding: 12,
    alignItems: "center",
    marginTop: 8,
  },
  skipModelButtonText: {
    color: "#666",
    fontSize: 14,
  },
  selectedAreaInfo: {
    backgroundColor: "#E8F5E8",
    padding: 12,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  selectedAreaText: {
    color: "#00A86B",
    fontSize: 14,
    fontWeight: "600",
  },
  changeAreaButton: {
    backgroundColor: "#00A86B",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  changeAreaButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  productButton: {
    backgroundColor: "#E8F5E8",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    width: "100%",
    borderWidth: 1,
    borderColor: "#00A86B",
  },
  productButtonText: {
    color: "#00A86B",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center", // Change from flex-end to center
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: 20,
    maxHeight: "90%", // Increase max height
    flex: 1,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    flex: 1, // Allow title to take available space
  },
  closeButton: {
    padding: 5,
    marginLeft: 10,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10, // Add bottom padding
  },
  productItem: {
    flexDirection: "row",
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  productBrand: {
    fontSize: 12,
    color: "#00A86B",
    fontWeight: "500",
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00A86B",
  },
  viewProductButton: {
    backgroundColor: "#00A86B",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewProductButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  closeModalButton: {
    backgroundColor: "#00A86B",
    marginHorizontal: 20,
    marginVertical: 15, // Reduce margin
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  closeModalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  viewResultButton: {
    backgroundColor: "#E8F5E8",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 30, // Add bottom margin to avoid tab bar
    width: "100%",
    borderWidth: 1,
    borderColor: "#00A86B",
  },
  analysisResultSection: {
    marginBottom: 24,
  },
  productsSection: {
    marginBottom: 16,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginLeft: 8,
  },
  resultCard: {
    backgroundColor: "#f8f9fa",
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#00A86B",
  },
  skinTypeLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  skinTypeValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00A86B",
    marginBottom: 12,
    textTransform: "capitalize",
  },
  resultDescription: {
    fontSize: 16,
    color: "#333",
    lineHeight: 24,
  },
  // Eligibility styles
  eligibilityBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: "100%",
    borderWidth: 1,
  },
  eligibilitySuccess: {
    backgroundColor: "#e8f5e8",
    borderColor: "#00A86B",
  },
  eligibilityError: {
    backgroundColor: "#fef2f2",
    borderColor: "#e74c3c",
  },
  eligibilityText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  eligibilitySuccessText: {
    color: "#00A86B",
  },
  eligibilityErrorText: {
    color: "#e74c3c",
  },
  refreshEligibilityButton: {
    padding: 4,
    marginLeft: 8,
  },
  viewResultButtonText: {
    color: "#00A86B",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
