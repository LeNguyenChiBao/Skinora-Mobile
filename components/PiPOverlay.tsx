import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface PiPOverlayProps {
  isVisible: boolean;
  participantName: string;
  callDuration: number;
  onEndCall: () => void;
  onMaximize: () => void;
  children?: React.ReactNode; // For video views
}

const { width, height } = Dimensions.get("window");

export const PiPOverlay: React.FC<PiPOverlayProps> = ({
  isVisible,
  participantName,
  callDuration,
  onEndCall,
  onMaximize,
  children,
}) => {
  const router = useRouter();

  if (!isVisible) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <View style={styles.pipContainer}>
      <TouchableOpacity
        style={styles.pipVideoContainer}
        onPress={onMaximize}
        activeOpacity={0.8}
      >
        {/* Video content will be rendered here */}
        {children}

        {/* Overlay info */}
        <View style={styles.pipOverlay}>
          <Text style={styles.pipParticipantName} numberOfLines={1}>
            {participantName}
          </Text>
          <Text style={styles.pipDuration}>{formatDuration(callDuration)}</Text>
        </View>

        {/* Control buttons */}
        <View style={styles.pipControls}>
          <TouchableOpacity style={styles.pipControlButton} onPress={onEndCall}>
            <Ionicons name="call" size={16} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pipControlButton, styles.expandButton]}
            onPress={onMaximize}
          >
            <Ionicons name="expand" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  pipContainer: {
    position: "absolute",
    top: 100,
    right: 20,
    width: 120,
    height: 160,
    zIndex: 1000,
    elevation: 10,
  },
  pipVideoContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
    borderWidth: 2,
    borderColor: "#00A86B",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  pipOverlay: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
  },
  pipParticipantName: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  pipDuration: {
    color: "#fff",
    fontSize: 9,
    marginTop: 2,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  pipControls: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pipControlButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 68, 68, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  expandButton: {
    backgroundColor: "rgba(0, 168, 107, 0.9)",
  },
});

export default PiPOverlay;
