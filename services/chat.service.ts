import { io, Socket } from "socket.io-client";
import { authService } from "./authServices.service";

interface ChatRoom {
  _id: string;
  patientId: {
    _id: string;
    fullName: string;
    avatarUrl?: string;
  };
  doctorId: {
    _id: string;
    fullName: string;
    photoUrl?: string;
  };
  lastMessageId?: {
    content: string;
    createdAt: string;
  };
  unreadCountPatient: number;
  unreadCountDoctor: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Message {
  _id: string;
  chatRoomId?: string;
  roomId?: string;
  senderId?:
    | {
        _id: string;
        fullName: string;
        avatarUrl?: string;
        email?: string;
        role?: string;
      }
    | string
    | null;
  senderType?: "patient" | "doctor";
  messageText?: string; // Updated field name from backend
  content?: string; // Keep as fallback
  messageType: "text" | "image" | "file" | "audio" | "video";
  attachments?: string[];
  timestamp?: string;
  createdAt: string; // Keep as string from backend
  updatedAt?: string; // Make optional and string
  isRead?: boolean; // Make optional
  readAt?: string;
  isDeleted?: boolean;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  senderName?: string;
  isEdited?: boolean;
  __v?: number; // Add MongoDB version field
}

interface CreateRoomRequest {
  patientId: string;
  doctorId: string;
  appointmentId: string;
}

interface SendMessageRequest {
  content: string;
  messageType: "text" | "image" | "file" | "audio" | "video";
  attachments?: string[];
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

interface ChatEventHandlers {
  onMessageReceived?: (message: Message) => void;
  onMessageRead?: (data: {
    roomId: string;
    userId: string;
    messageId: string;
  }) => void;
  onUserTyping?: (data: {
    roomId: string;
    userId: string;
    isTyping: boolean;
  }) => void;
  onUserOnlineStatus?: (data: { userId: string; isOnline: boolean }) => void;
  onRoomUpdated?: (room: any) => void;
  onRoomJoined?: (data: {
    roomId: string;
    userId: string;
    roomMemberCount?: number;
  }) => void;
  // Add seen message event handlers
  onMessagesMarkedSeen?: (data: {
    roomId: string;
    messageIds: string[];
    userId: string;
  }) => void;
  onUserSeenMessages?: (data: {
    roomId: string;
    seenBy: string;
    messageIds: string[];
    seenAt: string;
  }) => void;
  onMessagesSeenSync?: (data: {
    roomId: string;
    messageIds: string[];
    seenBy: string;
  }) => void;
  onUserViewingChat?: (data: {
    roomId: string;
    userId: string;
    isViewing: boolean;
    userName?: string;
  }) => void;
  onError?: (error: any) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

class ChatService {
  private socket: Socket | null = null;
  private baseURL: string;
  private token: string | null = null;
  private eventHandlers: ChatEventHandlers = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private connectionState = false;
  private pendingRoomId: string | null = null;
  private processedMessages = new Set<string>();
  private lastMessageProcessTime = new Map<string, number>(); // Add debouncing map
  private messageProcessingTimeout: NodeJS.Timeout | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    console.log("🔧 ChatService initialized with baseURL:", baseURL);
    this.initializeToken();
  }

  private async initializeToken() {
    try {
      this.token = await authService.getToken();
      console.log(
        "🔑 Auth token initialized:",
        this.token ? `${this.token.substring(0, 20)}...` : "null"
      );

      // Validate token format
      if (this.token) {
        const parts = this.token.split(".");
        console.log("🔍 Token parts count:", parts.length);
        console.log(
          "🔍 Token starts with 'eyJ':",
          this.token.startsWith("eyJ")
        );

        if (parts.length !== 3) {
          console.error("❌ Invalid JWT format - should have 3 parts");
        }
      }
    } catch (error) {
      console.error("❌ Failed to get auth token:", error);
    }
  }

  private async getAuthHeaders() {
    if (!this.token) {
      await this.initializeToken();
    }
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };
    console.log("📋 Auth headers prepared:", {
      "Content-Type": headers["Content-Type"],
      Authorization: headers.Authorization
        ? `Bearer ${headers.Authorization.substring(7, 27)}...`
        : "null",
    });
    return headers;
  }

  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers = await this.getAuthHeaders();
    const url = `${this.baseURL}${endpoint}`;

    console.log("🌐 Making API request:", {
      method: options.method || "GET",
      url,
      headers: {
        "Content-Type": headers["Content-Type"],
        Authorization: headers.Authorization ? "Bearer ***" : "null",
      },
      body: options.body ? JSON.parse(options.body as string) : null,
    });

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    console.log(
      "📡 API Response status:",
      response.status,
      response.statusText
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("❌ API Error response:", errorData);
      throw new Error(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const result: ApiResponse<T> = await response.json();
    console.log("✅ API Success response:", {
      success: result.success,
      message: result.message,
      dataType: typeof result.data,
      dataLength: Array.isArray(result.data) ? result.data.length : "not array",
      hasPagination: !!(result as any).pagination,
      data: result.data,
    });

    if (!result.success) {
      console.error("❌ API returned success: false:", result);
      throw new Error(result.message || "API request failed");
    }

    // Return result.data directly for the new format
    // The caller will handle pagination separately if needed
    return result.data;
  }

  // REST API Methods
  async createRoom(data: CreateRoomRequest): Promise<ChatRoom> {
    console.log("🏗️ Creating chat room with data:", data);
    const result = await this.apiRequest<ChatRoom>("/chat/rooms", {
      method: "POST",
      body: JSON.stringify(data),
    });
    console.log("🏠 Room created successfully:", result);
    return result;
  }

  async getRooms(): Promise<ChatRoom[]> {
    console.log("📋 Fetching chat rooms...");
    const result = await this.apiRequest<ChatRoom[]>("/chat/rooms");
    console.log("📋 Rooms fetched:", result.length, "rooms found");

    // Add null checks for doctor/patient data
    result.forEach((room, index) => {
      console.log(`📋 Room ${index + 1}:`, {
        id: room._id,
        patientName: room.patientId?.fullName || "Unknown Patient",
        doctorName: room.doctorId?.fullName || "Unknown Doctor",
        unreadPatient: room.unreadCountPatient || 0,
        unreadDoctor: room.unreadCountDoctor || 0,
        lastMessage: room.lastMessageId?.content || "No messages",
        // Log raw data for debugging
        rawPatientId: room.patientId,
        rawDoctorId: room.doctorId,
      });
    });

    return result;
  }

  async getRoomDetails(roomId: string): Promise<ChatRoom> {
    console.log("🔍 Fetching room details for ID:", roomId);
    const result = await this.apiRequest<ChatRoom>(`/chat/rooms/${roomId}`);
    console.log("🔍 Room details fetched:", {
      id: result._id,
      patientName: result.patientId?.fullName || "Unknown Patient",
      doctorName: result.doctorId?.fullName || "Unknown Doctor",
      unreadPatient: result.unreadCountPatient || 0,
      unreadDoctor: result.unreadCountDoctor || 0,
      // Log raw data for debugging
      rawPatientId: result.patientId,
      rawDoctorId: result.doctorId,
    });
    return result;
  }

  async createRoomFromAppointment(appointmentId: string): Promise<ChatRoom> {
    console.log("🏗️ Creating room from appointment ID:", appointmentId);

    try {
      const result = await this.apiRequest<ChatRoom>(
        `/chat/rooms/appointment/${appointmentId}`,
        {
          method: "POST",
        }
      );

      // Check if the response contains actual room data
      if (!result._id) {
        console.log(
          "⚠️ Server response missing room ID - feature not implemented yet"
        );
        throw new Error(
          "Room creation from appointment not yet implemented on server"
        );
      }

      console.log("🏠 Room created from appointment:", {
        roomId: result._id,
        appointmentId,
        patientName: result.patientId?.fullName || "Unknown Patient",
        doctorName: result.doctorId?.fullName || "Unknown Doctor",
      });

      return result;
    } catch (error) {
      console.log(
        "❌ Server doesn't support room creation from appointment:",
        error.message
      );
      throw error;
    }
  }

  async sendMessage(
    roomId: string,
    data: SendMessageRequest & {
      imageUrl?: string;
      fileUrl?: string;
      fileName?: string;
    }
  ): Promise<Message> {
    console.log("💬 Sending message to room:", roomId, "with data:", data);

    // Use the correct format that matches the backend expectation
    const backendData = {
      content: data.content,
      messageType: data.messageType,
      attachments: data.attachments || [],
      // Backend only accepts fileUrl, not imageUrl
      ...(data.fileUrl && { fileUrl: data.fileUrl }),
      ...(data.fileName && { fileName: data.fileName }),
    };

    console.log("💬 Backend formatted data:", backendData);

    const result = await this.apiRequest<Message>(
      `/chat/rooms/${roomId}/messages`,
      {
        method: "POST",
        body: JSON.stringify(backendData),
      }
    );
    console.log("💬 Message sent successfully:", {
      messageId: result._id,
      content: result.content,
      messageType: result.messageType,
      attachments: result.attachments,
      imageUrl: result.imageUrl,
      fileUrl: result.fileUrl,
      senderId: result.senderId,
      createdAt: result.createdAt,
    });
    return result;
  }

  // Update the sendMessageToDoctor to use HTTP API (as backend expects)
  async sendMessageToDoctor(roomId: string, content: string): Promise<Message> {
    console.log("💬 Sending message via HTTP API (Backend suggested approach)");
    console.log("💬 Message content:", content.substring(0, 50));
    console.log("💬 Room ID:", roomId);

    // Use the exact format the backend expects
    const messageData = {
      content: content.trim(),
      messageType: "text",
    };

    console.log("💬 Sending with data:", messageData);

    const result = await this.apiRequest<Message>(
      `/chat/rooms/${roomId}/messages`,
      {
        method: "POST",
        body: JSON.stringify(messageData),
      }
    );

    console.log("✅ Message sent via HTTP API:", {
      messageId: result._id,
      chatRoomId: result.chatRoomId,
      messageText: result.messageText || result.content,
      messageType: result.messageType,
      senderId: result.senderId,
      timestamp: result.timestamp || result.createdAt,
    });
    console.log("📡 WebSocket events should handle UI update automatically");

    return result;
  }

  async getMessages(
    roomId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ messages: Message[]; pagination: any }> {
    console.log("📨 Fetching messages for room:", roomId);

    try {
      const endpoint = `/chat/rooms/${roomId}/messages`;
      const response = await this.apiRequest<any>(endpoint);

      console.log("📨 [DEBUG] Raw API response type:", typeof response);
      console.log(
        "📨 [DEBUG] Raw API response keys:",
        Object.keys(response || {})
      );
      console.log("📨 [DEBUG] Is array:", Array.isArray(response));
      console.log(
        "📨 [DEBUG] Raw API response:",
        JSON.stringify(response, null, 2)
      );

      let messages: Message[] = [];
      let pagination: any = null;

      if (response && Array.isArray(response)) {
        messages = response;
        pagination = {
          page,
          limit,
          total: response.length,
          hasMore: response.length === limit,
        };
        console.log("📨 [DEBUG] Using direct array format");
      } else {
        console.warn("⚠️ Unexpected message response format:", response);
        messages = [];
        pagination = { page, limit, total: 0, hasMore: false };
      }

      console.log("📨 [DEBUG] Final messages array:", {
        count: messages.length,
        firstMessage: messages[0]
          ? {
              _id: messages[0]._id,
              messageType: messages[0].messageType,
              messageText: messages[0].messageText,
              content: messages[0].content,
              senderId: messages[0].senderId,
              createdAt: messages[0].createdAt,
              fileUrl: messages[0].fileUrl,
              attachments: messages[0].attachments,
            }
          : null,
      });

      return { messages, pagination };
    } catch (error) {
      console.error("❌ Error fetching messages:", error);
      throw error;
    }
  }

  async markAsRead(roomId: string): Promise<void> {
    console.log("✅ Marking room as read:", roomId);
    await this.apiRequest(`/chat/rooms/${roomId}/read`, {
      method: "PATCH",
    });
    console.log("✅ Room marked as read successfully");
  }

  // WebSocket Methods
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        console.log("🔌 WebSocket already connected");
        resolve();
        return;
      }

      // Clean up any existing socket first
      if (this.socket) {
        console.log("🧹 Cleaning up existing socket before reconnecting");
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
      }

      // Refresh token before connecting
      this.initializeToken()
        .then(() => {
          // Convert HTTP URL to WebSocket URL format
          let wsURL: string;
          if (
            this.baseURL.includes("localhost") ||
            this.baseURL.includes("127.0.0.1") ||
            this.baseURL.includes("192.168.1.4")
          ) {
            wsURL = this.baseURL.replace(/^https?:\/\//, "ws://");
          } else {
            wsURL = this.baseURL
              .replace(/^https:\/\//, "wss://")
              .replace(/^http:\/\//, "ws://");
          }

          console.log(
            "🔌 Attempting WebSocket connection to:",
            wsURL + "/chat"
          );
          console.log(
            "🔌 Auth token for WebSocket:",
            this.token ? `${this.token.substring(0, 50)}...` : "null"
          );

          this.socket = io(wsURL + "/chat", {
            auth: { token: this.token },
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
            timeout: 10000,
            forceNew: true,
          });

          // 1. Handle basic connection
          this.socket.on("connect", () => {
            console.log("✅ Chat WebSocket connected successfully");
            console.log("🔌 Socket ID:", this.socket?.id);
            console.log("🔌 Transport:", this.socket?.io.engine.transport.name);
            this.reconnectAttempts = 0;
            console.log(
              "🔌 Basic connection established, waiting for authentication..."
            );
            resolve();
          });

          // 2. Handle authenticated connection - AUTO JOIN ROOM HERE
          this.socket.on("connected", (data) => {
            console.log("✅ Connected to chat server (authenticated):", data);
            this.connectionState = true;
            console.log("🔌 Calling onConnected handler...");

            // AUTO-JOIN ROOM immediately after authentication
            if (this.pendingRoomId) {
              console.log(
                "🏠 AUTO-JOINING room after authentication:",
                this.pendingRoomId
              );
              this.joinRoomImmediately(this.pendingRoomId);
            }

            // Call the connected handler
            if (this.eventHandlers.onConnected) {
              console.log("🔌 Calling onConnected event handler");
              this.eventHandlers.onConnected();
            } else {
              console.warn("⚠️ No onConnected handler registered!");
            }
          });

          // 3. room_joined - Track room membership and online count
          this.socket.on("room_joined", (data) => {
            console.log("🏠 Joined room:", data);
            console.log("👥 Member count:", data.roomMemberCount);
            this.eventHandlers.onRoomJoined?.(data);
          });

          // 4. room_update - Track connection statistics
          this.socket.on("room_update", (data) => {
            console.log("📊 Room update:", data);
            console.log("🔗 Total connections:", data.totalConnections);
            console.log("👤 Unique users:", data.uniqueUsers);
            this.eventHandlers.onRoomUpdated?.(data);
          });

          // 5. user_joined - Someone else joined
          this.socket.on("user_joined", (data) => {
            console.log("👤 Someone joined room:", data);
            // Update UI if needed
          });

          // 6. new_message - PRIMARY message event (MAIN EVENT)
          this.socket.on("new_message", (data) => {
            console.log("📨 NEW MESSAGE (PRIMARY EVENT - Raw data):", data);
            this.handleIncomingMessage(data, "PRIMARY");
          });

          // 7. message_received - BACKUP message event (BACKUP DELIVERY)
          this.socket.on("message_received", (data) => {
            console.log("📨 MESSAGE RECEIVED (BACKUP EVENT - Raw data):", data);
            this.handleIncomingMessage(data, "BACKUP");
          });

          // 8. user_typing - Typing indicators
          this.socket.on("user_typing", (data) => {
            console.log("✍️ User typing via BE event:", data);
            const typingData = {
              roomId: data.roomId,
              userId: data.userId,
              isTyping: data.isTyping,
              userName: data.userName,
            };
            this.eventHandlers.onUserTyping?.(typingData);
          });

          // 9. messages_marked_seen - Seen confirmations
          this.socket.on("messages_marked_seen", (data) => {
            console.log("✅ Messages marked as seen:", data);
            this.eventHandlers.onMessagesMarkedSeen?.(data);
          });

          // 10. user_seen_messages - When others see your messages
          this.socket.on("user_seen_messages", (data) => {
            console.log("👁️ Someone saw messages:", data);
            this.eventHandlers.onUserSeenMessages?.(data);
          });

          // 11. messages_seen_sync - Cross-device sync for seen status
          this.socket.on("messages_seen_sync", (data) => {
            console.log("🔄 Syncing seen status across devices:", data);
            this.eventHandlers.onMessagesSeenSync?.(data);
          });

          // 12. user_viewing_chat - Typing and viewing indicators
          this.socket.on("user_viewing_chat", (data) => {
            console.log("👁️ User viewing chat:", data);
            this.eventHandlers.onUserViewingChat?.(data);
          });

          // 13. auto_mark_seen_trigger - Auto mark seen trigger
          this.socket.on("auto_mark_seen_trigger", (data) => {
            console.log("🔄 Auto mark seen trigger:", data);
            // Automatically mark messages as seen when triggered by server
            this.markMessagesAsSeen(data.roomId, data.messageIds);
          });

          // Error handling
          this.socket.on("connection_error", (data) => {
            console.error("❌ Authentication error:", data);
            this.eventHandlers.onError?.(
              new Error(
                `Auth error: ${data.message || "Authentication failed"}`
              )
            );
            reject(
              new Error(
                `Authentication failed: ${data.message || "Unknown auth error"}`
              )
            );
          });

          this.socket.on("disconnect", (reason, details) => {
            console.log("❌ Chat WebSocket disconnected:", reason, details);
            this.connectionState = false;
            this.eventHandlers.onDisconnected?.();
          });

          this.socket.on("connect_error", (error) => {
            console.error("❌ Chat WebSocket connection error:", error);
            this.reconnectAttempts++;
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
              this.eventHandlers.onError?.(error);
              reject(error);
            }
          });

          this.socket.on("error", (error: any) => {
            console.error("❌ Backend WebSocket error:", error);
            this.eventHandlers.onError?.(error);
          });

          // Connection timeout
          setTimeout(() => {
            if (!this.socket?.connected) {
              console.error("⏰ WebSocket connection timeout");
              reject(new Error("WebSocket connection timeout"));
            }
          }, 10000);
        })
        .catch((tokenError) => {
          console.error(
            "❌ Failed to refresh token before connection:",
            tokenError
          );
          reject(tokenError);
        });
    });
  }

  disconnect(): void {
    if (this.socket) {
      console.log("🔌 Disconnecting WebSocket...");
      this.socket.disconnect();
      this.socket = null;
      console.log("✅ WebSocket disconnected");
    }

    // Clean up processed messages cache
    this.clearProcessedMessages();
  }

  // Event handler registration
  setEventHandlers(handlers: ChatEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  // WebSocket message sending - Match BE's expected events
  sendTypingStatus(roomId: string, isTyping: boolean): void {
    if (this.socket?.connected) {
      authService
        .getUserData()
        .then((userInfo) => {
          if (isTyping) {
            console.log("✍️ Sending typing_start to backend");
            this.socket?.emit("typing_start", {
              roomId,
              userId: userInfo?.id || "unknown",
              userName: userInfo?.fullName || "User",
            });
          } else {
            console.log("✍️ Sending typing_stop to backend");
            this.socket?.emit("typing_stop", {
              roomId,
              userId: userInfo?.id || "unknown",
            });
          }
        })
        .catch((error) => {
          console.warn("⚠️ Could not get user info for typing");
        });
    }
  }

  // Immediate room join (used in connected event)
  private joinRoomImmediately(roomId: string): void {
    if (this.socket?.connected) {
      console.log("🏠 IMMEDIATE room join:", roomId);

      authService
        .getUserData()
        .then((userInfo) => {
          const joinData = {
            roomId,
            userId: userInfo?.id || "unknown",
          };

          console.log("🏠 Emitting join_room with data:", joinData);
          this.socket?.emit("join_room", joinData);

          this.pendingRoomId = null; // Clear pending room ID
        })
        .catch((error) => {
          console.warn(
            "⚠️ Could not get user info for immediate room join:",
            error
          );
        });
    }
  }

  // Auto-join room when connection is established
  autoJoinRoom(roomId: string): void {
    if (!roomId) {
      console.warn("⚠️ Cannot auto-join: no room ID provided");
      return;
    }

    console.log("🏠 Setting up auto-join for room:", roomId);
    this.pendingRoomId = roomId;

    if (this.socket?.connected && this.connectionState) {
      console.log("🏠 WebSocket ready, joining room immediately");
      this.joinRoomImmediately(roomId);
    } else {
      console.log("🏠 WebSocket not ready, will auto-join when connected");
    }
  }

  joinRoom(roomId: string): void {
    if (this.socket?.connected) {
      console.log("🏠 Manual room join:", roomId);
      this.joinRoomImmediately(roomId);
    } else {
      console.warn(
        "⚠️ Cannot join room: WebSocket not connected, storing for auto-join"
      );
      this.pendingRoomId = roomId;
    }
  }

  leaveRoom(roomId: string): void {
    if (this.socket?.connected) {
      console.log("🚪 Leaving room via BE event:", roomId);

      authService
        .getUserData()
        .then((userInfo) => {
          console.log("🚪 Emitting leave_room to backend");
          this.socket?.emit("leave_room", {
            roomId,
            userId: userInfo?.id || "unknown",
          });
        })
        .catch((error) => {
          console.warn("⚠️ Could not get user info for leaving room");
        });
    } else {
      console.warn("⚠️ Cannot leave room: WebSocket not connected");
    }
  }

  // Add ping method as BE suggests
  ping(): void {
    if (this.socket?.connected) {
      console.log("🏓 Sending ping to server");
      this.socket?.emit("ping");
    }
  }

  // Update token when user logs in/out
  updateToken(token: string | null): void {
    console.log(
      "🔑 Updating auth token:",
      token ? `${token.substring(0, 50)}...` : "null"
    );

    // Validate token format before setting
    if (token) {
      const parts = token.split(".");
      console.log("🔍 New token validation:");
      console.log("   Parts count:", parts.length);
      console.log("   Starts with 'eyJ':", token.startsWith("eyJ"));
      console.log("   Length:", token.length);

      if (parts.length !== 3) {
        console.error("❌ Invalid JWT format provided to updateToken");
        return;
      }
    }

    this.token = token;

    if (this.socket?.connected) {
      console.log("🔄 Reconnecting WebSocket with new token...");
      // Reconnect with new token
      this.disconnect();
      if (token) {
        this.connect().catch(console.error);
      }
    }
  }

  // Health check - Keep method name, use renamed property
  isConnected(): boolean {
    const connected = this.socket?.connected && this.connectionState;
    console.log("🔍 WebSocket connection status:", connected);
    return connected;
  }

  getConnectionState(): string {
    if (!this.socket) {
      console.log("🔍 WebSocket state: disconnected (no socket)");
      return "disconnected";
    }

    const isSocketConnected = this.socket.connected;
    const isAuthenticated = this.connectionState;

    console.log("🔍 WebSocket connection details:", {
      socketConnected: isSocketConnected,
      authenticated: isAuthenticated,
      finalState:
        isSocketConnected && isAuthenticated ? "connected" : "connecting",
    });

    const state =
      isSocketConnected && isAuthenticated ? "connected" : "connecting";
    console.log("🔍 WebSocket state:", state);
    return state;
  }

  // Add method to test token validity
  async testTokenValidity(): Promise<boolean> {
    try {
      console.log("🧪 Testing token validity...");

      const token = await authService.getToken();
      console.log("🔍 Raw token from storage:", token);

      if (!token) {
        console.error("❌ No token found");
        return false;
      }

      // Test with a simple API call
      const response = await fetch(`${this.baseURL}/auth/verify-token`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log("🧪 Token test response status:", response.status);

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Token is valid:", result);
        return true;
      } else {
        const error = await response.json().catch(() => ({}));
        console.error("❌ Token is invalid:", error);
        return false;
      }
    } catch (error) {
      console.error("❌ Error testing token:", error);
      return false;
    }
  }

  // Message formatting utilities
  formatMessage(content: string, type: string = "text"): SendMessageRequest {
    return {
      content: content.trim(),
      messageType: type as any,
    };
  }

  formatImageMessage(content: string, imageUrl: string): SendMessageRequest {
    return {
      content,
      messageType: "image",
      attachments: [imageUrl],
    };
  }

  formatFileMessage(
    content: string,
    attachments: string[],
    messageType: "image" | "file" | "audio" | "video"
  ): SendMessageRequest {
    return {
      content,
      messageType,
      attachments,
    };
  }

  formatMultipleFilesMessage(
    content: string,
    fileUrls: string[]
  ): SendMessageRequest {
    return {
      content,
      messageType: "file",
      attachments: fileUrls,
    };
  }

  // Helper method to get current user role
  getCurrentUserRole(
    room: ChatRoom,
    currentUserId: string
  ): "patient" | "doctor" | null {
    if (room.patientId?._id === currentUserId) return "patient";
    if (room.doctorId?._id === currentUserId) return "doctor";
    console.warn("⚠️ Could not determine user role:", {
      currentUserId,
      patientId: room.patientId?._id,
      doctorId: room.doctorId?._id,
    });
    return null;
  }

  // Helper method to get unread count for current user - with null checks
  getUnreadCount(room: ChatRoom, currentUserId: string): number {
    const role = this.getCurrentUserRole(room, currentUserId);
    if (role === "patient") return room.unreadCountPatient || 0;
    if (role === "doctor") return room.unreadCountDoctor || 0;
    return 0;
  }

  // Helper method to get other participant info - with null checks
  getOtherParticipant(
    room: ChatRoom,
    currentUserId: string
  ): { id: string; name: string; avatar?: string } {
    const role = this.getCurrentUserRole(room, currentUserId);

    if (role === "patient" && room.doctorId) {
      return {
        id: room.doctorId._id,
        name: room.doctorId.fullName || "Unknown Doctor",
        avatar: room.doctorId.photoUrl,
      };
    } else if (role === "doctor" && room.patientId) {
      return {
        id: room.patientId._id,
        name: room.patientId.fullName || "Unknown Patient",
        avatar: room.patientId.avatarUrl,
      };
    } else {
      // Fallback when role detection fails or participant data is missing
      console.warn("⚠️ Could not determine other participant:", {
        role,
        currentUserId,
        hasPatientId: !!room.patientId,
        hasDoctorId: !!room.doctorId,
      });

      // Try to return the other participant based on available data
      if (room.patientId && room.patientId._id !== currentUserId) {
        return {
          id: room.patientId._id,
          name: room.patientId.fullName || "Unknown Patient",
          avatar: room.patientId.avatarUrl,
        };
      } else if (room.doctorId && room.doctorId._id !== currentUserId) {
        return {
          id: room.doctorId._id,
          name: room.doctorId.fullName || "Unknown Doctor",
          avatar: room.doctorId.photoUrl,
        };
      } else {
        // Last resort fallback
        return {
          id: "unknown",
          name: "Unknown User",
          avatar: undefined,
        };
      }
    }
  }

  // Utility methods for file uploads
  async uploadImage(
    roomId: string,
    asset: any,
    content?: string
  ): Promise<any> {
    try {
      console.log("🔧 [ChatService] Starting image upload...");
      console.log("📍 Room ID:", roomId);
      console.log("📁 Asset details:", {
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        fileSize: asset.fileSize,
      });
      console.log("💬 Content:", content || "No content");
      console.log("🌐 Base URL:", this.baseURL);

      const formData = new FormData();

      formData.append("image", {
        uri: asset.uri,
        type: asset.mimeType || "image/jpeg",
        name: asset.fileName || "image.jpg",
      } as any);

      if (content) {
        formData.append("content", content);
      }

      console.log("📋 FormData prepared");

      const token = await authService.getToken();
      if (!token) {
        throw new Error("No auth token found");
      }
      console.log("🔑 Auth token:", token.substring(0, 20) + "...");

      const uploadUrl = `${this.baseURL}/chat/rooms/${roomId}/upload-image`;
      console.log("🚀 Upload URL:", uploadUrl);

      console.log("📤 Starting fetch request...");
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Don't set Content-Type for multipart/form-data - let fetch handle it
        },
        body: formData,
      });

      console.log("📥 Response received:");
      console.log("   Status:", response.status);
      console.log("   StatusText:", response.statusText);
      console.log(
        "   Headers:",
        Object.fromEntries(response.headers.entries())
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Upload failed response body:", errorText);
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log("✅ Upload successful, response:", result);
      return result;
    } catch (error) {
      console.error("❌ [ChatService] Error uploading image:");
      console.error("   Error type:", error.constructor.name);
      console.error("   Error message:", error.message);
      console.error("   Error stack:", error.stack);
      throw error;
    }
  }

  async uploadFiles(
    roomId: string,
    assets: any[],
    content?: string
  ): Promise<any> {
    try {
      console.log("🔧 [ChatService] Starting files upload...");
      console.log("📍 Room ID:", roomId);
      console.log("📁 Assets count:", assets.length);
      assets.forEach((asset, index) => {
        console.log(`   Asset ${index + 1}:`, {
          name: asset.name,
          uri: asset.uri,
          mimeType: asset.mimeType,
          size: asset.size,
        });
      });
      console.log("💬 Content:", content || "No content");
      console.log("🌐 Base URL:", this.baseURL);

      const formData = new FormData();

      assets.forEach((asset, index) => {
        console.log(`📎 Adding asset ${index + 1} to FormData`);
        formData.append("files", {
          uri: asset.uri,
          type: asset.mimeType || "application/octet-stream",
          name: asset.name,
        } as any);
      });

      if (content) {
        formData.append("content", content);
      }

      console.log("📋 FormData prepared");

      const token = await authService.getToken();
      if (!token) {
        throw new Error("No auth token found");
      }
      console.log("🔑 Auth token:", token.substring(0, 20) + "...");

      const uploadUrl = `${this.baseURL}/chat/rooms/${roomId}/upload`;
      console.log("🚀 Upload URL:", uploadUrl);

      console.log("📤 Starting fetch request...");
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Don't set Content-Type for multipart/form-data - let fetch handle it
        },
        body: formData,
      });

      console.log("📥 Response received:");
      console.log("   Status:", response.status);
      console.log("   StatusText:", response.statusText);
      console.log(
        "   Headers:",
        Object.fromEntries(response.headers.entries())
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Upload failed response body:", errorText);
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log("✅ Upload successful, response:", result);
      return result;
    } catch (error) {
      console.error("❌ [ChatService] Error uploading files:");
      console.error("   Error type:", error.constructor.name);
      console.error("   Error message:", error.message);
      console.error("   Error stack:", error.stack);
      throw error;
    }
  }

  // WebSocket seen message methods
  markMessagesAsSeen(
    roomId: string,
    messageIds: string[] = [],
    lastSeenMessageId?: string
  ): void {
    if (this.socket?.connected) {
      authService
        .getUserData()
        .then((userInfo) => {
          const seenData = {
            roomId,
            userId: userInfo?.id || "unknown",
            messageIds,
            lastSeenMessageId,
          };

          console.log("👁️ Emitting mark_messages_seen:", seenData);
          this.socket?.emit("mark_messages_seen", seenData);
        })
        .catch((error) => {
          console.warn("⚠️ Could not get user info for marking messages seen");
        });
    }
  }

  userEnteredChat(roomId: string): void {
    if (this.socket?.connected) {
      authService
        .getUserData()
        .then((userInfo) => {
          const enterData = {
            roomId,
            userId: userInfo?.id || "unknown",
          };

          console.log("🚪 Emitting user_entered_chat:", enterData);
          this.socket?.emit("user_entered_chat", enterData);
        })
        .catch((error) => {
          console.warn("⚠️ Could not get user info for user entered chat");
        });
    }
  }

  userLeftChat(roomId: string): void {
    if (this.socket?.connected) {
      authService
        .getUserData()
        .then((userInfo) => {
          const leaveData = {
            roomId,
            userId: userInfo?.id || "unknown",
          };

          console.log("🚪 Emitting user_left_chat:", leaveData);
          this.socket?.emit("user_left_chat", leaveData);
        })
        .catch((error) => {
          console.warn("⚠️ Could not get user info for user left chat");
        });
    }
  }

  setUserViewingChat(roomId: string, isViewing: boolean): void {
    if (this.socket?.connected) {
      authService
        .getUserData()
        .then((userInfo) => {
          const viewingData = {
            roomId,
            userId: userInfo?.id || "unknown",
            isViewing,
            userName: userInfo?.fullName || "User",
          };

          console.log("👁️ Emitting user_viewing_chat:", viewingData);
          this.socket?.emit("user_viewing_chat", viewingData);
        })
        .catch((error) => {
          console.warn("⚠️ Could not get user info for viewing chat");
        });
    }
  }

  getMessageSeenStatus(roomId: string, messageIds: string[] = []): void {
    if (this.socket?.connected) {
      authService
        .getUserData()
        .then((userInfo) => {
          const statusData = {
            roomId,
            userId: userInfo?.id || "unknown",
            messageIds,
          };

          console.log("📊 Emitting get_message_seen_status:", statusData);
          this.socket?.emit("get_message_seen_status", statusData);
        })
        .catch((error) => {
          console.warn("⚠️ Could not get user info for seen status");
        });
    }
  }

  // API call for marking messages as seen
  async markMessagesAsSeenAPI(
    roomId: string,
    messageIds: string[] = []
  ): Promise<void> {
    console.log("✅ Marking messages as seen via API:", { roomId, messageIds });

    try {
      await this.apiRequest(`/chat/rooms/${roomId}/mark-seen`, {
        method: "POST",
        body: JSON.stringify({ messageIds }),
      });
      console.log("✅ Messages marked as seen via API successfully");
    } catch (error) {
      console.error("❌ Error marking messages as seen via API:", error);
      throw error;
    }
  }

  // Centralized message handling method
  private handleIncomingMessage(
    data: any,
    eventType: "PRIMARY" | "BACKUP"
  ): void {
    console.log(
      `📨 ${eventType} event - RAW DATA:`,
      JSON.stringify(data, null, 2)
    );

    // Extract message from data
    let message;
    if (data.message) {
      message = data.message;
      console.log(`📨 ${eventType}: Using wrapped message format`);
    } else if (data._id && (data.messageText || data.content)) {
      message = data;
      console.log(`📨 ${eventType}: Using direct message format`);
    } else {
      console.warn(`⚠️ ${eventType} event: unrecognized format`);
      return;
    }

    const messageId = message?._id;
    if (!messageId) {
      console.warn(`⚠️ ${eventType} event missing message ID`);
      return;
    }

    if (this.processedMessages.has(messageId)) {
      console.log(
        `🔄 ${eventType} event: Message already processed, skipping:`,
        messageId
      );
      return;
    }

    const now = Date.now();
    const lastProcessTime = this.lastMessageProcessTime.get(messageId);
    if (lastProcessTime && now - lastProcessTime < 1000) {
      console.log(
        `🔄 ${eventType} event: Debounced duplicate within 1s, skipping:`,
        messageId
      );
      return;
    }

    // Fix date fields
    if (!message.createdAt && message.timestamp) {
      message.createdAt = message.timestamp;
      console.log(`📨 ${eventType}: Fixed createdAt from timestamp`);
    }

    if (!message.createdAt) {
      message.createdAt = new Date().toISOString();
      console.log(`📨 ${eventType}: Added missing createdAt field`);
    }

    // Fix senderId conversion
    if (typeof message.senderId === "string") {
      const senderId = message.senderId;
      console.log(
        `📨 ${eventType}: Converting string senderId to object:`,
        senderId
      );

      authService
        .getUserData()
        .then((currentUser) => {
          if (senderId === currentUser.id) {
            message.senderId = {
              _id: senderId,
              fullName: currentUser.fullName || "Bạn",
              avatarUrl: currentUser.avatarUrl,
            };
          } else {
            if (
              senderId.includes("doctor") ||
              senderId === "684460f8fe31c80c380b343f"
            ) {
              message.senderId = {
                _id: senderId,
                fullName: "THUG SHAKER DOCTOR",
                avatarUrl:
                  "https://static.wikia.nocookie.net/bhlx/images/3/3c/New_JerseyBunny.png/revision/latest/scale-to-width-down/400?cb=20241123062854",
              };
            } else {
              message.senderId = {
                _id: senderId,
                fullName: "Unknown User",
                avatarUrl: undefined,
              };
            }
          }

          console.log(
            `📨 ${eventType}: Fixed senderId:`,
            JSON.stringify(message.senderId, null, 2)
          );
          this.processFinalMessage(message, eventType, messageId, now);
        })
        .catch((error) => {
          console.warn(`⚠️ ${eventType}: Failed to get user data:`, error);
          message.senderId = {
            _id: senderId,
            fullName: senderId.includes("doctor") ? "Bác sĩ" : "Unknown User",
            avatarUrl: senderId.includes("doctor")
              ? "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop&crop=face"
              : undefined,
          };

          console.log(
            `📨 ${eventType}: Fallback senderId:`,
            JSON.stringify(message.senderId, null, 2)
          );
          this.processFinalMessage(message, eventType, messageId, now);
        });
    } else {
      this.processFinalMessage(message, eventType, messageId, now);
    }
  }

  private processFinalMessage(
    message: any,
    eventType: "PRIMARY" | "BACKUP",
    messageId: string,
    now: number
  ): void {
    console.log(
      `📨 ${eventType} event - Final message structure:`,
      JSON.stringify(
        {
          messageId: message._id,
          chatRoomId: message.chatRoomId,
          messageText: message.messageText,
          content: message.content,
          messageType: message.messageType,
          senderId: message.senderId,
          timestamp: message.timestamp,
          createdAt: message.createdAt,
          fileUrl: message.fileUrl,
          attachments: message.attachments,
        },
        null,
        2
      )
    );

    this.addProcessedMessage(messageId);
    this.lastMessageProcessTime.set(messageId, now);

    if (this.eventHandlers.onMessageReceived) {
      console.log(
        `📨 ${eventType}: Calling onMessageReceived handler with message:`,
        JSON.stringify(message, null, 2)
      );
      this.eventHandlers.onMessageReceived(message);
    } else {
      console.warn(`⚠️ ${eventType}: No onMessageReceived handler registered!`);
    }
  }

  private addProcessedMessage(messageId: string): void {
    this.processedMessages.add(messageId);
    console.log("🔄 Added message to processed cache:", messageId);

    if (this.messageProcessingTimeout) {
      clearTimeout(this.messageProcessingTimeout);
    }

    this.messageProcessingTimeout = setTimeout(() => {
      const oldSize = this.processedMessages.size;
      this.processedMessages.clear();
      this.lastMessageProcessTime.clear();
      console.log("🧹 Cleaned processed messages cache:", oldSize, "-> 0");
    }, 5 * 60 * 1000);
  }

  private clearProcessedMessages(): void {
    this.processedMessages.clear();
    this.lastMessageProcessTime.clear();
    if (this.messageProcessingTimeout) {
      clearTimeout(this.messageProcessingTimeout);
      this.messageProcessingTimeout = null;
    }
    console.log("🧹 Cleared processed messages cache and timestamps");
  }
}

const chatService = new ChatService(
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://192.168.1.4:3000"
);

export default chatService;
export type {
  ApiResponse,
  ChatEventHandlers,
  ChatRoom,
  CreateRoomRequest,
  Message,
  SendMessageRequest,
};
