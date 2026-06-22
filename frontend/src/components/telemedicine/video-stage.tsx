"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  StickyNote,
  Video,
  VideoOff,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VideoStageProps {
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  videoOn: boolean;
  muted: boolean;
  connected: boolean;
  userRole: "patient" | "doctor";
  onStartVideo: () => void;
  onToggleMute: () => void;
  onStopVideo: () => void;
  onOpenEmr?: () => void;
  className?: string;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function VideoStage({
  localVideoRef,
  remoteVideoRef,
  videoOn,
  muted,
  connected,
  userRole,
  onStartVideo,
  onToggleMute,
  onStopVideo,
  onOpenEmr,
  className,
}: VideoStageProps) {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!videoOn) {
      setDuration(0);
      return;
    }
    const t = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(t);
  }, [videoOn]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[oklch(0.18_0.04_250)] shadow-[0_16px_48px_rgba(15,40,80,0.25)]",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-white/80">
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5">
            <Wifi className={cn("h-3 w-3", connected ? "text-emerald-400" : "text-amber-400")} />
            {connected ? "HD Connection" : "Reconnecting"}
          </span>
          {videoOn && (
            <>
              <span className="font-mono tabular-nums">{formatDuration(duration)}</span>
              <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300">Not recording</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className={cn("rounded-full px-2 py-0.5", muted ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300")}>
            Mic {muted ? "off" : "on"}
          </span>
          <span className={cn("rounded-full px-2 py-0.5", videoOn ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10")}>
            Camera {videoOn ? "on" : "off"}
          </span>
        </div>
      </div>

      <div className="relative min-h-[280px] flex-1 p-3">
        <div className="grid h-full gap-3 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/10">
            <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
            <span className="absolute bottom-2 left-2 rounded-md bg-black/50 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
              {userRole === "doctor" ? "Patient" : "Doctor"}
            </span>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/10">
            <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full scale-x-[-1] object-cover" />
            <span className="absolute bottom-2 left-2 rounded-md bg-black/50 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
              You
            </span>
          </div>
        </div>

        <AnimatePresence>
          {!videoOn && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-3 flex flex-col items-center justify-center rounded-xl bg-black/60 backdrop-blur-sm"
            >
              <Video className="mb-3 h-10 w-10 text-white/50" />
              <p className="text-sm text-white/70">Start video to begin your consultation</p>
              <Button onClick={onStartVideo} className="mt-4 rounded-xl bg-white text-[oklch(0.35_0.12_250)] hover:bg-white/90">
                <Video className="mr-2 h-4 w-4" />
                Join Video Call
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 bg-black/30 px-4 py-3 backdrop-blur-md">
        {videoOn && (
          <>
            <ControlButton active={!muted} onClick={onToggleMute} icon={muted ? MicOff : Mic} label={muted ? "Unmute" : "Mute"} variant={muted ? "danger" : "default"} />
            <ControlButton active={videoOn} onClick={onStopVideo} icon={VideoOff} label="Camera off" />
            <ControlButton active={false} disabled icon={MonitorUp} label="Share screen" />
            {onOpenEmr && <ControlButton active={false} onClick={onOpenEmr} icon={StickyNote} label="Open EMR" />}
            <ControlButton active={false} onClick={onStopVideo} icon={PhoneOff} label="End call" variant="danger" />
          </>
        )}
      </div>
    </motion.div>
  );
}

function ControlButton({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
  variant = "default",
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  variant?: "default" | "danger";
}) {
  return (
    <motion.div whileHover={disabled ? undefined : { scale: 1.05 }} whileTap={disabled ? undefined : { scale: 0.95 }}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl transition-colors disabled:opacity-40",
          variant === "danger" && "bg-red-500/90 text-white hover:bg-red-600",
          variant === "default" && active && "bg-white/20 text-white hover:bg-white/30",
          variant === "default" && !active && "bg-white/10 text-white/80 hover:bg-white/20"
        )}
        aria-label={label}
        title={label}
      >
        <Icon className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
