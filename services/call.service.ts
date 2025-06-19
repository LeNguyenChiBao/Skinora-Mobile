import { io, Socket } from "socket.io-client";
import { authService } from "./authServices.service";

// Call-related interfaces
interface CallParticipant {
  id: string;
  name: string;
  avatar?: string;
  role: "patient" | "doctor";
}

interface CallDetails {
  _id: string;
  callId: string;
  roomId: string;
  token: string;
  uid: number;
  userRole: "patient" | "doctor";
  agoraAppId?: string;
  channelName?: string;
  patientUid?: number;
  patientToken?: string;
  doctorId?: string;
  appointmentId?: string;
  agoraConfig?: {
    appId: string;
    channelName: string;
    patientUid: number;
    patientToken: string;
  };
}

interface IncomingCallData {
  callId: string;
  doctorId: string;
  patientInfo: {
    name: string;
    avatar?: string;
  };
  callType: "voice" | "video";
  message: string;
}

interface CallEventHandlers {
  onIncomingCall?: (data: {
    callId: string;
    callerId: string;
    callerName?: string;
    callerAvatar?: string;
    callType: "voice" | "video";
    channelName: string;
    agoraToken: string;
    chatRoomId: string;
    doctorInfo?: {
      name: string;
      avatar?: string;
    };
    patientInfo?: {
      name: string;
      avatar?: string;
    };
  }) => void;
  onCallResponseReceived?: (data: {
    callId: string;
    response: "accept" | "decline";
    from: string;
  }) => void;
  onUserJoinedChannel?: (data: { userId: string; callId: string }) => void;
  onUserLeftChannel?: (data: { userId: string; reason?: string }) => void;
  onCallEnded?: (data: {
    callId: string;
    endedBy: string;
    duration?: number;
  }) => void;
  onCallStatusUpdate?: (data: {
    callId: string;
    status: string;
    duration?: number;
  }) => void;
  onCallServiceReady?: (data: { userId: string }) => void;
  onError?: (error: any) => void;
}

class CallService {
  private callSocket: Socket | null = null;
  private baseURL: string;
  private token: string | null = null;
  private eventHandlers: CallEventHandlers = {};
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    console.log("📞 CallService initialized with baseURL:", baseURL);
    this.initializeToken();
  }

  private async initializeToken() {
    try {
      this.token = await authService.getToken();
      console.log(
        "🔑 Call service auth token initialized:",
        this.token ? `${this.token.substring(0, 20)}...` : "null"
      );
    } catch (error) {
      console.error("❌ Failed to get auth token for call service:", error);
    }
  }

  private async getAuthHeaders() {
    if (!this.token) {
      await this.initializeToken();
    }
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };
  }

  /**
   * Set event handlers for call events
   */
  setEventHandlers(handlers: CallEventHandlers) {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }
  /**
   * Connect to the call WebSocket service
   */
  async connectCallService(): Promise<void> {
    try {
      if (this.isConnecting) {
        console.log("⏳ Connection already in progress...");
        return;
      }

      if (this.callSocket?.connected) {
        console.log("✅ Call service already connected");
        return;
      }

      this.isConnecting = true;

      if (!this.token) {
        await this.initializeToken();
      }

      if (!this.token) {
        throw new Error("No authentication token available");
      }

      console.log("📞 Connecting to call service...");

      // Disconnect existing socket if any
      if (this.callSocket) {
        this.callSocket.disconnect();
      }

      // Create call socket connection with better config
      this.callSocket = io(`${this.baseURL}/call`, {
        auth: { token: this.token },
        timeout: 15000,
        retries: 5,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        forceNew: true,
      });

      // Set up event listeners
      this.callSocket.on("connect", () => {
        console.log("🔗 Socket connected, waiting for ready...");
      });

      this.callSocket.on("connection_ready", (data) => {
        console.log("✅ Call service connected:", data);
        this.isConnecting = false;

        // Report user online
        this.callSocket?.emit("user_online", { userId: data.userId });
        this.eventHandlers.onCallServiceReady?.(data);

        // Start heartbeat
        this.startHeartbeat();
      });

      this.callSocket.on("disconnect", (reason) => {
        console.log("💔 Call service disconnected:", reason);
        this.isConnecting = false;
        this.stopHeartbeat();

        // Auto-reconnect if not intentional
        if (reason !== "io client disconnect") {
          console.log("🔄 Auto-reconnecting...");
          setTimeout(() => this.connectCallService(), 2000);
        }
      });
      this.callSocket.on("connect_error", (error) => {
        console.error("❌ Call service connection error:", error);
        this.isConnecting = false;
        this.eventHandlers.onError?.(error);
      });

      // Handle heartbeat response
      this.callSocket.on("pong", (data) => {
        console.log("💓 Received pong:", data);
      });
      this.callSocket.on("incoming_call", async (data: IncomingCallData) => {
        console.log("📞 Incoming call received:", data);

        // Validate that we have a valid callId
        if (!data.callId || typeof data.callId !== "string") {
          console.error("❌ Invalid callId in incoming call data:", data);
          this.eventHandlers.onError?.({
            message: "Invalid call data received",
            details: data,
          });
          return;
        }

        try {
          // Get full call details from API
          const headers = await this.getAuthHeaders();
          const response = await fetch(
            `${this.baseURL}/call/${data.callId}/details`,
            {
              method: "GET",
              headers,
            }
          );

          let callDetails: any = {};
          if (response.ok) {
            callDetails = await response.json();
            console.log("📋 Full call details:", callDetails);
          } else {
            console.warn("⚠️ Could not fetch call details, using basic info");
          }

          // Transform data to match expected interface with full details
          this.eventHandlers.onIncomingCall?.({
            callId: data.callId,
            callerId: data.doctorId,
            callerName: data.patientInfo?.name,
            callerAvatar: data.patientInfo?.avatar,
            callType: data.callType,
            channelName: callDetails.channelName || callDetails.roomId || "",
            agoraToken: callDetails.token || callDetails.patientToken || "",
            chatRoomId: callDetails.chatRoomId || "",
            doctorInfo: {
              name: data.patientInfo?.name || "Bác sĩ",
              avatar: data.patientInfo?.avatar,
            },
            patientInfo: data.patientInfo,
          });
        } catch (error) {
          console.error("❌ Error processing incoming call:", error);
          // Fallback to basic data only if we have valid callId
          this.eventHandlers.onIncomingCall?.({
            callId: data.callId,
            callerId: data.doctorId,
            callerName: data.patientInfo?.name,
            callerAvatar: data.patientInfo?.avatar,
            callType: data.callType,
            channelName: "",
            agoraToken: "",
            chatRoomId: "",
            doctorInfo: {
              name: data.patientInfo?.name || "Bác sĩ",
              avatar: data.patientInfo?.avatar,
            },
            patientInfo: data.patientInfo,
          });
        }
      });

      this.callSocket.on("call_accepted", (data) => {
        console.log("✅ Call accepted:", data);
        this.eventHandlers.onCallResponseReceived?.({
          callId: data.callId,
          response: "accept",
          from: data.from || "unknown",
        });
      });

      this.callSocket.on("call_declined", (data) => {
        console.log("❌ Call declined:", data);
        this.eventHandlers.onCallResponseReceived?.({
          callId: data.callId,
          response: "decline",
          from: data.from || "unknown",
        });
      });

      this.callSocket.on("call_ended", (data) => {
        console.log("📞 Call ended:", data);
        this.eventHandlers.onCallEnded?.(data);
      });

      this.callSocket.on("participant_joined", (data) => {
        console.log("👥 Participant joined:", data);
        this.eventHandlers.onUserJoinedChannel?.(data);
      });

      this.callSocket.on("participant_left", (data) => {
        console.log("👋 Participant left:", data);
        this.eventHandlers.onUserLeftChannel?.(data);
      });

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Call service connection timeout"));
        }, 10000);

        this.callSocket?.once("connection_ready", () => {
          clearTimeout(timeout);
          resolve();
        });

        this.callSocket?.once("connection_error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      console.log("✅ Call service connected successfully");
    } catch (error) {
      console.error("❌ Failed to connect to call service:", error);
      throw error;
    }
  }
  /**
   * Initiate a voice call
   */
  async initiateVoiceCall(doctorId: string): Promise<string> {
    try {
      console.log("📞 Initiating voice call to doctor:", doctorId);

      // Get current user data to get the actual patient ID
      const currentUser = await authService.getUserData();
      if (!currentUser?.id) {
        throw new Error("Unable to get current user ID");
      }

      const response = await fetch(`${this.baseURL}/call/initiate`, {
        method: "POST",
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({
          patientId: currentUser.id, // Use actual user ID
          doctorId,
          callType: "voice",
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "Failed to initiate voice call");
      }

      console.log("✅ Voice call initiated:", result.data);
      return result.data.callId;
    } catch (error) {
      console.error("❌ Failed to initiate voice call:", error);
      throw error;
    }
  }
  /**
   * Initiate a video call
   */
  async initiateVideoCall(doctorId: string): Promise<string> {
    try {
      console.log("📞 Initiating video call to doctor:", doctorId);

      // Get current user data to get the actual patient ID
      const currentUser = await authService.getUserData();
      if (!currentUser?.id) {
        throw new Error("Unable to get current user ID");
      }

      const response = await fetch(`${this.baseURL}/call/initiate`, {
        method: "POST",
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({
          patientId: currentUser.id, // Use actual user ID
          doctorId,
          callType: "video",
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "Failed to initiate video call");
      }

      console.log("✅ Video call initiated:", result.data);
      return result.data.callId;
    } catch (error) {
      console.error("❌ Failed to initiate video call:", error);
      throw error;
    }
  }

  /**
   * Accept an incoming call
   */
  async acceptCall(callId: string): Promise<CallDetails> {
    try {
      console.log("✅ Accepting call:", callId);

      const response = await fetch(`${this.baseURL}/call/${callId}/accept`, {
        method: "POST",
        headers: await this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "Failed to accept call");
      }

      console.log("✅ Call accepted:", result.data);
      return result.data;
    } catch (error) {
      console.error("❌ Failed to accept call:", error);
      throw error;
    }
  }

  /**
   * Decline an incoming call
   */
  async declineCall(callId: string): Promise<void> {
    try {
      console.log("❌ Declining call:", callId);

      const response = await fetch(`${this.baseURL}/call/${callId}/decline`, {
        method: "POST",
        headers: await this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "Failed to decline call");
      }

      console.log("✅ Call declined successfully");
    } catch (error) {
      console.error("❌ Failed to decline call:", error);
      throw error;
    }
  }
  /**
   * Join a call (get Agora details)
   */
  async joinCall(callId: string): Promise<CallDetails> {
    try {
      // Validate callId before making the request
      if (!callId || callId === "undefined" || typeof callId !== "string") {
        throw new Error(
          `Invalid callId provided: ${callId} (type: ${typeof callId})`
        );
      }

      console.log("🔗 Joining call:", callId);

      const response = await fetch(`${this.baseURL}/call/${callId}/join`, {
        method: "POST",
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({
          device: "mobile",
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "Failed to join call");
      }

      console.log("✅ Call joined:", result.data);
      return result.data;
    } catch (error) {
      console.error("❌ Failed to join call:", error);
      throw error;
    }
  }
  /**
   * End a call
   */
  async endCall(callId: string): Promise<void> {
    try {
      // Validate callId before making the request
      if (!callId || callId === "undefined" || typeof callId !== "string") {
        throw new Error(
          `Invalid callId provided: ${callId} (type: ${typeof callId})`
        );
      }

      console.log("📞 Ending call:", callId);

      const response = await fetch(`${this.baseURL}/call/${callId}/end`, {
        method: "POST",
        headers: await this.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "Failed to end call");
      }

      console.log("✅ Call ended successfully");
    } catch (error) {
      console.error("❌ Failed to end call:", error);
      throw error;
    }
  }
  /**
   * Get call details
   */
  async getCallDetails(callId: string): Promise<CallDetails> {
    try {
      // Validate callId before making the request
      if (!callId || callId === "undefined" || typeof callId !== "string") {
        throw new Error(
          `Invalid callId provided: ${callId} (type: ${typeof callId})`
        );
      }

      console.log("📋 Getting call details:", callId);

      const response = await fetch(
        `${this.baseURL}/call/debug/call-details/${callId}`,
        {
          method: "GET",
          headers: await this.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "Failed to get call details");
      }

      console.log("✅ Call details:", result.data);
      return result.data;
    } catch (error) {
      console.error("❌ Failed to get call details:", error);
      throw error;
    }
  }

  // Check for active calls for current user
  async checkActiveCall(): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      console.log("🔍 Checking for active calls...");

      const response = await fetch(`${this.baseURL}/call/active/user`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("📞 Active call check result:", result);
      return result;
    } catch (error) {
      console.error("❌ Error checking active calls:", error);
      throw error;
    }
  }
  // Debug WebSocket connection status
  debugConnectionStatus(): void {
    console.log("🔍 WebSocket Debug Info:");
    console.log("  - Socket connected:", !!this.callSocket?.connected);
    console.log("  - Socket ID:", this.callSocket?.id);
    console.log("  - Socket URL:", `${this.baseURL}/call`);
    console.log("  - Auth token available:", !!this.token);
    console.log("  - Event handlers set:", Object.keys(this.eventHandlers));
    console.log("  - Is connecting:", this.isConnecting);
    console.log("  - Heartbeat active:", !!this.heartbeatInterval);

    if (this.callSocket) {
      console.log(
        "  - Socket transport:",
        this.callSocket.io.engine.transport.name
      );
      console.log("  - Socket readyState:", this.callSocket.io._readyState);
      console.log("  - Socket connected state:", this.callSocket.connected);
      console.log(
        "  - Socket disconnected state:",
        this.callSocket.disconnected
      );
    }
  }
  // Force reconnect WebSocket
  async forceReconnect(): Promise<void> {
    console.log("🔄 Force reconnecting call service...");

    // Stop any ongoing processes
    this.stopHeartbeat();
    this.isConnecting = false;

    if (this.callSocket) {
      this.callSocket.disconnect();
      this.callSocket = null;
    }

    // Wait a bit before reconnecting
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await this.connectCallService();
  }
  /**
   * Disconnect call service
   */
  disconnectCallService(): void {
    console.log("📞 Disconnecting call service...");

    // Stop heartbeat
    this.stopHeartbeat();

    // Disconnect socket
    if (this.callSocket) {
      this.callSocket.disconnect();
      this.callSocket = null;
    }

    this.isConnecting = false;
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat() {
    this.stopHeartbeat(); // Clear any existing heartbeat

    this.heartbeatInterval = setInterval(() => {
      if (this.callSocket?.connected) {
        console.log("💓 Sending heartbeat...");
        this.callSocket.emit("ping", { timestamp: Date.now() });
      } else {
        console.log("💔 Connection lost, stopping heartbeat");
        this.stopHeartbeat();
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.callSocket?.connected || false;
  }
}

const callService = new CallService(
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://192.168.1.4:3000"
);

export default callService;
export type {
  CallDetails,
  CallEventHandlers,
  CallParticipant,
  IncomingCallData,
};
