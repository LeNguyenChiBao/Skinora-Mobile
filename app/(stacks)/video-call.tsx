import { useCallIndicatorStore } from "@/hooks/useCallIndicator";
import { useCallService } from "@/hooks/useCallService";
import { useIncomingCalls } from "@/hooks/useIncomingCalls";
import { useNotifications } from "@/hooks/useNotifications";
import callService from "@/services/call.service";
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
let RtcEngine: any,
  RtcLocalView: any,
  RtcRemoteView: any,
  VideoRenderMode: any,
  ChannelProfile: any,
  ClientRole: any;
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
    console.error(
      "Failed to import react-native-agora:",
      (importError as any)?.message
    );
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
      console.log("Manual inspection failed:", (e as any)?.message);
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
    callId, // Add callId for chat-based calls
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
    isInitiator, // Add isInitiator for chat-based calls
    otherParticipantName, // Add for chat-based calls
    otherParticipantAvatar, // Add for chat-based calls
  } = useLocalSearchParams();  const { endCall } = useNotifications();
  const { clearCallState } = useIncomingCalls(); // Add hook to clear call state
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
  const [isPiPMode, setIsPiPMode] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Initialize call service for background handling
  const callServiceHook = useCallService();

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
          participantName: Array.isArray(doctorName)
            ? doctorName[0]
            : Array.isArray(callerName)
            ? callerName[0]
            : (doctorName as string) || (callerName as string) || "Bác sĩ",
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
      appointmentIdType: typeof appointmentId,
      appointmentIdValue: appointmentId,
      callId,
      callIdType: typeof callId,
      callIdValue: callId,
      doctorName,
      callType,
      isJoining,
      isInitiator,
      isReturning: !!isReturning,
      globalCallDuration,
    });

    // If returning to session, sync with global duration
    if (isReturning) {
      console.log("Skipping initialization - returning to existing session");
      // Wrap state updates in setTimeout to avoid setState during render
      setTimeout(() => {
        setCallDuration(globalCallDuration);
        setIsLoading(false);
        // Only set state if Agora is properly available and connected
        if (!AGORA_AVAILABLE) {
          console.error("❌ Returning to session but Agora not available");
          Alert.alert(
            "Lỗi Agora SDK",
            "Không thể quay lại phiên gọi vì Agora SDK không khả dụng.",
            [{ text: "Quay lại", onPress: () => router.back() }]
          );
        }
      }, 0);
      return;
    }
    // Never fallback to demo mode - always require real Agora
    if (!AGORA_AVAILABLE) {
      console.error("❌ Agora SDK not available - cannot proceed");
      setTimeout(() => {
        setIsLoading(false);
        Alert.alert(
          "Lỗi SDK Agora",
          "Không thể tải SDK Agora. Vui lòng kiểm tra cài đặt ứng dụng và thử lại.",
          [
            {
              text: "Thử lại",
              onPress: () => {
                // Force app restart/reload
                console.log("Restarting app to retry Agora initialization");
                router.back();
              },
            },
            { text: "Quay lại", onPress: () => router.back() },
          ]
        );
      }, 0);
      return;
    }

    // Initialize call with backend API
    if (appointmentId) {
      // Appointment-based call
      initializeAppointmentCall(appointmentId as string);
    } else if (callId) {
      // Chat-based call
      initializeChatCall(callId as string);
    } else {
      console.error("❌ No valid ID provided for call initialization");
      Alert.alert("Lỗi", "Không có ID cuộc gọi hợp lệ", [
        { text: "Quay lại", onPress: () => router.back() },
      ]);
    }
  }, []); // Remove dependencies to prevent re-runs

  // Cleanup call state when component unmounts
  useEffect(() => {
    return () => {
      console.log("🧹 Video call component unmounting, clearing call state");
      clearCallState();
    };
  }, [clearCallState]);

  // Helper function for appointment-based calls
  const initializeAppointmentCall = async (appointmentId: string) => {
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
        const response = await userService.joinCall(appointmentId);

        if (response.success) {
          const callInfo = response.data;
          setCallData(callInfo);

          console.log("📋 Joined existing call data:", {
            callId: callInfo.callId,
            channel: callInfo.channelName,
            uid: callInfo.patientUid || (callInfo as any).uid,
            tokenLength:
              callInfo.patientToken?.length || (callInfo as any).token?.length,
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
          const response = await userService.joinCall(activeCallAppointmentId);

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
      response = await userService.joinCall(appointmentId);
    } else {
      console.log("📞 Starting new call");
      response = await userService.startCall(appointmentId, {
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
      } // Initialize Agora with API data - using enhanced retry logic
      await initAgoraWithApiDataEnhanced(normalizedCallInfo);
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
                  const createResponse = await userService.startCall(
                    appointmentId,
                    {
                      callType: (callType as "video" | "audio") || "video",
                      forceCreate: true,
                    }
                  );

                  if (createResponse.success) {
                    const callInfo = createResponse.data;
                    setCallData(callInfo);
                    await initAgoraWithApiData(callInfo);
                  } else {
                    throw new Error(
                      createResponse.message || "Failed to create call"
                    );
                  }
                } catch (createError) {
                  console.error("❌ Error creating call:", createError);
                  Alert.alert(
                    "Lỗi tạo cuộc gọi",
                    `Không thể tạo cuộc gọi: ${
                      (createError as any)?.message || "Unknown error"
                    }`,
                    [
                      { text: "Quay lại", onPress: () => router.back() },
                      {
                        text: "Thử lại",
                        onPress: () => initializeAppointmentCall(appointmentId),
                      },
                    ]
                  );
                }
              },
            },
          ]
        );
      } else {
        // For other errors, show the original error message
        Alert.alert(
          "Lỗi kết nối",
          response.message || "Không thể kết nối đến server",
          [
            { text: "Quay lại", onPress: () => router.back() },
            {
              text: "Thử lại",
              onPress: () => {
                setIsLoading(true);
                initializeAppointmentCall(appointmentId);
              },
            },
          ]
        );
      }
    }
  }; // Helper function for chat-based calls
  const initializeChatCall = async (callId: string) => {
    console.log("📞 Initializing chat-based call with ID:", callId);

    try {
      // First get call details to understand the call
      const callDetails = await callService.getCallDetails(callId);
      console.log("📋 Chat call details:", callDetails); // Then join the call to get Agora connection data
      const joinResult = await callService.joinCall(callId);
      console.log("🔗 Join call result:", joinResult);
      console.log("🔍 Join result keys:", Object.keys(joinResult || {}));
      console.log(
        "🔍 Join result structure:",
        JSON.stringify(joinResult, null, 2)
      ); // Transform join result data to match expected format
      const normalizedCallInfo = {
        callId: callDetails._id,
        agoraAppId: joinResult.agoraAppId || joinResult.agoraConfig?.appId,
        channelName: joinResult.channelName || joinResult.roomId,
        patientUid: joinResult.uid || joinResult.patientUid,
        patientToken: joinResult.token || joinResult.patientToken,
        userRole: joinResult.userRole || callDetails.userRole,
        // Add appointment/doctor info for chat calls
        appointmentId: callDetails.appointmentId || callId,
        doctorInfo: {
          id: callDetails.doctorId,
          name: otherParticipantName || "Bác sĩ",
          avatar: otherParticipantAvatar || "",
        },
      };

      console.log("🔍 AGORA DEBUG INFO:");
      console.log("📋 App ID:", normalizedCallInfo.agoraAppId);
      console.log("📋 Channel Name:", normalizedCallInfo.channelName);
      console.log("📋 Patient UID:", normalizedCallInfo.patientUid);
      console.log("📋 Token Length:", normalizedCallInfo.patientToken?.length);
      console.log(
        "📋 Token First 20 chars:",
        normalizedCallInfo.patientToken?.substring(0, 20)
      );

      setCallData(normalizedCallInfo);
      await initAgoraWithApiData(normalizedCallInfo);
    } catch (error: any) {
      console.error("❌ Error getting chat call details:", error);
      Alert.alert(
        "Lỗi cuộc gọi",
        `Không thể tham gia cuộc gọi: ${error?.message || "Unknown error"}`,
        [
          { text: "Quay lại", onPress: () => router.back() },
          {
            text: "Thử lại",
            onPress: () => initializeChatCall(callId as string),
          },
        ]
      );
    }
  };

  const initializeCallFromBackend = async () => {
    try {
      setIsLoading(true);

      // Determine which ID to use - priority: appointmentId > callId
      const effectiveId = appointmentId || callId;
      const idType = appointmentId ? "appointment" : "call";

      console.log("🚀 Initializing call:", {
        effectiveId,
        idType,
        appointmentId,
        callId,
      });
      console.log("🔍 All params:", {
        appointmentId,
        callId,
        doctorId,
        doctorName,
        callType,
        isJoining,
        isInitiator,
      });

      if (!effectiveId || effectiveId === "" || effectiveId === "undefined") {
        console.error("❌ Missing or invalid ID:", {
          appointmentId,
          callId,
          effectiveId,
          types: {
            appointmentId: typeof appointmentId,
            callId: typeof callId,
            effectiveId: typeof effectiveId,
          },
          allParams: {
            appointmentId,
            callId,
            doctorId,
            doctorName,
            callType,
            isJoining,
            isInitiator,
          },
        });
        throw new Error(
          `Missing both appointment ID and call ID. Received appointmentId: ${appointmentId}, callId: ${callId}`
        );
      } // Handle different call types
      if (appointmentId) {
        // Appointment-based call
        await initializeAppointmentCall(appointmentId as string);
      } else if (callId) {
        // Chat-based call
        await initializeChatCall(callId as string);
      } else {
        throw new Error("No valid ID provided for call initialization");
      }
    } catch (error) {
      console.error("❌ Failed to initialize call:", error);

      // Show error with fallback options
      Alert.alert(
        "Lỗi kết nối",
        `Không thể tham gia cuộc gọi: ${
          (error as any)?.message || "Unknown error"
        }`,
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
      ); // Log channel comparison - now we expect callId-based channel OR timestamp-based channel
      console.log("🔍 CHANNEL NAME INFO:");
      console.log("   Backend Channel:", callInfo.channelName);
      console.log("   Call ID:", callInfo.callId);
      console.log("   Appointment ID:", appointmentId);

      // Channel can be either:
      // 1. callId-based: skinora_call_[callId]
      // 2. timestamp-based: call_[timestamp]_[randomString]
      const callIdChannelPattern = /^skinora_call_[a-f0-9]{24}$/;
      const timestampChannelPattern = /^call_\d+_[a-z0-9]+$/;
      const isValidChannel =
        callIdChannelPattern.test(callInfo.channelName) ||
        timestampChannelPattern.test(callInfo.channelName);
      console.log("   Valid channel format:", isValidChannel);
      console.log("   Channel pattern matches:", {
        callIdPattern: callIdChannelPattern.test(callInfo.channelName),
        timestampPattern: timestampChannelPattern.test(callInfo.channelName),
      });

      console.log("Initializing Agora with API data:", {
        appId: callInfo.agoraAppId,
        channelName: callInfo.channelName,
        hasToken: !!callInfo.patientToken,
        uid: callInfo.patientUid,
      });
      console.log("Creating RTC engine...");

      // Create RTC engine - handle different API versions
      console.log(
        "🚀 Creating Agora RTC engine with App ID:",
        callInfo.agoraAppId
      );

      let _engine: any;
      if (RtcEngine.createAgoraRtcEngine) {
        // For SDK 4.x+, use the new creation method
        _engine = RtcEngine.createAgoraRtcEngine();
        console.log("✅ Engine created using createAgoraRtcEngine()");
      } else if (RtcEngine.create) {
        _engine = await RtcEngine.create(callInfo.agoraAppId);
        console.log("✅ Engine created using RtcEngine.create()");
      } else if (typeof RtcEngine === "function") {
        _engine = await RtcEngine(callInfo.agoraAppId);
        console.log("✅ Engine created using RtcEngine() function");
      } else {
        throw new Error("Unable to create RTC engine - unknown API pattern");
      }
      console.log("RTC engine created successfully");
      if (!_engine) {
        console.error("❌ Engine creation returned null/undefined");
        throw new Error(
          "Không thể tạo Agora RTC engine. Vui lòng kiểm tra cấu hình SDK."
        );
      }

      // CRITICAL: Initialize the engine explicitly (required for SDK 4.x+)
      console.log("🔧 CRITICAL: Initializing engine for SDK 4.x+...");
      if (typeof _engine.initialize === "function") {
        try {
          // For SDK 4.x+, initialize() requires proper configuration
          const initConfig = {
            appId: callInfo.agoraAppId,
            channelProfile: 1, // Communication mode
            audioScenario: 0, // Default audio scenario
          };

          const initResult = await _engine.initialize(initConfig);
          console.log("✅ Engine.initialize() result:", initResult);

          // Check if initialization actually succeeded (0 = success, negative = error)
          if (initResult !== 0) {
            console.error(
              "⚠️ Engine.initialize() returned error code:",
              initResult
            );
            throw new Error(
              `Engine initialization failed with code: ${initResult}. This is likely the cause of join failures.`
            );
          }

          console.log("✅ Engine properly initialized with SDK 4.x+ config");
        } catch (initError) {
          console.error(
            "❌ Engine.initialize() failed:",
            (initError as any)?.message
          );
          throw initError;
        }
      } else {
        console.log(
          "ℹ️ Engine.initialize() not available - using older SDK version"
        );
      }

      // Wait a moment for engine to fully initialize
      console.log("⏳ Waiting for engine to initialize...");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setEngine(_engine);

      // 🔧 CRITICAL DIAGNOSIS: Check if the engine creation was actually successful
      console.log("🔍 DETAILED ENGINE DIAGNOSIS:");
      console.log("   Engine object:", !!_engine);
      console.log("   Engine type:", typeof _engine);
      console.log("   Engine constructor:", _engine.constructor?.name);
      console.log("   Has initialize method:", typeof _engine.initialize);
      console.log("   Has joinChannel method:", typeof _engine.joinChannel);
      console.log("   Has enableAudio method:", typeof _engine.enableAudio);
      console.log("   Has enableVideo method:", typeof _engine.enableVideo);

      // Check if engine is in a valid state
      try {
        if (_engine.getConnectionState) {
          const connectionState = await _engine.getConnectionState();
          console.log("   Connection state:", connectionState);

          // Connection state 5 = FAILED, which explains the issue!
          if (connectionState === 5) {
            console.error(
              "🚨 ENGINE IN FAILED STATE - This explains the join failures!"
            );
            console.log("🔄 Attempting engine recovery...");

            // Try to reset the engine state
            try {
              if (_engine.release) {
                await _engine.release();
                console.log("✅ Engine released");
              }

              // Create a fresh engine
              console.log("🔄 Creating fresh engine...");
              let freshEngine;
              if (RtcEngine.create) {
                freshEngine = await RtcEngine.create(callInfo.agoraAppId);
              } else if (typeof RtcEngine === "function") {
                freshEngine = await RtcEngine(callInfo.agoraAppId);
              }

              if (freshEngine) {
                console.log("✅ Fresh engine created successfully");
                _engine = freshEngine;
                setEngine(freshEngine);
              }
            } catch (recoveryError) {
              console.error(
                "❌ Engine recovery failed:",
                (recoveryError as any)?.message
              );
            }
          }
        }
      } catch (stateError) {
        console.log(
          "   Connection state check failed:",
          (stateError as any)?.message
        );
      } // Enable audio first
      try {
        await _engine.enableAudio();
        console.log("Audio enabled");
      } catch (e) {
        console.warn("Audio enable failed:", (e as any)?.message);
      } // Enable video
      try {
        await _engine.enableVideo();
        console.log("Video enabled");

        // Start local video preview immediately
        try {
          if (_engine.startPreview) {
            await _engine.startPreview();
            console.log("✅ Local video preview started");
          }
        } catch (previewError) {
          console.warn("Local preview failed:", (previewError as any)?.message);
        }
      } catch (e) {
        console.warn("Video enable failed:", (e as any)?.message);
      }

      // 🔧 CRITICAL FIX: For failed engines, try minimal configuration approach
      const currentConnectionState = _engine.getConnectionState
        ? await _engine.getConnectionState()
        : null;
      if (currentConnectionState === 5) {
        console.log(
          "🔧 Using minimal configuration for failed engine state..."
        );

        // Skip advanced settings for failed engines
        console.log(
          "⚠️ Skipping channel profile and client role due to failed state"
        );
      } else {
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
          console.warn("Channel profile set failed:", (e as any)?.message);
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
          console.warn("Client role set failed:", (e as any)?.message);
        }
      }

      // Add event listeners with proper state management
      try {
        _engine.addListener?.(
          "JoinChannelSuccess",
          (channel: any, uid: any, elapsed: any) => {
            console.log("✅ JoinChannelSuccess:");
            console.log("   Channel:", channel);
            console.log("   My UID:", uid);
            console.log("   Elapsed:", elapsed);

            // Clear any pending timeout
            if (_engine._joinTimeoutCleanup) {
              _engine._joinTimeoutCleanup();
              delete _engine._joinTimeoutCleanup;
            } // Use setTimeout to avoid setState during render
            setTimeout(() => {
              setIsLoading(false); // 🔧 CRITICAL: Stop loading state
              setLocalUid(uid);
              setIsJoined(true);

              // Update status based on whether we have remote users
              setCallStatus(
                remoteUsers.length > 0
                  ? "Đã kết nối"
                  : "Đang chờ bác sĩ tham gia..."
              );
            }, 0);
          }
        );

        _engine.addListener?.("UserJoined", (uid: any, elapsed: any) => {
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

          // Update status with setTimeout to avoid setState during render
          setTimeout(() => {
            setCallStatus("Đã kết nối với bác sĩ");
            // For backward compatibility, set the first remote user as remoteUid
            setRemoteUid(uid);
          }, 0);
        });

        _engine.addListener?.("UserOffline", (uid: any, reason: any) => {
          console.log("👋 UserOffline - UID:", uid, "Reason:", reason);

          // Remove from remote users array
          setRemoteUsers((prevUsers) => {
            const newUsers = prevUsers.filter((id) => id !== uid);
            console.log("   Updated remote users after leave:", newUsers);

            // Update status based on remaining users
            if (newUsers.length === 0) {
              setTimeout(() => {
                setCallStatus("Bác sĩ đã rời khỏi cuộc gọi");
                setRemoteUid(null);
              }, 0);
            } else {
              setTimeout(() => {
                setCallStatus(`Đã kết nối với ${newUsers.length} người`);
                // Set the first remaining user as primary remote
                setRemoteUid(newUsers[0]);
              }, 0);
            }

            return newUsers;
          });
        });
        _engine.addListener?.("Error", (errorCode: any, msg: any) => {
          console.log("❌ Agora Error:", errorCode, msg);
          setTimeout(() => {
            setCallStatus("Lỗi kết nối");
          }, 0);

          // Log detailed error info
          console.log("❌ DETAILED ERROR INFO:");
          console.log("   Error Code:", errorCode);
          console.log("   Message:", msg);
          console.log("   Channel:", callInfo.channelName);
          console.log("   UID:", callInfo.patientUid);
          console.log("   Token length:", callInfo.patientToken?.length);

          Alert.alert("Lỗi Agora", `Mã lỗi: ${errorCode}\n${msg || ""}`);
        });

        _engine.addListener?.("Warning", (warningCode: any, msg: any) => {
          console.log("⚠️ Agora Warning:", warningCode, msg);
        });

        _engine.addListener?.(
          "ConnectionStateChanged",
          (state: any, reason: any) => {
            console.log(
              "🔗 Connection State Changed:",
              state,
              "Reason:",
              reason
            ); // Update status based on connection state
            switch (state) {
              case 1: // DISCONNECTED
                setTimeout(() => setCallStatus("Mất kết nối"), 0);
                break;
              case 2: // CONNECTING
                setTimeout(() => setCallStatus("Đang kết nối..."), 0);
                break;
              case 3: // CONNECTED
                setTimeout(
                  () =>
                    setCallStatus(
                      remoteUsers.length > 0
                        ? "Đã kết nối"
                        : "Đang chờ bác sĩ..."
                    ),
                  0
                );
                break;
              case 4: // RECONNECTING
                setTimeout(() => setCallStatus("Đang kết nối lại..."), 0);
                break;
              case 5: // FAILED
                setTimeout(() => setCallStatus("Kết nối thất bại"), 0);
                console.error(
                  "❌ Connection failed - attempting retry in 3 seconds"
                );
                setTimeout(() => {
                  console.log("🔄 Retrying channel join...");
                  initAgoraWithApiData(callInfo);
                }, 3000);
                break;
            }
          }
        );
        _engine.addListener?.(
          "RemoteVideoStateChanged",
          (uid: any, state: any, reason: any, elapsed: any) => {
            console.log("📹 Remote Video State Changed:");
            console.log("   UID:", uid);
            console.log("   State:", state);
            console.log("   Reason:", reason);
          }
        );
        _engine.addListener?.(
          "RemoteAudioStateChanged",
          (uid: any, state: any, reason: any, elapsed: any) => {
            console.log("🔊 Remote Audio State Changed:");
            console.log("   UID:", uid);
            console.log("   State:", state);
            console.log("   Reason:", reason);
          }
        );

        console.log("Event listeners added");
      } catch (e) {
        console.warn("Event listener setup failed:", (e as any)?.message);
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
        } // Try joining with different parameter combinations
        console.log("🔄 Attempting to join channel..."); // IMPORTANT: Before trying to join, let's add one more potential fix
        // Sometimes the issue is that we need to wait a bit more after engine setup
        console.log("⏳ Additional wait for engine stabilization...");
        await new Promise((resolve) => setTimeout(resolve, 500));

        // 🔧 CRITICAL FIX: For SDK 4.x+, we need to properly initialize the engine
        console.log("🔧 CRITICAL: Forcing engine initialization...");
        try {
          if (typeof _engine.initialize === "function") {
            const initResult = await _engine.initialize();
            console.log(
              "✅ Engine.initialize() called successfully:",
              initResult
            );
          } else {
            console.log(
              "ℹ️ Engine.initialize() not available - using older SDK version"
            );
          }
        } catch (initError) {
          console.warn(
            "⚠️ Engine.initialize() failed:",
            (initError as any)?.message
          );
          // Continue anyway - some older versions don't need this
        }

        // 🔧 Re-checking Android permissions...
        if (Platform.OS === "android") {
          try {
            const permissions = await PermissionsAndroid.requestMultiple([
              PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
              PermissionsAndroid.PERMISSIONS.CAMERA,
            ]);

            const audioGranted =
              permissions[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
              PermissionsAndroid.RESULTS.GRANTED;
            const cameraGranted =
              permissions[PermissionsAndroid.PERMISSIONS.CAMERA] ===
              PermissionsAndroid.RESULTS.GRANTED;

            console.log("📋 Permissions status:", {
              audioGranted,
              cameraGranted,
            });

            if (!audioGranted) {
              console.warn("⚠️ Audio permission not granted - muting audio");
              setIsMuted(true);
            }

            if (!cameraGranted) {
              console.warn(
                "⚠️ Camera permission not granted - disabling video"
              );
              setIsCameraOn(false);
            }
          } catch (permError) {
            console.warn(
              "⚠️ Permission check failed:",
              (permError as any)?.message
            );
          }
        }

        // Also check if there might be a UID mismatch in token
        console.log("🔍 POTENTIAL TOKEN-UID MISMATCH CHECK:");
        console.log("   Our UID:", numericUid);
        console.log("   Token UID (might be encoded):", callInfo.patientUid);
        console.log(
          "   UID from agoraConfig:",
          (callInfo as any).agoraConfig?.patientUid
        );

        // Try to decode token to see if UID matches (basic check)
        try {
          // Agora tokens contain the UID in base64 encoding
          // This is just a rough check to see if our UID appears in the token
          const tokenContainsUid =
            callInfo.patientToken.includes(numericUid.toString()) ||
            callInfo.patientToken.includes(callInfo.patientUid.toString());
          console.log("   Token might contain our UID:", tokenContainsUid);
        } catch (e) {
          console.log("   Token UID check failed:", (e as any)?.message);
        } // Check SDK version and use appropriate API
        let joinResult;

        // 🚨 CRITICAL EMERGENCY FIX:
        // The logs show connection state 5 (FAILED) - this means the engine is broken
        // Let's try to completely recreate the engine as a last resort
        const currentState = _engine.getConnectionState
          ? await _engine.getConnectionState()
          : null;
        if (currentState === 5) {
          console.log(
            "🚨 EMERGENCY: Engine in FAILED state - attempting complete recreation"
          );

          try {
            // Destroy the failed engine
            if (_engine.destroy) {
              await _engine.destroy();
            } else if (_engine.release) {
              await _engine.release();
            }

            // Wait a moment
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Create completely fresh engine
            console.log("🔄 Creating emergency replacement engine...");
            let emergencyEngine;
            if (RtcEngine.create) {
              emergencyEngine = await RtcEngine.create(callInfo.agoraAppId);
            } else if (typeof RtcEngine === "function") {
              emergencyEngine = await RtcEngine(callInfo.agoraAppId);
            }

            if (emergencyEngine) {
              console.log("✅ Emergency engine created successfully");
              _engine = emergencyEngine;
              setEngine(emergencyEngine);

              // Quick setup for emergency engine
              try {
                await _engine.enableAudio();
                await _engine.enableVideo();
                console.log("✅ Emergency engine configured");
              } catch (setupError) {
                console.warn(
                  "⚠️ Emergency engine setup failed:",
                  (setupError as any)?.message
                );
              }
            } else {
              throw new Error("Failed to create emergency engine");
            }
          } catch (emergencyError) {
            console.error(
              "❌ Emergency engine recreation failed:",
              (emergencyError as any)?.message
            );
            throw new Error("Complete engine failure - cannot proceed");
          }
        }

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

          // 🔧 CRITICAL FIX: Ensure UID is exactly what the token expects
          // The logs show our UID and token UID might be different
          const effectiveUid =
            callInfo.uid || callInfo.patientUid || numericUid;
          const effectiveToken = callInfo.token || callInfo.patientToken;

          console.log("🔍 USING EFFECTIVE PARAMETERS:");
          console.log("   Original UID:", numericUid);
          console.log("   Token UID field:", callInfo.patientUid);
          console.log("   Fallback UID field:", callInfo.uid);
          console.log("   Effective UID (final):", effectiveUid);
          console.log(
            "   Original Token:",
            callInfo.patientToken?.substring(0, 20) + "..."
          );
          console.log(
            "   Fallback Token:",
            callInfo.token?.substring(0, 20) + "..."
          );
          console.log(
            "   Effective Token (final):",
            effectiveToken?.substring(0, 20) + "..."
          );

          joinResult = await _engine.joinChannel(
            effectiveToken,
            callInfo.channelName,
            null, // info (deprecated in newer versions)
            parseInt(effectiveUid)
          );
          console.log("✅ Standard join result:", joinResult);

          // Don't proceed if this method failed - try alternatives
          if (joinResult < 0) {
            throw new Error(`Method 1 failed with code: ${joinResult}`);
          }
        } catch (method1Error: any) {
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
            console.log("❌ Method 2 failed:", (method2Error as any)?.message);

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
              console.log(
                "❌ Method 3 failed:",
                (method3Error as any)?.message
              );

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
                console.log(
                  "❌ Method 4 failed:",
                  (method4Error as any)?.message
                );

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
                  console.log(
                    "❌ Method 5 failed:",
                    (method5Error as any)?.message
                  );

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
                    console.log(
                      "❌ Method 6 failed:",
                      (method6Error as any)?.message
                    ); // All methods failed - this might be a token or server issue
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

                    // Try one last approach - maybe the issue is UID/token mismatch
                    // Let's try with the original UID from the raw response
                    console.log(
                      "🔄 Method 7: Last resort - try original response values"
                    );

                    const originalUid =
                      (callInfo as any).uid ||
                      (callInfo as any).agoraConfig?.uid;
                    const originalToken =
                      (callInfo as any).token || callInfo.patientToken;

                    if (
                      originalUid &&
                      originalToken &&
                      originalUid !== numericUid
                    ) {
                      console.log(
                        "   Found different UID in original response:",
                        originalUid
                      );
                      console.log("   Trying with original UID/token pair...");

                      try {
                        joinResult = await _engine.joinChannel(
                          originalToken,
                          callInfo.channelName,
                          null,
                          parseInt(originalUid)
                        );
                        console.log("✅ Original UID join result:", joinResult);

                        if (joinResult >= 0) {
                          console.log(
                            "🎉 SUCCESS with original UID! Token/UID pairing was the issue."
                          );
                          // Update our local UID reference
                          setLocalUid(parseInt(originalUid));
                        } else {
                          throw new Error(
                            `Method 7 failed with code: ${joinResult}`
                          );
                        }
                      } catch (method7Error) {
                        console.log(
                          "❌ Method 7 also failed:",
                          (method7Error as any)?.message
                        );

                        throw new Error(
                          `All join methods failed including UID fallback. This suggests fundamental token/server issue. Last: ${
                            (method7Error as any)?.message
                          }`
                        );
                      }
                    } else {
                      throw new Error(
                        `All join methods failed. This suggests token/server issue. Last: ${
                          (method6Error as any)?.message
                        }`
                      );
                    }
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
            (errorMessages as any)[joinResult.toString()] ||
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
              (reinitError as any)?.message
            );
            throw new Error(
              `Complete failure - even reinit failed: ${errorMsg}`
            );
          }
        } // If we reach here, join was successful (result >= 0)
        console.log(
          "✅ Channel join initiated successfully with result:",
          joinResult
        );

        // 🔧 IMMEDIATE SUCCESS FEEDBACK: If join result is 0, start optimistic UI updates
        if (joinResult === 0) {
          console.log(
            "🎉 Join result is 0 (SUCCESS) - starting optimistic updates"
          );

          // Start optimistic state updates while waiting for event
          setTimeout(() => {
            setCallStatus("Đang hoàn tất kết nối...");

            // Give it a moment, then check if we should trigger success
            setTimeout(async () => {
              if (!isJoined) {
                try {
                  const state = _engine.getConnectionState
                    ? await _engine.getConnectionState()
                    : null;
                  console.log("🔍 Post-join state check:", state);
                  if (state === 3) {
                    console.log(
                      "✅ OPTIMISTIC SUCCESS: State is CONNECTED after successful join"
                    );
                    setIsLoading(false); // 🔧 CRITICAL: Stop loading state
                    setLocalUid(numericUid);
                    setIsJoined(true);
                    setCallStatus("Đã kết nối");
                    clearTimeout(joinTimeout);
                  }
                } catch (e) {
                  console.log(
                    "⚠️ Post-join state check failed:",
                    (e as any)?.message
                  );
                }
              }
            }, 3000); // Check after 3 seconds
          }, 500); // Initial status update after 500ms
        } // Wait for JoinChannelSuccess event with timeout
        const joinTimeout = setTimeout(() => {
          if (!isJoined) {
            console.error(
              "❌ Join timeout - no JoinChannelSuccess event received"
            );

            // 🔧 BACKUP SUCCESS DETECTION: Check if we're actually connected
            console.log("🔍 BACKUP: Checking actual connection state...");

            setTimeout(async () => {
              try {
                // Check if engine thinks we're connected
                const currentState = _engine.getConnectionState
                  ? await _engine.getConnectionState()
                  : null;
                console.log("🔍 Current connection state:", currentState); // Connection state 3 = CONNECTED
                if (currentState === 3) {
                  console.log(
                    "✅ BACKUP SUCCESS: Engine reports CONNECTED state!"
                  );
                  console.log(
                    "🎉 Manually triggering success - JoinChannelSuccess event was missed"
                  );

                  // Manually trigger the success logic
                  setIsLoading(false); // 🔧 CRITICAL: Stop loading state
                  setLocalUid(numericUid);
                  setIsJoined(true);
                  setCallStatus("Đã kết nối");
                }

                // If still not connected, show the timeout error
                setCallStatus("Timeout kết nối");
                Alert.alert(
                  "Timeout kết nối",
                  "Cuộc gọi đã được khởi tạo thành công nhưng sự kiện JoinChannelSuccess không được nhận sau 15 giây.\n\nĐiều này có thể do:\n• Mạng chậm\n• Sự kiện SDK bị trễ\n• Vấn đề với kênh\n\nThử lại hoặc kiểm tra kết nối mạng.",
                  [
                    { text: "Quay lại", onPress: () => router.back() },
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
                          console.error(
                            "❌ Token refresh failed:",
                            refreshError
                          );
                          Alert.alert(
                            "Lỗi",
                            "Không thể lấy token mới. Vui lòng thử lại sau.",
                            [{ text: "Quay lại", onPress: () => router.back() }]
                          );
                        }
                      },
                    },
                    {
                      text: "Force Join",
                      onPress: () => {
                        console.log(
                          "🔧 FORCE JOIN: User manually triggering success"
                        );
                        setIsLoading(false); // 🔧 CRITICAL: Stop loading state
                        setLocalUid(numericUid);
                        setIsJoined(true);
                        setCallStatus("Đã kết nối (thủ công)");
                      },
                    },
                  ]
                );
              } catch (checkError) {
                console.error(
                  "❌ Backup check failed:",
                  (checkError as any)?.message
                );

                // Fallback to original timeout handling
                setCallStatus("Timeout kết nối");
                Alert.alert(
                  "Timeout kết nối",
                  "Không thể tham gia kênh Agora sau thời gian chờ. Có thể do:\n• Token từ server không hợp lệ\n• Kênh chưa được tạo\n• Vấn đề mạng",
                  [
                    { text: "Quay lại", onPress: () => router.back() },
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
              }
            }, 0);
          }
        }, 15000); // Increased timeout to 15 seconds

        // Clear timeout when join succeeds
        const cleanupJoinListener = () => {
          clearTimeout(joinTimeout);
        }; // Store cleanup function for later use
        (_engine as any)._joinTimeoutCleanup = cleanupJoinListener;

        // 🔧 PROACTIVE SUCCESS MONITORING: Check connection state periodically
        console.log("🔄 Starting proactive connection monitoring...");
        const connectionMonitor = setInterval(async () => {
          if (isJoined) {
            clearInterval(connectionMonitor);
            return;
          }

          try {
            const currentState = _engine.getConnectionState
              ? await _engine.getConnectionState()
              : null;
            console.log("🔍 Connection monitor - state:", currentState);

            // State 3 = CONNECTED
            if (currentState === 3) {
              console.log(
                "✅ PROACTIVE SUCCESS: Connection state changed to CONNECTED!"
              );
              clearInterval(connectionMonitor);
              clearTimeout(joinTimeout); // Trigger success manually since event might be delayed
              setTimeout(() => {
                if (!isJoined) {
                  console.log(
                    "🎉 Manually triggering success from connection monitor"
                  );
                  setIsLoading(false); // 🔧 CRITICAL: Stop loading state
                  setLocalUid(numericUid);
                  setIsJoined(true);
                  setCallStatus("Đã kết nối");
                }
              }, 0);
            }
          } catch (monitorError) {
            console.log(
              "⚠️ Connection monitor error:",
              (monitorError as any)?.message
            );
          }
        }, 2000); // Check every 2 seconds

        // Clean up monitor after timeout
        setTimeout(() => {
          clearInterval(connectionMonitor);
        }, 16000);
      } catch (e: any) {
        console.error("❌ Join channel failed:", e.message);
        console.error("❌ Join channel error details:", e);

        // Log additional debug info
        console.log("🔍 FULL DEBUG INFO:");
        console.log("   Token:", callInfo.patientToken);
        console.log("   Token length:", callInfo.patientToken?.length);
        console.log("   Channel:", callInfo.channelName);
        console.log("   UID:", numericUid);
        console.log("   App ID:", callInfo.agoraAppId); // Check if this is a persistent Agora issue
        const isPersistentAgoraIssue =
          e.message?.includes("All join methods failed") ||
          e.message?.includes("ERR_INVALID_ARGUMENT") ||
          e.message?.includes("ERR_NOT_READY") ||
          (e.message?.includes("Method") &&
            e.message?.includes("failed with code:"));

        if (isPersistentAgoraIssue) {
          console.error(
            "❌ Persistent Agora SDK issues detected - showing error to user"
          );

          // Use setTimeout to avoid setState during render
          setTimeout(() => {
            setIsLoading(false);
            Alert.alert(
              "Lỗi Agora SDK",
              "Không thể kết nối với Agora SDK sau nhiều lần thử. Có thể do:\n• Cấu hình SDK không đúng\n• Token không hợp lệ\n• Sự cố mạng\n\nVui lòng thử lại sau hoặc liên hệ hỗ trợ.",
              [
                { text: "Quay lại", onPress: () => router.back() },
                {
                  text: "Thử lại",
                  onPress: () => {
                    // Retry initialization
                    if (appointmentId) {
                      initializeAppointmentCall(appointmentId as string);
                    } else if (callId) {
                      initializeChatCall(callId as string);
                    }
                  },
                },
              ]
            );
          }, 0);
          return;
        } // For other errors, show manual options
        const errorMessage = e.message || "Unknown error occurred";
        const shouldRetry = !isPersistentAgoraIssue; // Use setTimeout to avoid setState during render
        setTimeout(() => {
          Alert.alert("Lỗi tham gia kênh", errorMessage, [
            { text: "Quay lại", onPress: () => router.back() },
            ...(shouldRetry && appointmentId
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
                        Alert.alert(
                          "Lỗi",
                          "Không thể lấy token mới. Vui lòng thử lại sau.",
                          [{ text: "Quay lại", onPress: () => router.back() }]
                        );
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
    } catch (error: any) {
      console.error("Error initializing Agora with API data:", error);
      Alert.alert("Lỗi Agora", `Không thể khởi tạo Agora: ${error.message}`, [
        {
          text: "Thử lại",
          onPress: () => initAgoraWithApiData(callData),
        },
        {
          text: "Quay lại",
          onPress: () => router.back(),
        },
      ]);
    }
  }; // Enhanced Agora initialization with retry logic
  const initAgoraWithApiDataEnhanced = async (callInfo: any) => {
    try {
      console.log("🚀 Starting enhanced Agora initialization with retry...");

      // Validate token first
      const isTokenValid = await validateTokenBeforeJoin(callInfo);
      if (!isTokenValid) {
        throw new Error("Token validation failed");
      }

      // Try the original method first
      await initAgoraWithApiData(callInfo);
    } catch (error) {
      console.error("❌ Standard init failed, trying token refresh:", error);

      // If standard method fails, try refreshing token
      try {
        console.log("🔄 Attempting token refresh...");

        const refreshResponse = await userService.joinCall(
          callInfo.appointmentId || callInfo.callId
        );

        if (refreshResponse.success) {
          console.log("✅ New token received, retrying...");

          // Update callInfo with new token
          const refreshedCallInfo = {
            ...callInfo,
            patientToken:
              refreshResponse.data.patientToken ||
              (refreshResponse.data as any).token,
            patientUid:
              refreshResponse.data.patientUid ||
              (refreshResponse.data as any).uid,
            channelName: refreshResponse.data.channelName,
          };

          // Validate new token
          const isNewTokenValid = await validateTokenBeforeJoin(
            refreshedCallInfo
          );
          if (!isNewTokenValid) {
            throw new Error("Refreshed token is also invalid");
          }

          // Retry with new token
          await initAgoraWithApiData(refreshedCallInfo);
        } else {
          throw new Error("Token refresh failed");
        }
      } catch (refreshError) {
        console.error("❌ Token refresh also failed:", refreshError);
        setIsLoading(false);

        Alert.alert(
          "Lỗi kết nối nghiêm trọng",
          `Không thể tham gia cuộc gọi sau nhiều lần thử. Vấn đề có thể là:\n\n• Token đã hết hạn\n• Server đang bận\n• Kết nối mạng không ổn định\n\nVui lòng thử lại sau ít phút.`,
          [
            {
              text: "Thử lại",
              onPress: () => {
                setIsLoading(true);
                initAgoraWithApiDataEnhanced(callInfo);
              },
            },
            {
              text: "Quay lại",
              onPress: () => router.back(),
            },
          ]
        );
      }
    }
  };

  const startDemoMode = () => {
    console.log("Starting demo mode");

    // Wrap all state updates in setTimeout to avoid setState during render
    setTimeout(() => {
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
    }, 0);
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
              } // End call on backend if we have callData
              if (callData?.callId) {
                await callService.endCall(callData.callId);
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

  // Check if Agora token is expired
  const isTokenExpired = (token: string): boolean => {
    try {
      // Agora token format: appId + signature + encoded data
      // For now, we'll use a simple heuristic - tokens older than 24h might be expired
      const tokenTimestamp = Date.now(); // We don't have exact creation time
      // This is a placeholder - in real apps, you'd decode the token or check with server
      return false; // For now, assume token is valid
    } catch (error) {
      console.warn("Token validation failed:", error);
      return true; // If we can't validate, assume expired
    }
  };

  // Enhanced token validation
  const validateTokenBeforeJoin = async (callInfo: any): Promise<boolean> => {
    try {
      console.log("🔍 Validating token before join...");

      if (!callInfo.patientToken) {
        console.error("❌ No token provided");
        return false;
      }

      if (callInfo.patientToken.length < 100) {
        console.error("❌ Token too short, likely invalid");
        return false;
      }

      // Check token format
      if (
        !callInfo.patientToken.startsWith(callInfo.agoraAppId.substring(0, 8))
      ) {
        console.warn("⚠️ Token format might be incorrect");
        // Still proceed, but log warning
      }

      console.log("✅ Token passed basic validation");
      return true;
    } catch (error) {
      console.error("❌ Token validation error:", error);
      return false;
    }
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

  // Add camera debug function
  const testCameraPreview = async () => {
    if (!engine || !AGORA_AVAILABLE) {
      Alert.alert("Debug", "Engine not available");
      return;
    }

    try {
      console.log("🎥 Testing camera preview...");

      // Stop current preview
      if (engine.stopPreview) {
        await engine.stopPreview();
      }

      // Restart preview
      await engine.enableLocalVideo(true);
      if (engine.startPreview) {
        await engine.startPreview();
      }

      Alert.alert("Debug", "Camera preview restarted");
    } catch (error) {
      Alert.alert(
        "Debug Error",
        `Camera test failed: ${(error as any)?.message}`
      );
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
Camera On: ${isCameraOn}

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
      { text: "Test Camera", onPress: testCameraPreview },
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

  // Return component JSX
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: isJoined ? "Đang gọi..." : "Đang kết nối...",
          headerShown: false,
        }}
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Đang khởi tạo cuộc gọi...</Text>
        </View>
      ) : (
        <>
          {/* Video call interface */}
          <View style={styles.videoContainer}>
            {/* Remote video view */}
            <View style={styles.remoteVideoContainer}>
              {remoteUsers.length > 0 && AGORA_AVAILABLE && RtcRemoteView ? (
                <RtcRemoteView.SurfaceView
                  style={styles.remoteVideo}
                  uid={remoteUsers[0]}
                  channelId={callData?.channelName || ""}
                  renderMode={VideoRenderMode?.Hidden || 1}
                  zOrderMediaOverlay={false}
                />
              ) : (
                <View style={styles.placeholderVideo}>
                  <Ionicons name="person" size={80} color="#666" />
                  <Text style={styles.placeholderText}>{callStatus}</Text>
                </View>
              )}
            </View>{" "}
            {/* Local video view - Always show when camera is on */}
            <View style={styles.localVideoContainer}>
              {engine && isCameraOn && AGORA_AVAILABLE && RtcLocalView ? (
                <RtcLocalView.SurfaceView
                  style={styles.localVideo}
                  channelId={callData?.channelName || ""}
                  renderMode={VideoRenderMode?.Hidden || 1}
                  zOrderOnTop={true}
                  zOrderMediaOverlay={true}
                />
              ) : (
                <View style={styles.localVideoPlaceholder}>
                  <Ionicons
                    name={isCameraOn ? "videocam" : "videocam-off"}
                    size={24}
                    color={isCameraOn ? "#00A86B" : "#666"}
                  />
                  <Text style={styles.localVideoPlaceholderText}>
                    {isCameraOn ? "Camera đang khởi động..." : "Camera tắt"}
                  </Text>
                </View>
              )}
            </View>
          </View>
          {/* Call controls */}
          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={[
                styles.controlButton,
                isMuted && styles.controlButtonActive,
              ]}
              onPress={() => {
                setIsMuted(!isMuted);
                engine?.muteLocalAudioStream(!isMuted);
              }}
            >
              <Ionicons
                name={isMuted ? "mic-off" : "mic"}
                size={24}
                color="#fff"
              />
            </TouchableOpacity>{" "}
            <TouchableOpacity
              style={[
                styles.controlButton,
                !isCameraOn && styles.controlButtonActive,
              ]}
              onPress={async () => {
                const newCameraState = !isCameraOn;
                setIsCameraOn(newCameraState);

                if (engine && AGORA_AVAILABLE) {
                  try {
                    if (newCameraState) {
                      // Turn camera on
                      await engine.enableLocalVideo(true);
                      if (engine.startPreview) {
                        await engine.startPreview();
                      }
                      console.log("✅ Camera turned ON");
                    } else {
                      // Turn camera off
                      await engine.enableLocalVideo(false);
                      if (engine.stopPreview) {
                        await engine.stopPreview();
                      }
                      console.log("✅ Camera turned OFF");
                    }
                  } catch (error) {
                    console.warn(
                      "Camera toggle failed:",
                      (error as any)?.message
                    );
                  }
                } else {
                  console.log("Camera toggled in demo mode:", newCameraState);
                }
              }}
            >
              <Ionicons
                name={isCameraOn ? "videocam" : "videocam-off"}
                size={24}
                color="#fff"
              />{" "}
            </TouchableOpacity>
            {/* PiP Button */}
            <TouchableOpacity
              style={[
                styles.controlButton,
                isPiPMode && styles.controlButtonActive,
              ]}
              onPress={async () => {
                if (!isPiPMode) {
                  await callServiceHook.enablePiP();
                  setIsPiPMode(true);
                  setIsMinimized(true);

                  // Show PiP overlay
                  Alert.alert(
                    "Picture-in-Picture",
                    "Cuộc gọi sẽ tiếp tục ở chế độ PiP. Bạn có thể sử dụng các app khác.",
                    [{ text: "OK", onPress: () => router.back() }]
                  );
                } else {
                  await callServiceHook.disablePiP();
                  setIsPiPMode(false);
                  setIsMinimized(false);
                }
              }}
            >
              <Ionicons name="contract" size={24} color="#fff" />
            </TouchableOpacity>
            {/* Minimize Button */}
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => {
                console.log("Minimizing call - session preserved");
                setIsMinimized(true);

                // Save call state for background
                if (callData) {
                  callServiceHook.saveCallState({
                    ...callData,
                    startTime: Date.now() - callDuration * 1000,
                  });
                }

                // Just navigate back without ending the session
                router.back();
              }}
            >
              <Ionicons name="remove" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlButton, styles.endCallButton]}
              onPress={handleEndCall}
            >
              <Ionicons name="call" size={24} color="#fff" />
            </TouchableOpacity>
          </View>{" "}
          {/* Call duration and debug */}
          <View style={styles.durationContainer}>
            <TouchableOpacity onPress={showConnectionDebug}>
              <Text style={styles.durationText}>
                {Math.floor(callDuration / 60)
                  .toString()
                  .padStart(2, "0")}
                :{(callDuration % 60).toString().padStart(2, "0")}
              </Text>
              <Text
                style={[styles.durationText, { fontSize: 10, opacity: 0.7 }]}
              >
                DEBUG
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

// Add missing styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContent: {
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    color: "#fff",
    fontSize: 18,
    marginTop: 20,
    textAlign: "center",
  },
  loadingSubText: {
    color: "#ccc",
    fontSize: 14,
    marginTop: 10,
    textAlign: "center",
  },
  videoContainer: {
    flex: 1,
    position: "relative",
  },
  remoteVideoContainer: {
    flex: 1,
  },
  remoteVideo: {
    flex: 1,
  },
  placeholderVideo: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#333",
  },
  placeholderText: {
    color: "#fff",
    marginTop: 10,
    fontSize: 16,
  },
  localVideoContainer: {
    position: "absolute",
    top: 80,
    right: 20,
    width: 130,
    height: 170,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
    borderWidth: 2,
    borderColor: "#00A86B",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },
  localVideo: {
    flex: 1,
  },
  localVideoPlaceholder: {
    flex: 1,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#555",
  },
  localVideoPlaceholderText: {
    color: "#fff",
    fontSize: 10,
    marginTop: 4,
    textAlign: "center",
  },
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 15,
  },
  controlButtonActive: {
    backgroundColor: "#ff4444",
  },
  endCallButton: {
    backgroundColor: "#ff4444",
  },
  durationContainer: {
    position: "absolute",
    top: 60,
    left: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  durationText: {
    color: "#fff",
    fontSize: 14,
  },
});
