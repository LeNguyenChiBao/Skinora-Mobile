import { useCallIndicatorStore } from "@/hooks/useCallIndicator";
import { useNotifications } from "@/hooks/useNotifications";
import chatService from "@/services/chat.service";
import { userService } from "@/services/user.service";
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
    // Remove these old params - will get from API
    // token,
    // channelName,
    // uid,
    // appId,
    isReturning,
    callType,
    isJoining,
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
  const [callData, setCallData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [remoteUsers, setRemoteUsers] = useState<number[]>([]); // Track all remote users
  const [localUid, setLocalUid] = useState<number | null>(null); // Track our own UID

  // Use real Agora config from backend
  // const agoraAppId = appId as string;
  // const agoraToken = token as string;
  // const agoraChannelName = channelName as string;
  // const agoraUid = uid ? parseInt(uid as string) : 0;

  // Separate useLayoutEffect for call indicator initialization (runs before render)
  useLayoutEffect(() => {
    // Only start new call indicator if not returning to existing session
    if (!isReturning && appointmentId && (doctorName || callerName)) {
      // Use setTimeout to avoid setState during render
      setTimeout(() => {
        console.log("Starting call indicator in useLayoutEffect");
        startCallIndicator({
          participantName: doctorName || callerName || "Bác sĩ",
          appointmentId: appointmentId as string,
          callData: {
            appointmentId: appointmentId,
            doctorId: doctorId,
            doctorName: doctorName,
            callType: callType,
          },
        });
      }, 0);
    } else if (isReturning) {
      console.log("Returning to existing call session");
    }
  }, []); // Run only once on mount

  // Main initialization useEffect
  useEffect(() => {
    console.log("Video call params received:", {
      appointmentId,
      doctorName,
      callType,
      isJoining,
      isReturning: !!isReturning,
      globalCallDuration,
    });

    // If returning to session, sync with global duration
    if (isReturning) {
      console.log("Skipping initialization - returning to existing session");
      setCallDuration(globalCallDuration);
      setIsLoading(false);
      // Set demo mode state if needed - wrap in setTimeout
      if (!AGORA_AVAILABLE) {
        setTimeout(() => {
          setIsJoined(true);
          setRemoteUid(12345);
          setCallStatus("Demo: Đã kết nối với bác sĩ");
        }, 0);
      }
      return;
    }

    console.log("AGORA_AVAILABLE:", AGORA_AVAILABLE);

    // Always start with demo mode if Agora not available
    if (!AGORA_AVAILABLE) {
      console.log("Starting demo mode automatically - Agora not available");
      setIsLoading(false);
      // Wrap in setTimeout to avoid setState during render
      setTimeout(() => {
        startDemoMode();
      }, 0);
      return;
    }

    // Initialize call with backend API
    initializeCallFromBackend();
  }, []); // Remove dependencies to prevent re-runs

  const initializeCallFromBackend = async () => {
    try {
      setIsLoading(true);
      console.log("🚀 Initializing call for appointment:", appointmentId);

      if (!appointmentId) {
        throw new Error("Missing appointment ID");
      }

      // Step 1: Check for active call first
      console.log("🔍 Checking for active call...");
      const activeCallResponse = await userService.checkActiveCall();

      if (activeCallResponse.success && activeCallResponse.data.hasActiveCall) {
        const activeCall = activeCallResponse.data.activeCall;
        console.log("📞 Found active call:", activeCall);

        // Fix: Compare appointmentId correctly - handle both string and object formats
        const activeCallAppointmentId =
          typeof activeCall.appointmentId === "string"
            ? activeCall.appointmentId
            : activeCall.appointmentId?._id;

        console.log("🔍 APPOINTMENT ID COMPARISON:");
        console.log("   Current appointment:", appointmentId);
        console.log("   Active call appointment:", activeCallAppointmentId);
        console.log("   Match:", activeCallAppointmentId === appointmentId);

        // Check if active call matches current appointment
        if (activeCallAppointmentId === appointmentId) {
          console.log(
            "✅ Active call matches current appointment - joining existing call"
          );

          // Join existing call instead of starting new one
          const response = await userService.joinCall(appointmentId as string);

          if (response.success) {
            const callInfo = response.data;
            setCallData(callInfo);

            console.log("📋 Joined existing call data:", {
              callId: callInfo.callId,
              channel: callInfo.channelName,
              uid: callInfo.patientUid || callInfo.uid,
              tokenLength:
                callInfo.patientToken?.length || callInfo.token?.length,
            });

            await initAgoraWithApiData(callInfo);
          } else {
            throw new Error(response.message || "Failed to join existing call");
          }
          return;
        } else {
          console.log(
            "⚠️ Active call for different appointment, ending it first"
          );
          console.log("   Active call appointment:", activeCallAppointmentId);
          console.log("   Current appointment:", appointmentId);

          // Show user a choice: join existing call or end it
          const shouldJoinExisting = await new Promise<boolean>((resolve) => {
            Alert.alert(
              "Cuộc gọi đang diễn ra",
              `Bạn đang có cuộc gọi khác. Bạn muốn:\n• Tham gia cuộc gọi hiện tại\n• Kết thúc và bắt đầu cuộc gọi mới`,
              [
                {
                  text: "Tham gia cuộc gọi hiện tại",
                  onPress: () => resolve(true),
                },
                {
                  text: "Kết thúc và bắt đầu mới",
                  onPress: () => resolve(false),
                  style: "destructive",
                },
              ]
            );
          });

          if (shouldJoinExisting) {
            // Join the existing call for its appointment
            console.log("🔀 User chose to join existing call");
            const response = await userService.joinCall(
              activeCallAppointmentId
            );

            if (response.success) {
              const callInfo = response.data;
              setCallData(callInfo);
              await initAgoraWithApiData(callInfo);
              return;
            } else {
              throw new Error("Failed to join existing call");
            }
          } else {
            // End the existing call before starting new one
            try {
              console.log("🔚 Ending existing call:", activeCall._id);
              await userService.endCall(activeCall._id);
              console.log("✅ Successfully ended existing call");

              // Wait a moment for backend to process
              await new Promise((resolve) => setTimeout(resolve, 1000));
            } catch (endError) {
              console.warn("⚠️ Failed to end existing call:", endError);
              // Continue anyway - maybe the call was already ended
            }
          }
        }
      }

      // Step 2: No active call or successfully ended - start/create new call
      let response;
      if (isJoining === "true") {
        console.log("🔗 Joining call (forced join mode)");
        response = await userService.joinCall(appointmentId as string);
      } else {
        console.log("📞 Starting new call");
        response = await userService.startCall(appointmentId as string, {
          callType: (callType as "video" | "audio") || "video",
        });
      }

      if (response.success) {
        const callInfo = response.data;
        setCallData(callInfo);

        console.log("📋 Call data received:", {
          callId: callInfo.callId,
          appId: callInfo.agoraAppId,
          channel: callInfo.channelName,
          uid: callInfo.patientUid || callInfo.uid,
          tokenLength: callInfo.patientToken?.length || callInfo.token?.length,
        });

        // Normalize the response data structure
        const normalizedCallInfo = {
          ...callInfo,
          // Use consistent field names
          agoraAppId: callInfo.agoraAppId,
          channelName: callInfo.channelName,
          patientUid: callInfo.patientUid || callInfo.uid,
          patientToken: callInfo.patientToken || callInfo.token,
        };

        // Validate required Agora parameters
        if (
          !normalizedCallInfo.agoraAppId ||
          !normalizedCallInfo.channelName ||
          !normalizedCallInfo.patientToken
        ) {
          console.error("Missing Agora fields:", {
            agoraAppId: normalizedCallInfo.agoraAppId,
            channelName: normalizedCallInfo.channelName,
            token: normalizedCallInfo.patientToken,
            uid: normalizedCallInfo.patientUid,
          });
          throw new Error("Thiếu thông tin Agora từ server");
        }

        // Initialize Agora with API data
        await initAgoraWithApiData(normalizedCallInfo);
      } else {
        console.error("Error starting call:", response.message);

        // Handle different error cases
        if (response.message?.includes("No active call found")) {
          console.log("🚨 No call session exists - need to create one");

          // Check if this is an appointment that needs call creation
          Alert.alert(
            "Tạo cuộc gọi mới",
            "Chưa có phiên gọi nào cho cuộc hẹn này. Tạo cuộc gọi mới?",
            [
              { text: "Hủy", onPress: () => router.back() },
              {
                text: "Tạo cuộc gọi",
                onPress: async () => {
                  try {
                    console.log("🆕 Creating new call session...");

                    // Try different approaches to create call
                    let createResponse;

                    // Method 1: Try direct call creation endpoint
                    try {
                      createResponse = await userService.createCall(
                        appointmentId as string,
                        {
                          callType: (callType as "video" | "audio") || "video",
                        }
                      );
                    } catch (createError) {
                      console.log("Method 1 failed, trying method 2...");

                      // Method 2: Try to force start call with different parameter
                      createResponse = await userService.startCall(
                        appointmentId as string,
                        {
                          callType: (callType as "video" | "audio") || "video",
                          forceCreate: true,
                        }
                      );
                    }

                    if (createResponse.success) {
                      console.log("✅ Call session created successfully");
                      const callInfo = createResponse.data;
                      setCallData(callInfo);

                      // Validate the created call info
                      if (
                        callInfo.agoraAppId &&
                        callInfo.channelName &&
                        callInfo.patientToken
                      ) {
                        await initAgoraWithApiData(callInfo);
                      } else {
                        throw new Error("Created call missing Agora info");
                      }
                    } else {
                      throw new Error(
                        createResponse.message || "Failed to create call"
                      );
                    }
                  } catch (createError) {
                    console.error("❌ Failed to create call:", createError);
                    Alert.alert(
                      "Lỗi tạo cuộc gọi",
                      `Không thể tạo cuộc gọi: ${createError.message}. Sử dụng demo mode?`,
                      [
                        { text: "Demo Mode", onPress: () => startDemoMode() },
                        { text: "Quay lại", onPress: () => router.back() },
                      ]
                    );
                  }
                },
              },
            ]
          );
          return;
        } else if (response.message?.includes("appointment not found")) {
          Alert.alert(
            "Lỗi cuộc hẹn",
            "Không tìm thấy cuộc hẹn này. Vui lòng kiểm tra lại.",
            [{ text: "Quay lại", onPress: () => router.back() }]
          );
          return;
        } else if (response.message?.includes("not authorized")) {
          Alert.alert(
            "Không có quyền",
            "Bạn không có quyền tham gia cuộc gọi này.",
            [{ text: "Quay lại", onPress: () => router.back() }]
          );
          return;
        }

        throw new Error(response.message || "Failed to get call details");
      }
    } catch (error) {
      console.error("❌ Failed to initialize call:", error);

      // Show error with fallback options
      Alert.alert(
        "Lỗi kết nối",
        `Không thể tham gia cuộc gọi: ${error.message}`,
        [
          {
            text: "Demo mode",
            onPress: () => {
              setIsLoading(false);
              startDemoMode();
            },
          },
          {
            text: "Thử lại",
            onPress: () => initializeCallFromBackend(),
          },
          {
            text: "Quay lại",
            onPress: () => router.back(),
          },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Separate useEffect for timer - only start if not returning
  useEffect(() => {
    // Don't start new timer if returning to existing session
    if (isReturning) {
      console.log("Not starting timer - returning to existing session");
      return;
    }

    console.log("Starting call timer");
    // Start call timer with setTimeout to avoid immediate setState
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        setCallDuration((prev) => {
          const newDuration = prev + 1;
          updateDuration(newDuration); // Update global indicator
          return newDuration;
        });
      }, 1000);

      // Return cleanup function
      return () => {
        console.log("Clearing call timer");
        clearInterval(interval);
      };
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [isReturning]); // Depend on isReturning

  const initAgoraWithApiData = async (callInfo: any) => {
    try {
      // Request permissions
      if (Platform.OS === "android") {
        await requestPermissions();
      }

      // Add detailed logging for debugging
      console.log("🔍 AGORA DEBUG INFO:");
      console.log("📋 App ID:", callInfo.agoraAppId);
      console.log("📋 Channel Name:", callInfo.channelName);
      console.log("📋 Patient UID:", callInfo.patientUid);
      console.log("📋 Token Length:", callInfo.patientToken?.length);
      console.log(
        "📋 Token First 20 chars:",
        callInfo.patientToken?.substring(0, 20)
      );

      // Log channel comparison - now we expect callId-based channel
      console.log("🔍 CHANNEL NAME INFO:");
      console.log("   Backend Channel:", callInfo.channelName);
      console.log("   Call ID:", callInfo.callId);
      console.log("   Appointment ID:", appointmentId);

      // Channel should be based on callId, not appointmentId
      const expectedChannelPattern = /^skinora_call_[a-f0-9]{24}$/;
      const isValidChannel = expectedChannelPattern.test(callInfo.channelName);
      console.log("   Valid channel format:", isValidChannel);

      console.log("Initializing Agora with API data:", {
        appId: callInfo.agoraAppId,
        channelName: callInfo.channelName,
        hasToken: !!callInfo.patientToken,
        uid: callInfo.patientUid,
      });

      console.log("Creating RTC engine...");

      // Create RTC engine - handle different API versions
      let _engine;
      if (RtcEngine.create) {
        _engine = await RtcEngine.create(callInfo.agoraAppId);
      } else if (typeof RtcEngine === "function") {
        _engine = await RtcEngine(callInfo.agoraAppId);
      } else {
        throw new Error("Unable to create RTC engine - unknown API pattern");
      }

      console.log("RTC engine created successfully");
      setEngine(_engine);

      if (!_engine) {
        console.warn(
          "Engine creation returned null/undefined, falling back to demo"
        );
        startDemoMode();
        return;
      }

      // Enable audio first
      try {
        await _engine.enableAudio();
        console.log("Audio enabled");
      } catch (e) {
        console.warn("Audio enable failed:", e.message);
      }

      // Enable video
      try {
        await _engine.enableVideo();
        console.log("Video enabled");
      } catch (e) {
        console.warn("Video enable failed:", e.message);
      }

      // Set channel profile to Communication
      try {
        if (ChannelProfile && _engine.setChannelProfile) {
          await _engine.setChannelProfile(ChannelProfile.Communication || 1);
          console.log("Channel profile set to Communication");
        } else {
          // Fallback for different SDK versions
          await _engine.setChannelProfile(1); // 1 = Communication
          console.log("Channel profile set to Communication (fallback)");
        }
      } catch (e) {
        console.warn("Channel profile set failed:", e.message);
      }

      // Set client role to Broadcaster
      try {
        if (ClientRole && _engine.setClientRole) {
          await _engine.setClientRole(ClientRole.Broadcaster || 1);
          console.log("Client role set to Broadcaster");
        } else {
          // Fallback for different SDK versions
          await _engine.setClientRole(1); // 1 = Broadcaster
          console.log("Client role set to Broadcaster (fallback)");
        }
      } catch (e) {
        console.warn("Client role set failed:", e.message);
      }

      // Add event listeners with proper state management
      try {
        _engine.addListener?.("JoinChannelSuccess", (channel, uid, elapsed) => {
          console.log("✅ JoinChannelSuccess:");
          console.log("   Channel:", channel);
          console.log("   My UID:", uid);
          console.log("   Elapsed:", elapsed);

          // Clear any pending timeout
          if (_engine._joinTimeoutCleanup) {
            _engine._joinTimeoutCleanup();
            delete _engine._joinTimeoutCleanup;
          }

          // Use setTimeout to avoid setState during render
          setTimeout(() => {
            setLocalUid(uid);
            setIsJoined(true);

            // Update status based on whether we have remote users
            setCallStatus(
              remoteUsers.length > 0
                ? "Đã kết nối"
                : "Đang chờ bác sĩ tham gia..."
            );
          }, 0);
        });

        _engine.addListener?.("UserJoined", (uid, elapsed) => {
          console.log("🎉 UserJoined - UID:", uid, "Elapsed:", elapsed);
          console.log("   Remote user joined successfully!");

          // Add to remote users array
          setRemoteUsers((prevUsers) => {
            if (!prevUsers.includes(uid)) {
              const newUsers = [...prevUsers, uid];
              console.log("   Updated remote users:", newUsers);
              return newUsers;
            }
            return prevUsers;
          });

          // Update status
          setCallStatus("Đã kết nối với bác sĩ");

          // For backward compatibility, set the first remote user as remoteUid
          setRemoteUid(uid);
        });

        _engine.addListener?.("UserOffline", (uid, reason) => {
          console.log("👋 UserOffline - UID:", uid, "Reason:", reason);

          // Remove from remote users array
          setRemoteUsers((prevUsers) => {
            const newUsers = prevUsers.filter((id) => id !== uid);
            console.log("   Updated remote users after leave:", newUsers);

            // Update status based on remaining users
            if (newUsers.length === 0) {
              setCallStatus("Bác sĩ đã rời khỏi cuộc gọi");
              setRemoteUid(null);
            } else {
              setCallStatus(`Đã kết nối với ${newUsers.length} người`);
              // Set the first remaining user as primary remote
              setRemoteUid(newUsers[0]);
            }

            return newUsers;
          });
        });

        _engine.addListener?.("Error", (errorCode, msg) => {
          console.log("❌ Agora Error:", errorCode, msg);
          setCallStatus("Lỗi kết nối");

          // Log detailed error info
          console.log("❌ DETAILED ERROR INFO:");
          console.log("   Error Code:", errorCode);
          console.log("   Message:", msg);
          console.log("   Channel:", callInfo.channelName);
          console.log("   UID:", callInfo.patientUid);
          console.log("   Token length:", callInfo.patientToken?.length);

          Alert.alert("Lỗi Agora", `Mã lỗi: ${errorCode}\n${msg || ""}`);
        });

        _engine.addListener?.("Warning", (warningCode, msg) => {
          console.log("⚠️ Agora Warning:", warningCode, msg);
        });

        _engine.addListener?.("ConnectionStateChanged", (state, reason) => {
          console.log("🔗 Connection State Changed:", state, "Reason:", reason);

          // Update status based on connection state
          switch (state) {
            case 1: // DISCONNECTED
              setCallStatus("Mất kết nối");
              break;
            case 2: // CONNECTING
              setCallStatus("Đang kết nối...");
              break;
            case 3: // CONNECTED
              setCallStatus(
                remoteUsers.length > 0 ? "Đã kết nối" : "Đang chờ bác sĩ..."
              );
              break;
            case 4: // RECONNECTING
              setCallStatus("Đang kết nối lại...");
              break;
            case 5: // FAILED
              setCallStatus("Kết nối thất bại");
              console.error(
                "❌ Connection failed - attempting retry in 3 seconds"
              );
              setTimeout(() => {
                console.log("🔄 Retrying channel join...");
                initAgoraWithApiData(callInfo);
              }, 3000);
              break;
          }
        });

        _engine.addListener?.(
          "RemoteVideoStateChanged",
          (uid, state, reason, elapsed) => {
            console.log("📹 Remote Video State Changed:");
            console.log("   UID:", uid);
            console.log("   State:", state);
            console.log("   Reason:", reason);
          }
        );

        _engine.addListener?.(
          "RemoteAudioStateChanged",
          (uid, state, reason, elapsed) => {
            console.log("🔊 Remote Audio State Changed:");
            console.log("   UID:", uid);
            console.log("   State:", state);
            console.log("   Reason:", reason);
          }
        );

        console.log("Event listeners added");
      } catch (e) {
        console.warn("Event listener setup failed:", e.message);
      }

      // Validate token format before joining
      console.log("🔍 TOKEN VALIDATION:");
      console.log("   Token provided:", !!callInfo.patientToken);
      console.log("   Token length:", callInfo.patientToken?.length);
      console.log(
        "   Token starts with:",
        callInfo.patientToken?.substring(0, 10)
      );
      console.log("   UID type:", typeof callInfo.patientUid);
      console.log("   UID value:", callInfo.patientUid);

      // Ensure UID is a number
      const numericUid = parseInt(callInfo.patientUid);
      if (isNaN(numericUid)) {
        throw new Error(`Invalid UID: ${callInfo.patientUid}`);
      }

      // Join channel with exact values from backend
      console.log("🚀 JOINING CHANNEL WITH PARAMETERS:");
      console.log(
        "   Token:",
        callInfo.patientToken ? "✅ Provided" : "❌ Missing"
      );
      console.log("   Channel:", callInfo.channelName);
      console.log("   UID (numeric):", numericUid);
      console.log("   App ID:", callInfo.agoraAppId);

      try {
        // Validate parameters before joining
        console.log("🔍 PRE-JOIN VALIDATION:");

        // Fix token validation - Agora tokens are base64-like strings, not hex
        const tokenValid =
          callInfo.patientToken &&
          callInfo.patientToken.length >= 100 &&
          /^[A-Za-z0-9+/=]+$/.test(callInfo.patientToken);

        console.log("   Token valid format:", tokenValid);
        console.log(
          "   Channel valid format:",
          /^[a-zA-Z0-9_-]+$/.test(callInfo.channelName)
        );
        console.log("   UID is positive integer:", numericUid > 0);
        console.log(
          "   App ID valid format:",
          /^[a-f0-9]{32}$/.test(callInfo.agoraAppId)
        );

        // Additional validation
        if (!callInfo.patientToken || callInfo.patientToken.length < 100) {
          throw new Error("Token appears to be invalid or too short");
        }

        if (!callInfo.channelName || callInfo.channelName.length === 0) {
          throw new Error("Channel name is empty");
        }

        if (numericUid <= 0 || numericUid > 2147483647) {
          throw new Error(`UID out of valid range: ${numericUid}`);
        }

        // Try joining with different parameter combinations
        console.log("🔄 Attempting to join channel...");

        // Check SDK version and use appropriate API
        let joinResult;

        console.log("🔍 ENGINE METHODS AVAILABLE:");
        console.log("   joinChannel:", typeof _engine.joinChannel);
        console.log(
          "   joinChannelWithUserAccount:",
          typeof _engine.joinChannelWithUserAccount
        );
        console.log("   Engine constructor:", _engine.constructor?.name);

        try {
          // Method 1: Standard joinChannel with token, channel, info, uid
          console.log(
            "🔄 Method 1: Standard joinChannel(token, channel, null, uid)"
          );
          joinResult = await _engine.joinChannel(
            callInfo.patientToken,
            callInfo.channelName,
            null, // info (deprecated in newer versions)
            numericUid
          );
          console.log("✅ Standard join result:", joinResult);

          // Don't proceed if this method failed - try alternatives
          if (joinResult < 0) {
            throw new Error(`Method 1 failed with code: ${joinResult}`);
          }
        } catch (method1Error) {
          console.log("❌ Method 1 failed:", method1Error.message);

          try {
            // Method 2: Try without the info parameter (3-param version)
            console.log(
              "🔄 Method 2: joinChannel(token, channel, uid) - 3 params"
            );
            joinResult = await _engine.joinChannel(
              callInfo.patientToken,
              callInfo.channelName,
              numericUid
            );
            console.log("✅ 3-param join result:", joinResult);

            // Check if this method succeeded
            if (joinResult < 0) {
              throw new Error(`Method 2 failed with code: ${joinResult}`);
            }
          } catch (method2Error) {
            console.log("❌ Method 2 failed:", method2Error.message);

            try {
              // Method 3: Try with options object (v4+ style)
              console.log("🔄 Method 3: joinChannel with options object");
              const joinOptions = {
                token: callInfo.patientToken,
                channelId: callInfo.channelName,
                uid: numericUid,
                options: {},
              };

              joinResult = await _engine.joinChannel(joinOptions);
              console.log("✅ Options object join result:", joinResult);

              if (joinResult < 0) {
                throw new Error(`Method 3 failed with code: ${joinResult}`);
              }
            } catch (method3Error) {
              console.log("❌ Method 3 failed:", method3Error.message);

              try {
                // Method 4: Try with string UID instead of number
                console.log("🔄 Method 4: String UID version");
                joinResult = await _engine.joinChannel(
                  callInfo.patientToken,
                  callInfo.channelName,
                  null,
                  callInfo.patientUid.toString()
                );
                console.log("✅ String UID join result:", joinResult);

                if (joinResult < 0) {
                  throw new Error(`Method 4 failed with code: ${joinResult}`);
                }
              } catch (method4Error) {
                console.log("❌ Method 4 failed:", method4Error.message);

                try {
                  // Method 5: Try with auto-assigned UID (0)
                  console.log("🔄 Method 5: Auto-assigned UID (0)");
                  joinResult = await _engine.joinChannel(
                    callInfo.patientToken,
                    callInfo.channelName,
                    null,
                    0 // Let Agora assign UID
                  );
                  console.log("✅ Auto UID join result:", joinResult);

                  if (joinResult < 0) {
                    throw new Error(`Method 5 failed with code: ${joinResult}`);
                  }
                } catch (method5Error) {
                  console.log("❌ Method 5 failed:", method5Error.message);

                  try {
                    // Method 6: Try joinChannelWithUserAccount if available
                    console.log("🔄 Method 6: joinChannelWithUserAccount");
                    if (_engine.joinChannelWithUserAccount) {
                      joinResult = await _engine.joinChannelWithUserAccount(
                        callInfo.patientToken,
                        callInfo.channelName,
                        `user_${callInfo.patientUid}` // Use string user account
                      );
                      console.log("✅ UserAccount join result:", joinResult);

                      if (joinResult < 0) {
                        throw new Error(
                          `Method 6 failed with code: ${joinResult}`
                        );
                      }
                    } else {
                      throw new Error(
                        "joinChannelWithUserAccount not available"
                      );
                    }
                  } catch (method6Error) {
                    console.log("❌ Method 6 failed:", method6Error.message);

                    // All methods failed - this might be a token or server issue
                    console.error("🚨 ALL JOIN METHODS FAILED!");
                    console.error("🔍 TOKEN ANALYSIS:");
                    console.error("   Token:", callInfo.patientToken);
                    console.error(
                      "   Token starts:",
                      callInfo.patientToken?.substring(0, 30)
                    );
                    console.error(
                      "   Token ends:",
                      callInfo.patientToken?.substring(-20)
                    );
                    console.error(
                      "   Expected format: Should start with app ID"
                    );
                    console.error(
                      "   App ID in token?",
                      callInfo.patientToken?.includes(
                        callInfo.agoraAppId.substring(0, 8)
                      )
                    );

                    throw new Error(
                      `All join methods failed. This suggests token/server issue. Last: ${method6Error.message}`
                    );
                  }
                }
              }
            }
          }
        }

        console.log("✅ Join channel call completed:", joinResult);

        // Check if joinResult indicates an error (this should not happen now since we check in each method)
        if (joinResult < 0) {
          console.error("❌ Join channel returned error code:", joinResult);

          // Common Agora error codes
          const errorMessages = {
            "-2": "Invalid parameter (ERR_INVALID_ARGUMENT)",
            "-3": "SDK not ready (ERR_NOT_READY)",
            "-5": "Request rejected (ERR_REFUSED)",
            "-7": "SDK not initialized (ERR_NOT_INITIALIZED)",
            "-17":
              "Request to join channel is rejected (ERR_JOIN_CHANNEL_REJECTED)",
            "-18": "Failed to leave channel (ERR_LEAVE_CHANNEL_REJECTED)",
          };

          const errorMsg =
            errorMessages[joinResult.toString()] ||
            `Unknown error code: ${joinResult}`;
          console.error("❌ Join channel error:", errorMsg);

          // Try engine reinitialization as last resort
          console.log("🔄 Trying engine reinitialization as last resort...");

          try {
            // Destroy current engine
            if (_engine.destroy) {
              await _engine.destroy();
            } else if (_engine.release) {
              await _engine.release();
            }

            // Create new engine with minimal settings
            let newEngine;
            if (RtcEngine.create) {
              newEngine = await RtcEngine.create(callInfo.agoraAppId);
            } else if (typeof RtcEngine === "function") {
              newEngine = await RtcEngine(callInfo.agoraAppId);
            }

            console.log("✅ New engine created for last resort");

            // Set only essential settings
            await newEngine.enableAudio();
            await newEngine.enableVideo();

            // Try join with new engine - use simplest method
            const newJoinResult = await newEngine.joinChannel(
              callInfo.patientToken,
              callInfo.channelName,
              null,
              numericUid
            );

            console.log("✅ New engine join result:", newJoinResult);

            if (newJoinResult >= 0) {
              console.log("✅ Engine reinitialization worked!");
              setEngine(newEngine);
              _engine = newEngine; // Update local reference
              joinResult = newJoinResult; // Update result
            } else {
              throw new Error(`New engine also failed: ${newJoinResult}`);
            }
          } catch (reinitError) {
            console.log(
              "❌ Engine reinitialization failed:",
              reinitError.message
            );
            throw new Error(
              `Complete failure - even reinit failed: ${errorMsg}`
            );
          }
        }

        // If we reach here, join was successful (result >= 0)
        console.log(
          "✅ Channel join initiated successfully with result:",
          joinResult
        );

        // Wait for JoinChannelSuccess event with timeout
        const joinTimeout = setTimeout(() => {
          if (!isJoined) {
            console.error(
              "❌ Join timeout - no JoinChannelSuccess event received"
            );
            // Use setTimeout to avoid setState during render
            setTimeout(() => {
              setCallStatus("Timeout kết nối");

              Alert.alert(
                "Timeout kết nối",
                "Không thể tham gia kênh sau khi thử tất cả phương pháp. Có thể do:\n• Token từ server không hợp lệ\n• Kênh chưa được tạo\n• Vấn đề mạng\n\nThử demo mode?",
                [
                  { text: "Demo Mode", onPress: () => startDemoMode() },
                  {
                    text: "Lấy token mới",
                    onPress: async () => {
                      try {
                        console.log("🔄 Getting completely fresh token...");
                        const freshResponse = await userService.joinCall(
                          appointmentId as string
                        );
                        if (freshResponse.success) {
                          // Wait before retry
                          setTimeout(() => {
                            initAgoraWithApiData(freshResponse.data);
                          }, 1000);
                        } else {
                          throw new Error("Failed to get fresh token");
                        }
                      } catch (refreshError) {
                        console.error("❌ Token refresh failed:", refreshError);
                        startDemoMode();
                      }
                    },
                  },
                  {
                    text: "Debug Server",
                    onPress: () => {
                      console.log("🔍 FULL DEBUG INFO FOR SERVER:");
                      console.log("   App ID:", callInfo.agoraAppId);
                      console.log("   Channel:", callInfo.channelName);
                      console.log("   Token:", callInfo.patientToken);
                      console.log("   UID:", callInfo.patientUid);
                      console.log("   Call ID:", callInfo.callId);

                      Alert.alert(
                        "Debug Info",
                        `App ID: ${callInfo.agoraAppId}\nChannel: ${callInfo.channelName}\nUID: ${callInfo.patientUid}\nToken Length: ${callInfo.patientToken?.length}`
                      );
                    },
                  },
                ]
              );
            }, 0);
          }
        }, 10000); // Longer timeout since we tried so many methods

        // Clear timeout when join succeeds
        const cleanupJoinListener = () => {
          clearTimeout(joinTimeout);
        };

        // Store cleanup function for later use
        _engine._joinTimeoutCleanup = cleanupJoinListener;
      } catch (e) {
        console.error("❌ Join channel failed:", e.message);
        console.error("❌ Join channel error details:", e);

        // More specific error handling
        let errorMessage = e.message;
        let shouldRetry = false;

        if (e.message.includes("All join methods failed")) {
          errorMessage =
            "Tất cả phương pháp kết nối đều thất bại. Có thể do token không hợp lệ hoặc server chưa sẵn sàng.";
          shouldRetry = true;
        } else if (e.message.includes("ERR_INVALID_ARGUMENT")) {
          errorMessage =
            "Thông số không hợp lệ. Có thể token hết hạn hoặc channel không đúng.";
          shouldRetry = true;
        } else if (e.message.includes("ERR_NOT_READY")) {
          errorMessage = "SDK chưa sẵn sàng. Thử lại sau.";
          shouldRetry = true;
        } else if (e.message.includes("ERR_REFUSED")) {
          errorMessage = "Yêu cầu bị từ chối. Kiểm tra quyền truy cập.";
        }

        // Use setTimeout to avoid setState during render
        setTimeout(() => {
          Alert.alert("Lỗi tham gia kênh", errorMessage, [
            { text: "Demo Mode", onPress: () => startDemoMode() },
            ...(shouldRetry
              ? [
                  {
                    text: "Lấy token mới",
                    onPress: async () => {
                      try {
                        console.log("🔄 Getting fresh token after error...");
                        const freshResponse = await userService.joinCall(
                          appointmentId as string
                        );
                        if (freshResponse.success) {
                          // Wait a moment before retry
                          setTimeout(() => {
                            initAgoraWithApiData(freshResponse.data);
                          }, 1000);
                        } else {
                          throw new Error("Failed to get fresh token");
                        }
                      } catch (refreshError) {
                        console.error("❌ Fresh token failed:", refreshError);
                        startDemoMode();
                      }
                    },
                  },
                ]
              : []),
            {
              text: "Debug Info",
              onPress: () => {
                console.log("🔍 FULL DEBUG INFO:");
                console.log("   Token:", callInfo.patientToken);
                console.log("   Token length:", callInfo.patientToken?.length);
                console.log("   Channel:", callInfo.channelName);
                console.log("   UID:", numericUid);
                console.log("   App ID:", callInfo.agoraAppId);
              },
            },
          ]);
        }, 100);
      }
    } catch (error) {
      console.error("Error initializing Agora with API data:", error);
      Alert.alert("Lỗi Agora", `Không thể khởi tạo Agora: ${error.message}`, [
        {
          text: "Demo mode",
          onPress: () => startDemoMode(),
        },
        {
          text: "Thử lại",
          onPress: () => initAgoraWithApiData(callData),
        },
        {
          text: "Thoát",
          onPress: () => router.back(),
        },
      ]);
    }
  };

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
                if (typeof engine.leaveChannel === "function") {
                  await engine.leaveChannel();
                  console.log("Left Agora channel");
                }

                if (typeof engine.destroy === "function") {
                  await engine.destroy();
                  console.log("Destroyed Agora engine");
                } else if (typeof engine.release === "function") {
                  await engine.release();
                  console.log("Released Agora engine");
                }
              }

              // End call on backend if we have callData
              if (callData?.callId) {
                await chatService.endCall(callData.callId);
                console.log("Call ended on backend");
              }

              if (appointmentId) {
                endCall(appointmentId as string);
              }

              endCallIndicator();
              router.back();
            } catch (error) {
              console.error("Error ending call:", error);
              endCallIndicator();
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

  // Add test connection function
  const testAgoraConnection = async () => {
    if (!engine || !AGORA_AVAILABLE) {
      console.log("⚠️ No engine available for testing");
      return;
    }

    try {
      // Get connection stats
      console.log("🧪 TESTING AGORA CONNECTION:");
      console.log("   Engine ready:", !!engine);
      console.log("   Is joined:", isJoined);
      console.log("   Remote UID:", remoteUid);

      // Try to get channel stats
      if (engine.getCallId) {
        const callId = await engine.getCallId();
        console.log("   Call ID:", callId);
      }
    } catch (error) {
      console.error("❌ Connection test failed:", error);
    }
  };

  // Add button to test connection in development
  const showConnectionDebug = () => {
    const debugInfo = `
Channel: ${callData?.channelName}
My UID: ${localUid}
Expected UID: ${callData?.patientUid}
Remote Users: [${remoteUsers.join(", ")}]
Primary Remote: ${remoteUid}
Joined: ${isJoined}
Engine: ${!!engine}
AGORA_AVAILABLE: ${AGORA_AVAILABLE}

Connection State: ${engine?.getConnectionState?.() || "N/A"}
Engine Remote Users: ${engine?.getRemoteUsers?.()?.length || 0}
    `;

    Alert.alert("Agora Debug Info", debugInfo, [
      {
        text: "Force Sync Users",
        onPress: () => {
          if (engine?.getRemoteUsers) {
            const users = engine.getRemoteUsers() || [];
            console.log("🔧 Manual sync - Engine users:", users);
            setRemoteUsers(users);
            if (users.length > 0) {
              setRemoteUid(users[0]);
              setCallStatus("Đã kết nối với bác sĩ");
            }
            Alert.alert(
              "Sync Complete",
              `Synced ${users.length} users from engine`
            );
          }
        },
      },
      { text: "Test Connection", onPress: testAgoraConnection },
      { text: "OK" },
    ]);
  };

  // Add loading state UI
  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <View style={styles.loadingContent}>
              <Ionicons name="videocam" size={80} color="#00A86B" />
              <Text style={styles.loadingText}>Đang kết nối cuộc gọi...</Text>
              <Text style={styles.loadingSubText}>
                {appointmentId
                  ? `Cuộc hẹn: ${appointmentId}`
                  : "Đang thiết lập..."}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </>
    );
  }

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
            {/* Add user count indicator */}
            {remoteUsers.length > 0 && (
              <Text style={styles.userCount}>
                {remoteUsers.length} người tham gia
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.infoButton}
            onPress={showConnectionDebug}
          >
            <Ionicons
              name="information-circle-outline"
              size={24}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        {/* Video Area */}
        <View style={styles.videoContainer}>
          {/* Remote Video - Now properly handles multiple users */}
          {remoteUsers.length > 0 && engine && AGORA_AVAILABLE ? (
            <RtcRemoteView.SurfaceView
              style={styles.remoteVideo}
              uid={remoteUsers[0]} // Use first remote user
              channelId={callData?.channelName || "demo-channel"}
              renderMode={VideoRenderMode?.Hidden || 1}
            />
          ) : remoteUsers.length > 0 ? (
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
                {isJoined && AGORA_AVAILABLE && callData && (
                  <View style={styles.connectionInfo}>
                    <Text style={styles.connectionText}>
                      Channel: {callData.channelName}
                    </Text>
                    <Text style={styles.connectionText}>
                      My UID: {localUid}
                    </Text>
                    <Text style={styles.connectionText}>
                      Remote Users: {remoteUsers.length}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Local Video - Show when joined */}
          {engine && isJoined && AGORA_AVAILABLE ? (
            <View style={styles.localVideoContainer}>
              {isCameraOn ? (
                <RtcLocalView.SurfaceView
                  style={styles.localVideo}
                  channelId={callData?.channelName || "demo-channel"}
                  renderMode={VideoRenderMode?.Hidden || 1}
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
    marginTop: 4,
    color: "#CCCCCC",
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContent: {
    alignItems: "center",
  },
  loadingText: {
    fontSize: 18,
    color: "#FFFFFF",
    marginTop: 20,
    textAlign: "center",
  },
  loadingSubText: {
    fontSize: 14,
    color: "#CCCCCC",
    marginTop: 10,
    textAlign: "center",
  },
  demoText: {
    fontWeight: "bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  liveText: {
    marginRight: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  liveDot: {
    borderRadius: 15,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0, 168, 107, 0.9)",
    marginTop: 15,
    padding: 40,
  },
  userCount: {
    fontSize: 12,
    color: "#00A86B",
    marginTop: 2,
  },
});
