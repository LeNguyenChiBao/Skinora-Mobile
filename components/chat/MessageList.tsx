import { Message } from "@/services/chat.service";
import React, { useEffect, useRef } from "react";
import { FlatList, StyleSheet } from "react-native";
import { MessageItem } from "./MessageItem";

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  seenMessageIds: Set<string>;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUserId,
  seenMessageIds,
}) => {
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    console.log("📱 [MessageList] Messages prop updated:", {
      count: messages.length,
      messageIds: messages.map((m) => m._id),
      lastMessage: messages[messages.length - 1]
        ? {
            id: messages[messages.length - 1]._id,
            messageType: messages[messages.length - 1].messageType,
            content:
              messages[messages.length - 1].messageText ||
              messages[messages.length - 1].content,
          }
        : null,
    });

    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    console.log("📱 [MessageList] Rendering message:", item._id);

    // Check if previous message is from same sender (for avatar grouping)
    const previousMessage = index > 0 ? messages[index - 1] : null;
    const currentSenderId =
      typeof item.senderId === "string" ? item.senderId : item.senderId?._id;
    const previousSenderId = previousMessage
      ? typeof previousMessage.senderId === "string"
        ? previousMessage.senderId
        : previousMessage.senderId?._id
      : null;

    const isConsecutive =
      currentSenderId === previousSenderId && currentSenderId !== null;
    const isCurrentUser = currentSenderId === currentUserId;

    console.log("📱 [MessageList] Message grouping:", {
      messageId: item._id,
      currentSenderId,
      previousSenderId,
      isConsecutive,
      isCurrentUser,
    });

    return (
      <MessageItem
        message={item}
        isCurrentUser={isCurrentUser}
        isSeen={seenMessageIds.has(item._id)}
        isConsecutive={isConsecutive}
      />
    );
  };

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      renderItem={({ item, index }) => renderMessage({ item, index })}
      keyExtractor={(item) => item._id}
      style={styles.messagesList}
      contentContainerStyle={styles.messagesContent}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
});
