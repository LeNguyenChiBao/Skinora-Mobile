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
  roomId: string;
  senderId: string;
  senderName?: string;
  content: string;
  messageType: "text" | "image" | "file";
  attachments?: string[]; // Add this line
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  createdAt: string;
  updatedAt: string;
  isRead: boolean;
  isEdited: boolean;
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
  onRoomUpdated?: (room: ChatRoom) => void;
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
    result.forEach((room, index) => {
      console.log(`📋 Room ${index + 1}:`, {
        id: room._id,
        patientName: room.patientId.fullName,
        doctorName: room.doctorId.fullName,
        unreadPatient: room.unreadCountPatient,
        unreadDoctor: room.unreadCountDoctor,
        lastMessage: room.lastMessageId?.content || "No messages",
      });
    });
    return result;
  }

  async getRoomDetails(roomId: string): Promise<ChatRoom> {
    console.log("🔍 Fetching room details for ID:", roomId);
    const result = await this.apiRequest<ChatRoom>(`/chat/rooms/${roomId}`);
    console.log("🔍 Room details fetched:", {
      id: result._id,
      patientName: result.patientId.fullName,
      doctorName: result.doctorId.fullName,
      unreadPatient: result.unreadCountPatient,
      unreadDoctor: result.unreadCountDoctor,
    });
    return result;
  }

  async createRoomFromAppointment(appointmentId: string): Promise<ChatRoom> {
    console.log("🏗️ Creating room from appointment ID:", appointmentId);
    const result = await this.apiRequest<ChatRoom>(
      `/chat/rooms/appointment/${appointmentId}`,
      {
        method: "POST",
      }
    );
    console.log("🏠 Room created from appointment:", {
      roomId: result._id,
      appointmentId,
      patientName: result.patientId.fullName,
      doctorName: result.doctorId.fullName,
    });
    return result;
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

  async getMessages(
    roomId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ messages: Message[]; pagination: any }> {
    console.log(
      "📨 Fetching messages for room:",
      roomId,
      "page:",
      page,
      "limit:",
      limit
    );

    try {
      const response = await this.apiRequest<any>(
        `/chat/rooms/${roomId}/messages?page=${page}&limit=${limit}`
      );

      console.log("📨 Raw API response:", response);

      // Handle different response formats
      let messages: Message[] = [];
      let pagination: any = null;

      if (Array.isArray(response)) {
        // If response is directly an array of messages
        messages = response;
        pagination = {
          page,
          limit,
          total: response.length,
          hasNext: false,
          hasPrev: false,
        };
      } else if (response && response.messages) {
        // If response has messages property
        messages = response.messages;
        pagination = response.pagination;
      } else if (response && response.data) {
        // If response has data property
        if (Array.isArray(response.data)) {
          messages = response.data;
        } else if (response.data.messages) {
          messages = response.data.messages;
          pagination = response.data.pagination;
        }
      }

      console.log("📨 Processed messages:", {
        messageCount: messages.length,
        pagination: pagination,
        messages: messages.map((msg) => ({
          id: msg._id,
          content: msg.content?.substring(0, 50) + "...",
          senderId: msg.senderId,
          createdAt: msg.createdAt,
        })),
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

      console.log(
        "🔌 Attempting WebSocket connection to:",
        `${this.baseURL}/chat`
      );
      console.log(
        "🔌 Auth token for WebSocket:",
        this.token ? `${this.token.substring(0, 20)}...` : "null"
      );

      this.socket = io(`${this.baseURL}/chat`, {
        auth: {
          token: this.token,
        },
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
      });

      this.socket.on("connect", () => {
        console.log("✅ Chat WebSocket connected successfully");
        this.reconnectAttempts = 0;
        this.eventHandlers.onConnected?.();
        resolve();
      });

      this.socket.on("disconnect", (reason) => {
        console.log("❌ Chat WebSocket disconnected:", reason);
        this.eventHandlers.onDisconnected?.();
      });

      this.socket.on("connect_error", (error) => {
        console.error("❌ Chat WebSocket connection error:", error);
        this.reconnectAttempts++;

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error("❌ Max reconnection attempts reached");
          this.eventHandlers.onError?.(error);
          reject(error);
        }
      });

      // Message events
      this.socket.on("message:received", (message: Message) => {
        console.log("📨 WebSocket message received:", {
          messageId: message._id,
          roomId: message.roomId,
          senderId: message.senderId,
          content: message.content,
          messageType: message.messageType,
          createdAt: message.createdAt,
        });
        this.eventHandlers.onMessageReceived?.(message);
      });

      this.socket.on(
        "message:read",
        (data: { roomId: string; userId: string; messageId: string }) => {
          console.log("✅ WebSocket message read event:", data);
          this.eventHandlers.onMessageRead?.(data);
        }
      );

      // Typing events
      this.socket.on(
        "user:typing",
        (data: { roomId: string; userId: string; isTyping: boolean }) => {
          console.log("✍️ WebSocket typing event:", data);
          this.eventHandlers.onUserTyping?.(data);
        }
      );

      // User status events
      this.socket.on(
        "user:online",
        (data: { userId: string; isOnline: boolean }) => {
          console.log("👤 WebSocket user online status:", data);
          this.eventHandlers.onUserOnlineStatus?.(data);
        }
      );

      // Room events
      this.socket.on("room:updated", (room: ChatRoom) => {
        console.log("🏠 WebSocket room updated:", {
          roomId: room._id,
          patientName: room.patientId.fullName,
          doctorName: room.doctorId.fullName,
        });
        this.eventHandlers.onRoomUpdated?.(room);
      });

      // Error handling
      this.socket.on("error", (error: any) => {
        console.error("❌ WebSocket error:", error);
        this.eventHandlers.onError?.(error);
      });

      // Set connection timeout
      setTimeout(() => {
        if (!this.socket?.connected) {
          console.error("⏰ WebSocket connection timeout");
          reject(new Error("WebSocket connection timeout"));
        }
      }, 10000);
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

  // WebSocket message sending
  sendTypingStatus(roomId: string, isTyping: boolean): void {
    if (this.socket?.connected) {
      console.log("✍️ Sending typing status:", { roomId, isTyping });
      this.socket.emit("user:typing", { roomId, isTyping });
    } else {
      console.warn("⚠️ Cannot send typing status: WebSocket not connected");
    }
  }

  joinRoom(roomId: string): void {
    if (this.socket?.connected) {
      console.log("🏠 Joining room via WebSocket:", roomId);
      this.socket.emit("room:join", { roomId });
    } else {
      console.warn("⚠️ Cannot join room: WebSocket not connected");
    }
  }

  leaveRoom(roomId: string): void {
    if (this.socket?.connected) {
      console.log("🚪 Leaving room via WebSocket:", roomId);
      this.socket.emit("room:leave", { roomId });
    } else {
      console.warn("⚠️ Cannot leave room: WebSocket not connected");
    }
  }

  // Utility methods
  async uploadImage(
    file: any,
    roomId: string,
    content: string = "Check out this image!"
  ): Promise<{ url: string; metadata: any }> {
    console.log("📸 Uploading image to room:", roomId);

    const formData = new FormData();
    formData.append("image", file);
    formData.append("content", content);

    const headers = await this.getAuthHeaders();

    const response = await fetch(
      `${this.baseURL}/chat/rooms/${roomId}/upload-image`,
      {
        method: "POST",
        headers: {
          Authorization: headers.Authorization,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("❌ Image upload failed:", errorData);
      throw new Error(
        `Image upload failed: ${errorData.message || response.statusText}`
      );
    }

    const result: ApiResponse<{ url: string; metadata: any }> =
      await response.json();
    console.log("✅ Image uploaded successfully:", result.data);
    return result.data;
  }

  async uploadMultipleFiles(
    files: any[],
    roomId: string,
    content: string = "Here are some documents"
  ): Promise<{ urls: string[]; metadata: any[] }> {
    console.log(
      "📎 Uploading multiple files to room:",
      roomId,
      "files count:",
      files.length
    );

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("content", content);

    const headers = await this.getAuthHeaders();

    const response = await fetch(
      `${this.baseURL}/chat/rooms/${roomId}/upload`,
      {
        method: "POST",
        headers: {
          Authorization: headers.Authorization,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("❌ Multiple files upload failed:", errorData);
      throw new Error(
        `Files upload failed: ${errorData.message || response.statusText}`
      );
    }

    const result: ApiResponse<{ urls: string[]; metadata: any[] }> =
      await response.json();
    console.log("✅ Multiple files uploaded successfully:", result.data);
    return result.data;
  }

  async uploadFile(
    file: any,
    roomId: string
  ): Promise<{ url: string; metadata: any }> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("roomId", roomId);

    const headers = await this.getAuthHeaders();
    delete headers["Content-Type"]; // Let browser set multipart boundary

    const response = await fetch(`${this.baseURL}/chat/upload`, {
      method: "POST",
      headers: {
        Authorization: headers.Authorization,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result: ApiResponse<{ url: string; metadata: any }> =
      await response.json();
    return result.data;
  }

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

  // Update token when user logs in/out
  updateToken(token: string | null): void {
    console.log(
      "🔑 Updating auth token:",
      token ? `${token.substring(0, 20)}...` : "null"
    );
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

  // Health check
  isConnected(): boolean {
    const connected = this.socket?.connected || false;
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
    if (room.patientId._id === currentUserId) return "patient";
    if (room.doctorId._id === currentUserId) return "doctor";
    return null;
  }

  // Helper method to get unread count for current user
  getUnreadCount(room: ChatRoom, currentUserId: string): number {
    const role = this.getCurrentUserRole(room, currentUserId);
    if (role === "patient") return room.unreadCountPatient;
    if (role === "doctor") return room.unreadCountDoctor;
    return 0;
  }

  // Helper method to get other participant info
  getOtherParticipant(
    room: ChatRoom,
    currentUserId: string
  ): { id: string; name: string; avatar?: string } {
    const role = this.getCurrentUserRole(room, currentUserId);
    if (role === "patient") {
      return {
        id: room.doctorId._id,
        name: room.doctorId.fullName,
        avatar: room.doctorId.photoUrl,
      };
    } else {
      return {
        id: room.patientId._id,
        name: room.patientId.fullName,
        avatar: room.patientId.avatarUrl,
      };
    }
  }
}

// Export singleton instance
const chatService = new ChatService(
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000"
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
