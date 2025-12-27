"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import Header from "@/src/components/Layout/Header";
import useUser from "@/src/hooks/useUser";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import "leaflet/dist/leaflet.css";

type SidebarEventDetail =
  | boolean
  | { minimized?: boolean; drawerOpen?: boolean };

export default function RouteLayout({ children }: { children: ReactNode }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mql.matches);
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem("isMinimized");
    if (saved != null) setIsMinimized(saved === "true");

    const defer = (fn: () => void) => {
      if (typeof queueMicrotask === "function") queueMicrotask(fn);
      else setTimeout(fn, 0);
    };

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<SidebarEventDetail>).detail;

      if (typeof detail === "object" && detail) {
        if (typeof detail.minimized === "boolean") {
          const next = detail.minimized;
          defer(() => setIsMinimized(next));
          sessionStorage.setItem("isMinimized", String(next));
        }
        if (typeof detail.drawerOpen === "boolean") {
          const next = !detail.drawerOpen;
          defer(() => setIsMinimized(next));
          sessionStorage.setItem("isMinimized", String(next));
        }
      } else if (typeof detail === "boolean") {
        const next = detail;
        defer(() => setIsMinimized(next));
        sessionStorage.setItem("isMinimized", String(next));
      }
    };

    window.addEventListener("sidebar-toggle", handler as EventListener);
    return () =>
      window.removeEventListener("sidebar-toggle", handler as EventListener);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      toast.error("Silakan login terlebih dahulu!");
      router.replace("/");
    }
  }, [user, loading, router]);

  const overlayOpen = useMemo(
    () => !isDesktop && !isMinimized,
    [isDesktop, isMinimized]
  );

  useEffect(() => {
    if (overlayOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [overlayOpen]);

  if (loading || !user) return null;

  return (
    <>
      <Header />

      {/* Backdrop tunggal (tap 1x untuk tutup) */}
      {overlayOpen && (
        <button
          aria-label="Tutup sidebar"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => {
            sessionStorage.setItem("isMinimized", "true");
            setIsMinimized(true);
            window.dispatchEvent(
              new CustomEvent("sidebar-toggle", { detail: { minimized: true } })
            );
          }}
        />
      )}

      <main
        className={[
          "pt-[60px] min-h-dvh w-full",
          "pl-0",
          isMinimized ? "lg:pl-[60px]" : "lg:pl-[250px]",
          "transition-[padding-left] duration-300 ease-in-out relative z-20",
        ].join(" ")}
      >
        {children}
      </main>
    </>
  );
}
