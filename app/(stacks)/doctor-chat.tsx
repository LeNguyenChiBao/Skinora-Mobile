import { authService } from "@/services/authServices.service";
import chatService, {
  ChatEventHandlers,
  Message as ChatMessage,
  ChatRoom,
  SendMessageRequest,
} from "@/services/chat.service";
import { userService } from "@/services/user.service";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
  isOwn?: boolean;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
}

export default function DoctorChatScreen() {
  const router = useRouter();
  const { doctorId, doctorName, appointmentId, isInCall } =
    useLocalSearchParams();

  console.log("🩺 DoctorChatScreen initialized with params:", {
    doctorId,
    doctorName,
    appointmentId,
    isInCall,
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isUserActive, setIsUserActive] = useState(true);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const userActivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize chat
  useEffect(() => {
    console.log("🚀 Initializing chat...");
    checkAuthAndInitialize();

    return () => {
      console.log("🧹 Cleaning up chat...");
      cleanup();
    };
  }, [doctorId, appointmentId]);

  const checkAuthAndInitialize = async () => {
    try {
      // Check if we have auth token using authService
      const token = await authService.getToken();
      console.log(
        "🔑 Current auth token:",
        token ? `${token.substring(0, 20)}...` : "null"
      );

      if (!token) {
        console.error("❌ No auth token found");
        Alert.alert("Lỗi xác thực", "Vui lòng đăng nhập lại để sử dụng chat.", [
          {
            text: "Đăng nhập",
            onPress: () => router.replace("/(auth)/login"),
          },
          {
            text: "Hủy",
            onPress: () => router.back(),
          },
        ]);
        return;
      }

      // Check if user is logged in
      const isLoggedIn = await authService.isLoggedIn();
      console.log("🔐 User logged in status:", isLoggedIn);

      if (!isLoggedIn) {
        console.error("❌ User not logged in");
        Alert.alert("Phiên đăng nhập hết hạn", "Vui lòng đăng nhập lại.", [
          {
            text: "Đăng nhập",
            onPress: () => router.replace("/(auth)/login"),
          },
        ]);
        return;
      }

      // Update chat service token
      chatService.updateToken(token);

      // Initialize chat
      initializeChat();
    } catch (error) {
      console.error("❌ Error checking auth:", error);
      Alert.alert("Lỗi", "Không thể xác thực người dùng. Vui lòng thử lại.");
    }
  };

  const initializeChat = async () => {
    try {
      console.log("🔄 Starting chat initialization...");
      setIsLoading(true);

      // Try WebSocket first, fall back to polling if it fails
      try {
        console.log("🔌 Attempting WebSocket connection...");
        await initializeWebSocket();
        console.log("✅ WebSocket connection successful");
      } catch (wsError) {
        console.log(
          "❌ WebSocket failed, using offline mode with polling:",
          wsError
        );
        setIsOfflineMode(true);
        setIsConnected(false);
      }

      // Get or create chat room (works in both modes)
      console.log("🏠 Finding or creating chat room...");
      await findOrCreateRoom();
      console.log("✅ Chat initialization complete");
    } catch (error) {
      console.error("❌ Failed to initialize chat:", error);
      Alert.alert(
        "Lỗi",
        "Không thể kết nối đến chat. Sử dụng chế độ ngoại tuyến."
      );
      setIsOfflineMode(true);
      // Start polling even if initialization partially failed
      if (room) {
        setTimeout(() => startPolling(), 1000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const initializeWebSocket = async () => {
    console.log("🔧 Setting up WebSocket event handlers...");
    // Set up event handlers
    const eventHandlers: ChatEventHandlers = {
      onMessageReceived: (message) => {
        console.log("📨 Event: Message received via WebSocket");
        handleMessageReceived(message);
      },
      onUserTyping: (data) => {
        console.log("✍️ Event: User typing via WebSocket");
        handleUserTyping(data);
      },
      onConnected: () => {
        console.log("✅ Event: WebSocket connected");
        setIsConnected(true);
        setIsOfflineMode(false);
      },
      onDisconnected: () => {
        console.log("❌ Event: WebSocket disconnected");
        setIsConnected(false);
        // Start polling when disconnected
        if (!isOfflineMode) {
          console.log("🔄 WebSocket disconnected, starting polling...");
          setIsOfflineMode(true);
          startPolling();
        }
      },
      onError: handleError,
    };

    chatService.setEventHandlers(eventHandlers);

    // Try to connect with timeout
    const connectPromise = chatService.connect();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("WebSocket connection timeout")), 5000);
    });

    await Promise.race([connectPromise, timeoutPromise]);
  };

  const findOrCreateRoom = async () => {
    try {
      console.log("🔍 Looking for existing room or creating new one...");

      // First, try to create room from appointment if appointmentId exists
      if (appointmentId) {
        try {
          console.log(
            "🏗️ Attempting to create room from appointment:",
            appointmentId
          );
          const roomFromAppointment =
            await chatService.createRoomFromAppointment(
              appointmentId as string
            );
          console.log("✅ Room created from appointment successfully");

          setRoom(roomFromAppointment);
          const userId = await getCurrentUserId(roomFromAppointment);
          setCurrentUserId(userId);

          // Only join room via WebSocket if connected
          if (isConnected && !isOfflineMode) {
            console.log("🔌 Joining room via WebSocket...");
            chatService.joinRoom(roomFromAppointment._id);
          } else {
            console.log("📱 Starting polling mode...");
            // Start polling in offline mode
            setTimeout(() => startPolling(), 1000);
          }

          // Load messages
          await loadMessages(roomFromAppointment._id);

          // Mark as read
          await chatService.markAsRead(roomFromAppointment._id);
          return;
        } catch (appointmentError) {
          console.log(
            "❌ Failed to create room from appointment, trying other methods:",
            appointmentError
          );
        }
      }

      // Fallback: try to get existing rooms
      console.log("📋 Fetching existing rooms...");
      const rooms = await chatService.getRooms();

      // Find existing room with this doctor
      let existingRoom = rooms.find(
        (room) =>
          room.doctorId._id === doctorId || room.patientId._id === doctorId
      );

      if (existingRoom) {
        console.log("✅ Found existing room:", existingRoom._id);
      } else {
        console.log("🏗️ No existing room found, creating new one...");

        // Get current user info to determine who is patient/doctor
        const userInfo = await authService.getUserData();
        console.log("👤 Current user info for room creation:", userInfo);

        if (!userInfo?.id) {
          throw new Error("Current user info not found");
        }

        // Create new room - assume current user is patient, doctorId is the doctor
        existingRoom = await chatService.createRoom({
          patientId: userInfo.id,
          doctorId: doctorId as string,
          appointmentId: (appointmentId as string) || "",
        });
        console.log("✅ New room created:", existingRoom._id);
      }

      setRoom(existingRoom);
      const userId = await getCurrentUserId(existingRoom);
      setCurrentUserId(userId);

      // Only join room via WebSocket if connected
      if (isConnected && !isOfflineMode) {
        console.log("🔌 Joining room via WebSocket...");
        chatService.joinRoom(existingRoom._id);
      } else {
        console.log("📱 Starting polling mode...");
        // Start polling in offline mode
        setTimeout(() => startPolling(), 1000);
      }

      // Load messages
      await loadMessages(existingRoom._id);

      // Mark as read
      await chatService.markAsRead(existingRoom._id);
    } catch (error) {
      console.error("❌ Failed to find or create room:", error);
      throw error;
    }
  };

  const getCurrentUserId = async (room: ChatRoom): Promise<string> => {
    console.log("🔍 Determining current user ID from room participants:", {
      doctorId: room.doctorId._id,
      patientId: room.patientId._id,
      routeDoctorId: doctorId,
    });

    // Try to get current user info from authService
    try {
      const userInfo = await authService.getUserData();
      console.log("👤 Current user info from authService:", userInfo);

      if (userInfo?.id) {
        if (userInfo.id === room.doctorId._id) {
          console.log("👨‍⚕️ Current user is doctor:", room.doctorId._id);
          return room.doctorId._id;
        } else if (userInfo.id === room.patientId._id) {
          console.log("👤 Current user is patient:", room.patientId._id);
          return room.patientId._id;
        }
      }
    } catch (error) {
      console.error("❌ Error getting user info from authService:", error);
    }

    // Fallback: assume if doctorId matches the route param, current user is patient
    if (room.doctorId._id === doctorId) {
      console.log("👤 Fallback: Current user is patient:", room.patientId._id);
      return room.patientId._id;
    } else {
      console.log("👨‍⚕️ Fallback: Current user is doctor:", room.doctorId._id);
      return room.doctorId._id;
    }
  };

  const loadMessages = async (roomId: string, page: number = 1) => {
    try {
      console.log("📨 Loading messages for room:", roomId, "page:", page);
      const response = await chatService.getMessages(roomId, page);

      // Handle case where response.messages might be undefined or response is just an array
      const chatMessages = response.messages || response || [];

      // Convert chat messages to UI messages
      const uiMessages = chatMessages.map(convertChatMessageToUIMessage);

      console.log("📨 Formatted messages:", uiMessages.length, "messages");

      if (page === 1) {
        // For page 1, merge messages intelligently instead of replacing all
        setMessages((prev) => {
          // Create a map of existing messages by ID for fast lookup
          const existingMessagesMap = new Map(
            prev.map((msg) => [msg._id, msg])
          );

          // Start with existing messages
          const mergedMessages = [...prev];
          let hasNewMessages = false;

          // Add only truly new messages from the server
          uiMessages.forEach((newMsg) => {
            if (!existingMessagesMap.has(newMsg._id)) {
              mergedMessages.push(newMsg);
              hasNewMessages = true;
              console.log(
                "📨 Found new message:",
                newMsg._id,
                newMsg.text?.substring(0, 50)
              );
            }
          });

          if (hasNewMessages) {
            // Sort by creation time to maintain proper order
            const sortedMessages = mergedMessages.sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime()
            );
            console.log(
              "📨 Added",
              uiMessages.length - prev.length,
              "new messages, total:",
              sortedMessages.length
            );
            return sortedMessages;
          } else {
            console.log("📨 No new messages found");
            return prev;
          }
        });
      } else {
        console.log("📨 Prepending older messages");
        setMessages((prev) => [...uiMessages, ...prev]);
      }

      // Scroll to bottom for new messages (only for first page)
      if (page === 1) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error("❌ Failed to load messages:", error);
    }
  };

  const convertChatMessageToUIMessage = (chatMessage: ChatMessage): Message => {
    const isOwn = chatMessage.senderId === currentUserId;

    // Extract image/file URLs from attachments array
    const attachments = chatMessage.attachments || [];
    let imageUrl = null;
    let fileUrl = null;
    let fileName = null;

    if (attachments.length > 0) {
      if (chatMessage.messageType === "image") {
        imageUrl = attachments[0]; // First attachment is the image
      } else if (chatMessage.messageType === "file") {
        fileUrl = attachments[0]; // First attachment is the file
        // Extract filename from URL or use a default
        fileName = attachments[0]?.split("/").pop() || "Document";
      }
    }

    // Debug logging for message conversion
    console.log("🔄 Converting chat message to UI message:", {
      messageId: chatMessage._id,
      messageType: chatMessage.messageType,
      content: chatMessage.content,
      attachments: chatMessage.attachments,
      extractedImageUrl: imageUrl,
      extractedFileUrl: fileUrl,
      extractedFileName: fileName,
      hasAttachments: !!attachments.length,
    });

    return {
      _id: chatMessage._id,
      text: chatMessage.content,
      createdAt: new Date(chatMessage.createdAt),
      user: {
        _id: chatMessage.senderId,
        name:
          chatMessage.senderName || (isOwn ? "Bạn" : (doctorName as string)),
        avatar: isOwn
          ? undefined
          : "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop&crop=face",
      },
      type:
        chatMessage.messageType === "text"
          ? "text"
          : (chatMessage.messageType as any),
      isOwn,
      // Use extracted URLs from attachments
      imageUrl: imageUrl,
      fileUrl: fileUrl,
      fileName: fileName,
    };
  };

  const handleMessageReceived = (message: ChatMessage) => {
    console.log("📨 Handling received message via WebSocket:", {
      messageId: message._id,
      roomId: message.roomId,
      currentRoomId: room?._id,
      senderId: message.senderId,
      currentUserId,
      messageType: message.messageType,
      content: message.content?.substring(0, 50),
    });

    if (room && message.roomId === room._id) {
      const uiMessage = convertChatMessageToUIMessage(message);
      setMessages((prev) => {
        // Check if message already exists to avoid duplicates
        const exists = prev.some((msg) => msg._id === message._id);
        if (!exists) {
          console.log("📨 Adding received WebSocket message to list");
          // Add new message and sort to maintain order
          const newMessages = [...prev, uiMessage].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          return newMessages;
        } else {
          console.log("📨 WebSocket message already exists, skipping");
          return prev;
        }
      });

      // Auto-scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Mark as read if not own message
      if (message.senderId !== currentUserId) {
        console.log("✅ Marking WebSocket message as read (not own message)");
        chatService.markAsRead(room._id);
      }
    } else {
      console.log("⚠️ WebSocket message ignored: wrong room or no room set");
    }
  };

  const handleUserTyping = (data: {
    roomId: string;
    userId: string;
    isTyping: boolean;
  }) => {
    console.log("✍️ Typing event received:", {
      roomId: data.roomId,
      userId: data.userId,
      isTyping: data.isTyping,
      currentUserId,
      isCurrentUser: data.userId === currentUserId,
    });

    // Only handle typing in real-time mode and only for OTHER users (not current user)
    if (
      !isOfflineMode &&
      room &&
      data.roomId === room._id &&
      data.userId !== currentUserId // This is the key - ignore typing from current user
    ) {
      console.log("✍️ Setting typing indicator for other user:", data.isTyping);
      setIsTyping(data.isTyping);
      setTypingUsers((prev) => {
        if (data.isTyping) {
          return prev.includes(data.userId) ? prev : [...prev, data.userId];
        } else {
          return prev.filter((id) => id !== data.userId);
        }
      });
    } else {
      console.log("✍️ Ignoring typing event - current user or offline mode");
    }
  };

  const handleError = (error: any) => {
    console.error("Chat error:", error);

    // Don't show alert for connection errors, just switch to offline mode
    if (
      error.message?.includes("websocket") ||
      error.message?.includes("connection")
    ) {
      console.log("Switching to offline mode due to connection error");
      setIsOfflineMode(true);
      setIsConnected(false);

      if (room) {
        startPolling();
      }
    } else {
      Alert.alert("Lỗi Chat", "Đã xảy ra lỗi khi chat. Vui lòng thử lại.");
    }
  };

  const startPolling = () => {
    if (!room || pollTimeoutRef.current) {
      console.log("⚠️ Cannot start polling: no room or already polling");
      return;
    }

    console.log("🔄 Starting message polling for room:", room._id);
    const poll = async () => {
      try {
        console.log("📨 Polling for new messages...");
        await loadMessages(room._id, 1);
        // Poll every 2 seconds for more responsive updates
        pollTimeoutRef.current = setTimeout(poll, 2000);
      } catch (error) {
        console.error("❌ Polling error:", error);
        // Retry after longer delay on error
        pollTimeoutRef.current = setTimeout(poll, 5000);
      }
    };

    poll();
  };

  const stopPolling = () => {
    if (pollTimeoutRef.current) {
      console.log("⏹️ Stopping message polling...");
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  };

  const cleanup = () => {
    if (room && !isOfflineMode) {
      chatService.leaveRoom(room._id);
      chatService.sendTypingStatus(room._id, false);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    stopPolling();
  };

  const sendMessage = async () => {
    if (inputText.trim() === "" || !room || isSending) {
      console.log("⚠️ Cannot send message:", {
        hasText: !!inputText.trim(),
        hasRoom: !!room,
        isSending,
      });
      return;
    }

    const messageContent = inputText.trim();
    console.log("💬 Preparing to send message:", messageContent);
    setInputText("");
    setIsSending(true);

    try {
      const messageData: SendMessageRequest = {
        content: messageContent,
        messageType: "text",
      };

      console.log("💬 Sending message to room:", room._id);
      const sentMessage = await chatService.sendMessage(room._id, messageData);
      console.log("✅ Message sent successfully:", sentMessage);

      // Immediately add the sent message to UI
      const uiMessage = convertChatMessageToUIMessage(sentMessage);
      console.log("📨 Adding sent message to UI immediately:", uiMessage);

      setMessages((prev) => {
        // Check if message already exists to avoid duplicates
        const exists = prev.some((msg) => msg._id === sentMessage._id);
        if (!exists) {
          console.log("📨 Message added to UI, new count:", prev.length + 1);
          return [...prev, uiMessage];
        } else {
          console.log("📨 Message already exists, skipping");
          return prev;
        }
      });

      // Stop typing indicator (only in real-time mode)
      if (!isOfflineMode) {
        console.log("✍️ Stopping typing indicator");
        chatService.sendTypingStatus(room._id, false);
      }

      // Force scroll to bottom
      setTimeout(() => {
        console.log("📜 Scrolling to bottom after sending message");
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error("❌ Failed to send message:", error);
      Alert.alert("Lỗi", "Không thể gửi tin nhắn. Vui lòng thử lại.");
      setInputText(messageContent);
    } finally {
      setIsSending(false);
    }

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleInputChange = (text: string) => {
    setInputText(text);

    // Only send typing indicators in real-time mode
    if (!room || isOfflineMode) return;

    // Send typing indicator - but don't set local isTyping state for own typing
    if (text.length > 0) {
      chatService.sendTypingStatus(room._id, true);
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      chatService.sendTypingStatus(room._id, false);
    }, 1000);
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

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isCurrentUser = item.user._id === currentUserId;

    // Debug logging for message rendering
    console.log("🖼️ Rendering message:", {
      messageId: item._id,
      type: item.type,
      text: item.text,
      imageUrl: item.imageUrl,
      fileUrl: item.fileUrl,
      fileName: item.fileName,
      hasImageUrl: !!item.imageUrl,
      hasFileUrl: !!item.fileUrl,
    });

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
          {/* Render image if it's an image message */}
          {item.type === "image" && item.imageUrl && (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.messageImage}
                resizeMode="cover"
                onLoad={() =>
                  console.log("✅ Image loaded successfully:", item.imageUrl)
                }
                onError={(error) =>
                  console.error(
                    "❌ Image load error:",
                    error,
                    "URL:",
                    item.imageUrl
                  )
                }
              />
              {item.text &&
                item.text !== "📷 Shared an image" &&
                item.text.trim() !== "" && (
                  <Text
                    style={[
                      styles.messageText,
                      isCurrentUser
                        ? styles.currentUserText
                        : styles.otherUserText,
                      { marginTop: 8 },
                    ]}
                  >
                    {item.text}
                  </Text>
                )}
            </View>
          )}

          {/* Render file if it's a file message */}
          {item.type === "file" && item.fileUrl && (
            <TouchableOpacity
              style={styles.fileContainer}
              onPress={() => {
                // TODO: Handle file download/open
                Alert.alert("Tệp", `Tải xuống: ${item.fileName || "file"}`);
              }}
            >
              <Ionicons
                name="document-attach"
                size={24}
                color={isCurrentUser ? "#FFFFFF" : "#00A86B"}
              />
              <View style={styles.fileInfo}>
                <Text
                  style={[
                    styles.fileName,
                    isCurrentUser
                      ? styles.currentUserText
                      : styles.otherUserText,
                  ]}
                  numberOfLines={1}
                >
                  {item.fileName || "Document"}
                </Text>
                <Text
                  style={[
                    styles.fileHint,
                    isCurrentUser
                      ? styles.currentUserTime
                      : styles.otherUserTime,
                  ]}
                >
                  Nhấn để tải xuống
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Render text for text messages or when no image/file */}
          {(item.type === "text" || (!item.imageUrl && !item.fileUrl)) && (
            <Text
              style={[
                styles.messageText,
                isCurrentUser ? styles.currentUserText : styles.otherUserText,
              ]}
            >
              {item.text}
            </Text>
          )}

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
    // Only show typing indicator if:
    // 1. Someone else is typing (not current user) - isTyping is only set for other users now
    // 2. Not in offline mode
    if (!isTyping || isOfflineMode) return null;

    console.log("✍️ Rendering typing indicator for other user");

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

  const handleUserActivity = () => {
    console.log("👤 User activity detected");
    setIsUserActive(true);

    // Clear existing timeout
    if (userActivityTimeoutRef.current) {
      clearTimeout(userActivityTimeoutRef.current);
    }

    // Set user as inactive after 5 minutes of no activity
    userActivityTimeoutRef.current = setTimeout(() => {
      console.log("😴 User marked as inactive");
      setIsUserActive(false);
    }, 5 * 60 * 1000); // 5 minutes
  };

  const pickImage = async () => {
    try {
      // Request permission
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert(
          "Lỗi",
          "Cần cấp quyền truy cập thư viện ảnh để gửi hình ảnh."
        );
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        console.log("📷 Image selected:", asset.uri);

        // Check file size (5MB limit for images)
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert("Lỗi", "Kích thước ảnh không được vượt quá 5MB.");
          return;
        }

        await uploadImage(asset);
      }
    } catch (error) {
      console.error("❌ Error picking image:", error);
      Alert.alert("Lỗi", "Không thể chọn hình ảnh. Vui lòng thử lại.");
    }
  };

  const uploadImage = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!room) {
      Alert.alert("Lỗi", "Không thể gửi ảnh - không tìm thấy phòng chat.");
      return;
    }

    try {
      setIsSending(true);
      console.log("📤 [DoctorChat] Starting image upload process...");
      console.log("🏠 Room ID:", room._id);
      console.log("📷 Asset details:", {
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        fileSize: asset.fileSize,
        width: asset.width,
        height: asset.height,
      });

      // Get optional content
      const content = inputText.trim();
      if (content) {
        console.log("💬 Including content with image:", content);
        setInputText("");
      } else {
        console.log("💬 No content to include with image");
      }

      console.log("🔄 Calling chatService.uploadImage...");
      // Use chatService to upload image
      const result = await chatService.uploadImage(room._id, asset, content);
      console.log("✅ [DoctorChat] Image uploaded successfully:", result);

      // Immediately reload messages to get the new image message
      console.log("🔄 Refreshing messages after image upload...");
      await loadMessages(room._id, 1);

      // Force scroll to bottom to show new message
      setTimeout(() => {
        console.log("📜 Scrolling to bottom after image upload");
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 300);
    } catch (error) {
      console.error("❌ [DoctorChat] Error uploading image:");
      console.error("   Error type:", error.constructor?.name || "Unknown");
      console.error("   Error message:", error.message || "No message");
      console.error("   Full error:", error);

      Alert.alert(
        "Lỗi",
        `Không thể gửi hình ảnh: ${error.message || "Lỗi không xác định"}`
      );
    } finally {
      setIsSending(false);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
        ],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        // Check if more than 5 files
        if (result.assets.length > 5) {
          Alert.alert("Lỗi", "Chỉ có thể gửi tối đa 5 tệp cùng lúc.");
          return;
        }

        // Check file sizes (10MB limit for documents)
        for (const asset of result.assets) {
          if (asset.size && asset.size > 10 * 1024 * 1024) {
            Alert.alert(
              "Lỗi",
              `Tệp "${asset.name}" vượt quá 10MB. Vui lòng chọn tệp nhỏ hơn.`
            );
            return;
          }
        }

        await uploadDocuments(result.assets);
      }
    } catch (error) {
      console.error("❌ Error picking document:", error);
      Alert.alert("Lỗi", "Không thể chọn tài liệu. Vui lòng thử lại.");
    }
  };

  const uploadDocuments = async (
    assets: DocumentPicker.DocumentPickerAsset[]
  ) => {
    if (!room) {
      Alert.alert("Lỗi", "Không thể gửi tệp - không tìm thấy phòng chat.");
      return;
    }

    try {
      setIsSending(true);
      console.log("📤 [DoctorChat] Starting documents upload process...");
      console.log("🏠 Room ID:", room._id);
      console.log("📄 Documents count:", assets.length);
      assets.forEach((asset, index) => {
        console.log(`   Document ${index + 1}:`, {
          name: asset.name,
          uri: asset.uri,
          mimeType: asset.mimeType,
          size: asset.size,
        });
      });

      // Get optional content
      const content = inputText.trim();
      if (content) {
        console.log("💬 Including content with documents:", content);
        setInputText("");
      } else {
        console.log("💬 No content to include with documents");
      }

      console.log("🔄 Calling chatService.uploadFiles...");
      // Use chatService to upload documents
      const result = await chatService.uploadFiles(room._id, assets, content);
      console.log("✅ [DoctorChat] Documents uploaded successfully:", result);

      // Immediately reload messages to get the new file messages
      console.log("🔄 Refreshing messages after documents upload...");
      await loadMessages(room._id, 1);

      // Force scroll to bottom to show new message
      setTimeout(() => {
        console.log("📜 Scrolling to bottom after documents upload");
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 300);

      // The message should be received via WebSocket/polling
      const fileNames = assets.map((asset) => asset.name).join(", ");
      Alert.alert("Thành công", `Đã gửi ${assets.length} tệp: ${fileNames}`);
    } catch (error) {
      console.error("❌ [DoctorChat] Error uploading documents:");
      console.error("   Error type:", error.constructor?.name || "Unknown");
      console.error("   Error message:", error.message || "No message");
      console.error("   Full error:", error);

      Alert.alert(
        "Lỗi",
        `Không thể gửi tệp: ${error.message || "Lỗi không xác định"}`
      );
    } finally {
      setIsSending(false);
    }
  };

  const showAttachmentOptions = () => {
    Alert.alert("Gửi tệp", "Chọn loại tệp bạn muốn gửi:", [
      { text: "Hủy", style: "cancel" },
      {
        text: "📷 Hình ảnh",
        onPress: pickImage,
        style: "default",
      },
      {
        text: "📄 Tài liệu",
        onPress: pickDocument,
        style: "default",
      },
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <View style={styles.headerText}>
              <Text style={styles.headerName}>Đang kết nối...</Text>
            </View>
          </View>
        </View>
        <View
          style={[
            styles.messagesContainer,
            { justifyContent: "center", alignItems: "center" },
          ]}
        >
          <ActivityIndicator size="large" color="#00A86L" />
          <Text style={{ marginTop: 10, color: "#666" }}>
            Đang tải cuộc trò chuyện...
          </Text>
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
                uri: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop&crop=face",
              }}
              style={styles.headerAvatar}
            />
            <View style={styles.headerText}>
              <Text style={styles.headerName}>{doctorName}</Text>
              <Text style={styles.headerStatus}>
                {isConnected
                  ? "Đang hoạt động"
                  : isOfflineMode
                  ? "Ngoại tuyến"
                  : "Đang kết nối..."}
              </Text>
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
            <TouchableOpacity
              style={styles.attachButton}
              onPress={showAttachmentOptions}
            >
              <Ionicons name="add" size={24} color="#00A86B" />
            </TouchableOpacity>

            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={handleInputChange}
                placeholder={
                  isOfflineMode
                    ? "Nhập tin nhắn (ngoại tuyến)..."
                    : "Nhập tin nhắn..."
                }
                placeholderTextColor="#999"
                multiline
                maxLength={1000}
                editable={true}
                onFocus={handleUserActivity}
                onSelectionChange={handleUserActivity}
              />
            </View>

            <TouchableOpacity
              style={[styles.sendButton, isSending && { opacity: 0.6 }]}
              onPress={sendMessage}
              disabled={isSending || inputText.trim() === ""}
            >
              {isSending ? (
                <ActivityIndicator size={16} color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
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
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#00A86B",
    justifyContent: "center",
    alignItems: "center",
  },
  imageContainer: {
    width: "100%",
    marginBottom: 4,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
  },
  fileContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
  },
  fileInfo: {
    marginLeft: 12,
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 2,
  },
  fileHint: {
    fontSize: 12,
    fontStyle: "italic",
  },
});
