import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  onAttachFile: () => void;
  isConnected: boolean;
  isSending: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onAttachFile,
  isConnected,
  isSending,
}) => {
  const [inputText, setInputText] = useState("");

  const handleSend = () => {
    if (inputText.trim() === "" || isSending) return;

    onSendMessage(inputText.trim());
    setInputText("");
  };

  console.log("💬 [ChatInput] Connection state:", {
    isConnected,
    isSending,
    canSend: !isSending && isConnected,
    inputValue: inputText.trim(),
    canSendMessage: !isSending && isConnected && inputText.trim().length > 0,
  });

  return (
    <View style={styles.inputContainer}>
      <TouchableOpacity
        style={styles.attachButton}
        onPress={onAttachFile}
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
          onChangeText={setInputText}
          placeholder={isConnected ? "Nhập tin nhắn..." : "Đang kết nối..."}
          placeholderTextColor="#999"
          multiline
          maxLength={1000}
          editable={isConnected}
        />
      </View>

      <TouchableOpacity
        style={[
          styles.sendButton,
          (isSending || !isConnected) && { opacity: 0.6 },
        ]}
        onPress={handleSend}
        disabled={isSending || inputText.trim() === "" || !isConnected}
      >
        {isSending ? (
          <ActivityIndicator size={16} color="#FFFFFF" />
        ) : (
          <Ionicons name="send" size={20} color="#FFFFFF" />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
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
});
