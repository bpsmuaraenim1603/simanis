"use client";

import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { useMutation, useQuery } from "@apollo/client";
import { Bell } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  GET_MY_NOTIFICATIONS,
  GET_MY_UNREAD_NOTIFICATION_COUNT,
  MARK_ALL_NOTIFICATIONS_READ,
  MARK_NOTIFICATION_READ,
} from "../graphql/actions/notifications.action";

type NotificationItem = {
  id: string;
  title: string;
  body?: string | null;
  actorName?: string | null;
  isRead: boolean;
  createdAt: string;
  targetType: string;
  targetId: string;
};

const formatWhen = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

// mapping minimal (nanti bisa kamu refine)
const buildTargetUrl = (n: NotificationItem) => {
  switch (String(n.targetType)) {
    case "SUBMIT_SPJ": return "/spj";
    case "JOB_LETTER": return "/jobletter";
    case "CONTENT_ISSUE": return "/issue";
    case "SUBSURVEY_ACTIVITY": return "/subsurvey";
    default: return "/";
  }
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);

  const { data: countData, refetch: refetchCount } = useQuery(GET_MY_UNREAD_NOTIFICATION_COUNT, {
    fetchPolicy: "cache-and-network",
    pollInterval: 30000,
  });

  const { data: listData, refetch: refetchList } = useQuery(GET_MY_NOTIFICATIONS, {
    variables: { take: 10 },
    fetchPolicy: "cache-and-network",
    pollInterval: 30000,
  });

  const [markRead] = useMutation(MARK_NOTIFICATION_READ);
  const [markAllRead, { loading: markingAll }] = useMutation(MARK_ALL_NOTIFICATIONS_READ);

  const unread = countData?.myUnreadNotificationCount?.count ?? 0;
  const items: NotificationItem[] = listData?.myNotifications?.items?.slice?.() ?? [];
  const hasAny = items.length > 0;

  const headerText = useMemo(() => {
    if (!hasAny) return "Belum ada notifikasi";
    if (unread > 0) return `${unread} notifikasi belum dibaca`;
    return "Semua notifikasi sudah dibaca";
  }, [hasAny, unread]);

  const onOpenChange = async (v: boolean) => {
    setOpen(v);
    if (v) await Promise.allSettled([refetchCount(), refetchList()]);
  };

  const handleItemClick = async (n: NotificationItem) => {
    try {
      if (!n.isRead) {
        await markRead({ variables: { notificationId: n.id } });
        await Promise.allSettled([refetchCount(), refetchList()]);
      }
      setOpen(false);
      window.location.href = buildTargetUrl(n);
    } catch (e: any) {
      toast.error(e?.message || "Gagal memproses notifikasi");
    }
  };

  const handleMarkAll = async () => {
    try {
      const res = await markAllRead();
      const changed = res?.data?.markAllNotificationsRead ?? 0;
      toast.success(`Menandai ${changed} notifikasi sebagai dibaca`);
      await Promise.allSettled([refetchCount(), refetchList()]);
    } catch (e: any) {
      toast.error(e?.message || "Gagal menandai semua dibaca");
    }
  };

  return (
    <Dropdown placement="bottom-end" offset={8} isOpen={open} onOpenChange={onOpenChange}>
      <DropdownTrigger>
        <button
          aria-label="Notifikasi"
          title="Notifikasi"
          className="relative inline-flex items-center justify-center rounded-md w-9 h-9 bg-orange-600/70 hover:bg-orange-600 text-white focus:outline-non"
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] leading-[18px] text-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </DropdownTrigger>

      <DropdownMenu
        aria-label="Notifikasi"
        className="border rounded-lg bg-white shadow-md text-black max-h-[70vh] overflow-auto w-[calc(100vw-2rem)] sm:w-96"
        itemClasses={{ base: "py-2" }}
      >
        <DropdownItem key="header" className="h-auto gap-1" isReadOnly>
          <p className="font-semibold">Notifikasi</p>
          <p className="text-xs text-gray-500">{headerText}</p>
          {hasAny && unread > 0 ? (
            <button
              onClick={handleMarkAll}
              disabled={markingAll}
              className="mt-2 text-xs text-orange-600 hover:underline disabled:opacity-50"
              type="button"
            >
              Tandai semua dibaca
            </button>
          ) : null}
        </DropdownItem>

        {!hasAny ? (
          <DropdownItem key="empty" isReadOnly>
            <p className="text-sm text-gray-600">Belum ada notifikasi.</p>
          </DropdownItem>
        ) : null}
        <>
          {items.map((n) => (
            <DropdownItem
              key={n.id}
              onClick={() => handleItemClick(n)}
              className={n.isRead ? "opacity-90" : "bg-orange-50"}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm ${n.isRead ? "font-medium" : "font-semibold"}`}>
                    {n.title}
                  </p>
                  <span className="text-[10px] text-gray-500 whitespace-nowrap">
                    {formatWhen(n.createdAt)}
                  </span>
                </div>
                {(n.actorName || n.body) ? (
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {n.actorName ? `${n.actorName}: ` : ""}
                    {n.body || ""}
                  </p>
                ) : null}
              </div>
            </DropdownItem>
          ))}
        </>
      </DropdownMenu>
    </Dropdown>
  );
}
