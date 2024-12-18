import { ref, nextTick, onUnmounted } from "vue";
import axios from "axios";
import Cookies from "js-cookie";
import { getSocket, disconnectSocket } from "./useWebSocket";
import { useWebSocketStore } from "@/stores/webSockets.store";
import type { IPaginatedMessages, IAuthResponse, IChatState } from "../types";

export const ANONYMOUS = "Anonymous";
export const EMPTY_MESSAGE = "";
export const INPUT_WIDTH = "300px";
export const AUTH_TOKEN_KEY = "auth_token";
export const MESSAGE_PER_PAGE = 10;

const USERNAME_KEY = "username";
const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const COOKIE_OPTIONS = { expires: 7, secure: true };

export const totalPages = ref();

export const setUsername = (username: string) =>
  localStorage.setItem(USERNAME_KEY, username);

export const getUsername = () =>
  localStorage.getItem(USERNAME_KEY) || ANONYMOUS;

export const setToken = (token: string | null) => {
  if (token) {
    Cookies.set(AUTH_TOKEN_KEY, token, COOKIE_OPTIONS);
  } else {
    Cookies.remove(AUTH_TOKEN_KEY);
    disconnectSocket();
  }
};

export const token = Cookies.get(AUTH_TOKEN_KEY);

const createAuthHeaders = (token?: string) =>
  token ? { Authorization: `Bearer ${token}` } : {};

const handleApiError = (error: any, context: string) => {
  console.error(`${context}:`, error?.response?.data?.message || error.message);
  throw error;
};

export const loginUser = async (
  username: string,
  password: string,
  router: any
): Promise<void> => {
  try {
    const { data } = await axios.post<IAuthResponse>(`${API_URL}/auth/login`, {
      username,
      password
    });

    setUsername(username);
    if (data.token) {
      setToken(data.token);
      router.push("/chat");
    } else {
      console.warn("No token received");
    }
  } catch (error) {
    handleApiError(error, "Login error");
  }
};

export const registerUser = async (
  username: string,
  password: string,
  router: any
): Promise<void> => {
  try {
    const { data } = await axios.post<IAuthResponse>(
      `${API_URL}/auth/register`,
      {
        username,
        password
      }
    );
    await setUsername(username);
    await setToken(data.token);
    if (data.token) {
      router.push("/chat");
    }
  } catch (error) {
    handleApiError(error, "Registration error");
  }
};

export const useChatState = () => {
  const state = ref<IChatState>({
    input: EMPTY_MESSAGE,
    username: getUsername()
  });

  const isValidMessage = (message: string, isConnected: boolean): boolean => {
    if (!isConnected) {
      console.error("WebSocket is not connected");
      return false;
    }

    if (!message.trim()) {
      console.warn("Cannot send empty message");
      return false;
    }

    return true;
  };

  const scrollToBottom = (element: HTMLElement | null) => {
    nextTick(() => {
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    });
  };

  const handleMessageSend = (
    message: string,
    webSocketStore: any,
    resetInput: () => void
  ) => {
    if (!isValidMessage(message, webSocketStore.isConnected)) return;

    webSocketStore.sendMessage({
      message: message.trim(),
      username: getUsername()
    });

    resetInput();
  };

  const handleKeyPress = (event: KeyboardEvent, callback: () => void) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      callback();
    }
  };

  const initializeChat = async (scrollCallback: () => void) => {
    try {
      const store = useWebSocketStore();
      await getMessages(MESSAGE_PER_PAGE, store.currentPage);
      scrollCallback();
    } catch (error) {
      handleApiError(error, "Chat initialization error");
    }
  };

  const setupWebSocket = (
    store: any,
    token: string | null,
    onDisconnect?: () => void
  ) => {
    if (token) {
      store.connect(token);
    }

    onUnmounted(() => {
      store.disconnect();
      onDisconnect?.();
    });
  };

  return {
    state,
    isValidMessage,
    scrollToBottom,
    handleMessageSend,
    handleKeyPress,
    initializeChat,
    setupWebSocket
  };
};

export const getMessages = async (page: number, limit: number) => {
  try {
    const token = Cookies.get(AUTH_TOKEN_KEY);

    if (!token) {
      throw new Error("Token is not available");
    }

    const { data } = await axios.get<{
      messages: IMessage[];
      totalPages: number;
    }>(`${API_URL}/chat/messages`, {
      headers: createAuthHeaders(token),
      params: { page, limit }
    });

    const store = useWebSocketStore();
    store.setMessages(data.messages);
    return (totalPages.value = data.totalPages);
  } catch (error) {
    handleApiError(error, "Error fetching messages");
    return 0;
  }
};

export const clearMessages = async (): Promise<void> => {
  try {
    await axios.delete(`${API_URL}/chat/clear`, {
      headers: createAuthHeaders(token)
    });

    const socket = getSocket();
    if (socket?.connected) {
      socket.emit("messages_cleared");
    }
  } catch (error) {
    handleApiError(error, "Error clearing messages");
  }
};
