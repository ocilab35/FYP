"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, AppointmentContext, fetchAuthenticatedBlob, getBackendOrigin, getErrorMessage } from "@/lib/api";
import { ClinicalWorkspacePanel } from "./clinical-workspace-panel";
import { ConsultationChatPanel, type ChatMessage } from "./consultation-chat-panel";
import { EmrDrawer } from "./emr-drawer";
import { PatientSummaryPanel } from "./patient-summary-panel";
import { VideoStage } from "./video-stage";
import { cn } from "@/lib/utils";

interface ConsultationRoomProps {
  sessionId: string;
  wsPath: string;
  userId: string;
  userRole: "patient" | "doctor";
  context?: AppointmentContext | null;
  appointmentId?: string;
}

export function ConsultationRoom({
  sessionId,
  wsPath,
  userId,
  userRole,
  context,
  appointmentId,
}: ConsultationRoomProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [emrOpen, setEmrOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const loadHistory = useCallback(() => {
    api.get(`/consultations/sessions/${sessionId}/messages`).then((res) => {
      setMessages(res.data.data || []);
    });
  }, [sessionId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const origin = getBackendOrigin();
    const ws = new WebSocket(`${origin.replace("http", "ws")}${wsPath}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.event === "chat") {
          setMessages((prev) => [...prev, data]);
        } else if (data.event === "webrtc-offer" && userRole === "patient") {
          handleAnswer(data);
        } else if (data.event === "webrtc-answer" && userRole === "doctor") {
          pcRef.current?.setRemoteDescription(new RTCSessionDescription(data.sdp));
        } else if (data.event === "webrtc-ice" && data.candidate) {
          pcRef.current?.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
        } else if (data.event === "session-ended") {
          stopMedia();
        }
      } catch { /* ignore */ }
    };
    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, wsPath, userRole]);

  const sendChat = () => {
    if (!input.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ event: "chat", content: input.trim() }));
    setInput("");
  };

  const getPeer = () => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pc.onicecandidate = (e) => {
      if (e.candidate && wsRef.current) {
        wsRef.current.send(JSON.stringify({ event: "webrtc-ice", candidate: e.candidate }));
      }
    };
    pc.ontrack = (e) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
    };
    pcRef.current = pc;
    return pc;
  };

  const startMedia = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    const pc = getPeer();
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    setVideoOn(true);

    if (userRole === "doctor" && wsRef.current) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      wsRef.current.send(JSON.stringify({ event: "webrtc-offer", sdp: offer }));
    }
  };

  const handleAnswer = async (data: { sdp: RTCSessionDescriptionInit }) => {
    const pc = getPeer();
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    wsRef.current?.send(JSON.stringify({ event: "webrtc-answer", sdp: answer }));
  };

  const stopMedia = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    setVideoOn(false);
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = muted; });
    setMuted(!muted);
  };

  const previewRecord = async (fileUrl: string) => {
    try {
      const url = await fetchAuthenticatedBlob(fileUrl);
      setPreviewUrl(url);
    } catch {
      toast.error(getErrorMessage(new Error("Could not load file")));
    }
  };

  const isDoctorWithContext = userRole === "doctor" && context;

  return (
    <>
      <div
        className={cn(
          "grid h-[calc(100vh-7rem)] min-h-[560px] gap-3 lg:gap-4",
          isDoctorWithContext
            ? "grid-cols-1 xl:grid-cols-12"
            : "grid-cols-1 lg:grid-cols-12"
        )}
      >
        {isDoctorWithContext && (
          <div className="hidden min-h-0 xl:col-span-3 xl:block">
            <PatientSummaryPanel context={context} className="h-full" />
          </div>
        )}

        <div
          className={cn(
            "flex min-h-0 flex-col",
            isDoctorWithContext ? "xl:col-span-5" : "lg:col-span-7"
          )}
        >
          <VideoStage
            localVideoRef={localVideoRef}
            remoteVideoRef={remoteVideoRef}
            videoOn={videoOn}
            muted={muted}
            connected={connected}
            userRole={userRole}
            onStartVideo={startMedia}
            onToggleMute={toggleMute}
            onStopVideo={stopMedia}
            onOpenEmr={isDoctorWithContext && appointmentId ? () => setEmrOpen(true) : undefined}
            className="h-full min-h-[360px]"
          />
        </div>

        <div
          className={cn(
            "min-h-[320px]",
            isDoctorWithContext ? "xl:col-span-4" : "lg:col-span-5"
          )}
        >
          {isDoctorWithContext ? (
            <ClinicalWorkspacePanel
              context={context}
              messages={messages}
              chatInput={input}
              onChatInputChange={setInput}
              onSendChat={sendChat}
              userId={userId}
              connected={connected}
              onPreviewRecord={previewRecord}
              className="h-full"
            />
          ) : (
            <ConsultationChatPanel
              messages={messages}
              input={input}
              onInputChange={setInput}
              onSend={sendChat}
              userId={userId}
              connected={connected}
              className="h-full"
            />
          )}
        </div>

        {isDoctorWithContext && (
          <div className="xl:hidden">
            <PatientSummaryPanel context={context} />
          </div>
        )}
      </div>

      {isDoctorWithContext && appointmentId && (
        <EmrDrawer
          open={emrOpen}
          onClose={() => setEmrOpen(false)}
          context={context}
          appointmentId={appointmentId}
          onPreviewRecord={previewRecord}
        />
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe src={previewUrl} className="h-[80vh] w-full" title="Medical record preview" />
          </div>
        </div>
      )}
    </>
  );
}
