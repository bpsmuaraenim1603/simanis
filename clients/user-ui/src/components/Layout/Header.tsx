"use client";
import { useEffect, useRef, useState } from "react";
import ProfileDropDown from "../ProfileDropDown";
import { SideBar } from "./SideBar";
import Calendar from "./Calendar";
import useUser from "@/src/hooks/useUser";
import { AlignJustify } from "lucide-react";
import NotificationBell from "../NotifcationBell";

export const Header = () => {
  const { user } = useUser();
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);

  useEffect(() => {
    const onToggle = (e: Event) => {
      const detail = (e as CustomEvent<any>).detail;
      if (typeof detail === "object" && detail && typeof detail.minimized === "boolean") {
        setIsSidebarMinimized(detail.minimized);
      } else if (typeof detail === "boolean") {
        setIsSidebarMinimized(detail);
      }
    };
    window.addEventListener("sidebar-toggle", onToggle as EventListener);
    return () => window.removeEventListener("sidebar-toggle", onToggle as EventListener);
  }, []);

  const boxRef = useRef<HTMLDivElement>(null);

  const handleBurger = () => {
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    if (isDesktop) {
      const curr = sessionStorage.getItem("isMinimized") === "true";
      const next = !curr;
      sessionStorage.setItem("isMinimized", String(next));
      window.dispatchEvent(new CustomEvent("sidebar-toggle", { detail: { minimized: next } }));
    } else {
      sessionStorage.setItem("isMinimized", "false");
      window.dispatchEvent(new CustomEvent("sidebar-toggle", { detail: { minimized: false } }));
    }
  };

  return (
    <>
      <header
        className={[
          "fixed top-0 left-0 right-0 h-14 lg:h-[60px] bg-orange-500 z-40",
          "pl-0",
          isSidebarMinimized ? "lg:pl-[60px]" : "lg:pl-[250px]",
        ].join(" ")}
      >
        <div
          ref={boxRef}
          className="w-full max-w-screen-xl mx-auto h-full flex items-center justify-between px-3 lg:px-4"
        >
          {/* Burger mobile */}
          <button
            className="lg:hidden inline-flex items-center justify-center rounded-md w-9 h-9 bg-orange-600/70 hover:bg-orange-600 text-white"
            onClick={handleBurger}
            aria-label="Buka menu"
            title="Menu"
          >
            <AlignJustify size={18} />
          </button>

          <div className="flex items-center gap-2 lg:gap-3 ml-auto">
            <NotificationBell />
            <ProfileDropDown />
            {(user?.role === "Admin" || user?.role === "Superadmin") && <Calendar />}
          </div>
        </div>
      </header>

      {/* Render SideBar sebagai saudara <header>, bukan di dalam row kanan */}
      <SideBar />
    </>
  );
};

export default Header;
