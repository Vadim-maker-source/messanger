"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import CreateModal from "@/components/CreateModal";
import { getUserSidebarData } from "../lib/api/chat";
import { SidebarItem } from "../lib/types";
import { getCurrentUser } from "../lib/api/user";
import { StatusProvider } from "@/components/StatusProvider";
import { User } from "next-auth";
import { SettingsProvider } from "@/components/SettingsProvider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<SidebarItem[]>([]);
    const [modalType, setModalType] = useState<'SERVER' | 'CHAT' | 'CHANNEL' | null>(null);
    const [user, setUser] = useState<User | null>(null)
  
    useEffect(() => {
      const fetchData = async () => {
        const data = await getUserSidebarData();
        // Принудительно приводим к типу, если Prisma возвращает чуть более широкие типы
        setItems(data as SidebarItem[]);
        const currentUser = await getCurrentUser();
        if(currentUser){
          setUser(currentUser)
        }
      };
      
      fetchData();
    }, []);

  return (
    <div className="flex h-screen w-full bg-[#09090b]">
      <Sidebar 
        items={items}
        onOpenCreate={(type: any) => setModalType(type)}
      />
      
      <main className="flex-1 relative overflow-hidden">
      <StatusProvider currentUserId={user?.id || ""}>
      <SettingsProvider>
        {children}
        </SettingsProvider>
        </StatusProvider>
      </main>

      <CreateModal 
        isOpen={!!modalType} 
        onClose={() => setModalType(null)} 
        type={modalType} 
      />
    </div>
  );
}