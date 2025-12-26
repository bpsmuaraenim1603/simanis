"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import { GET_MONTHLY_ACTIVITY_STAFF_USAGE } from "@/src/graphql/actions/get-monthly-activity-staff-usage.action";

type StaffUser = { id: string; name?: string; email?: string };

type StaffUsageRow = {
  month: string;
  subSurveyActivityId: string;
  subSurveyName: string;
  startDate: string;
  endDate: string;
  staffCount: number;
  staffUsers?: StaffUser[];
};

const fmtID = new Intl.NumberFormat("id-ID");

function monthLabel(yyyyMM: string) {
  const [y, m] = yyyyMM.split("-").map(Number);
  const names = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  return `${names[(m ?? 1) - 1]} ${y}`;
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

export default function MonthlyStaffUsageWidget() {
  const now = new Date();
  const year = now.getFullYear();
  const monthNow = `${year}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const { data, loading, error, refetch } = useQuery(GET_MONTHLY_ACTIVITY_STAFF_USAGE, {
    variables: { year },
    fetchPolicy: "cache-and-network",
  });

  const rows: StaffUsageRow[] = (data?.getMonthlyActivityStaffUsage ?? []) as StaffUsageRow[];

  const rowsThisMonth = useMemo(() => {
    return rows
      .filter((r) => r?.month === monthNow)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [rows, monthNow]);

  const summary = useMemo(() => {
    const uniq = new Map<string, StaffUser>();
    for (const r of rowsThisMonth) {
      for (const u of r.staffUsers ?? []) {
        if (!u?.id) continue;
        if (!uniq.has(u.id)) uniq.set(u.id, u);
      }
    }
    return {
      totalActivities: rowsThisMonth.length,
      totalUniqueStaff: uniq.size,
    };
  }, [rowsThisMonth]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div className="bg-orange-50 rounded-lg shadow p-3 sm:p-4 space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="font-bold text-base sm:text-lg">
            Kegiatan & Petugas Aktif Bulan {monthLabel(monthNow)}
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="border rounded-lg p-3 bg-white">
          <div className="text-md text-gray-500">Kegiatan Aktif</div>
          <div className="text-3xl font-bold">{summary.totalActivities}</div>
        </div>
        <div className="border rounded-lg p-3 bg-white">
          <div className="text-md text-gray-500">Petugas Aktif</div>
          <div className="text-3xl font-bold">{summary.totalUniqueStaff}</div>
        </div>
      </div>

      {/* State */}
      {error && (
        <div className="text-sm text-red-600">
          Gagal memuat pemakaian petugas: {error.message}
        </div>
      )}

      {!loading && !error && rowsThisMonth.length === 0 && (
        <div className="text-sm text-gray-600">
          Belum ada kegiatan/penugasan untuk bulan ini.
        </div>
      )}

      {/* Tabel ringkas */}
      {rowsThisMonth.length > 0 && (
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left border-b">
                <th className="p-3 w-[70px]">No</th>
                <th className="p-3">Kegiatan</th>
                <th className="p-3 w-[220px]">Periode</th>
                <th className="p-3 w-[140px] text-right">Petugas</th>
                <th className="p-3 w-[180px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {rowsThisMonth.map((r, i) => {
                const rowId = r.subSurveyActivityId ?? `${r.month}-${i}`;
                const isOpen = !!expanded[rowId];
                const staffList = (r.staffUsers ?? [])
                  .slice()
                  .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "id"));

                return (
                  <React.Fragment key={rowId}>
                    <tr className="border-b">
                      <td className="p-3">{i + 1}</td>
                      <td className="p-3">
                        <div className="font-semibold">{r.subSurveyName}</div>
                      </td>
                      <td className="p-3">
                        {formatDateShort(r.startDate)} – {formatDateShort(r.endDate)}
                      </td>
                      <td className="p-3 text-right font-semibold">
                        {fmtID.format(Number(r.staffCount ?? staffList.length ?? 0))}
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => toggle(rowId)}
                          className="inline-flex items-center gap-2 px-2 py-1 rounded bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100"
                          title="Lihat daftar petugas"
                        >
                          {isOpen ? "Tutup" : "Lihat petugas"}
                        </button>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="border-b bg-gray-50">
                        <td className="p-3" />
                        <td className="p-3" colSpan={4}>
                          {staffList.length === 0 ? (
                            <div className="text-sm text-gray-600">
                              Tidak ada data petugas untuk kegiatan ini.
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {staffList.map((u) => (
                                <span
                                  key={u.id}
                                  className="text-xs bg-white border rounded px-2 py-1"
                                  title={u.email ?? ""}
                                >
                                  {u.name ?? u.email ?? "Tanpa Nama"}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
