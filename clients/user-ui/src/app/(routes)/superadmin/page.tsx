"use client";

import React, { useMemo, useState, useCallback } from "react";
import { useQuery, useMutation, useLazyQuery } from "@apollo/client";
import toast from "react-hot-toast";
import { GET_ALL_USERS } from "@/src/graphql/actions/find-allusers.action";
import { UPDATE_ROLE } from "@/src/graphql/actions/update-role.action";
import { UPDATE_BILL_LIMIT } from "@/src/graphql/actions/update-limitbill.action";
import { GET_USER_PROGRESS_BY_USER_ID } from "@/src/graphql/actions/find-usersurveyprogressbyuser.action";
import useUser from "@/src/hooks/useUser";
import { useRouter } from "next/navigation";

const ROLE_OPTIONS = [
  { label: "Super Admin", value: "Superadmin" },
  { label: "Admin", value: "Admin" },
  { label: "Pengawas", value: "Supervisor" },
  { label: "Petugas", value: "User" },
  { label: "Keuangan", value: "Keuangan" },
] as const;

const getRoleLabel = (val?: string | null) =>
  ROLE_OPTIONS.find((r) => r.value === val)?.label ?? val ?? "";

const fmtID = new Intl.NumberFormat("id-ID");
const digitsOnly = (v: string) => v.replace(/\D+/g, "");
const toInt = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

function IconButton({
  label,
  onClick,
  disabled,
  className = "",
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label} // fallback tooltip native
      className={`group relative inline-flex h-9 w-9 items-center justify-center rounded-md border
                  text-white shadow-sm transition
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0
                  ${disabled ? "cursor-not-allowed opacity-50" : "hover:brightness-110"}
                  ${className}`}
    >
      {children}
      {/* Tooltip kustom */}
      <span
        className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2
                   whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white
                   opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition"
      >
        {label}
      </span>
    </button>
  );
}

export default function SuperAdminManagePage() {
  const { data, loading, error, refetch } = useQuery(GET_ALL_USERS, {
    fetchPolicy: "cache-and-network",
  });
  const users = data?.getUsers ?? [];
  const { user: currentUser, loading: userLoading } = useUser();
  const router = useRouter();

  // roles yang diizinkan
  const ALLOWED = new Set(["Superadmin", "Keuangan"]);

  React.useEffect(() => {
    if (userLoading) return;
    const role = currentUser?.role ?? "";

    if (!ALLOWED.has(role)) {
      toast.error("Akses ditolak. Mengarahkan ke Beranda");
      router.replace("/dashboard");
    }
  }, [userLoading, currentUser?.role, router]);

  const [searchTerm, setSearchTerm] = useState("");
  const [pendingRole, setPendingRole] = useState<Record<string, string>>({});
  const [pendingLimit, setPendingLimit] = useState<Record<string, string>>({});
  const [updating, setUpdating] = useState<Record<string, boolean>>({});

  // Modal Honor
  const [honorUser, setHonorUser] = useState<any | null>(null);
  const [
    loadHonor,
    { data: honorData, loading: honorLoading, called: honorCalled },
  ] = useLazyQuery(GET_USER_PROGRESS_BY_USER_ID, {
    fetchPolicy: "network-only",
  });

  const [updateRole] = useMutation(UPDATE_ROLE);
  const [updateBillLimit] = useMutation(UPDATE_BILL_LIMIT);

  // ====== FILTER: cari berdasarkan nama/email/role LABEL (bukan value) ======
  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u: any) => {
      const roleLabel = getRoleLabel(u.role);
      return [u.name, u.email, roleLabel]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(q));
    });
  }, [users, searchTerm]);

  // ====== HANDLERS ======
  const handleRoleChange = (id: string, val: string) =>
    setPendingRole((p) => ({ ...p, [id]: val }));

  const handleLimitChange = (id: string, val: string) => {
    const clean = digitsOnly(val);
    setPendingLimit((p) => ({ ...p, [id]: clean }));
  };

  const handleReset = (id: string) => {
    setPendingRole((p) => {
      const { [id]: _, ...rest } = p;
      return rest;
    });
    setPendingLimit((p) => {
      const { [id]: __, ...rest } = p;
      return rest;
    });
  };

  const handleSave = useCallback(
    async (user: any) => {
      const newRole = pendingRole[user.id];
      const newLimitStr = pendingLimit[user.id];
      const currentLimit = Number(user.limit_bill ?? user.limitBill ?? 0);
      const newLimitNum =
        typeof newLimitStr === "string" && newLimitStr.length > 0
          ? toInt(newLimitStr)
          : null;

      const dirtyRole = !!newRole && newRole !== user.role;
      const dirtyLimit =
        newLimitNum !== null &&
        Number.isFinite(newLimitNum) &&
        newLimitNum !== currentLimit;

      if (!dirtyRole && !dirtyLimit) return;

      setUpdating((u) => ({ ...u, [user.id]: true }));

      let okRole = false,
        okLimit = false;

      // --- update role ---
      if (dirtyRole) {
        try {
          await updateRole({
            variables: {
              userId: user.id,
              updateRole: { name: user.name, role: newRole },
            },
          });
          okRole = true;
          setPendingRole((p) => {
            const { [user.id]: _, ...rest } = p;
            return rest;
          });
        } catch (e) {
          console.error("Update role gagal:", e);
        }
      }

      // --- update limit bill ---
      if (dirtyLimit) {
        try {
          await updateBillLimit({
            variables: {
              userId: user.id,
              updateBillLimit: {
                name: user.name,
                limit_bill: String(newLimitNum), // DTO kamu minta string
              },
            },
          });
          okLimit = true;
          setPendingLimit((p) => {
            const { [user.id]: __, ...rest } = p;
            return rest;
          });
        } catch (e) {
          console.error("Update limit gagal:", e);
          toast.error("Gagal memperbarui honor maksimal. Silakan coba lagi.");
        }
      }

      setUpdating((u) => ({ ...u, [user.id]: false }));
      await refetch();

      if (okRole && okLimit)
        toast.success("Role dan limit berhasil diperbarui.");
      else if (okRole && !okLimit) toast.success("Role berhasil diperbarui.");
      else if (!okRole && okLimit) toast.success("Limit berhasil diperbarui.");
      else toast.error("Gagal menyimpan perubahan.");
    },
    [pendingRole, pendingLimit, updateRole, updateBillLimit, refetch]
  );

  // ===== Modal Honor: open/close & grouping data =====
  const openHonorModal = async (user: any) => {
    setHonorUser(user);
    try {
      await loadHonor({ variables: { userId: user.id } });
    } catch (e) {
      console.error(e);
      toast.error("Gagal memuat daftar honor.");
    }
  };
  const closeHonorModal = () => setHonorUser(null);

  const honorRows: any[] = honorData?.userProgressSurveyByUserId ?? [];
  // Group by subSurveyActivityId
  const honorGrouped = useMemo(() => {
    const map = new Map<
      string,
      {
        subId: string;
        subName: string;
        activityType?: string;
        count: number;
        total: number;
      }
    >();
    for (const r of honorRows) {
      const key = r.subSurveyActivityId || "unknown";
      const prev = map.get(key);
      const add = Number(r.travelBill ?? 0);
      const limitBill = Number(honorData?.user?.limit_bill ?? 0);
      if (prev) {
        prev.count += 1;
        prev.total += add;
      } else {
        map.set(key, {
          subId: key,
          subName: r.subSurveyActivity?.name ?? "(Tanpa nama)",
          activityType: r.subSurveyActivity?.activityType,
          count: 1,
          total: add,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.subName.localeCompare(b.subName, "id")
    );
  }, [honorRows]);

  const honorGrandTotal = useMemo(
    () => honorGrouped.reduce((acc, it) => acc + it.total, 0),
    [honorGrouped]
  );

  // Ambil limit dari user yang dipilih (fallback dari baris pertama jika perlu)
  const limitBill = useMemo(() => {
    const direct = Number(honorUser?.limit_bill ?? honorUser?.limitBill ?? NaN);
    if (Number.isFinite(direct)) return direct;
    const fromRow = Number(honorRows?.[0]?.user?.limit_bill ?? NaN);
    return Number.isFinite(fromRow) ? fromRow : 0;
  }, [honorUser, honorRows]);

  const usedTotal = honorGrandTotal; // total honor terpakai (sudah kamu hitung)
  const remain = Math.max(0, limitBill - usedTotal);

  if (userLoading) {
    return (
      <div className="max-w-screen-xl mx-auto px-3 py-6 font-Poppins">
        Memuat…
      </div>
    );
  }
  if (!currentUser || !ALLOWED.has(currentUser.role ?? "")) {
    return null;
  }

  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-6 md:px-8 py-4 space-y-4 font-Poppins">
      {/* Header */}
      <div className="bg-orange-50 rounded-lg p-3 md:p-4 font-bold text-lg md:text-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-md">
        <span>Panel Kontrol Pengguna</span>
        {/* <button
          onClick={() => refetch()}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition font-semibold"
        >
          Refresh
        </button> */}
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg p-3 shadow flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <label className="text-sm font-medium">Cari pengguna</label>
        <input
          type="text"
          placeholder="Nama / email / role (mis. Pengawas)…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border border-gray-300 bg-white rounded-md px-3 py-2 text-sm w-full sm:max-w-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="relative shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full text-sm text-left text-gray-600">
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
                <th className="px-4 md:px-6 py-3 uppercase text-xs md:text-sm">
                  Honor Maksimal
                </th>
                <th className="px-4 md:px-6 py-3 uppercase text-xs md:text-sm text-right">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center">
                    Memuat pengguna…
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-4 text-center text-red-600"
                  >
                    Terjadi kesalahan memuat data
                  </td>
                </tr>
              )}
              {!loading && !error && filteredUsers.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-6 text-center text-gray-500"
                  >
                    Tidak ada pengguna cocok dengan "{searchTerm}"
                  </td>
                </tr>
              )}

              {filteredUsers.map((user: any) => {
                const baseLimit = Number(
                  user.limit_bill ?? user.limitBill ?? 0
                );
                const rolePending = pendingRole[user.id];
                const limitPending = pendingLimit[user.id];
                const effectiveRole = rolePending ?? user.role;
                const effectiveLimit = limitPending ?? String(baseLimit);
                const dirtyRole = !!rolePending && rolePending !== user.role;
                const dirtyLimit =
                  !!limitPending && Number(limitPending) !== baseLimit;
                const isSaving = !!updating[user.id];
                const dirty = dirtyRole || dirtyLimit;

                return (
                  <tr
                    key={user.id}
                    className="bg-white border-t border-gray-200 align-top"
                  >
                    <td className="px-4 md:px-6 py-3 font-medium text-gray-900 break-words align-middle">
                      {user.name}
                    </td>
                    <td className="px-4 md:px-6 py-3 break-words align-middle">
                      {user.email}
                    </td>

                    {/* ROLE */}
                    <td className="px-4 md:px-6 py-3 align-middle">
                      <select
                        value={effectiveRole}
                        onChange={(e) =>
                          handleRoleChange(user.id, e.target.value)
                        }
                        disabled={currentUser?.role !== "Superadmin"}
                        className={`border px-3 py-2 text-sm rounded-md bg-white ${currentUser?.role !== "Superadmin" ? "cursor-default" : "cursor-pointer"} focus:outline-none`}
                      >
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* LIMIT BILL */}
                    <td className="px-4 md:px-6 py-3 align-middle">
                      <div className="inline-flex items-stretch rounded-md shadow-sm">
                        <span className="inline-flex items-center justify-center px-3 h-10 text-sm font-semibold text-white select-none bg-gray-400 border border-gray-300 rounded-l-md">
                          Rp
                        </span>
                        <input
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={fmtID.format(Number(effectiveLimit || "0"))}
                          onChange={(e) =>
                            handleLimitChange(user.id, e.target.value)
                          }
                          onFocus={(e) =>
                            e.currentTarget.setSelectionRange(
                              0,
                              e.currentTarget.value.length
                            )
                          }
                          className="h-10 w-40 border border-gray-300 -ml-px rounded-r-md bg-white px-3 text-sm text-left outline-none"
                          title="Masukkan angka (rupiah tanpa titik/koma)"
                        />
                      </div>
                    </td>

                    {/* AKSI */}
                    <td className="px-4 md:px-6 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {/* Lihat Honor */}
                        <IconButton
                          label="Lihat Honor"
                          onClick={() => openHonorModal(user)}
                          className="bg-purple-700 border-purple-700 hover:bg-purple-600"
                        >
                          {/* ikon receipt/list */}
                          <svg
                            viewBox="0 0 24 24"
                            className="h-5 w-5"
                            aria-hidden="true"
                          >
                            <path
                              d="M6 4h12v16l-2-1-2 1-2-1-2 1-2-1-2 1V4z"
                              fill="currentColor"
                              opacity=".15"
                            />
                            <path
                              d="M8 8h8M8 12h8M8 16h5"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                        </IconButton>

                        {/* Simpan */}
                        <IconButton
                          label={isSaving ? "Menyimpan…" : "Simpan"}
                          onClick={() => handleSave(user)}
                          disabled={!dirty || isSaving}
                          className={`border-blue-700 bg-blue-700 ${!dirty || isSaving ? "" : "hover:bg-blue-600"}`}
                        >
                          {/* ikon check/save */}
                          <svg
                            viewBox="0 0 24 24"
                            className="h-5 w-5"
                            aria-hidden="true"
                          >
                            <path
                              d="M5 12l4 4L19 6"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </IconButton>

                        {/* Reset */}
                        <IconButton
                          label="Reset"
                          onClick={() => handleReset(user.id)}
                          disabled={!dirty || isSaving}
                          className={`border-red-700 bg-red-700 ${!dirty || isSaving ? "" : "hover:bg-red-600"}`}
                        >
                          {/* ikon refresh/rotate */}
                          <svg
                            viewBox="0 0 24 24"
                            className="h-5 w-5"
                            aria-hidden="true"
                          >
                            <path
                              d="M21 12a9 9 0 1 1-2.64-6.36"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                            <path
                              d="M21 5v6h-6"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== MODAL: DAFTAR HONOR USER ===== */}
      {honorUser && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-20">
          <div className="bg-white w-[92%] sm:w-[760px] rounded-xl shadow-xl">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b">
              <div>
                <h2 className="text-lg sm:text-xl font-bold">
                  Daftar Honor — {honorUser?.name}
                </h2>
                <p className="text-xs text-gray-500">
                  Ringkasan akumulasi per kegiatan
                </p>
              </div>
              <button
                onClick={closeHonorModal}
                className="px-3 py-1.5 rounded-md bg-red-500 text-white hover:bg-red-600 text-sm"
                type="button"
              >
                Tutup
              </button>
            </div>

            <div className="p-4 sm:p-6">
              {honorLoading && (
                <div className="text-center text-sm text-gray-600">
                  Memuat data honor…
                </div>
              )}

              {!honorLoading && honorGrouped.length === 0 && (
                <div className="text-center text-sm text-gray-500">
                  Belum ada data honor untuk pengguna ini.
                </div>
              )}

              {!honorLoading && honorGrouped.length > 0 && (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-[680px] w-full text-sm text-left text-gray-700">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2">Kegiatan</th>
                          <th className="px-4 py-2">Jenis</th>
                          <th className="px-4 py-2 text-right">Jumlah Blok</th>
                          <th className="px-4 py-2 text-right">Total Honor</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {honorGrouped.map((g) => (
                          <tr key={g.subId} className="border-t">
                            <td className="px-4 py-2">{g.subName}</td>
                            <td className="px-4 py-2">
                              {g.activityType ?? "-"}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {fmtID.format(g.count)}
                            </td>
                            <td className="px-4 py-2 text-right font-semibold">
                              Rp {fmtID.format(g.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 border-t">
                          <td className="px-4 py-3 font-bold" colSpan={3}>
                            Total Akumulasi
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                            Rp {fmtID.format(honorGrandTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                    <div className="mt-3 flex justify-end text-sm">
                      <div className="rounded-lg bg-gray-50 px-3 py-2">
                        {/* <span className="mr-3">
                          Terpakai: <b>Rp {fmtID.format(usedTotal)}</b>
                        </span> */}
                        <span className="mr-1">
                          Tersisa:{" "}
                          <b
                            className={
                              remain <= 0 ? "text-red-600" : "text-emerald-700"
                            }
                          >
                            Rp {fmtID.format(remain)}
                          </b>
                        </span>
                        <span>
                          dari: <b>Rp {fmtID.format(limitBill)}</b>
                        </span>
                      </div>
                    </div>
                  </div>

                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm text-gray-700 hover:text-gray-900">
                      Lihat rincian per baris
                    </summary>
                    <div className="overflow-x-auto mt-2">
                      <table className="min-w-[680px] w-full text-xs text-left text-gray-700">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-3 py-2">Kegiatan</th>
                            <th className="px-3 py-2">Jenis</th>
                            <th className="px-3 py-2">Kecamatan/Desa</th>
                            <th className="px-3 py-2 text-right">Honor</th>
                            <th className="px-3 py-2">Last Updated</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {honorRows.map((r, idx) => (
                            <tr key={r.id ?? idx} className="border-t">
                              <td className="px-3 py-2">
                                {r.subSurveyActivity?.name ?? "-"}
                              </td>
                              <td className="px-3 py-2">
                                {r.subSurveyActivity?.activityType ?? "-"}
                              </td>
                              <td className="px-3 py-2">
                                {r.district?.name ?? r.villageName ?? "-"}
                              </td>
                              <td className="px-3 py-2 text-right">
                                Rp {fmtID.format(Number(r.travelBill ?? 0))}
                              </td>
                              <td className="px-3 py-2">
                                {r.lastUpdated
                                  ? new Date(r.lastUpdated).toLocaleString(
                                      "id-ID"
                                    )
                                  : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
