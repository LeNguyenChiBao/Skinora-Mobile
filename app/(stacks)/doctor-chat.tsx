import { authService } from "@/services/authServices.service";
import chatService, {
  ChatEventHandlers,
  ChatRoom,
} from "@/services/chat.service";
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
  const [isLoadingMessages, setIsLoadingMessages] = useState(false); // Add this
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [pagination, setPagination] = useState<any>(null); // Add this
  const [isConnected, setIsConnected] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isUserActive, setIsUserActive] = useState(true);
  const [onlineCount, setOnlineCount] = useState(0);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

      // Always try WebSocket - no fallback to polling
      console.log("🔌 Initializing WebSocket connection...");
      await initializeWebSocket();
      console.log("✅ WebSocket connection successful");

      // Get or create chat room
      console.log("🏠 Finding or creating chat room...");
      await findOrCreateRoom();
      console.log("✅ Chat initialization complete");
    } catch (error) {
      console.error("❌ Failed to initialize chat:", error);
      Alert.alert(
        "Lỗi kết nối",
        "Không thể kết nối đến chat. Vui lòng kiểm tra kết nối mạng và thử lại.",
        [
          { text: "Thử lại", onPress: () => initializeChat() },
          { text: "Hủy", onPress: () => router.back() },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const initializeWebSocket = async () => {
    console.log("🔧 Setting up WebSocket event handlers...");

    const eventHandlers: ChatEventHandlers = {
      onMessageReceived: (message) => {
        console.log("📨 Event: Message received via WebSocket");
        handleMessageReceived(message);
      },
      onUserTyping: (data) => {
        console.log("✍️ Event: User typing via WebSocket");
        handleUserTyping(data);
      },
      onRoomJoined: (data) => {
        console.log("🏠 Event: Room joined successfully via WebSocket");
        console.log("👥 Room member count:", data.roomMemberCount);
        setOnlineCount(data.roomMemberCount || 0);
        handleRoomJoined(data);
      },
      onRoomUpdated: (data) => {
        console.log("📊 Event: Room updated via WebSocket");
        console.log("🔗 Total connections:", data.totalConnections);
        console.log("👤 Unique users:", data.uniqueUsers);
        setOnlineCount(data.totalConnections || data.uniqueUsers || 0);
      },
      onConnected: () => {
        console.log("✅ Event: WebSocket connected and authenticated");
        setIsConnected(true);
        setIsOfflineMode(false);
        // Room auto-join is now handled in the service
      },
      onDisconnected: () => {
        console.log("❌ Event: WebSocket disconnected");
        setIsConnected(false);
        setIsOfflineMode(true);
        setOnlineCount(0);

        setTimeout(() => {
          if (!chatService.isConnected()) {
            console.log("⚠️ Still disconnected after timeout");
          }
        }, 3000);
      },
      onError: handleError,
    };

    chatService.setEventHandlers(eventHandlers);
    await chatService.connect();
  };

  const getCurrentUserId = async (room: ChatRoom): Promise<string> => {
    console.log("🔍 Determining current user ID from room participants:", {
      doctorId: room.doctorId?._id || "null",
      patientId: room.patientId?._id || "null",
      routeDoctorId: doctorId,
    });

    // Try to get current user info from authService
    try {
      const userInfo = await authService.getUserData();
      console.log("👤 Current user info from authService:", userInfo);

      if (userInfo?.id) {
        // Check if current user is the doctor
        if (room.doctorId && userInfo.id === room.doctorId._id) {
          console.log("👨‍⚕️ Current user is doctor:", room.doctorId._id);
          return room.doctorId._id;
        }
        // Check if current user is the patient
        else if (room.patientId && userInfo.id === room.patientId._id) {
          console.log("👤 Current user is patient:", room.patientId._id);
          return room.patientId._id;
        }
        // Handle case where room.doctorId is null but user might be the doctor
        else if (!room.doctorId && userInfo.id === doctorId) {
          console.log(
            "👨‍⚕️ Current user is doctor (null in room, matched by param):",
            userInfo.id
          );
          return userInfo.id;
        }
        // Default: assume current user is the patient if we have patient info
        else if (room.patientId && room.patientId._id) {
          console.log("👤 Defaulting to patient ID:", room.patientId._id);
          return room.patientId._id;
        }
      }
    } catch (error) {
      console.error("❌ Error getting user info from authService:", error);
    }

    // Fallback logic with better null handling
    if (room.doctorId && room.doctorId._id === doctorId) {
      console.log("👨‍⚕️ Fallback: Current user is doctor:", room.doctorId._id);
      return room.doctorId._id;
    } else if (room.patientId && room.patientId._id) {
      console.log("👤 Fallback: Current user is patient:", room.patientId._id);
      return room.patientId._id;
    } else {
      // Last resort: try to use any available ID
      const availableId = room.doctorId?._id || room.patientId?._id;
      if (availableId) {
        console.log("⚠️ Last resort: Using available ID:", availableId);
        return availableId;
      } else {
        // Very last resort: use route param doctorId if available
        if (doctorId) {
          console.log("🆘 Emergency fallback: Using route doctorId:", doctorId);
          return doctorId as string;
        }

        throw new Error(
          "Cannot determine current user ID - no valid IDs available"
        );
      }
    }
  };

  const convertChatMessageToUIMessage = (chatMessage: any): Message => {
    // Backend uses different field names - handle the actual API structure
    const messageId = chatMessage._id;
    const senderId = chatMessage.senderId?._id || chatMessage.senderId || null;
    const senderType = chatMessage.senderType; // Backend specific field
    const content = chatMessage.content;
    const messageType = chatMessage.messageType;
    const createdAt = chatMessage.timestamp || chatMessage.createdAt;
    const senderInfo = chatMessage.senderId; // This might be an object or null

    console.log("🔄 Converting backend message:", {
      messageId,
      senderId,
      senderType,
      currentUserId,
      content: content?.substring(0, 30),
      hasPopulatedSender: !!senderInfo && typeof senderInfo === "object",
      timestamp: createdAt,
    });

    // Determine if this is the current user's message
    let isOwn = false;
    let displayName = "";
    let avatar: string | undefined;

    if (senderType === "patient") {
      // Patient message
      isOwn = senderId === currentUserId;
      if (isOwn) {
        displayName = "Bạn";
        avatar = undefined;
      } else {
        // Another patient (unlikely in this context)
        displayName = senderInfo?.fullName || "Bệnh nhân";
        avatar = senderInfo?.avatarUrl;
      }
    } else if (senderType === "doctor") {
      // Doctor message - senderId is often null for doctor messages
      if (senderId && senderId === currentUserId) {
        // Current user is doctor and senderId matches
        isOwn = true;
        displayName = "Bạn";
        avatar = undefined;
      } else {
        // Message from doctor (when current user is patient) or senderId is null
        isOwn = false;
        displayName = (doctorName as string) || "Bác sĩ";
        avatar =
          "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop&crop=face";
      }
    } else {
      // Fallback - try to determine by senderId
      isOwn = senderId === currentUserId;
      if (isOwn) {
        displayName = "Bạn";
        avatar = undefined;
      } else {
        displayName =
          senderInfo?.fullName || (doctorName as string) || "Người dùng";
        avatar =
          senderInfo?.avatarUrl ||
          "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop&crop=face";
      }
    }

    // Extract image/file URLs from attachments array
    const attachments = chatMessage.attachments || [];
    let imageUrl = null;
    let fileUrl = null;
    let fileName = null;

    if (attachments.length > 0) {
      if (messageType === "image") {
        imageUrl = attachments[0];
      } else if (messageType === "file") {
        fileUrl = attachments[0];
        fileName = attachments[0]?.split("/").pop() || "Document";
      }
    }

    console.log("🔄 Message conversion result:", {
      messageId,
      isOwn,
      displayName,
      senderType,
      hasAvatar: !!avatar,
      finalText: content?.substring(0, 30),
    });

    return {
      _id: messageId,
      text: content,
      createdAt: new Date(createdAt),
      user: {
        _id: senderId || "unknown",
        name: displayName,
        avatar: avatar,
      },
      type: messageType === "text" ? "text" : (messageType as any),
      isOwn,
      imageUrl: imageUrl,
      fileUrl: fileUrl,
      fileName: fileName,
    };
  };

  const loadMessages = async (roomId: string, page: number = 1) => {
    if (!roomId || roomId === "undefined") {
      console.error("❌ Cannot load messages: Invalid room ID:", roomId);
      return;
    }

    try {
      console.log("📨 Loading messages for room:", roomId, "page:", page);
      console.log("📨 Current user ID for message conversion:", currentUserId);
      setIsLoadingMessages(true);

      const { messages: newMessages, pagination } =
        await chatService.getMessages(roomId, page);

      console.log("📨 Raw messages from API:", newMessages.length, "messages");
      console.log("📨 Sample message structure:", newMessages[0]);

      // Convert ChatMessages to UI Messages
      const convertedMessages = newMessages.map(convertChatMessageToUIMessage);

      console.log(
        "📨 Converted messages:",
        convertedMessages.length,
        "messages"
      );
      console.log("📨 Sample converted message:", convertedMessages[0]);

      if (page === 1) {
        setMessages(convertedMessages);
      } else {
        setMessages((prev) => [...convertedMessages, ...prev]);
      }

      setPagination(pagination);

      // Scroll to bottom for first page
      if (page === 1) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error("❌ Failed to load messages:", error);

      if (error.message?.includes("Invalid roomId")) {
        Alert.alert("Lỗi", "ID phòng chat không hợp lệ. Vui lòng thử lại.");
      } else {
        Alert.alert("Lỗi", "Không thể tải tin nhắn. Vui lòng thử lại.");
      }
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const findOrCreateRoom = async () => {
    try {
      console.log("🔍 Looking for existing room or creating new one...");

      const existingRooms = await chatService.getRooms();
      let existingRoom = existingRooms.find((room) => {
        if (appointmentId && room.appointmentId === appointmentId) {
          return true;
        }
        if (room.doctorId && room.doctorId._id === doctorId) {
          return true;
        }
        return false;
      });

      if (existingRoom) {
        console.log("✅ Using existing room:", existingRoom._id);
        setRoom(existingRoom);

        // Get and set currentUserId FIRST
        const userId = await getCurrentUserId(existingRoom);
        console.log("🆔 Setting currentUserId:", userId);
        setCurrentUserId(userId);

        // Load messages immediately - don't wait for currentUserId check
        console.log(
          "📨 Loading messages immediately for room:",
          existingRoom._id
        );
        try {
          const { messages: newMessages, pagination } =
            await chatService.getMessages(existingRoom._id, 1);

          console.log("📨 Raw messages loaded:", newMessages.length);

          // Convert messages - this will use the currentUserId we just set
          const convertedMessages = newMessages.map(
            convertChatMessageToUIMessage
          );
          setMessages(convertedMessages);
          setPagination(pagination);

          // Scroll to bottom
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        } catch (messageError) {
          console.error("❌ Failed to load messages:", messageError);
        }

        // Auto-join room when WebSocket is ready
        if (isConnected) {
          chatService.joinRoom(existingRoom._id);
        } else {
          // Store for auto-join when connected
          chatService.autoJoinRoom(existingRoom._id);
        }

        await chatService.markAsRead(existingRoom._id);
        return;
      }

      // Create new room logic...
      console.log("🏗️ No existing room found, attempting to create new one...");

      // Try creating from appointment first (if appointmentId exists)
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

          if (roomFromAppointment && roomFromAppointment._id) {
            console.log("✅ Room created from appointment successfully");
            setRoom(roomFromAppointment);
            const userId = await getCurrentUserId(roomFromAppointment);
            setCurrentUserId(userId);

            if (isConnected) {
              chatService.joinRoom(roomFromAppointment._id);
            } else {
              chatService.autoJoinRoom(roomFromAppointment._id);
            }

            await loadMessages(roomFromAppointment._id);
            await chatService.markAsRead(roomFromAppointment._id);
            return;
          }
        } catch (appointmentError) {
          console.log(
            "❌ Failed to create room from appointment:",
            appointmentError.message
          );
          // Continue to manual room creation
        }
      }

      // Manual room creation as fallback
      console.log("🏗️ Creating room manually...");
      const userInfo = await authService.getUserData();
      if (!userInfo?.id) {
        throw new Error("Current user info not found");
      }

      const newRoom = await chatService.createRoom({
        patientId: userInfo.id,
        doctorId: doctorId as string,
        appointmentId: (appointmentId as string) || "",
      });

      if (!newRoom || !newRoom._id) {
        throw new Error("Failed to create room - invalid response from server");
      }

      console.log("✅ New room created manually:", newRoom._id);
      setRoom(newRoom);
      const userId = await getCurrentUserId(newRoom);
      setCurrentUserId(userId);

      if (isConnected) {
        chatService.joinRoom(newRoom._id);
      } else {
        chatService.autoJoinRoom(newRoom._id);
      }

      await loadMessages(newRoom._id);
      await chatService.markAsRead(newRoom._id);
    } catch (error) {
      console.error("❌ Failed to find or create room:", error);

      // Show more specific error messages
      if (error.message?.includes("appointment not yet implemented")) {
        Alert.alert(
          "Thông báo",
          "Tính năng tạo phòng chat từ cuộc hẹn đang được phát triển. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      } else if (error.message?.includes("room")) {
        Alert.alert(
          "Lỗi tạo phòng chat",
          "Không thể tạo hoặc tìm phòng chat. Vui lòng thử lại sau.",
          [
            { text: "Thử lại", onPress: () => findOrCreateRoom() },
            { text: "Hủy", onPress: () => router.back() },
          ]
        );
      } else {
        throw error; // Re-throw other errors to be handled by parent
      }
    }
  };

  const handleMessageReceived = (message: any) => {
    console.log("📨 Handling received message via WebSocket:", {
      messageId: message._id,
      roomId: message.chatRoomId || message.roomId, // Backend uses chatRoomId
      senderId: message.senderId,
      currentUserId,
      messageType: message.messageType,
      content: message.content?.substring(0, 50),
      senderType: message.senderType,
    });

    // Backend uses chatRoomId instead of roomId
    const messageRoomId = message.chatRoomId || message.roomId;

    if (room && messageRoomId === room._id) {
      console.log("✅ Message is for current room, adding to UI");

      const uiMessage = convertChatMessageToUIMessage(message);
      setMessages((prev) => {
        // Check if message already exists to avoid duplicates
        const exists = prev.some((msg) => msg._id === message._id);
        if (!exists) {
          console.log("📨 Adding received WebSocket message to list");
          console.log("📨 New message details:", {
            id: uiMessage._id,
            text: uiMessage.text?.substring(0, 30),
            isOwn: uiMessage.isOwn,
            senderName: uiMessage.user.name,
          });

          // Add new message and sort to maintain chronological order
          const newMessages = [...prev, uiMessage].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );

          console.log("📨 Updated messages count:", newMessages.length);
          return newMessages;
        } else {
          console.log("📨 WebSocket message already exists, skipping");
          return prev;
        }
      });

      // Auto-scroll to bottom with a slight delay to ensure UI has updated
      setTimeout(() => {
        console.log("📜 Auto-scrolling to bottom for new message");
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 200);

      // Mark as read if not own message
      const messageSenderId = message.senderId?._id || message.senderId;
      if (messageSenderId !== currentUserId) {
        console.log("✅ Marking WebSocket message as read (not own message)");
        setTimeout(() => {
          chatService.markAsRead(room._id);
        }, 500);
      }
    } else {
      console.log("⚠️ WebSocket message ignored:", {
        reason: !room ? "No room set" : "Different room",
        messageRoomId,
        currentRoomId: room?._id,
      });
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

  const handleRoomJoined = (data: {
    roomId: string;
    userId: string;
    roomMemberCount?: number;
  }) => {
    console.log("🏠 Handling room joined event:", {
      roomId: data.roomId,
      userId: data.userId,
      memberCount: data.roomMemberCount,
      currentRoomId: room?._id,
      currentUserId,
    });

    if (room && data.roomId === room._id) {
      console.log("✅ Successfully joined room:", data.roomId);
      console.log("👥 Room member count:", data.roomMemberCount);
      // Room joined successfully, we can now start receiving messages
      // Maybe refresh messages or show a success indicator
    } else {
      console.log("⚠️ Room joined event for different room:", data.roomId);
    }
  };

  const handleError = (error: any) => {
    console.error("Chat error:", error);

    // Handle authentication errors specifically
    if (
      error.message?.includes("Auth error") ||
      error.message?.includes("Authentication failed")
    ) {
      console.log("🔐 Authentication error detected, redirecting to login");
      Alert.alert(
        "Lỗi xác thực",
        "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.",
        [
          {
            text: "Đăng nhập",
            onPress: () => router.replace("/(auth)/login"),
          },
        ]
      );
      return;
    }

    // For WebSocket errors, try to reconnect with exponential backoff
    if (
      error.message?.includes("websocket") ||
      error.message?.includes("connection") ||
      error.message?.includes("timeout")
    ) {
      console.log("🔄 WebSocket error, implementing reconnection strategy...");
      setIsConnected(false);
      setIsOfflineMode(true);

      // Use exponential backoff for reconnection
      const backoffDelay = Math.min(1000 * Math.pow(2, Math.min(5, 3)), 30000); // Max 30 seconds

      setTimeout(() => {
        console.log(
          `🔄 Attempting to reconnect WebSocket after ${backoffDelay}ms...`
        );
        initializeWebSocket().catch((reconnectError) => {
          console.error("❌ Reconnection failed:", reconnectError);

          // Only show alert if we're still on this screen
          if (!isOfflineMode) return; // User might have navigated away

          Alert.alert(
            "Lỗi kết nối",
            "Không thể kết nối lại. Vui lòng kiểm tra mạng.",
            [
              {
                text: "Thử lại",
                onPress: () => initializeWebSocket().catch(console.error),
              },
              { text: "Hủy", style: "cancel" },
            ]
          );
        });
      }, backoffDelay);
    } else {
      Alert.alert("Lỗi Chat", "Đã xảy ra lỗi khi chat. Vui lòng thử lại.");
    }
  };

  const cleanup = () => {
    if (room && isConnected) {
      console.log("🧹 Cleaning up WebSocket connections...");
      chatService.leaveRoom(room._id);
      chatService.sendTypingStatus(room._id, false);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // No more polling cleanup needed

    if (userActivityTimeoutRef.current) {
      clearTimeout(userActivityTimeoutRef.current);
    }
  };

  const sendMessage = async () => {
    if (inputText.trim() === "" || !room || isSending) {
      return;
    }

    const messageContent = inputText.trim();
    console.log("💬 Preparing to send message:", messageContent);
    setInputText("");
    setIsSending(true);

    try {
      // Send via HTTP API - WebSocket will broadcast the response
      console.log("💬 Sending message via HTTP API");
      const sentMessage = await chatService.sendMessageToDoctor(
        room._id,
        messageContent
      );

      console.log("✅ Message sent via HTTP API:", sentMessage);

      // Don't manually add to UI here - let WebSocket handle it
      // The new_message event will add it to the UI automatically

      // Stop typing indicator
      if (!isOfflineMode) {
        chatService.sendTypingStatus(room._id, false);
      }
    } catch (error) {
      console.error("❌ Failed to send message:", error);
      Alert.alert("Lỗi", "Không thể gửi tin nhắn. Vui lòng thử lại.");
      setInputText(messageContent);
    } finally {
      setIsSending(false);
    }
  };

  const handleInputChange = (text: string) => {
    setInputText(text);

    // Send typing indicators via WebSocket
    if (!room || !isConnected) return;

    // Send typing indicator
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
      console.log("🚀 Starting call for appointment:", appointmentId);

      // Just navigate with appointmentId, call details will be fetched in video-call screen
      router.push({
        pathname: "/(stacks)/video-call",
        params: {
          appointmentId: appointmentId,
          doctorId: doctorId,
          doctorName: doctorName,
          callType: callType,
        },
      });
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
      console.log("🔗 Joining existing call for appointment:", appointmentId);

      // Just navigate with appointmentId, call details will be fetched in video-call screen
      router.push({
        pathname: "/(stacks)/video-call",
        params: {
          appointmentId: appointmentId,
          doctorId: doctorId,
          doctorName: doctorName,
          isJoining: "true",
        },
      });
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
    // Fix: Use the isOwn property from the message instead of recalculating
    const isCurrentUser = item.isOwn;

    console.log("🖼️ Rendering message:", {
      messageId: item._id,
      isCurrentUser: isCurrentUser,
      senderName: item.user.name,
      senderId: item.user._id,
      currentUserId: currentUserId,
      type: item.type,
      text: item.text?.substring(0, 50),
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

  // Add a function to refresh messages when currentUserId changes
  useEffect(() => {
    if (room && currentUserId) {
      console.log("🔄 currentUserId changed, refreshing message display");
      // Re-convert existing messages with the correct currentUserId
      setMessages((prevMessages) =>
        prevMessages.map((msg) => {
          // Find the original chat message data if available
          // For now, just update the isOwn property based on senderId
          const isOwn = msg.user._id === currentUserId;
          return {
            ...msg,
            isOwn,
            user: {
              ...msg.user,
              name: isOwn ? "Bạn" : msg.user.name,
            },
          };
        })
      );
    }
  }, [currentUserId, room]);

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
              disabled={!isConnected}
            >
              <Ionicons
                name="add"
                size={24}
                color={isConnected ? "#00A86B" : "#999"}
              />
            </TouchableOpacity>

            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={handleInputChange}
                placeholder={
                  isConnected ? "Nhập tin nhắn..." : "Đang kết nối..."
                }
                placeholderTextColor="#999"
                multiline
                maxLength={1000}
                editable={isConnected}
                onFocus={handleUserActivity}
                onSelectionChange={handleUserActivity}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.sendButton,
                (isSending || !isConnected) && { opacity: 0.6 },
              ]}
              onPress={sendMessage}
              disabled={isSending || inputText.trim() === "" || !isConnected}
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
