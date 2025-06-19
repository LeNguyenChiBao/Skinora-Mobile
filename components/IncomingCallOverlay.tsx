import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React from "react";
import {
  Animated,
  Dimensions,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

interface IncomingCallOverlayProps {
  visible: boolean;
  callerName: string;
  callerAvatar?: string;
  callType: "voice" | "video";
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallOverlay: React.FC<IncomingCallOverlayProps> = ({
  visible,
  callerName,
  callerAvatar,
  callType,
  onAccept,
  onDecline,
}) => {
  const [slideAnim] = React.useState(new Animated.Value(-height));

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -height,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      <StatusBar backgroundColor="rgba(0,0,0,0.5)" barStyle="light-content" />
      <View style={styles.overlay}>
        <BlurView intensity={20} style={styles.blurContainer}>
          <Animated.View
            style={[
              styles.container,
              {
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerText}>
                Cuộc gọi {callType === "voice" ? "thoại" : "video"} đến
              </Text>
            </View>

            {/* Caller Info */}
            <View style={styles.callerInfo}>
              <View style={styles.avatarContainer}>
                {callerAvatar ? (
                  <Image source={{ uri: callerAvatar }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.defaultAvatar]}>
                    <Ionicons name="person" size={40} color="#fff" />
                  </View>
                )}
                {/* Pulse animation for incoming call */}
                <View style={styles.pulseContainer}>
                  <Animated.View style={[styles.pulse, styles.pulse1]} />
                  <Animated.View style={[styles.pulse, styles.pulse2]} />
                  <Animated.View style={[styles.pulse, styles.pulse3]} />
                </View>
              </View>

              <Text style={styles.callerName}>{callerName}</Text>
              <Text style={styles.callStatus}>
                {callType === "voice"
                  ? "📞 Cuộc gọi thoại"
                  : "📹 Cuộc gọi video"}
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              {/* Decline Button */}
              <TouchableOpacity
                style={[styles.actionButton, styles.declineButton]}
                onPress={onDecline}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={28} color="#fff" />
              </TouchableOpacity>

              {/* Accept Button */}
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={onAccept}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={callType === "voice" ? "call" : "videocam"}
                  size={28}
                  color="#fff"
                />
              </TouchableOpacity>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.quickAction}>
                <Ionicons name="chatbubble" size={20} color="#fff" />
                <Text style={styles.quickActionText}>Tin nhắn</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickAction}>
                <Ionicons name="notifications-off" size={20} color="#fff" />
                <Text style={styles.quickActionText}>Nhắc lại</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </BlurView>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  blurContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  container: {
    flex: 1,
    backgroundColor: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    paddingTop: StatusBar.currentHeight || 44,
  },
  header: {
    alignItems: "center",
    paddingVertical: 20,
  },
  headerText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    opacity: 0.9,
  },
  callerInfo: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 24,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "#fff",
  },
  defaultAvatar: {
    backgroundColor: "#8e44ad",
    justifyContent: "center",
    alignItems: "center",
  },
  pulseContainer: {
    position: "absolute",
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
  },
  pulse: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  pulse1: {
    // Animation will be added via Animated.loop
  },
  pulse2: {
    // Animation will be added via Animated.loop with delay
  },
  pulse3: {
    // Animation will be added via Animated.loop with delay
  },
  callerName: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  callStatus: {
    color: "#fff",
    fontSize: 16,
    opacity: 0.8,
    textAlign: "center",
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 60,
    paddingVertical: 40,
  },
  actionButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  declineButton: {
    backgroundColor: "#e74c3c",
    transform: [{ rotate: "135deg" }],
  },
  acceptButton: {
    backgroundColor: "#27ae60",
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 60,
    paddingBottom: 40,
  },
  quickAction: {
    alignItems: "center",
    opacity: 0.8,
  },
  quickActionText: {
    color: "#fff",
    fontSize: 12,
    marginTop: 4,
  },
});
