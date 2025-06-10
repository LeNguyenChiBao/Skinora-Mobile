import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

// Cloudinary configuration from environment variables
const CLOUDINARY_CLOUD_NAME =
  Constants.expoConfig?.extra?.CLOUDINARY_CLOUD_NAME ||
  Constants.manifest?.extra?.CLOUDINARY_CLOUD_NAME ||
  "dh2sxkvuu";

const CLOUDINARY_API_KEY =
  Constants.expoConfig?.extra?.CLOUDINARY_API_KEY ||
  Constants.manifest?.extra?.CLOUDINARY_API_KEY ||
  "319917973162279";

const CLOUDINARY_API_SECRET =
  Constants.expoConfig?.extra?.CLOUDINARY_API_SECRET ||
  Constants.manifest?.extra?.CLOUDINARY_API_SECRET ||
  "T9yUWg-MZzdRaToY0GUr7PGqXis";

const CLOUDINARY_UPLOAD_PRESET =
  Constants.expoConfig?.extra?.CLOUDINARY_UPLOAD_PRESET ||
  Constants.manifest?.extra?.CLOUDINARY_UPLOAD_PRESET ||
  "FeuPLOAD";

const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// Debug log to check configuration (without exposing sensitive data)
console.log("🔧 [Cloudinary] Configuration loaded:", {
  cloudName: CLOUDINARY_CLOUD_NAME ? "SET" : "MISSING",
  apiKey: CLOUDINARY_API_KEY ? "SET" : "MISSING",
  uploadPreset: CLOUDINARY_UPLOAD_PRESET ? "SET" : "MISSING",
  url: CLOUDINARY_URL,
});

// Generate signature for signed uploads
const generateSignature = (params: Record<string, any>): string => {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  // In production, you should generate this signature on your backend
  // This is a simplified version for demonstration
  return `${sortedParams}${CLOUDINARY_API_SECRET}`;
};

export interface CloudinaryResponse {
  secure_url: string;
  public_id: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  created_at: string;
}

export interface UploadImageResult {
  success: boolean;
  url?: string;
  error?: string;
  data?: CloudinaryResponse;
}

export class CloudinaryService {
  /**
   * Upload image to Cloudinary with signed request
   */
  static async uploadImage(
    imageUri: string,
    useSignedUpload = false
  ): Promise<UploadImageResult> {
    try {
      console.log("☁️ [DEBUG] Upload config check:", {
        cloudName: CLOUDINARY_CLOUD_NAME,
        uploadPreset: CLOUDINARY_UPLOAD_PRESET,
        hasApiKey: !!CLOUDINARY_API_KEY,
        url: CLOUDINARY_URL,
      });

      if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
        throw new Error(
          `Cloudinary configuration missing: cloudName=${CLOUDINARY_CLOUD_NAME}, uploadPreset=${CLOUDINARY_UPLOAD_PRESET}`
        );
      }

      console.log("☁️ [DEBUG] Starting upload to:", CLOUDINARY_URL);
      console.log("☁️ [DEBUG] Image URI:", imageUri.substring(0, 100) + "...");

      // Create form data
      const formData = new FormData();

      // Get file info
      const filename = imageUri.split("/").pop() || "image.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : "image/jpeg";

      console.log("☁️ [DEBUG] File info:", { filename, type });

      formData.append("file", {
        uri: imageUri,
        type,
        name: filename,
      } as any);

      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

      console.log(
        "☁️ [DEBUG] FormData prepared with preset:",
        CLOUDINARY_UPLOAD_PRESET
      );

      // Add API key and signature for signed uploads
      if (useSignedUpload && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
        console.log("☁️ [DEBUG] Adding signed upload parameters");
        const timestamp = Math.round(Date.now() / 1000);
        const params = {
          timestamp,
          upload_preset: CLOUDINARY_UPLOAD_PRESET,
        };

        formData.append("api_key", CLOUDINARY_API_KEY);
        formData.append("timestamp", timestamp.toString());
        formData.append("signature", generateSignature(params));
      }

      console.log("☁️ [DEBUG] Making request to Cloudinary...");

      // Upload to Cloudinary - Remove Content-Type header for FormData
      const response = await fetch(CLOUDINARY_URL, {
        method: "POST",
        body: formData,
        // Don't set Content-Type header - let browser set it with boundary
      });

      console.log("☁️ [DEBUG] Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ [DEBUG] Upload failed response:", errorText);
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const data: CloudinaryResponse = await response.json();
      console.log("✅ [DEBUG] Upload successful:", {
        url: data.secure_url,
        publicId: data.public_id,
        size: data.bytes,
      });

      return {
        success: true,
        url: data.secure_url,
        data,
      };
    } catch (error) {
      console.error("❌ Cloudinary upload error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Upload failed",
      };
    }
  }

  /**
   * Pick image from gallery and upload to Cloudinary
   */
  static async pickAndUploadImage(
    useSignedUpload = false
  ): Promise<UploadImageResult> {
    try {
      console.log("🔍 Starting image picker...");

      // Request permissions with better handling
      if (Platform.OS !== "web") {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        console.log("📋 Media library permission status:", status);

        if (status !== "granted") {
          console.error("❌ Permission denied for media library");
          return {
            success: false,
            error: "Cần cấp quyền truy cập thư viện ảnh để tiếp tục",
          };
        }
      }

      console.log("📸 Launching image picker...");

      // Pick image with better options
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      console.log("📸 Image picker result:", {
        canceled: result.canceled,
        assetsLength: result.assets?.length || 0,
      });

      if (result.canceled) {
        console.log("📸 User canceled image selection");
        return {
          success: false,
          error: "Đã hủy chọn ảnh",
        };
      }

      if (!result.assets || result.assets.length === 0) {
        console.error("❌ No assets returned from image picker");
        return {
          success: false,
          error: "Không có ảnh nào được chọn",
        };
      }

      const selectedAsset = result.assets[0];
      console.log("📸 Selected asset:", {
        uri: selectedAsset.uri,
        width: selectedAsset.width,
        height: selectedAsset.height,
        fileSize: selectedAsset.fileSize,
      });

      // Upload to Cloudinary
      console.log("☁️ Starting Cloudinary upload...");
      return await this.uploadImage(selectedAsset.uri, useSignedUpload);
    } catch (error) {
      console.error("❌ Pick and upload error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Lỗi khi chọn và tải ảnh lên",
      };
    }
  }

  /**
   * Take photo with camera and upload to Cloudinary
   */
  static async takeAndUploadPhoto(
    useSignedUpload = false
  ): Promise<UploadImageResult> {
    try {
      console.log("📷 Starting camera...");

      // Request permissions with better handling
      if (Platform.OS !== "web") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        console.log("📋 Camera permission status:", status);

        if (status !== "granted") {
          console.error("❌ Permission denied for camera");
          return {
            success: false,
            error: "Cần cấp quyền truy cập camera để tiếp tục",
          };
        }
      }

      console.log("📷 Launching camera...");

      // Take photo
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      console.log("📷 Camera result:", {
        canceled: result.canceled,
        assetsLength: result.assets?.length || 0,
      });

      if (result.canceled) {
        console.log("📷 User canceled photo capture");
        return {
          success: false,
          error: "Đã hủy chụp ảnh",
        };
      }

      if (!result.assets || result.assets.length === 0) {
        console.error("❌ No assets returned from camera");
        return {
          success: false,
          error: "Không có ảnh nào được chụp",
        };
      }

      const capturedAsset = result.assets[0];
      console.log("📷 Captured asset:", {
        uri: capturedAsset.uri,
        width: capturedAsset.width,
        height: capturedAsset.height,
        fileSize: capturedAsset.fileSize,
      });

      // Upload to Cloudinary
      console.log("☁️ Starting Cloudinary upload...");
      return await this.uploadImage(capturedAsset.uri, useSignedUpload);
    } catch (error) {
      console.error("❌ Take and upload error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Lỗi khi chụp và tải ảnh lên",
      };
    }
  }

  /**
   * Get optimized image URL with transformations
   */
  static getOptimizedImageUrl(
    imageUrl: string,
    options?: {
      width?: number;
      height?: number;
      quality?: number;
      format?: "auto" | "jpg" | "png" | "webp";
    }
  ): string {
    if (!imageUrl.includes("cloudinary.com")) {
      return imageUrl;
    }

    const { width, height, quality = 80, format = "auto" } = options || {};

    let transformations = `f_${format},q_${quality}`;

    if (width) transformations += `,w_${width}`;
    if (height) transformations += `,h_${height}`;
    if (width && height) transformations += ",c_fill";

    return imageUrl.replace("/upload/", `/upload/${transformations}/`);
  }

  /**
   * Delete image from Cloudinary (requires API key and secret)
   */
  static async deleteImage(
    publicId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        throw new Error("API credentials required for delete operation");
      }

      const timestamp = Math.round(Date.now() / 1000);
      const params = {
        public_id: publicId,
        timestamp,
      };

      const signature = generateSignature(params);

      const formData = new FormData();
      formData.append("public_id", publicId);
      formData.append("api_key", CLOUDINARY_API_KEY);
      formData.append("timestamp", timestamp.toString());
      formData.append("signature", signature);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.status}`);
      }

      return { success: true };
    } catch (error) {
      console.error("❌ Cloudinary delete error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Delete failed",
      };
    }
  }
}
