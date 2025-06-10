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
  senderType: "patient" | "doctor";
  content: string;
  messageType: "text" | "image" | "file" | "audio" | "video";
  attachments?: string[];
  timestamp?: string;
  createdAt: string;
  updatedAt: string;
  isRead: boolean;
  isDeleted: boolean;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  senderName?: string;
  isEdited?: boolean;
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
  onRoomUpdated?: (room: any) => void; // Updated to handle room stats
  onRoomJoined?: (data: {
    roomId: string;
    userId: string;
    roomMemberCount?: number;
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
  private connectionState = false; // Rename to avoid conflict with method
  private pendingRoomId: string | null = null;

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
      data: result.data,
    });

    if (!result.success) {
      console.error("❌ API returned success: false:", result);
      throw new Error(result.message || "API request failed");
    }

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
    data: SendMessageRequest
  ): Promise<Message> {
    console.log("💬 Sending message to room:", roomId, "with data:", data);

    // Use the correct format that matches the backend expectation
    const backendData = {
      content: data.content,
      messageType: data.messageType,
      attachments: data.attachments || [],
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
      senderId: result.senderId,
      createdAt: result.createdAt,
    });
    return result;
  }

  // Update the sendMessageToDoctor to use HTTP API (as backend expects)
  async sendMessageToDoctor(roomId: string, content: string): Promise<Message> {
    console.log("💬 Sending message via HTTP API (BE suggested approach)");

    // Use the exact endpoint format the backend expects
    const result = await this.apiRequest<Message>(
      `/chat/rooms/${roomId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ content }),
      }
    );

    console.log(
      "✅ Message sent via HTTP API - WebSocket events will handle UI update"
    );
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

      // Handle different response formats
      let messages: Message[] = [];
      let pagination: any = null;

      if (Array.isArray(response)) {
        messages = response;
        pagination = {
          page,
          limit,
          total: response.length,
          hasNext: response.length === limit,
          hasPrev: page > 1,
        };
      } else if (response && response.messages) {
        messages = response.messages;
        pagination = response.pagination || {
          page,
          limit,
          total: response.messages.length,
          hasNext: response.messages.length === limit,
          hasPrev: page > 1,
        };
      } else if (response && response.data) {
        if (Array.isArray(response.data)) {
          messages = response.data;
          pagination = {
            page,
            limit,
            total: response.data.length,
            hasNext: response.data.length === limit,
            hasPrev: page > 1,
          };
        } else if (response.data.messages) {
          messages = response.data.messages;
          pagination = response.data.pagination || {
            page,
            limit,
            total: response.data.messages.length,
            hasNext: response.data.messages.length === limit,
            hasPrev: page > 1,
          };
        }
      }

      console.log("📨 Messages loaded:", messages.length);
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
            resolve();
          });

          // 2. Handle authenticated connection - AUTO JOIN ROOM HERE
          this.socket.on("connected", (data) => {
            console.log("✅ Connected to chat server:", data);
            this.connectionState = true;

            // AUTO-JOIN ROOM immediately after authentication
            if (this.pendingRoomId) {
              console.log(
                "🏠 AUTO-JOINING room after authentication:",
                this.pendingRoomId
              );
              this.joinRoomImmediately(this.pendingRoomId);
            }

            this.eventHandlers.onConnected?.();
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

          // 6. new_message - PRIMARY message event
          this.socket.on("new_message", (data) => {
            console.log("📨 NEW MESSAGE EVENT:", data);
            if (data.message) {
              console.log("📨 Processing new message via primary event");
              this.eventHandlers.onMessageReceived?.(data.message);
            }
          });

          // 7. message_received - BACKUP message event
          this.socket.on("message_received", (data) => {
            console.log("📨 BACKUP MESSAGE EVENT:", data);

            if (data.message) {
              console.log("📨 Processing message via backup event");
              this.eventHandlers.onMessageReceived?.(data.message);
            } else if (data._id && data.content) {
              // Handle direct message object
              console.log(
                "📨 Processing direct message object via backup event"
              );
              this.eventHandlers.onMessageReceived?.(data);
            }
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
    const state = this.socket.connected ? "connected" : "connecting";
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
}

// Export singleton instance - Fix the export
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
