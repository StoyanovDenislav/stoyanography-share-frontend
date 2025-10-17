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
 * OPTIMIZED: Limited auto-reconnection to prevent request spam
 */
export const useSSE = (options: UseSSEOptions = {}) => {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3; // Limit reconnection attempts
  
  // Use refs for callbacks to prevent reconnection on re-render
  const optionsRef = useRef(options);
  
  // Update refs when options change, but don't reconnect
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

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
          
          // Only log non-ping events to reduce console spam
          if (data.type !== "ping") {
            console.log("📡 SSE event received:", data.type);
          }

          // Handle different event types using current callback refs
          if (data.type === "connected") {
            optionsRef.current.onConnected?.();
          } else if (data.type === "ping") {
            // Keepalive ping, no action needed
          } else if (data.type?.startsWith("photo.")) {
            optionsRef.current.onPhotoEvent?.(data);
          } else if (data.type?.startsWith("collection.")) {
            optionsRef.current.onCollectionEvent?.(data);
          } else if (data.type?.startsWith("client.")) {
            optionsRef.current.onClientEvent?.(data);
          } else if (data.type?.startsWith("guest.")) {
            optionsRef.current.onGuestEvent?.(data);
          }
        } catch (error) {
          console.error("Failed to parse SSE event:", error);
        }
      };

      eventSource.onerror = (error) => {
        console.error("❌ SSE error:", error);
        eventSource.close();
        eventSourceRef.current = null;

        // LIMITED reconnection attempts to prevent request spam
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(
            5000 * Math.pow(2, reconnectAttemptsRef.current), // Start at 5 seconds
            60000 // Max 60 seconds
          );
          reconnectAttemptsRef.current++;

          console.log(
            `🔄 Reconnecting in ${delay / 1000}s (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.warn(
            `⚠️ Max reconnection attempts (${maxReconnectAttempts}) reached. Reload page to reconnect.`
          );
        }

        optionsRef.current.onError?.(new Error("SSE connection error"));
      };

      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error("Failed to create SSE connection:", error);
      optionsRef.current.onError?.(error as Error);
    }
  }, []); // Empty dependencies - only create once!

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
