"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import CreateModal from "@/components/CreateModal";
import { getUserSidebarData } from "../lib/api/chat";
import { getCurrentUser } from "../lib/api/user";
import { StatusProvider } from "@/components/StatusProvider";
import { SettingsProvider } from "@/components/SettingsProvider";
import { pusherClient } from "@/app/lib/pusher";
import GlobalCallLayer from "@/components/GlobalCallLayer";

interface SidebarItem {
  id: string;
  title: string;
  image?: string | null;
  uiType: string;
  type?: string;
  subtitle?: string;
  chats?: any[];
  lastMessage?: {
    content: string;
    createdAt: Date;
    status: 'SENT' | 'DELIVERED' | 'READ';
    senderId: string;
    isVoice?: boolean;
    isPhoto?: boolean;
    isFile?: boolean;
  };
  unreadCount?: number;
  isTyping?: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  updatedAt?: Date;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<SidebarItem[]>([]);
    const [modalType, setModalType] = useState<'SERVER' | 'CHAT' | 'CHANNEL' | null>(null);
    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    const loadSidebarData = useCallback(async () => {
        try {
            const data = await getUserSidebarData();
            setItems(data as SidebarItem[]);
        } catch (error) {
            console.error("Failed to load sidebar data:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            await loadSidebarData();
            const currentUser = await getCurrentUser();
            if (currentUser) {
                setUser(currentUser);
            }
        };
        fetchData();
    }, [loadSidebarData]);

    // Подписка на обновления сайдбара и непрочитанных
    useEffect(() => {
        if (!user?.id) return;

        const channel = pusherClient.subscribe(`user-${user.id}`);
        
        const handleSidebarUpdate = () => {
            console.log("Sidebar update received");
            loadSidebarData();
        };
        
        const handleUnreadUpdate = () => {
            console.log("Unread update received");
            loadSidebarData();
        };
        
        channel.bind("sidebar-update", handleSidebarUpdate);
        channel.bind("unread-update", handleUnreadUpdate);
        
        return () => {
            channel.unbind("sidebar-update", handleSidebarUpdate);
            channel.unbind("unread-update", handleUnreadUpdate);
            pusherClient.unsubscribe(`user-${user.id}`);
        };
    }, [user?.id, loadSidebarData]);

    const handleOpenCreate = (type: any) => {
        setModalType(type);
    };

    const handleCloseCreate = () => {
        setModalType(null);
        loadSidebarData();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#09090b]">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full bg-[#09090b]">
            <Sidebar items={items} />

            <main className="flex-1 relative overflow-hidden">
                <StatusProvider currentUserId={user?.id || ""}>
                    <SettingsProvider>
                        {user?.id && (
                            <GlobalCallLayer
                                currentUser={{
                                    id: user.id,
                                    username: user.username,
                                    displayName: user.displayName,
                                    avatarUrl: user.avatarUrl,
                                }}
                            />
                        )}
                        {children}
                    </SettingsProvider>
                </StatusProvider>
            </main>

            <CreateModal 
                isOpen={!!modalType} 
                onClose={handleCloseCreate} 
                type={modalType} 
            />
        </div>
    );
}