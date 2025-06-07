import { userService } from "@/services/user.service";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface Message {
  _id: string;
  text: string;
  createdAt: Date;
  user: {
    _id: string;
    name: string;
    avatar?: string;
  };
  type?: "text" | "image" | "file";
}

export default function DoctorChatScreen() {
  const router = useRouter();
  const { doctorId, doctorName, appointmentId, isInCall } =
    useLocalSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const currentUserId = "current-user-id"; // This should come from auth service

  // Mock messages for demonstration
  useEffect(() => {
    const mockMessages: Message[] = [
      {
        _id: "1",
        text: "Chào bạn! Tôi đã xem kết quả phân tích da của bạn. Có một vài điều chúng ta cần thảo luận.",
        createdAt: new Date(Date.now() - 1000 * 60 * 10),
        user: {
          _id: doctorId as string,
          name: doctorName as string,
          avatar:
            "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop&crop=face",
        },
      },
      {
        _id: "2",
        text: "Chào bác sĩ! Em có thể biết chi tiết được không ạ?",
        createdAt: new Date(Date.now() - 1000 * 60 * 8),
        user: {
          _id: currentUserId,
          name: "Bạn",
        },
      },
      {
        _id: "3",
        text: "Dựa trên kết quả, da của bạn đang có dấu hiệu khô và thiếu độ ẩm. Tôi khuyên bạn nên sử dụng kem dưỡng ẩm 2 lần/ngày.",
        createdAt: new Date(Date.now() - 1000 * 60 * 5),
        user: {
          _id: doctorId as string,
          name: doctorName as string,
          avatar:
            "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop&crop=face",
        },
      },
      {
        _id: "4",
        text: "Cảm ơn bác sĩ! Em sẽ làm theo lời khuyên của bác sĩ ạ. Có sản phẩm nào bác sĩ khuyên dùng không?",
        createdAt: new Date(Date.now() - 1000 * 60 * 2),
        user: {
          _id: currentUserId,
          name: "Bạn",
        },
      },
    ];
    setMessages(mockMessages.reverse());
  }, []);

  const sendMessage = () => {
    if (inputText.trim() === "") return;

    const newMessage: Message = {
      _id: Date.now().toString(),
      text: inputText.trim(),
      createdAt: new Date(),
      user: {
        _id: currentUserId,
        name: "Bạn",
      },
    };

    setMessages((prevMessages) => [...prevMessages, newMessage]);
    setInputText("");

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Simulate doctor typing
    setTimeout(() => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        const doctorReply: Message = {
          _id: (Date.now() + 1).toString(),
          text: "Cảm ơn bạn đã chia sẻ! Tôi sẽ tư vấn thêm sau khi xem xét kỹ hơn.",
          createdAt: new Date(),
          user: {
            _id: doctorId as string,
            name: doctorName as string,
            avatar:
              "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop&crop=face",
          },
        };
        setMessages((prevMessages) => [...prevMessages, doctorReply]);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }, 2000);
    }, 1000);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isCurrentUser = item.user._id === currentUserId;
    const isLastMessage = index === messages.length - 1;

    return (
      <View
        style={[
          styles.messageContainer,
          isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage,
        ]}
      >
        {!isCurrentUser && (
          <Image
            source={{
              uri: item.user.avatar || "https://via.placeholder.com/40",
            }}
            style={styles.avatar}
          />
        )}

        <View
          style={[
            styles.messageBubble,
            isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isCurrentUser ? styles.currentUserText : styles.otherUserText,
            ]}
          >
            {item.text}
          </Text>
          <Text
            style={[
              styles.messageTime,
              isCurrentUser ? styles.currentUserTime : styles.otherUserTime,
            ]}
          >
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (!isTyping) return null;

    return (
      <View style={styles.typingContainer}>
        <Image
          source={{
            uri: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop&crop=face",
          }}
          style={styles.avatar}
        />
        <View style={styles.typingBubble}>
          <View style={styles.typingDots}>
            <View style={[styles.dot, styles.dot1]} />
            <View style={[styles.dot, styles.dot2]} />
            <View style={[styles.dot, styles.dot3]} />
          </View>
        </View>
      </View>
    );
  };

  const startCall = async (callType: "video" | "audio" = "video") => {
    if (!appointmentId) {
      Alert.alert(
        "Lỗi",
        "Không thể bắt đầu cuộc gọi - thiếu thông tin cuộc hẹn"
      );
      return;
    }

    try {
      const response = await userService.startCall(appointmentId as string, {
        callType,
      });

      if (response.success) {
        router.push({
          pathname: "/(stacks)/video-call",
          params: {
            appointmentId: appointmentId,
            doctorId: doctorId,
            doctorName: doctorName,
            token: response.data.patientToken,
            channelName: response.data.channelName,
            uid: response.data.patientUid.toString(),
            appId: response.data.agoraAppId,
          },
        });
      } else {
        Alert.alert("Lỗi", response.message || "Không thể bắt đầu cuộc gọi");
      }
    } catch (error) {
      console.error("Error starting call:", error);
      Alert.alert("Lỗi", "Không thể kết nối để bắt đầu cuộc gọi");
    }
  };

  const joinCall = async () => {
    if (!appointmentId) {
      Alert.alert(
        "Lỗi",
        "Không thể tham gia cuộc gọi - thiếu thông tin cuộc hẹn"
      );
      return;
    }

    try {
      const response = await userService.joinCall(appointmentId as string);

      if (response.success) {
        router.push({
          pathname: "/(stacks)/video-call",
          params: {
            appointmentId: appointmentId,
            doctorId: doctorId,
            doctorName: doctorName,
            token: response.data.patientToken,
            channelName: response.data.channelName,
            uid: response.data.patientUid.toString(),
            appId: response.data.agoraAppId,
          },
        });
      } else {
        Alert.alert("Lỗi", response.message || "Không thể tham gia cuộc gọi");
      }
    } catch (error) {
      console.error("Error joining call:", error);
      Alert.alert("Lỗi", "Không thể kết nối để tham gia cuộc gọi");
    }
  };

  const showCallOptions = () => {
    Alert.alert("Cuộc gọi", "Chọn loại cuộc gọi:", [
      { text: "Hủy", style: "cancel" },
      { text: "Gọi thoại", onPress: () => startCall("audio") },
      { text: "Gọi video", onPress: () => startCall("video") },
    ]);
  };

  const handleVideoCall = () => {
    if (isInCall === "true") {
      // If already in call, join the existing call
      joinCall();
    } else {
      // Start new video call
      startCall("video");
    }
  };

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
                uri: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop&crop=face",
              }}
              style={styles.headerAvatar}
            />
            <View style={styles.headerText}>
              <Text style={styles.headerName}>{doctorName}</Text>
              <Text style={styles.headerStatus}>Đang hoạt động</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={showCallOptions}
            >
              <Ionicons name="call" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleVideoCall}
            >
              <Ionicons name="videocam" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton}>
              <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages */}
        <KeyboardAvoidingView
          style={styles.messagesContainer}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item._id}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
          />

          {renderTypingIndicator()}

          {/* Input */}
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.attachButton}>
              <Ionicons name="add" size={24} color="#00A86L" />
            </TouchableOpacity>

            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Nhập tin nhắn..."
                placeholderTextColor="#999"
                multiline
                maxLength={1000}
              />
            </View>

            <TouchableOpacity style={styles.emojiButton}>
              <Ionicons name="happy-outline" size={24} color="#00A86L" />
            </TouchableOpacity>

            {inputText.trim() ? (
              <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                <Ionicons name="send" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.micButton}>
                <Ionicons name="mic" size={24} color="#00A86L" />
              </TouchableOpacity>
            )}
          </View>
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
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-end",
  },
  currentUserMessage: {
    justifyContent: "flex-end",
  },
  otherUserMessage: {
    justifyContent: "flex-start",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: "75%",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  currentUserBubble: {
    backgroundColor: "#00A86B",
    borderBottomRightRadius: 4,
  },
  otherUserBubble: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  currentUserText: {
    color: "#FFFFFF",
  },
  otherUserText: {
    color: "#333",
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  currentUserTime: {
    color: "#E8F5E8",
  },
  otherUserTime: {
    color: "#999",
  },
  typingContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  typingBubble: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  typingDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00A86B",
  },
  dot1: {
    animationDelay: "0s",
  },
  dot2: {
    animationDelay: "0.2s",
  },
  dot3: {
    animationDelay: "0.4s",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  textInputContainer: {
    flex: 1,
    backgroundColor: "#F0F0F0",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    maxHeight: 100,
  },
  textInput: {
    fontSize: 16,
    color: "#333",
    maxHeight: 80,
  },
  emojiButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#00A86B",
    justifyContent: "center",
    alignItems: "center",
  },
  micButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
});
