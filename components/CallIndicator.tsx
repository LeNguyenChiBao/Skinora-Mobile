import { useCallIndicatorStore } from "@/hooks/useCallIndicator";
import { callNotificationManager } from "@/services/callNotification.service";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import React from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

export default function CallIndicator() {
  const router = useRouter();
  const {
    isCallActive,
    isIncomingCall,
    participantName,
    callDuration,
    appointmentId,
    callData,
    acceptIncomingCall,
    rejectIncomingCall,
    endCall,
  } = useCallIndicatorStore();

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const handleCallTap = () => {
    router.push({
      pathname: "/(stacks)/video-call",
      params: {
        appointmentId: appointmentId,
        doctorId: callData?.doctorId,
        doctorName: participantName,
        isReturning: "true",
      },
    });
  };

  const handleAcceptCall = async () => {
    console.log("📞 Accepting incoming call");

    try {
      // Accept call via notification manager
      const callInfo = await callNotificationManager.acceptCall(
        callData?.callId
      );

      // Update store
      acceptIncomingCall();

      // Navigate to video call with call info
      router.push({
        pathname: "/(stacks)/video-call",
        params: {
          appointmentId: appointmentId,
          doctorId: callData?.doctorId,
          doctorName: participantName,
          isJoining: "true",
          isReturning: "false",
        },
      });
    } catch (error) {
      console.error("❌ Error accepting call:", error);
      rejectIncomingCall();
    }
  };

  const handleRejectCall = async () => {
    console.log("📞 Rejecting incoming call");

    try {
      // Decline call via notification manager
      await callNotificationManager.declineCall(
        callData?.callId,
        "user_declined"
      );

      // Update store
      rejectIncomingCall();
    } catch (error) {
      console.error("❌ Error rejecting call:", error);
      rejectIncomingCall();
    }
  };

  if (!isCallActive) return null;

  return (
    <View style={styles.container}>
      <BlurView intensity={80} style={styles.blurContainer}>
        {isIncomingCall ? (
          // Incoming call UI
          <View style={styles.incomingCallContainer}>
            <View style={styles.callerInfo}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.callerDetails}>
                <Text style={styles.incomingText}>Cuộc gọi đến</Text>
                <Text style={styles.callerName}>{participantName}</Text>
              </View>
            </View>

            <View style={styles.incomingActions}>
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={handleRejectCall}
              >
                <Ionicons name="call" size={24} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.acceptButton}
                onPress={handleAcceptCall}
              >
                <Ionicons name="videocam" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Active call UI
          <TouchableOpacity
            style={styles.activeCallContainer}
            onPress={handleCallTap}
            activeOpacity={0.8}
          >
            <View style={styles.callInfo}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.callDetails}>
                <Text style={styles.participantName}>{participantName}</Text>
                <Text style={styles.callDuration}>
                  {formatDuration(callDuration)}
                </Text>
              </View>
            </View>

            <View style={styles.callActions}>
              <View style={styles.activeIndicator}>
                <View style={styles.pulseDot} />
              </View>
              <Text style={styles.tapToReturn}>Nhấn để quay lại</Text>
            </View>
          </TouchableOpacity>
        )}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
  },

  blurContainer: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(0, 168, 107, 0.9)",
  },

  // Active call styles
  activeCallContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  callInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  callDetails: {
    flex: 1,
  },

  participantName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 2,
  },

  callDuration: {
    fontSize: 14,
    color: "#FFFFFF",
    opacity: 0.8,
  },

  callActions: {
    alignItems: "center",
  },

  activeIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    marginBottom: 4,
  },

  pulseDot: {
    width: "100%",
    height: "100%",
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
  },

  tapToReturn: {
    fontSize: 10,
    color: "#FFFFFF",
    opacity: 0.7,
  },

  // Incoming call styles
  incomingCallContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  callerInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  callerDetails: {
    marginLeft: 12,
  },

  incomingText: {
    fontSize: 12,
    color: "#CCCCCC",
    marginBottom: 2,
  },

  callerName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },

  incomingActions: {
    flexDirection: "row",
    gap: 20,
  },

  rejectButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#dc3545",
    justifyContent: "center",
    alignItems: "center",
  },

  acceptButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#28a745",
    justifyContent: "center",
    alignItems: "center",
  },
});
