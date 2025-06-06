import AsyncStorage from '@react-native-async-storage/async-storage'
import { authService } from './authServices.service'

export interface ChatHistory {
  _id: string
  userId: string
  messages: any[]
  createdAt: string
  updatedAt: string
  __v: number
}

export interface ChatMessage {
  _id: string
  chatId: string
  sender: 'user' | 'ai'
  messageContent: string
  createdAt: string
  updatedAt: string
  __v: number
}

export interface ChatHistoryResponse {
  success: boolean
  data: ChatHistory[]
  message: string
}

export interface ChatMessageResponse {
  success: boolean
  data: ChatMessage[]
  message: string
}

export interface CreateChatHistoryResponse {
  success: boolean
  code: number
  data: ChatHistory
  message: string
}

export interface SendMessageResponse {
  success: boolean
  code: number
  data: ChatMessage
  message: string
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.1.35:3000'
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export const fetchUserChatHistory = async (userId: string): Promise<ChatHistoryResponse | { error: string }> => {
  try {
    
    const token = await authService.getToken()
    
    if (!token) {
      return { error: 'Authentication token not found' }
    }

    const url = `${API_BASE_URL}/chat-history/user/${userId}`
    
    const requestConfig = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }

    const response = await fetch(url, requestConfig)

    const data = await response.json()

    if (!response.ok) {
      return { error: data.message || 'Failed to fetch chat history' }
    }

    return data
  } catch (error) {
    console.error('❌ Error fetching chat history:', error)
    return { error: 'Network error occurred' }
  }
}

export const createChatHistory = async (userId: string): Promise<CreateChatHistoryResponse | { error: string }> => {
  try {
    
    const token = await authService.getToken()
    
    if (!token) {
      return { error: 'Authentication token not found' }
    }

    const url = `${API_BASE_URL}/chat-history/${userId}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return { error: data.message || 'Failed to create chat history' }
    }

    return data
  } catch (error) {
    console.error('❌ Error creating chat history:', error)
    return { error: 'Network error occurred' }
  }
}

export const sendMessage = async (chatId: string, messageContent: string): Promise<SendMessageResponse | { error: string }> => {
  try {
    
    const token = await authService.getToken()
    
    if (!token) {
      return { error: 'Authentication token not found' }
    }

    const userData = await AsyncStorage.getItem('user_data')
    
    if (!userData) {
      return { error: 'User not found. Please log in again.' }
    }

    const user = JSON.parse(userData)
    
    const userId = user.id || user._id || user.userId
    
    if (!userId) {
      return { error: 'User ID not found. Please log in again.' }
    }

    const url = `${API_BASE_URL}/chat-messages`
    
    const body = {
      chatId,
      userId,
      sender: 'user',
      messageContent,
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      return { error: data.message || 'Failed to send message' }
    }

    return data
  } catch (error) {
    console.error('❌ Error sending message:', error)
    return { error: 'Network error occurred' }
  }
}

export const fetchChatMessages = async (chatId: string): Promise<ChatMessageResponse | { error: string }> => {
  try {
    
    const token = await authService.getToken()
    
    if (!token) {
      return { error: 'Authentication token not found' }
    }

    const url = `${API_BASE_URL}/chat-messages/chat/${chatId}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return { error: data.message || 'Failed to fetch chat messages' }
    }

    return data
  } catch (error) {
    console.error('❌ Error fetching chat messages:', error)
    return { error: 'Network error occurred' }
  }
}

export const deleteChatHistory = async (chatHistoryId: string): Promise<{ success?: boolean; message?: string; error?: string }> => {
  try {
    const token = await authService.getToken();
    if (!token) return { error: 'Authentication token not found' };
    const url = `${API_BASE_URL}/chat-history/${chatHistoryId}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    if (!response.ok) return { error: data.message || 'Failed to delete chat history' };
    return { success: true, message: data.message };
  } catch (error) {
    return { error: 'Network error occurred' };
  }
};

export const getGeminiAIResponse = async (prompt: string): Promise<string | null> => {
  try {
    if (!GEMINI_API_KEY) {
      console.log('❌ GEMINI_API_KEY not found');
      return null;
    }
    console.log('🔹 Calling Gemini REST API with prompt:', prompt);
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
    });
    const data = await response.json();
    console.log('🔹 Gemini REST API response:', data);
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (error) {
    console.error('❌ Error calling Gemini REST API:', error);
    return null;
  }
};

export const sendAIMessage = async (chatId: string, messageContent: string): Promise<SendMessageResponse | { error: string }> => {
  try {
    const token = await authService.getToken();
    if (!token) {
      console.log('❌ sendAIMessage: Authentication token not found');
      return { error: 'Authentication token not found' };
    }
    const userData = await AsyncStorage.getItem('user_data');
    if (!userData) {
      console.log('❌ sendAIMessage: User not found');
      return { error: 'User not found. Please log in again.' };
    }
    const user = JSON.parse(userData);
    const userId = user.id || user._id || user.userId;
    if (!userId) {
      console.log('❌ sendAIMessage: User ID not found');
      return { error: 'User ID not found. Please log in again.' };
    }
    const url = `${API_BASE_URL}/chat-messages`;
    const body = {
      chatId,
      userId,
      sender: 'ai',
      messageContent,
    };
    console.log('🔹 Sending AI message to backend:', body);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    console.log('🔹 Backend response for AI message:', data);
    if (!response.ok) {
      return { error: data.message || 'Failed to send AI message' };
    }
    return data;
  } catch (error) {
    console.error('❌ Error sending AI message:', error);
    return { error: 'Network error occurred' };
  }
};