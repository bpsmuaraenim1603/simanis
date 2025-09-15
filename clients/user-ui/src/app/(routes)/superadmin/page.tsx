"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { motion, AnimatePresence } from "framer-motion";
import { GET_ALL_USERS } from "@/src/graphql/actions/find-allusers.action";
import { UPDATE_ROLE } from "@/src/graphql/actions/update-role.action";

/**
 * ===== Utilities & constants (no re-creation on each render) =====
 */
const ROLE_OPTIONS = [{label: "Super Admin", value: "Superadmin"}, {label: "Admin", value: "Admin"}, {label: "Supervisor", value: "Supervisor"}, {label: "User", value: "User"}] as const;
const pretty = (s?: string | null) =>
  (s ?? "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Small, reusable cell wrapper with motion — avoids repeating the same motion props
 */
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

/**
 * ===== Main Page =====
 */
export default function SuperAdminManagePage() {
  const { data, loading, error, refetch } = useQuery(GET_ALL_USERS, {
    fetchPolicy: "cache-and-network",
  });

  // Single source of truth for users
  const users = data?.getUsers ?? [];

  // Local UI states
  const [searchTerm, setSearchTerm] = useState("");
  const [pending, setPending] = useState<Record<string, string>>({});
  const [updating, setUpdating] = useState<Record<string, boolean>>({});

  const [updateRole] = useMutation(UPDATE_ROLE);

  // Derived: filtered users (memoized)
  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u: any) =>
      [u.name, u.email, u.role]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(q))
    );
  }, [users, searchTerm]);

  // Handlers (memoized to avoid re-creation)
  const handleChange = useCallback((userId: string, newRole: string) => {
    setPending((p) => (p[userId] === newRole ? p : { ...p, [userId]: newRole }));
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
          variables: { userId: user.id, updateRole: { name: user.name, role: newRole } },
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
    <div className="px-8 py-4 space-y-4 font-Poppins">
      {/* Header */}
      <div className="bg-orange-50 rounded-lg p-2 font-bold text-xl flex justify-between shadow-md">
        Kelola Role Pengguna
        <button
          onClick={() => refetch()}
          className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm hover:bg-blue-700 transition font-semibold"
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="relative shadow-md">
        <table className="table-fixed w-full text-sm text-left text-gray-500">
          <thead className="text-gray-700 bg-gray-200 block w-full sm:rounded-t-lg">
            <tr className="table w-full table-fixed">
              <th className="px-6 py-3 uppercase">Nama</th>
              <th className="px-6 py-3 uppercase">Email</th>
              <th className="px-6 py-3 uppercase">Role</th>
              <th className="px-6 py-3">
                <div className="flex items-center">
                  <input
                    type="text"
                    placeholder="Cari pengguna… (nama/email/role)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border focus:outline-none border-gray-300 bg-white rounded-md px-3 py-1 text-sm font-thin w-full"
                  />
                </div>
              </th>
            </tr>
          </thead>

          <tbody className="block max-h-96 overflow-y-auto w-full">
            {loading && (
              <tr className="table w-full">
                <td colSpan={5} className="px-6 py-3 text-center">
                  Memuat pengguna…
                </td>
              </tr>
            )}
            {error && (
              <tr className="table w-full">
                <td colSpan={5} className="px-6 py-3 text-center text-red-600">
                  Terjadi kesalahan memuat data
                </td>
              </tr>
            )}
            {!loading && !error && filteredUsers.length === 0 && (
              <tr className="table w-full">
                <td colSpan={5} className="px-6 py-6 text-center text-gray-500">
                  Tidak ada pengguna yang cocok dengan kata kunci "{searchTerm}"
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
                    className="bg-white border-b border-gray-200 table w-full table-fixed"
                  >
                    <td className="px-6 py-2 font-medium text-gray-900">
                      <Cell>{user.name}</Cell>
                    </td>
                    <td className="px-6 py-2">
                      <Cell>{user.email}</Cell>
                    </td>
                    <td className="px-6 py-2">
                      <select
                        className="w-full rounded-lg border px-3 py-2 text-sm outline-none bg-white"
                        value={effectiveRole ?? ""}
                        onChange={(e) => handleChange(user.id, e.target.value)}
                      >
                        <option value="" disabled>
                          -- Pilih Role --
                        </option>
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.label} value={r.value}>
                            {pretty(r.label)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-2 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => handleSave(user)}
                          disabled={!dirty || isSaving}
                          className={`rounded-lg px-3 py-2 text-sm font-medium text-white shadow-sm transition ${
                            !dirty || isSaving
                              ? "cursor-not-allowed bg-gray-300"
                              : "bg-blue-600 hover:bg-blue-700"
                          }`}
                          title={!dirty ? "Tidak ada perubahan" : "Simpan perubahan"}
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
  );
}
