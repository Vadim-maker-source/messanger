export interface SidebarItem {
    id: string;
    uiType: "CHAT" | "SERVER";
    type: string;
    title: string;
    image: string | null;
    lastMessage: string;
    updatedAt: Date;
}

export interface Message {
    id: string;
    content: string;
    fileUrl: string | null;
    fileType: string | null;
    userId: string;
    chatId: string;
    createdAt: Date;
    updatedAt: Date;
    deleted: boolean;
    replyToId?: string | null;
    replyTo?: Message | null;
    reactions?: { [key: string]: string[] } | null;
    readReceipts?: Array<{ userId: string; readAt: Date }>;
    user: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
  }

  export type PrivacySettings = {
    showOnlineStatus: boolean;
    showLastSeen: boolean;
    allowDirectMessages: "everyone" | "contacts" | "nobody";
    allowAddToChats: "everyone" | "contacts" | "nobody";
    profileVisibility: "public" | "contacts" | "private";
  };
  
  export type AppearanceSettings = {
    theme: "light" | "dark" | "system";
    chatTheme?: string;
    messageFontSize: "small" | "medium" | "large";
    accentColor?: string;
    chatBackground?: string;
  };
  
  export type NotificationSettings = {
    pushNotifications: boolean;
    soundNotifications: boolean;
    vibration: boolean;
    showNotificationPreview: boolean;
    mutedChats: string[];
  };
  
  export type ChatBehaviorSettings = {
    sendReadReceipts: boolean;
    showTypingIndicator: boolean;
    autoDownloadMedia: "always" | "wifi" | "never";
    compressImages: boolean;
  };
  
  export type UserSettings = {
    privacy: PrivacySettings;
    appearance: AppearanceSettings;
    notifications: NotificationSettings;
    chatBehavior: ChatBehaviorSettings;
    preferences?: Record<string, any>;
  };

  export interface SettingsType {
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