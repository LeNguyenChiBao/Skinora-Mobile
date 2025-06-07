import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

interface CallIndicatorProps {
  isVisible: boolean;
  callDuration: number;
  participantName: string;
  appointmentId: string;
  callData?: any;
}

export const CallIndicator: React.FC<CallIndicatorProps> = ({
  isVisible,
  callDuration,
  participantName,
  appointmentId,
  callData,
}) => {
  const router = useRouter();
  const [slideAnim] = useState(new Animated.Value(-100));
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (isVisible) {
      // Slide down animation
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();

      // Pulse animation for the call indicator
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      return () => pulseAnimation.stop();
    } else {
      // Slide up animation
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const returnToCall = () => {
    console.log(
      "Returning to call with preserved session, duration:",
      callDuration
    );
    router.push({
      pathname: "/(stacks)/video-call",
      params: {
        appointmentId,
        doctorName: participantName,
        // Pass back the preserved call data
        ...callData,
        // Add flag to indicate this is a session restoration
        isReturning: "true",
      },
    });
  };

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity style={styles.callBar} onPress={returnToCall}>
        <View style={styles.leftSection}>
          <Animated.View
            style={[
              styles.callIndicator,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <Ionicons name="call" size={16} color="#FFFFFF" />
          </Animated.View>

          <View style={styles.callInfo}>
            <Text style={styles.callText} numberOfLines={1}>
              Cuộc gọi với {participantName}
            </Text>
            <Text style={styles.durationText}>
              {formatDuration(callDuration)} • Nhấn để quay lại
            </Text>
          </View>
        </View>

        <View style={styles.rightSection}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="videocam" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="mic" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.returnButton}>
            <Ionicons name="chevron-up" size={16} color="#FFFFFF" />
          </View>
        </View>
      </TouchableOpacity>

      {/* Subtle shadow/border at bottom */}
      <View style={styles.shadowLine} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 10,
  },
  callBar: {
    backgroundColor: "#00A86B",
    paddingTop: 40, // Account for status bar
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  callIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  callInfo: {
    flex: 1,
  },
  callText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  durationText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
    marginTop: 2,
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  returnButton: {
    marginLeft: 8,
    padding: 4,
  },
  shadowLine: {
    height: 1,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },
});
