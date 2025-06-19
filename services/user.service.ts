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

interface DayAvailability {
  isAvailable: boolean;
  timeRanges: Array<{
    start: string;
    end: string;
  }>;
  timeSlots: string[];
}

interface Doctor {
  _id: string;
  email: string;
  fullName: string;
  phone: string;
  address: string;
  photoUrl: string;
  specializations: string[];
  availability: {
    monday: DayAvailability;
    tuesday: DayAvailability;
    wednesday: DayAvailability;
    thursday: DayAvailability;
    friday: DayAvailability;
    saturday: DayAvailability;
    sunday: DayAvailability;
  };
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DoctorsResponse {
  success: boolean;
  message: string;
  data: Doctor[];
}

interface DoctorDetailResponse {
  success: boolean;
  message: string;
  data: Doctor;
}

interface CreateAppointmentRequest {
  doctorId: string;
  userId: string;
  date: string;
  timeSlot: string;
}

interface CreateAppointmentResponse {
  success: boolean;
  message: string;
  data?: any;
}

interface Appointment {
  _id: string;
  userId: string;
  doctorId: {
    _id: string;
    email: string;
    fullName: string;
    photoUrl: string;
  };
  startTime: string;
  endTime: string;
  appointmentStatus: string;
  createdAt: string;
  updatedAt: string;
}

interface UserAppointmentsResponse {
  success: boolean;
  message: string;
  data: Appointment[];
}

interface ChatMessage {
  _id: string;
  text: string;
  createdAt: string;
  senderId: string;
  receiverId: string;
  appointmentId?: string;
  messageType: "text" | "image" | "file";
}

interface SendMessageRequest {
  text: string;
  receiverId: string;
  appointmentId?: string;
}

interface ChatMessagesResponse {
  success: boolean;
  message: string;
  data: ChatMessage[];
}

interface SendMessageResponse {
  success: boolean;
  message: string;
  data: ChatMessage;
}

interface VideoCallTokenRequest {
  appointmentId: string;
  userId: string;
}

interface VideoCallTokenResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    channelName: string;
    uid: number;
    appId: string;
  };
}

interface StartCallRequest {
  callType: "video" | "audio";
}

interface StartCallResponse {
  success: boolean;
  message: string;
  data: {
    callId: string;
    channelName: string;
    patientToken: string;
    patientUid: number;
    doctorInfo: {
      id: string;
      name: string;
      avatar: string;
    };
    appointmentId: string;
    agoraAppId: string;
    appointment: {
      id: string;
      startTime: string;
      endTime: string;
      status: string;
    };
    userRole: string;
    initiatedBy: string;
    message: string;
  };
}

interface JoinCallResponse {
  success: boolean;
  message: string;
  data: {
    callId: string;
    channelName: string;
    patientToken: string;
    patientUid: number;
    doctorInfo: {
      id: string;
      name: string;
      avatar: string;
    };
    appointmentId: string;
    agoraAppId: string;
    appointment: {
      id: string;
      startTime: string;
      endTime: string;
      status: string;
    };
    userRole: string;
  };
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

  getDoctors: async (): Promise<DoctorsResponse> => {
    try {
      const token = await authService.getToken();

      const response = await fetch(`${API_BASE_URL}/doctors`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch doctors data");
      }

      const result = await response.json();
      return {
        success: result.success,
        message: result.message,
        data: result.data,
      };
    } catch (error) {
      console.error("Error fetching doctors:", error);
      throw error;
    }
  },

  getDoctorById: async (doctorId: string): Promise<DoctorDetailResponse> => {
    try {
      const token = await authService.getToken();

      const response = await fetch(`${API_BASE_URL}/doctors/${doctorId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch doctor details");
      }

      const result = await response.json();
      return {
        success: result.success,
        message: result.message,
        data: result.data,
      };
    } catch (error) {
      console.error("Error fetching doctor details:", error);
      throw error;
    }
  },

  createAppointment: async (
    appointmentData: CreateAppointmentRequest
  ): Promise<CreateAppointmentResponse> => {
    try {
      const token = await authService.getToken();

      const response = await fetch(`${API_BASE_URL}/appointments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(appointmentData),
      });

      if (!response.ok) {
        throw new Error("Failed to create appointment");
      }

      const result = await response.json();
      return {
        success: result.success,
        message: result.message,
        data: result.data,
      };
    } catch (error) {
      console.error("Error creating appointment:", error);
      throw error;
    }
  },

  getUserAppointments: async (
    userId: string
  ): Promise<UserAppointmentsResponse> => {
    try {
      const token = await authService.getToken();

      const response = await fetch(
        `${API_BASE_URL}/appointments/user/${userId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch user appointments");
      }

      const result = await response.json();
      return {
        success: result.success,
        message: result.message,
        data: result.data,
      };
    } catch (error) {
      console.error("Error fetching user appointments:", error);
      throw error;
    }
  },

  getChatMessages: async (
    appointmentId: string
  ): Promise<ChatMessagesResponse> => {
    try {
      const token = await authService.getToken();

      const response = await fetch(
        `${API_BASE_URL}/chat/appointment/${appointmentId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch chat messages");
      }

      const result = await response.json();
      return {
        success: result.success,
        message: result.message,
        data: result.data,
      };
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      throw error;
    }
  },

  sendMessage: async (
    messageData: SendMessageRequest
  ): Promise<SendMessageResponse> => {
    try {
      const token = await authService.getToken();

      const response = await fetch(`${API_BASE_URL}/chat/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(messageData),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const result = await response.json();
      return {
        success: result.success,
        message: result.message,
        data: result.data,
      };
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  },

  getVideoCallToken: async (
    requestData: VideoCallTokenRequest
  ): Promise<VideoCallTokenResponse> => {
    try {
      const token = await authService.getToken();

      const response = await fetch(`${API_BASE_URL}/video-call/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error("Failed to get video call token");
      }

      const result = await response.json();
      return {
        success: result.success,
        message: result.message,
        data: result.data,
      };
    } catch (error) {
      console.error("Error getting video call token:", error);
      throw error;
    }
  },

  startCall: async (
    appointmentId: string,
    options: { callType: "video" | "audio"; forceCreate?: boolean }
  ) => {
    try {
      const token = await authService.getToken();
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

      console.log("Starting call with:", {
        appointmentId,
        callType: options.callType,
        forceCreate: options.forceCreate,
        url: `${API_BASE_URL}/appointments/${appointmentId}/start-call`,
      });

      const body = {
        callType: options.callType,
      };

      // Add forceCreate if specified
      if (options.forceCreate) {
        body.forceCreate = true;
      }

      const response = await fetch(
        `${API_BASE_URL}/appointments/${appointmentId}/start-call`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      console.log("API Response status:", response.status);
      const result = await response.json();
      console.log("Full API response:", result);
      console.log("Response data:", result);

      return result;
    } catch (error) {
      console.error("Error starting call:", error);
      throw error;
    }
  },

  joinCall: async (appointmentId: string): Promise<JoinCallResponse> => {
    try {
      const token = await authService.getToken();

      console.log("Joining call:", {
        appointmentId,
        url: `${API_BASE_URL}/appointments/${appointmentId}/join-call`,
      });

      const response = await fetch(
        `${API_BASE_URL}/appointments/${appointmentId}/join-call`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log("Join call response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Join call API Error:", errorData);

        // Check for specific errors
        if (
          errorData.message?.includes("Invalid doctor or doctor not available")
        ) {
          throw new Error("Bác sĩ hiện không có sẵn. Vui lòng thử lại sau.");
        }

        if (errorData.message?.includes("Call not found")) {
          throw new Error("Cuộc gọi không tồn tại hoặc đã kết thúc.");
        }

        throw new Error(errorData.message || "Failed to join call");
      }

      const result = await response.json();
      console.log("Join call full response:", JSON.stringify(result, null, 2));

      // Handle both wrapped and direct response formats
      const responseData = result.data || result;
      console.log(
        "Join call response data:",
        JSON.stringify(responseData, null, 2)
      );

      // More flexible validation - check for any of these field combinations
      const hasAgoraInfo =
        (responseData.agoraAppId || responseData.appId) &&
        responseData.channelName &&
        (responseData.patientToken || responseData.token);

      if (!hasAgoraInfo) {
        console.error("Missing Agora fields in join call:", {
          agoraAppId: responseData.agoraAppId,
          appId: responseData.appId,
          channelName: responseData.channelName,
          patientToken: responseData.patientToken,
          token: responseData.token,
        });
        throw new Error("Thiếu thông tin Agora từ server");
      }

      return {
        success: result.success !== undefined ? result.success : true,
        message: result.message || "Joined call successfully",
        data: {
          callId: responseData.callId?.toString() || responseData.callId,
          channelName: responseData.channelName,
          patientToken: responseData.patientToken || responseData.token,
          patientUid: responseData.patientUid || responseData.uid,
          doctorInfo: responseData.doctorInfo || {
            id: "unknown",
            name: "Doctor",
            avatar: "",
          },
          appointmentId: responseData.appointmentId || appointmentId,
          agoraAppId: responseData.agoraAppId || responseData.appId,
          appointment: responseData.appointment || {
            id: appointmentId,
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            status: "active",
          },
          userRole: responseData.userRole || "patient",
        },
      };
    } catch (error) {
      console.error("Error joining call:", error);
      throw error;
    }
  },

  checkActiveCall: async () => {
    try {
      const token = await authService.getToken();
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

      const response = await fetch(`${API_BASE_URL}/calls/active/user`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();
      console.log("🔍 Active call check result:", result);

      return result;
    } catch (error) {
      console.error("❌ Error checking active call:", error);
      return {
        success: false,
        message: error.message,
        data: { hasActiveCall: false },
      };
    }
  },

  async endCall(callId: string) {
    try {
      const token = await authService.getToken();
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

      console.log("🔚 Ending call:", callId);

      const response = await fetch(`${API_BASE_URL}/calls/${callId}/end`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();
      console.log("🔚 End call result:", result);

      return result;
    } catch (error) {
      console.error("❌ Error ending call:", error);
      throw error;
    }
  },

  async createCall(
    appointmentId: string,
    options: { callType: "video" | "audio" }
  ) {
    try {
      const token = await authService.getToken();
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

      console.log("🆕 Creating new call for appointment:", appointmentId);

      // Get user data to extract userId
      const userData = await authService.getUserData();
      if (!userData?.id) {
        throw new Error("User ID not found");
      }

      // First, get appointment details to extract doctorId
      console.log("📋 Fetching appointment details...");
      const appointmentResponse = await fetch(
        `${API_BASE_URL}/appointments/${appointmentId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!appointmentResponse.ok) {
        throw new Error("Failed to fetch appointment details");
      }

      const appointmentData = await appointmentResponse.json();
      console.log("📋 Appointment data:", appointmentData);

      const doctorId =
        appointmentData.data?.doctorId?._id || appointmentData.data?.doctorId;
      if (!doctorId) {
        throw new Error("Doctor ID not found in appointment");
      }

      // Try different endpoints with proper parameters
      const endpoints = [
        {
          path: `/call/initiate`,
          body: {
            appointmentId,
            patientId: userData.id,
            doctorId: doctorId,
            callType: options.callType,
          },
        },
        {
          path: `/appointments/${appointmentId}/start-call`,
          body: {
            callType: options.callType,
            patientId: userData.id,
            doctorId: doctorId,
          },
        },
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`🔄 Trying endpoint: ${endpoint.path}`);
          console.log(`📋 With body:`, endpoint.body);

          const response = await fetch(`${API_BASE_URL}${endpoint.path}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(endpoint.body),
          });

          const result = await response.json();
          console.log(`📋 Response from ${endpoint.path}:`, result);

          if (result.success) {
            console.log(
              "✅ Successfully created call with endpoint:",
              endpoint.path
            );
            return result;
          } else if (response.status === 201 || response.status === 200) {
            // Some APIs return 200/201 even with success: false, check if we have valid data
            if (
              result.data &&
              result.data.agoraAppId &&
              result.data.channelName
            ) {
              console.log("✅ Got valid call data despite success: false");
              return {
                ...result,
                success: true,
              };
            }
          }
        } catch (endpointError) {
          console.log(
            `❌ Endpoint ${endpoint.path} failed:`,
            endpointError.message
          );
          continue;
        }
      }

      throw new Error("All create call endpoints failed");
    } catch (error) {
      console.error("❌ Error creating call:", error);
      throw error;
    }
  },

  getAppointmentById: async (appointmentId: string) => {
    try {
      const token = await authService.getToken();

      const response = await fetch(
        `${API_BASE_URL}/appointments/${appointmentId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch appointment details");
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Error fetching appointment details:", error);
      throw error;
    }
  },
};
