import { useCallIndicatorStore } from "@/hooks/useCallIndicator";
import { useCallService } from "@/hooks/useCallService";
import { useNotifications } from "@/hooks/useNotifications";
import callService from "@/services/call.service";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";

// Try to import Agora, handle if not available
let RtcEngine: any,
  RtcLocalView: any,
  RtcRemoteView: any,
  VideoRenderMode: any,
  ChannelProfile: any,
  ClientRole: any;
let AGORA_AVAILABLE = false;

try {
  const agora = require("react-native-agora");
  console.log("Agora module loaded, checking structure...");

  if (agora.createAgoraRtcEngine) {
    RtcEngine = { create: agora.createAgoraRtcEngine };
    AGORA_AVAILABLE = true;
  } else if (agora.RtcEngine) {
    RtcEngine = agora.RtcEngine;
    AGORA_AVAILABLE = true;
  }

  RtcLocalView = agora.RtcLocalView || agora.default?.RtcLocalView;
  RtcRemoteView = agora.RtcRemoteView || agora.default?.RtcRemoteView;
  VideoRenderMode = agora.VideoRenderMode || agora.default?.VideoRenderMode;
  ChannelProfile = agora.ChannelProfile || agora.default?.ChannelProfile;
  ClientRole = agora.ClientRole || agora.default?.ClientRole;

  if (RtcEngine && (RtcEngine.create || typeof RtcEngine === "function")) {
    AGORA_AVAILABLE = true;
    console.log("✅ Agora SDK loaded successfully");
  }
} catch (error) {
  console.error("❌ Agora SDK not available:", error);
  AGORA_AVAILABLE = false;
}

const { width, height } = Dimensions.get("window");

interface CallData {
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
  callerInfo?: {
    name: string;
    avatar?: string;
    role: string;
  };
}

export default function VideoCallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Animation values
  const pulseAnim = useState(new Animated.Value(1))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];
  const controlsOpacity = useState(new Animated.Value(1))[0];

  // Call states
  const [callData, setCallData] = useState<CallData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [engine, setEngine] = useState<any>(null);
  const [remoteUsers, setRemoteUsers] = useState<number[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus] = useState("Đang kết nối...");

  // Control states
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isVideoCall, setIsVideoCall] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  // UI states
  const [controlsVisible, setControlsVisible] = useState(true);
  const [lastTap, setLastTap] = useState(0);

  const callServiceHook = useCallService();
  const { showCallIndicator, hideCallIndicator } = useCallIndicatorStore();
  const { requestPermissions } = useNotifications();

  // Parse call data from params
  useEffect(() => {
    try {
      const callDataStr = params.callData as string;
      const callId = params.callId as string;

      console.log("📞 Video call screen params:", { callDataStr, callId });

      if (callDataStr) {
        const parsedData = JSON.parse(callDataStr);
        setCallData(parsedData);
        setIsVideoCall(parsedData.callType !== "voice");
        console.log("✅ Call data parsed:", parsedData);
      } else if (callId) {
        // Minimal call data if only callId is provided
        setCallData({
          _id: callId,
          callId: callId,
          roomId: "",
          token: "",
          uid: 0,
          userRole: "patient",
          channelName: "",
        });
      }
    } catch (error) {
      console.error("❌ Error parsing call data:", error);
      Alert.alert("Lỗi", "Dữ liệu cuộc gọi không hợp lệ");
      router.back();
    }
  }, [params]);

  // Initialize Agora engine
  useEffect(() => {
    if (!callData || !AGORA_AVAILABLE) {
      setIsLoading(false);
      return;
    }

    initializeAgora();
    return () => {
      cleanup();
    };
  }, [callData]);

  // Animation effects
  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Pulse animation for avatar
    const startPulse = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    if (!isJoined) {
      startPulse();
    }
  }, [isJoined]);

  // Auto-hide controls
  useEffect(() => {
    if (!showControls) return;

    const timer = setTimeout(() => {
      if (isVideoCall && remoteUsers.length > 0) {
        hideControls();
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [showControls, isVideoCall, remoteUsers]);

  // Call duration timer
  useEffect(() => {
    if (!isJoined) return;

    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isJoined]);

  const initializeAgora = async () => {
    try {
      console.log("🚀 Initializing Agora...");
      setIsLoading(true);

      // Request permissions
      if (Platform.OS === "android") {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
      }

      // Create engine
      const agoraEngine = RtcEngine.create
        ? await RtcEngine.create("6853d8b4dd4444e784b5f6c17b3993cc")
        : await RtcEngine("6853d8b4dd4444e784b5f6c17b3993cc");

      setEngine(agoraEngine);

      // Configure engine
      await agoraEngine.setChannelProfile(
        ChannelProfile?.LiveBroadcasting || 1
      );
      await agoraEngine.setClientRole(ClientRole?.Broadcaster || 1);

      if (isVideoCall) {
        await agoraEngine.enableVideo();
        await agoraEngine.enableLocalVideo(true);
        await agoraEngine.startPreview();
      } else {
        await agoraEngine.disableVideo();
        setIsCameraOn(false);
      }

      // Set up event handlers
      agoraEngine.addListener("UserJoined", (uid: number) => {
        console.log("👥 User joined:", uid);
        setRemoteUsers((prev) => [...prev, uid]);
        setIsJoined(true);
        setCallStatus("Đã kết nối");
        Vibration.vibrate(100);
      });

      agoraEngine.addListener("UserOffline", (uid: number) => {
        console.log("👋 User left:", uid);
        setRemoteUsers((prev) => prev.filter((id) => id !== uid));
        if (remoteUsers.length <= 1) {
          setCallStatus("Đã ngắt kết nối");
        }
      });

      agoraEngine.addListener(
        "JoinChannelSuccess",
        (channel: string, uid: number) => {
          console.log("✅ Joined channel:", channel, uid);
          setIsJoined(true);
          showCallIndicator("Đang trong cuộc gọi");
        }
      );

      // Join channel
      const channelName =
        callData?.channelName || callData?.roomId || `call_${Date.now()}`;
      const token = callData?.token || callData?.patientToken || null;
      const uid = callData?.uid || callData?.patientUid || 0;

      console.log("🔗 Joining channel:", { channelName, token, uid });

      await agoraEngine.joinChannel(token, channelName, null, uid);
      setIsLoading(false);
    } catch (error) {
      console.error("❌ Agora initialization failed:", error);
      setIsLoading(false);
      Alert.alert("Lỗi", "Không thể khởi tạo cuộc gọi. Vui lòng thử lại.");
    }
  };

  const cleanup = async () => {
    try {
      hideCallIndicator();

      if (engine) {
        await engine.destroy();
        setEngine(null);
      }

      setRemoteUsers([]);
      setIsJoined(false);
    } catch (error) {
      console.error("❌ Cleanup error:", error);
    }
  };

  const handleEndCall = async () => {
    try {
      console.log("📞 Ending call...");

      if (callData?.callId) {
        await callService.endCall(callData.callId);
      }

      await cleanup();
      router.back();
    } catch (error) {
      console.error("❌ Error ending call:", error);
      await cleanup();
      router.back();
    }
  };

  const toggleMute = () => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    engine?.muteLocalAudioStream(newMuteState);

    // Haptic feedback
    Vibration.vibrate(50);
  };

  const toggleCamera = async () => {
    if (!isVideoCall) return;

    const newCameraState = !isCameraOn;
    setIsCameraOn(newCameraState);

    try {
      if (newCameraState) {
        await engine?.enableLocalVideo(true);
        await engine?.startPreview();
      } else {
        await engine?.enableLocalVideo(false);
        await engine?.stopPreview();
      }

      Vibration.vibrate(50);
    } catch (error) {
      console.error("❌ Camera toggle failed:", error);
    }
  };

  const hideControls = () => {
    Animated.timing(controlsOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setControlsVisible(false));
  };

  const showControlsFunc = () => {
    setControlsVisible(true);
    Animated.timing(controlsOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleScreenTap = () => {
    const now = Date.now();
    if (now - lastTap < 300) {
      // Double tap
      if (!controlsVisible) {
        showControlsFunc();
      } else {
        hideControls();
      }
    }
    setLastTap(now);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const getCallerInfo = () => {
    return (
      callData?.callerInfo || {
        name: "Bác sĩ",
        avatar: "https://via.placeholder.com/150",
        role: "Bác sĩ",
      }
    );
  };

  // Loading screen
  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
        <LinearGradient
          colors={["#667eea", "#764ba2"]}
          style={styles.gradientBackground}
        >
          <SafeAreaView style={styles.loadingContainer}>
            <Animated.View
              style={[styles.loadingContent, { opacity: fadeAnim }]}
            >
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <View style={styles.loadingIconContainer}>
                  <Ionicons name="videocam" size={60} color="#fff" />
                </View>
              </Animated.View>
              <Text style={styles.loadingTitle}>Đang kết nối</Text>
              <Text style={styles.loadingSubtitle}>
                Vui lòng đợi trong giây lát...
              </Text>
            </Animated.View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  const callerInfo = getCallerInfo();

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <Stack.Screen options={{ headerShown: false }} />

      <TouchableOpacity
        style={styles.touchableArea}
        activeOpacity={1}
        onPress={handleScreenTap}
      >
        {/* Background */}
        {isVideoCall && remoteUsers.length > 0 ? (
          // Video background
          <View style={styles.videoBackground}>
            {AGORA_AVAILABLE && RtcRemoteView ? (
              <RtcRemoteView.SurfaceView
                style={styles.remoteVideo}
                uid={remoteUsers[0]}
                channelId={callData?.channelName || ""}
                renderMode={VideoRenderMode?.Hidden || 1}
                zOrderMediaOverlay={false}
              />
            ) : (
              <LinearGradient
                colors={["#667eea", "#764ba2"]}
                style={styles.gradientBackground}
              />
            )}
          </View>
        ) : (
          // Audio call or no remote user background
          <LinearGradient
            colors={["#667eea", "#764ba2"]}
            style={styles.gradientBackground}
          />
        )}

        {/* Content overlay */}
        <SafeAreaView style={styles.contentContainer}>
          {/* Top section */}
          <Animated.View style={[styles.topSection, { opacity: fadeAnim }]}>
            <Text style={styles.callStatus}>{callStatus}</Text>
            <Text style={styles.callDuration}>
              {formatDuration(callDuration)}
            </Text>
          </Animated.View>

          {/* Center section */}
          <View style={styles.centerSection}>
            {(!isVideoCall || remoteUsers.length === 0) && (
              <Animated.View
                style={[
                  styles.avatarContainer,
                  {
                    opacity: fadeAnim,
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              >
                <View style={styles.avatarWrapper}>
                  <Image
                    source={{ uri: callerInfo.avatar }}
                    style={styles.avatar}
                    defaultSource={require("@/assets/images/icon.png")}
                  />
                </View>
                <Text style={styles.callerName}>{callerInfo.name}</Text>
                <Text style={styles.callerRole}>{callerInfo.role}</Text>
              </Animated.View>
            )}
          </View>

          {/* Local video (Picture in Picture) */}
          {isVideoCall && isCameraOn && (
            <View style={styles.localVideoContainer}>
              <View style={styles.localVideoWrapper}>
                {AGORA_AVAILABLE && RtcLocalView ? (
                  <RtcLocalView.SurfaceView
                    style={styles.localVideo}
                    channelId={callData?.channelName || ""}
                    renderMode={VideoRenderMode?.Hidden || 1}
                    zOrderOnTop={true}
                  />
                ) : (
                  <View style={styles.localVideoPlaceholder}>
                    <Ionicons name="person" size={30} color="#fff" />
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Controls */}
          {controlsVisible && (
            <Animated.View
              style={[styles.controlsContainer, { opacity: controlsOpacity }]}
            >
              <BlurView intensity={20} style={styles.controlsBackground}>
                <View style={styles.controlsRow}>
                  {/* Mute button */}
                  <TouchableOpacity
                    style={[
                      styles.controlButton,
                      isMuted && styles.controlButtonActive,
                    ]}
                    onPress={toggleMute}
                  >
                    <Ionicons
                      name={isMuted ? "mic-off" : "mic"}
                      size={24}
                      color="#fff"
                    />
                  </TouchableOpacity>

                  {/* Camera button (only for video calls) */}
                  {isVideoCall && (
                    <TouchableOpacity
                      style={[
                        styles.controlButton,
                        !isCameraOn && styles.controlButtonActive,
                      ]}
                      onPress={toggleCamera}
                    >
                      <Ionicons
                        name={isCameraOn ? "videocam" : "videocam-off"}
                        size={24}
                        color="#fff"
                      />
                    </TouchableOpacity>
                  )}

                  {/* End call button */}
                  <TouchableOpacity
                    style={styles.endCallButton}
                    onPress={handleEndCall}
                  >
                    <Ionicons name="call" size={28} color="#fff" />
                  </TouchableOpacity>

                  {/* Speaker button */}
                  <TouchableOpacity style={styles.controlButton}>
                    <Ionicons name="volume-high" size={24} color="#fff" />
                  </TouchableOpacity>

                  {/* More options */}
                  <TouchableOpacity style={styles.controlButton}>
                    <Ionicons
                      name="ellipsis-horizontal"
                      size={24}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </View>
              </BlurView>
            </Animated.View>
          )}
        </SafeAreaView>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  gradientBackground: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  videoBackground: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  remoteVideo: {
    flex: 1,
  },
  touchableArea: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    position: "relative",
  },

  // Loading styles
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContent: {
    alignItems: "center",
    padding: 40,
  },
  loadingIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
  },

  // Top section
  topSection: {
    paddingTop: 20,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  callStatus: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: "500",
  },
  callDuration: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "600",
    marginTop: 4,
  },

  // Center section
  centerSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarContainer: {
    alignItems: "center",
  },
  avatarWrapper: {
    width: 160,
    height: 160,
    borderRadius: 80,
    padding: 4,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    marginBottom: 24,
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 76,
  },
  callerName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
  },
  callerRole: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
  },

  // Local video (PiP)
  localVideoContainer: {
    position: "absolute",
    top: 100,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  localVideoWrapper: {
    flex: 1,
    backgroundColor: "#333",
    borderRadius: 16,
    overflow: "hidden",
  },
  localVideo: {
    flex: 1,
  },
  localVideoPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },

  // Controls
  controlsContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
  },
  controlsBackground: {
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  controlButtonActive: {
    backgroundColor: "rgba(255, 59, 48, 0.8)",
    borderColor: "#FF3B30",
  },
  endCallButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#FF3B30",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
});
