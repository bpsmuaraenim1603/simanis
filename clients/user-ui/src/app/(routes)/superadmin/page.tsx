"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { motion, AnimatePresence } from "framer-motion";
import { GET_ALL_USERS } from "@/src/graphql/actions/find-allusers.action";
import { UPDATE_ROLE } from "@/src/graphql/actions/update-role.action";
import HUSelect from "@/src/components/HUSelect";

const ROLE_OPTIONS = [
  { label: "Super Admin", value: "Superadmin" },
  { label: "Admin", value: "Admin" },
  { label: "Supervisor", value: "Supervisor" },
  { label: "User", value: "User" },
] as const;

const ROLE_OPTIONS_FOR_SELECT = ROLE_OPTIONS.map((r) => ({
  value: r.value,
  label: r.label,
}));

const pretty = (s?: string | null) =>
  (s ?? "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.1 }}
    >
      {children}
    </motion.div>
  );
}

export default function SuperAdminManagePage() {
  const { data, loading, error, refetch } = useQuery(GET_ALL_USERS, {
    fetchPolicy: "cache-and-network",
  });
  const users = data?.getUsers ?? [];
  const [searchTerm, setSearchTerm] = useState("");
  const [pending, setPending] = useState<Record<string, string>>({});
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [updateRole] = useMutation(UPDATE_ROLE);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u: any) =>
      [u.name, u.email, u.role]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(q))
    );
  }, [users, searchTerm]);

  const handleChange = useCallback((userId: string, newRole: string) => {
    setPending((p) =>
      p[userId] === newRole ? p : { ...p, [userId]: newRole }
    );
  }, []);

  const handleReset = useCallback((userId: string) => {
    setPending((p) => {
      const { [userId]: _, ...rest } = p;
      return rest;
    });
  }, []);

  const handleSave = useCallback(
    async (user: any) => {
      const newRole = pending[user.id];
      if (!newRole || newRole === user.role) return;
      try {
        setUpdating((u) => ({ ...u, [user.id]: true }));
        await updateRole({
          variables: {
            userId: user.id,
            updateRole: { name: user.name, role: newRole },
          },
        });
        setPending((p) => {
          const { [user.id]: _, ...rest } = p;
          return rest;
        });
      } catch (e) {
        console.error(e);
        alert("Gagal memperbarui role. Coba lagi.");
      } finally {
        setUpdating((u) => ({ ...u, [user.id]: false }));
        refetch();
      }
    },
    [pending, refetch, updateRole]
  );

  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-6 md:px-8 py-4 space-y-4 font-Poppins">
      {/* Header */}
      <div className="bg-orange-50 rounded-lg p-3 md:p-4 font-bold text-lg md:text-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-md">
        <span>Kelola Role Pengguna</span>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition font-semibold w-full sm:w-auto"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Toolbar pencarian (dipisah dari thead supaya aman di mobile) */}
      <div className="bg-white rounded-lg p-3 shadow flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <label className="text-sm font-medium">Cari pengguna</label>
        <input
          type="text"
          placeholder="Nama / email / role…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border focus:outline-none border-gray-300 bg-white rounded-md px-3 py-2 text-sm w-full sm:max-w-sm"
        />
      </div>

      {/* Tabel responsif */}
      <div className="relative shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-sm text-left text-gray-600">
            <thead className="text-gray-700 bg-gray-200">
              <tr>
                <th className="px-4 md:px-6 py-3 uppercase text-xs md:text-sm">
                  Nama
                </th>
                <th className="px-4 md:px-6 py-3 uppercase text-xs md:text-sm">
                  Email
                </th>
                <th className="px-4 md:px-6 py-3 uppercase text-xs md:text-sm">
                  Role
                </th>
                <th className="px-4 md:px-6 py-3 uppercase text-xs md:text-sm text-right">
                  Aksi
                </th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center">
                    Memuat pengguna…
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-4 text-center text-red-600"
                  >
                    Terjadi kesalahan memuat data
                  </td>
                </tr>
              )}
              {!loading && !error && filteredUsers.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-6 text-center text-gray-500"
                  >
                    Tidak ada pengguna yang cocok dengan kata kunci "
                    {searchTerm}"
                  </td>
                </tr>
              )}

              <AnimatePresence>
                {filteredUsers.map((user: any) => {
                  const pendingRole = pending[user.id];
                  const effectiveRole = pendingRole ?? user.role;
                  const dirty = !!pendingRole && pendingRole !== user.role;
                  const isSaving = !!updating[user.id];

                  return (
                    <tr
                      key={user.id}
                      className="bg-white border-t border-gray-200 align-top"
                    >
                      <td className="px-4 md:px-6 py-3 font-medium text-gray-900 break-words">
                        <Cell>{user.name}</Cell>
                      </td>
                      <td className="px-4 md:px-6 py-3 break-words">
                        <Cell>{user.email}</Cell>
                      </td>
                      <td className="px-4 md:px-6 py-3 align-middle">
                        <HUSelect
                          value={(effectiveRole ?? "") || null}
                          onValueChange={(v) => handleChange(user.id, v ?? "")}
                          options={ROLE_OPTIONS_FOR_SELECT}
                          placeholder="-- Pilih Role --"
                          className="text-sm [&_*]:text-sm" // opsional: biar tidak terlalu sempit
                        />
                      </td>
                      <td className="px-4 md:px-6 py-3">
                        <div className="flex flex-col sm:flex-row justify-end gap-2">
                          <button
                            onClick={() => handleSave(user)}
                            disabled={!dirty || isSaving}
                            className={`rounded-lg px-3 py-2 text-sm font-medium text-white shadow-sm transition ${
                              !dirty || isSaving
                                ? "cursor-not-allowed bg-gray-300"
                                : "bg-blue-600 hover:bg-blue-700"
                            }`}
                            title={
                              !dirty
                                ? "Tidak ada perubahan"
                                : "Simpan perubahan"
                            }
                          >
                            {isSaving ? "Menyimpan…" : "Simpan"}
                          </button>
                          <button
                            onClick={() => handleReset(user.id)}
                            disabled={!dirty || isSaving}
                            className={`rounded-lg px-3 py-2 text-sm font-medium shadow-sm transition ${
                              !dirty || isSaving
                                ? "cursor-not-allowed bg-gray-100 text-gray-400"
                                : "bg-white text-gray-700 hover:bg-gray-50"
                            }`}
                            title="Batalkan perubahan"
                          >
                            Reset
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
