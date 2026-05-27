"use client";

import { useEffect, useRef, useState } from "react";
import { pusherClient } from "@/app/lib/pusher";
import Avatar from "@/components/Avatar";
import { Minimize2, Phone, PhoneOff, Video, Mic, MicOff, VideoOff, Wifi, WifiOff, Monitor, MonitorOff, RefreshCw } from "lucide-react";

// Fallback-конфиг (только STUN) на случай, если /api/calls/ice-config ещё не
// успел ответить или вернул ошибку. Боевые TURN-креды читаются с сервера —
// см. app/api/calls/ice-config/route.ts и app/lib/ice-config.ts.
const ICE_FALLBACK: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 2,
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
};
type Sz = "mini" | "medium" | "full";
type CP = { callId: string; type: "audio" | "video"; chatId: string; chatName?: string; peerId?: string | null; from: { id: string; username: string; displayName: string; avatarUrl: string | null }; createdAt: string };
type Props = { currentUser: { id: string; username: string; displayName: string; avatarUrl?: string | null } };
type R = { x: number; y: number; width: number; height: number };
type H = "top" | "right" | "bottom" | "left" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
const MW = 280, MH = 170, TO = 60_000;
function cr(sz: Exclude<Sz, "full">): R { const w = sz === "mini" ? 320 : 560, h = sz === "mini" ? 210 : 420; return { x: Math.max(16, (innerWidth - w) / 2), y: Math.max(16, (innerHeight - h) / 2), width: w, height: h }; }
function cl(r: R): R { return { ...r, x: Math.max(0, Math.min(r.x, innerWidth - r.width)), y: Math.max(0, Math.min(r.y, innerHeight - r.height)) }; }

export default function GCL({ currentUser }: Props) {
  const [sz, setSz] = useState<Sz>("medium");
  const [mini, setMini] = useState(false);
  const [vis, setVis] = useState(false);
  const [act, setAct] = useState(false);
  const [conn, setConn] = useState("new");
  const [pos, setPos] = useState<R>(() => cr("medium"));
  const [inc, setInc] = useState<CP | null>(null);
  const [out, setOut] = useState<CP | null>(null);
  const [mut, setMut] = useState(false);
  const [vidOff, setVidOff] = useState(false);
  const [shr, setShr] = useState(false);
  const [rem, setRem] = useState<MediaStream | null>(null);
  const [ring, setRing] = useState(false);
  const [endR, setEndR] = useState<"" | "peer-left" | "lost">("");

  const dr = useRef<{ ox: number; oy: number } | null>(null);
  const rr = useRef<{ h: H; sx: number; sy: number; sr: R } | null>(null);
  const lr = useRef<MediaStream | null>(null);
  const srRef = useRef<MediaStream | null>(null);
  const rv = useRef<HTMLVideoElement>(null);
  const lv = useRef<HTMLVideoElement>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const pr = useRef<any[]>([]);
  const jr = useRef(false);
  const cidR = useRef<string | null>(null);
  const pidR = useRef<string | null>(null);
  const actR = useRef(false);
  const endRR = useRef("");
  const myAnswerSent = useRef(false);
  const myOfferSent = useRef(false);
  const iceR = useRef<RTCConfiguration>(ICE_FALLBACK);
  // Зеркала out/inc через ref — нужны для callback'ов, захваченных в useEffect.
  // Без них setTimeout(startOut, 300) видит state от первого рендера (null),
  // и звонок никогда не доходит до createOffer.
  const outR = useRef<CP | null>(null);
  const incR = useRef<CP | null>(null);

  const p = inc ?? out;
  const iv = p?.type === "video";
  useEffect(() => { cidR.current = p?.callId ?? null; }, [p?.callId]);
  useEffect(() => { pidR.current = inc ? inc.from.id : (out?.peerId ?? null); }, [inc, out]);
  useEffect(() => { actR.current = act; }, [act]);
  useEffect(() => { endRR.current = endR; }, [endR]);
  useEffect(() => { actR.current = act; }, [act]);
  useEffect(() => { endRR.current = endR; }, [endR]);
  useEffect(() => { outR.current = out; }, [out]);
  useEffect(() => { incR.current = inc; }, [inc]);

  const upStatus = async (cid: string, st: "ACTIVE" | "ENDED" | "DECLINED") => { try { await fetch("/api/calls/status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callId: cid, status: st }) }); } catch {} };
  const cln = async () => { pc.current?.close(); pc.current = null; lr.current?.getTracks().forEach(t => t.stop()); lr.current = null; srRef.current?.getTracks().forEach(t => t.stop()); srRef.current = null; rem?.getTracks().forEach(t => t.stop()); setRem(null); pr.current = []; jr.current = false; myAnswerSent.current = false; myOfferSent.current = false; cidR.current = null; pidR.current = null; setVis(false); setAct(false); setConn("new"); setEndR(""); setInc(null); setOut(null); setMini(false); setMut(false); setVidOff(false); setShr(false); setRing(false); };

  const ss = async (ty: string, tid: string, d: any) => { const cid = cidR.current; if (!cid) return; try { await fetch("/api/calls/webrtc/signal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: ty, callId: cid, targetUserId: tid, ...d }) }); } catch {} };

  const gm = async (f?: string): Promise<MediaStream | null> => { const cp = incR.current ?? outR.current; const isVideo = cp?.type === "video"; const vc: any = { audio: true }; if (isVideo) { vc.video = { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60, max: 60 } }; if (f) vc.video.facingMode = f; } else vc.video = false;
    try { const s = await navigator.mediaDevices.getUserMedia(vc); lr.current = s; if (lv.current) lv.current.srcObject = s; return s; } catch {}
    if (f) { try { const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60, max: 60 } } }); lr.current = s; if (lv.current) lv.current.srcObject = s; return s; } catch {} }
    // Fallback на 30fps если 60 не получается (старая камера / лимиты браузера)
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } } }); lr.current = s; if (lv.current) lv.current.srcObject = s; return s; } catch {}
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); lr.current = s; return s; } catch {}
    lr.current = new MediaStream(); return lr.current; };

  const swCam = async () => { const vt = lr.current?.getVideoTracks()[0]; if (!vt) return; const cf = (vt as any).getSettings?.()?.facingMode || "user"; const nf = cf === "user" ? "environment" : "user";
    try { const ns = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60, max: 60 }, facingMode: nf }, audio: false }); const nt = ns.getVideoTracks()[0];
      const snd = pc.current?.getSenders().find((s: RTCRtpSender) => s.track?.kind === "video"); if (snd) snd.replaceTrack(nt);
      if (lr.current) { lr.current.removeTrack(vt); lr.current.addTrack(nt); vt.stop(); if (lv.current) lv.current.srcObject = lr.current; } } catch {} };

  const tgScr = async () => { if (shr) { if (srRef.current) { srRef.current.getTracks().forEach(t => t.stop()); srRef.current = null; } const ct = lr.current?.getVideoTracks()[0]; if (ct) { const snd = pc.current?.getSenders().find((s: RTCRtpSender) => s.track?.kind === "video"); if (snd) snd.replaceTrack(ct); ct.enabled = !vidOff; } if (lv.current) lv.current.srcObject = lr.current; setShr(false); } else { try { const sc = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); srRef.current = sc; if (lv.current) lv.current.srcObject = sc; const st = sc.getVideoTracks()[0]; if (st) { const snd = pc.current?.getSenders().find((s: RTCRtpSender) => s.track?.kind === "video"); if (snd) snd.replaceTrack(st); st.onended = () => tgScr(); } setShr(true); } catch {} } };

  // ─── Quality tuning helpers ──────────────────────────────────────────────
  // Лимиты полосы — подняты выше дефолтных ~1 Мбит/с (видео) и ~32 кбит/с (аудио).
  // 6 Мбит/с — отличное 1080p@60fps. На плохой сети WebRTC сам адаптивно
  // снижает до доступной полосы. 128 кбит/с — HD voice через Opus.
  const VIDEO_MAX_BITRATE = 6_000_000;
  const AUDIO_MAX_BITRATE = 128_000;

  // Munge SDP: включаем у Opus стерео + FEC + макс. sample rate.
  // Это безопасное вмешательство в SDP — затрагивает только параметры
  // существующего m=audio Opus, не меняет codec preference и не ломает
  // совместимость. Эффект слышен сразу — голос «пухлее», лучше переносит
  // потери пакетов.
  const tuneSdp = (sdp: string): string => {
    return sdp.replace(/a=fmtp:111 ([^\r\n]*)/g, (_match, params) => {
      const has = (k: string) => new RegExp(`(^|;)\\s*${k}=`).test(params);
      const additions: string[] = [];
      if (!has("stereo"))           additions.push("stereo=1");
      if (!has("sprop-stereo"))     additions.push("sprop-stereo=1");
      if (!has("maxaveragebitrate"))additions.push(`maxaveragebitrate=${AUDIO_MAX_BITRATE}`);
      if (!has("maxplaybackrate"))  additions.push("maxplaybackrate=48000");
      if (!has("useinbandfec"))     additions.push("useinbandfec=1");
      if (!has("usedtx"))           additions.push("usedtx=0"); // false: не глушим в тишине, иначе слышны "дырки"
      const sep = params.trim().endsWith(";") || params.trim().length === 0 ? "" : ";";
      return `a=fmtp:111 ${params}${sep}${additions.join(";")}`;
    });
  };

  // Поднимаем максимальные битрейты у уже созданных sender'ов. Вызывается
  // после createOffer/createAnswer + setLocalDescription, когда параметры уже
  // применимы к транспорту.
  const tune = async (pcc: RTCPeerConnection) => {
    for (const sender of pcc.getSenders()) {
      if (!sender.track) continue;
      try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
        // Высокий network priority — если QoS на сети поддерживается (DSCP),
        // пакеты медиа получат приоритет над прочим трафиком.
        (params.encodings[0] as any).networkPriority = "high";
        if (sender.track.kind === "video") {
          params.encodings[0].maxBitrate = VIDEO_MAX_BITRATE;
          params.encodings[0].maxFramerate = 60;
          params.degradationPreference = "maintain-framerate";
        } else if (sender.track.kind === "audio") {
          params.encodings[0].maxBitrate = AUDIO_MAX_BITRATE;
        }
        await sender.setParameters(params);
      } catch (e) { console.warn("[GCL] setParameters:", e); }
    }
  };

  // VP9 первый — на 30-40% эффективнее VP8/H264 при том же битрейте, либо
  // на 30-40% лучше качество при том же битрейте. Поддерживается всеми
  // современными браузерами и flutter_webrtc на Android. H264 — fallback
  // на случай если у пира нет VP9 (старый Safari/iOS), AV1 — для топовых
  // устройств, VP8 — последний resort.
  const prefCodec = (pcc: RTCPeerConnection) => {
    try {
      const caps = (RTCRtpSender as any).getCapabilities?.("video");
      if (!caps?.codecs) return;
      const order = ["video/VP9", "video/H264", "video/AV1", "video/VP8"];
      const sorted = [...caps.codecs].sort((a: any, b: any) => {
        const ai = order.indexOf(a.mimeType); const bi = order.indexOf(b.mimeType);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
      for (const t of pcc.getTransceivers()) {
        if (t.sender.track?.kind === "video" || (t as any).receiver?.track?.kind === "video") {
          try { (t as any).setCodecPreferences?.(sorted); } catch {}
        }
      }
    } catch {}
  };

  const mkPC = (ls: MediaStream | null) => { const pcc = new RTCPeerConnection(iceR.current); pc.current = pcc; const pid = pidR.current; const cp = incR.current ?? outR.current; const isVideo = cp?.type === "video";
    if (ls && ls.getTracks().length > 0) ls.getTracks().forEach(t => pcc.addTrack(t, ls)); else { pcc.addTransceiver("audio", { direction: "recvonly" }); if (isVideo) pcc.addTransceiver("video", { direction: "recvonly" }); }
    if (isVideo) prefCodec(pcc);
    pcc.onicecandidate = e => { if (e.candidate && pid) ss("ice-candidate", pid, { candidate: e.candidate.candidate, sdpMLineIndex: e.candidate.sdpMLineIndex, sdpMid: e.candidate.sdpMid }); };
    pcc.ontrack = e => { const s = e.streams[0]; if (!s) return; setRem(s); if (rv.current) rv.current.srcObject = s; setAct(true); setEndR(""); };
    pcc.onconnectionstatechange = () => {
      setConn(pcc.connectionState);
      if (pcc.connectionState === "connected") { setAct(true); setEndR(""); }
      if (pcc.connectionState === "disconnected" && actR.current) { setAct(false); setEndR("peer-left"); setTimeout(() => { if (!actR.current) cln(); }, 5000); }
      if (pcc.connectionState === "failed") {
        if (actR.current) { setAct(false); setEndR("lost"); setTimeout(() => cln(), 5000); }
        else { pcc.restartIce(); }
      }
      if (pcc.connectionState === "closed" && actR.current && !endRR.current) { setEndR("peer-left"); setTimeout(() => cln(), 2000); }
    };
    pcc.oniceconnectionstatechange = () => { if (pcc.iceConnectionState === "failed") pcc.restartIce(); }; setConn("connecting"); return pcc; };

  const procSig = async (s: any) => { const pcc = pc.current; if (!pcc) return; try { switch (s.type) { case "offer": await pcc.setRemoteDescription({ type: "offer", sdp: s.sdp }); const a = await pcc.createAnswer(); if (a.sdp) a.sdp = tuneSdp(a.sdp); await pcc.setLocalDescription(a); await tune(pcc); myAnswerSent.current = true; if (s.fromUserId) await ss("answer", s.fromUserId, { sdp: a.sdp }); if (cidR.current) upStatus(cidR.current, "ACTIVE"); break; case "answer": if (pcc.signalingState !== "stable" && s.sdp) await pcc.setRemoteDescription({ type: "answer", sdp: s.sdp }); break; case "ice-candidate": if (s.candidate && pcc.remoteDescription) await pcc.addIceCandidate({ candidate: s.candidate, sdpMLineIndex: s.sdpMLineIndex, sdpMid: s.sdpMid }); else if (s.candidate) pr.current.push(s); break; case "call-ended": setAct(false); setEndR("peer-left"); pcc.close(); setTimeout(() => cln(), 3000); break; } } catch {} };
  const fp = async () => { const sigs = pr.current; pr.current = []; for (const s of sigs) await procSig(s); };

  const accept = async () => { if (jr.current) return; jr.current = true; setRing(false); const s = await gm(); mkPC(s); await fp(); jr.current = false; };
  const decline = async () => { if (inc?.callId) await upStatus(inc.callId, "DECLINED"); cln(); };
  const startOut = async () => { if (jr.current) return; jr.current = true; myOfferSent.current = true; const s = await gm(); const pid = pidR.current ?? outR.current?.peerId; const cp = incR.current ?? outR.current; const isVideo = cp?.type === "video"; if (!pid) { console.warn("[GCL] startOut: no peerId, abort"); jr.current = false; return; } const pcc = mkPC(s); try { const o = await pcc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: isVideo }); if (o.sdp) o.sdp = tuneSdp(o.sdp); await pcc.setLocalDescription(o); await tune(pcc); await ss("offer", pid, { sdp: o.sdp }); if (cidR.current) upStatus(cidR.current, "ACTIVE"); } catch { jr.current = false; return; } await fp(); jr.current = false; };
  const endCall = async () => { const pid = pidR.current; if (pid) await ss("call-ended", pid, {}); if (cidR.current) await upStatus(cidR.current, "ENDED"); cln(); };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/calls/ice-config", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data?.success || !Array.isArray(data?.iceServers)) return;
        iceR.current = {
          iceServers: data.iceServers,
          iceCandidatePoolSize: data.iceCandidatePoolSize ?? 2,
          bundlePolicy: data.bundlePolicy ?? "max-bundle",
          rtcpMuxPolicy: data.rtcpMuxPolicy ?? "require",
        };
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { if (!pusherClient || !currentUser?.id) return; const ch = pusherClient.subscribe(`user-${currentUser.id}`);
    ch.bind("incoming-call", (p: CP) => { if (myOfferSent.current || myAnswerSent.current) return; cidR.current = p.callId; setInc(p); setOut(null); setRing(true); setVis(true); setAct(false); setEndR(""); setConn("new"); setSz("medium"); setMini(false); setPos(cr("medium")); });
    ch.bind("outgoing-call", (p: CP) => { if (!vis && !myOfferSent.current) { cidR.current = p.callId; pidR.current = p.peerId ?? null; setOut(p); setInc(null); setRing(false); setVis(true); setAct(false); setEndR(""); setConn("connecting"); setSz("medium"); setMini(false); setPos(cr("medium")); setTimeout(() => startOut(), 500); } });
    ch.bind("webrtc-signal", (s: any) => { if (!pc.current) { pr.current.push(s); return; } procSig(s); });
    ch.bind("call-accepted-elsewhere", (data: any) => { if (cidR.current === data.callId && !myAnswerSent.current && !myOfferSent.current) { cln(); } });
    const onCE = (e: Event) => { const p = (e as CustomEvent).detail as CP; cidR.current = p.callId; pidR.current = p.peerId ?? null; setOut(p); setInc(null); setRing(false); setVis(true); setAct(false); setEndR(""); setConn("connecting"); setSz("medium"); setMini(false); setPos(cr("medium")); setTimeout(() => startOut(), 300); };
    window.addEventListener("global-call-outgoing", onCE);
    return () => { ch.unbind("incoming-call"); ch.unbind("outgoing-call"); ch.unbind("webrtc-signal"); ch.unbind("call-accepted-elsewhere"); window.removeEventListener("global-call-outgoing", onCE); pusherClient.unsubscribe(`user-${currentUser.id}`); };
  }, [currentUser.id]);

  useEffect(() => { if (!p || act) return; const ex = TO - (Date.now() - new Date(p.createdAt).getTime()); if (ex <= 0) { upStatus(p.callId, "ENDED"); cln(); return; } const t = setTimeout(async () => { if (!act) { await upStatus(p.callId, "ENDED"); cln(); } }, ex); return () => clearTimeout(t); }, [p, act]);
  useEffect(() => { if (sz === "full") setMini(false); }, [sz]);
  useEffect(() => { const mm = (e: MouseEvent) => { if (dr.current && sz !== "full") setPos(pp => cl({ ...pp, x: e.clientX - dr.current!.ox, y: e.clientY - dr.current!.oy })); if (rr.current && sz !== "full") { const { h, sr, sx, sy } = rr.current; const dx = e.clientX - sx, dy = e.clientY - sy; let nx = sr.x, ny = sr.y, nw = sr.width, nh = sr.height; if (h.includes("right")) nw = Math.max(MW, sr.width + dx); if (h.includes("left")) { nw = Math.max(MW, sr.width - dx); nx = sr.x + (sr.width - nw); } if (h.includes("bottom")) nh = Math.max(MH, sr.height + dy); if (h.includes("top")) { nh = Math.max(MH, sr.height - dy); ny = sr.y + (sr.height - nh); } setPos(cl({ x: nx, y: ny, width: nw, height: nh })); } }; const mu = () => { dr.current = null; rr.current = null; }; window.addEventListener("mousemove", mm); window.addEventListener("mouseup", mu); return () => { window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); }; }, [sz]);
  const sd = (e: React.MouseEvent) => { if (sz !== "full") dr.current = { ox: e.clientX - pos.x, oy: e.clientY - pos.y }; };
  const srs = (h: H, e: React.MouseEvent) => { if (sz !== "full") { e.stopPropagation(); rr.current = { h, sx: e.clientX, sy: e.clientY, sr: pos }; } };
  if (!vis) return null;

  const peer = inc ? { name: inc.from.displayName || inc.from.username, av: inc.from.avatarUrl } : { name: out?.chatName || "Собеседник", av: null as string | null };
  const me = { name: currentUser.displayName || currentUser.username, av: currentUser.avatarUrl || null };
  const clab = conn === "connected" ? "На связи" : conn === "connecting" ? "Подключение..." : conn === "new" ? "Ожидание" : conn;
  const st = sz === "full" ? undefined : { left: pos.x, top: pos.y, width: pos.width, height: mini ? 58 : pos.height };

  return (<div className="fixed inset-0 z-[400] pointer-events-none">
    <div style={st} className={`fixed ${sz==="full"?"inset-0 rounded-none":"rounded-2xl"} pointer-events-auto bg-[#0b0b0e] border border-white/10 shadow-2xl overflow-hidden flex flex-col`}>
      <div onMouseDown={sd} className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/30 cursor-move select-none">
        <div className="flex items-center gap-2">{iv?<Video size={16} className="text-blue-400"/>:<Phone size={16} className="text-green-400"/>}<div className="flex items-center gap-1.5">{conn==="connected"&&<Wifi size={12} className="text-green-400"/>}{conn!=="connected"&&!ring&&endR===""&&<WifiOff size={12} className="text-yellow-400 animate-pulse"/>}<p className="text-xs text-white/80">{endR?endR==="peer-left"?"Собеседник вышел":"Соединение потеряно":clab}</p></div></div>
        <div className="flex items-center gap-2" onMouseDown={e=>e.stopPropagation()}>
          {(["мини","сред","экран"] as const).map((l,i)=><button key={l} onClick={()=>{setSz((["mini","medium","full"]as Sz[])[i]);setMini(false);if(i===0)setPos(cr("mini"));if(i===1)setPos(cr("medium"))}} className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white/80">{l}</button>)}
          <button onClick={()=>setMini(p=>!p)} className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white/80"><Minimize2 size={14}/></button>
          <button onClick={endCall} className="px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs text-red-300">✕</button>
        </div>
      </div>
      {!mini&&<div className="flex-1 min-h-0 relative bg-black">
        <video ref={rv} autoPlay playsInline className="w-full h-full object-cover"/>
        {(iv||shr)&&<div className="absolute top-4 right-4 w-48 h-36 rounded-xl overflow-hidden border-2 border-white/20 shadow-lg bg-zinc-800"><video ref={lv} autoPlay playsInline muted className="w-full h-full object-cover"/><div className="absolute bottom-1 left-1 bg-black/70 px-1.5 py-0.5 rounded text-[10px] text-white/80">{shr?"Экран":"Вы"}</div></div>}
        {!ring&&endR===""&&<div className="absolute top-4 left-4 flex items-center gap-2"><div className="flex items-center gap-2 bg-black/50 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10"><Avatar image={peer.av} title={peer.name} size={28}/><span className="text-white text-xs font-medium">{peer.name}</span>{conn==="connected"?<span className="w-2 h-2 bg-green-400 rounded-full"/>:<span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"/>}</div><div className="flex items-center gap-2 bg-black/50 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10"><Avatar image={me.av} title={me.name} size={28}/><span className="text-white text-xs font-medium">Вы</span>{mut&&<MicOff size={10} className="text-red-400"/>}</div></div>}
        {ring&&<div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80"><div className="mb-4 ring-4 ring-green-500/30 rounded-full animate-pulse"><Avatar image={inc?.from.avatarUrl} title={inc?.from.displayName||inc?.from.username||"?"} size={96}/></div><p className="text-white text-xl font-semibold">{inc?.from.displayName||inc?.from.username}</p><p className="text-white/40 text-sm mt-1">{iv?"Видеозвонок":"Аудиозвонок"}</p><div className="flex items-center justify-center gap-6 mt-8"><button onClick={decline} className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 hover:bg-red-600 transition-colors"><PhoneOff size={28}/></button><button onClick={accept} className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 hover:bg-green-600 transition-colors"><Phone size={28}/></button></div></div>}
        {endR!==""&&<div className="absolute inset-0 flex items-center justify-center bg-black/80"><div className="text-center"><div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">{endR==="peer-left"?<PhoneOff size={36} className="text-yellow-400"/>:<WifiOff size={36} className="text-red-400"/>}</div><p className="text-white text-xl font-semibold">{endR==="peer-left"?`${peer.name} вышел(а) из звонка`:"Соединение потеряно"}</p><p className="text-white/40 text-sm mt-1">{endR==="peer-left"?"Звонок завершён":"Проверьте подключение к интернету"}</p></div></div>}
        {!rem&&!act&&!ring&&endR===""&&<div className="absolute inset-0 flex items-center justify-center bg-black/70"><div className="text-center"><div className="relative mx-auto mb-6 w-24 h-24"><div className="absolute inset-0 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"/><div className="absolute inset-2 flex items-center justify-center"><Avatar image={iv?peer.av:undefined} title={out?(out.chatName||"?"):(inc?.from.displayName||inc?.from.username||"?")} size={64}/></div></div><p className="text-white text-lg font-medium mb-1">{out?peer.name:(inc?.from.displayName||inc?.from.username)}</p><p className="text-white/50 text-sm">{out?"Звонок...":"Подключение..."}</p>{out&&<p className="text-white/30 text-xs mt-1">Ожидание ответа...</p>}</div></div>}
        {!ring&&endR===""&&<div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-3 py-4 bg-gradient-to-t from-black/80 to-transparent">
          <button onClick={()=>{const t=lr.current?.getAudioTracks()[0];if(t){t.enabled=mut;setMut(!mut)}}} className={`p-3 rounded-full ${mut?'bg-red-500':'bg-white/10 hover:bg-white/20'}`}>{mut?<MicOff size={22}/>:<Mic size={22}/>}</button>
          <button onClick={endCall} className="p-4 bg-red-500 rounded-full shadow-lg shadow-red-500/20"><PhoneOff size={26}/></button>
          <button onClick={()=>{const t=lr.current?.getVideoTracks()[0];if(t){t.enabled=vidOff;setVidOff(!vidOff)}}} className={`p-3 rounded-full ${vidOff?'bg-red-500':'bg-white/10 hover:bg-white/20'}`}>{vidOff?<VideoOff size={22}/>:<Video size={22}/>}</button>
          {iv&&<><button onClick={swCam} className="p-3 bg-white/10 hover:bg-white/20 rounded-full"><RefreshCw size={22}/></button><button onClick={tgScr} className={`p-3 rounded-full ${shr?'bg-green-500':'bg-white/10 hover:bg-white/20'}`}>{shr?<MonitorOff size={22}/>:<Monitor size={22}/>}</button></>}
        </div>}
      </div>}
      {!mini&&sz!=="full"&&<>
        <div className="absolute top-0 left-2 right-2 h-1 cursor-ns-resize" onMouseDown={e=>srs("top",e)}/><div className="absolute bottom-0 left-2 right-2 h-1 cursor-ns-resize" onMouseDown={e=>srs("bottom",e)}/>
        <div className="absolute left-0 top-2 bottom-2 w-1 cursor-ew-resize" onMouseDown={e=>srs("left",e)}/><div className="absolute right-0 top-2 bottom-2 w-1 cursor-ew-resize" onMouseDown={e=>srs("right",e)}/>
        <div className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize" onMouseDown={e=>srs("top-left",e)}/><div className="absolute top-0 right-0 w-3 h-3 cursor-nesw-resize" onMouseDown={e=>srs("top-right",e)}/>
        <div className="absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize" onMouseDown={e=>srs("bottom-left",e)}/><div className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize" onMouseDown={e=>srs("bottom-right",e)}/>
      </>}
    </div>
  </div>);
}
