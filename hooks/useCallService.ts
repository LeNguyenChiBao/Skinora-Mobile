import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  AppStateStatus,
  PermissionsAndroid,
  Platform,
} from "react-native";
import { io, Socket } from "socket.io-client";

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
  RtcEngine = agora.createAgoraRtcEngine || agora.RtcEngine;
  RtcLocalView = agora.RtcLocalView;
  RtcRemoteView = agora.RtcRemoteView;
  VideoRenderMode = agora.VideoRenderMode;
  ChannelProfile = agora.ChannelProfile;
  ClientRole = agora.ClientRole;
  AGORA_AVAILABLE = true;
} catch (error) {
  console.warn("Agora SDK not available:", error);
}

// Call persistence keys
const CALL_STATE_KEY = "@call_state";
const ACTIVE_CALL_KEY = "@active_call_data";

interface CallData {
  callId: string;
  agoraAppId: string;
  token: string;
  channelName: string;
  uid: number;
  userRole: string;
  startTime?: number;
  appointmentId?: string;
  otherParticipant?: {
    _id: string;
    fullName: string;
    photoUrl?: string;
    role: string;
  };
}

export const useCallService = () => {
  const [engine, setEngine] = useState<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [callData, setCallData] = useState<CallData | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<number[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState("Disconnected");
  const [localUid, setLocalUid] = useState<number | null>(null);
  const [isInBackground, setIsInBackground] = useState(false);
  const [isPiPEnabled, setIsPiPEnabled] = useState(false);

  const engineRef = useRef<any>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const BASE_URL =
    process.env.EXPO_PUBLIC_API_BASE_URL || "http://192.168.1.4:3000";

  // Initialize Agora Engine
  const initAgoraEngine = async (appId: string) => {
    if (!AGORA_AVAILABLE) {
      throw new Error("Agora SDK not available");
    }
    try {
      if (engineRef.current) {
        console.log("🧹 Destroying existing engine...");
        await engineRef.current.destroy();
        engineRef.current = null;
      }

      console.log("🚀 Creating Agora RTC engine with App ID:", appId);

      let engine;
      if (RtcEngine.createAgoraRtcEngine) {
        // For SDK 4.x+, use the new creation method
        engine = RtcEngine.createAgoraRtcEngine();
        console.log("✅ Engine created using createAgoraRtcEngine()");
      } else if (RtcEngine.create) {
        engine = await RtcEngine.create(appId);
        console.log("✅ Engine created using RtcEngine.create()");
      } else if (typeof RtcEngine === "function") {
        engine = await RtcEngine(appId);
        console.log("✅ Engine created using RtcEngine() function");
      } else {
        throw new Error(
          "Unable to create RTC engine - no valid creation method found"
        );
      }

      if (!engine) {
        throw new Error("Engine creation returned null/undefined");
      } // For SDK 4.x+, initialize the engine with proper configuration
      if (typeof engine.initialize === "function") {
        console.log("🔧 Initializing engine with SDK 4.x+ configuration...");

        const initConfig = {
          appId: appId,
          // Required configuration for SDK 4.x+
          channelProfile: 1, // Communication mode
          audioScenario: 0, // Default audio scenario
        };

        try {
          const initResult = await engine.initialize(initConfig);
          console.log("✅ Engine.initialize() result:", initResult);

          // Check if initialization succeeded (0 = success, anything else = error)
          if (initResult !== 0) {
            console.warn(
              "⚠️ Engine.initialize() returned error code:",
              initResult
            );
            throw new Error(
              `Engine initialization failed with code: ${initResult}`
            );
          }

          console.log("✅ Engine properly initialized with SDK 4.x+ config");
        } catch (initError) {
          console.error("❌ Engine.initialize() failed:", initError);
          throw new Error(
            `Engine initialization failed: ${(initError as any)?.message}`
          );
        }
      } else {
        console.log(
          "ℹ️ Engine.initialize() not available - using older SDK version"
        );
      }

      engineRef.current = engine;
      setEngine(engine);

      console.log("🎵 Enabling audio...");
      await engine.enableAudio();

      console.log("📹 Enabling video...");
      await engine.enableVideo();

      // Set channel profile and client role
      console.log("📺 Setting channel profile to Communication...");
      if (ChannelProfile && engine.setChannelProfile) {
        await engine.setChannelProfile(ChannelProfile.Communication || 1);
      } else {
        await engine.setChannelProfile(1); // 1 = Communication
      }

      console.log("🎬 Setting client role to Broadcaster...");
      if (ClientRole && engine.setClientRole) {
        await engine.setClientRole(ClientRole.Broadcaster || 1);
      } else {
        await engine.setClientRole(1); // 1 = Broadcaster
      }

      // Event listeners
      engine.addListener?.("Warning", (warn: any) => {
        console.log("Agora Warning:", warn);
      });

      engine.addListener?.("Error", (err: any) => {
        console.log("Agora Error:", err);
        setError(`Agora Error: ${err}`);
      });

      engine.addListener?.("UserJoined", (uid: number, elapsed: number) => {
        console.log("🎉 UserJoined:", uid, elapsed);
        setRemoteUsers((users) => {
          if (!users.includes(uid)) {
            return [...users, uid];
          }
          return users;
        });
      });

      engine.addListener?.("UserOffline", (uid: number, reason: any) => {
        console.log("👋 UserOffline:", uid, reason);
        setRemoteUsers((users) => users.filter((user) => user !== uid));
      });

      engine.addListener?.(
        "JoinChannelSuccess",
        (channel: string, uid: number, elapsed: number) => {
          console.log("✅ JoinChannelSuccess:", channel, uid, elapsed);
          setLocalUid(uid);
          setIsInCall(true);
          setCallStatus("Connected");
        }
      );

      engine.addListener?.("LeaveChannel", (stats: any) => {
        console.log("📤 LeaveChannel:", stats);
        setIsInCall(false);
        setRemoteUsers([]);
        setCallStatus("Disconnected");
      });

      engine.addListener?.(
        "ConnectionStateChanged",
        (state: number, reason: number) => {
          console.log("🔗 Connection State Changed:", state, reason);
          switch (state) {
            case 1:
              setCallStatus("Disconnected");
              break;
            case 2:
              setCallStatus("Connecting...");
              break;
            case 3:
              setCallStatus("Connected");
              break;
            case 4:
              setCallStatus("Reconnecting...");
              break;
            case 5:
              setCallStatus("Connection Failed");
              break;
          }
        }
      );

      return engine;
    } catch (error) {
      console.error("Failed to initialize Agora engine:", error);
      setError(`Failed to initialize video engine: ${(error as any)?.message}`);
      throw error;
    }
  };

  // Initialize WebSocket
  const initWebSocket = async () => {
    try {
      const token = await AsyncStorage.getItem("jwt_token");
      if (!token) {
        throw new Error("No JWT token found");
      }

      const socketInstance = io(`${BASE_URL}/call`, {
        auth: { token: token.replace("Bearer ", "") },
        transports: ["websocket", "polling"],
        forceNew: true,
      });

      socketInstance.on("connect", () => {
        console.log("✅ Connected to WebSocket /call namespace");
        setIsConnected(true);
        setError(null);
      });

      socketInstance.on("disconnect", () => {
        console.log("❌ Disconnected from WebSocket");
        setIsConnected(false);
      });

      socketInstance.on("connection_ready", (data: any) => {
        console.log("📞 Call service ready:", data);
      });

      socketInstance.on("connection_error", (error: any) => {
        console.error("❌ WebSocket connection error:", error);
        setError(`Connection failed: ${error.message}`);
      });

      socketInstance.on("incoming_call", (data: any) => {
        console.log("📞 Incoming call:", data);
        handleIncomingCall(data);
      });

      socketInstance.on("participant_joined", (data: any) => {
        console.log("👥 Participant joined:", data);
      });

      socketInstance.on("call_ended", (data: any) => {
        console.log("📞 Call ended:", data);
        leaveCall();
      });

      setSocket(socketInstance);
      return socketInstance;
    } catch (error) {
      console.error("WebSocket initialization failed:", error);
      setError(`WebSocket failed: ${(error as any)?.message}`);
      throw error;
    }
  };

  // Request permissions
  const requestPermissions = async () => {
    if (Platform.OS === "android") {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.CAMERA,
        ]);

        const audioGranted =
          grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
          PermissionsAndroid.RESULTS.GRANTED;
        const cameraGranted =
          grants[PermissionsAndroid.PERMISSIONS.CAMERA] ===
          PermissionsAndroid.RESULTS.GRANTED;

        if (audioGranted && cameraGranted) {
          console.log("✅ Permissions granted");
          return true;
        } else {
          console.log("❌ Permissions denied");
          Alert.alert(
            "Permissions Required",
            "Camera and microphone permissions are required for video calls.",
            [{ text: "OK" }]
          );
          return false;
        }
      } catch (err) {
        console.warn("Permission error:", err);
        return false;
      }
    }
    return true;
  };

  // Initiate call
  const initiateCall = async (targetUserId: string) => {
    try {
      const token = await AsyncStorage.getItem("jwt_token");
      const response = await fetch(`${BASE_URL}/call/initiate`, {
        method: "POST",
        headers: {
          Authorization: token || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetUserId,
          device: "mobile",
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to initiate call");
      }

      console.log("📞 Call initiated:", result.data);
      return result.data;
    } catch (error) {
      console.error("Failed to initiate call:", error);
      setError(`Failed to initiate call: ${(error as any)?.message}`);
      throw error;
    }
  };

  // Join call
  const joinCall = async (callId: string) => {
    try {
      // Request permissions first
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        throw new Error("Permissions required for video call");
      }

      const token = await AsyncStorage.getItem("jwt_token");
      const response = await fetch(`${BASE_URL}/call/${callId}/join`, {
        method: "POST",
        headers: {
          Authorization: token || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device: "mobile",
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to join call");
      }

      const callInfo = result.data;
      setCallData(callInfo);

      // Initialize Agora if not already done
      let agoraEngine = engine;
      if (!agoraEngine) {
        agoraEngine = await initAgoraEngine(callInfo.agoraAppId);
      }

      // Join Agora channel
      const joinResult = await agoraEngine.joinChannel(
        callInfo.token,
        callInfo.channelName,
        null,
        callInfo.uid
      );

      console.log(
        "✅ Successfully joined call:",
        callInfo,
        "Join result:",
        joinResult
      );
      return callInfo;
    } catch (error) {
      console.error("Failed to join call:", error);
      setError(`Failed to join call: ${(error as any)?.message}`);
      throw error;
    }
  };

  // Leave call
  const leaveCall = async () => {
    try {
      if (engineRef.current) {
        await engineRef.current.leaveChannel();
      }
      setIsInCall(false);
      setCallData(null);
      setRemoteUsers([]);
      setLocalUid(null);
      setCallStatus("Disconnected");
      setError(null);
    } catch (error) {
      console.error("Failed to leave call:", error);
    }
  };

  // Save call state to AsyncStorage
  const saveCallState = async (callData: CallData) => {
    try {
      await AsyncStorage.setItem(
        ACTIVE_CALL_KEY,
        JSON.stringify({
          ...callData,
          startTime: Date.now(),
          isInCall: true,
        })
      );
      await AsyncStorage.setItem(CALL_STATE_KEY, "active");
      console.log("📱 Call state saved for background recovery");
    } catch (error) {
      console.error("Failed to save call state:", error);
    }
  };

  // Restore call state from AsyncStorage
  const restoreCallState = async (): Promise<CallData | null> => {
    try {
      const callStateStr = await AsyncStorage.getItem(ACTIVE_CALL_KEY);
      const isCallActive = await AsyncStorage.getItem(CALL_STATE_KEY);

      if (callStateStr && isCallActive === "active") {
        const savedCallData = JSON.parse(callStateStr);
        console.log("📱 Found saved call state:", savedCallData);
        return savedCallData;
      }
    } catch (error) {
      console.error("Failed to restore call state:", error);
    }
    return null;
  };

  // Clear call state when call ends
  const clearCallState = async () => {
    try {
      await AsyncStorage.removeItem(ACTIVE_CALL_KEY);
      await AsyncStorage.removeItem(CALL_STATE_KEY);
      console.log("📱 Call state cleared");
    } catch (error) {
      console.error("Failed to clear call state:", error);
    }
  };

  // Check if call is still active on server
  const checkCallStatus = async (callId: string): Promise<boolean> => {
    try {
      const token = await AsyncStorage.getItem("jwt_token");
      if (!token) return false;

      const response = await fetch(`${BASE_URL}/call/${callId}/status`, {
        method: "GET",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const result = await response.json();
        return (
          result.success &&
          ["active", "connected", "ringing"].includes(result.data?.status)
        );
      }
      return false;
    } catch (error) {
      console.error("Failed to check call status:", error);
      return false;
    }
  };

  // Rejoin an existing call
  const rejoinCall = async (savedCallData: CallData) => {
    try {
      console.log("🔄 Rejoining call:", savedCallData.callId);

      // Initialize Agora engine if not already done
      if (!engine) {
        await initAgoraEngine(savedCallData.agoraAppId);
      }

      // Set call data
      setCallData(savedCallData);
      // Join the channel
      const result = await engineRef.current?.joinChannel(
        savedCallData.token,
        savedCallData.channelName,
        null,
        savedCallData.uid
      );

      if (result === 0) {
        setIsInCall(true);
        setCallStatus("Reconnected");
        console.log("✅ Successfully rejoined call");
      } else {
        throw new Error(`Failed to rejoin channel: ${result}`);
      }
    } catch (error) {
      console.error("❌ Failed to rejoin call:", error);
      await clearCallState();
      setError(`Failed to rejoin call: ${(error as any)?.message}`);
    }
  };

  // Enable Picture-in-Picture mode
  const enablePiP = async () => {
    try {
      if (Platform.OS === "android" && engine) {
        // For Android, we can use native PiP
        if (engine.enablePictureInPicture) {
          await engine.enablePictureInPicture(true);
          setIsPiPEnabled(true);
          console.log("✅ PiP enabled");
        } else {
          console.warn("PiP not supported by current Agora SDK");
        }
      } else if (Platform.OS === "ios") {
        // For iOS, we'll use a custom overlay approach
        setIsPiPEnabled(true);
        console.log("✅ iOS PiP mode enabled");
      }
    } catch (error) {
      console.error("Failed to enable PiP:", error);
    }
  };

  // Disable Picture-in-Picture mode
  const disablePiP = async () => {
    try {
      if (Platform.OS === "android" && engine) {
        if (engine.enablePictureInPicture) {
          await engine.enablePictureInPicture(false);
        }
      }
      setIsPiPEnabled(false);
      console.log("✅ PiP disabled");
    } catch (error) {
      console.error("Failed to disable PiP:", error);
    }
  };

  // Handle background video (keep video running in background)
  const handleBackgroundVideo = async (shouldEnable: boolean) => {
    try {
      if (engine && isInCall) {
        if (shouldEnable) {
          // Keep video running in background
          await engine.enableLocalVideo(true);
          await engine.muteLocalVideoStream(false);
          console.log("✅ Background video enabled");
        } else {
          // Optimize for background (audio only)
          await engine.muteLocalVideoStream(true);
          console.log("✅ Background video disabled (audio only)");
        }
      }
    } catch (error) {
      console.error("Failed to handle background video:", error);
    }
  };

  // Auto-handle background state
  useEffect(() => {
    if (isInBackground && isInCall) {
      // When app goes to background during call
      if (isPiPEnabled) {
        // Keep video if PiP is enabled
        handleBackgroundVideo(true);
      } else {
        // Switch to audio-only to save battery
        handleBackgroundVideo(false);
      }
    } else if (!isInBackground && isInCall) {
      // When app comes back to foreground
      handleBackgroundVideo(true);
    }
  }, [isInBackground, isInCall, isPiPEnabled]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (appStateRef.current === "active" && nextAppState === "background") {
        // App is going to background
        setIsInBackground(true);
        console.log("App going to background");

        // Save call state
        if (isInCall && callData) {
          await saveCallState(callData);
        }
      } else if (
        appStateRef.current === "background" &&
        nextAppState === "active"
      ) {
        // App has come to foreground
        setIsInBackground(false);
        console.log("App in foreground");

        // Restore call state
        const savedCallData = await restoreCallState();
        if (savedCallData) {
          // Check if call is still active on server
          const isActive = await checkCallStatus(savedCallData.callId);
          if (isActive) {
            // Rejoin the call
            rejoinCall(savedCallData);
          } else {
            clearCallState();
          }
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      subscription.remove();
    };
  }, [isInCall, callData]);

  // Handle incoming call
  const handleIncomingCall = (data: any) => {
    console.log("📞 Handling incoming call:", data);
    // This can be extended to show incoming call UI
    Alert.alert(
      "Incoming Call",
      `${data.patientInfo?.name || "Someone"} is calling you`,
      [
        { text: "Decline", style: "cancel" },
        { text: "Accept", onPress: () => acceptCall(data.callId) },
      ]
    );
  };

  // Accept incoming call
  const acceptCall = async (callId: string) => {
    try {
      const token = await AsyncStorage.getItem("jwt_token");
      if (!token) throw new Error("No auth token");

      const response = await fetch(`${BASE_URL}/call/${callId}/accept`, {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Join the call
          await joinCall(result.data);
        }
      }
    } catch (error) {
      console.error("Failed to accept call:", error);
    }
  };

  // Refresh token when join fails
  const refreshTokenAndRetry = async (
    callId: string,
    retryCount: number = 0
  ): Promise<CallData | null> => {
    if (retryCount >= 3) {
      console.error("❌ Max retry attempts reached for token refresh");
      return null;
    }

    try {
      console.log(`🔄 Refreshing token (attempt ${retryCount + 1}/3)...`);

      const token = await AsyncStorage.getItem("jwt_token");
      if (!token) throw new Error("No auth token");

      // Request new Agora token from server
      const response = await fetch(`${BASE_URL}/call/${callId}/refresh-token`, {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device: "mobile",
          reason: "join_failed",
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log("✅ New token received, retrying join...");
          return result.data;
        }
      }

      throw new Error("Failed to refresh token");
    } catch (error) {
      console.error("❌ Token refresh failed:", error);

      // If refresh fails, try rejoining the call entirely
      if (retryCount < 2) {
        console.log("🔄 Trying complete call rejoin...");
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2s
        return await refreshTokenAndRetry(callId, retryCount + 1);
      }

      return null;
    }
  };

  // Enhanced join with auto-retry
  const joinCallWithRetry = async (
    callData: CallData,
    retryCount: number = 0
  ): Promise<boolean> => {
    if (retryCount >= 3) {
      console.error("❌ Max join retry attempts reached");
      return false;
    }

    try {
      console.log(`🔄 Join attempt ${retryCount + 1}/3 with callData:`, {
        callId: callData.callId,
        channelName: callData.channelName,
        uid: callData.uid,
        tokenLength: callData.token?.length,
      });

      if (!engine) {
        await initAgoraEngine(callData.agoraAppId);
      }

      // Try to join with current token
      const result = await engineRef.current?.joinChannel(
        callData.token,
        callData.channelName,
        null,
        callData.uid
      );

      if (result === 0) {
        console.log("✅ Join successful");
        setIsInCall(true);
        setCallData(callData);
        setCallStatus("Connected");
        return true;
      } else {
        throw new Error(`Join failed with code: ${result}`);
      }
    } catch (error) {
      console.warn(
        `❌ Join attempt ${retryCount + 1} failed:`,
        (error as any)?.message
      );

      if (retryCount < 2) {
        // Try refreshing token
        const refreshedCallData = await refreshTokenAndRetry(
          callData.callId,
          0
        );

        if (refreshedCallData) {
          // Retry with new token
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return await joinCallWithRetry(refreshedCallData, retryCount + 1);
        }
      }

      return false;
    }
  };
  return {
    isInCall,
    callData,
    remoteUsers,
    isConnected,
    error,
    callStatus,
    localUid,
    isInBackground,
    isPiPEnabled,
    engine,
    socket,
    initAgoraEngine,
    initWebSocket,
    requestPermissions,
    initiateCall,
    joinCall,
    joinCallWithRetry,
    leaveCall,
    saveCallState,
    restoreCallState,
    clearCallState,
    checkCallStatus,
    rejoinCall,
    enablePiP,
    disablePiP,
    refreshTokenAndRetry,
  };
};
