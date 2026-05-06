export type StreamCallKind = "audio" | "video";

export type StartStreamCallResponse = {
  callId: string;
  streamCallType: string;
};

export async function startStreamCall(chatId: string, type: StreamCallKind): Promise<StartStreamCallResponse> {
  const res = await fetch("/api/calls/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, type }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to start call");
  }

  return res.json();
}

