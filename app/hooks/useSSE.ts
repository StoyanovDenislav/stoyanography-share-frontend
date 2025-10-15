import { useEffect, useRef, useCallback } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:6002/api";

interface SSEEvent {
  type: string;
  data?: any;
  timestamp?: number;
}

interface UseSSEOptions {
  onPhotoEvent?: (event: SSEEvent) => void;
  onCollectionEvent?: (event: SSEEvent) => void;
  onClientEvent?: (event: SSEEvent) => void;
  onGuestEvent?: (event: SSEEvent) => void;
  onConnected?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Custom hook for Server-Sent Events (SSE) real-time updates
 * Automatically reconnects on disconnect
 */
export const useSSE = (options: UseSSEOptions = {}) => {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      return; // Already connected
    }

    try {
      console.log("📡 Connecting to SSE...");

      const eventSource = new EventSource(`${API_BASE_URL}/events`, {
        withCredentials: true,
      });

      eventSource.onopen = () => {
        console.log("✅ SSE connection established");
        reconnectAttemptsRef.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data: SSEEvent = JSON.parse(event.data);
          console.log("📡 SSE event received:", data.type);

          // Handle different event types
          if (data.type === "connected") {
            options.onConnected?.();
          } else if (data.type === "ping") {
            // Keepalive ping, no action needed
          } else if (data.type?.startsWith("photo.")) {
            options.onPhotoEvent?.(data);
          } else if (data.type?.startsWith("collection.")) {
            options.onCollectionEvent?.(data);
          } else if (data.type?.startsWith("client.")) {
            options.onClientEvent?.(data);
          } else if (data.type?.startsWith("guest.")) {
            options.onGuestEvent?.(data);
          }
        } catch (error) {
          console.error("Failed to parse SSE event:", error);
        }
      };

      eventSource.onerror = (error) => {
        console.error("❌ SSE error:", error);
        eventSource.close();
        eventSourceRef.current = null;

        // Exponential backoff for reconnection
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttemptsRef.current),
          30000
        );
        reconnectAttemptsRef.current++;

        console.log(
          `🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})...`
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);

        options.onError?.(new Error("SSE connection error"));
      };

      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error("Failed to create SSE connection:", error);
      options.onError?.(error as Error);
    }
  }, [options]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      console.log("📡 Disconnecting SSE...");
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connect,
    disconnect,
    isConnected: () => eventSourceRef.current !== null,
  };
};
