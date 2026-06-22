"use client";

import { motion } from "framer-motion";
import { format } from "date-fns";
import { Check, CheckCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id?: string;
  sender_user_id: string;
  sender_role: string;
  content: string;
  created_at?: string;
}

interface ConsultationChatPanelProps {
  messages: ChatMessage[];
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  userId: string;
  connected: boolean;
  className?: string;
  compact?: boolean;
}

export function ConsultationChatPanel({
  messages,
  input,
  onInputChange,
  onSend,
  userId,
  connected,
  className,
  compact = false,
}: ConsultationChatPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/90 shadow-[0_8px_32px_rgba(15,40,80,0.06)] backdrop-blur-xl",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Secure Messages</p>
          <p className="text-[10px] text-muted-foreground">End-to-end session chat</p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
            connected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
          {connected ? "Connected" : "Connecting"}
        </span>
      </div>

      <ScrollArea className={cn("flex-1 px-4 py-3", compact ? "min-h-[200px]" : "min-h-[280px]")}>
        <div className="space-y-3">
          {messages.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">Send a secure message to continue</p>
          )}
          {messages.map((m, i) => {
            const isOwn = m.sender_user_id === userId;
            const time = m.created_at ? format(new Date(m.created_at), "h:mm a") : null;
            return (
              <motion.div
                key={m.id || i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex flex-col gap-0.5", isOwn ? "items-end" : "items-start")}
              >
                <span className="px-1 text-[10px] capitalize text-muted-foreground">{m.sender_role}</span>
                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
                    isOwn
                      ? "rounded-br-md bg-[oklch(0.35_0.12_250)] text-white"
                      : "rounded-bl-md border border-border/50 bg-muted/40 text-foreground"
                  )}
                >
                  {m.content}
                </div>
                <div className="flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
                  {time}
                  {isOwn && (i === messages.length - 1 ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                </div>
              </motion.div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="border-t border-border/50 p-3">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="Type a secure message..."
            className="h-10 rounded-xl border-border/70 bg-white"
            onKeyDown={(e) => e.key === "Enter" && onSend()}
          />
          <Button
            size="icon"
            onClick={onSend}
            className="h-10 w-10 shrink-0 rounded-xl bg-[oklch(0.35_0.12_250)] text-white hover:bg-[oklch(0.32_0.12_250)]"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
