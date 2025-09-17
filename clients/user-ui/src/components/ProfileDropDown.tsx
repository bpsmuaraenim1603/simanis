"use client";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/react";
import { Avatar } from "@heroui/avatar";
import { useEffect, useMemo, useState } from "react";
import useUser from "../hooks/useUser";
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import { signOut, useSession } from "next-auth/react";

const initialsFrom = (name?: string) =>
  name?.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase() ?? "U";

const ProfileDropDown = () => {
  const [signedIn, setSignedIn] = useState(false);
  const [open, setOpen] = useState(false);
  const { user, loading } = useUser();
  const { data } = useSession();

  const displayUser = data?.user ?? user;
  const avatarSrc = displayUser?.image || undefined;
  const avatarInitials = useMemo(() => initialsFrom(displayUser?.name), [displayUser?.name]);

  useEffect(() => {
    if (!loading) setSignedIn(!!user || !!data?.user);
    if (data?.user) addUser(data.user);
  }, [loading, user, data]);

  const handleLogOut = async () => {
    try {
      if (data?.user) await signOut();
      Cookies.remove("access_token");
      Cookies.remove("refresh_token");
      toast.success("Logout Berhasil!");
      window.location.href = "/";
    } catch {
      toast.error("Gagal logout. Coba lagi.");
    }
  };

  const addUser = async (u: any) => {
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        body: JSON.stringify({ name: u.name, email: u.email, image: u.image }),
        headers: { "Content-Type": "application/json" },
      });
      await res.json();
    } catch {
      // silent
    }
  };

  const openProfile = () => {
    window.location.href = "/profile";
  };

  if (!signedIn) return null;

  return (
    <div className="flex items-center">
      <Dropdown placement="bottom-end" offset={8} isOpen={open} onOpenChange={setOpen}>
        <DropdownTrigger>
          <button
            aria-label="Buka menu profil"
            title="Profil"
            className="inline-flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-white/70"
          >
            <Avatar
              as="div"
              className="transition-transform text-white w-9 h-9 sm:w-10 sm:h-10"
              src={avatarSrc}
              name={avatarInitials}
              radius="full"
            />
          </button>
        </DropdownTrigger>

        <DropdownMenu
          aria-label="Aksi Profil"
          className="border rounded-lg bg-white shadow-md text-black max-h-[70vh] overflow-auto w-[calc(100vw-2rem)] sm:w-64"
          itemClasses={{ base: "py-2" }}
        >
          <DropdownItem key="profile" className="h-auto gap-2">
            <p className="text-xs text-gray-500">Nama Petugas</p>
            <p className="font-semibold truncate max-w-[70vw] sm:max-w-[14rem]">
              {displayUser?.name ?? "Pengguna"}
            </p>
            {displayUser?.email && (
              <p className="text-xs text-gray-500 truncate max-w-[70vw] sm:max-w-[14rem]">
                {displayUser.email}
              </p>
            )}
          </DropdownItem>

          <DropdownItem key="profile-settings" onClick={openProfile}>
            Profil Saya
          </DropdownItem>

          <DropdownItem key="notifications">Notifikasi</DropdownItem>

          <DropdownItem
            key="logout"
            color="danger"
            className="text-red-600"
            onClick={handleLogOut}
          >
            Log Out
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </div>
  );
};

export default ProfileDropDown;
