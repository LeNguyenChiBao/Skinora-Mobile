import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  onAttachFile: () => void;
  onVideoCall: () => void;
  isConnected: boolean;
  isSending: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onAttachFile,
  onVideoCall,
  isConnected,
  isSending,
}) => {
  const [inputText, setInputText] = useState("");

  const handleSend = () => {
    if (inputText.trim() === "" || isSending) return;

    onSendMessage(inputText.trim());
    setInputText("");
  };

  const canSendMessage =
    inputText.trim().length > 0 && isConnected && !isSending;

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Nhập tin nhắn..."
          placeholderTextColor="#999"
          multiline
          maxLength={1000}
          editable={!isSending && isConnected}
        />

        <View style={styles.actionsContainer}>
          {/* Video Call Button */}
          {onVideoCall && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                (!isConnected || isSending) && styles.disabledButton,
              ]}
              onPress={() => {
                console.log("📞 Video call button pressed");
                onVideoCall();
              }}
              disabled={!isConnected || isSending}
            >
              <Ionicons
                name="videocam"
                size={24}
                color={!isConnected || isSending ? "#ccc" : "#007AFF"}
              />
            </TouchableOpacity>
          )}

          {/* Attach File Button */}
          {onAttachFile && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                (!isConnected || isSending) && styles.disabledButton,
              ]}
              onPress={onAttachFile}
              disabled={!isConnected || isSending}
            >
              <Ionicons
                name="attach"
                size={24}
                color={!isConnected || isSending ? "#ccc" : "#007AFF"}
              />
            </TouchableOpacity>
          )}

          {/* Send Button */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              canSendMessage
                ? styles.enabledSendButton
                : styles.disabledSendButton,
            ]}
            onPress={handleSend}
            disabled={!canSendMessage}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="send" size={20} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Connection Status */}
      <View style={styles.statusContainer}>
        <View style={styles.statusIndicator}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isConnected ? "#4CAF50" : "#FF5722" },
            ]}
          />
          <Text style={styles.statusText}>
            {isConnected ? "🟢 Đã kết nối" : "🔴 Đang kết nối..."}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#F5F5F5",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    fontSize: 16,
    color: "#333",
    paddingVertical: 8,
  },
  actionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
  },
  disabledButton: {
    opacity: 0.5,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  enabledSendButton: {
    backgroundColor: "#007AFF",
  },
  disabledSendButton: {
    backgroundColor: "#CCC",
  },
  statusContainer: {
    marginTop: 8,
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    color: "#666",
  },
});
