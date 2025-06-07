import AsyncStorage from "@react-native-async-storage/async-storage";
import axios, { AxiosInstance } from "axios";

interface LoginRequest {
  email: string;
  password: string;
}

interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  address: string;
  dob: string;
  avatarUrl: string;
  role: string;
  isActive: boolean;
  isVerified: boolean;
  currentSubscription?: string;
}

interface LoginResponse {
  success: boolean;
  data?: {
    message: string;
    user: User;
    token: string;
  };
  message?: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  dob: string;
  address: string;
  avatarUrl: string;
}

interface RegisterResponse {
  message: string;
  user: User;
}

interface UpdateUserRequest {
  fullName?: string;
  phone?: string;
  address?: string;
  avatarUrl?: string;
}

interface UpdateUserResponse {
  success: boolean;
  data?: {
    message: string;
    user: User;
  };
  message?: string;
}

class AuthService {
  private api: AxiosInstance;
  private readonly TOKEN_KEY = "auth_token";
  private readonly USER_KEY = "user_data";

  constructor() {
    const baseURL = process.env.EXPO_PUBLIC_API_BASE_URL;

    this.api = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        console.log(
          `Making ${config.method?.toUpperCase()} request to: ${
            config.baseURL
          }${config.url}`
        );
        return config;
      },
      (error) => {
        console.error("Request error:", error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => {
        console.log("Response status:", response.status);
        console.log("Response data:", response.data);
        return response;
      },
      (error) => {
        console.error("Response error:", error);
        return Promise.reject(error);
      }
    );
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await this.api.post("/auth/login", credentials);

      const loginData = {
        message: response.data.message,
        user: response.data.user,
        token: response.data.token,
      };

      // Store token and user data
      await this.storeToken(loginData.token);
      await this.storeUserData(loginData.user);

      return {
        success: true,
        data: loginData,
      };
    } catch (error: any) {
      console.error("Login error:", error);

      if (error.code === "ECONNABORTED") {
        return {
          success: false,
          message: "Kết nối quá lâu. Vui lòng thử lại.",
        };
      }

      if (error.response) {
        // Server responded with error status
        return {
          success: false,
          message: error.response.data?.message || "Đăng nhập thất bại",
        };
      } else if (error.request) {
        // Network error
        return {
          success: false,
          message: "Lỗi kết nối đến máy chủ. Kiểm tra kết nối mạng.",
        };
      } else {
        return {
          success: false,
          message: "Có lỗi xảy ra. Vui lòng thử lại.",
        };
      }
    }
  }

  async register(
    data: RegisterRequest
  ): Promise<{ success: boolean; data?: RegisterResponse; message?: string }> {
    try {
      const response = await this.api.post("/auth/register", data);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error("Register error:", error);

      if (error.code === "ECONNABORTED") {
        return {
          success: false,
          message: "Kết nối quá lâu. Vui lòng thử lại.",
        };
      }

      if (error.response) {
        return {
          success: false,
          message: error.response.data?.message || "Đăng ký thất bại",
        };
      } else if (error.request) {
        return {
          success: false,
          message: "Lỗi kết nối đến máy chủ. Kiểm tra kết nối mạng.",
        };
      } else {
        return {
          success: false,
          message: "Có lỗi xảy ra. Vui lòng thử lại.",
        };
      }
    }
  }

  async updateUser(userId: string, data: UpdateUserRequest): Promise<UpdateUserResponse> {
    try {
      const token = await this.getToken();
      if (!token) {
        return {
          success: false,
          message: "Không tìm thấy token xác thực",
        };
      }

      const response = await this.api.patch(`/users/${userId}`, data, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Check if response has user data (response.data is the user object directly)
      if (response.data && response.data._id) {
        // Map the response to match User interface
        const updatedUser: User = {
          id: response.data._id,
          email: response.data.email,
          fullName: response.data.fullName,
          phone: response.data.phone,
          address: response.data.address,
          dob: response.data.dob,
          avatarUrl: response.data.avatarUrl,
          role: response.data.role,
          isActive: response.data.isActive,
          isVerified: response.data.isVerified,
        };

        await this.storeUserData(updatedUser);
        
        return {
          success: true,
          data: {
            message: "Cập nhật thành công",
            user: updatedUser,
          },
        };
      } else {
        console.error("No user data in response:", response.data);
        return {
          success: false,
          message: "Không nhận được dữ liệu người dùng từ server",
        };
      }
    } catch (error: any) {
      console.error("Update user error:", error);

      if (error.code === "ECONNABORTED") {
        return {
          success: false,
          message: "Kết nối quá lâu. Vui lòng thử lại.",
        };
      }

      if (error.response) {
        return {
          success: false,
          message: error.response.data?.message || "Cập nhật thông tin thất bại",
        };
      } else if (error.request) {
        return {
          success: false,
          message: "Lỗi kết nối đến máy chủ. Kiểm tra kết nối mạng.",
        };
      } else {
        return {
          success: false,
          message: "Có lỗi xảy ra. Vui lòng thử lại.",
        };
      }
    }
  }

  async logout(): Promise<boolean> {
    try {
      // Clear stored tokens and user data
      await this.clearToken();
      await this.clearUserData();
      return true;
    } catch (error) {
      console.error("Logout error:", error);
      return false;
    }
  }

  // Token management methods
  async storeToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(this.TOKEN_KEY, token);
    } catch (error) {
      console.error("Error storing token:", error);
      throw error;
    }
  }

  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(this.TOKEN_KEY);
    } catch (error) {
      console.error("Error getting token:", error);
      return null;
    }
  }

  async clearToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.TOKEN_KEY);
    } catch (error) {
      console.error("Error clearing token:", error);
      throw error;
    }
  }

  // User data management methods
  async storeUserData(user: User): Promise<void> {
    try {
      if (!user) {
        console.error("Cannot store null/undefined user data");
        throw new Error("User data is null or undefined");
      }
      await AsyncStorage.setItem(this.USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error("Error storing user data:", error);
      throw error;
    }
  }

  async getUserData(): Promise<User | null> {
    try {
      const userData = await AsyncStorage.getItem(this.USER_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error("Error getting user data:", error);
      return null;
    }
  }

  async clearUserData(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.USER_KEY);
    } catch (error) {
      console.error("Error clearing user data:", error);
      throw error;
    }
  }

  // Check if user is logged in
  async isLoggedIn(): Promise<boolean> {
    try {
      const token = await this.getToken();
      return token !== null;
    } catch (error) {
      console.error("Error checking login status:", error);
      return false;
    }
  }
}

export const authService = new AuthService();
export type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  User,
};
