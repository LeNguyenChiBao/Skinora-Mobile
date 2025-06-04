import Face3DModel from "@/components/Face3DModel";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
  uploadImageToFirebase,
} from "../../services/scanning.service";

export default function ScanningScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [firebaseUrl, setFirebaseUrl] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedFaceArea, setSelectedFaceArea] = useState<string | null>(null);
  const [showModel, setShowModel] = useState<boolean>(true);

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

    setLoading(true);

    try {
      // Send the local image directly - don't use the Firebase URL
      const result = await analyzeImage(image);
      console.log("Prediction result:", result);
      setPrediction(result);
    } catch (error) {
      console.error("Prediction failed:", error);
      Alert.alert("Error", "Skin analysis failed. Please try again.");
      setPrediction({ error: "Analysis failed. Please try again." });
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Skin Analysis</Text>
          <Text style={styles.subtitle}>
            {showModel
              ? "Chọn vùng da cần phân tích"
              : "Upload a clear photo of your skin for analysis"}
          </Text>

          {showModel ? (
            <View style={styles.modelContainer}>
              <Face3DModel onPointSelected={handleFaceAreaSelected} />

              {selectedFaceArea && (
                <TouchableOpacity
                  style={styles.proceedButton}
                  onPress={proceedToImageCapture}
                  activeOpacity={0.8}
                >
                  <Text style={styles.proceedButtonText}>
                    Tiếp tục với vùng {selectedFaceArea}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.skipModelButton}
                onPress={() => setShowModel(false)}
              >
                <Text style={styles.skipModelButtonText}>Bỏ qua chọn vùng</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.imageContainer}>
                {image ? (
                  <>
                    <Image
                      source={{ uri: image }}
                      style={styles.imagePreview}
                    />
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
                    <Text style={styles.placeholderText}>
                      No image selected
                    </Text>
                    <Text style={styles.placeholderSubtext}>
                      Take or upload a photo to begin
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
                  <Text style={styles.buttonText}>Take Photo</Text>
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
                  <Text style={styles.buttonText}>Gallery</Text>
                </TouchableOpacity>
              </View>

              {uploading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#4285F4" />
                  <Text style={styles.loadingText}>Uploading image...</Text>
                </View>
              ) : (
                firebaseUrl && (
                  <TouchableOpacity
                    style={[
                      styles.analyzeButton,
                      loading && styles.disabledButton,
                    ]}
                    onPress={analyzeSkin}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <>
                        <ActivityIndicator
                          size="small"
                          color="#fff"
                          style={styles.buttonLoader}
                        />
                        <Text style={styles.analyzeButtonText}>
                          Analyzing...
                        </Text>
                      </>
                    ) : (
                      <>
                        <Ionicons
                          name="scan-outline"
                          size={24}
                          color="white"
                          style={styles.buttonIcon}
                        />
                        <Text style={styles.analyzeButtonText}>
                          Analyze Skin
                        </Text>
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
                    <Text style={styles.predictionTitle}>Results</Text>
                  </View>

                  {prediction.error ? (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{prediction.error}</Text>
                      <TouchableOpacity
                        style={styles.retryButton}
                        onPress={analyzeSkin}
                      >
                        <Text style={styles.retryButtonText}>Try Again</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    prediction.success &&
                    prediction.data && (
                      <View style={styles.resultContainer}>
                        <Text style={styles.predictionText}>
                          Analysis Result:
                        </Text>
                        <Text style={styles.skinType}>
                          {prediction.data.skinType}
                        </Text>
                        <Text style={styles.confidenceText}>
                          {prediction.data.result}
                        </Text>

                        {prediction.data.recommendedProducts &&
                          prediction.data.recommendedProducts.length > 0 && (
                            <View style={styles.tipContainer}>
                              <Text style={styles.tipTitle}>
                                Recommended Products:
                              </Text>
                              <Text style={styles.tipText}>
                                {prediction.data.recommendedProducts.length}{" "}
                                products recommended for your skin type.
                              </Text>
                            </View>
                          )}
                      </View>
                    )
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
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
});
