// components/providers/StatusProvider.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { pusherClient } from "@/app/lib/pusher";

interface UserStatus {
  isOnline: boolean;
  lastActive: Date;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
}

interface StatusContextType {
  userStatuses: Map<string, UserStatus>;
  updateStatus: (userId: string, isOnline: boolean) => void;
  getUserOnlineStatus: (userId: string) => boolean;
  getLastSeen: (userId: string) => Date | null;
  getFormattedLastSeen: (userId: string) => string;
}

const StatusContext = createContext<StatusContextType | undefined>(undefined);

export const useStatus = () => {
  const context = useContext(StatusContext);
  if (!context) {
    throw new Error("useStatus must be used within StatusProvider");
  }
  return context;
};

interface StatusProviderProps {
  children: React.ReactNode;
  currentUserId: string;
}

export const StatusProvider: React.FC<StatusProviderProps> = ({ children, currentUserId }) => {
  const [userStatuses, setUserStatuses] = useState<Map<string, UserStatus>>(new Map());
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const isPageVisible = useRef(true);
  const isUnloading = useRef(false);

  // Форматирование времени последнего визита
  const formatLastSeen = useCallback((lastActive: Date | null): string => {
    if (!lastActive) return "был(а) недавно";
    
    const now = new Date();
    const last = new Date(lastActive);
    const diff = now.getTime() - last.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return "только что";
    if (minutes < 60) return `${minutes} мин. назад`;
    if (hours < 24) return `${hours} ч. назад`;
    if (days < 7) return `${days} д. назад`;
    return last.toLocaleDateString();
  }, []);

  // Обновление статуса пользователя на сервере
  const updateStatusOnServer = useCallback(async (isOnline: boolean) => {
    try {
      await fetch("/api/chat/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnline }),
      });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  }, []);

  // Обновление статуса в состоянии
  const updateStatus = useCallback((userId: string, isOnline: boolean) => {
    if (userId !== currentUserId) return;
    
    setUserStatuses(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(userId);
      if (existing) {
        newMap.set(userId, { 
          ...existing, 
          isOnline, 
          lastActive: new Date() 
        });
      } else {
        newMap.set(userId, {
          isOnline,
          lastActive: new Date(),
          displayName: "",
          username: ""
        });
      }
      return newMap;
    });
  }, [currentUserId]);

  // Heartbeat - обновление активности каждые 30 секунд
  const sendHeartbeat = useCallback(async () => {
    if (!isPageVisible.current || isUnloading.current) return;
    
    try {
      await fetch("/api/chat/heartbeat", { method: "POST" });
    } catch (error) {
      console.error("Error sending heartbeat:", error);
    }
  }, []);

  // Обработка изменения статуса других пользователей
  const handleUserStatusChange = useCallback((data: { 
    userId: string; 
    isOnline: boolean; 
    lastActive: string; 
    displayName: string; 
    username: string;
    avatarUrl?: string 
  }) => {
    setUserStatuses(prev => {
      const newMap = new Map(prev);
      newMap.set(data.userId, {
        isOnline: data.isOnline,
        lastActive: new Date(data.lastActive),
        displayName: data.displayName,
        username: data.username,
        avatarUrl: data.avatarUrl
      });
      return newMap;
    });
  }, []);

  // Получение статуса пользователя
  const getUserOnlineStatus = useCallback((userId: string) => {
    const status = userStatuses.get(userId);
    if (!status) return false;
    
    // Если пользователь онлайн, но активность была более 2 минут назад, считаем оффлайн
    if (status.isOnline) {
      const timeSinceLastActive = Date.now() - new Date(status.lastActive).getTime();
      if (timeSinceLastActive > 2 * 60 * 1000) { // 2 минуты
        return false;
      }
    }
    
    return status.isOnline;
  }, [userStatuses]);

  const getLastSeen = useCallback((userId: string) => {
    const status = userStatuses.get(userId);
    return status ? status.lastActive : null;
  }, [userStatuses]);

  const getFormattedLastSeen = useCallback((userId: string) => {
    const status = userStatuses.get(userId);
    if (!status) return "был(а) недавно";
    if (status.isOnline) return "в сети";
    return formatLastSeen(status.lastActive);
  }, [userStatuses, formatLastSeen]);

  // Отслеживание видимости страницы
  useEffect(() => {
    const handleVisibilityChange = () => {
      isPageVisible.current = !document.hidden;
      
      if (isPageVisible.current) {
        // Страница стала видимой - отмечаем онлайн
        updateStatusOnServer(true);
        updateStatus(currentUserId, true);
      } else {
        // Страница скрыта - отмечаем оффлайн
        updateStatusOnServer(false);
        updateStatus(currentUserId, false);
      }
    };

    const handleBeforeUnload = () => {
      isUnloading.current = true;
      // Используем sendBeacon для надежной отправки
      navigator.sendBeacon("/api/chat/status", JSON.stringify({ isOnline: false }));
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Начальная установка статуса
    updateStatusOnServer(true);
    updateStatus(currentUserId, true);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      updateStatusOnServer(false);
      updateStatus(currentUserId, false);
    };
  }, [currentUserId, updateStatus, updateStatusOnServer]);

  // Heartbeat интервал
  useEffect(() => {
    if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
    
    heartbeatInterval.current = setInterval(sendHeartbeat, 30000); // Каждые 30 секунд
    
    return () => {
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
    };
  }, [sendHeartbeat]);

  // Подписка на Pusher события
  useEffect(() => {
    const channel = pusherClient.subscribe("presence");
    
    channel.bind("user-status-change", handleUserStatusChange);
    
    return () => {
      channel.unbind("user-status-change", handleUserStatusChange);
      pusherClient.unsubscribe("presence");
    };
  }, [handleUserStatusChange]);

  // Загрузка начального статуса для текущего пользователя
  useEffect(() => {
    const loadInitialStatus = async () => {
      try {
        const response = await fetch(`/api/chat/status?userId=${currentUserId}`);
        if (response.ok) {
          const status = await response.json();
          if (status) {
            setUserStatuses(prev => {
              const newMap = new Map(prev);
              newMap.set(currentUserId, {
                isOnline: status.isOnline,
                lastActive: new Date(status.lastActive),
                displayName: status.displayName,
                username: status.username,
                avatarUrl: status.avatarUrl
              });
              return newMap;
            });
          }
        }
      } catch (error) {
        console.error("Error loading initial status:", error);
      }
    };
    
    if (currentUserId) {
      loadInitialStatus();
    }
  }, [currentUserId]);

  return (
    <StatusContext.Provider value={{ 
      userStatuses, 
      updateStatus, 
      getUserOnlineStatus, 
      getLastSeen,
      getFormattedLastSeen
    }}>
      {children}
    </StatusContext.Provider>
  );
};