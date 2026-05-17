// app/call/audio/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import VKCallModal from "@/components/VKCallModal";

export default function AudioCallPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatId = searchParams?.get("chatId");
  const userId = searchParams?.get("userId");

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetch("/api/current-user");
        const data = await res.json();
        setCurrentUser(data);
      } catch (error) {
        console.error("Error loading user:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, []);

  if (isLoading || !currentUser || !chatId || !userId) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <VKCallModal
      isOpen={true}
      onClose={() => router.back()}
      chatId={chatId}
      currentUserId={currentUser.id}
      currentUserName={currentUser.displayName || currentUser.username}
      callType="audio"
    />
  );
}
