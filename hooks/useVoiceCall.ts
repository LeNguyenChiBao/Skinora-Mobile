import callService from "@/services/call.service";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

interface UseVoiceCallOptions {
  doctorId?: string;
  doctorName?: string;
  doctorAvatar?: string;
  roomId?: string;
}

export const useVoiceCall = (options: UseVoiceCallOptions = {}) => {
  const [isInitiating, setIsInitiating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const router = useRouter();

  const initializeVoiceCall = useCallback(
    async (doctorId?: string) => {
      try {
        setIsInitiating(true);

        const targetDoctorId = doctorId || options.doctorId;
        if (!targetDoctorId) {
          throw new Error("Doctor ID is required");
        }

        console.log("📞 Initializing voice call to doctor:", targetDoctorId);

        // Connect to call service
        await callService.connectCallService();

        // Initiate voice call
        const callId = await callService.initiateVoiceCall(targetDoctorId);

        console.log("✅ Voice call initiated with ID:", callId);

        // Navigate to video call screen with voice call parameters
        router.push({
          pathname: "/(stacks)/video-call",
          params: {
            callId,
            callType: "voice",
            isInitiator: "true",
            otherParticipantName: options.doctorName || "Bác sĩ",
            otherParticipantAvatar: options.doctorAvatar || "",
            doctorId: targetDoctorId,
          },
        });

        return callId;
      } catch (error: any) {
        console.error("❌ Error initializing voice call:", error);
        Alert.alert(
          "Lỗi cuộc gọi",
          `Không thể thực hiện cuộc gọi: ${error?.message || "Unknown error"}`,
          [{ text: "OK" }]
        );
        throw error;
      } finally {
        setIsInitiating(false);
      }
    },
    [options.doctorId, options.doctorName, options.doctorAvatar, router]
  );

  const initializeVideoCall = useCallback(
    async (doctorId?: string) => {
      try {
        setIsInitiating(true);

        const targetDoctorId = doctorId || options.doctorId;
        if (!targetDoctorId) {
          throw new Error("Doctor ID is required");
        }

        console.log("📞 Initializing video call to doctor:", targetDoctorId);

        // Connect to call service
        await callService.connectCallService();

        // Initiate video call
        const callId = await callService.initiateVideoCall(targetDoctorId);

        console.log("✅ Video call initiated with ID:", callId);

        // Navigate to video call screen with video call parameters
        router.push({
          pathname: "/(stacks)/video-call",
          params: {
            callId,
            callType: "video",
            isInitiator: "true",
            otherParticipantName: options.doctorName || "Bác sĩ",
            otherParticipantAvatar: options.doctorAvatar || "",
            doctorId: targetDoctorId,
          },
        });

        return callId;
      } catch (error: any) {
        console.error("❌ Error initializing video call:", error);
        Alert.alert(
          "Lỗi cuộc gọi",
          `Không thể thực hiện cuộc gọi: ${error?.message || "Unknown error"}`,
          [{ text: "OK" }]
        );
        throw error;
      } finally {
        setIsInitiating(false);
      }
    },
    [options.doctorId, options.doctorName, options.doctorAvatar, router]
  );

  const acceptIncomingCall = useCallback(
    async (callId: string) => {
      try {
        setIsConnecting(true);

        console.log("✅ Accepting incoming call:", callId);

        // Accept the call
        const callDetails = await callService.acceptCall(callId);

        console.log("✅ Call accepted, details:", callDetails);

        // Navigate to video call screen
        router.push({
          pathname: "/(stacks)/video-call",
          params: {
            callId,
            callType: "voice", // Default to voice, can be overridden
            isInitiator: "false",
            isJoining: "true",
          },
        });

        return callDetails;
      } catch (error: any) {
        console.error("❌ Error accepting call:", error);
        Alert.alert(
          "Lỗi cuộc gọi",
          `Không thể chấp nhận cuộc gọi: ${error?.message || "Unknown error"}`,
          [{ text: "OK" }]
        );
        throw error;
      } finally {
        setIsConnecting(false);
      }
    },
    [router]
  );

  const declineIncomingCall = useCallback(async (callId: string) => {
    try {
      console.log("❌ Declining incoming call:", callId);

      await callService.declineCall(callId);

      console.log("✅ Call declined successfully");
    } catch (error: any) {
      console.error("❌ Error declining call:", error);
      Alert.alert(
        "Lỗi",
        `Không thể từ chối cuộc gọi: ${error?.message || "Unknown error"}`,
        [{ text: "OK" }]
      );
      throw error;
    }
  }, []);

  const endCall = useCallback(async (callId: string) => {
    try {
      console.log("📞 Ending call:", callId);

      await callService.endCall(callId);

      console.log("✅ Call ended successfully");
    } catch (error: any) {
      console.error("❌ Error ending call:", error);
      Alert.alert(
        "Lỗi",
        `Không thể kết thúc cuộc gọi: ${error?.message || "Unknown error"}`,
        [{ text: "OK" }]
      );
      throw error;
    }
  }, []);

  const getCallDetails = useCallback(async (callId: string) => {
    try {
      console.log("📋 Getting call details:", callId);

      const details = await callService.getCallDetails(callId);

      console.log("✅ Call details retrieved:", details);
      return details;
    } catch (error: any) {
      console.error("❌ Error getting call details:", error);
      throw error;
    }
  }, []);

  return {
    isInitiating,
    isConnecting,
    initializeVoiceCall,
    initializeVideoCall,
    acceptIncomingCall,
    declineIncomingCall,
    endCall,
    getCallDetails,
  };
};
