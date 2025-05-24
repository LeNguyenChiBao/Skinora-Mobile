import axios from "axios";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Platform } from "react-native";
import { storage } from "../configs/firebase.config";

export interface AnalysisResult {
  prediction?: {
    predictionIndex?: number;
    skinType?: string;
  };
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
 * Sends an image to the prediction API
 * @param imageUri The local URI of the image
 * @returns Promise with the analysis result
 */
export const analyzeImage = async (
  imageUri: string
): Promise<AnalysisResult> => {
  try {
    console.log("Preparing to analyze image:", imageUri);
    
    const formData = new FormData();

    // Extract file name from URI
    const uriParts = imageUri.split("/");
    const fileName = uriParts[uriParts.length - 1] || "photo.jpg";

    // Log the platform and uri format
    console.log(`Platform: ${Platform.OS}, using filename: ${fileName}`);

    // Special handling for Web platform
    if (Platform.OS === 'web') {
      try {
        // For web, we need to fetch the image first and create a blob
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

    // Log what we're sending
    console.log("Sending request to API with FormData");
    
    // Make the API request
    const response = await axios.post(
      "http://192.168.1.35:3000/predict",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
          Accept: "application/json",
        },
        timeout: 10000, // 10 seconds timeout
      }
    );

    console.log("Server response:", response.data);
    return response.data;
  } catch (error: any) {
    return { error: "Failed to analyze image" };
  }
};