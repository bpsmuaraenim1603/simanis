import { useEffect, useRef, useState } from "react";
import ProfileDropDown from "../ProfileDropDown";
import { SideBar } from "./SideBar";
import Calendar from "./Calendar";
import useUser from "@/src/hooks/useUser";

export const Header = () => {
  const { user } = useUser();

  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 h-[60px] bg-orange-500 flex items-center justify-end z-30 pl-[250px]">
      <div
        className="w-[90%] m-auto flex items-center justify-end gap-3"
        ref={boxRef}
      >
        <ProfileDropDown />
        <SideBar />
        {(user?.role === "Admin" || user?.role === "Superadmin")  && <Calendar />}
      </div>
    </header>
  );
};

export default Header;

//#0F1524