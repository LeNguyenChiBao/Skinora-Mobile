import { authService } from "./authServices.service";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

interface UserSubscription {
  _id: string;
  currentSubscription?: string;
  // Add other user fields as needed
}

interface UserResponse {
  success: boolean;
  data: UserSubscription;
  message?: string;
}

export const userService = {
  getCurrentUser: async (): Promise<UserResponse> => {
    try {
      const token = await authService.getToken();
      const userData = await authService.getUserData();

      if (!userData?.id) {
        throw new Error("User ID not found");
      }

      const response = await fetch(`${API_BASE_URL}/users/${userData.id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch user data");
      }

      const result = await response.json();
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error("Error fetching user data:", error);
      throw error;
    }
  },
};
