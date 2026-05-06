"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Call,
  CallControls,
  SpeakerLayout,
  StreamCall,
  StreamTheme,
  StreamVideo,
  StreamVideoClient,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { pusherClient } from "@/app/lib/pusher";
import { Phone, PhoneOff, Video } from "lucide-react";

type CallSize = "mini" | "medium" | "full";

type IncomingPayload = {
  callId: string;
  streamCallType: string;
  type: "audio" | "video";
  chatId: string;
  from: { id: string; username: string; displayName: string; avatarUrl: string | null };
  createdAt: string;
};

type OutgoingPayload = Omit<IncomingPayload, "from"> & {
  from?: IncomingPayload["from"];
};

type Props = {
  currentUser: { id: string; username: string; displayName: string; avatarUrl?: string | null };
};

function getPositionClasses(size: CallSize) {
  if (size === "full") return "inset-0 rounded-none";
  if (size === "medium") return "bottom-4 right-4 w-[520px] h-[360px] rounded-2xl";
  return "bottom-4 right-4 w-[280px] h-[180px] rounded-2xl";
}

export default function GlobalCallLayer({ currentUser }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;

  const tokenProvider = useMemo(() => {
    return async () => {
      const res = await fetch("/api/stream/token", { method: "POST" });
      if (!res.ok) throw new Error("Failed to fetch Stream token");
      const data = (await res.json()) as { token: string };
      return data.token;
    };
  }, []);

  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const callRef = useRef<Call | null>(null);

  const [panelSize, setPanelSize] = useState<CallSize>("medium");
  const [incoming, setIncoming] = useState<IncomingPayload | null>(null);
  const [outgoing, setOutgoing] = useState<OutgoingPayload | null>(null);

  const activePayload = incoming ?? outgoing;

  useEffect(() => {
    if (!apiKey) return;

    const user = {
      id: currentUser.id,
      name: currentUser.displayName || currentUser.username,
      image: currentUser.avatarUrl ?? undefined,
    };

    const c = new StreamVideoClient({ apiKey, user, tokenProvider });
    setClient(c);

    return () => {
      callRef.current?.leave().catch(() => {});
      callRef.current = null;
      c.disconnectUser().catch(() => {});
      setClient(null);
    };
  }, [apiKey, currentUser.id, currentUser.displayName, currentUser.username, currentUser.avatarUrl, tokenProvider]);

  // Pusher: incoming/outgoing calls globally
  useEffect(() => {
    if (!pusherClient) return;
    if (!currentUser?.id) return;

    const channelName = `user-${currentUser.id}`;
    const channel = pusherClient.subscribe(channelName);

    const onIncoming = (payload: IncomingPayload) => {
      setOutgoing(null);
      setIncoming(payload);
      setPanelSize("medium");
    };

    const onOutgoing = (payload: OutgoingPayload) => {
      setIncoming(null);
      setOutgoing(payload);
      setPanelSize("medium");
    };

    channel.bind("incoming-call", onIncoming);
    channel.bind("outgoing-call", onOutgoing);

    return () => {
      channel.unbind("incoming-call", onIncoming);
      channel.unbind("outgoing-call", onOutgoing);
      pusherClient.unsubscribe(channelName);
    };
  }, [currentUser.id]);

  const clearCallUI = async () => {
    try {
      await callRef.current?.leave();
    } catch {
      // ignore
    }
    callRef.current = null;
    setCall(null);
    setIncoming(null);
    setOutgoing(null);
  };

  const join = async () => {
    if (!client || !activePayload) return;

    const nextCall = client.call(activePayload.streamCallType, activePayload.callId);
    callRef.current = nextCall;
    setCall(nextCall);

    try {
      await nextCall.join({ create: true });
    } catch (e) {
      await clearCallUI();
      throw e;
    }
  };

  const decline = async () => {
    await clearCallUI();
  };

  if (!apiKey) return null;

  // no active call UI
  if (!activePayload && !call) return null;

  const title = incoming
    ? `${incoming.from.displayName || incoming.from.username} звонит…`
    : "Звонок…";

  const sizeBtn = (label: string, next: CallSize) => (
    <button
      onClick={() => setPanelSize(next)}
      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white/80"
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[400] pointer-events-none">
      <div
        className={`fixed ${getPositionClasses(panelSize)} pointer-events-auto bg-[#0b0b0e] border border-white/10 shadow-2xl overflow-hidden`}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/30">
          <div className="flex items-center gap-2 min-w-0">
            {activePayload?.type === "video" ? (
              <Video size={16} className="text-blue-400" />
            ) : (
              <Phone size={16} className="text-green-400" />
            )}
            <div className="min-w-0">
              <p className="text-xs text-white/80 truncate">{title}</p>
              {activePayload?.chatId && (
                <p className="text-[10px] text-white/40 truncate">chat: {activePayload.chatId}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sizeBtn("мини", "mini")}
            {sizeBtn("сред", "medium")}
            {sizeBtn("экран", "full")}
            <button
              onClick={clearCallUI}
              className="px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs text-red-300"
              title="Закрыть"
            >
              ✕
            </button>
          </div>
        </div>

        {/* pre-join incoming UI */}
        {incoming && !call && (
          <div className="p-4 h-full flex flex-col justify-between">
            <div className="text-white/70 text-sm">
              Входящий {incoming.type === "video" ? "видеозвонок" : "аудиозвонок"} от{" "}
              <span className="text-white font-semibold">
                {incoming.from.displayName || incoming.from.username}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={join}
                className="flex-1 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold"
              >
                Принять
              </button>
              <button
                onClick={decline}
                className="flex-1 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm font-semibold"
              >
                Отклонить
              </button>
            </div>
          </div>
        )}

        {/* outgoing UI before join: auto-join on click to satisfy permissions */}
        {outgoing && !call && (
          <div className="p-4 h-full flex flex-col justify-between">
            <div className="text-white/70 text-sm">
              Исходящий {outgoing.type === "video" ? "видеозвонок" : "аудиозвонок"}…
            </div>
            <div className="flex gap-2">
              <button
                onClick={join}
                className="flex-1 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold"
              >
                Начать
              </button>
              <button
                onClick={clearCallUI}
                className="flex-1 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <PhoneOff size={16} />
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* joined */}
        {client && call && (
          <StreamVideo client={client}>
            <StreamCall call={call}>
              <StreamTheme>
                <div className="w-full h-full">
                  <SpeakerLayout participantsBarPosition={panelSize === "mini" ? "bottom" : "right"} />
                  <div className="absolute bottom-2 left-2 right-2">
                    <CallControls onLeave={clearCallUI} />
                  </div>
                </div>
              </StreamTheme>
            </StreamCall>
          </StreamVideo>
        )}
      </div>
    </div>
  );
}

