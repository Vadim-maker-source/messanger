"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PhoneOff, Maximize2, Minimize2, Mic, MicOff, Video, VideoOff, 
  Monitor, MonitorOff, Users, UserPlus, X, Grid, Layout, Copy, Check
} from 'lucide-react';

interface Participant {
  id: string;
  stream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  displayName: string;
}

interface VideoCallModalProps {
  peer: any;
  remotePeerId: string | null;
  onClose: () => void;
  currentUser: { id: string; displayName: string; username: string };
  chatId: string;
  sendMessage?: (chatId: string, content: string, fileUrl?: string | null, fileType?: string | null, replyToId?: string) => Promise<any>;
  incomingCall?: any;
}

export default function VideoCallModal({ 
  peer, 
  remotePeerId, 
  onClose, 
  currentUser,
  chatId,
  sendMessage,
  incomingCall
}: VideoCallModalProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [callError, setCallError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [layout, setLayout] = useState<'grid' | 'speaker'>('grid');
  const [showParticipants, setShowParticipants] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState<string>('');
  
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const myStream = useRef<MediaStream | null>(null);
  const screenStream = useRef<MediaStream | null>(null);
  const currentCall = useRef<any>(null);
  const peerConnections = useRef<Map<string, any>>(new Map());

  // Генерация ссылки для приглашения
  useEffect(() => {
    const callId = `${chatId}_${Date.now()}`;
    const link = `${window.location.origin}/call/${callId}`;
    setInviteLink(link);
  }, [chatId]);

  // Получение медиапотока
  const getMediaStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }, 
        audio: true 
      });
      myStream.current = stream;
      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream;
      }
      
      // Добавляем себя в участники
      setParticipants(prev => {
        const newMap = new Map(prev);
        newMap.set(currentUser.id, {
          id: currentUser.id,
          stream: stream,
          isMuted: false,
          isVideoOff: false,
          isScreenSharing: false,
          displayName: currentUser.displayName || currentUser.username
        });
        return newMap;
      });
      
      return stream;
    } catch (err) {
      console.error("Ошибка получения медиа:", err);
      setCallError("Не удалось получить доступ к камере/микрофону");
      return null;
    }
  };

  // Трансляция экрана
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStream.current) {
        screenStream.current.getTracks().forEach(track => track.stop());
        screenStream.current = null;
      }
      if (myStream.current) {
        const videoTrack = myStream.current.getVideoTracks()[0];
        if (videoTrack) videoTrack.enabled = !isVideoOff;
        if (myVideoRef.current) myVideoRef.current.srcObject = myStream.current;
        updateAllStreams(myStream.current);
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenStreamObj = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenStream.current = screenStreamObj;
        if (myVideoRef.current) myVideoRef.current.srcObject = screenStreamObj;
        updateAllStreams(screenStreamObj);
        screenStreamObj.getVideoTracks()[0].onended = () => toggleScreenShare();
        setIsScreenSharing(true);
      } catch (err) {
        console.error("Ошибка трансляции экрана:", err);
        alert("Не удалось начать трансляцию экрана");
      }
    }
  };

  const updateAllStreams = (stream: MediaStream) => {
    peerConnections.current.forEach((connection) => {
      if (connection.peerConnection) {
        const sender = connection.peerConnection.getSenders().find((s: any) => s.track?.kind === 'video');
        if (sender && stream.getVideoTracks()[0]) {
          sender.replaceTrack(stream.getVideoTracks()[0]);
        }
      }
    });
  };

  const toggleMute = () => {
    if (myStream.current) {
      const audioTrack = myStream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMuted;
        setIsMuted(!isMuted);
        setParticipants(prev => {
          const newMap = new Map(prev);
          const p = newMap.get(currentUser.id);
          if (p) p.isMuted = !isMuted;
          return newMap;
        });
      }
    }
  };

  const toggleVideo = () => {
    if (myStream.current && !isScreenSharing) {
      const videoTrack = myStream.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoOff;
        setIsVideoOff(!isVideoOff);
        setParticipants(prev => {
          const newMap = new Map(prev);
          const p = newMap.get(currentUser.id);
          if (p) p.isVideoOff = !isVideoOff;
          return newMap;
        });
      }
    }
  };

  // Обработка нового участника (для входящего звонка)
  const handleIncomingCall = (call: any) => {
    if (!myStream.current) return;
  
    call.answer(myStream.current);
    setupCall(call);
  };

  const setupCall = (call: any) => {
    const id = call.peer;
  
    peerConnections.current.set(id, call);
  
    setParticipants(prev => {
      const map = new Map(prev);
      map.set(id, {
        id,
        stream: null,
        isMuted: false,
        isVideoOff: false,
        isScreenSharing: false,
        displayName: `User ${id.slice(-4)}`
      });
      return map;
    });
  
    call.on('stream', (remoteStream: MediaStream) => {
      setParticipants(prev => {
        const map = new Map(prev);
        const prevP = map.get(id);
  
        map.set(id, {
            id,
            stream: remoteStream,
            isMuted: prevP?.isMuted ?? false,
            isVideoOff: prevP?.isVideoOff ?? false,
            isScreenSharing: prevP?.isScreenSharing ?? false,
            displayName: prevP?.displayName ?? `User ${id.slice(-4)}`
          });
  
        return map;
      });
  
      setCallActive(true);
      setIsConnecting(false);
    });
  
    call.on('close', () => {
      peerConnections.current.delete(id);
  
      setParticipants(prev => {
        const map = new Map(prev);
        map.delete(id);
        return map;
      });
    });
  };

  // Инициализация звонка
  useEffect(() => {
    if (!peer) return;
  
    let isMounted = true;
  
    const start = async () => {
      setIsConnecting(true);
  
      const stream = await getMediaStream();
      if (!stream || !isMounted) return;
  
      // 🔥 входящий звонок
      if (incomingCall) {
        handleIncomingCall(incomingCall);
        return;
      }
  
      // 🔥 исходящий звонок
      if (remotePeerId) {
        const call = peer.call(remotePeerId, stream);
        setupCall(call);
      } else {
        setIsConnecting(false);
      }
    };
  
    start();
  
    return () => {
      isMounted = false;
  
      peerConnections.current.forEach(conn => conn.close());
      peerConnections.current.clear();
  
      myStream.current?.getTracks().forEach(t => t.stop());
      screenStream.current?.getTracks().forEach(t => t.stop());
    };
  }, [peer, remotePeerId, incomingCall]);

  const handleEndCall = () => {
    if (myStream.current) myStream.current.getTracks().forEach(t => t.stop());
    if (screenStream.current) screenStream.current.getTracks().forEach(t => t.stop());
    if (currentCall.current) currentCall.current.close();
    peerConnections.current.forEach((conn) => conn.close?.());
    onClose();
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
      if (sendMessage) {
        await sendMessage(chatId, `🎥 Присоединяйтесь к видеозвонку: ${inviteLink}`, null, null);
      }
    } catch (err) {
      console.error("Ошибка копирования:", err);
    }
  };

  const renderParticipantVideo = (participant: Participant) => {
    const isCurrentUser = participant.id === currentUser.id;
    return (
      <div key={participant.id} className="relative group rounded-xl overflow-hidden bg-zinc-800 aspect-video">
        <video
          autoPlay
          playsInline
          muted={isCurrentUser}
          ref={(el) => {
            if (el && participant.stream) el.srcObject = participant.stream;
          }}
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-lg text-xs flex items-center gap-1">
          {participant.isMuted && <MicOff size={12} className="text-red-400" />}
          {participant.isVideoOff && !isScreenSharing && <VideoOff size={12} className="text-yellow-400" />}
          {participant.isScreenSharing && <Monitor size={12} className="text-green-400" />}
          <span className="text-white">{participant.displayName}</span>
          {isCurrentUser && <span className="text-white/60">(Вы)</span>}
        </div>
      </div>
    );
  };

  const participantsList = Array.from(participants.values());
  const hasMultipleParticipants = participantsList.length > 2;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget && !isExpanded) handleEndCall(); }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className={`bg-gradient-to-br from-zinc-900 to-black rounded-3xl shadow-2xl overflow-hidden ${
          isExpanded ? 'w-[98vw] h-[95vh]' : 'w-[90vw] h-[85vh] max-w-[1400px]'
        }`}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/50 to-transparent p-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-white/60" />
              <span className="text-white/80 text-sm">
                {participantsList.length} {participantsList.length === 1 ? 'участник' : 'участников'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {hasMultipleParticipants && (
                <button onClick={() => setLayout(layout === 'grid' ? 'speaker' : 'grid')} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl">
                  {layout === 'grid' ? <Layout size={18} /> : <Grid size={18} />}
                </button>
              )}
              <button onClick={() => setShowParticipants(!showParticipants)} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl relative">
                <Users size={18} />
                {hasMultipleParticipants && <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full text-[10px] flex items-center justify-center">{participantsList.length}</span>}
              </button>
              <button onClick={copyInviteLink} className="p-2 bg-green-500/20 hover:bg-green-500/30 rounded-xl">
                {copiedInvite ? <Check size={18} className="text-green-400" /> : <UserPlus size={18} className="text-green-400" />}
              </button>
            </div>
          </div>
        </div>

        {/* Main Video Area */}
        <div className="w-full h-full p-4 pt-16">
          {isConnecting && !callActive ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white text-lg">Подключение к звонку...</p>
                <p className="text-white/40 text-sm mt-2">Ожидание ответа...</p>
              </div>
            </div>
          ) : callError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-6 bg-red-500/20 rounded-2xl max-w-md">
                <p className="text-red-400 mb-4">{callError}</p>
                <button onClick={handleEndCall} className="px-6 py-2 bg-red-500 rounded-xl text-white">Закрыть</button>
              </div>
            </div>
          ) : participantsList.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                  <Video size={40} className="text-white/20" />
                </div>
                <p className="text-white/40">Ожидание подключения участников...</p>
                <button onClick={copyInviteLink} className="mt-4 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 rounded-xl text-green-400">Пригласить участников</button>
              </div>
            </div>
          ) : (
            <div className={`h-full overflow-auto ${layout === 'grid' ? `grid gap-4 auto-rows-fr ${
              participantsList.length === 1 ? 'grid-cols-1' :
              participantsList.length === 2 ? 'grid-cols-2' :
              participantsList.length <= 4 ? 'grid-cols-2' :
              participantsList.length <= 6 ? 'grid-cols-3' : 'grid-cols-4'
            }` : 'flex flex-col'}`}>
              {layout === 'grid' ? participantsList.map(renderParticipantVideo) : (
                <div className="flex gap-4 h-full">
                  <div className="flex-1">{participantsList[0] && renderParticipantVideo(participantsList[0])}</div>
                  {participantsList.length > 1 && (
                    <div className="w-80 flex flex-col gap-2 overflow-y-auto">{participantsList.slice(1).map(renderParticipantVideo)}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Participants Sidebar */}
        <AnimatePresence>
          {showParticipants && (
            <motion.div initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 300, opacity: 0 }} className="absolute right-0 top-0 bottom-0 w-80 bg-black/90 backdrop-blur-xl border-l border-white/10 z-20">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold">Участники ({participantsList.length})</h3>
                  <button onClick={() => setShowParticipants(false)} className="p-1 hover:bg-white/10 rounded-lg"><X size={18} /></button>
                </div>
                <div className="space-y-2">
                  {participantsList.map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl bg-white/5">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500/20 to-blue-500/20 flex items-center justify-center">
                        <span className="text-sm font-bold">{p.displayName[0]?.toUpperCase()}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm">{p.displayName}{p.id === currentUser.id && " (Вы)"}</p>
                        <div className="flex gap-2 mt-1">
                          {p.isMuted && <MicOff size={12} className="text-red-400" />}
                          {p.isVideoOff && <VideoOff size={12} className="text-yellow-400" />}
                          {p.isScreenSharing && <Monitor size={12} className="text-green-400" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3 z-10">
          <button onClick={toggleMute} className={`p-3 rounded-full transition-all ${isMuted ? 'bg-red-500' : 'bg-white/10'}`}>
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
          <button onClick={handleEndCall} className="p-4 bg-red-500 rounded-full shadow-lg shadow-red-500/20">
            <PhoneOff size={26} />
          </button>
          <button onClick={toggleVideo} className={`p-3 rounded-full ${isVideoOff ? 'bg-red-500' : 'bg-white/10'}`}>
            {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
          </button>
          <button onClick={toggleScreenShare} className={`p-3 rounded-full ${isScreenSharing ? 'bg-green-500' : 'bg-white/10'}`}>
            {isScreenSharing ? <MonitorOff size={22} /> : <Monitor size={22} />}
          </button>
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-3 bg-white/10 rounded-full">
            {isExpanded ? <Minimize2 size={22} /> : <Maximize2 size={22} />}
          </button>
        </div>

        {callActive && !isConnecting && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-green-500/20 backdrop-blur-sm px-4 py-1.5 rounded-full">
            <p className="text-green-400 text-xs font-medium flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              В разговоре • {participantsList.length} участников
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}