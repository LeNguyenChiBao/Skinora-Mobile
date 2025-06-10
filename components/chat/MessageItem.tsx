import { Message } from "@/services/chat.service";
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface MessageItemProps {
  message: Message;
  isCurrentUser: boolean;
  isSeen: boolean;
  isConsecutive?: boolean; // New prop for consecutive messages
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isCurrentUser,
  isSeen,
  isConsecutive = false,
}) => {
  console.log("🖼️ [MessageItem] Processing message:", {
    messageId: message._id,
    messageType: message.messageType,
    senderId: message.senderId,
    isCurrentUser,
    isConsecutive,
  });

  const formatTime = (dateString: string) => {
    try {
      // Handle both timestamp and createdAt formats
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.warn("⚠️ [MessageItem] Invalid date string:", dateString);
        return "00:00";
      }
      return date.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      console.warn(
        "⚠️ [MessageItem] Date formatting error:",
        error,
        "for:",
        dateString
      );
      return "00:00";
    }
  };

  // Get sender info with proper avatar handling
  const senderId =
    typeof message.senderId === "string"
      ? message.senderId
      : message.senderId?._id;
  const senderName =
    typeof message.senderId === "object" && message.senderId
      ? message.senderId.fullName
      : "Unknown User";
  const senderAvatar =
    typeof message.senderId === "object" && message.senderId
      ? message.senderId.avatarUrl
      : undefined;

  // Default avatars for different user types
  const defaultDoctorAvatar =
    "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop&crop=face";
  const defaultPatientAvatar =
    "https://via.placeholder.com/40/00A86B/FFFFFF?text=P";

  // Determine final avatar to display
  let finalAvatar = senderAvatar;
  if (!finalAvatar) {
    // Check if it's current user's message (don't show avatar)
    if (isCurrentUser) {
      finalAvatar = null; // Current user doesn't need avatar
    } else {
      // Handle null senderId - assume it's from doctor/system
      if (
        message.senderId === null ||
        senderId === null ||
        senderId === undefined
      ) {
        finalAvatar = defaultDoctorAvatar; // Null sender is usually doctor/system
      } else if (
        senderId === "doctor" ||
        (typeof message.senderId === "string" &&
          message.senderId.includes("doctor")) ||
        senderName?.toLowerCase().includes("doctor") ||
        senderName?.toLowerCase().includes("bác sĩ")
      ) {
        finalAvatar = defaultDoctorAvatar;
      } else {
        finalAvatar = defaultPatientAvatar;
      }
    }
  }

  // Determine if this is an image message
  const isImageMessage = message.messageType === "image";

  // Get image URL from fileUrl, imageUrl, or attachments
  const imageUrl =
    message.fileUrl ||
    message.imageUrl ||
    (message.attachments && message.attachments[0]);

  // Check if the image URL is valid
  const isValidImageUrl =
    imageUrl &&
    !imageUrl.startsWith("blob:") &&
    (imageUrl.startsWith("http") ||
      imageUrl.startsWith("https") ||
      imageUrl.includes("cloudinary.com") ||
      imageUrl.includes("res.cloudinary.com")) &&
    !imageUrl.includes("localhost");

  return (
    <View
      style={[
        styles.messageContainer,
        isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage,
        isConsecutive && styles.consecutiveMessage, // Add consecutive spacing
      ]}
    >
      {/* Only show avatar if not current user AND (not consecutive OR first message) */}
      {!isCurrentUser && !isConsecutive && finalAvatar && (
        <Image
          source={{ uri: finalAvatar }}
          style={styles.avatar}
          defaultSource={{ uri: defaultDoctorAvatar }}
          onError={(error) => {
            console.warn(
              "⚠️ [MessageItem] Avatar load error:",
              error,
              "for URL:",
              finalAvatar
            );
          }}
        />
      )}

      {/* Add spacing for consecutive messages without avatar */}
      {!isCurrentUser && isConsecutive && <View style={styles.avatarSpacer} />}

      <View
        style={[
          styles.messageBubble,
          isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble,
        ]}
      >
        {/* Only show sender name for non-current users and non-consecutive messages */}
        {!isCurrentUser && !isConsecutive && (
          <Text style={styles.senderName}>
            {senderName ||
              (message.senderId === null ? "Bác sĩ" : "Unknown User")}
          </Text>
        )}

        {/* Render image if it's an image message with valid URL */}
        {isImageMessage && isValidImageUrl ? (
          <TouchableOpacity
            onPress={() => console.log("Image pressed:", imageUrl)}
          >
            <Image
              source={{ uri: imageUrl }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ) : isImageMessage ? (
          /* Show placeholder for image messages without valid URL */
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>
              📷 Hình ảnh không tải được
            </Text>
          </View>
        ) : (
          /* Render text message */
          <Text
            style={[
              styles.messageText,
              isCurrentUser ? styles.currentUserText : styles.otherUserText,
            ]}
          >
            {message.messageText || message.content || "No content"}
          </Text>
        )}

        <View style={styles.messageFooter}>
          <Text
            style={[
              styles.messageTime,
              isCurrentUser ? styles.currentUserTime : styles.otherUserTime,
            ]}
          >
            {formatTime(
              message.createdAt || message.timestamp || new Date().toISOString()
            )}
          </Text>

          {isCurrentUser && isSeen && (
            <Text style={styles.seenIndicator}>✓✓</Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginTop: 4,
  },
  imagePlaceholder: {
    width: 200,
    height: 150,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  imagePlaceholderText: {
    color: "#666",
    fontSize: 14,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  seenIndicator: {
    fontSize: 12,
    color: "#00A86B",
    marginLeft: 4,
    fontWeight: "bold",
  },
  senderName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#00A86B",
    marginBottom: 4,
  },
  consecutiveMessage: {
    marginBottom: 4, // Reduce spacing for consecutive messages
  },
  avatarSpacer: {
    width: 40, // Same width as avatar to maintain alignment
    marginRight: 8,
  },
});

export default MessageItem;
