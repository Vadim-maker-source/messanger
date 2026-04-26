// components/providers/SettingsProvider.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getUserSettings, updateUserSettings } from "@/app/lib/api/user";

interface SettingsType {
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  allowDirectMessages: string;
  allowAddToChats: string;
  profileVisibility: string;
  theme: string;
  chatTheme: string | null;
  messageFontSize: string;
  accentColor: string | null;
  chatBackground: string | null;
  pushNotifications: boolean;
  soundNotifications: boolean;
  vibration: boolean;
  showNotificationPreview: boolean;
  mutedChats: string[];
  sendReadReceipts: boolean;
  showTypingIndicator: boolean;
  autoDownloadMedia: string;
  compressImages: boolean;
  preferences: any;
}

interface SettingsContextType {
  settings: SettingsType | null;
  isLoading: boolean;
  updateSetting: <K extends keyof SettingsType>(key: K, value: SettingsType[K]) => Promise<void>;
  updateMultipleSettings: (updates: Partial<SettingsType>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return context;
};

interface SettingsProviderProps {
  children: React.ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Загрузка настроек
  const loadSettings = useCallback(async () => {
    try {
      const userSettings = await getUserSettings();
      setSettings(userSettings as SettingsType);
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Обновление одного параметра
  const updateSetting = useCallback(async <K extends keyof SettingsType>(
    key: K,
    value: SettingsType[K]
  ) => {
    if (!settings) return;

    // Оптимистичное обновление
    setSettings(prev => prev ? { ...prev, [key]: value } : null);

    try {
      const updates = { [key]: value } as Partial<SettingsType>;
      const updated = await updateUserSettings(updates);
      if (updated) {
        setSettings(updated as SettingsType);
      }
    } catch (error) {
      console.error(`Failed to update setting ${key}:`, error);
      // Откат при ошибке
      await loadSettings();
      throw error;
    }
  }, [settings, loadSettings]);

  // Обновление нескольких параметров
  const updateMultipleSettings = useCallback(async (updates: Partial<SettingsType>) => {
    if (!settings) return;

    // Оптимистичное обновление
    setSettings(prev => prev ? { ...prev, ...updates } : null);

    try {
      const updated = await updateUserSettings(updates);
      if (updated) {
        setSettings(updated as SettingsType);
      }
    } catch (error) {
      console.error("Failed to update settings:", error);
      await loadSettings();
      throw error;
    }
  }, [settings, loadSettings]);

  // Применение темы к документу
  useEffect(() => {
    if (!settings) return;

    const root = document.documentElement;
    
    // Применяем тему
    if (settings.theme === "dark") {
      root.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    } else if (settings.theme === "light") {
      root.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
    } else if (settings.theme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
      document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    }

    // Применяем акцентный цвет
    if (settings.accentColor) {
      root.style.setProperty("--accent-color", settings.accentColor);
    } else {
      root.style.setProperty("--accent-color", "#FF6B35");
    }

    // Применяем размер шрифта сообщений
    const fontSizeMap = {
      small: "13px",
      medium: "15px",
      large: "17px"
    };
    root.style.setProperty("--message-font-size", fontSizeMap[settings.messageFontSize as keyof typeof fontSizeMap] || "15px");

  }, [settings]);

  // Следим за системной темой
  useEffect(() => {
    if (!settings || settings.theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      const root = document.documentElement;
      if (e.matches) {
        root.classList.add("dark");
        document.documentElement.style.colorScheme = "dark";
      } else {
        root.classList.remove("dark");
        document.documentElement.style.colorScheme = "light";
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [settings?.theme]);

  // Загружаем настройки при монтировании
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <SettingsContext.Provider value={{
      settings,
      isLoading,
      updateSetting,
      updateMultipleSettings,
      refreshSettings: loadSettings
    }}>
      {children}
    </SettingsContext.Provider>
  );
};