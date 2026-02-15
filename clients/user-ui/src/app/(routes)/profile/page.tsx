"use client";

import useUser from "@/src/hooks/useUser";
import { useApolloClient, useMutation } from "@apollo/client";
import { useSession } from "next-auth/react";
import { UPDATE_PROFILE } from "@/src/graphql/actions/update-user.action";
import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import styles from "@/src/utils/style";
import { getRoles } from "@/src/utils/roles";

function Profile() {
  const { user } = useUser();
  const { data } = useSession();
  const [updateProfile, { loading }] = useMutation(UPDATE_PROFILE);
  const roles = useMemo(() => getRoles(user), [user]);
  const primaryRole = user?.primaryRole ?? roles[0] ?? user?.role ?? "-";
  const [formState, setFormState] = React.useState({
    name: user?.name || "",
    email: user?.email || "",
    phone_number: user?.phone_number || "",
    address: user?.address || "",
    job_name: user?.job_name || "",
    nip: user?.nip || "",
    district_name: user?.district?.name || "",
    village_name: user?.village?.name || "",
  });

  useEffect(() => {
    if (user) {
      setFormState({
        name: user.name || "",
        email: user.email || "",
        phone_number: user.phone_number || "",
        address: user.address || "",
        job_name: user.job_name || "",
        nip: user.nip || "",
        district_name: user.district?.name || "",
        village_name: user.village?.name || "",
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const input = { ...formState };
      const { data } = await updateProfile({ variables: { input } });
      console.log("✅ Profil diperbarui:", data);
      toast.success("Profil berhasil diperbarui!");
    } catch (err) {
      console.error("❌ Gagal update:", err);
      toast.error("Gagal memperbarui profil.");
    }
  };

  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-6 md:px-8 py-4 space-y-4 font-Poppins">
      {/* Header */}
      <div className="bg-orange-50 rounded-lg p-3 md:p-4 font-bold text-lg md:text-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-md">
        <span>Profil Diri</span>
      </div>

      {/* Card profil ringkas */}
      <div className="bg-orange-50 rounded-lg p-4 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
          <img
            src={
              data?.user ? (data.user.image as string) : (user?.image as string)
            }
            alt="Profile"
            className="w-20 h-20 sm:w-16 sm:h-16 rounded-full object-cover"
          />
          <div className="text-center sm:text-left">
            <h2 className="text-lg font-semibold truncate max-w-[80vw]">
              {data?.user ? data.user.name : user?.name}
            </h2>
            <p className="text-sm text-gray-600 truncate max-w-[80vw]">
              {data?.user ? data.user.email : user?.email}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <p>
            <strong>Nomor Telepon:</strong> {user?.phone_number || "-"}
          </p>
          <p>
            <strong>Alamat:</strong> {user?.address || "-"}
          </p>
          <p>
            <strong>NIP:</strong> {user?.nip || "-"}
          </p>
          <p>
            <strong>Kecamatan:</strong> {user?.district?.name || "-"}
          </p>
          <p>
            <strong>Desa:</strong> {user?.village?.name || "-"}
          </p>
          <p>
            <strong>Pekerjaan:</strong> {user?.job_name || "-"}
          </p>
          <p>
            <strong>Role Utama:</strong> {primaryRole}
            {roles.length > 1 && (
              <span className="text-gray-600">
                {" "}
                (Roles: {roles.join(", ")})
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Form update profil */}
      <div className="bg-orange-50 rounded-lg p-4 shadow-md">
        <div className="text-base md:text-lg font-bold mb-3">
          Perbarui profil diri
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1" htmlFor="name">
              Nama
            </label>
            <input
              id="name"
              type="text"
              value={formState.name}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={formState.email}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, email: e.target.value }))
              }
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1" htmlFor="phone">
              Nomor Telepon
            </label>
            <input
              id="phone"
              type="tel"
              value={formState.phone_number}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  phone_number: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1" htmlFor="address">
              Alamat
            </label>
            <input
              id="address"
              type="text"
              value={formState.address}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, address: e.target.value }))
              }
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1" htmlFor="job_name">
              Nama Pekerjaan
            </label>
            <input
              id="job_name"
              type="text"
              value={formState.job_name}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, job_name: e.target.value }))
              }
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1" htmlFor="village_name">
              Nama Desa
            </label>
            <input
              id="village_name"
              type="text"
              value={formState.village_name}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, village_name: e.target.value }))
              }
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <button
            disabled={loading}
            type="submit"
            className={`${styles.button} my-2 text-white w-full sm:w-auto`}
          >
            {loading ? "Menyimpan..." : "Perbarui"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Profile;
