import { Alert } from "react-native";
import { io, Socket } from "socket.io-client";
import { authService } from "./authServices.service";

interface CallData {
  appointmentId?: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callType: "video" | "audio";
  timestamp: string;
}

interface NotificationCallbacks {
  onIncomingCall?: (data: CallData) => void;
  onCallStarted?: (data: CallData) => void;
  onCallEnded?: (data: any) => void;
  onMessageReceived?: (data: any) => void;
}

class NotificationService {
  private socket: Socket | null = null;
  private callbacks: NotificationCallbacks = {};

  async initialize() {
    try {
      const token = await authService.getToken();
      const userData = await authService.getUserData();

      if (!token || !userData?.id) {
        throw new Error("Authentication required");
      }

      this.socket = io(process.env.EXPO_PUBLIC_API_BASE_URL!, {
        auth: {
          token,
          userId: userData.id,
        },
        transports: ["websocket"],
      });

      this.setupEventListeners();

      this.socket.on("connect", () => {
        console.log("Notification service connected");
      });

      this.socket.on("disconnect", () => {
        console.log("Notification service disconnected");
      });
    } catch (error) {
      console.error("Failed to initialize notification service:", error);
    }
  }

  private setupEventListeners() {
    if (!this.socket) return;

    // Handle incoming calls
    this.socket.on("incoming_call", (data: CallData) => {
      console.log("Incoming call:", data);

      if (this.callbacks.onIncomingCall) {
        this.callbacks.onIncomingCall(data);
      } else {
        this.showDefaultIncomingCallAlert(data);
      }
    });

    // Handle call started by other participant
    this.socket.on("call_started_by_other", (data: CallData) => {
      console.log("Call started by other:", data);

      if (this.callbacks.onCallStarted) {
        this.callbacks.onCallStarted(data);
      } else {
        this.showDefaultCallStartedAlert(data);
      }
    });

    // Handle call ended
    this.socket.on("call_ended", (data: any) => {
      console.log("Call ended:", data);

      if (this.callbacks.onCallEnded) {
        this.callbacks.onCallEnded(data);
      }
    });

    // Handle new messages
    this.socket.on("new_message", (data: any) => {
      console.log("New message received:", data);

      if (this.callbacks.onMessageReceived) {
        this.callbacks.onMessageReceived(data);
      }
    });
  }

  private showDefaultIncomingCallAlert(data: CallData) {
    const title = data.appointmentId ? "Cuộc hẹn đang bắt đầu" : "Cuộc gọi đến";
    const message = data.appointmentId
      ? `${data.callerName} đang bắt đầu cuộc hẹn. Tham gia ngay?`
      : `${data.callerName} đang gọi ${
          data.callType === "video" ? "video" : "thoại"
        }`;

    Alert.alert(title, message, [
      { text: "Từ chối", style: "cancel" },
      {
        text: "Tham gia",
        onPress: () => this.joinCall(data.appointmentId || data.callerId),
      },
    ]);
  }

  private showDefaultCallStartedAlert(data: CallData) {
    Alert.alert(
      "Cuộc gọi đã bắt đầu",
      `${data.callerName} đã bắt đầu cuộc gọi video. Tham gia ngay?`,
      [
        { text: "Để sau", style: "cancel" },
        {
          text: "Tham gia",
          onPress: () => this.joinCall(data.appointmentId || data.callerId),
        },
      ]
    );
  }

  private joinCall(appointmentId: string) {
    // This should be handled by the app's navigation
    console.log("Joining call for appointment:", appointmentId);
  }

  setCallbacks(callbacks: NotificationCallbacks) {
    this.callbacks = callbacks;
  }

  // Emit events to server
  startCall(appointmentId: string, callType: "video" | "audio" = "video") {
    if (this.socket) {
      this.socket.emit("start_call", { appointmentId, callType });
    }
  }

  endCall(appointmentId: string) {
    if (this.socket) {
      this.socket.emit("end_call", { appointmentId });
    }
  }

  joinCall(appointmentId: string) {
    if (this.socket) {
      this.socket.emit("join_call", { appointmentId });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const notificationService = new NotificationService();
