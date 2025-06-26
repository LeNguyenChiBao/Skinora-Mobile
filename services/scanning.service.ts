import axios from "axios";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Platform } from "react-native";
import { storage } from "../configs/firebase.config";
import { authService } from "./authServices.service";

export interface ProductDetails {
  productName: string;
  brand: string;
  price: number;
  _id: string;
}

export interface ProductRecommendation {
  recommendationId: string;
  productName: string;
  brand: string;
  price: number;
  productId: string | ProductDetails;
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

export interface EligibilityResponse {
  message: string;
  data: {
    canAnalyze: boolean;
    message: string;
  };
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
      // Handle specific 403 errors for eligibility issues
      if (error.response.status === 403) {
        const originalMessage = error.response.data?.message || "You are not eligible for skin analysis at this time";
        return {
          success: false,
          error: translateSubscriptionMessage(originalMessage),
        };
      }
      const originalMessage = error.response.data?.message || "Server error occurred";
      return {
        success: false,
        error: translateSubscriptionMessage(originalMessage),
      };
    } else if (error.request) {
      return {
        success: false,
        error: translateSubscriptionMessage("Network error. Please check your connection."),
      };
    } else {
      return {
        success: false,
        error: translateSubscriptionMessage("Failed to analyze image"),
      };
    }
  }
};

export const checkAnalysisEligibility = async (): Promise<EligibilityResponse | { error: string }> => {
  try {
    console.log("Checking analysis eligibility...");

    // Get stored token
    const token = await authService.getToken();

    // Prepare headers
    const headers: any = {
      'Accept': 'application/json',
    };

    // Add authorization header if token exists
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      console.log("Added authorization token to eligibility check");
    }

    // Make the API request
    const response = await axios.get(
      `${
        process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000"
      }/analysis/check-eligibility`,
      {
        headers,
        timeout: 10000, // 10 seconds timeout
      }
    );

    console.log("Eligibility check response:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("Eligibility check error:", error);

    if (error.response) {
      // Handle specific error responses
      if (error.response.status === 403) {
        const originalMessage = error.response.data?.message || "You are not eligible for skin analysis at this time";
        return {
          error: translateSubscriptionMessage(originalMessage),
        };
      }
      const originalMessage = error.response.data?.message || "Server error occurred during eligibility check";
      return {
        error: translateSubscriptionMessage(originalMessage),
      };
    } else if (error.request) {
      return {
        error: translateSubscriptionMessage("Network error. Please check your connection."),
      };
    } else {
      return {
        error: translateSubscriptionMessage("Failed to check analysis eligibility"),
      };
    }
  }
};

/**
 * Translates subscription-related messages to Vietnamese
 * @param message The English message to translate
 * @returns Translated Vietnamese message
 */
export const translateSubscriptionMessage = (message: string): string => {
  // Handle messages with dynamic content
  if (message.includes("You have used all 3 free weekly skin analyses")) {
    return "Bạn đã sử dụng hết 3 lần phân tích da miễn phí trong tuần. Vui lòng đăng ký gói để có thêm lượt phân tích.";
  }
  
  if (message.includes("Your subscription is not active")) {
    // Extract status from message
    const statusMatch = message.match(/current status: ([^)]+)\)/);
    const status = statusMatch ? statusMatch[1] : "không xác định";
    return `Gói đăng ký của bạn không hoạt động (trạng thái hiện tại: ${status}).`;
  }
  
  if (message.includes("analyses remaining in your subscription")) {
    // Extract remaining count from message
    const countMatch = message.match(/You have (\d+) analyses remaining/);
    const count = countMatch ? countMatch[1] : "0";
    return `Bạn còn ${count} lượt phân tích trong gói đăng ký của mình.`;
  }
  
  // Handle other common subscription messages
  switch (message) {
    case "You are not eligible for skin analysis at this time":
      return "Bạn không thể sử dụng tính năng phân tích da lúc này.";
    case "Server error occurred":
      return "Đã xảy ra lỗi máy chủ.";
    case "Network error. Please check your connection.":
      return "Lỗi mạng. Vui lòng kiểm tra kết nối của bạn.";
    case "Failed to analyze image":
      return "Không thể phân tích hình ảnh.";
    case "Failed to check analysis eligibility":
      return "Không thể kiểm tra quyền phân tích.";
    default:
      return message; // Return original message if no translation found
  }
};
