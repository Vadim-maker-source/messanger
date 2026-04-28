// components/RealTimeChat.tsx
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { 
  Send, Paperclip, Mic, Video, X, Play, Pause, Volume2, 
  MoreVertical, ArrowLeft, MessageSquare, Reply, Forward, Edit, 
  Trash2, Smile, Check, Heart, ThumbsUp, Laugh, 
  Angry, Sparkles, AlertCircle, Search, ChevronRight, Loader2, 
  Users, Crown, Shield, Info, Copy, Flag, Image, File,
  Download, Eye,
  CheckCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  sendMessage, 
  getMessages, 
  editMessage, 
  deleteMessage, 
  addReaction, 
  removeReaction,
  forwardMessage,
  getAvailableChats,
  getChatInfo,
  updateMemberRole,
  removeChatMember,
  getUserRoleInChat,
  checkCanWriteInChat,
  markMessagesAsRead,
  searchMessages,
  canAccessChat
} from "@/app/lib/api/chat";
import { pusherClient } from "@/app/lib/pusher";
import { uploadChatImage } from "@/app/lib/yandex-storage";
import { useRouter } from "next/navigation";
import { useStatus } from "./StatusProvider";
import { useSettings } from "./SettingsProvider";
import { canViewUserProfile, removeChatWallpaper, uploadChatWallpaper } from "@/app/lib/api/user";
import Link from "next/link";
import { createVKCall, createYandexCall } from "@/app/lib/api/calls";
import { Peer } from "peerjs";
import VideoCallModal from "./VideoCallModal";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { toast } from "sonner";

type ChatRole = 'CREATOR' | 'ADMIN' | 'MEMBER';

interface ReadReceipt {
  userId: string;
  readAt: Date;
  user?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

interface Message {
  id: string;
  content: string;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  forwardedFromMessageId?: string | null;
  forwardedFromChatId?: string | null;
  forwardedFromChatName?: string | null;
  forwardedFromChatType?: string | null;
  forwardedFromUserId?: string | null;
  forwardedFromUserName?: string | null;
  userId: string;
  chatId: string;
  createdAt: Date;
  updatedAt: Date;
  deleted: boolean;
  replyToId?: string | null;
  replyTo?: Message | null;
  reactions?: { [key: string]: string[] } | null;
  readReceipts?: ReadReceipt[];
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

interface Chat {
  id: string;
  title: string;
  image: string | null;
  type: string;
  access?: string;
}

interface ChatMember {
  id: string;
  role: ChatRole;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

interface RealTimeChatProps {
  chatId: string;
  currentUser: { id: string; isIdAdmin: boolean; username: string; displayName: string; avatarUrl?: string | null };
  userRole?: ChatRole | null;
  chatMembers?: ChatMember[];
  chatType: string;
  initialMembersCount: number;
  chatName?: string | null;
  chatAvatar?: string | null;
  partner?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
}

const reactionsList = [
  { emoji: "❤️", value: "heart", label: "Сердце" },
  { emoji: "👍", value: "like", label: "Нравится" },
  { emoji: "😂", value: "laugh", label: "Смех" },
  { emoji: "😮", value: "wow", label: "Удивление" },
  { emoji: "😢", value: "sad", label: "Грусть" },
  { emoji: "😡", value: "angry", label: "Злость" },
];

// Компонент для изображений
const ImageMessage = ({ url }: { url: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
  if (isOpen) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = 'unset';
  }
  return () => {
    document.body.style.overflow = 'unset';
  };
}, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaY = e.touches[0].clientY - startY;
    setCurrentY(deltaY);
  };

  const handleTouchEnd = () => {
    if (Math.abs(currentY) > 100) {
      setIsOpen(false);
    }
    setStartY(0);
    setCurrentY(0);
    setIsDragging(false);
  };

  return (
    <>
      <motion.img 
        src={url} 
        alt="message" 
        className="max-w-90 max-h-90 min-w-75 w-auto h-auto rounded-lg cursor-pointer object-cover hover:opacity-90 transition-opacity"
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
        loading="lazy"
      />
      
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center cursor-pointer backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <motion.button 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ delay: 0.1 }}
              className="absolute top-4 right-4 z-10 text-white p-2 hover:bg-white/10 rounded-full transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
            >
              <X size={24} />
            </motion.button>
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
                y: currentY
              }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-[90vw] max-h-[90vh]"
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full"
                  />
                </div>
              )}
              <motion.img 
                src={url} 
                alt="fullscreen" 
                className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: isLoading ? 0 : 1 }}
                transition={{ duration: 0.3 }}
                onLoad={() => setIsLoading(false)}
                draggable={false}
              />
            </motion.div>

            {/* Индикатор свайпа */}
            {isDragging && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 text-sm"
              >
                ↓ Свайпните вниз, чтобы закрыть ↓
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// Компонент для видео
const VideoMessage = ({ url }: { url: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="relative rounded-lg overflow-hidden max-w-[300px] group">
      <video 
        ref={videoRef}
        src={url}
        className="w-full cursor-pointer rounded-lg"
        onClick={togglePlay}
        controls={false}
      />
      {!isPlaying && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/50 cursor-pointer group-hover:bg-black/60 transition-all"
          onClick={togglePlay}
        >
          <Play className="w-12 h-12 text-white" />
        </div>
      )}
    </div>
  );
};

// Компонент для аудио
const AudioMessage = ({ url }: { url: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const percent = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(percent);
    }
  };

  return (
    <div className="bg-white/10 rounded-lg p-3 min-w-[250px]">
      <audio 
        ref={audioRef} 
        src={url} 
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center hover:bg-orange-600 transition-colors"
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <div className="flex-1">
          <div className="h-1 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-orange-500 transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <Volume2 size={16} className="text-white/60" />
      </div>
    </div>
  );
};

// Компонент для кружочков видео
const RoundVideoMessage = ({ url }: { url: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.addEventListener('ended', () => setIsPlaying(false));
      return () => {
        if (videoRef.current) {
          videoRef.current.removeEventListener('ended', () => setIsPlaying(false));
        }
      };
    }
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div 
      className="relative w-40 h-40 rounded-full overflow-hidden cursor-pointer shadow-lg hover:scale-105 transition-transform duration-200"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={togglePlay}
    >
      <video 
        ref={videoRef}
        src={url}
        className="w-full h-full object-cover"
        loop
        muted={false}
        playsInline
      />
      {!isPlaying && (
        <div className={`absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <Play className="w-8 h-8 text-white" />
        </div>
      )}
    </div>
  );
};

// Компонент для файлов
// Компонент для файлов
// Компонент для файлов - упрощенная версия
// Компонент для файлов
const FileMessage = ({ fileUrl, fileName }: { fileUrl: string; fileName?: string | null }) => {
  const getFileIcon = () => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext || '')) return "📄";
    if (['doc', 'docx'].includes(ext || '')) return "📝";
    if (['xls', 'xlsx'].includes(ext || '')) return "📊";
    if (['zip', 'rar', '7z'].includes(ext || '')) return "📦";
    return "📎";
  };

  const displayName = fileName || "Файл";

  return (
    <a 
      href={fileUrl} 
      target="_blank" 
      rel="noopener noreferrer"
      className="flex items-center gap-3 bg-white/10 rounded-lg p-3 hover:bg-white/20 transition-colors group min-w-[200px]"
    >
      <div className="text-2xl">{getFileIcon()}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{displayName}</p>
        <p className="text-xs text-white/40">Скачать файл</p>
      </div>
      <Download size={16} className="text-white/40 group-hover:text-white transition-colors" />
    </a>
  );
};

// Компонент статуса прочтения
const ReadStatusIndicator = ({ 
  message, 
  isOwn, 
  chatType, 
  chatMembers 
}: { 
  message: Message; 
  isOwn: boolean; 
  chatType: string;
  chatMembers: ChatMember[];
}) => {
  if (!isOwn) return null;
  
  const readReceipts = message.readReceipts || [];
  const isRead = readReceipts.length > 0;
  
  if (chatType === "PRIVATE") {
    // Для приватных чатов - одна или две галочки
    return (
      <div className="flex items-center gap-0.5">
        {isRead ? <CheckCheck size={16} className="-ml-1 text-white text-md" /> : <Check size={16} className="text-white/40 text-md" />}
      </div>
    );
  } else {
    // Для групповых чатов - показываем количество прочитавших
    const readersCount = readReceipts.length;
    
    if (readersCount === 0) {
      return <Check size={16} className="text-white/40" />;
    }
    
    const readers = readReceipts
      .map(receipt => {
        const member = chatMembers.find(m => m.user.id === receipt.userId);
        return member?.user.displayName || member?.user.username;
      })
      .filter(Boolean);
    
    return (
      <div className="relative group">
        <div className="flex items-center gap-0.5 cursor-help">
          <Check size={10} className="text-blue-400" />
          <span className="text-[8px] text-blue-400 ml-0.5">
            {readersCount}
          </span>
        </div>
        
        {readers.length > 0 && (
          <div className="absolute bottom-full right-0 mb-1 hidden group-hover:block bg-[#1e1e22] border border-white/10 rounded-lg p-2 min-w-[150px] z-10 shadow-xl">
            <p className="text-xs text-white/60 mb-1 border-b border-white/10 pb-1">Прочитали:</p>
            <div className="max-h-[150px] overflow-y-auto">
              {readers.map((name, idx) => (
                <p key={idx} className="text-xs text-white truncate py-0.5">
                  {name}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
};

// Компонент контекстного меню
const MessageContextMenu = ({ x, y, message, isOwn, canDelete, onClose, onReply, onForward, onEdit, onDelete, onReact, onCopy }: any) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      let newX = x;
      let newY = y;
      
      if (x + rect.width > window.innerWidth) {
        newX = window.innerWidth - rect.width - 10;
      }
      if (y + rect.height > window.innerHeight) {
        newY = window.innerHeight - rect.height - 10;
      }
      if (newX < 10) newX = 10;
      if (newY < 10) newY = 10;
      
      setPosition({ x: newX, y: newY });
    }
  }, [x, y]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("contextmenu", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("contextmenu", handleClickOutside);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={{ position: "fixed", top: position.y, left: position.x, zIndex: 1000 }}
      className="bg-[#1e1e22] border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[220px]"
    >
      <div className="py-1">
        <button
          onClick={() => { onReply(); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors text-sm text-white"
        >
          <Reply size={16} className="text-orange-400" />
          Ответить
        </button>
        <button
          onClick={() => { onForward(); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors text-sm text-white"
        >
          <Forward size={16} className="text-blue-400" />
          Переслать
        </button>
        <button
          onClick={() => { onReact(); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors text-sm text-white"
        >
          <Smile size={16} className="text-yellow-400" />
          Реакция
        </button>
        <button
          onClick={() => { onCopy(); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors text-sm text-white"
        >
          <Copy size={16} className="text-green-400" />
          Копировать текст
        </button>
        {isOwn && (
          <button
            onClick={() => { onEdit(); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors text-sm text-white"
          >
            <Edit size={16} className="text-purple-400" />
            Редактировать
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => { onDelete(); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-500/10 transition-colors text-sm text-red-400"
          >
            <Trash2 size={16} />
            Удалить
          </button>
        )}
      </div>
    </motion.div>
  );
};

// Компонент для выбора реакций
const ReactionPicker = ({ onSelect, onClose }: { onSelect: (reaction: string) => void; onClose: () => void }) => {
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [onClose]);

  return (
    <motion.div
      ref={pickerRef}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-[#1e1e22] border border-white/10 rounded-xl p-2 shadow-2xl flex gap-1"
    >
      {reactionsList.map(reaction => (
        <button
          key={reaction.value}
          onClick={() => onSelect(reaction.value)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-2xl"
          title={reaction.label}
        >
          {reaction.emoji}
        </button>
      ))}
    </motion.div>
  );
};

  const FileUploadModal = ({ 
  isOpen, 
  onClose, 
  files, 
  onRemoveFile,
  caption,
  onCaptionChange,
  onUpload,
  isUploading 
}: { 
  isOpen: boolean;
  onClose: () => void;
  files: File[];
  onRemoveFile: (index: number) => void;
  caption: string;
  onCaptionChange: (value: string) => void;
  onUpload: () => void;
  isUploading: boolean;
}) => {
  const [previewUrls, setPreviewUrls] = useState<{ [key: number]: string }>({});
  
  // Создаем превью для изображений при монтировании
  useEffect(() => {
    const urls: { [key: number]: string } = {};
    files.forEach((file, index) => {
      if (file.type.startsWith('image/')) {
        urls[index] = URL.createObjectURL(file);
      }
    });
    setPreviewUrls(urls);
    
    // Очищаем URL при размонтировании
    return () => {
      Object.values(urls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [files]);
  
  // Форматирование размера файла
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Получение иконки для файла
  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return null; // Для изображений показываем превью
    if (file.type.startsWith('video/')) return "🎥";
    if (file.type.startsWith('audio/')) return "🎵";
    if (file.type.includes('pdf')) return "📄";
    if (file.type.includes('word')) return "📝";
    if (file.type.includes('excel')) return "📊";
    return "📎";
  };
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 z-[400] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-[#121214] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-white/10 bg-gradient-to-r from-violet-500/10 to-purple-500/10">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Paperclip size={20} className="text-violet-400" />
                Загрузка файлов
              </h3>
              <p className="text-sm text-white/40 mt-1">
                Выберите подпись для загружаемых файлов
              </p>
            </div>
            
            {/* Files Preview */}
            <div className="p-5 max-h-[400px] overflow-y-auto custom-scrollbar">
              <div className="space-y-2 mb-4">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-2">
                  Выбрано файлов: {files.length}
                </p>
                {files.map((file, index) => (
                  <motion.div
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(index * 0.05, 0.3) }}
                    className="flex items-center gap-3 p-3 bg-white/5 rounded-xl group hover:bg-white/10 transition-colors"
                  >
                    {/* Preview для изображений */}
                    {file.type.startsWith('image/') && previewUrls[index] ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-black/30 flex-shrink-0">
                        <img 
                          src={previewUrls[index]} 
                          alt="preview" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="text-2xl w-12 h-12 flex items-center justify-center flex-shrink-0">
                        {getFileIcon(file)}
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{file.name}</p>
                      <p className="text-xs text-white/40">{formatFileSize(file.size)}</p>
                    </div>
                    
                    <button
                      onClick={() => onRemoveFile(index)}
                      className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </motion.div>
                ))}
              </div>
              
              {/* Caption Input */}
              <div className="mt-4">
                <label className="text-sm text-white/60 block mb-2">
                  Подпись к файлам
                  <span className="text-xs text-white/30 ml-2">(необязательно)</span>
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => onCaptionChange(e.target.value)}
                  placeholder="Напишите что-нибудь к этим файлам..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-violet-500 transition-colors resize-none placeholder:text-white/20"
                  autoFocus
                />
                <p className="text-xs text-white/30 mt-2">
                  {caption ? `${caption.length}/500 символов` : "Подпись будет отображаться как основное сообщение"}
                </p>
              </div>
            </div>
            
            {/* Actions */}
            <div className="p-5 border-t border-white/10 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={onUpload}
                disabled={isUploading || files.length === 0}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 rounded-xl text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Загрузка...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Отправить ({files.length})
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default function RealTimeChat({ 
  chatId, 
  currentUser, 
  userRole: initialUserRole,
  chatMembers: initialChatMembers,
  chatType, 
  initialMembersCount,
  chatName,
  chatAvatar,
  partner
}: RealTimeChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingType, setRecordingType] = useState<'audio' | 'video' | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [selectedForwardChatIds, setSelectedForwardChatIds] = useState<string[]>([]);
  const [availableChats, setAvailableChats] = useState<Chat[]>([]);
  const [searchChats, setSearchChats] = useState("");
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [chatMembers, setChatMembers] = useState<ChatMember[]>(initialChatMembers || []);
  const [userRole, setUserRole] = useState<ChatRole | null>(initialUserRole || null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: Message } | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasMarkedRead, setHasMarkedRead] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [isChangingWallpaper, setIsChangingWallpaper] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSubscribed = useRef(false);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { settings, refreshSettings } = useSettings();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);

  // Хук для статуса онлайн
  const { getUserOnlineStatus, getFormattedLastSeen } = useStatus();

  const isChannel = chatType === "CHANNEL";
  const canWrite = !isChannel || (isChannel && (userRole === 'CREATOR' || userRole === 'ADMIN' || currentUser.isIdAdmin));
  const chatWallpapers = (settings?.preferences?.chatWallpapers || {}) as Record<string, string>;
  const chatWallpaper = chatWallpapers[chatId] || settings?.chatBackground || null;

  // Загрузка сообщений
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const fetchedMessages = await getMessages(chatId);
        const filteredMessages = fetchedMessages.filter(msg => !msg.deleted);
        const formattedMessages = filteredMessages.map(msg => ({
          ...msg,
          reactions: msg.reactions as { [key: string]: string[] } | null,
          readReceipts: msg.readReceipts || []
        })) as Message[];
        setMessages(formattedMessages);
      } catch (error) {
        console.error("Error loading messages:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadMessages();
  }, [chatId]);

  // Загрузка участников
  useEffect(() => {
    const loadMembers = async () => {
      try {
        const chatInfo = await getChatInfo(chatId);
        setChatMembers(chatInfo?.members || []);
        const role = await getUserRoleInChat(chatId, currentUser.id);
        setUserRole(role);
      } catch (error) {
        console.error("Error loading members:", error);
      }
    };
    
    if (chatType !== "PRIVATE") {
      loadMembers();
    }
  }, [chatId, chatType, currentUser.id]);

  // Функция для отметки прочтения
  const markCurrentMessagesAsRead = async () => {
    if (hasMarkedRead) return;
    if (messages.length === 0) return;
    
    const lastMessage = [...messages].reverse().find(m => m.userId !== currentUser.id);
    if (!lastMessage) return;
    
    const isAlreadyRead = lastMessage.readReceipts?.some(r => r.userId === currentUser.id);
    if (isAlreadyRead) return;
    
    try {
      await markMessagesAsRead(chatId, lastMessage.id);
      setHasMarkedRead(true);
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  // Отслеживание видимых сообщений
  useEffect(() => {
    if (!messagesContainerRef.current || messages.length === 0) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          markCurrentMessagesAsRead();
        }
      },
      { threshold: 0.3 }
    );
    
    const container = messagesContainerRef.current;
    observer.observe(container);
    
    return () => observer.disconnect();
  }, [messages, hasMarkedRead]);

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    if (isAtBottom) {
      markCurrentMessagesAsRead();
    }
  };

  // Подписка на Pusher
  useEffect(() => {
    if (isSubscribed.current) return;
    const channel = pusherClient.subscribe(chatId);
    
    const handleNewMessage = (newMessage: any) => {
      setMessages(prev => {
        const exists = prev.some(msg => msg.id === newMessage.id);
        if (exists) return prev;
        const formattedMessage = {
          ...newMessage,
          reactions: newMessage.reactions as { [key: string]: string[] } | null,
          readReceipts: newMessage.readReceipts || []
        } as Message;
        return [...prev, formattedMessage];
      });
      setHasMarkedRead(false);
    };
    
    const handleMessageUpdate = (updatedMessage: any) => {
      setMessages(prev => prev.map(msg => {
        if (msg.id === updatedMessage.id) {
          return {
            ...updatedMessage,
            reactions: updatedMessage.reactions as { [key: string]: string[] } | null,
            readReceipts: updatedMessage.readReceipts || msg.readReceipts
          } as Message;
        }
        return msg;
      }));
    };
    
    const handleMessageDelete = (messageId: string) => {
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    };
    
    const handleReactionUpdate = ({ messageId, reactions }: { messageId: string; reactions: any }) => {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, reactions: reactions as { [key: string]: string[] } | null } 
          : msg
      ));
    };
    
    const handleMessagesRead = ({ userId, messageIds, readAt }: { userId: string; messageIds: string[]; readAt: Date }) => {
      if (userId === currentUser.id) return;
      
      setMessages(prev => prev.map(msg => {
        if (messageIds.includes(msg.id)) {
          const existingReceipts = msg.readReceipts || [];
          const alreadyExists = existingReceipts.some(r => r.userId === userId);
          
          if (!alreadyExists) {
            return {
              ...msg,
              readReceipts: [...existingReceipts, { userId, readAt: new Date(readAt) }]
            };
          }
        }
        return msg;
      }));
    };
    
    channel.bind("new-message", handleNewMessage);
    channel.bind("message-updated", handleMessageUpdate);
    channel.bind("message-deleted", handleMessageDelete);
    channel.bind("reaction-updated", handleReactionUpdate);
    channel.bind("messages-read", handleMessagesRead);
    isSubscribed.current = true;
    
    return () => {
      channel.unbind("new-message", handleNewMessage);
      channel.unbind("message-updated", handleMessageUpdate);
      channel.unbind("message-deleted", handleMessageDelete);
      channel.unbind("reaction-updated", handleReactionUpdate);
      channel.unbind("messages-read", handleMessagesRead);
      pusherClient.unsubscribe(chatId);
      isSubscribed.current = false;
    };
  }, [chatId, currentUser.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isSearchOpen || !searchQuery.trim()) {
      setSearchResults([]);
      setActiveSearchIndex(0);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const found = await searchMessages(chatId, searchQuery);
        setSearchResults(found as Message[]);
        setActiveSearchIndex(0);
      } catch (error) {
        console.error("Error searching messages:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [chatId, isSearchOpen, searchQuery]);

  useEffect(() => {
  const markRead = async () => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.userId !== currentUser.id) {
        await markMessagesAsRead(chatId, lastMessage.id);
        // Отправляем событие для обновления сайдбара
        await fetch('/api/sidebar/refresh', { method: 'POST' });
      }
    }
  };
  markRead();
}, [messages]);

  // Отправка сообщения
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !editingMessage) || isSending) return;
    if (isChannel && !canWrite) {
      alert("Только администратор может писать в канал");
      return;
    }
    
    setIsSending(true);
    try {
      if (editingMessage) {
        const updatedMessage = await editMessage(editingMessage.id, newMessage);
        const formattedMessage = {
          ...updatedMessage,
          reactions: updatedMessage.reactions as { [key: string]: string[] } | null,
          readReceipts: []
        } as Message;
        setMessages(prev => prev.map(msg => msg.id === formattedMessage.id ? formattedMessage : msg));
        setEditingMessage(null);
        setNewMessage("");
      } else {
        const sentMessage = await sendMessage(chatId, newMessage.trim(), null, null, replyingTo?.id);
        const formattedMessage = {
          ...sentMessage,
          reactions: sentMessage.reactions as { [key: string]: string[] } | null,
          readReceipts: []
        } as Message;
        setMessages(prev => {
          const exists = prev.some(msg => msg.id === formattedMessage.id);
          if (exists) return prev;
          return [...prev, formattedMessage];
        });
        setNewMessage("");
        setReplyingTo(null);
        setHasMarkedRead(false);
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      alert(error instanceof Error ? error.message : "Ошибка отправки");
    } finally {
      setIsSending(false);
    }
  };

  // Обработка выбора файлов
  // Обработка выбора файлов через кнопку "скрепочка"
const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;
  
  if (isChannel && !canWrite) {
    toast.error("Только администратор может отправлять файлы в канал");
    return;
  }
  
  // Открываем модальное окно для ввода подписи
  setPendingFiles(prev => {
    // Фильтруем дубликаты по имени и размеру
    const newFiles = files.filter(file => 
      !prev.some(existingFile => 
        existingFile.name === file.name && 
        existingFile.size === file.size &&
        existingFile.lastModified === file.lastModified
      )
    );
    return [...prev, ...newFiles];
  });
  setFileCaption("");
  setShowFileUploadModal(true);
  
  // Очищаем input, чтобы можно было выбрать те же файлы снова
  e.target.value = '';
};

  const buildFileFromBlob = (blob: Blob, name: string, type: string): File => {
    if (typeof window !== 'undefined' && (window as any).File) {
      return new (window as any).File([blob], name, { type });
    }

    return Object.assign(blob, {
      name,
      lastModified: Date.now(),
      webkitRelativePath: '',
    }) as File;
  };

  // Запись видеокружочка
const startAudioRecording = async () => {
  if (isChannel && !canWrite) {
    toast.error("Только администратор может отправлять голосовые сообщения в канал");
    return;
  }
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordingStreamRef.current = stream;
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const file = buildFileFromBlob(blob, `voice-${Date.now()}.webm`, 'audio/webm');
      
      // Голосовые отправляем без модалки
      setIsSending(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const fileUrl = await uploadChatImage(formData);
        const sentMessage = await sendMessage(chatId, "🎤 Голосовое сообщение", fileUrl?.url, 'AUDIO', null, replyingTo?.id);
        const formattedMessage = {
          ...sentMessage,
          reactions: sentMessage.reactions as { [key: string]: string[] } | null,
          readReceipts: []
        } as Message;
        setMessages(prev => [...prev, formattedMessage]);
        setHasMarkedRead(false);
      } catch (error) {
        console.error("Error sending voice message:", error);
        toast.error("Ошибка отправки голосового сообщения");
      } finally {
        setIsSending(false);
      }
      
      recordingStreamRef.current?.getTracks().forEach(track => track.stop());
      recordingStreamRef.current = null;
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      setRecordingTime(0);
    };
    
    recorder.start();
    setMediaRecorder(recorder);
    setIsRecording(true);
    setRecordingType('audio');
    
    recordingIntervalRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
    
    setTimeout(() => {
      if (recorder.state === 'recording') stopRecording();
    }, 120000);
    
  } catch (error) {
    console.error("Error starting audio recording:", error);
    toast.error("Не удалось получить доступ к микрофону");
  }
};

// Запись видеокружочка (отправляется сразу)
const startRoundVideoRecording = async () => {
  if (isChannel && !canWrite) {
    toast.error("Только администратор может отправлять видеокружочки в канал");
    return;
  }

  if (recordingStreamRef.current) {
    recordingStreamRef.current.getTracks().forEach(track => track.stop());
    recordingStreamRef.current = null;
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast.error("Ваш браузер не поддерживает доступ к камере");
    return;
  }

  let stream: MediaStream | null = null;

  try {
    const constraints = {
      video: {
        width: { ideal: 480 },
        height: { ideal: 480 },
        facingMode: "user"
      },
      audio: true
    };
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    try {
      const constraints = {
        video: {
          width: { ideal: 480 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: false
      };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (videoErr) {
      console.error("Error getting camera:", videoErr);
      toast.error("Не удалось получить доступ к камере");
      return;
    }
  }

  if (!stream) return;

  recordingStreamRef.current = stream;

  let mimeType = '';
  const codecs = [
    'video/webm',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/mp4'
  ];
  for (const codec of codecs) {
    if (MediaRecorder.isTypeSupported(codec)) {
      mimeType = codec;
      break;
    }
  }

  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);
    
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = async () => {
    const blobType = mimeType || 'video/webm';
    const blob = new Blob(chunks, { type: blobType });
    const file = buildFileFromBlob(blob, `round-${Date.now()}.webm`, blobType);
    
    // Видеокружочки отправляем сразу без модалки
    setIsSending(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const fileUrl = await uploadChatImage(formData);
      const sentMessage = await sendMessage(chatId, "📹 Видеосообщение", fileUrl?.url, 'ROUND', null, replyingTo?.id);
      const formattedMessage = {
        ...sentMessage,
        reactions: sentMessage.reactions as { [key: string]: string[] } | null,
        readReceipts: []
      } as Message;
      setMessages(prev => [...prev, formattedMessage]);
      setHasMarkedRead(false);
    } catch (error) {
      console.error("Error sending round video:", error);
      toast.error("Ошибка отправки видеокружочка");
    } finally {
      setIsSending(false);
    }
    
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach(track => track.stop());
      recordingStreamRef.current = null;
    }
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    setRecordingTime(0);
  };

  recorder.onerror = (e) => {
    console.error("Recording error:", e);
    toast.error("Ошибка при записи видеокружочка");
    stopRecording();
  };

  recorder.start(1000);
  setMediaRecorder(recorder);
  setIsRecording(true);
  setRecordingType('video');

  recordingIntervalRef.current = setInterval(() => {
    setRecordingTime(prev => prev + 1);
  }, 1000);

  setTimeout(() => {
    if (recorder.state === 'recording') stopRecording();
  }, 60000);
};

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    recordingStreamRef.current?.getTracks().forEach(track => track.stop());
    recordingStreamRef.current = null;
    setIsRecording(false);
    setMediaRecorder(null);
    setRecordingType(null);
  };

  const handleDeleteMessage = (messageId: string) => {
  setMessageToDelete(messageId);
  setDeleteDialogOpen(true);
};

const confirmDeleteMessage = async () => {
  if (!messageToDelete) return;

  try {
    await deleteMessage(messageToDelete);
    setMessages(prev => prev.filter(msg => msg.id !== messageToDelete));
  } catch (error) {
    console.error("Error deleting message:", error);
    alert(error instanceof Error ? error.message : "Ошибка удаления");
  } finally {
    setDeleteDialogOpen(false);
    setMessageToDelete(null);
  }
};

  const handleAddReaction = async (messageId: string, reaction: string) => {
    try {
      const message = messages.find(m => m.id === messageId);
      if (!message) return;
      
      const userReaction = message.reactions && 
        Object.entries(message.reactions).find(([_, users]) => 
          users.includes(currentUser.id)
        );
      
      if (userReaction && userReaction[0] === reaction) {
        await removeReaction(messageId, reaction);
      } else {
        await addReaction(messageId, reaction);
      }
    } catch (error) {
      console.error("Error adding reaction:", error);
    }
    setShowEmojiPicker(null);
  };

  const handleForwardMessage = async () => {
  if (!forwardingMessage) return;
  if (selectedForwardChatIds.length === 0) {
    toast.error("Выберите хотя бы один чат");
    return;
  }

  setIsSending(true);
  let successCount = 0;
  
  try {
    for (const targetChatId of selectedForwardChatIds) {
      try {
        const canWriteInTarget = await checkCanWriteInChat(targetChatId, currentUser.id);
        if (!canWriteInTarget) {
          continue;
        }
        await forwardMessage(forwardingMessage.id, targetChatId);
        successCount++;
      } catch (error) {
        console.error(`Error forwarding to ${targetChatId}:`, error);
      }
    }
    
    if (successCount > 0) {
      toast.success(`Сообщение переслано в ${successCount} чат${successCount === 1 ? '' : 'ов'}`);
      // Закрываем диалог
      setShowForwardDialog(false);
      setForwardingMessage(null);
      setSelectedForwardChatIds([]);
    } else {
      toast.error("Не удалось переслать сообщение");
    }
  } catch (error) {
    console.error("Error forwarding message:", error);
    toast.error("Ошибка при пересылке сообщения");
  } finally {
    setIsSending(false);
  }
};

  const handleForwardSourceClick = async (message: Message) => {
    try {
      if (!message.forwardedFromChatType) return;

      if (message.forwardedFromChatType === "PRIVATE" && message.forwardedFromUserId) {
        const canView = await canViewUserProfile(message.forwardedFromUserId);
        if (!canView) {
          alert("Аккаунт пользователя скрыт");
          return;
        }
        router.push(`/profile/${message.forwardedFromUserId}`);
        return;
      }

      if (message.forwardedFromChatId) {
        const hasAccess = await canAccessChat(message.forwardedFromChatId);
        if (!hasAccess) {
          alert("Этот канал или группа скрыт(а)");
          return;
        }
        router.push(`/chat/${message.forwardedFromChatId}`);
      }
    } catch (error) {
      console.error("Error opening forwarded source:", error);
      alert("Не удалось открыть источник пересланного сообщения");
    }
  };

  const copyMessageText = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const scrollToMessage = (messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("bg-orange-500/20");
      setTimeout(() => {
        element.classList.remove("bg-orange-500/20");
      }, 2000);
    }
  };

  const goToSearchResult = (index: number) => {
    if (!searchResults.length) return;
    const nextIndex = (index + searchResults.length) % searchResults.length;
    setActiveSearchIndex(nextIndex);
    scrollToMessage(searchResults[nextIndex].id);
  };

  const handleWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsChangingWallpaper(true);
      const formData = new FormData();
      formData.append("file", file);
      await uploadChatWallpaper(chatId, formData);
      await refreshSettings();
      setShowChatMenu(false);
    } catch (error) {
      console.error("Error uploading chat wallpaper:", error);
      alert("Не удалось установить обои чата");
    } finally {
      setIsChangingWallpaper(false);
      if (wallpaperInputRef.current) wallpaperInputRef.current.value = "";
    }
  };

  const handleRemoveChatWallpaper = async () => {
    try {
      setIsChangingWallpaper(true);
      await removeChatWallpaper(chatId);
      await refreshSettings();
      setShowChatMenu(false);
    } catch (error) {
      console.error("Error removing chat wallpaper:", error);
      alert("Не удалось удалить обои чата");
    } finally {
      setIsChangingWallpaper(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderReplyPreview = (message: Message) => {
    if (message.forwardedFromChatName) {
      return (
        <div
          className="mb-1 text-xs text-white/50 border-l-2 border-blue-400 pl-2 rounded cursor-pointer hover:bg-white/5"
          onClick={(e) => {
            e.stopPropagation();
            handleForwardSourceClick(message);
          }}
        >
          Переслано из {message.forwardedFromChatName}
          {message.forwardedFromChatType === "PRIVATE" && message.forwardedFromUserName ? ` · ${message.forwardedFromUserName}` : ""}
        </div>
      );
    }

    if (!message.replyTo) return null;
    
    const replyTo = message.replyTo;
    const isReplyingToSelf = replyTo.userId === currentUser.id;
    const replyToName = isReplyingToSelf ? "себе" : (replyTo.user.displayName || replyTo.user.username);
    const replyContent = replyTo.content ? (replyTo.content.length > 60 ? replyTo.content.substring(0, 60) + "..." : replyTo.content) : "[Медиа]";
    
    return (
      <div 
        className="mb-1 text-xs text-white/40 border-l-2 border-orange-500 pl-2 cursor-pointer hover:bg-white/5 rounded transition-all"
        onClick={(e) => {
          e.stopPropagation();
          scrollToMessage(replyTo.id);
        }}
      >
        <span className="text-orange-400">
          Ответ {replyToName}
        </span>
        <p className="truncate max-w-50 text-white/60">
          {replyContent}
        </p>
      </div>
    );
  };

  const renderMessageContent = (message: Message) => {
  // Если есть файл
  if (message.fileUrl) {
    switch (message.fileType) {
      case 'IMAGE':
        return <div>
            <ImageMessage url={message.fileUrl} />
            {message.content && <p className="text-lg wrap-break-word mt-1">{message.content}</p>}
          </div>
          ;
      case 'VIDEO': 
        return <VideoMessage url={message.fileUrl} />;
      case 'AUDIO': 
        return <AudioMessage url={message.fileUrl} />;
      case 'ROUND': 
        return <RoundVideoMessage url={message.fileUrl} />;
      case 'FILE': 
        return <div>
            <FileMessage fileUrl={message.fileUrl} fileName={message.fileName} />
            {message.content && <p className="text-lg wrap-break-word mt-1">{message.content}</p>}
          </div>
          ;
      default:
        return (
          <div>
            <a href={message.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
              Скачать файл
            </a>
            {message.content && <p className="text-lg wrap-break-word mt-1">{message.content}</p>}
          </div>
        );
    }
  }
  
  // Если только текст
  return <p className="text-md wrap-break-word whitespace-pre-wrap">{message.content}</p>;
};

// Инициализация Peer только на клиенте

const [isCallModalOpen, setIsCallModalOpen] = useState(false);
const [remotePeerId, setRemotePeerId] = useState<string | null>(null);
const [incomingCall, setIncomingCall] = useState<any>(null);
const [peer, setPeer] = useState<any>(null);
const [myPeerId, setMyPeerId] = useState<string | null>(null);

// Функция для начала звонка
const startLocalVideoCall = () => {
  if (!myPeerId) {
    alert("Подключение...");
    return;
  }

  sendMessage(chatId, `peerId=${myPeerId}`);

  setRemotePeerId(null);
  setIncomingCall(null);
  setIsCallModalOpen(true);
};

// Функция для присоединения к звонку
const joinCall = (incomingPeerId: string) => {
  console.log("🔗 Присоединение к звонку, peerId:", incomingPeerId);
  setRemotePeerId(incomingPeerId);
  setIsCallModalOpen(true);
};

const renderMessage = (message: Message) => {
  const isOwn = message.userId === currentUser.id;
  const displayName = isOwn ? "Вы" : (message.user.displayName || message.user.username);
  
  // 1. Попытка извлечь peerId из контента сообщения
  const callMatch = message.content?.match(/peerId=([a-zA-Z0-9-_]+)/);
  const incomingPeerId = callMatch ? callMatch[1] : null;

  return (
    <motion.div 
      key={message.id} 
      id={`message-${message.id}`}
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isOwn ? "justify-end" : "justify-start"} relative group mb-4 transition-colors duration-300`}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          message
        });
      }}
    >
      {/* Аватарка собеседника */}
      {!isOwn && (
        <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center text-md font-bold shrink-0 overflow-hidden border border-white/5">
          {message.user.avatarUrl ? (
            <img src={message.user.avatarUrl} className="w-full h-full rounded-full object-cover" alt="avatar" />
          ) : (
            displayName[0]?.toUpperCase() || "U"
          )}
        </div>
      )}
      
      <div className="max-w-[75%] relative">
        {/* Превью ответа (если есть) */}
        {renderReplyPreview(message)}
        
        <div className={`rounded-2xl px-4 py-2 border shadow-lg ${
          isOwn 
            ? "bg-[#664471] text-white rounded-tr-none" 
            : "bg-zinc-900/90 border-white/10 text-white"
        }`}>
          {isOwn && <div className="absolute top-0 -right-3 w-0 h-0 
              border-t-[15px] border-t-[#664471] 
              border-r-[15px] border-r-transparent">
  </div>}
          {/* Имя отправителя в групповых чатах */}
          {!isOwn && chatType !== "PRIVATE" && (
            <p className="text-[11px] text-orange-400 mb-1 font-semibold uppercase tracking-wider">
              {displayName}
            </p>
          )}
          
          {/* Контент: либо Кнопка Звонка, либо Текст/Медиа */}
          {incomingPeerId ? (
            <div className="py-2 min-w-[220px]">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-full ${isOwn ? "bg-white/20" : "bg-green-500/20"}`}>
                  <Video size={20} className={isOwn ? "text-white" : "text-green-400"} />
                </div>
                <div>
                  <p className="text-sm font-bold">Видеозвонок</p>
                  <p className="text-[10px] opacity-60">
                    {isOwn ? "Вы инициировали вызов" : "Входящий вызов"}
                  </p>
                </div>
              </div>
              
              {incomingPeerId && !isOwn && (
                <button 
                  onClick={() => joinCall(incomingPeerId)}
                  className="w-full py-3 bg-green-500 hover:bg-green-600 active:scale-[0.97] rounded-xl text-xs font-black transition-all shadow-xl shadow-green-900/20 uppercase tracking-widest"
                >
                  Принять вызов
                </button>
              )}
            </div>
          ) : (
            <div className="text-lg leading-relaxed break-words">
              {renderMessageContent(message)}
            </div>
          )}

          {/* Футер сообщения: время, изменение, статус прочтения */}
          <div className="flex items-center justify-end gap-2 mt-1">
            <p className="text-[14px] text-white/40 font-medium">
              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            
            {message.updatedAt !== message.createdAt && (
              <Edit size={14} className="text-white/30" />
            )}
            
            <ReadStatusIndicator 
              message={message} 
              isOwn={isOwn} 
              chatType={chatType}
              chatMembers={chatMembers}
            />
          </div>
        </div>
        
        {/* Блок реакций с исправленными уникальными ключами */}
        {message.reactions && Object.entries(message.reactions).length > 0 && (
          <div className="flex gap-1 mt-1.5 ml-1 flex-wrap">
            {Object.entries(message.reactions).map(([reaction, users]) => {
              const hasUserReaction = users.includes(currentUser.id);
              return (
                <button 
                  key={`${message.id}-${reaction}`} // Гарантирует отсутствие варнингов React
                  onClick={() => handleAddReaction(message.id, reaction)}
                  className={`text-[11px] px-2 py-0.5 rounded-full transition-all flex items-center gap-1.5 border ${
                    hasUserReaction 
                      ? "bg-orange-500 border-orange-400 text-white shadow-md shadow-orange-500/20" 
                      : "bg-white/5 border-white/10 hover:bg-white/10 text-white/70"
                  }`}
                >
                  <span>{reaction}</span>
                  <span className="font-bold">{users.length}</span>
                </button>
              );
            })}
          </div>
        )}
        
        {/* Пикер эмодзи (если открыт для этого сообщения) */}
        {showEmojiPicker === message.id && (
          <div className="absolute bottom-full mb-2 left-0 z-50 animate-in fade-in zoom-in duration-200">
            <ReactionPicker
              onSelect={(reaction) => {
                handleAddReaction(message.id, reaction);
                setShowEmojiPicker(null);
              }}
              onClose={() => setShowEmojiPicker(null)}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
};

  const loadAvailableChats = async () => {
  setIsLoadingChats(true);
  try {
    // Используем существующую функцию из API
    const chats = await getAvailableChats();
    // Фильтруем текущий чат
    const filtered = chats.filter((chat: Chat) => chat.id !== chatId);
    setAvailableChats(filtered);
  } catch (error) {
    console.error("Error loading chats:", error);
  } finally {
    setIsLoadingChats(false);
  }
};

  const ForwardDialog = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [isSearchingLocal, setIsSearchingLocal] = useState(false);

  // Debounce для поиска - задержка 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Фильтрация чатов с debounce
  const filteredChats = useMemo(() => {
    if (!availableChats.length) return [];
    if (!debouncedSearchTerm) return availableChats;
    
    return availableChats.filter(chat => 
      chat.title?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );
  }, [availableChats, debouncedSearchTerm]);

  // Эффект для показа индикатора загрузки при поиске
  useEffect(() => {
    if (searchTerm !== debouncedSearchTerm) {
      setIsSearchingLocal(true);
    } else {
      setIsSearchingLocal(false);
    }
  }, [searchTerm, debouncedSearchTerm]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4"
      onClick={() => setShowForwardDialog(false)}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#121214] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Переслать сообщение</h3>
          <p className="text-sm text-white/40 mt-1 truncate">
            {forwardingMessage?.content?.substring(0, 50) || "[Медиа]"}
          </p>
        </div>
        
        <div className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Поиск чатов..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white outline-none focus:border-violet-500 transition-colors"
              autoFocus
            />
          </div>
          
          <div className="max-h-[400px] overflow-y-auto space-y-2 custom-scrollbar">
            {isLoadingChats ? (
              <div className="text-center py-8">
                <Loader2 className="animate-spin h-8 w-8 text-violet-500 mx-auto" />
                <p className="text-sm text-white/40 mt-2">Загрузка чатов...</p>
              </div>
            ) : isSearchingLocal ? (
              <div className="text-center py-8">
                <Loader2 className="animate-spin h-6 w-6 text-violet-500 mx-auto" />
                <p className="text-sm text-white/40 mt-2">Поиск...</p>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="text-center py-8 text-white/40">
                <MessageSquare size={32} className="mx-auto mb-2 opacity-20" />
                <p>Нет доступных чатов</p>
                {searchTerm && <p className="text-xs mt-1">Попробуйте изменить запрос</p>}
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredChats.map((chat, index) => {
                  const isSelected = selectedForwardChatIds.includes(chat.id);
                  return (
                    <motion.button
                      key={chat.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => {
                        setSelectedForwardChatIds(prev =>
                          prev.includes(chat.id)
                            ? prev.filter(id => id !== chat.id)
                            : [...prev, chat.id]
                        );
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                        isSelected 
                          ? "bg-violet-500/20 border border-violet-400/40" 
                          : "hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center overflow-hidden shrink-0">
                        {chat.image ? (
                          <img src={chat.image} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-lg font-bold text-violet-400">
                            {chat.title?.[0]?.toUpperCase() || "💬"}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium text-white truncate">{chat.title}</p>
                        <p className="text-xs text-white/40">
                          {chat.type === "PRIVATE" ? "Личный чат" : chat.type === "GROUP" ? "Группа" : "Канал"}
                        </p>
                      </div>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="shrink-0"
                        >
                          <Check size={16} className="text-violet-400" />
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>
        
        <div className="p-4 border-t border-white/10 flex gap-2">
          <button
            onClick={() => {
              setShowForwardDialog(false);
              setSelectedForwardChatIds([]);
              setForwardingMessage(null);
            }}
            className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleForwardMessage}
            disabled={selectedForwardChatIds.length === 0}
            className="flex-1 px-4 py-2 bg-violet-500 hover:bg-violet-600 rounded-xl text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Forward size={16} />
            Переслать ({selectedForwardChatIds.length})
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Добавьте новые состояния и функции в компонент RealTimeChat

const [isDraggingOver, setIsDraggingOver] = useState(false);
const [showFileUploadModal, setShowFileUploadModal] = useState(false);
const [pendingFiles, setPendingFiles] = useState<File[]>([]);
const [fileCaption, setFileCaption] = useState("");
const [isUploadingFiles, setIsUploadingFiles] = useState(false);
const dragCounter = useRef(0);
const lastDropRef = useRef<string | null>(null);

// Функции для Drag & Drop
const handleDragEnter = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounter.current++;
  if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
    setIsDraggingOver(true);
  }
};

const handleDragLeave = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounter.current--;
  if (dragCounter.current === 0) {
    setIsDraggingOver(false);
  }
};

const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

const handleDrop = async (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDraggingOver(false);
  dragCounter.current = 0;

  if (isChannel && !canWrite) {
    toast.error("Только администратор может отправлять файлы в канал");
    return;
  }

  const files = Array.from(e.dataTransfer.files);
  if (files.length === 0) return;
  
  // Генерируем уникальный ID для этой группы файлов
  const dropId = Date.now().toString();
  
  // Проверяем, не загружаем ли мы уже эти файлы
  if (lastDropRef.current === dropId) {
    return;
  }
  lastDropRef.current = dropId;
  
  // Открываем модальное окно для ввода подписи
  setPendingFiles(prev => {
    // Фильтруем дубликаты по имени и размеру
    const newFiles = files.filter(file => 
      !prev.some(existingFile => 
        existingFile.name === file.name && 
        existingFile.size === file.size &&
        existingFile.lastModified === file.lastModified
      )
    );
    return [...prev, ...newFiles];
  });
  setFileCaption("");
  setShowFileUploadModal(true);
  
  // Сбрасываем ID через секунду
  setTimeout(() => {
    if (lastDropRef.current === dropId) {
      lastDropRef.current = null;
    }
  }, 1000);
};

const handleRemoveFile = useCallback((index: number) => {
  setPendingFiles(prev => prev.filter((_, i) => i !== index));
}, []);

const handleCaptionChange = useCallback((value: string) => {
  setFileCaption(value);
}, []);

const handleCloseModal = useCallback(() => {
  setShowFileUploadModal(false);
  setPendingFiles([]);
  setFileCaption("");
}, []);

// Функция загрузки файлов с подписью
const handleUploadFilesWithCaption = async () => {
  if (pendingFiles.length === 0) return;
  
  setIsUploadingFiles(true);
  let successCount = 0;
  
  const currentCaption = fileCaption.trim();
  
  try {
    for (const file of pendingFiles) {
      let fileType = 'FILE';
      
      if (file.type.startsWith('image/')) {
        fileType = 'IMAGE';
      } else if (file.type.startsWith('video/')) {
        fileType = 'VIDEO';
      } else {
        fileType = 'FILE';
      }
      
      const formData = new FormData();
      formData.append("file", file);
      const fileUrl = await uploadChatImage(formData);
      
      if (!fileUrl) {
        console.error("Failed to upload file:", file.name);
        toast.error(`Не удалось загрузить файл: ${file.name}`);
        continue;
      }
      
      // Формируем текст сообщения
      // Если есть подпись - используем её как основной текст
      // Если нет - используем стандартное описание
      let messageContent = "";
      
      if (currentCaption) {
        messageContent = currentCaption;
      } else {
        if (fileType === 'IMAGE') {
          messageContent = "📷 Фото";
        } else if (fileType === 'VIDEO') {
          messageContent = "🎥 Видео";
        } else {
          messageContent = `📎 ${file.name}`;
        }
      }
      
      // Отправляем ОДНО сообщение с файлом и текстом
      const sentMessage = await sendMessage(chatId, messageContent, fileUrl.url, fileType, file.name, replyingTo?.id);
      const formattedMessage = {
        ...sentMessage,
        reactions: sentMessage.reactions as { [key: string]: string[] } | null,
        readReceipts: []
      } as Message;
      
      setMessages(prev => [...prev, formattedMessage]);
      successCount++;
      setHasMarkedRead(false);
    }
    
    if (successCount > 0) {
      toast.success(`Загружено файлов: ${successCount}`);
      setShowFileUploadModal(false);
      setPendingFiles([]);
      setFileCaption("");
      setReplyingTo(null);
    } else {
      toast.error("Не удалось загрузить файлы");
    }
  } catch (error) {
    console.error("Error uploading files:", error);
    toast.error("Ошибка при загрузке файлов");
  } finally {
    setIsUploadingFiles(false);
  }
};

  const MembersDialog = () => {
    const canManageRoles = userRole === 'CREATOR' || userRole === 'ADMIN';
    
    const getRoleIcon = (role: ChatRole) => {
      switch (role) {
        case 'CREATOR': return <Crown size={14} className="text-yellow-500" />;
        case 'ADMIN': return <Shield size={14} className="text-orange-500" />;
        default: return <Users size={14} className="text-white/40" />;
      }
    };
    
    const getRoleName = (role: ChatRole) => {
      switch (role) {
        case 'CREATOR': return "Создатель";
        case 'ADMIN': return "Админ";
        default: return "Участник";
      }
    };
    
    const handleChangeRoleLocal = async (targetUserId: string, newRole: ChatRole) => {
      try {
        await updateMemberRole(chatId, targetUserId, newRole, currentUser.id);
        const chatInfo = await getChatInfo(chatId);
        setChatMembers(chatInfo?.members || []);
        const role = await getUserRoleInChat(chatId, currentUser.id);
        setUserRole(role);
      } catch (error) {
        console.error("Error changing role:", error);
        alert(error instanceof Error ? error.message : "Ошибка изменения роли");
      }
    };

    const handleRemoveMemberLocal = async (targetUserId: string) => {
      if (confirm("Удалить участника из чата?")) {
        try {
          await removeChatMember(chatId, targetUserId, currentUser.id);
          const chatInfo = await getChatInfo(chatId);
          setChatMembers(chatInfo?.members || []);
        } catch (error) {
          console.error("Error removing member:", error);
          alert(error instanceof Error ? error.message : "Ошибка удаления участника");
        }
      }
    };
    
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4"
        onClick={() => setShowMembersDialog(false)}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-[#121214] rounded-2xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-white/10">
            <h3 className="text-lg font-semibold text-white">Участники чата</h3>
            <p className="text-sm text-white/40">{chatMembers.length} участников</p>
          </div>
          
          <div className="max-h-[400px] overflow-y-auto p-2">
            {chatMembers.map((member) => {
              const isCurrentUser = member.user.id === currentUser.id;
              const canManage = canManageRoles && !isCurrentUser && member.role !== 'CREATOR';
              
              return (
                <div key={member.id} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/20 to-violet-500/20 flex items-center justify-center overflow-hidden">
                      {member.user.avatarUrl ? (
                        <img src={member.user.avatarUrl} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg">{member.user.displayName?.[0]?.toUpperCase() || "U"}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {member.user.displayName || member.user.username}
                        {isCurrentUser && " (Вы)"}
                      </p>
                      <p className="text-xs text-white/40 flex items-center gap-1">
                        {getRoleIcon(member.role)} {getRoleName(member.role)}
                      </p>
                    </div>
                  </div>
                  
                  {canManage && (
                    <div className="flex gap-1">
                      {member.role !== 'ADMIN' && userRole === 'CREATOR' && (
                        <button
                          onClick={() => handleChangeRoleLocal(member.user.id, 'ADMIN')}
                          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                          title="Сделать админом"
                        >
                          <Shield size={14} className="text-orange-400" />
                        </button>
                      )}
                      {member.role === 'ADMIN' && userRole === 'CREATOR' && (
                        <button
                          onClick={() => handleChangeRoleLocal(member.user.id, 'MEMBER')}
                          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                          title="Понизить до участника"
                        >
                          <Users size={14} className="text-yellow-400" />
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveMemberLocal(member.user.id)}
                        className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Удалить"
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="p-4 border-t border-white/10">
            <button
              onClick={() => setShowMembersDialog(false)}
              className="w-full px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors"
            >
              Закрыть
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <>
      <div
        className="flex flex-col h-full bg-[#0a0a0c] bg-cover bg-center w-full"
        style={{
          backgroundImage: chatWallpaper
            ? `linear-gradient(rgba(10,10,12,0.72), rgba(10,10,12,0.72)), url(${chatWallpaper})`
            : "radial-gradient(circle at 20% 10%, rgba(125,74,180,0.35) 0%, rgba(10,10,12,0.1) 35%), radial-gradient(circle at 80% 70%, rgba(87,126,174,0.25) 0%, rgba(10,10,12,0.2) 45%), linear-gradient(135deg, #121218 0%, #0a0a0c 100%)"
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="w-full flex justify-center z-50">
        {/* Header */}
        <div className="border border-white/10 backdrop-blur-sm bg-black/35 pt-3 pb-3 px-6 flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="lg:hidden p-2 hover:bg-white/5 rounded-xl transition-colors">
              <ArrowLeft size={20} className="text-white/60" />
            </button>
            <Link href={chatType === "PRIVATE" && partner ? `/profile/${partner.id}` : `/chat/${chatId}/data`}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-13 h-13 rounded-full overflow-hidden bg-linear-to-br from-orange-500/20 to-violet-500/20">
                  {chatAvatar ? (
                    <img src={chatAvatar} className="w-full h-full object-cover" alt={chatName || "Chat"} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg font-bold">
                      {chatName?.[0]?.toUpperCase() || "💬"}
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  {chatName || "Чат"}
                  {isChannel && !canWrite && (
                    <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/60">Только чтение</span>
                  )}
                </h2>
                
                {/* Статус пользователя для приватного чата */}
                {chatType === "PRIVATE" && partner && (
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full relative right-6 ${getUserOnlineStatus(partner.id) ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-md text-white/40">
                        {getUserOnlineStatus(partner.id) ? "В сети" : getFormattedLastSeen(partner.id)}
                      </p>
                  </div>
                  </div>
                )}
                
                {/* Для групповых чатов и каналов */}
                {chatType !== "PRIVATE" && (
                  <p className="text-xs text-white/40">
                    {chatType === "CHANNEL" ? "Канал" : "Группа"} • {initialMembersCount} {initialMembersCount === 1 ? "участник" : "участников"}
                  </p>
                )}
              </div>
            </div>
            </Link>
          </div>
          
          <div className="flex gap-1">
          <div className="flex items-center gap-2">
          <button onClick={startLocalVideoCall} className="p-2 hover:bg-white/10 rounded-full text-blue-400">
        <Video size={20} />
      </button>
</div>
            <button
              onClick={() => setIsSearchOpen(prev => !prev)}
              className="p-2 hover:bg-white/5 rounded-4xl transition-colors"
              title="Поиск по сообщениям"
            >
              <Search size={20} className="text-white/60" />
            </button>
            {(chatType === "GROUP" || chatType === "CHANNEL") && (
              <button
                onClick={() => setShowMembersDialog(true)}
                className="p-2 hover:bg-white/5 rounded-4xl transition-colors"
                title="Участники"
              >
                <Users size={20} className="text-white/60" />
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => setShowChatMenu(prev => !prev)}
                className="p-2 hover:bg-white/5 rounded-4xl transition-colors"
              >
                <MoreVertical size={20} className="text-white/60" />
              </button>
              {showChatMenu && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-[#121214] shadow-2xl z-50 p-1">
                  <input
                    ref={wallpaperInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleWallpaperUpload}
                  />
                  <button
                    onClick={() => wallpaperInputRef.current?.click()}
                    disabled={isChangingWallpaper}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-white/5 disabled:opacity-50"
                  >
                    Изменить обои чата
                  </button>
                  <button
                    onClick={handleRemoveChatWallpaper}
                    disabled={isChangingWallpaper}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-white/5 disabled:opacity-50"
                  >
                    Сбросить обои чата
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>

        <AnimatePresence>
          {isSearchOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="px-4 py-3 border-b border-white/10 bg-black/35 backdrop-blur-sm"
            >
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск по сообщениям..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-violet-400"
                  />
                </div>
                <button
                  type="button"
                  disabled={!searchResults.length}
                  onClick={() => goToSearchResult(activeSearchIndex - 1)}
                  className="px-2.5 py-2 rounded-xl bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={!searchResults.length}
                  onClick={() => goToSearchResult(activeSearchIndex + 1)}
                  className="px-2.5 py-2 rounded-xl bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSearchOpen(false);
                    setSearchQuery("");
                  }}
                  className="p-2 rounded-xl bg-white/5 text-white/70 hover:bg-white/10"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-white/45 mt-2">
                {isSearching
                  ? "Идет поиск..."
                  : searchQuery.trim()
                    ? `Найдено: ${searchResults.length}`
                    : "Введите текст для поиска"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reply indicator */}
        <AnimatePresence>
          {replyingTo && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -20 }}
              className="border-l-4 border-orange-500 bg-orange-500/10 p-3 mx-4 mt-2 rounded-lg flex justify-between items-center"
            >
              <div className="flex-1 cursor-pointer" onClick={() => scrollToMessage(replyingTo.id)}>
                <p className="text-xs text-orange-400 font-medium">
                  Ответ {replyingTo.userId === currentUser.id ? "себе" : replyingTo.user.displayName || replyingTo.user.username}
                </p>
                <p className="text-sm text-white/60 truncate">
                  {replyingTo.content?.length > 80 ? replyingTo.content.substring(0, 80) + "..." : (replyingTo.content || "[Медиа]")}
                </p>
              </div>
              <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-white/10 rounded-lg">
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div 
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/25"
        >
          <div className="mt-32">
          {messages.length === 0 ? (
            <div className="text-center text-white/40 py-10">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                <MessageSquare size={32} className="text-white/20" />
              </div>
              <p className="text-sm">Нет сообщений</p>
              {isChannel && !canWrite ? (
                <p className="text-xs mt-1">Только администраторы могут писать в этот канал</p>
              ) : (
                <p className="text-xs mt-1">Напишите первое сообщение!</p>
              )}
            </div>
          ) : (
            messages.map(renderMessage)
          )}
          <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Edit indicator */}
        <AnimatePresence>
          {editingMessage && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 20 }}
              className="border-t border-orange-500/20 bg-orange-500/5 p-3 mx-4 rounded-t-lg flex justify-between items-center"
            >
              <div className="flex-1">
                <p className="text-xs text-orange-400 font-medium">Редактирование сообщения</p>
                <p className="text-sm text-white/60 truncate">{editingMessage.content?.substring(0, 50)}</p>
              </div>
              <button onClick={() => { setEditingMessage(null); setNewMessage(""); }} className="p-1 hover:bg-white/10 rounded-lg">
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recording indicator */}
        <AnimatePresence>
          {isRecording && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 20 }}
              className="bg-red-500/20 p-3 mx-4 mb-2 rounded-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm text-white">
                  {recordingType === 'audio' ? '🎤 Запись голосового' : '🎥 Запись видеокружочка'}...
                </span>
                <span className="text-sm text-white/60 font-mono">{formatTime(recordingTime)}</span>
              </div>
              <button onClick={stopRecording} className="px-3 py-1 bg-red-500 hover:bg-red-600 rounded-lg text-white text-sm transition-colors">
                Остановить
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 bg-black/35 backdrop-blur-sm">
          <div className="flex gap-2 items-center">
            {!isChannel || (isChannel && canWrite) ? (
              <>
                <div className="relative">
                  <button 
                    type="button" 
                    onClick={() => setShowMediaMenu(!showMediaMenu)} 
                    className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                  >
                    <Paperclip size={20} className="text-white/60" />
                  </button>
                  <AnimatePresence>
                    {showMediaMenu && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute bottom-full left-0 mb-2 bg-[#121214] border border-white/10 rounded-xl p-2 shadow-2xl z-50 min-w-[180px]"
                      >
                        <div className="flex flex-col gap-1">
  <button 
    type="button" 
    onClick={() => imageInputRef.current?.click()} 
    className="flex items-center gap-2 p-2 hover:bg-white/5 rounded-lg text-sm"
  >
    <Image size={16} className="text-green-400" /> Фото
  </button>
  <button 
    type="button" 
    onClick={() => videoInputRef.current?.click()} 
    className="flex items-center gap-2 p-2 hover:bg-white/5 rounded-lg text-sm"
  >
    <Video size={16} className="text-blue-400" /> Видео
  </button>
  <button 
    type="button" 
    onClick={() => fileInputRef2.current?.click()} 
    className="flex items-center gap-2 p-2 hover:bg-white/5 rounded-lg text-sm"
  >
    <File size={16} className="text-yellow-400" /> Файл
  </button>
  <div className="h-px bg-white/10 my-1" />
  <button 
    type="button" 
    onClick={startAudioRecording} 
    disabled={isRecording}
    className="flex items-center gap-2 p-2 hover:bg-white/5 rounded-lg text-sm disabled:opacity-50"
  >
    <Mic size={16} className="text-purple-400" /> Голосовое
  </button>
  <button 
    type="button" 
    onClick={startRoundVideoRecording} 
    disabled={isRecording}
    className="flex items-center gap-2 p-2 hover:bg-white/5 rounded-lg text-sm disabled:opacity-50"
  >
    <Video size={16} className="text-orange-400" /> Видеокружочек
  </button>
</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <input 
                  ref={inputRef}
                  type="text" 
                  value={newMessage} 
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={isRecording ? "Идет запись..." : (editingMessage ? "Редактирование..." : (replyingTo ? "Ответ..." : "Введите сообщение..."))}
                  disabled={isSending || isRecording} 
                  className="flex-1 bg-white/5 rounded-xl px-4 py-2 text-white outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50" 
                />
                
                {/* Скрытые input для файлов */}
                <input 
                  ref={imageInputRef}
                  type="file" 
                  accept="image/*" 
                  multiple 
                  className="hidden" 
                  onChange={(e) => handleFileSelect(e, 'IMAGE')}
                />
                <input 
                  ref={videoInputRef}
                  type="file" 
                  accept="video/*" 
                  multiple 
                  className="hidden" 
                  onChange={(e) => handleFileSelect(e, 'VIDEO')}
                />
                <input 
                  ref={fileInputRef2}
                  type="file" 
                  className="hidden" 
                  onChange={(e) => handleFileSelect(e, 'FILE')}
                />
              </>
            ) : (
              <div className="flex-1 text-center text-white/40 text-sm py-2">
                ⚡ Только администраторы могут писать в этот канал
              </div>
            )}
            
            <button 
              type="submit" 
              disabled={(!newMessage.trim() && !editingMessage) || isSending || (isChannel && !canWrite)}
              className="bg-orange-500 text-black p-2 rounded-xl hover:bg-orange-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <Loader2 className="animate-spin h-5 w-5" />
              ) : (
                <Send size={20} />
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Dialogs */}
      <AnimatePresence>
        {showForwardDialog && <ForwardDialog />}
      </AnimatePresence>
      <AnimatePresence>
        {showMembersDialog && <MembersDialog />}
      </AnimatePresence>
      
      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <MessageContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            message={contextMenu.message}
            isOwn={contextMenu.message.userId === currentUser.id}
            canDelete={contextMenu.message.userId === currentUser.id || userRole === 'CREATOR' || userRole === 'ADMIN' || currentUser.isIdAdmin}
            onClose={() => setContextMenu(null)}
            onReply={() => {
              setReplyingTo(contextMenu.message);
              setContextMenu(null);
              inputRef.current?.focus();
            }}
            onForward={() => {
              setForwardingMessage(contextMenu.message);
              setShowForwardDialog(true);
              setSelectedForwardChatIds([]);
              setContextMenu(null);
              loadAvailableChats();
            }}
            onEdit={() => {
              setEditingMessage(contextMenu.message);
              setNewMessage(contextMenu.message.content);
              setContextMenu(null);
              inputRef.current?.focus();
            }}
            onDelete={() => {
              handleDeleteMessage(contextMenu.message.id);
              setContextMenu(null);
            }}
            onReact={() => {
              setShowEmojiPicker(contextMenu.message.id);
              setContextMenu(null);
            }}
            onCopy={() => {
              copyMessageText(contextMenu.message.content);
              setContextMenu(null);
            }}
          />
        )}
        <AnimatePresence>
</AnimatePresence>
<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
  <DialogContent className="bg-[#121214] text-white w-full max-w-md sm:max-w-lg md:max-w-xl">
    <DialogHeader>
      <DialogTitle className="text-white font-bold text-xl">
        Удалить сообщение?
      </DialogTitle>
    </DialogHeader>

    <p className="text-white text-lg">
      Это действие нельзя отменить
    </p>
    <div className="w-full flex items-center gap-2">
      <button
        onClick={() => setDeleteDialogOpen(false)}
        className="px-6 py-3 rounded-xl bg-violet-500/20 hover:bg-violet-500/60 text-white text-lg w-full transition cursor-pointer duration-300"
      >
        Отмена
      </button>
      <button
        onClick={confirmDeleteMessage}
        className="px-6 py-3 rounded-xl bg-[#e53935]/20 hover:bg-[#e53935]/60 text-white text-lg w-full transition cursor-pointer duration-300"
      >
        Удалить
      </button>
    </div>
  </DialogContent>
</Dialog>

{/* Drag & Drop Overlay */}
<AnimatePresence>
  {isDraggingOver && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-none w-full h-full"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-violet-500/90 backdrop-blur-md rounded-2xl p-8 text-center pointer-events-auto shadow-2xl border-2 border-white/20"
      >
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center">
          <Paperclip size={32} className="text-white" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Перетащите файлы сюда</h3>
        <p className="text-white/80 text-sm">
          Поддерживаются изображения, видео и любые другие файлы
        </p>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>

<FileUploadModal 
  isOpen={showFileUploadModal}
  onClose={handleCloseModal}
  files={pendingFiles}
  onRemoveFile={handleRemoveFile}
  caption={fileCaption}
  onCaptionChange={(value) => setFileCaption(value)}
  onUpload={handleUploadFilesWithCaption}
  isUploading={isUploadingFiles}
/>
      </AnimatePresence>
    </>
  );
}