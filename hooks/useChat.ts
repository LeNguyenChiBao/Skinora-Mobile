import { authService } from "@/services/authServices.service";
import chatService, {
  ChatEventHandlers,
  ChatRoom,
  Message,
} from "@/services/chat.service";
import { useCallback, useRef, useState } from "react";

interface UseChatProps {
  doctorId: string;
  doctorName: string;
  appointmentId?: string;
  onError?: (error: string) => void;
}

export const useChat = ({
  doctorId,
  doctorName,
  appointmentId,
  onError,
}: UseChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);

  // Use ref to track room ID for callbacks
  const roomIdRef = useRef<string | null>(null);

  const initializeChat = async () => {
    try {
      setIsLoading(true);

      // Check auth
      const token = await authService.getToken();
      if (!token) {
        throw new Error("No auth token found");
      }

      chatService.updateToken(token);

      // Get current user info first
      const userInfo = await authService.getUserData();
      setCurrentUserId(userInfo.id);

      await chatService.connect();

      // Find/create room FIRST
      const rooms = await chatService.getRooms();
      let existingRoom = rooms.find(
        (r) =>
          (appointmentId && (r as any).appointmentId === appointmentId) ||
          (r.doctorId && r.doctorId._id === doctorId)
      );

      if (!existingRoom) {
        existingRoom = await chatService.createRoom({
          patientId: userInfo.id,
          doctorId: doctorId,
          appointmentId: appointmentId || "",
        });
      }

      // Set room in both state and ref
      setRoom(existingRoom);
      roomIdRef.current = existingRoom._id;
      console.log("🏠 [Hook] Room set in state and ref:", existingRoom._id);

      // Setup event handlers AFTER room is set
      const eventHandlers: ChatEventHandlers = {
        onMessageReceived: (message) => {
          console.log(
            "📨 [Hook] Event handler called with message:",
            message._id
          );
          console.log(
            "📨 [Hook] Room ID in ref at event time:",
            roomIdRef.current
          );
          handleMessageReceived(message);
        },
        onConnected: () => {
          console.log(
            "🔌 [Hook] Connected to chat - setting isConnected to true"
          );
          setIsConnected(true);
        },
        onDisconnected: () => {
          console.log(
            "🔌 [Hook] Disconnected from chat - setting isConnected to false"
          );
          setIsConnected(false);
        },
        onRoomJoined: (data) => {
          console.log("🏠 [Hook] Room joined:", data);
          setOnlineCount(data.roomMemberCount || 0);
        },
        onUserTyping: (data) => {
          if (
            data.roomId === roomIdRef.current &&
            data.userId !== userInfo.id
          ) {
            console.log("✍️ [Hook] User typing:", data);
            setIsTyping(data.isTyping);
          }
        },
        onError: (error) => {
          console.error("❌ [Hook] Chat error:", error);
          onError?.(error.message || "Chat error");
        },
      };

      console.log(
        "📨 [Hook] Setting up event handlers for room:",
        existingRoom._id
      );
      chatService.setEventHandlers(eventHandlers);

      // Wait for WebSocket connection before proceeding
      console.log("🔌 [Hook] Checking WebSocket connection state...");
      const connectionState = chatService.getConnectionState();
      console.log("🔌 [Hook] Connection state:", connectionState);

      if (connectionState === "connected") {
        console.log("🔌 [Hook] WebSocket already connected, setting state");
        setIsConnected(true);
      } else {
        console.log(
          "🔌 [Hook] WebSocket not connected, will wait for onConnected event"
        );
      }

      // Load messages
      const { messages: backendMessages } = await chatService.getMessages(
        existingRoom._id,
        1
      );

      console.log(
        "📨 [Hook] Raw messages from API:",
        JSON.stringify(backendMessages, null, 2)
      );

      // Filter out invalid messages and log them
      const validMessages = backendMessages.filter((msg) => {
        const isValid = msg._id && msg.createdAt && msg.messageType;
        if (!isValid) {
          console.warn("⚠️ [Hook] Invalid message found:", msg);
        }
        return isValid;
      });

      console.log("📨 [Hook] Valid messages after filtering:", {
        original: backendMessages.length,
        valid: validMessages.length,
        sampleMessage: validMessages[0]
          ? {
              id: validMessages[0]._id,
              messageType: validMessages[0].messageType,
              fileUrl: validMessages[0].fileUrl,
            }
          : null,
      });

      setMessages(validMessages);

      // Join room
      chatService.joinRoom(existingRoom._id);
    } catch (error) {
      console.error("❌ Failed to initialize chat:", error);
      onError?.((error as Error).message || "Failed to initialize chat");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMessageReceived = useCallback(
    (newMessage: Message) => {
      console.log("📨 [Hook] Received message:", newMessage._id);
      console.log(
        "📨 [Hook] Message details:",
        JSON.stringify(newMessage, null, 2)
      );
      console.log("📨 [Hook] Current room ID from ref:", roomIdRef.current);
      console.log("📨 [Hook] Current room ID from state:", room?._id);
      console.log(
        "📨 [Hook] Message room ID:",
        newMessage.chatRoomId || newMessage.roomId
      );

      // Check if this message belongs to the current room using ref
      const messageRoomId = newMessage.chatRoomId || newMessage.roomId;
      if (messageRoomId !== roomIdRef.current) {
        console.log("⚠️ [Hook] Message not for current room, ignoring");
        console.log(
          "⚠️ [Hook] Expected:",
          roomIdRef.current,
          "Got:",
          messageRoomId
        );
        return;
      }

      console.log("✅ [Hook] Message is for current room, processing...");

      setMessages((prev) => {
        console.log("📨 [Hook] Current messages count:", prev.length);

        // Check if message already exists to prevent duplicates
        const exists = prev.some((msg) => msg._id === newMessage._id);
        if (exists) {
          console.log("🔄 [Hook] Message already exists, skipping");
          return prev;
        }

        console.log("➕ [Hook] Adding new message to state");
        const updated = [...prev, newMessage];
        console.log("📨 [Hook] Updated messages count:", updated.length);
        console.log("📨 [Hook] New message added:", {
          id: newMessage._id,
          messageType: newMessage.messageType,
          content: newMessage.messageText || newMessage.content,
        });
        return updated;
      });
    },
    [] // Remove room dependency since we're using ref
  );

  const sendMessage = async (content: string) => {
    if (!room || isSending) return;

    setIsSending(true);
    try {
      await chatService.sendMessageToDoctor(room._id, content);
    } catch (error) {
      onError?.((error as Error).message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleVideoCall = useCallback(async () => {
    if (!room) {
      console.warn("⚠️ No room available for video call");
      onError?.("No chat room available");
      return;
    }

    try {
      console.log("📞 Starting video call...");
      console.log("📞 Room ID:", room._id);
      console.log("📞 Doctor ID:", doctorId);

      // Connect to call service if not connected
      await chatService.connectCallService();

      // Get the other participant (doctor) ID
      const otherParticipant = chatService.getOtherParticipant(
        room,
        currentUserId
      );
      console.log("📞 Calling to:", otherParticipant);

      // Initiate video call
      const callId = await chatService.initiateVideoCall(
        otherParticipant.id,
        room._id
      );
      console.log("📞 Video call initiated with ID:", callId);
    } catch (error) {
      console.error("❌ Error starting video call:", error);
      onError?.(`Failed to start video call: ${error.message}`);
    }
  }, [room, doctorId, currentUserId, onError]);

  return {
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
    handleVideoCall,
  };
};
