import { notificationService } from "@/services/notification.service";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert } from "react-native";

interface CallData {
  appointmentId?: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callType: "video" | "audio";
  timestamp: string;
}

export const useNotifications = () => {
  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        await notificationService.initialize();

        // Set up notification callbacks
        notificationService.setCallbacks({
          onIncomingCall: handleIncomingCall,
          onCallStarted: handleCallStarted,
          onCallEnded: handleCallEnded,
          onMessageReceived: handleMessageReceived,
        });

        setIsInitialized(true);
      } catch (error) {
        console.error("Failed to initialize notifications:", error);
      }
    };

    initializeNotifications();

    // Cleanup on unmount
    return () => {
      notificationService.disconnect();
    };
  }, []);

  const handleIncomingCall = (data: CallData) => {
    if (data.appointmentId) {
      // Scheduled appointment call
      showScheduledCallModal(data);
    } else {
      // Instant call
      showInstantCallModal(data);
    }
  };

  const handleCallStarted = (data: CallData) => {
    Alert.alert(
      "Cuộc gọi video đã bắt đầu",
      `${data.callerName} đã bắt đầu cuộc gọi. Tham gia ngay?`,
      [
        { text: "Để sau", style: "cancel" },
        {
          text: "Tham gia",
          onPress: () => joinCall(data.appointmentId!),
        },
      ]
    );
  };

  const handleCallEnded = (data: any) => {
    console.log("Call ended:", data);
    // Handle call ended (e.g., navigate away from call screen)
  };

  const handleMessageReceived = (data: any) => {
    console.log("New message:", data);
    // Handle new message notification
  };

  const showScheduledCallModal = (data: CallData) => {
    Alert.alert(
      "📅 Cuộc hẹn đang bắt đầu",
      `Bác sĩ ${data.callerName} đang bắt đầu cuộc hẹn của bạn. Tham gia ngay?`,
      [
        { text: "Từ chối", style: "cancel" },
        {
          text: "Tham gia ngay",
          onPress: () => joinCall(data.appointmentId!),
        },
      ]
    );
  };

  const showInstantCallModal = (data: CallData) => {
    Alert.alert(
      "📞 Cuộc gọi đến",
      `${data.callerName} đang gọi ${
        data.callType === "video" ? "video" : "thoại"
      }`,
      [
        { text: "Từ chối", style: "cancel" },
        {
          text: "Trả lời",
          onPress: () => answerCall(data),
        },
      ]
    );
  };

  const joinCall = (appointmentId: string) => {
    router.push({
      pathname: "/(stacks)/video-call",
      params: { appointmentId },
    });
  };

  const answerCall = (data: CallData) => {
    if (data.appointmentId) {
      joinCall(data.appointmentId);
    } else {
      // Handle instant call
      router.push({
        pathname: "/(stacks)/video-call",
        params: {
          callerId: data.callerId,
          callerName: data.callerName,
        },
      });
    }
  };

  const startCall = (
    appointmentId: string,
    callType: "video" | "audio" = "video"
  ) => {
    notificationService.startCall(appointmentId, callType);
  };

  const endCall = (appointmentId: string) => {
    notificationService.endCall(appointmentId);
  };

  return {
    isInitialized,
    startCall,
    endCall,
    joinCall,
  };
};
