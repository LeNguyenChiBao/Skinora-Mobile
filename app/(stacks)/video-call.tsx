import { useCallIndicatorStore } from "@/hooks/useCallIndicator";
import { useNotifications } from "@/hooks/useNotifications";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useLayoutEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Try to import Agora, handle if not available
let RtcEngine,
  RtcLocalView,
  RtcRemoteView,
  VideoRenderMode,
  ChannelProfile,
  ClientRole;
let AGORA_AVAILABLE = false;

try {
  // For react-native-agora 4.x+, the import structure has changed
  console.log("Attempting to import react-native-agora 4.x+");

  // Method 1: Try the 4.x import pattern
  try {
    const agora = require("react-native-agora");
    console.log("Agora module loaded, checking structure...");
    console.log("Available exports:", Object.keys(agora));

    // In 4.x+, exports might be structured differently
    if (agora.createAgoraRtcEngine) {
      // Version 4.x uses createAgoraRtcEngine
      RtcEngine = { create: agora.createAgoraRtcEngine };
      console.log("Found createAgoraRtcEngine (4.x pattern)");
    } else if (agora.default && agora.default.createAgoraRtcEngine) {
      RtcEngine = { create: agora.default.createAgoraRtcEngine };
      console.log("Found createAgoraRtcEngine in default export");
    } else if (agora.RtcEngine) {
      RtcEngine = agora.RtcEngine;
      console.log("Found RtcEngine (3.x pattern)");
    }

    // Try to find video components
    RtcLocalView = agora.RtcLocalView || agora.default?.RtcLocalView;
    RtcRemoteView = agora.RtcRemoteView || agora.default?.RtcRemoteView;
    VideoRenderMode = agora.VideoRenderMode || agora.default?.VideoRenderMode;
    ChannelProfile = agora.ChannelProfile || agora.default?.ChannelProfile;
    ClientRole = agora.ClientRole || agora.default?.ClientRole;

    console.log("Component availability:", {
      RtcEngine: !!RtcEngine,
      RtcLocalView: !!RtcLocalView,
      RtcRemoteView: !!RtcRemoteView,
      VideoRenderMode: !!VideoRenderMode,
      ChannelProfile: !!ChannelProfile,
      ClientRole: !!ClientRole,
    });

    if (RtcEngine && (RtcEngine.create || typeof RtcEngine === "function")) {
      AGORA_AVAILABLE = true;
      console.log("Agora SDK imported successfully (4.x pattern)");
    } else {
      console.error("RtcEngine found but create method not available");
      AGORA_AVAILABLE = false;
    }
  } catch (importError) {
    console.error("Failed to import react-native-agora:", importError.message);
    AGORA_AVAILABLE = false;
  }

  // Method 2: Try manual inspection if first method failed
  if (!AGORA_AVAILABLE) {
    try {
      const agora = require("react-native-agora");
      console.log("Manual inspection of agora module:");
      console.log("Type:", typeof agora);
      console.log("Constructor:", agora.constructor?.name);
      console.log("Keys:", Object.keys(agora));

      if (agora.default) {
        console.log("Default export keys:", Object.keys(agora.default));
      }

      // Log all function-type exports
      Object.keys(agora).forEach((key) => {
        if (typeof agora[key] === "function") {
          console.log(`Function found: ${key}`);
        }
      });
    } catch (e) {
      console.log("Manual inspection failed:", e.message);
    }
  }
} catch (error) {
  console.error("Overall Agora import failed:", error);
  AGORA_AVAILABLE = false;
}

const { width, height } = Dimensions.get("window");

export default function VideoCallScreen() {
  const router = useRouter();
  const {
    appointmentId,
    doctorId,
    doctorName,
    callerId,
    callerName,
    token,
    channelName,
    uid,
    appId,
    isReturning, // Check if this is a return to existing session
  } = useLocalSearchParams();
  const { endCall } = useNotifications();
  const {
    startCall: startCallIndicator,
    endCall: endCallIndicator,
    updateDuration,
    callDuration: globalCallDuration, // Get current duration from store
  } = useCallIndicatorStore();

  const [engine, setEngine] = useState<any>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [callDuration, setCallDuration] = useState(
    isReturning ? globalCallDuration : 0
  ); // Initialize with global duration if returning
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [callStatus, setCallStatus] = useState("Đang kết nối...");

  // Use real Agora config from backend
  const agoraAppId = appId as string;
  const agoraToken = token as string;
  const agoraChannelName = channelName as string;
  const agoraUid = uid ? parseInt(uid as string) : 0;

  // Separate useLayoutEffect for call indicator initialization (runs before render)
  useLayoutEffect(() => {
    // Only start new call indicator if not returning to existing session
    if (!isReturning && appointmentId && (doctorName || callerName)) {
      // Start the call indicator
      console.log("Starting call indicator in useLayoutEffect");
      startCallIndicator({
        participantName: doctorName || callerName || "Bác sĩ",
        appointmentId: appointmentId as string,
        callData: {
          token,
          channelName,
          uid,
          appId,
          doctorId,
        },
      });
    } else if (isReturning) {
      console.log("Returning to existing call session");
    }
  }, []); // Run only once on mount

  // Main initialization useEffect
  useEffect(() => {
    console.log("Video call params received:", {
      appointmentId,
      doctorName,
      token: token ? `***${(token as string).slice(-4)}` : "none",
      channelName,
      uid,
      appId,
      isReturning: !!isReturning,
      globalCallDuration,
    });

    // If returning to session, sync with global duration
    if (isReturning) {
      console.log("Skipping initialization - returning to existing session");
      setCallDuration(globalCallDuration); // Sync with global duration
      // Set demo mode state if needed
      if (!AGORA_AVAILABLE) {
        setIsJoined(true);
        setRemoteUid(12345);
        setCallStatus("Demo: Đã kết nối với bác sĩ");
      }
      return;
    }

    console.log("AGORA_AVAILABLE:", AGORA_AVAILABLE);
    console.log("RtcEngine:", typeof RtcEngine);
    console.log("RtcEngine.create:", typeof RtcEngine?.create);

    // Always start with demo mode if Agora not available
    if (!AGORA_AVAILABLE) {
      console.log("Starting demo mode automatically - Agora not available");
      startDemoMode();
      return;
    }

    // More flexible validation
    const hasRequiredParams = appId && channelName && token;

    if (!hasRequiredParams) {
      console.error("Missing required video call parameters:", {
        appId: !!appId,
        token: !!token,
        channelName: !!channelName,
        uid: !!uid,
      });
      Alert.alert(
        "Lỗi",
        "Thiếu thông tin cuộc gọi. Bạn có muốn thử demo mode?",
        [
          {
            text: "Demo mode",
            onPress: () => startDemoMode(),
          },
          {
            text: "Quay lại",
            onPress: () => router.back(),
          },
        ]
      );
      return;
    }

    initAgora();
  }, []); // Remove dependencies to prevent re-runs

  // Separate useEffect for timer - only start if not returning
  useEffect(() => {
    // Don't start new timer if returning to existing session
    if (isReturning) {
      console.log("Not starting timer - returning to existing session");
      return;
    }

    console.log("Starting call timer");
    // Start call timer
    const timer = setInterval(() => {
      setCallDuration((prev) => {
        const newDuration = prev + 1;
        updateDuration(newDuration); // Update global indicator
        return newDuration;
      });
    }, 1000);

    return () => {
      console.log("Clearing call timer");
      clearInterval(timer);
    };
  }, [isReturning]); // Depend on isReturning

  // Sync local duration with global when returning
  useEffect(() => {
    if (isReturning && globalCallDuration > 0) {
      console.log("Syncing duration on return:", globalCallDuration);
      setCallDuration(globalCallDuration);
    }
  }, [isReturning, globalCallDuration]);

  // Separate useEffect for cleanup
  useEffect(() => {
    return () => {
      console.log("Cleaning up video call");
      // DON'T end call indicator here - only end when explicitly ending call
      // endCallIndicator(); // Removed this line

      // Cleanup engine safely but don't end the session
      if (engine && AGORA_AVAILABLE) {
        try {
          // Don't leave channel on navigation - keep session alive
          // if (typeof engine.leaveChannel === "function") {
          //   engine.leaveChannel().catch(console.error);
          // }

          // Don't destroy engine on navigation - keep it running
          // if (typeof engine.destroy === "function") {
          //   engine.destroy().catch(console.error);
          // } else if (typeof engine.release === "function") {
          //   engine.release().catch(console.error);
          // }

          console.log("Video call screen unmounted but session preserved");
        } catch (error) {
          console.error("Error during cleanup:", error);
        }
      }

      // Don't end notification service session
      // if (appointmentId) {
      //   endCall(appointmentId as string);
      // }
    };
  }, []); // Remove dependencies to prevent re-runs

  const startDemoMode = () => {
    console.log("Starting demo mode");
    setCallStatus("Demo mode - Đang mô phỏng cuộc gọi");

    // Simulate joining
    setTimeout(() => {
      setIsJoined(true);
      setCallStatus("Demo: Đã tham gia cuộc gọi");

      // Simulate remote user after 3 seconds
      setTimeout(() => {
        setRemoteUid(12345);
        setCallStatus("Demo: Đã kết nối với bác sĩ");
      }, 3000);
    }, 2000);
  };

  const initAgora = async () => {
    if (!AGORA_AVAILABLE) {
      console.error("Agora SDK not available");
      startDemoMode();
      return;
    }

    if (!RtcEngine || (!RtcEngine.create && typeof RtcEngine !== "function")) {
      console.error("RtcEngine.create is not available");
      Alert.alert(
        "Lỗi Agora SDK",
        "RtcEngine không khả dụng. Có thể phiên bản react-native-agora không tương thích.",
        [
          {
            text: "Demo mode",
            onPress: () => startDemoMode(),
          },
          {
            text: "Thoát",
            onPress: () => router.back(),
          },
        ]
      );
      return;
    }

    try {
      // Request permissions
      if (Platform.OS === "android") {
        await requestPermissions();
      }

      console.log("Initializing Agora with validated params:", {
        appId: agoraAppId,
        channelName: agoraChannelName,
        hasToken: !!agoraToken,
        uid: agoraUid,
      });

      // Validate required parameters
      if (!agoraAppId) {
        throw new Error("Missing Agora App ID");
      }
      if (!agoraChannelName) {
        throw new Error("Missing channel name");
      }
      if (!agoraToken) {
        throw new Error("Missing Agora token");
      }

      console.log("Creating RTC engine...");
      console.log("RtcEngine type:", typeof RtcEngine);
      console.log("RtcEngine.create type:", typeof RtcEngine.create);

      // Create RTC engine - handle different API versions
      let _engine;
      if (RtcEngine.create) {
        _engine = await RtcEngine.create(agoraAppId);
      } else if (typeof RtcEngine === "function") {
        _engine = await RtcEngine(agoraAppId);
      } else {
        throw new Error("Unable to create RTC engine - unknown API pattern");
      }

      console.log("RTC engine created successfully:", _engine);
      setEngine(_engine);

      // For demo purposes, simulate success if engine creation seems to fail
      if (!_engine) {
        console.warn(
          "Engine creation returned null/undefined, falling back to demo"
        );
        startDemoMode();
        return;
      }

      // Enable video
      try {
        await _engine.enableVideo();
        console.log("Video enabled");
      } catch (e) {
        console.warn("Video enable failed:", e.message);
      }

      // Set channel profile
      try {
        if (ChannelProfile && _engine.setChannelProfile) {
          await _engine.setChannelProfile(ChannelProfile.Communication || 1);
          console.log("Channel profile set");
        }
      } catch (e) {
        console.warn("Channel profile set failed:", e.message);
      }

      // Set client role
      try {
        if (ClientRole && _engine.setClientRole) {
          await _engine.setClientRole(ClientRole.Broadcaster || 1);
          console.log("Client role set");
        }
      } catch (e) {
        console.warn("Client role set failed:", e.message);
      }

      // Add event listeners with error handling
      try {
        _engine.addListener?.("UserJoined", (uid) => {
          console.log("UserJoined", uid);
          setRemoteUid(uid);
          setCallStatus("Đã kết nối với bác sĩ");
        });

        _engine.addListener?.("UserOffline", (uid, reason) => {
          console.log("UserOffline", uid, reason);
          setRemoteUid(null);
          setCallStatus("Bác sĩ đã rời khỏi cuộc gọi");
        });

        _engine.addListener?.("JoinChannelSuccess", (channel, uid, elapsed) => {
          console.log("JoinChannelSuccess", channel, uid, elapsed);
          setIsJoined(true);
          setCallStatus("Đã tham gia cuộc gọi");
        });

        _engine.addListener?.("Error", (errorCode) => {
          console.log("Agora Error:", errorCode);
          setCallStatus("Lỗi kết nối");
          Alert.alert("Lỗi Agora", `Mã lỗi: ${errorCode}`);
        });

        console.log("Event listeners added");
      } catch (e) {
        console.warn("Event listener setup failed:", e.message);
      }

      // Join channel
      console.log("Joining channel with parameters:", {
        token: agoraToken ? "provided" : "null",
        channel: agoraChannelName,
        uid: agoraUid,
      });

      try {
        await _engine.joinChannel(agoraToken, agoraChannelName, null, agoraUid);
        console.log("Join channel request sent");
      } catch (e) {
        console.error("Join channel failed:", e.message);
        // Fall back to demo mode if join fails
        startDemoMode();
      }
    } catch (error) {
      console.error("Error initializing Agora:", error);
      Alert.alert(
        "Lỗi kết nối",
        `Không thể khởi tạo cuộc gọi video: ${error.message}. Bạn có muốn thử demo mode?`,
        [
          {
            text: "Demo mode",
            onPress: () => startDemoMode(),
          },
          {
            text: "Thử lại",
            onPress: () => initAgora(),
          },
          {
            text: "Thoát",
            onPress: () => router.back(),
          },
        ]
      );
    }
  };

  const requestPermissions = async () => {
    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.CAMERA,
      ]);

      const audioGranted =
        granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
        PermissionsAndroid.RESULTS.GRANTED;
      const cameraGranted =
        granted[PermissionsAndroid.PERMISSIONS.CAMERA] ===
        PermissionsAndroid.RESULTS.GRANTED;

      if (!audioGranted || !cameraGranted) {
        Alert.alert(
          "Quyền truy cập",
          "Cần cấp quyền truy cập camera và microphone để sử dụng video call.",
          [
            {
              text: "Thử lại",
              onPress: () => requestPermissions(),
            },
            {
              text: "Tiếp tục",
              onPress: () => {
                if (!cameraGranted) setIsCameraOn(false);
                if (!audioGranted) setIsMuted(true);
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error("Permission error:", error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const toggleMute = async () => {
    if (engine && AGORA_AVAILABLE) {
      try {
        await engine.muteLocalAudioStream(!isMuted);
        setIsMuted(!isMuted);
      } catch (error) {
        console.error("Error toggling mute:", error);
      }
    } else {
      // Demo mode
      setIsMuted(!isMuted);
      console.log("Demo: Mute toggled to", !isMuted);
    }
  };

  const toggleCamera = async () => {
    if (engine && AGORA_AVAILABLE) {
      try {
        await engine.muteLocalVideoStream(!isCameraOn);
        setIsCameraOn(!isCameraOn);
      } catch (error) {
        console.error("Error toggling camera:", error);
      }
    } else {
      // Demo mode
      setIsCameraOn(!isCameraOn);
      console.log("Demo: Camera toggled to", !isCameraOn);
    }
  };

  const switchCamera = async () => {
    if (engine && AGORA_AVAILABLE) {
      try {
        await engine.switchCamera();
        Alert.alert("Camera", "Đã chuyển camera");
      } catch (error) {
        console.error("Error switching camera:", error);
        Alert.alert("Lỗi", "Không thể chuyển camera");
      }
    } else {
      // Demo mode
      Alert.alert("Demo", "Camera đã được chuyển (demo mode)");
    }
  };

  const handleEndCall = () => {
    Alert.alert(
      "Kết thúc cuộc gọi",
      "Bạn có chắc chắn muốn kết thúc cuộc gọi?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Kết thúc",
          style: "destructive",
          onPress: async () => {
            try {
              console.log("Explicitly ending call session");

              if (engine && AGORA_AVAILABLE) {
                // Try to leave channel first
                if (typeof engine.leaveChannel === "function") {
                  await engine.leaveChannel();
                  console.log("Left Agora channel");
                } else {
                  console.warn("engine.leaveChannel is not available");
                }

                // Try to destroy engine
                if (typeof engine.destroy === "function") {
                  await engine.destroy();
                  console.log("Destroyed Agora engine");
                } else if (typeof engine.release === "function") {
                  // Some versions use release instead of destroy
                  await engine.release();
                  console.log("Released Agora engine");
                } else {
                  console.warn("No destroy/release method available on engine");
                }
              }

              if (appointmentId) {
                endCall(appointmentId as string);
              }

              endCallIndicator(); // Only end call indicator when explicitly ending
              router.back();
            } catch (error) {
              console.error("Error ending call:", error);
              endCallIndicator(); // End call indicator even on error
              router.back();
            }
          },
        },
      ]
    );
  };

  const handleMinimize = () => {
    console.log("Minimizing call - session preserved");
    // Just navigate back without ending the session
    router.back();
  };

  const openChatDuringCall = () => {
    router.push({
      pathname: "/(stacks)/doctor-chat",
      params: {
        doctorId: doctorId || callerId,
        doctorName: doctorName || callerName,
        appointmentId: appointmentId,
        isInCall: "true",
      },
    });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        {/* Call Header */}
        <View style={styles.callHeader}>
          <TouchableOpacity
            style={styles.minimizeButton}
            onPress={handleMinimize}
          >
            <Ionicons name="chevron-down" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.callInfo}>
            <Text style={styles.participantName}>
              {doctorName || callerName || "Bác sĩ"}
            </Text>
            <Text style={styles.callStatus}>{callStatus}</Text>
            <Text style={styles.callDuration}>
              {formatDuration(callDuration)}
            </Text>
          </View>

          <TouchableOpacity style={styles.infoButton}>
            <Ionicons
              name="information-circle-outline"
              size={24}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        {/* Video Area */}
        <View style={styles.videoContainer}>
          {/* Remote Video */}
          {remoteUid && engine && AGORA_AVAILABLE ? (
            <RtcRemoteView.SurfaceView
              style={styles.remoteVideo}
              uid={remoteUid}
              channelId={agoraChannelName}
              renderMode={VideoRenderMode.Hidden}
            />
          ) : remoteUid ? (
            // Demo remote video
            <View style={styles.remoteVideo}>
              <View style={styles.demoVideoContainer}>
                <Ionicons name="videocam" size={100} color="#00A86B" />
                <Text style={styles.demoVideoText}>
                  {doctorName || "Bác sĩ"} (Demo)
                </Text>
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>DEMO</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.remoteVideo}>
              <View style={styles.waitingContainer}>
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={80} color="#666" />
                </View>
                <Text style={styles.waitingText}>
                  {!AGORA_AVAILABLE
                    ? "Demo mode - Agora SDK không khả dụng"
                    : isJoined
                    ? "Đang chờ bác sĩ tham gia..."
                    : callStatus}
                </Text>
                {!isJoined && AGORA_AVAILABLE && (
                  <View style={styles.connectionInfo}>
                    <Text style={styles.connectionText}>
                      Channel: {agoraChannelName}
                    </Text>
                    <Text style={styles.connectionText}>UID: {agoraUid}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Local Video */}
          {engine && isJoined && AGORA_AVAILABLE ? (
            <View style={styles.localVideoContainer}>
              {isCameraOn ? (
                <RtcLocalView.SurfaceView
                  style={styles.localVideo}
                  channelId={agoraChannelName}
                  renderMode={VideoRenderMode.Hidden}
                />
              ) : (
                <View style={styles.localVideoOff}>
                  <Ionicons name="videocam-off" size={32} color="#FFFFFF" />
                </View>
              )}
              <Text style={styles.localVideoLabel}>Bạn</Text>
            </View>
          ) : isJoined ? (
            // Demo local video
            <View style={styles.localVideoContainer}>
              {isCameraOn ? (
                <View style={styles.localVideo}>
                  <View style={styles.demoLocalVideo}>
                    <Ionicons name="person" size={40} color="#4285F4" />
                    <Text style={styles.demoText}>Demo</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.localVideoOff}>
                  <Ionicons name="videocam-off" size={32} color="#FFFFFF" />
                </View>
              )}
              <Text style={styles.localVideoLabel}>Bạn</Text>
            </View>
          ) : null}
        </View>

        {/* Call Controls */}
        <View style={styles.controlsContainer}>
          <View style={styles.mainControls}>
            <TouchableOpacity
              style={[styles.controlButton, isMuted && styles.mutedButton]}
              onPress={toggleMute}
            >
              <Ionicons
                name={isMuted ? "mic-off" : "mic"}
                size={28}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.endCallButton}
              onPress={handleEndCall}
            >
              <Ionicons name="call" size={32} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, !isCameraOn && styles.mutedButton]}
              onPress={toggleCamera}
            >
              <Ionicons
                name={isCameraOn ? "videocam" : "videocam-off"}
                size={28}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.secondaryControls}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={switchCamera}
            >
              <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
              <Text style={styles.secondaryButtonText}>Chuyển</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={openChatDuringCall}
            >
              <Ionicons name="chatbubble" size={24} color="#FFFFFF" />
              <Text style={styles.secondaryButtonText}>Tin nhắn</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton}>
              <Ionicons name="people" size={24} color="#FFFFFF" />
              <Text style={styles.secondaryButtonText}>Thêm</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton}>
              <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
              <Text style={styles.secondaryButtonText}>Khác</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  callHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  minimizeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  callInfo: {
    alignItems: "center",
    flex: 1,
  },
  participantName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  callStatus: {
    fontSize: 14,
    color: "#CCCCCC",
    marginBottom: 2,
  },
  callDuration: {
    fontSize: 14,
    color: "#00A86B",
    fontWeight: "600",
  },
  infoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  videoContainer: {
    flex: 1,
    position: "relative",
  },
  remoteVideo: {
    flex: 1,
    backgroundColor: "#2a2a2a",
  },
  waitingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#404040",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  waitingText: {
    fontSize: 18,
    color: "#CCCCCC",
    textAlign: "center",
    marginBottom: 20,
  },
  connectionInfo: {
    marginTop: 20,
    alignItems: "center",
  },
  connectionText: {
    color: "#CCCCCC",
    fontSize: 10,
    fontFamily: "monospace",
  },
  localVideoContainer: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 15,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#00A86B",
  },
  localVideo: {
    flex: 1,
  },
  localVideoOff: {
    flex: 1,
    backgroundColor: "#333333",
    justifyContent: "center",
    alignItems: "center",
  },
  localVideoLabel: {
    position: "absolute",
    bottom: 6,
    left: 8,
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "600",
    textShadowColor: "#000000",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  controlsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  mainControls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 40,
    marginBottom: 20,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  mutedButton: {
    backgroundColor: "#dc3545",
  },
  endCallButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#dc3545",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#dc3545",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  secondaryControls: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  secondaryButton: {
    alignItems: "center",
    padding: 10,
  },
  secondaryButtonText: {
    color: "#CCCCCC",
    fontSize: 12,
    marginTop: 4,
  },
  demoVideoContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
  },
  demoVideoText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginTop: 20,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
    backgroundColor: "rgba(0, 168, 107, 0.9)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    marginRight: 6,
  },
  liveText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  demoLocalVideo: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#3a3a3a",
  },
  demoText: {
    color: "#FFFFFF",
    fontSize: 10,
    marginTop: 4,
  },
});
