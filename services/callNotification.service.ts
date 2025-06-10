import { authService } from "@/services/authServices.service";
import { Alert } from "react-native";

interface IncomingCallData {
  callId: string;
  appointmentId: string;
  caller: {
    id: string;
    name: string;
    avatar?: string;
  };
  callDetails: {
    type: "video" | "audio";
    timeout?: number;
  };
}

export class CallNotificationManager {
  private pollingInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;
  private activeCall: string | null = null;

  // Initialize notification system with basic polling only
  async initialize(userId: string, jwtToken: string) {
    if (this.isInitialized) return;

    console.log(
      "🔔 Initializing basic call notification system for user:",
      userId
    );

    try {
      // Use simple polling to avoid module conflicts
      this.startNotificationPolling(userId, jwtToken);
      this.isInitialized = true;
      console.log("✅ Basic call notification system initialized");
    } catch (error) {
      console.error("❌ Error initializing notification system:", error);
    }
  }

  startNotificationPolling(userId: string, jwtToken: string) {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    console.log("📡 Starting basic notification polling");

    this.pollingInterval = setInterval(async () => {
      try {
        const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
        const response = await fetch(
          `${API_BASE_URL}/calls/notifications/poll/${userId}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${jwtToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.ok) {
          const result = await response.json();

          if (result.success && result.data?.hasIncomingCall) {
            this.handleIncomingCall(result.data.incomingCall);
          }
        }
      } catch (error) {
        // Silent polling
      }
    }, 3000);
  }

  async handleIncomingCall(callData: IncomingCallData) {
    console.log("📞 Incoming call received:", callData);

    if (this.activeCall === callData.callId) {
      console.log("⚠️ Call already active, ignoring duplicate");
      return;
    }

    this.activeCall = callData.callId;

    // Show basic alert
    Alert.alert("Cuộc gọi đến", `${callData.caller.name} đang gọi cho bạn`, [
      {
        text: "Từ chối",
        style: "cancel",
        onPress: () => this.declineCall(callData.callId, "user_declined"),
      },
      {
        text: "Trả lời",
        onPress: () => this.acceptCall(callData.callId),
      },
    ]);

    // Auto-decline after timeout
    setTimeout(() => {
      if (this.activeCall === callData.callId) {
        this.declineCall(callData.callId, "timeout");
      }
    }, 30000);
  }

  async acceptCall(callId: string) {
    try {
      const token = await authService.getToken();
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

      const response = await fetch(`${API_BASE_URL}/calls/${callId}/accept`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (result.success) {
        console.log("✅ Call accepted:", result.data);
        this.activeCall = null;
        return result.data;
      } else {
        throw new Error(result.message || "Failed to accept call");
      }
    } catch (error) {
      console.error("❌ Error accepting call:", error);
      throw error;
    }
  }

  async declineCall(callId: string, reason: string = "user_declined") {
    try {
      const token = await authService.getToken();
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

      await fetch(`${API_BASE_URL}/calls/${callId}/decline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      });

      console.log("❌ Call declined:", reason);
      this.activeCall = null;
    } catch (error) {
      console.error("❌ Error declining call:", error);
    }
  }

  destroy() {
    console.log("🧹 Destroying basic call notification manager");
    this.isInitialized = false;

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    this.activeCall = null;
  }
}

// Export singleton instance
export const callNotificationManager = new CallNotificationManager();
