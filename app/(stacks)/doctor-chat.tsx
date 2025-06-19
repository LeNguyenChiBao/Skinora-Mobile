import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { ChatInput } from "@/components/chat/ChatInput";
import { MessageList } from "@/components/chat/MessageList";
import { useChat } from "@/hooks/useChat";
import { useVoiceCall } from "@/hooks/useVoiceCall";
import chatService from "@/services/chat.service";
import { CloudinaryService } from "@/services/cloudinaryService";

export default function DoctorChatScreen() {
  const router = useRouter();
  const { doctorId, doctorName, appointmentId, isInCall } =
    useLocalSearchParams();

  const [seenMessageIds, setSeenMessageIds] = useState<Set<string>>(new Set());
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Initialize voice call hook
  const {
    initializeVoiceCall,
    initializeVideoCall,
    isInitiating: isInitiatingCall,
  } = useVoiceCall({
    doctorId: doctorId as string,
    doctorName: doctorName as string,
  });

  const {
    messages,
    room,
    isConnected,
    currentUserId,
    isLoading,
    isSending,
    isTyping,
    onlineCount,
    initializeChat,
    sendMessage,
  } = useChat({
    doctorId: doctorId as string,
    doctorName: doctorName as string,
    appointmentId: appointmentId as string,
    onError: (error) => {
      Alert.alert("Lỗi Chat", error);
    },
  });

  useEffect(() => {
    initializeChat();
  }, []);

  const showAttachmentOptions = () => {
    Alert.alert("Gửi tệp", "Chọn loại tệp bạn muốn gửi:", [
      { text: "Hủy", style: "cancel" },
      {
        text: "📷 Chọn từ thư viện",
        onPress: handlePickImage,
        style: "default",
      },
      {
        text: "📸 Chụp ảnh",
        onPress: handleTakePhoto,
        style: "default",
      },
      { text: "📄 Tài liệu", onPress: () => {}, style: "default" },
    ]);
  };

  const handlePickImage = async () => {
    try {
      console.log("📸 [DoctorChat] Starting image picker...");

      if (!room?._id) {
        Alert.alert("Lỗi", "Không tìm thấy phòng chat");
        return;
      }

      setIsUploadingImage(true);

      // Use Cloudinary service to pick and upload
      const result = await CloudinaryService.pickAndUploadImage();

      if (!result.success) {
        console.error("❌ [DoctorChat] Image upload failed:", result.error);
        Alert.alert("Lỗi", result.error || "Không thể tải ảnh lên");
        return;
      }

      console.log("✅ [DoctorChat] Image uploaded successfully:", result.url);

      // Send message with fileUrl (not imageUrl)
      const messageData = {
        content: "📷 Hình ảnh y tế",
        messageType: "image" as const,
        attachments: [result.url!],
        fileUrl: result.url!, // Backend expects fileUrl for images
        fileName: "image.jpg",
      };

      await chatService.sendMessage(room._id, messageData);
      console.log("✅ [DoctorChat] Image message sent successfully");
    } catch (error) {
      console.error("❌ [DoctorChat] Error in handlePickImage:", error);
      Alert.alert("Lỗi", "Không thể gửi ảnh. Vui lòng thử lại.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      console.log("📷 [DoctorChat] Starting camera...");

      if (!room?._id) {
        Alert.alert("Lỗi", "Không tìm thấy phòng chat");
        return;
      }

      setIsUploadingImage(true);

      // Use Cloudinary service to take and upload photo
      const result = await CloudinaryService.takeAndUploadPhoto();

      if (!result.success) {
        console.error("❌ [DoctorChat] Photo upload failed:", result.error);
        Alert.alert("Lỗi", result.error || "Không thể tải ảnh lên");
        return;
      }

      console.log("✅ [DoctorChat] Photo uploaded successfully:", result.url);

      // Send message with fileUrl (not imageUrl)
      const messageData = {
        content: "📷 Hình ảnh y tế",
        messageType: "image" as const,
        attachments: [result.url!],
        fileUrl: result.url!, // Backend expects fileUrl for images
        fileName: "photo.jpg",
      };

      await chatService.sendMessage(room._id, messageData);
      console.log("✅ [DoctorChat] Photo message sent successfully");
    } catch (error) {
      console.error("❌ [DoctorChat] Error in handleTakePhoto:", error);
      Alert.alert("Lỗi", "Không thể gửi ảnh. Vui lòng thử lại.");
    } finally {
      setIsUploadingImage(false);
    }
  };
  const handleVoiceCall = async () => {
    if (!room) {
      Alert.alert("Lỗi", "Không tìm thấy phòng chat");
      return;
    }

    try {
      console.log("📞 Starting voice call...");

      // Get the doctor ID
      const doctorId = room.doctorId._id;
      console.log("📞 Voice calling to doctor:", doctorId);

      // Use the voice call hook
      await initializeVoiceCall(doctorId);
    } catch (error: any) {
      console.error("❌ Error starting voice call:", error);
      // Error is already handled in the hook
    }
  };
  const handleVideoCall = async () => {
    if (!room) {
      Alert.alert("Lỗi", "Không tìm thấy phòng chat");
      return;
    }

    try {
      console.log("📞 Starting video call...");

      // Get the doctor ID
      const doctorId = room.doctorId._id;
      console.log("📞 Video calling to doctor:", doctorId);

      // Use the video call hook
      await initializeVideoCall(doctorId);
    } catch (error: any) {
      console.error("❌ Error starting video call:", error);
      // Error is already handled in the hook
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00A86B" />
          <Text style={styles.loadingText}>Đang tải cuộc trò chuyện...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Image
              source={{
                uri:
                  room?.doctorId?.photoUrl ||
                  "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop&crop=face",
              }}
              style={styles.headerAvatar}
              defaultSource={{
                uri: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop&crop=face",
              }}
            />
            <View style={styles.headerText}>
              <Text style={styles.headerName}>
                {room?.doctorId?.fullName || doctorName}
              </Text>
              <Text style={styles.headerStatus}>
                {isConnected ? (
                  <>
                    🟢 Trực tuyến
                    {onlineCount > 1 ? ` • ${onlineCount} người` : ""}
                  </>
                ) : (
                  "🔴 Đang kết nối..."
                )}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            {" "}
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleVoiceCall}
              disabled={!isConnected || isInitiatingCall}
            >
              <Ionicons
                name="call"
                size={20}
                color={isConnected && !isInitiatingCall ? "#FFFFFF" : "#CCCCCC"}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleVideoCall}
              disabled={!isConnected || isInitiatingCall}
            >
              <Ionicons
                name="videocam"
                size={20}
                color={isConnected && !isInitiatingCall ? "#FFFFFF" : "#CCCCCC"}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages */}
        <KeyboardAvoidingView
          style={styles.messagesContainer}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <MessageList
            messages={messages}
            currentUserId={currentUserId}
            seenMessageIds={seenMessageIds}
          />{" "}
          <ChatInput
            onSendMessage={sendMessage}
            onAttachFile={showAttachmentOptions}
            onVideoCall={handleVideoCall}
            isConnected={isConnected}
            isSending={isSending || isUploadingImage}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#666",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00A86B",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 20,
  },
  backButton: {
    marginRight: 12,
  },
  headerInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  headerStatus: {
    fontSize: 12,
    color: "#E8F5E8",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  messagesContainer: {
    flex: 1,
  },
});
