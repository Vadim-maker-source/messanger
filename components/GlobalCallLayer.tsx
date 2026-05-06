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
import { Minimize2, Phone, PhoneOff, Video } from "lucide-react";

type CallSize = "mini" | "medium" | "full";

type IncomingPayload = {
  callId: string;
  streamCallType: string;
  type: "audio" | "video";
  chatId: string;
  chatName?: string;
  from: { id: string; username: string; displayName: string; avatarUrl: string | null };
  createdAt: string;
};

type OutgoingPayload = Omit<IncomingPayload, "from"> & {
  from?: IncomingPayload["from"];
};

type Props = {
  currentUser: { id: string; username: string; displayName: string; avatarUrl?: string | null };
};

type Rect = { x: number; y: number; width: number; height: number };
type ResizeHandle = "top" | "right" | "bottom" | "left" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

const MIN_WIDTH = 280;
const MIN_HEIGHT = 170;
const MIN_HEIGHT_PREJOIN = 220;

function centeredRect(size: Exclude<CallSize, "full">): Rect {
  if (typeof window === "undefined") {
    return size === "mini"
      ? { x: 120, y: 120, width: 320, height: 210 }
      : { x: 180, y: 160, width: 560, height: 420 };
  }

  const width = size === "mini" ? 320 : 560;
  const height = size === "mini" ? 210 : 420;
  return {
    x: Math.max(16, (window.innerWidth - width) / 2),
    y: Math.max(16, (window.innerHeight - height) / 2),
    width,
    height,
  };
}

function clampRect(rect: Rect): Rect {
  if (typeof window === "undefined") return rect;
  const maxX = Math.max(0, window.innerWidth - rect.width);
  const maxY = Math.max(0, window.innerHeight - rect.height);
  return {
    ...rect,
    x: Math.min(Math.max(0, rect.x), maxX),
    y: Math.min(Math.max(0, rect.y), maxY),
  };
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
  const [isMinimized, setIsMinimized] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [panelRect, setPanelRect] = useState<Rect>(() => centeredRect("medium"));
  const [incoming, setIncoming] = useState<IncomingPayload | null>(null);
  const [outgoing, setOutgoing] = useState<OutgoingPayload | null>(null);
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const resizeRef = useRef<{ handle: ResizeHandle; startX: number; startY: number; startRect: Rect } | null>(null);

  const activePayload = incoming ?? outgoing;
  const isPreJoinState = Boolean(activePayload && !call);

  const updateCallStatus = async (callId: string, status: "ACTIVE" | "ENDED" | "DECLINED") => {
    try {
      await fetch("/api/calls/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, status }),
      });
    } catch {
      // ignore status sync errors; UI should continue to work
    }
  };

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
      setIsMinimized(false);
      setPanelRect(centeredRect("medium"));
    };

    const onOutgoing = (payload: OutgoingPayload) => {
      setIncoming(null);
      setOutgoing(payload);
      setPanelSize("medium");
      setIsMinimized(false);
      setPanelRect(centeredRect("medium"));
    };

    channel.bind("incoming-call", onIncoming);
    channel.bind("outgoing-call", onOutgoing);

    return () => {
      channel.unbind("incoming-call", onIncoming);
      channel.unbind("outgoing-call", onOutgoing);
      pusherClient.unsubscribe(channelName);
    };
  }, [currentUser.id]);

  // Restore unresolved call after page reload
  useEffect(() => {
    let mounted = true;

    const restoreCall = async () => {
      try {
        const res = await fetch("/api/calls/active", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as
          | { hasCall: false }
          | { hasCall: true; role: "incoming" | "outgoing"; payload: IncomingPayload };

        if (!mounted || !data.hasCall) return;

        if (data.role === "incoming") {
          setOutgoing(null);
          setIncoming(data.payload);
        } else {
          setIncoming(null);
          setOutgoing(data.payload);
        }
        setPanelSize("medium");
        setIsMinimized(false);
        setPanelRect(centeredRect("medium"));
      } catch {
        // ignore restore errors
      }
    };

    restoreCall();

    return () => {
      mounted = false;
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
    setIsMinimized(false);
    setIsJoining(false);
  };

  useEffect(() => {
    if (panelSize === "full") {
      setIsMinimized(false);
    }
  }, [panelSize]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (dragRef.current && panelSize !== "full") {
        setPanelRect((prev) =>
          clampRect({
            ...prev,
            x: e.clientX - dragRef.current!.offsetX,
            y: e.clientY - dragRef.current!.offsetY,
          }),
        );
      }

      if (resizeRef.current && panelSize !== "full") {
        const { handle, startRect, startX, startY } = resizeRef.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let nextX = startRect.x;
        let nextY = startRect.y;
        let nextWidth = startRect.width;
        let nextHeight = startRect.height;

        if (handle.includes("right")) nextWidth = Math.max(MIN_WIDTH, startRect.width + dx);
        if (handle.includes("left")) {
          nextWidth = Math.max(MIN_WIDTH, startRect.width - dx);
          nextX = startRect.x + (startRect.width - nextWidth);
        }
        const minHeight = isPreJoinState ? MIN_HEIGHT_PREJOIN : MIN_HEIGHT;
        if (handle.includes("bottom")) nextHeight = Math.max(minHeight, startRect.height + dy);
        if (handle.includes("top")) {
          nextHeight = Math.max(minHeight, startRect.height - dy);
          nextY = startRect.y + (startRect.height - nextHeight);
        }

        setPanelRect(clampRect({ x: nextX, y: nextY, width: nextWidth, height: nextHeight }));
      }
    };

    const onMouseUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isPreJoinState, panelSize]);

  const startDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (panelSize === "full") return;
    dragRef.current = {
      offsetX: e.clientX - panelRect.x,
      offsetY: e.clientY - panelRect.y,
    };
  };

  const startResize = (handle: ResizeHandle, e: React.MouseEvent<HTMLDivElement>) => {
    if (panelSize === "full") return;
    e.stopPropagation();
    resizeRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startRect: panelRect,
    };
  };

  const join = async () => {
    if (!client || !activePayload || isJoining) return;
    setIsJoining(true);

    const nextCall = client.call(activePayload.streamCallType, activePayload.callId);
    callRef.current = nextCall;
    setCall(nextCall);

    try {
      await nextCall.join({ create: true });
      await updateCallStatus(activePayload.callId, "ACTIVE");
    } catch (e) {
      await clearCallUI();
    } finally {
      setIsJoining(false);
    }
  };

  const decline = async () => {
    if (activePayload?.callId) {
      await updateCallStatus(activePayload.callId, "DECLINED");
    }
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
      onClick={() => {
        setPanelSize(next);
        setIsMinimized(false);
        if (next !== "full") {
          setPanelRect(centeredRect(next));
        }
      }}
      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white/80"
    >
      {label}
    </button>
  );

  const panelStyle =
    panelSize === "full"
      ? undefined
      : {
          left: panelRect.x,
          top: panelRect.y,
          width: panelRect.width,
          height: isMinimized ? 58 : panelRect.height,
        };

  return (
    <div className="fixed inset-0 z-[400] pointer-events-none">
      <div
        style={panelStyle}
        className={`fixed ${
          panelSize === "full" ? "inset-0 rounded-none" : "rounded-2xl"
        } pointer-events-auto bg-[#0b0b0e] border border-white/10 shadow-2xl overflow-hidden flex flex-col`}
      >
        <div
          onMouseDown={startDrag}
          className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/30 cursor-move select-none"
        >
          <div className="flex items-center gap-2 min-w-0">
            {activePayload?.type === "video" ? (
              <Video size={16} className="text-blue-400" />
            ) : (
              <Phone size={16} className="text-green-400" />
            )}
            <div className="min-w-0">
              <p className="text-xs text-white/80 truncate">{title}</p>
              {activePayload?.chatName && (
                <p className="text-[10px] text-white/40 truncate">{activePayload.chatName}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
            {sizeBtn("мини", "mini")}
            {sizeBtn("сред", "medium")}
            {sizeBtn("экран", "full")}
            <button
              onClick={() => setIsMinimized((prev) => !prev)}
              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white/80"
              title={isMinimized ? "Развернуть" : "Свернуть"}
            >
              <Minimize2 size={14} />
            </button>
            <button
              onClick={async () => {
                if (activePayload?.callId) {
                  await updateCallStatus(activePayload.callId, "ENDED");
                }
                await clearCallUI();
              }}
              className="px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs text-red-300"
              title="Закрыть"
            >
              ✕
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div className="flex-1 min-h-0">
        {/* pre-join incoming UI */}
        {incoming && !call && (
          <div className="p-4 h-full flex flex-col justify-between gap-4">
            <div className="text-white/70 text-sm">
              Входящий {incoming.type === "video" ? "видеозвонок" : "аудиозвонок"} от{" "}
              <span className="text-white font-semibold">
                {incoming.from.displayName || incoming.from.username}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={join}
                disabled={isJoining}
                className="flex-1 py-2 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold"
              >
                {isJoining ? "Подключение..." : "Принять"}
              </button>
              <button
                onClick={decline}
                disabled={isJoining}
                className="flex-1 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 disabled:opacity-60 disabled:cursor-not-allowed text-red-300 text-sm font-semibold"
              >
                Отклонить
              </button>
            </div>
          </div>
        )}

        {/* outgoing UI before join: auto-join on click to satisfy permissions */}
        {outgoing && !call && (
          <div className="p-4 h-full flex flex-col justify-between gap-4">
            <div className="text-white/70 text-sm">
              Исходящий {outgoing.type === "video" ? "видеозвонок" : "аудиозвонок"}…
            </div>
            <div className="flex gap-2 mt-auto">
              <button
                onClick={join}
                disabled={isJoining}
                className="flex-1 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold"
              >
                {isJoining ? "Подключение..." : "Начать"}
              </button>
              <button
                onClick={async () => {
                  if (activePayload?.callId) {
                    await updateCallStatus(activePayload.callId, "ENDED");
                  }
                  await clearCallUI();
                }}
                disabled={isJoining}
                className="flex-1 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 disabled:opacity-60 disabled:cursor-not-allowed text-red-300 text-sm font-semibold flex items-center justify-center gap-2"
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
                <div className="w-full h-full relative">
                  <SpeakerLayout participantsBarPosition={panelSize === "mini" ? "bottom" : "right"} />
                  <div className="call-controls-dock absolute bottom-2 left-2 right-2 z-20 overflow-x-auto overflow-y-hidden scrollbar-thin">
                    <div className="min-w-max">
                      <CallControls onLeave={clearCallUI} />
                    </div>
                  </div>
                </div>
              </StreamTheme>
            </StreamCall>
          </StreamVideo>
        )}
          </div>
        )}

        {!isMinimized && panelSize !== "full" && (
          <>
            <div
              className="absolute top-0 left-2 right-2 h-1 cursor-ns-resize"
              onMouseDown={(e) => startResize("top", e)}
            />
            <div
              className="absolute bottom-0 left-2 right-2 h-1 cursor-ns-resize"
              onMouseDown={(e) => startResize("bottom", e)}
            />
            <div
              className="absolute left-0 top-2 bottom-2 w-1 cursor-ew-resize"
              onMouseDown={(e) => startResize("left", e)}
            />
            <div
              className="absolute right-0 top-2 bottom-2 w-1 cursor-ew-resize"
              onMouseDown={(e) => startResize("right", e)}
            />
            <div
              className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize"
              onMouseDown={(e) => startResize("top-left", e)}
            />
            <div
              className="absolute top-0 right-0 w-3 h-3 cursor-nesw-resize"
              onMouseDown={(e) => startResize("top-right", e)}
            />
            <div
              className="absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize"
              onMouseDown={(e) => startResize("bottom-left", e)}
            />
            <div
              className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize"
              onMouseDown={(e) => startResize("bottom-right", e)}
            />
          </>
        )}
        <style jsx global>{`
          .call-controls-dock .str-video__call-controls {
            position: static !important;
            bottom: auto !important;
            top: auto !important;
            margin: 0 !important;
          }

          .str-video__call-controls {
            flex-wrap: nowrap !important;
            width: max-content;
            min-width: 100%;
          }
        `}</style>
      </div>
    </div>
  );
}

