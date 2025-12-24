"use client";

import React, { useMemo, useState, useCallback } from "react";
import { useQuery, useMutation, useLazyQuery } from "@apollo/client";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { GET_ALL_USERS } from "@/src/graphql/actions/find-allusers.action";
import { UPDATE_ROLE } from "@/src/graphql/actions/update-role.action";
import { UPDATE_BILL_LIMIT } from "@/src/graphql/actions/update-limitbill.action";
import { GET_USER_PROGRESS_BY_USER_ID } from "@/src/graphql/actions/find-usersurveyprogressbyuser.action";
import useUser from "@/src/hooks/useUser";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GET_MONTHLY_ACTIVITY_STAFF_USAGE } from "@/src/graphql/actions/get-monthly-activity-staff-usage.action";
import { GET_STAFF_YEARLY_EXPORT } from "@/src/graphql/actions/get-staff-yearly-export.action";
import HUSelect, { HUSelectOption } from "@/src/components/HUSelect";

function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  value: T;
  onChange: (k: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-gray-200">
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={[
              "px-4 py-2 text-sm font-medium rounded-t-lg",
              active
                ? "bg-white border-x border-t border-gray-200 -mb-px"
                : "text-gray-600 hover:text-gray-900",
            ].join(" ")}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

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

function monthLabel(yyyyMM: string) {
  const [y, m] = yyyyMM.split("-").map(Number);
  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];
  return `${names[(m ?? 1) - 1]} ${y}`;
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function MonthlyStaffUsagePanel({
  year,
  setYear,
  onOpenUserActivities,
}: {
  year: number;
  setYear: (v: number) => void;
  onOpenUserActivities: (userId: string) => void | Promise<void>;
}) {
  const { data, loading, error, refetch } = useQuery(
    GET_MONTHLY_ACTIVITY_STAFF_USAGE,
    {
      variables: { year },
      fetchPolicy: "cache-and-network",
    }
  );

  const [fetchExport, { loading: exporting }] = useLazyQuery(
    GET_STAFF_YEARLY_EXPORT,
    {
      fetchPolicy: "network-only",
    }
  );

  const rows = (data?.getMonthlyActivityStaffUsage ?? []) as Array<{
    month: string;
    subSurveyActivityId: string;
    subSurveyName: string;
    startDate: string;
    endDate: string;
    staffCount: number;
    staffUsers?: Array<{ id: string; name?: string; email?: string }>;
  }>;

  const grouped = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const k = r.month || "-";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }

    const entries = Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );

    for (const [, arr] of entries) {
      arr.sort(
        (x, y) =>
          new Date(x.startDate).getTime() - new Date(y.startDate).getTime()
      );
    }
    return entries;
  }, [rows]);

  const totalActivities = rows.length;

  const uniqueUsersYear = useMemo(() => {
    const set = new Set<string>();

    for (const r of rows) {
      // kalau backend kirim staffUsers
      (r.staffUsers ?? []).forEach((u) => u?.id && set.add(u.id));

      // kalau backend kirim staffUserIds (kalau kamu pakai ini)
      // (r.staffUserIds ?? []).forEach((id) => id && set.add(id));
    }

    return set.size;
  }, [rows]);

  const uniqueUsersList = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name?: string; email?: string }
    >();

    for (const r of rows) {
      for (const u of r.staffUsers ?? []) {
        if (!u?.id) continue;
        if (!map.has(u.id)) map.set(u.id, u);
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "", "id")
    );
  }, [rows]);

  const [selectedActivity, setSelectedActivity] = useState<null | {
    month: string;
    subSurveyActivityId: string;
    subSurveyName: string;
    startDate: string;
    endDate: string;
    staffUsers?: Array<{ id: string; name?: string; email?: string }>;
  }>(null);

  const [showActivitiesModal, setShowActivitiesModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);

  const openStaffModal = (row: any) => setSelectedActivity(row);
  const closeStaffModal = () => setSelectedActivity(null);

  const yearOptions: HUSelectOption[] = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 6 }).map((_, i) => {
      const y = current - 3 + i;
      return {
        value: String(y),
        label: String(y),
      };
    });
  }, []);

  const excelDate = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  };

  const handleExportExcel = async () => {
    try {
      const res = await fetchExport({ variables: { year } });
      const rows = res.data?.getStaffYearlyExport ?? [];

      // ===== Sheet 1: DETAIL_PROGRESS (1 baris = 1 userProgress / 1 kegiatan) =====
      const detail = rows.map((r: any, i: number) => ({
        No: i + 1,
        UserID: r.userId,
        Nama: r.userName,
        Email_Limit: r.userLimitBill ?? "",
        Kegiatan: r.subSurveyName,
        TipeKegiatan: r.activityType ?? "",
        Bulan: r.month, // YYYY-MM
        Kecamatan: r.districtName ?? "",
        BlockCount: r.blockCount ?? 0,
        TotalAssigned: r.totalAssigned ?? 0,
        Submit: r.submitCount ?? 0,
        Approved: r.approvedCount ?? 0,
        Rejected: r.rejectedCount ?? 0,
        StartDate: excelDate(r.startDate),
        Honor_TravelBill: Number(r.travelBill ?? 0),
      }));

      // ===== Sheet 2: RINGKASAN_PETUGAS (1 baris = 1 user) =====
      const byUser = new Map<string, any>();

      for (const r of rows) {
        const key = r.userId;
        if (!byUser.has(key)) {
          byUser.set(key, {
            userId: r.userId,
            name: r.userName,
            limit: r.userLimitBill ?? "",
            months: new Set<string>(),
            activities: new Set<string>(),
            totalHonor: 0,
          });
        }
        const u = byUser.get(key);
        u.months.add(r.month);
        u.activities.add(r.subSurveyName);
        u.totalHonor += Number(r.travelBill ?? 0);
      }

      const summary = Array.from(byUser.values())
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "id"))
        .map((u: any, i: number) => ({
          No: i + 1,
          UserID: u.userId,
          Nama: u.name,
          LimitBill: u.limit,
          TotalKegiatan: u.activities.size,
          DaftarKegiatan: Array.from(u.activities).sort().join("; "),
          BulanTerlibat: Array.from(u.months).sort().join(", "),
          TotalHonor: u.totalHonor,
        }));

      // ===== Build workbook =====
      const wb = XLSX.utils.book_new();
      const wsSummary = XLSX.utils.json_to_sheet(summary);
      const wsDetail = XLSX.utils.json_to_sheet(detail);

      // Optional: set column widths (biar gak sempit)
      wsSummary["!cols"] = [
        { wch: 4 }, // No
        { wch: 20 }, // UserID
        { wch: 28 }, // Nama
        { wch: 12 }, // Limit
        { wch: 12 }, // TotalKegiatan
        { wch: 60 }, // DaftarKegiatan
        { wch: 20 }, // BulanTerlibat
        { wch: 16 }, // TotalHonor
      ];

      wsDetail["!cols"] = [
        { wch: 4 }, // No
        { wch: 20 }, // UserID
        { wch: 28 }, // Nama
        { wch: 12 }, // Limit
        { wch: 40 }, // Kegiatan
        { wch: 14 }, // Tipe
        { wch: 10 }, // Bulan
        { wch: 20 }, // Kecamatan
        { wch: 10 }, // BlockCount
        { wch: 14 }, // TotalAssigned
        { wch: 8 }, // Submit
        { wch: 10 }, // Approved
        { wch: 10 }, // Rejected
        { wch: 12 }, // StartDate
        { wch: 16 }, // Honor
      ];

      XLSX.utils.book_append_sheet(wb, wsSummary, "RINGKASAN_PETUGAS");
      XLSX.utils.book_append_sheet(wb, wsDetail, "DETAIL_PROGRESS");

      XLSX.writeFile(wb, `Export_Petugas_${year}.xlsx`);
    } catch (e: any) {
      console.error(e);
      alert(`Gagal export: ${e?.message ?? "unknown error"}`);
    }
  };

  React.useEffect(() => {
    if (!selectedActivity) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeStaffModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedActivity]);

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-4 space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div>
          <div className="font-bold text-base">
            Pemakaian Petugas per Kegiatan (Bulanan)
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <HUSelect
            value={String(year)}
            onValueChange={(v) => {
              if (!v) return;
              setYear(Number(v));
            }}
            options={yearOptions}
            placeholder="Pilih tahun…"
            className="w-[180px]"
            buttonClassName="text-sm"
          />
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting}
            className={`px-3 py-2 rounded-md text-sm font-semibold ${
              exporting
                ? "bg-green-400 text-white cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {exporting ? "Exporting..." : "Export Excel"}
          </button>
        </div>
      </div>

      {/* ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setShowActivitiesModal(true)}
          className="border rounded-lg p-3 text-left hover:bg-gray-50 transition"
          title="Klik untuk lihat daftar kegiatan"
        >
          <div className="text-sm text-gray-500">
            Total kegiatan sepanjang tahun {year}
          </div>
          <div className="text-3xl font-bold">{totalActivities}</div>
          <div className="text-xs text-blue-600 mt-1">
            Lihat daftar kegiatan →
          </div>
        </button>

        <button
          type="button"
          onClick={() => setShowUsersModal(true)}
          className="border rounded-lg p-3 text-left hover:bg-gray-50 transition"
          title="Klik untuk lihat daftar petugas"
        >
          <div className="text-sm text-gray-500">
            Total petugas sepanjang tahun {year}
          </div>
          <div className="text-3xl font-bold">{uniqueUsersYear}</div>
          <div className="text-xs text-blue-600 mt-1">
            Lihat daftar petugas →
          </div>
        </button>
      </div>

      {showActivitiesModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto pt-20 px-3"
          onClick={() => setShowActivitiesModal(false)}
        >
          <div
            className="bg-white w-full max-w-[900px] rounded-xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b">
              <div className="min-w-0">
                <div className="text-lg font-bold break-words">
                  Daftar Kegiatan — {year}
                </div>
                <div className="text-sm text-gray-600">
                  Total kegiatan: <b>{rows.length}</b>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowActivitiesModal(false)}
                className="shrink-0 px-3 py-1.5 rounded-md bg-red-500 text-white hover:bg-red-600 text-sm font-semibold"
              >
                Tutup
              </button>
            </div>

            <div className="px-4 sm:px-6 py-4">
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-[900px] w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left border-b">
                      <th className="p-3 w-[70px]">No</th>
                      <th className="p-3 w-[120px]">Bulan</th>
                      <th className="p-3">Kegiatan</th>
                      <th className="p-3 w-[220px]">Periode</th>
                      <th className="p-3 w-[160px]">Petugas</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {rows.map((r, i) => (
                      <tr
                        key={r.subSurveyActivityId}
                        className="border-b last:border-b-0"
                      >
                        <td className="p-3">{i + 1}</td>
                        <td className="p-3">{monthLabel(r.month)}</td>
                        <td className="p-3">
                          <div className="font-semibold">{r.subSurveyName}</div>
                        </td>
                        <td className="p-3">
                          {formatDateShort(r.startDate)} –{" "}
                          {formatDateShort(r.endDate)}
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => {
                              // buka modal petugas kegiatan yang sudah kamu punya
                              setShowActivitiesModal(false);
                              openStaffModal(r);
                            }}
                            className="inline-flex items-center gap-2 px-2 py-1 rounded bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100"
                            title="Klik untuk lihat daftar petugas kegiatan ini"
                          >
                            {r.staffCount}
                            <span className="text-xs">Lihat</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-4 text-center text-gray-500"
                        >
                          Tidak ada kegiatan di tahun {year}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUsersModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto pt-20 px-3"
          onClick={() => setShowUsersModal(false)}
        >
          <div
            className="bg-white w-full max-w-[720px] rounded-xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b">
              <div className="min-w-0">
                <div className="text-lg font-bold break-words">
                  Daftar Petugas Unik — {year}
                </div>
                <div className="text-sm text-gray-600">
                  Total petugas unik: <b>{uniqueUsersList.length}</b>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowUsersModal(false)}
                className="shrink-0 px-3 py-1.5 rounded-md bg-red-500 text-white hover:bg-red-600 text-sm font-semibold"
              >
                Tutup
              </button>
            </div>

            <div className="px-4 sm:px-6 py-4">
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[420px] overflow-y-auto">
                  {uniqueUsersList.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">
                      Tidak ada data petugas.
                    </div>
                  ) : (
                    uniqueUsersList.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={async () => {
                          setShowUsersModal(false);
                          await onOpenUserActivities(u.id);
                        }}
                        className="w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-gray-50"
                        title="Klik untuk lihat kegiatan yang diikuti user"
                      >
                        <div className="text-sm font-semibold truncate">
                          {u.name ?? "Tanpa Nama"}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {u.email ?? ""}
                        </div>
                        <div className="text-[11px] text-blue-600 mt-1">
                          Lihat kegiatan yang diikuti →
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="text-sm text-gray-600">Memuat data…</div>}
      {error && (
        <div className="text-sm text-red-600">
          Gagal memuat: {error.message}
        </div>
      )}

      {!loading && !error && grouped.length === 0 && (
        <div className="text-sm text-gray-600">
          Tidak ada kegiatan di tahun {year}.
        </div>
      )}

      {/* per bulan */}
      <div className="space-y-4">
        {grouped.map(([m, list]) => (
          <div key={m} className="border rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <div className="font-semibold">{monthLabel(m)}</div>
              <div className="text-sm text-gray-600">
                Kegiatan: <b>{list.length}</b> • Total petugas:{" "}
                <b>{list.reduce((a, r) => a + Number(r.staffCount ?? 0), 0)}</b>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-white">
                  <tr className="text-left border-b">
                    <th className="p-2 sm:p-3 w-[70px]">No</th>
                    <th className="p-2 sm:p-3">Kegiatan</th>
                    <th className="p-2 sm:p-3 w-[220px]">Periode</th>
                    <th className="p-2 sm:p-3 w-[140px]">Petugas</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r, idx) => (
                    <tr
                      key={r.subSurveyActivityId}
                      className="border-b last:border-b-0"
                    >
                      <td className="p-2 sm:p-3">{idx + 1}</td>
                      <td className="p-2 sm:p-3">
                        <div className="font-semibold">{r.subSurveyName}</div>
                      </td>
                      <td className="p-2 sm:p-3">
                        {formatDateShort(r.startDate)} -{" "}
                        {formatDateShort(r.endDate)}
                      </td>
                      <td className="p-2 sm:p-3">
                        <button
                          type="button"
                          onClick={() => openStaffModal(r)}
                          className="inline-flex items-center gap-2 px-2 py-1 rounded bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100"
                          title="Klik untuk lihat daftar petugas"
                        >
                          {r.staffCount}
                          <span className="text-xs">Lihat</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      {selectedActivity && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto pt-20 px-3"
          onClick={closeStaffModal}
        >
          <div
            className="bg-white w-full max-w-[720px] rounded-xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b">
              <div className="min-w-0">
                <div className="text-lg font-bold break-words">
                  {selectedActivity.subSurveyName}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Bulan: <b>{monthLabel(selectedActivity.month)}</b>
                  <span className="mx-2">•</span>
                  Periode:{" "}
                  <b>
                    {formatDateShort(selectedActivity.startDate)} –{" "}
                    {formatDateShort(selectedActivity.endDate)}
                  </b>
                </div>
              </div>

              <button
                type="button"
                onClick={closeStaffModal}
                className="shrink-0 px-3 py-1.5 rounded-md bg-red-500 text-white hover:bg-red-600 text-sm font-semibold"
              >
                Tutup
              </button>
            </div>

            {/* Content */}
            <div className="px-4 sm:px-6 py-4">
              <div className="text-sm text-gray-700 mb-3">
                Total petugas:{" "}
                <b>{(selectedActivity.staffUsers ?? []).length}</b>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[420px] overflow-y-auto">
                  {(selectedActivity.staffUsers ?? []).length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">
                      Tidak ada data petugas untuk kegiatan ini.
                    </div>
                  ) : (
                    (selectedActivity.staffUsers ?? [])
                      .slice()
                      .sort((a, b) =>
                        (a.name ?? "").localeCompare(b.name ?? "", "id")
                      )
                      .map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={async () => {
                            // tutup modal petugas dulu biar transisinya enak
                            closeStaffModal();
                            await onOpenUserActivities(u.id);
                          }}
                          className="w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-gray-50"
                          title="Klik untuk lihat kegiatan user"
                        >
                          <div className="text-sm font-semibold truncate">
                            {u.name ?? "Tanpa Nama"}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {u.email ?? ""}
                          </div>
                          <div className="text-[11px] text-blue-600 mt-1">
                            Lihat kegiatan yang diikuti →
                          </div>
                        </button>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
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
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setQuery = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") params.delete(k);
        else params.set(k, v);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // Modal Honor
  const [honorUser, setHonorUser] = useState<any | null>(null);
  type AdminTab = "users" | "staffUsage";
  React.useEffect(() => {
    const t = searchParams?.get("tab");
    if (t === "users" || t === "staffUsage") {
      setActiveTab(t);
    }
  }, [searchParams]);

  const [activeTab, setActiveTab] = useState<AdminTab>("users");

  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
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
  const openHonorModalById = async (userId: string) => {
    // ambil user dari daftar yang sudah di-load (GET_ALL_USERS)
    const u = users.find((x: any) => x.id === userId) ?? {
      id: userId,
      name: "-",
      email: "-",
    };

    // pindah ke tab kontrol pengguna (biar “dialihkan” sesuai permintaanmu)
    setActiveTab("users");

    // buka modal honor yang sudah ada
    await openHonorModal(u);
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
    <div className="max-w-screen-xl mx-auto px-3 sm:px-6 md:px-8 py-4 font-Poppins">
      {/* Header */}
      <div className="bg-orange-50 rounded-lg p-3 md:p-4 font-bold text-lg md:text-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-md mb-4">
        <span>Panel Kontrol Pengguna</span>
      </div>
      <Tabs<AdminTab>
        tabs={[
          { key: "users", label: "Kontrol Pengguna" },
          { key: "staffUsage", label: "Pemakaian Petugas" },
        ]}
        value={activeTab}
        onChange={(k) => {
          setActiveTab(k);
          setQuery({ tab: k });
        }}
      />

      <div>
        {activeTab === "users" && (
          <>
            {/* Search */}
            <div className="bg-white rounded-lg p-3 shadow space-y-4">
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
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
                        const effectiveLimit =
                          limitPending ?? String(baseLimit);
                        const dirtyRole =
                          !!rolePending && rolePending !== user.role;
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
                                  value={fmtID.format(
                                    Number(effectiveLimit || "0")
                                  )}
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
                                <th className="px-4 py-2 text-right">
                                  Jumlah Blok
                                </th>
                                <th className="px-4 py-2 text-right">
                                  Total Honor
                                </th>
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
                                    remain <= 0
                                      ? "text-red-600"
                                      : "text-emerald-700"
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
                                  <th className="px-3 py-2 text-right">
                                    Honor
                                  </th>
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
                                      Rp{" "}
                                      {fmtID.format(Number(r.travelBill ?? 0))}
                                    </td>
                                    <td className="px-3 py-2">
                                      {r.lastUpdated
                                        ? new Date(
                                            r.lastUpdated
                                          ).toLocaleString("id-ID")
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
          </>
        )}

        {activeTab === "staffUsage" && (
          <MonthlyStaffUsagePanel
            year={year}
            setYear={setYear}
            onOpenUserActivities={openHonorModalById}
          />
        )}
      </div>
    </div>
  );
}
