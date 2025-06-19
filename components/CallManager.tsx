import { useIncomingCalls } from "@/hooks/useIncomingCalls";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import {
  Alert,
  AppState,
  AppStateStatus,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCallService } from "../hooks/useCallService";
import { IncomingCallOverlay } from "./IncomingCallOverlay";

export const CallManager: React.FC = () => {
  const callService = useCallService();
  const router = useRouter();
  // Keep existing incoming calls functionality with overlay support
  const {
    incomingCall,
    isConnecting,
    showOverlay,
    connectionState,
    acceptCall,
    declineCall,
  } = useIncomingCalls();

  useEffect(() => {
    // Check for active call when app starts
    checkActiveCallOnStartup();

    // Listen for app state changes
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        // App came to foreground, check for active calls
        checkAndResumeActiveCall();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      subscription?.remove();
    };
  }, []);

  const checkActiveCallOnStartup = async () => {
    try {
      const savedCallData = await callService.restoreCallState();

      if (savedCallData) {
        console.log("📱 Found saved call on startup:", savedCallData);

        // Check if call is still active on server
        const isStillActive = await callService.checkCallStatus(
          savedCallData.callId
        );

        if (isStillActive) {
          // Show dialog to rejoin call
          Alert.alert(
            "Cuộc gọi đang diễn ra",
            "Bạn có cuộc gọi đang diễn ra. Bạn muốn tiếp tục?",
            [
              {
                text: "Kết thúc cuộc gọi",
                style: "destructive",
                onPress: async () => {
                  await callService.clearCallState();
                },
              },
              {
                text: "Tiếp tục cuộc gọi",
                onPress: () => {
                  // Navigate to video call screen with rejoin mode
                  router.push({
                    pathname: "/(stacks)/video-call",
                    params: {
                      callId: savedCallData.callId,
                      isReturning: "true",
                      isRejoin: "true",
                      doctorName:
                        savedCallData.otherParticipant?.fullName || "Bác sĩ",
                    },
                  });
                },
              },
            ]
          );
        } else {
          // Call no longer active, clear state
          await callService.clearCallState();
          console.log("📱 Cleared inactive call state");
        }
      }
    } catch (error) {
      console.error("Failed to check active call on startup:", error);
    }
  };

  const checkAndResumeActiveCall = async () => {
    try {
      const savedCallData = await callService.restoreCallState();

      if (savedCallData && !callService.isInCall) {
        console.log("📱 App returned to foreground, checking call status...");

        const isStillActive = await callService.checkCallStatus(
          savedCallData.callId
        );

        if (isStillActive) {
          // Auto-rejoin without dialog if user was in call before
          console.log("📱 Auto-rejoining call...");
          await callService.rejoinCall(savedCallData);
        } else {
          await callService.clearCallState();
        }
      }
    } catch (error) {
      console.error("Failed to resume active call:", error);
    }
  }; // The hook handles all the logic and UI
  // This component renders the beautiful incoming call overlay
  return (
    <>
      {/* Connection Status Indicator */}
      {connectionState !== "connected" && (
        <View style={styles.connectionStatus}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  connectionState === "connecting" ? "#ff9500" : "#ff3b30",
              },
            ]}
          />
          <Text style={styles.statusText}>
            {connectionState === "connecting"
              ? "Đang kết nối..."
              : "Mất kết nối"}
          </Text>
        </View>
      )}

      {incomingCall && (
        <IncomingCallOverlay
          visible={showOverlay}
          callerName={incomingCall.callerName || "Không rõ"}
          callerAvatar={incomingCall.callerAvatar}
          callType={incomingCall.callType}
          onAccept={() => acceptCall(incomingCall.callId)}
          onDecline={() => declineCall(incomingCall.callId)}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  connectionStatus: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 9999,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
});
