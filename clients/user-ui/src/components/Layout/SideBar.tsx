"use client";

import React, { useEffect, useState } from "react";
import NavItems from "../NavItems"; // <-- path diperbaiki
import { AlignJustify, X } from "lucide-react";

export const SideBar = () => {
  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("isMinimized") === "true";
  });
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mql.matches);
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent<any>).detail;
      if (typeof d === "object" && d && typeof d.minimized === "boolean") {
        setIsMinimized(d.minimized);
      } else if (typeof d === "boolean") {
        setIsMinimized(d);
      }
    };
    window.addEventListener("sidebar-toggle", handler as EventListener);
    return () =>
      window.removeEventListener("sidebar-toggle", handler as EventListener);
  }, []);

  const broadcast = (val: boolean) => {
    sessionStorage.setItem("isMinimized", String(val));
    // DEFER dispatch supaya tidak sinkron dengan render komponen lain
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("sidebar-toggle", { detail: { minimized: val } })
      );
    }, 0);
  };

  const closeMobile = () => {
    if (!isDesktop) {
      setIsMinimized(true);
      broadcast(true);
    }
  };

  const toggleDesktop = () => {
    if (isDesktop) {
      const next = !isMinimized;
      setIsMinimized(next);
      broadcast(next);
    }
  };

  const asideClass = [
    "fixed top-0 left-0 bottom-0 z-50 bg-orange-900 text-white shadow-lg",
    "transition-[transform,width] duration-300 ease-in-out",
    "overflow-hidden",
    "w-[250px]",
    // MOBILE: minimized => off-screen & non-interaktif; open => overlay & interaktif
    isMinimized
      ? "-translate-x-full pointer-events-none"
      : "translate-x-0 pointer-events-auto",
    // DESKTOP: selalu terlihat & interaktif; lebar 60/250 sesuai minimized
    "lg:translate-x-0",
    "lg:pointer-events-auto",
    isMinimized ? "lg:w-[60px]" : "lg:w-[250px]",
  ].join(" ");

  return (
    <aside className={asideClass} aria-label="Sidebar">
      {/* Bar atas mobile */}
      <div className="lg:hidden flex items-center justify-between h-14 px-3 border-b border-white/10">
        <span className="font-semibold font-Poppins">SIMANIS</span>
        <button
          onClick={closeMobile}
          aria-label="Tutup sidebar"
          className="p-2 rounded hover:bg-white/10"
        >
          <X size={18} />
        </button>
      </div>

      {/* Bar atas desktop (toggle 60/250) */}
      <div className={`hidden lg:flex items-center ${isMinimized ? "justify-center" : "justify-between"} h-14 px-3 border-b border-white/10`}>
        <span className="font-semibold">{isMinimized ? "" : "SIMANIS"}</span>
        <button
          onClick={toggleDesktop}
          title={isMinimized ? "Perbesar" : "Kecilkan"}
          className="p-2 rounded hover:bg-white/10"
        >
          <AlignJustify size={18} />
        </button>
      </div>

      {/* Nav items; klik item di mobile otomatis menutup overlay */}
      <nav
        className="justify-center h-[calc(100vh-56px)]"
      >
        <NavItems isMinimized={isDesktop ? isMinimized : false} />
      </nav>
    </aside>
  );
};
