"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { api, AppNotification, getErrorMessage } from "@/lib/api";

interface NotificationCenterProps {
  apiPrefix: "/doctors" | "/patients";
}

export function NotificationCenter({ apiPrefix }: NotificationCenterProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        api.get(`${apiPrefix}/notifications`),
        apiPrefix === "/doctors"
          ? api.get(`${apiPrefix}/notifications/unread-count`)
          : Promise.resolve({ data: { data: { count: 0 } } }),
      ]);
      setNotifications(listRes.data.data || []);
      if (apiPrefix === "/doctors") {
        setUnreadCount(countRes.data.data?.count || 0);
      } else {
        setUnreadCount((listRes.data.data || []).filter((n: AppNotification) => !n.is_read).length);
      }
    } catch {
      /* silent */
    }
  }, [apiPrefix]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  const markRead = async (id: string) => {
    await api.patch(`${apiPrefix}/notifications/${id}/read`);
    load();
  };

  const markAllRead = async () => {
    if (apiPrefix === "/doctors") {
      await api.patch(`${apiPrefix}/notifications/read-all`);
    }
    load();
  };

  const handleApprove = async (appointmentId: string, notifId: string) => {
    try {
      await api.post(`/doctors/appointments/${appointmentId}/approve`);
      await markRead(notifId);
      toast.success("Appointment approved");
      router.push("/doctor/appointments");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const handleReject = async (appointmentId: string, notifId: string) => {
    try {
      await api.post(`/doctors/appointments/${appointmentId}/reject`);
      await markRead(notifId);
      toast.success("Appointment declined");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell className="h-5 w-5 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-sm">Notifications</p>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-96">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No notifications</p>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => {
                const meta = (n as AppNotification & { metadata_json?: Record<string, string> }).metadata_json;
                const appointmentId = meta?.appointment_id;
                const isApproval = n.notification_type === "appointment_approval_request" || n.notification_type === "appointment_booked";
                return (
                  <div
                    key={n.id}
                    className={cn("px-4 py-3", !n.is_read && "bg-primary/5")}
                  >
                    <div className="flex items-start gap-2">
                      {!n.is_read && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                      <div className={cn("flex-1 min-w-0", !n.is_read ? "" : "ml-4")}>
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                        {meta?.patient_name && (
                          <p className="text-xs mt-1">Patient: {meta.patient_name}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                        {apiPrefix === "/doctors" && isApproval && appointmentId && !n.is_read && (
                          <div className="flex gap-2 mt-3">
                            <Button size="sm" className="h-7 text-xs gradient-medical border-0 text-white" onClick={() => handleApprove(appointmentId, n.id)}>
                              <Check className="h-3 w-3 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleReject(appointmentId, n.id)}>
                              <X className="h-3 w-3 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                        {!isApproval && (
                          <button type="button" className="text-xs text-primary mt-2" onClick={() => !n.is_read && markRead(n.id)}>
                            {n.is_read ? "" : "Mark read"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
