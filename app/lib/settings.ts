import { 
    PrivacySettings, 
    AppearanceSettings, 
    NotificationSettings, 
    ChatBehaviorSettings, 
    UserSettings 
  } from "./types";
  
  // Дефолтные значения
  export const DEFAULT_PRIVACY: PrivacySettings = {
    showOnlineStatus: true,
    showLastSeen: true,
    allowDirectMessages: "everyone",
    allowAddToChats: "everyone",
    profileVisibility: "public"
  };
  
  export const DEFAULT_APPEARANCE: AppearanceSettings = {
    theme: "system",
    messageFontSize: "medium"
  };
  
  export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
    pushNotifications: true,
    soundNotifications: true,
    vibration: true,
    showNotificationPreview: true,
    mutedChats: []
  };
  
  export const DEFAULT_CHAT_BEHAVIOR: ChatBehaviorSettings = {
    sendReadReceipts: true,
    showTypingIndicator: true,
    autoDownloadMedia: "wifi",
    compressImages: true
  };
  
  /**
   * Безопасное слияние JSON с дефолтами
   * Возвращаем Record<string, any> — Prisma примет это как JsonValue
   */
  export function mergeWithDefaults<T extends Record<string, any>>(
    jsonValue: any, 
    defaults: T
  ): Record<string, any> {
    if (!jsonValue || typeof jsonValue !== 'object' || Array.isArray(jsonValue)) {
      return { ...defaults };
    }
    return { ...defaults, ...jsonValue };
  }
  
  /**
   * Конвертирует Prisma JSON → вложенные типы TypeScript
   */
  export function unflattenSettings(dbSettings: any): UserSettings {
    if (!dbSettings) return getDefaultSettings();
    
    return {
      privacy: mergeWithDefaults(dbSettings.privacy, DEFAULT_PRIVACY) as PrivacySettings,
      appearance: mergeWithDefaults(dbSettings.appearance, DEFAULT_APPEARANCE) as AppearanceSettings,
      notifications: mergeWithDefaults(dbSettings.notifications, DEFAULT_NOTIFICATIONS) as NotificationSettings,
      chatBehavior: mergeWithDefaults(dbSettings.chatBehavior, DEFAULT_CHAT_BEHAVIOR) as ChatBehaviorSettings,
      preferences: dbSettings.preferences as Record<string, any> | undefined
    };
  }
  
  /**
   * Подготавливает JSON для обновления в Prisma
   * Возвращаем Record<string, any> — совместимо с JsonValue
   */
  export function prepareJsonUpdate(
    current: Record<string, any> | undefined, 
    updates: Record<string, any> | undefined
  ): Record<string, any> | undefined {
    if (!updates) return undefined;
    const base = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
    return { ...base, ...updates };
  }
  
  /**
   * Возвращает дефолтные настройки
   */
  export function getDefaultSettings(): UserSettings {
    return {
      privacy: { ...DEFAULT_PRIVACY },
      appearance: { ...DEFAULT_APPEARANCE },
      notifications: { ...DEFAULT_NOTIFICATIONS },
      chatBehavior: { ...DEFAULT_CHAT_BEHAVIOR }
    };
  }