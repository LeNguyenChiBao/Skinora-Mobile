import axios from "axios";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Platform } from "react-native";
import { storage } from "../configs/firebase.config";
import { authService } from "./authServices.service";

export interface ProductRecommendation {
  recommendationId: string;
  productId: string;
  reason: string;
  _id: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisResult {
  success: boolean;
  data?: {
    userId: string;
    imageUrl: string;
    skinType: string;
    analysisDate: string;
    recommendedProducts: ProductRecommendation[];
    result: string;
    _id: string;
    createdAt: string;
    updatedAt: string;
    __v: number;
  };
  message?: string;
  error?: string;
}

/**
 * Uploads an image to Firebase Storage
 * @param imageUri The local URI of the image
 * @returns Promise with the download URL
 */
export const uploadImageToFirebase = async (
  imageUri: string
): Promise<string> => {
  try {
    // Convert URI to blob
    const response = await fetch(imageUri);
    const blob = await response.blob();

    // Create a unique filename
    const filename = `skin_image_${new Date().getTime()}.jpg`;
    const storageRef = ref(storage, `WDP/${filename}`);

    // Upload to Firebase
    await uploadBytes(storageRef, blob);

    // Get download URL
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (error) {
    console.error("Error uploading image to Firebase:", error);
    throw error;
  }
};

/**
 * Sends an image to the skin analysis API
 * @param imageUri The local URI of the image
 * @returns Promise with the analysis result
 */
export const analyzeImage = async (
  imageUri: string
): Promise<AnalysisResult> => {
  try {
    console.log("Preparing to analyze image:", imageUri);

    // Get stored token
    const token = await authService.getToken();

    const formData = new FormData();

    // Extract file name from URI
    const uriParts = imageUri.split("/");
    const fileName = uriParts[uriParts.length - 1] || "photo.jpg";

    console.log(`Platform: ${Platform.OS}, using filename: ${fileName}`);

    // Special handling for Web platform
    if (Platform.OS === "web") {
      try {
        const response = await fetch(imageUri);
        const blob = await response.blob();

        console.log("Web platform: Created blob from image URI");
        formData.append("file", blob, fileName);
      } catch (fetchError) {
        console.error("Error fetching image on web:", fetchError);
        throw fetchError;
      }
    } else {
      // For native platforms (iOS, Android)
      formData.append("file", {
        uri: Platform.OS === "ios" ? imageUri.replace("file://", "") : imageUri,
        name: fileName,
        type: "image/jpeg",
      } as any);

      console.log("Native platform: Appended file object to FormData");
    }

    console.log("Sending request to analysis API");

    // Prepare headers
    const headers: any = {
      "Content-Type": "multipart/form-data",
      Accept: "application/json",
    };

    // Add authorization header if token exists
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      console.log("Added authorization token to request");
    }

    // Make the API request to the new endpoint
    const response = await axios.post(
      `${
        process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000"
      }/analysis/upload`,
      formData,
      {
        headers,
        timeout: 30000, // 30 seconds timeout for analysis
      }
    );

    console.log("Analysis response:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("Analysis error:", error);

    if (error.response) {
      return {
        success: false,
        error: error.response.data?.message || "Server error occurred",
      };
    } else if (error.request) {
      return {
        success: false,
        error: "Network error. Please check your connection.",
      };
    } else {
      return {
        success: false,
        error: "Failed to analyze image",
      };
    }
  }
};
