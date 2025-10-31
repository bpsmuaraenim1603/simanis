"use client";

import Link from "next/link";
import {
  ChartNoAxesCombined, ChevronDown, ChevronRight, Contact,
  FileText, House, LucideIcon, TriangleAlert, User, Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { GET_ALL_SURVEY_ACTIVITIES } from "@/src/graphql/actions/find-allsurveyact.action";
import { useQuery } from "@apollo/client";
import useUser from "../hooks/useUser";

const NavItems = ({ isMinimized = false }: { isMinimized?: boolean }) => {
  const { user } = useUser();
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [activeSubItem, setActiveSubItem] = useState<string | null>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; }>({ top: 0, left: 0 });

  const pathname = usePathname();
  const { data } = useQuery(GET_ALL_SURVEY_ACTIVITIES);

  const dynamiSurveyProgress = data?.allSurveyActivities?.map(
    (item: { name: any; slug: any }) => ({ title: item.name, url: `/progress/${item.slug}` })
  );

  const navItems: {
    title: string; url: string; style?: string; hovertitle?: string; unhover?: boolean;
    dataprogress?: { title: string; url: string }[]; logo?: LucideIcon;
  }[] = [
    { title: "Beranda", hovertitle: "Beranda", url: "/dashboard", style: "border-b-2 border-t-2 border-white py-2", logo: House },
    ...(user?.role === "Superadmin" || user?.role === "Keuangan" ? [{ title: "Kontrol Pengguna", hovertitle: "Kontrol Pengguna", url: "/superadmin", logo: User, style: "border-b-2 border-white pb-2" }] : []),
    ...(user?.role === "Admin" || user?.role === "Superadmin" ? [{ title: "Manajemen Tim", hovertitle: "Manajemen Tim", url: "/admin", logo: User, style: "border-b-2 border-white pb-2" }] : []),
    ...(user?.role === "Supervisor" || user?.role === "Superadmin" || user?.role === "Admin" ? [{ title: "Pengawas", hovertitle: "Pengawas", url: "/supervisor", logo: User, style: "border-b-2 border-white pb-2" }] : []),
    ...(user?.role === "User" || user?.role === "Superadmin" ? [{ title: "Petugas", hovertitle: "Petugas", url: "/user", logo: User, style: "border-b-2 border-white pb-2" }] : []),
    { title: "KEGIATAN LAPANGAN", url: "#kegiatanlapangan", unhover: true },
    { title: "Progres", url: "/progress", hovertitle: "Progres", logo: ChartNoAxesCombined, dataprogress: dynamiSurveyProgress },
    { title: "Kendala", url: "/issue", hovertitle: "Kendala", style: "border-b-2 border-white pb-2", logo: TriangleAlert,
      dataprogress: [{ title: "Pelaporan", url: "/issue/pelaporan" }, { title: "Feedback", url: "/issue/feedback" }], },
    { title: "ADMINISTRASI", url: "#administrasi", unhover: true },
    { title: "ST Petugas", url: "/partners", hovertitle: "ST Petugas", logo: Users },
    { title: "Pengajuan Honor", url: "/spj", hovertitle: "Pengajuan Honor", logo: FileText },
    { title: "Tentang Kami", url: "/about", hovertitle: "Tentang Kami", logo: Contact },
  ];

  const toggleDropdown = (index: number) => setOpenDropdown(openDropdown === index ? null : index);

  useEffect(() => { if (isMinimized) setOpenDropdown(null); }, [isMinimized]);

  return (
    <div className="h-screen overflow-y-auto pb-6">
      <div className="flex flex-col space-y-2">
        {navItems.map((item, index) => {
          const isActive = pathname === item.url || pathname.startsWith(item.url);
          return (
            <div key={item.url} className={`${!isMinimized && item.style}`}>
              {item.dataprogress ? (
                <button
                  onClick={(e) => {
                    toggleDropdown(index);
                    if (buttonRefs.current[index]) {
                      const rect = buttonRefs.current[index]!.getBoundingClientRect();
                      setDropdownPosition({ top: rect.top + window.scrollY - 5, left: rect.left + window.scrollX });
                    }
                  }}
                  ref={(el) => { buttonRefs.current[index] = el; }}
                  className={`w-full text-left px-5 text-sm md:text-[15px] font-Poppins font-[500] flex items-center justify-between py-2 hover:font-semibold ${isActive && "bg-[#ffffff2a] font-bold"}`}
                >
                  {isMinimized ? (
                    <div className="items-center" title={item.hovertitle}>
                      {item.logo && (<item.logo size={20} className="text-white" />)}
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      {item.logo && (<item.logo size={20} className="text-white" />)}{" "}
                      <span className="mt-1 text-white">{item.title}</span>
                    </div>
                  )}
                  {!isMinimized && (openDropdown === index ? (
                    <ChevronDown size={16} className="mt-1 text-white" />
                  ) : (
                    <ChevronRight size={16} className="mt-1 text-white" />
                  ))}
                </button>
              ) : (
                <Link
                  href={item.url}
                  onClick={() => { setActiveSubItem(null); setOpenDropdown(null); }}
                  className={`px-5 text-sm md:text-[15px] font-Poppins font-[500] block ${!item.unhover ? "hover:font-semibold py-2" : "font-bold cursor-default"} ${isActive && "bg-[#ffffff2a] font-bold"}`}
                >
                  {isMinimized ? (
                    <div className="items-center" title={item.hovertitle}>
                      {item.logo && (<item.logo size={20} className="text-white" />)}
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      {item.logo && (<item.logo size={20} className="text-white" />)}{" "}
                      <span className="mt-1 text-white">{item.title}</span>
                    </div>
                  )}
                </Link>
              )}

              <AnimatePresence>
                {!isMinimized && item.dataprogress && openDropdown === index && (
                  <motion.div
                    className="ml-6 mt-1 space-y-1"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    {item.dataprogress.map((sub) => (
                      <Link
                        key={sub.url}
                        href={sub.url}
                        className={`block text-xs md:text-sm px-2 py-1 hover:font-semibold text-white ${activeSubItem === sub.url && "font-bold"}`}
                        onClick={() => setActiveSubItem(sub.url)}
                      >
                        {activeSubItem === sub.url ? ">" : "•"} {sub.title}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* minimized flyout (desktop only) */}
        {isMinimized && openDropdown !== null && navItems[openDropdown].dataprogress && (
          <AnimatePresence>
            <div
              onMouseLeave={() => setOpenDropdown(null)}
              className="absolute bg-orange-800 p-2 w-[180px] ml-[65px] rounded-md shadow-lg z-50 hidden sm:block"
              style={{ top: dropdownPosition.top, left: dropdownPosition.left, position: "absolute" }}
            >
              <motion.div
                className="space-y-1"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                {navItems[openDropdown].dataprogress.map((sub) => (
                  <Link
                    key={sub.url}
                    href={sub.url}
                    className={`block text-xs md:text-sm px-2 py-1 hover:font-semibold text-white ${activeSubItem === sub.url && "font-bold"}`}
                    onClick={() => setActiveSubItem(sub.url)}
                  >
                    {activeSubItem === sub.url ? ">" : "•"} {sub.title}
                  </Link>
                ))}
              </motion.div>
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default NavItems;
