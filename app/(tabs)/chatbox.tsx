import { ChatHistory, createChatHistory, deleteChatHistory, fetchChatMessages, fetchUserChatHistory, getGeminiAIResponse, sendAIMessage, sendMessage as sendMessageAPI } from '@/services/chatbox.service';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export default function ChatboxScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Chat history states
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [loadingHistories, setLoadingHistories] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [creatingNewChat, setCreatingNewChat] = useState(false);

  useEffect(() => {
    initializeChat();
  }, []);

  const initializeChat = async () => {
    try {
      const userData = await AsyncStorage.getItem('user_data');
      if (userData) {
        const user = JSON.parse(userData);
        const userId = user.id || user._id || user.userId;
        if (userId) {
          setCurrentUserId(userId);
          await loadChatHistories(userId);
        }
      }
    } catch (error) {
      console.error('❌ Error initializing chat:', error);
    }
  };

  const loadChatHistories = async (userId: string) => {
    setLoadingHistories(true);
    try {
      const result = await fetchUserChatHistory(userId);
      if ('error' in result) {
        setChatHistories([]);
      } else {
        setChatHistories(result.data);
        if (!currentChatId && result.data.length > 0) {
          selectChatHistory(result.data[0]);
          if (Array.isArray(result.data[0].messages) && result.data[0].messages.length > 0) {
            const formattedMessages: Message[] = result.data[0].messages.map((msg: any) => ({
              id: msg._id,
              text: msg.messageContent,
              isUser: msg.sender === 'user',
              timestamp: new Date(msg.createdAt)
            }));
            setMessages(formattedMessages);
          } else {
            setMessages([]);
          }
        }
      }
    } catch {
      setChatHistories([]);
    } finally {
      setLoadingHistories(false);
    }
  };

  const selectChatHistory = async (chatHistory: ChatHistory) => {
    setCurrentChatId(chatHistory._id);
    setShowSidebar(false);
    await loadChatMessages(chatHistory._id);
  };

  const loadChatMessages = async (chatId: string) => {
    setLoadingMessages(true);
    try {
      const result = await fetchChatMessages(chatId);
      if ('error' in result) {
        setMessages([]);
      } else {
        const formattedMessages: Message[] = result.data.map(msg => ({
          id: msg._id,
          text: msg.messageContent,
          isUser: msg.sender === 'user',
          timestamp: new Date(msg.createdAt)
        }));
        setMessages(formattedMessages);
      }
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const createNewChatHistory = async () => {
    if (!currentUserId) return;
    setCreatingNewChat(true);
    try {
      const result = await createChatHistory(currentUserId);
      if ('error' in result) {
        Alert.alert('Error', result.error);
      } else {
        await loadChatHistories(currentUserId);
        selectChatHistory(result.data);
      }
    } catch {
      Alert.alert('Error', 'Failed to create new chat');
    } finally {
      setCreatingNewChat(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading || !currentChatId) return;
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    const question = inputText.trim();
    setInputText('');
    setIsLoading(true);

    try {
      console.log('🔹 Sending user message:', question);
      const result = await sendMessageAPI(currentChatId, question);
      console.log('🔹 Backend response for user message:', result);
      if ('error' in result) {
        Alert.alert('Error', result.error);
        setIsLoading(false);
        return;
      }

      // Call Gemini API for AI response
      const aiText = await getGeminiAIResponse(question);
      console.log('🔹 Gemini AI response text:', aiText);

      if (aiText) {
        // Send AI message to backend
        const aiSendResult = await sendAIMessage(currentChatId, aiText);
        console.log('🔹 Backend response for AI message:', aiSendResult);

        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: aiText,
          isUser: false,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        // fallback if Gemini fails
        const fallback = "Xin lỗi, tôi không thể trả lời câu hỏi này vào lúc này.";
        const aiSendResult = await sendAIMessage(currentChatId, fallback);
        console.log('🔹 Backend response for fallback AI message:', aiSendResult);
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          text: fallback,
          isUser: false,
          timestamp: new Date()
        }]);
      }
      setIsLoading(false);
    } catch (err) {
      console.error('❌ Error in sendMessage:', err);
      setIsLoading(false);
    }
  };

  const handleDeleteChat = async () => {
    if (!currentChatId) return;
    Alert.alert(
      "Xóa cuộc trò chuyện",
      "Bạn có chắc chắn muốn xóa cuộc trò chuyện này?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              const result = await deleteChatHistory(currentChatId);
              if ('error' in result) {
                Alert.alert("Lỗi", result.error);
              } else {
                // Remove from chatHistories and reset messages
                setChatHistories(prev => prev.filter(c => c._id !== currentChatId));
                setMessages([]);
                setCurrentChatId(null);
                setShowSidebar(true);
              }
            } catch {
              Alert.alert("Lỗi", "Không thể xóa cuộc trò chuyện.");
            }
          }
        }
      ]
    );
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[
      styles.messageRow,
      item.isUser ? styles.userRow : styles.aiRow
    ]}>
      {!item.isUser && (
        <View style={styles.avatarBubble}>
          <Ionicons name="medical" size={20} color="#00A86L" />
        </View>
      )}
      <View style={[
        styles.messageCard,
        item.isUser ? styles.userCard : styles.aiCard
      ]}>
        <Text style={[
          styles.messageText,
          item.isUser ? styles.userText : styles.aiText
        ]}>
          {item.text}
        </Text>
        <Text style={[
          styles.timestamp,
          item.isUser ? styles.userTimestamp : styles.aiTimestamp
        ]}>
          {formatTime(item.timestamp)}
        </Text>
      </View>
    </View>
  );

  const renderChatHistoryItem = ({ item }: { item: ChatHistory }) => (
    <TouchableOpacity
      style={[
        sidebarStyles.historyItem,
        currentChatId === item._id && sidebarStyles.historyItemActive
      ]}
      onPress={() => selectChatHistory(item)}
    >
      <Ionicons name="chatbubble-outline" size={20} color="#00A86B" style={{ marginRight: 12 }} />
      <View>
        <Text style={sidebarStyles.historyTitle}>
          Chat {new Date(item.createdAt).toLocaleDateString()}
        </Text>
        <Text style={sidebarStyles.historyTime}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#00A86B" />
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.headerIcon} onPress={() => setShowSidebar(true)}>
            <Ionicons name="menu" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerBot}>
            <View style={styles.botAvatar}>
              <Ionicons name="medical" size={28} color="#00A86B" />
            </View>
            <View>
              <Text style={styles.botName}>PharmaBot</Text>
              <Text style={styles.botStatus}>Đang hoạt động • Sẵn sàng hỗ trợ</Text>
            </View>
          </View>
        </View>
        {/* Delete button instead of refresh, always visible */}
        <TouchableOpacity
          style={styles.headerIcon}
          onPress={handleDeleteChat}
          disabled={!currentChatId}
        >
          <Ionicons name="trash-outline" size={24} color={currentChatId ? "#fff" : "#A0C4A7"} />
        </TouchableOpacity>
      </View>

      {/* Sidebar as Modal */}
      <Modal
        visible={showSidebar}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSidebar(false)}
      >
        <View style={sidebarStyles.overlay}>
          <View style={sidebarStyles.sidebar}>
            <View style={sidebarStyles.sidebarHeader}>
              <Text style={sidebarStyles.sidebarTitle}>Lịch sử trò chuyện</Text>
              <TouchableOpacity
                style={sidebarStyles.newChatButton}
                onPress={createNewChatHistory}
                disabled={creatingNewChat}
              >
                {creatingNewChat ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="add" size={24} color="#fff" />
                )}
              </TouchableOpacity>
              <TouchableOpacity style={sidebarStyles.closeButton} onPress={() => setShowSidebar(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {loadingHistories ? (
              <View style={sidebarStyles.loadingContainer}>
                <ActivityIndicator size="large" color="#00A86B" />
                <Text style={sidebarStyles.loadingText}>Đang tải lịch sử...</Text>
              </View>
            ) : chatHistories.length > 0 ? (
              <FlatList
                data={chatHistories}
                renderItem={renderChatHistoryItem}
                keyExtractor={item => item._id}
                style={sidebarStyles.historyList}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={sidebarStyles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={60} color="#ccc" />
                <Text style={sidebarStyles.emptyStateTitle}>Không có lịch sử</Text>
                <Text style={sidebarStyles.emptyStateText}>Bắt đầu cuộc trò chuyện mới</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Chat area */}
      <View style={styles.chatArea}>
        {loadingMessages ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00A86B" />
            <Text style={styles.loadingText}>Đang tải tin nhắn...</Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            inverted={false}
          />
        )}
      </View>

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputKeyboard}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor="#999"
            multiline
            maxLength={300}
            editable={!isLoading && currentChatId !== null}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || isLoading || !currentChatId) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || isLoading || !currentChatId}
          >
            <Ionicons
              name="send"
              size={22}
              color="#fff"
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8F5E8",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    justifyContent: "space-between",
    backgroundColor: "#00A86B", // Always green
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerBot: {
    flexDirection: "row",
    alignItems: "center",
  },
  botAvatar: {
    width: 48,
    height: 48,
    borderRadius: 100,
    // backgroundColor: "#00A86B",
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 2,
    // borderColor: "#fff",
    borderColor: "#00A86B",
  },
  botName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  botStatus: {
    fontSize: 12,
    color: "#E8F5E8",
  },
  chatArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 14,
  },
  userRow: {
    justifyContent: "flex-end",
  },
  aiRow: {
    justifyContent: "flex-start",
  },
  avatarBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E8F5E8",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    marginBottom: 4,
  },
  messageCard: {
    maxWidth: "80%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  userCard: {
    backgroundColor: "#00A86B",
    alignSelf: "flex-end",
    borderBottomRightRadius: 6,
    marginLeft: 40,
  },
  aiCard: {
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 6,
  },
  userText: {
    color: "#fff",
  },
  aiText: {
    color: "#1A1A1A",
  },
  timestamp: {
    fontSize: 11,
    alignSelf: "flex-end",
    opacity: 0.7,
  },
  userTimestamp: {
    color: "rgba(255,255,255,0.8)",
  },
  aiTimestamp: {
    color: "#666",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E8F5E8",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  inputKeyboard: {
    backgroundColor: "#E8F5E8",
    // paddingBottom: Platform.OS === "ios" ? 10 : 0,
    paddingBottom: Platform.OS === "ios" ? 30 : 20, // Move input up above tab bar
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: Platform.OS === "ios" ? 100 : 106,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: "#1A1A1A",
    maxHeight: 100,
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: "transparent",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#00A86B",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: "#A0C4A7",
  },
});

const sidebarStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.18)",
    justifyContent: "flex-end",
  },
  sidebar: {
    backgroundColor: "#00A86B",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: "55%",
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  sidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  sidebarTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  newChatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#fff",
  },
  historyList: {
    marginTop: 8,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginBottom: 10,
  },
  historyItemActive: {
    backgroundColor: "#fff",
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#000000",
  },
  historyTime: {
    fontSize: 12,
    color: "#3d3d3d",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#E8F5E8",
    textAlign: "center",
    lineHeight: 20,
  },
});