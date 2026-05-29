"use client";

import { useState, useEffect } from "react";
import { Search, Users, MessageSquare, ServerIcon, User, Loader2, FolderOpen, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { globalSearch, getOrCreateDirectChat } from "@/app/lib/api/search";

interface SearchResult {
  users: any[];
  chats: any[];
  servers: any[];
}

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'users' | 'chats' | 'servers'>('all');
  const router = useRouter();

  useEffect(() => {
    const search = async () => {
      if (searchQuery.length > 1) {
        setIsSearching(true);
        try {
          const res = await globalSearch(searchQuery);
          setResults(res);
        } catch (error) {
          console.error("Search error:", error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setResults(null);
      }
    };

    const timeoutId = setTimeout(search, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const onUserClick = async (userId: string) => {
    try {
      const chat = await getOrCreateDirectChat(userId);
      router.push(`/chat/${chat.id}`);
    } catch (error) {
      console.error("Error creating chat:", error);
    }
  };

  const getResultCount = () => {
    if (!results) return 0;
    return (results.users?.length || 0) + (results.chats?.length || 0) + (results.servers?.length || 0);
  };

  const getFilteredResults = () => {
    if (!results) return { users: [], chats: [], servers: [] };
    
    switch (activeTab) {
      case 'users':
        return { users: results.users, chats: [], servers: [] };
      case 'chats':
        return { users: [], chats: results.chats, servers: [] };
      case 'servers':
        return { users: [], chats: [], servers: results.servers };
      default:
        return results;
    }
  };

  const filtered = getFilteredResults();
  const hasResults = filtered.users.length > 0 || filtered.chats.length > 0 || filtered.servers.length > 0;

  return (
    <div className="h-screen bg-gradient-to-br from-[#0a0a0f] to-[#050508] text-white overflow-hidden">
      <div className="max-w-4xl mx-auto h-full flex flex-col p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-white/10 rounded-xl transition-all group"
          >
            <ArrowLeft size={20} className="text-white/60 group-hover:text-violet-400" />
          </button>
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск пользователей, чатов и серверов..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 outline-none focus:border-violet-500/50 transition-all text-lg"
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        {results && (
          <div className="flex gap-2 mb-6 border-b border-white/10">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 text-sm font-medium transition-all relative ${
                activeTab === 'all' 
                  ? 'text-violet-400' 
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              Все результаты
              {activeTab === 'all' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500"
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 text-sm font-medium transition-all relative flex items-center gap-2 ${
                activeTab === 'users' 
                  ? 'text-violet-400' 
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              <Users size={16} />
              Пользователи
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10">
                {results.users?.length || 0}
              </span>
              {activeTab === 'users' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500"
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('chats')}
              className={`px-4 py-2 text-sm font-medium transition-all relative flex items-center gap-2 ${
                activeTab === 'chats' 
                  ? 'text-violet-400' 
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              <MessageSquare size={16} />
              Чаты
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10">
                {results.chats?.length || 0}
              </span>
              {activeTab === 'chats' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500"
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('servers')}
              className={`px-4 py-2 text-sm font-medium transition-all relative flex items-center gap-2 ${
                activeTab === 'servers' 
                  ? 'text-violet-400' 
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              <ServerIcon size={16} />
              Серверы
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10">
                {results.servers?.length || 0}
              </span>
              {activeTab === 'servers' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500"
                />
              )}
            </button>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isSearching ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-violet-500" size={40} />
            </div>
          ) : !results ? (
            <div className="text-center py-20">
              <Search size={64} className="text-white/10 mx-auto mb-4" />
              <h3 className="text-xl font-medium mb-2">Начните поиск</h3>
              <p className="text-white/40">Введите запрос для поиска пользователей, чатов и серверов</p>
            </div>
          ) : !hasResults ? (
            <div className="text-center py-20">
              <FolderOpen size={64} className="text-white/10 mx-auto mb-4" />
              <h3 className="text-xl font-medium mb-2">Ничего не найдено</h3>
              <p className="text-white/40">Попробуйте изменить поисковый запрос</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Users Section */}
              {filtered.users.length > 0 && (
                <div>
                  {activeTab === 'all' && (
                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Users size={20} className="text-violet-400" />
                      Пользователи
                    </h2>
                  )}
                  <div className="grid gap-2">
                    {filtered.users.map((user: any, index: number) => (
                      <motion.button
                        key={user.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => onUserClick(user.id)}
                        className="flex items-center gap-4 p-4 bg-white/5 hover:bg-violet-500/10 rounded-2xl transition-all group"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center text-violet-400 font-bold text-lg shrink-0 overflow-hidden">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} className="w-full h-full object-cover" />
                          ) : (
                            <User size={24} />
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium">{user.displayName || user.username}</p>
                          <p className="text-sm text-white/40">@{user.username}</p>
                        </div>
                        <div className="text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          Написать →
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chats Section */}
              {filtered.chats.length > 0 && (
                <div>
                  {activeTab === 'all' && (
                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <MessageSquare size={20} className="text-violet-400" />
                      Чаты
                    </h2>
                  )}
                  <div className="grid gap-2">
                    {filtered.chats.map((chat: any, index: number) => (
                      <motion.button
                        key={chat.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => router.push(`/chat/${chat.id}`)}
                        className="flex items-center gap-4 p-4 bg-white/5 hover:bg-violet-500/10 rounded-2xl transition-all group"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center text-violet-400 shrink-0">
                          {chat.type === 'GROUP' ? <Users size={24} /> : <MessageSquare size={24} />}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium">{chat.name}</p>
                          {chat.lastMessage && (
                            <p className="text-sm text-white/40 truncate">{chat.lastMessage}</p>
                          )}
                        </div>
                        <div className="text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          Открыть →
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Servers Section */}
              {filtered.servers.length > 0 && (
                <div>
                  {activeTab === 'all' && (
                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <ServerIcon size={20} className="text-violet-400" />
                      Серверы
                    </h2>
                  )}
                  <div className="grid gap-2">
                    {filtered.servers.map((server: any, index: number) => (
                      <motion.button
                        key={server.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => router.push(`/server/${server.id}`)}
                        className="flex items-center gap-4 p-4 bg-white/5 hover:bg-violet-500/10 rounded-2xl transition-all group"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center text-violet-400 font-bold text-lg shrink-0 overflow-hidden">
                          {server.imageUrl ? (
                            <img src={server.imageUrl} className="w-full h-full object-cover" />
                          ) : (
                            <ServerIcon size={24} />
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium">{server.name}</p>
                          {server.memberCount && (
                            <p className="text-sm text-white/40">{server.memberCount} участников</p>
                          )}
                        </div>
                        <div className="text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          Перейти →
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.8);
        }
      `}</style>
    </div>
  );
}