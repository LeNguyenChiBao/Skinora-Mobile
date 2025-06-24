import callService, { type CallEventHandlers } from "@/services/call.service";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, AppStateStatus } from "react-native";

interface IncomingCall {
  callId: string;
  callerId: string;
  callerName?: string;
  callerAvatar?: string;
  callType: "voice" | "video";
  channelName?: string;
  agoraToken?: string;
}

export const useIncomingCalls = () => {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [connectionState, setConnectionState] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const [isInCall, setIsInCall] = useState(false); // Track if user is currently in a call
  const router = useRouter();
  const appState = useRef(AppState.currentState);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const handleIncomingCall = useCallback(
    (data: {
      callId: string;
      callerId: string;
      callerName?: string;
      callerAvatar?: string;
      callType: "voice" | "video";
      channelName: string;
      agoraToken: string;
      chatRoomId?: string;
      doctorInfo?: {
        name: string;
        avatar?: string;
      };
      patientInfo?: {
        name: string;
        avatar?: string;
      };
    }) => {
      console.log("📞 Incoming call received:", data);
      console.log("🔍 CallId from data:", data.callId, typeof data.callId);
      console.log(
        "🔍 CallerId from data:",
        data.callerId,
        typeof data.callerId
      );

      // Validate essential data
      if (
        !data.callId ||
        data.callId === "undefined" ||
        typeof data.callId !== "string"
      ) {
        console.error(
          "❌ Invalid or missing callId in incoming call data:",
          data
        );
        return;
      }

      if (
        !data.callerId ||
        data.callerId === "undefined" ||
        typeof data.callerId !== "string"
      ) {
        console.error(
          "❌ Invalid or missing callerId in incoming call data:",
          data
        );
        return;
      }

      const callerName =
        data.callerName ||
        data.doctorInfo?.name ||
        data.patientInfo?.name ||
        "Không rõ";

      const callerAvatar =
        data.callerAvatar ||
        data.doctorInfo?.avatar ||
        data.patientInfo?.avatar;

      const callData: IncomingCall = {
        callId: data.callId,
        callerId: data.callerId,
        callerName,
        callerAvatar,
        callType: data.callType,
        channelName: data.channelName,
        agoraToken: data.agoraToken,
      };

      setIncomingCall(callData);
      setShowOverlay(true);

      // Fallback Alert if app is in background
      if (AppState.currentState !== "active") {
        Alert.alert(
          "Cuộc gọi đến",
          `Có cuộc gọi ${
            data.callType === "voice" ? "thoại" : "video"
          } từ ${callerName}`,
          [
            {
              text: "Từ chối",
              style: "cancel",
              onPress: () => handleDeclineCall(data.callId),
            },
            {
              text: "Chấp nhận",
              onPress: () => handleAcceptCall(data.callId),
            },
          ]
        );
      }
    },
    []
  );  const handleAcceptCall = useCallback(
    async (callId: string) => {
      try {
        console.log("🔍 Accept call - Raw callId:", callId, typeof callId);

        if (!callId || callId === "undefined") {
          console.error("❌ Invalid callId:", callId);
          Alert.alert("Lỗi", "ID cuộc gọi không hợp lệ");
          return;
        }

        setIsConnecting(true);
        setShowOverlay(false);
        setIncomingCall(null);
        setIsInCall(true); // Mark as in call

        console.log("✅ Accepting call by joining:", callId);

        // Join the call - this will get Agora token and channel info
        const joinResult = await callService.joinCall(callId);
        console.log("📞 Join call result:", joinResult);

        // Navigate to video call screen with the result data
        if (joinResult) {
          router.push({
            pathname: "/(stacks)/video-call",
            params: {
              callId: callId,
              callData: JSON.stringify(joinResult),
            },
          });
        }
      } catch (error: any) {
        console.error("❌ Error accepting call:", error);
        setShowOverlay(false);
        setIsInCall(false); // Reset on error
        Alert.alert("Lỗi", "Không thể tham gia cuộc gọi. Vui lòng thử lại.");
      } finally {
        setIsConnecting(false);
      }
    },
    [router]
  );
  const handleDeclineCall = useCallback(async (callId: string) => {
    try {
      console.log("🔍 Decline call - Raw callId:", callId, typeof callId);

      if (!callId || callId === "undefined") {
        console.error("❌ Invalid callId for decline:", callId);
        setShowOverlay(false);
        setIncomingCall(null);
        return;
      }

      setShowOverlay(false);
      setIncomingCall(null);

      console.log("❌ Declining call by ending:", callId);

      // End the call directly
      await callService.endCall(callId);
      console.log("📞 Call declined successfully");
    } catch (error: any) {
      console.error("❌ Error declining call:", error);
    }
  }, []);  const handleCallEnded = useCallback(
    (data: { callId: string; endedBy: string; duration?: number }) => {
      console.log("📞 Call ended:", data);
      setIncomingCall(null);
      setShowOverlay(false);
      setIsConnecting(false);
      setIsInCall(false); // Reset call state

      // Only show alert if not already in a call
      if (incomingCall?.callId === data.callId) {
        Alert.alert(
          "Cuộc gọi kết thúc",
          `Cuộc gọi đã kết thúc${
            data.duration
              ? ` sau ${Math.floor(data.duration / 60)}:${(data.duration % 60)
                  .toString()
                  .padStart(2, "0")}`
              : ""
          }`,
          [{ text: "OK" }]
        );
      }
    },
    [incomingCall]
  );

  const handleCallDeclined = useCallback(
    (data: {
      callId: string;
      response: "accept" | "decline";
      from: string;
    }) => {
      if (data.response === "decline") {
        console.log("❌ Call was declined:", data);
        setIncomingCall(null);
        setIsConnecting(false);

        Alert.alert("Cuộc gọi bị từ chối", "Bác sĩ đã từ chối cuộc gọi");
      }
    },
    []
  );  // Debug function to check connection and active calls
  const debugIncomingCalls = useCallback(async () => {
    console.log("🔍 === INCOMING CALLS DEBUG ===");
    console.log("🔍 Current state - isInCall:", isInCall, "showOverlay:", showOverlay);

    // Don't show overlay if user is already in a call
    if (isInCall || showOverlay) {
      console.log("⏭️ Skipping debug - user is in call or overlay already shown");
      return;
    }

    // Check call service connection
    callService.debugConnectionStatus(); // Check for active calls
    try {
      const activeCall = await callService.checkActiveCall();
      console.log("📞 Active call found:", activeCall);

      if (activeCall && activeCall.data && activeCall.data.activeCall) {
        // If there's an active call, show notification
        console.log("⚠️ Found active call, showing notification");
        const callData = activeCall.data.activeCall;

        // Validate callId before proceeding
        const callId = callData._id || callData.callId;
        console.log("🔍 Active call ID validation:", callId, typeof callId);

        if (!callId || callId === "undefined" || typeof callId !== "string") {
          console.error("❌ Invalid callId in active call data:", callData);
          return;
        }

        setIncomingCall({
          callId: callId,
          callerId:
            callData.doctorId ||
            callData.callerId ||
            activeCall.data.otherParticipant?._id,
          callerName:
            callData.doctorInfo?.name ||
            callData.patientInfo?.name ||
            activeCall.data.otherParticipant?.fullName ||
            "Bác sĩ",
          callerAvatar:
            callData.doctorInfo?.avatar ||
            callData.patientInfo?.avatar ||
            activeCall.data.otherParticipant?.photoUrl,
          callType: callData.callType || "video",
          channelName: callData.channelName || callData.roomId,
          agoraToken: callData.token || callData.patientToken,
        });
        setShowOverlay(true);
      }
    } catch (error) {
      console.error("❌ Error checking active calls:", error);
    }

    console.log("🔍 === END DEBUG ===");
  }, [isInCall, showOverlay]);

  // Force reconnect function
  const forceReconnect = useCallback(async () => {
    console.log("🔄 Force reconnecting call service...");
    try {
      await callService.forceReconnect();
      console.log("✅ Call service reconnected");
    } catch (error) {
      console.error("❌ Force reconnect failed:", error);
    }
  }, []);
  // Function to clear call state when leaving video call screen
  const clearCallState = useCallback(() => {
    console.log("🧹 Clearing call state");
    setIsInCall(false);
    setIncomingCall(null);
    setShowOverlay(false);
    setIsConnecting(false);
  }, []);
  useEffect(() => {
    // Set up call event handlers
    const handlers: CallEventHandlers = {
      onIncomingCall: handleIncomingCall,
      onCallEnded: handleCallEnded,
      onCallResponseReceived: handleCallDeclined,
      onError: (error) => {
        console.error("❌ Call service error:", error);
        setIncomingCall(null);
        setIsConnecting(false);
        setConnectionState("disconnected");
      },
    };

    callService.setEventHandlers(handlers);

    // Connect to call service
    const connectWithRetry = async () => {
      setConnectionState("connecting");
      try {
        await callService.connectCallService();
        setConnectionState("connected");
        reconnectAttempts.current = 0;
        console.log("✅ Call service connected successfully");
      } catch (error) {
        console.error("❌ Failed to connect to call service:", error);
        setConnectionState("disconnected");

        // Retry connection with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttempts.current),
            30000
          );
          console.log(
            `🔄 Retrying connection in ${delay}ms (attempt ${reconnectAttempts.current})`
          );
          setTimeout(connectWithRetry, delay);
        }
      }
    };

    connectWithRetry();

    return () => {
      // Cleanup - disconnect call service when component unmounts
      callService.disconnectCallService();
      setConnectionState("disconnected");
    };
  }, [handleIncomingCall, handleCallEnded, handleCallDeclined]);
  // Debug on mount and periodically
  useEffect(() => {
    // Initial debug check
    const initialCheck = async () => {
      console.log("🔍 Initial incoming calls check...");
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for connection
      await debugIncomingCalls();
    };

    initialCheck();

    // Periodic check every 30 seconds
    const interval = setInterval(() => {
      console.log("🔍 Periodic connection check...");
      callService.debugConnectionStatus();

      // Reconnect if disconnected
      if (connectionState === "disconnected") {
        console.log("🔄 Connection lost, attempting to reconnect...");
        forceReconnect();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [debugIncomingCalls, connectionState, forceReconnect]);
  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log(
        `📱 App state changed: ${appState.current} -> ${nextAppState}`
      );

      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        // App came to foreground
        console.log("🔄 App came to foreground, checking connection...");

        // Force reconnect and check for missed calls
        setTimeout(async () => {
          try {
            await forceReconnect();
            await debugIncomingCalls();
          } catch (error) {
            console.error("❌ Error on app foreground:", error);
          }
        }, 1000);
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background
        console.log("📱 App went to background");
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => subscription?.remove();
  }, [forceReconnect, debugIncomingCalls]);
  return {
    incomingCall,
    isConnecting,
    showOverlay,
    connectionState,
    acceptCall: handleAcceptCall,
    declineCall: handleDeclineCall,
    debugIncomingCalls,
    forceReconnect,
    clearCallState,
  };
};
