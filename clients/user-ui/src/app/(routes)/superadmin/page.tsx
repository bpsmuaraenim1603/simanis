"use client";

import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useDeferredValue,
} from "react";
import { useQuery, useMutation, useLazyQuery } from "@apollo/client";
import toast from "react-hot-toast";
import ExcelJS from "exceljs";
import { GET_USERS_PAGE } from "@/src/graphql/actions/get-users-page.action";
import { UPDATE_ROLE } from "@/src/graphql/actions/update-role.action";
import { UPDATE_BILL_LIMIT } from "@/src/graphql/actions/update-limitbill.action";
import { GET_USER_PROGRESS_BY_USER_ID } from "@/src/graphql/actions/find-usersurveyprogressbyuser.action";
import useUser from "@/src/hooks/useUser";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GET_MONTHLY_ACTIVITY_STAFF_USAGE } from "@/src/graphql/actions/get-monthly-activity-staff-usage.action";
import { GET_MITRA_BULANAN_EXPORT } from "@/src/graphql/actions/get-mitra-bulanan-export.action";
import { PPK_OPTIONS } from "@/src/graphql/actions/users.ppkOptions.gql";
import { SET_DEFAULT_PPK_USER } from "@/src/graphql/actions/set-default-ppk-user.action";
import { GET_MONTHLY_STAFF_DOC_NUMBER_CONFIG } from "@/src/graphql/actions/get-monthly-staff-doc-number-config.action";
import { SET_MONTHLY_STAFF_DOC_NUMBER_CONFIG } from "@/src/graphql/actions/set-monthly-staff-doc-number-config.action";
import HUSelect, { HUSelectOption } from "@/src/components/HUSelect";
import { GET_DAILY_SIGNUP_CODE } from "@/src/graphql/actions/get-daily-signup-code.action";
import { ROTATE_DAILY_SIGNUP_CODE } from "@/src/graphql/actions/rotate-daily-signup-code.action";
import { getRoles } from "@/src/utils/roles";
import { Search } from "lucide-react";

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

const ALL_ROLES = ["User", "Supervisor", "Admin", "Keuangan", "Superadmin"];

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
      title={label}
      className={`group relative inline-flex h-9 w-9 items-center justify-center rounded-md border
                  text-white shadow-sm transition
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0
                  ${
                    disabled
                      ? "cursor-not-allowed opacity-50"
                      : "hover:brightness-110"
                  }
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

function SingleMonthMitraTable({
  year,
  activeMonth,
  setActiveMonth,
  rowsByMonth,
}: {
  year: number;
  activeMonth: number;
  setActiveMonth: (m: number) => void;
  rowsByMonth: Map<number, any[]>;
}) {
  const monthNames = [
    "JANUARI",
    "FEBRUARI",
    "MARET",
    "APRIL",
    "MEI",
    "JUNI",
    "JULI",
    "AGUSTUS",
    "SEPTEMBER",
    "OKTOBER",
    "NOVEMBER",
    "DESEMBER",
  ];

  const rowsMonth = rowsByMonth.get(activeMonth) ?? [];

  const monthOptions: HUSelectOption[] = useMemo(
    () =>
      monthNames.map((name, idx) => ({
        value: String(idx + 1),
        label: `${name} ${year}`,
      })),
    [monthNames, year],
  );

  const jumpMonth = (dir: -1 | 1) => {
    const next = activeMonth + dir;
    if (next < 1) {
      setActiveMonth(12);
      return;
    }
    if (next > 12) {
      setActiveMonth(1);
      return;
    }
    setActiveMonth(next);
  };

  const groups = useMemo(() => {
    const byUser = new Map<string, any[]>();
    for (const r of rowsMonth) {
      const k = String(r?.userId ?? r?.name ?? "-");
      if (!byUser.has(k)) byUser.set(k, []);
      byUser.get(k)!.push(r);
    }
    const ordered = Array.from(byUser.values()).map((list) => {
      return list.slice().sort((a, b) => {
        const da = new Date(a?.startDate ?? 0).getTime();
        const db = new Date(b?.startDate ?? 0).getTime();
        if (da !== db) return da - db;
        return String(a?.subsurveyactivity ?? "").localeCompare(
          String(b?.subsurveyactivity ?? ""),
          "id",
        );
      });
    });
    ordered.sort((a, b) =>
      String(a?.[0]?.name ?? "").localeCompare(
        String(b?.[0]?.name ?? ""),
        "id",
      ),
    );
    return ordered;
  }, [rowsMonth]);

  const [q, setQ] = useState("");

  const toSearchText = (row: any) => {
    const parts: string[] = [];

    const walk = (v: any) => {
      if (v == null) return;
      if (
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean"
      ) {
        parts.push(String(v));
        return;
      }
      if (Array.isArray(v)) {
        v.forEach(walk);
        return;
      }
      if (typeof v === "object") {
        Object.values(v).forEach(walk);
        return;
      }
    };

    walk(row);
    return parts.join(" ").toLowerCase();
  };

  const filteredRows = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key) return groups;
    return groups.filter((r) => toSearchText(r).includes(key));
  }, [groups, q]);

  const fmtDateId = (d: any) => {
    if (!d) return "";
    const dt = new Date(d);
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yy = dt.getFullYear();
    return `${dd}/${mm}/${yy}`;
  };

  return (
    <div className="mt-3">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 mb-2">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex items-center gap-2 border rounded-md w-fit">
            <IconButton
              label="Bulan sebelumnya"
              onClick={() => jumpMonth(-1)}
              className="border-0"
            >
              <span className="text-xl text-gray-700">‹</span>
            </IconButton>
            <div className="text-sm font-semibold min-w-[125px] text-center">
              {monthNames[activeMonth - 1]} {year}
            </div>
            <IconButton
              label="Bulan berikutnya"
              onClick={() => jumpMonth(1)}
              className="border-0"
            >
              <span className="text-xl text-gray-700">›</span>
            </IconButton>
          </div>
          <HUSelect
            value={String(activeMonth)}
            onValueChange={(v: string | null) => {
              if (!v) return;
              setActiveMonth(Number(v));
            }}
            options={monthOptions}
            placeholder="Pilih bulan…"
            className="w-full sm:w-[210px]"
            buttonClassName="text-sm"
          />
        </div>
        <div className="relative w-full lg:max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama, kegiatan, kecamatan, anggaran…"
            className="w-full rounded-md border border-gray-200 pl-9 pr-3 py-2 text-sm outline-none bg-white"
          />
        </div>
      </div>

      {rowsMonth.length === 0 && (
        <div className="mb-3 text-sm text-gray-600">
          Data kosong untuk bulan {monthNames[activeMonth - 1]} {year}. Tolong
          dicek kembali
        </div>
      )}

      <div className="w-full overflow-auto max-h-[800px] border rounded-md">
        <table className="min-w-[1050px] w-full text-[12px]">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="border-b">
              <th className="px-2 py-2 text-left w-[40px]">No</th>
              <th className="px-2 py-2 text-left">Nama</th>
              <th className="px-2 py-2 text-left">Pekerjaan</th>
              <th className="px-2 py-2 text-left">Kecamatan</th>
              <th className="px-2 py-2 text-left">Kabupaten</th>
              <th className="px-2 py-2 text-left">Kegiatan</th>
              <th className="px-2 py-2 text-left">Jangka Waktu</th>
              <th className="px-2 py-2 text-right">Vol</th>
              <th className="px-2 py-2 text-left">Satuan</th>
              <th className="px-2 py-2 text-right">Harga</th>
              <th className="px-2 py-2 text-right">Nilai</th>
              <th className="px-2 py-2 text-left">Anggaran</th>
              <th className="px-2 py-2 text-right">Jumlah</th>
              <th className="px-2 py-2 text-right">SBML</th>
              <th className="px-2 py-2 text-right">Selisih</th>
              <th className="px-2 py-2 text-left">Ketua Tim</th>
              <th className="px-2 py-2 text-left">DIPA</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length > 0 ? (
              filteredRows.map((list, gi) => {
                const totalJumlahPegawai = list.reduce(
                  (acc, x) => acc + (Number(x?.docsBill ?? 0) || 0),
                  0,
                );

                const sbmlPegawai = Number(list?.[0]?.limit_bill ?? 0) || 0;
                const selisihTotalPegawai = sbmlPegawai - totalJumlahPegawai;
                const span = list.length;
                let runningHonor = 0;
                return list.map((r: any, ri: number) => {
                  const vol = Number(r?.totalAssigned ?? 0) || 0;
                  const unit = Number(r?.unitWorkPrice ?? 0) || 0;
                  const nilai = vol * unit;
                  const jumlah = Number(r?.docsBill ?? 0) || 0;
                  runningHonor += jumlah;
                  const selisihBerjalan = sbmlPegawai - runningHonor;
                  const sbml = Number(r?.limit_bill ?? 0) || 0;
                  const selisih = sbml - jumlah;
                  const jumlahKegiatan = Number(r?.docsBill ?? 0) || 0;
                  const jangka = `${fmtDateId(r?.startDate)} - ${fmtDateId(r?.endDate)}`;

                  return (
                    <tr
                      key={`${gi}-${ri}-${r?.subsurveyactivity ?? "k"}`}
                      className="border-b hover:bg-gray-50"
                    >
                      {ri === 0 ? (
                        <>
                          <td rowSpan={span} className="px-2 py-2 border">
                            {gi + 1}
                          </td>
                          <td rowSpan={span} className="px-2 py-2 border">
                            {r?.name ?? "-"}
                          </td>
                          <td rowSpan={span} className="px-2 py-2 border">
                            {r?.job_name ?? "-"}
                          </td>
                          <td rowSpan={span} className="px-2 py-2 border">
                            {r?.district ?? "-"}
                          </td>
                          <td rowSpan={span} className="px-2 py-2 border">
                            {r?.city ?? "-"}
                          </td>
                        </>
                      ) : null}

                      <td className="px-2 py-2 border">
                        {r?.subsurveyactivity ?? "-"}
                      </td>
                      <td className="px-2 py-2 border">{jangka}</td>
                      <td className="px-2 py-2 text-right border">{vol}</td>
                      <td className="px-2 py-2 border">
                        {r?.sampleType ?? "-"}
                      </td>
                      <td className="px-2 py-2 text-right border">
                        {unit ? unit.toLocaleString("id-ID") : "-"}
                      </td>
                      <td className="px-2 py-2 text-right border">
                        {nilai ? nilai.toLocaleString("id-ID") : "-"}
                      </td>
                      <td className="px-2 py-2 border">
                        {r?.budgetCode ?? "-"}
                      </td>
                      <td className="px-2 py-2 text-right border">
                        {jumlahKegiatan
                          ? jumlahKegiatan.toLocaleString("id-ID")
                          : "-"}
                      </td>
                      {ri === 0 ? (
                        <>
                          <td
                            rowSpan={span}
                            className="px-2 py-2 text-right border"
                          >
                            {sbmlPegawai
                              ? sbmlPegawai.toLocaleString("id-ID")
                              : "-"}
                          </td>
                        </>
                      ) : null}
                      <td className="px-2 py-2 text-right border">
                        {Number.isFinite(selisihBerjalan)
                          ? selisihBerjalan.toLocaleString("id-ID")
                          : "-"}
                      </td>
                      <td className="px-2 py-2 border">
                        {r?.chiefName ?? "-"}
                      </td>
                      <td className="px-2 py-2 border">
                        {r?.dipa ?? "DIPA BPS Kabupaten Muara Enim"}
                      </td>
                    </tr>
                  );
                });
              })
            ) : (
              <tr>
                <td colSpan={17} className="px-2 py-2 text-center">
                  Pencarian "{q}" tidak ditemukan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SingleMonthDocCodeTable({
  year,
  activeMonth,
  rowsByMonth,
}: {
  year: number;
  activeMonth: number;
  rowsByMonth: Map<number, any[]>;
}) {
  const rowsMonth = rowsByMonth.get(activeMonth) ?? [];
  const rows = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of rowsMonth) {
      const key = String(r?.userId ?? r?.name ?? "-");
      if (!map.has(key)) {
        map.set(key, {
          userId: r?.userId,
          name: r?.name ?? "-",
          job_name: r?.job_name ?? "-",
          district: r?.district ?? "-",
          city: r?.city ?? "-",
          spkCode: r?.spkCode ?? "-",
          bastCode: r?.bastCode ?? "-",
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      String(a.name ?? "").localeCompare(String(b.name ?? ""), "id"),
    );
  }, [rowsMonth]);

  return (
    <div className="mt-3 overflow-auto border rounded-md overflow-y-auto max-h-[400px]">
      <table className="min-w-[760px] w-full text-[12px]">
        <thead className="bg-gray-50">
          <tr className="border-b">
            <th className="px-2 py-2 text-left w-[40px]">No</th>
            <th className="px-2 py-2 text-left">Nama Mitra</th>
            <th className="px-2 py-2 text-left">Pekerjaan</th>
            <th className="px-2 py-2 text-left">Kecamatan</th>
            <th className="px-2 py-2 text-left">Kabupaten</th>
            <th className="px-2 py-2 text-left">Kode SPK</th>
            <th className="px-2 py-2 text-left">Kode BAST</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr
                key={`${r.userId ?? r.name}-${i}`}
                className="border-b hover:bg-gray-50"
              >
                <td className="px-2 py-2 border">{i + 1}</td>
                <td className="px-2 py-2 border">{r.name}</td>
                <td className="px-2 py-2 border">{r.job_name}</td>
                <td className="px-2 py-2 border">{r.district}</td>
                <td className="px-2 py-2 border">{r.city}</td>
                <td className="px-2 py-2 border font-mono">{r.spkCode}</td>
                <td className="px-2 py-2 border font-mono">{r.bastCode}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="px-2 py-2 text-center text-gray-600">
                Belum ada kode SPK/BAST untuk bulan {activeMonth}/{year}.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const isActiveInThisMonth = (sub: any, now = new Date()) => {
  if (!sub?.startDate || !sub?.endDate) return false;

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  endOfMonth.setHours(23, 59, 59, 999);

  const s = new Date(sub.startDate);
  const e = new Date(sub.endDate);
  e.setHours(23, 59, 59, 999);

  return s <= endOfMonth && e >= startOfMonth;
};

function MonthlyStaffUsagePanel({
  year,
  setYear,
  onOpenUserActivities,
}: {
  year: number;
  setYear: (v: number) => void;
  onOpenUserActivities: (userId: string) => void | Promise<void>;
}) {
  const [activeMonth, setActiveMonth] = useState<number>(() => {
    const now = new Date();
    return now.getFullYear() === year ? now.getMonth() + 1 : 1;
  });
  const { data, loading, error, refetch } = useQuery(
    GET_MONTHLY_ACTIVITY_STAFF_USAGE,
    {
      variables: { year, month: activeMonth },
      fetchPolicy: "cache-and-network",
    },
  );

  const {
    data: exportPreviewData,
    loading: exportPreviewLoading,
    error: exportPreviewError,
    previousData: exportPreviewPreviousData,
    refetch: refetchExportPreview,
  } = useQuery(GET_MITRA_BULANAN_EXPORT, {
    variables: { year, month: activeMonth },
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });

  const exportPreviewRowsRaw = ((exportPreviewData ?? exportPreviewPreviousData)
    ?.getMitraBulananExport ?? []) as any[];

  useEffect(() => {
    const now = new Date();
    setActiveMonth(now.getFullYear() === year ? now.getMonth() + 1 : 1);
  }, [year]);

  const [fetchExport, { loading: exporting }] = useLazyQuery(
    GET_MITRA_BULANAN_EXPORT,
    {
      fetchPolicy: "network-only",
    },
  );

  const exportPreviewRows = exportPreviewRowsRaw;

  // ===== Default PPK (ditentukan Superadmin) =====
  const { data: ppkData } = useQuery(PPK_OPTIONS, {
    fetchPolicy: "cache-and-network",
  });

  const { data: docNumberConfigData } = useQuery(
    GET_MONTHLY_STAFF_DOC_NUMBER_CONFIG,
    { fetchPolicy: "cache-and-network" },
  );

  const [setDocNumberConfig, { loading: savingDocNumberConfig }] = useMutation(
    SET_MONTHLY_STAFF_DOC_NUMBER_CONFIG,
    { refetchQueries: [{ query: GET_MONTHLY_STAFF_DOC_NUMBER_CONFIG }] },
  );

  const [setDefaultPpkUser, { loading: savingDefaultPpk }] = useMutation(
    SET_DEFAULT_PPK_USER,
    {
      refetchQueries: [{ query: PPK_OPTIONS }],
    },
  );

  const defaultPpkId =
    (ppkData?.ppkOptions ?? []).find((x: any) => x?.isDefault)?.id ?? "";
  const [selectedDefaultPpkId, setSelectedDefaultPpkId] = useState<string>("");
  const [spkStartNumber, setSpkStartNumber] = useState<number>(1);
  const [bastStartNumber, setBastStartNumber] = useState<number>(1);
  const [spkFormat, setSpkFormat] = useState<string>(
    "{KODE}/16030/HK.600/{MM}/SPK/{YYYY}",
  );
  const [bastFormat, setBastFormat] = useState<string>(
    "{KODE}/16030/HK.600/{MM}/BAST/{YYYY}",
  );
  useEffect(() => {
    if (!selectedDefaultPpkId && defaultPpkId) {
      setSelectedDefaultPpkId(defaultPpkId);
    }
  }, [defaultPpkId, selectedDefaultPpkId]);

  useEffect(() => {
    const cfg = docNumberConfigData?.DocNumberConfig;
    if (!cfg) return;
    setSpkStartNumber(Number(cfg.spkStartNumber ?? 1));
    setBastStartNumber(Number(cfg.bastStartNumber ?? 1));
    setSpkFormat(
      String(cfg.spkFormat ?? "{KODE}/16030/HK.600/{MM}/SPK/{YYYY}"),
    );
    setBastFormat(
      String(cfg.bastFormat ?? "{KODE}/16030/HK.600/{MM}/BAST/{YYYY}"),
    );
  }, [docNumberConfigData]);

  const rows = (data?.getMonthlyActivityStaffUsage ?? []) as Array<{
    month: string;
    subSurveyActivityId: string;
    subSurveyName: string;
    startDate: string;
    endDate: string;
    staffCount: number;
    staffUsers?: Array<{ id: string; name?: string; email?: string }>;
  }>;

  const totalActivities = rows.length;

  const mitraRowsByMonth = useMemo(() => {
    const map = new Map<number, any[]>();
    const arr = [...exportPreviewRows].sort((a, b) => {
      const aa = String(a?.subsurveyactivity ?? "");
      const bb = String(b?.subsurveyactivity ?? "");
      if (aa !== bb) return aa.localeCompare(bb);
      return String(a?.name ?? "").localeCompare(String(b?.name ?? ""));
    });
    if (arr.length) {
      map.set(activeMonth, arr);
    }
    return map;
  }, [exportPreviewRows, activeMonth]);

  const uniqueUsersYear = useMemo(() => {
    const set = new Set<string>();

    for (const r of rows) {
      (r.staffUsers ?? []).forEach((u) => u?.id && set.add(u.id));
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
      (a.name ?? "").localeCompare(b.name ?? "", "id"),
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
  const { user: currentUser } = useUser();

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

  const fmtDateId = (d: any) => {
    if (!d) return "";
    const dt = new Date(d);
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yy = dt.getFullYear();
    return `${dd}/${mm}/${yy}`;
  };

  const handleExportExcel = async () => {
    try {
      const res = await fetchExport({ variables: { year } });
      if ((res as any)?.error) throw (res as any).error;
      if ((res as any)?.errors?.length)
        throw new Error(
          (res as any).errors[0]?.message || "Query export gagal",
        );

      const rowsRaw = (res.data?.getMitraBulananExport ?? []) as any[];
      const rowsUserOnly = rowsRaw;

      const monthNames = [
        "JANUARI",
        "FEBRUARI",
        "MARET",
        "APRIL",
        "MEI",
        "JUNI",
        "JULI",
        "AGUSTUS",
        "SEPTEMBER",
        "OKTOBER",
        "NOVEMBER",
        "DESEMBER",
      ];

      const fmtDate = (d: any) => {
        if (!d) return "";
        const dt = new Date(d);
        const dd = String(dt.getDate()).padStart(2, "0");
        const mm = String(dt.getMonth() + 1).padStart(2, "0");
        const yy = String(dt.getFullYear());
        return `${dd}/${mm}/${yy}`;
      };

      const groups = new Map<number, any[]>();
      for (const r of rowsUserOnly) {
        const m = Number(r.month ?? 1);
        if (!groups.has(m)) groups.set(m, []);
        groups.get(m)!.push(r);
      }

      const wb = new ExcelJS.Workbook();
      wb.created = new Date();

      const headerGreen = {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb: "FF6AA84F" },
      };

      const sepPink = {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb: "FFF4CCCC" },
      };

      const thinBorder = {
        top: { style: "thin" as const },
        left: { style: "thin" as const },
        bottom: { style: "thin" as const },
        right: { style: "thin" as const },
      };

      const columns = [
        { header: "NO", width: 5 },
        { header: "KODE SPK", width: 12 },
        { header: "KODE BAST", width: 12 },
        { header: "NAMA", width: 28 },
        { header: "PEKERJAAN", width: 24 },
        { header: "KECAMATAN", width: 18 },
        { header: "KABUPATEN", width: 18 },
        { header: "KEGIATAN", width: 42 },
        { header: "JANGKA WAKTU", width: 24 },
        { header: "VOL", width: 10 },
        { header: "SATUAN", width: 20 },
        { header: "HARGA SATUAN", width: 14 },
        { header: "NILAI PERJANJIAN", width: 18 },
        { header: "BEBAN ANGGARAN", width: 18 },
        { header: "JUMLAH", width: 14 },
        { header: "SBML", width: 12 },
        { header: "SELISIH", width: 12 },
        { header: "NAMA KETUA TIM/PENANGGUNG JAWAB", width: 32 },
        { header: "KETERANGAN ASAL DIPA", width: 26 },
      ];

      for (let m = 1; m <= 12; m++) {
        const data = (groups.get(m) ?? [])
          .slice()
          .sort((a, b) => (a?.name ?? "").localeCompare(b?.name ?? "", "id"));

        const sheetName = `${monthNames[m - 1]} HONOR ${year}`;
        const ws = wb.addWorksheet(sheetName, {
          views: [{ state: "frozen", ySplit: 2 }],
        });

        ws.columns = columns as any;

        // ===== Header baris 1 & 2 =====
        ws.getRow(1).values = [
          "NO",
          "KODE SPK",
          "KODE BAST",
          "NAMA",
          "PEKERJAAN",
          "KECAMATAN",
          "KABUPATEN",
          "KEGIATAN",
          "JANGKA WAKTU",
          "TARGET PEKERJAAN",
          "",
          "HARGA SATUAN",
          "NILAI PERJANJIAN",
          "BEBAN ANGGARAN",
          "JUMLAH",
          "SBML",
          "SELISIH",
          "NAMA KETUA TIM/PENANGGUNG JAWAB",
          "KETERANGAN ASAL DIPA",
        ];

        ws.getRow(2).values = [
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "VOL",
          "SATUAN",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ];

        const mergeDownCols = [
          1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
        ];
        for (const c of mergeDownCols) {
          ws.mergeCells(1, c, 2, c);
        }

        ws.mergeCells(1, 10, 1, 11);

        for (let r = 1; r <= 2; r++) {
          const row = ws.getRow(r);
          row.height = 20;
          row.eachCell((cell) => {
            cell.fill = headerGreen;
            cell.font = { bold: true, color: { argb: "FF000000" } };
            cell.alignment = {
              horizontal: "center",
              vertical: "middle",
              wrapText: true,
            };
            cell.border = thinBorder;
          });
        }

        // ===== Group per user =====
        const byUser = new Map<string, any[]>();
        for (const r of data) {
          const k = String(r?.userId ?? r?.name ?? "-");
          if (!byUser.has(k)) byUser.set(k, []);
          byUser.get(k)!.push(r);
        }

        const userGroups = Array.from(byUser.values()).sort((a, b) =>
          String(a?.[0]?.name ?? "").localeCompare(
            String(b?.[0]?.name ?? ""),
            "id",
          ),
        );

        let no = 1;
        let currentRow = 3;

        for (const list of userGroups) {
          const sorted = list.slice().sort((a, b) => {
            const da = new Date(a?.startDate ?? 0).getTime();
            const db = new Date(b?.startDate ?? 0).getTime();
            if (da !== db) return da - db;
            return String(a?.subsurveyactivity ?? "").localeCompare(
              String(b?.subsurveyactivity ?? ""),
              "id",
            );
          });

          const startUserRow = currentRow;
          const totalDocsBillUser = sorted.reduce(
            (acc, x) => acc + (Number(x?.docsBill ?? 0) || 0),
            0,
          );

          const limitUser = Number(sorted?.[0]?.limit_bill ?? 0) || 0;
          let runningHonor = 0;

          sorted.forEach((r: any) => {
            const vol = Number(r.totalAssigned ?? 0);
            const price = Number(r.unitWorkPrice ?? 0);
            const nilaiPerjanjian = vol * price;
            const docsBill = Number(r.docsBill ?? 0) || 0;
            const limit = Number(r.limit_bill ?? 0);
            runningHonor += docsBill;
            const selisih = limit - runningHonor;
            const jangkaWaktu = `${fmtDate(r.startDate)}-${fmtDate(r.endDate)}`;

            ws.getRow(currentRow).values = [
              no,
              r.spkCode ?? "",
              r.bastCode ?? "",
              r.name ?? "",
              r.job_name ?? "",
              r.district ?? "",
              r.city ?? "",
              r.subsurveyactivity ?? "",
              jangkaWaktu,
              vol,
              r.sampleType ?? "",
              price || "",
              nilaiPerjanjian || "",
              r.budgetCode ?? "",
              docsBill || 0,
              limit || 0,
              selisih || 0,
              r.chiefName ?? "",
              r.dipa ?? "DIPA BPS Kabupaten Muara Enim",
            ];

            ws.getRow(currentRow).eachCell((cell) => {
              cell.border = thinBorder;
              cell.alignment = {
                vertical: "middle",
                horizontal: "left",
                wrapText: true,
              };
            });

            [10, 12, 13, 15, 16, 17].forEach((c) => {
              ws.getCell(currentRow, c).alignment = {
                vertical: "middle",
                horizontal: "right",
              };
            });

            currentRow++;
          });

          const endUserRow = currentRow - 1;
          const span = endUserRow - startUserRow + 1;

          if (span > 1) {
            [1, 2, 3, 4, 5, 6, 7, 16].forEach((c) => {
              ws.mergeCells(startUserRow, c, endUserRow, c);
              ws.getCell(startUserRow, c).alignment = {
                vertical: "top",
                horizontal: c === 1 ? "center" : "left",
                wrapText: true,
              };
            });

            [16].forEach((c) => {
              ws.getCell(startUserRow, c).alignment = {
                vertical: "top",
                horizontal: "right",
                wrapText: true,
              };
            });
          }

          // ===== Baris pemisah (pink) =====
          const sepRow = ws.getRow(currentRow);
          sepRow.height = 10;
          for (let c = 1; c <= columns.length; c++) {
            const cell = ws.getCell(currentRow, c);
            cell.value = "";
            cell.fill = sepPink;
            cell.border = thinBorder;
          }
          currentRow++;
          no++;
        }
      }

      const filename = `Ekspor_Mitra_Bulanan_${year}.xlsx`;
      const buffer = await wb.xlsx.writeBuffer();

      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
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
            Pemakaian Mitra per Kegiatan (Bulanan)
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <HUSelect
            value={String(year)}
            onValueChange={(v: string | null) => {
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
            {exporting ? "Sedang Ekspor..." : "Ekspor Mitra Bulanan"}
          </button>
        </div>
      </div>

      {/* Default PPK */}
      {String((currentUser as any)?.primaryRole) === "Superadmin" && (
        <div className="space-y-3">
          <div className="border rounded-lg p-3 sm:p-4">
            <div className="text-sm font-semibold mb-2">Pilih PPK</div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="w-full sm:max-w-md">
                <HUSelect
                  value={selectedDefaultPpkId || null}
                  onValueChange={(v: string | null) =>
                    setSelectedDefaultPpkId(String(v ?? ""))
                  }
                  placeholder="Pilih default PPK"
                  options={
                    ((ppkData?.ppkOptions ?? []) as any[]).map((u) => ({
                      label: `${u?.name ?? "-"}${u?.nip ? ` (${u.nip})` : ""}`,
                      value: u?.id,
                    })) as HUSelectOption[]
                  }
                />
              </div>

              <button
                type="button"
                disabled={!selectedDefaultPpkId || savingDefaultPpk}
                onClick={async () => {
                  try {
                    await setDefaultPpkUser({
                      variables: { userId: selectedDefaultPpkId },
                    });
                    toast.success("Default PPK berhasil disimpan");
                  } catch (e: any) {
                    toast.error(e?.message ?? "Gagal menyimpan default PPK");
                  }
                }}
                className={[
                  "px-3 py-2 rounded-md text-sm font-semibold",
                  !selectedDefaultPpkId || savingDefaultPpk
                    ? "bg-gray-300 text-gray-700 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700",
                ].join(" ")}
              >
                {savingDefaultPpk ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
          <div className="border rounded-lg p-3 sm:p-4 space-y-3">
            <div>
              <div className="text-sm font-semibold">
                Format Nomor SPK dan BAST
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Token: {"{KODE}"} contoh B-001, {"{NO}"} contoh 001, {"{MM}"},{" "}
                {"{YYYY}"}, {"{DOC}"}.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Nomor awal SPK
                </label>
                <input
                  type="number"
                  min={1}
                  value={spkStartNumber}
                  onChange={(e) => setSpkStartNumber(Number(e.target.value))}
                  className="w-full rounded-md border px-3 py-2 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Nomor awal BAST
                </label>
                <input
                  type="number"
                  min={1}
                  value={bastStartNumber}
                  onChange={(e) => setBastStartNumber(Number(e.target.value))}
                  className="w-full rounded-md border px-3 py-2 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Format SPK
                </label>
                <input
                  value={spkFormat}
                  onChange={(e) => setSpkFormat(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm font-mono bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Format BAST
                </label>
                <input
                  value={bastFormat}
                  onChange={(e) => setBastFormat(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm font-mono bg-white"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={savingDocNumberConfig}
              onClick={async () => {
                try {
                  await setDocNumberConfig({
                    variables: {
                      spkStartNumber,
                      bastStartNumber,
                      spkFormat,
                      bastFormat,
                    },
                  });
                  toast.success("Format nomor SPK/BAST berhasil disimpan");
                } catch (e: any) {
                  toast.error(e?.message ?? "Gagal menyimpan format nomor");
                }
              }}
              className="px-3 py-2 rounded-md text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {savingDocNumberConfig ? "Menyimpan..." : "Simpan Format Nomor"}
            </button>
          </div>
        </div>
      )}

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

      {/* detail mitra bulanan */}
      <div className="border rounded-lg p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold">Pemakaian Mitra Bulanan</div>
          </div>
          {/* <div className="text-xs text-gray-500">
            {exportPreviewLoading
              ? "Memuat..."
              : `Total baris: ${exportPreviewRows.length}`}
          </div> */}
        </div>

        {exportPreviewError ? (
          <div className="mt-3 text-sm text-red-600">
            Gagal memuat data mitra bulanan:{" "}
            {(exportPreviewError as any)?.message ?? "unknown error"}
          </div>
        ) : exportPreviewLoading ? (
          <div className="mt-3 text-sm text-gray-600">
            Memuat data mitra bulanan...
          </div>
        ) : (
          <SingleMonthMitraTable
            year={year}
            activeMonth={activeMonth}
            setActiveMonth={setActiveMonth}
            rowsByMonth={mitraRowsByMonth}
          />
        )}
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

      <div className="border rounded-lg p-3 sm:p-4">
        <div className="font-semibold">Kode SPK dan BAST Mitra Bulanan</div>
        <SingleMonthDocCodeTable
          year={year}
          activeMonth={activeMonth}
          rowsByMonth={mitraRowsByMonth}
        />
      </div>

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

      {/* awal komentar */}
      {/* {loading && <div className="text-sm text-gray-600">Memuat data…</div>} */}
      {/* {error && (
        <div className="text-sm text-red-600">
          Gagal memuat: {error.message}
        </div>
      )} */}

      {/* {!loading && !error && grouped.length === 0 && (
        <div className="text-sm text-gray-600">
          Tidak ada kegiatan di tahun {year}.
        </div>
      )} */}

      {/* per bulan */}
      {/* <div className="space-y-4">
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
      </div> */}
      {/* akhir komentar      */}

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
                        (a.name ?? "").localeCompare(b.name ?? "", "id"),
                      )
                      .map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={async () => {
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
  const { user: currentUser, loading: userLoading } = useUser();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [usersPage, setUsersPage] = useState(1);
  const USERS_PAGE_SIZE = 25;
  const { data, loading, error, refetch } = useQuery(GET_USERS_PAGE, {
    variables: {
      page: usersPage,
      pageSize: USERS_PAGE_SIZE,
      search: deferredSearchTerm.trim() || null,
    },
    fetchPolicy: "cache-and-network",
  });
  const users = data?.getUsersPage?.items ?? [];
  const totalUsers = Number(data?.getUsersPage?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalUsers / USERS_PAGE_SIZE));

  const [roleDraft, setRoleDraft] = useState<Record<string, string[]>>({});
  const [primaryDraft, setPrimaryDraft] = useState<Record<string, string>>({});

  const ALLOWED = new Set(["Superadmin", "Keuangan"]);

  const roles = getRoles(currentUser);
  const isAllowed = roles.some((r) => ALLOWED.has(r));
  const isSuperadmin = roles.includes("Superadmin");

  const canViewSignupCode = !!currentUser && isAllowed;

  const {
    data: dailyCodeData,
    loading: dailyCodeLoading,
    refetch: refetchDailyCode,
  } = useQuery(GET_DAILY_SIGNUP_CODE, {
    fetchPolicy: "cache-and-network",
    skip: !canViewSignupCode,
  });

  const [rotateDailySignupCode, { loading: rotatingCode }] = useMutation(
    ROTATE_DAILY_SIGNUP_CODE,
  );

  const dailySignupCode = dailyCodeData?.getDailySignupCode?.code as
    | string
    | undefined;
  const dailySignupDate = dailyCodeData?.getDailySignupCode?.dateKey as
    | string
    | undefined;

  const copyDailyCode = useCallback(async () => {
    if (!dailySignupCode) return;
    try {
      await navigator.clipboard.writeText(dailySignupCode);
      toast.success("Kode berhasil disalin");
    } catch {
      toast.error("Gagal menyalin kode");
    }
  }, [dailySignupCode]);

  const regenerateDailyCode = useCallback(async () => {
    if (!isSuperadmin) {
      toast.error("Hanya Superadmin yang bisa regenerate");
      return;
    }
    try {
      await rotateDailySignupCode();
      await refetchDailyCode();
      toast.success("Kode hari ini berhasil diperbarui");
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal memperbarui kode");
    }
  }, [isSuperadmin, rotateDailySignupCode, refetchDailyCode]);

  React.useEffect(() => {
    if (userLoading) return;

    if (!isAllowed) {
      toast.error("Akses ditolak. Mengarahkan ke Beranda");
      router.replace("/dashboard");
    }
  }, [userLoading, isAllowed, router]);

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
    [router, pathname, searchParams],
  );

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

  useEffect(() => {
    setUsersPage(1);
  }, [deferredSearchTerm]);

  const handleLimitChange = (id: string, val: string) => {
    const clean = digitsOnly(val);
    setPendingLimit((p) => ({ ...p, [id]: clean }));
  };

  const handleReset = (id: string) => {
    setPendingLimit((p) => {
      const { [id]: __, ...rest } = p;
      return rest;
    });

    setRoleDraft((p) => {
      const { [id]: _, ...rest } = p;
      return rest;
    });
    setPrimaryDraft((p) => {
      const { [id]: _, ...rest } = p;
      return rest;
    });
  };

  const handleSave = useCallback(
    async (user: any) => {
      const newLimitStr = pendingLimit[user.id];
      const currentLimit = Number(user.limit_bill ?? user.limitBill ?? 0);

      const newLimitNum =
        typeof newLimitStr === "string" && newLimitStr.length > 0
          ? toInt(newLimitStr)
          : null;

      // ===== role (multi) =====
      const currentRolesRaw: string[] = Array.isArray(user.roles)
        ? user.roles
        : user.primaryRole
          ? [user.primaryRole]
          : user.role
            ? [user.role]
            : [];

      const draftRolesRaw: string[] =
        roleDraft[user.id] ??
        (Array.isArray(user.roles)
          ? user.roles
          : user.primaryRole
            ? [user.primaryRole]
            : user.role
              ? [user.role]
              : []);

      const currentPrimary = user.primaryRole ?? currentRolesRaw[0] ?? "User";
      const draftPrimary =
        typeof primaryDraft[user.id] === "string"
          ? primaryDraft[user.id]
          : currentPrimary;

      const normalize = (arr: string[]) =>
        Array.from(new Set((arr ?? []).filter(Boolean))).sort();

      const currentRoles = normalize(currentRolesRaw);
      const draftRoles = normalize(
        draftRolesRaw.length ? draftRolesRaw : ["User"],
      );

      const dirtyRole =
        JSON.stringify(draftRoles) !== JSON.stringify(currentRoles) ||
        String(draftPrimary ?? "") !== String(currentPrimary ?? "");

      const dirtyLimit =
        newLimitNum !== null &&
        Number.isFinite(newLimitNum) &&
        newLimitNum !== currentLimit;

      if (!dirtyRole && !dirtyLimit) return;

      setUpdating((u) => ({ ...u, [user.id]: true }));

      let okRole = false,
        okLimit = false;

      if (dirtyRole) {
        try {
          await updateRole({
            variables: {
              userId: user.id,
              updateRole: {
                name: user.name,
                roles: draftRoles,
                primaryRole: draftPrimary,
              },
            },
          });

          okRole = true;

          setRoleDraft((p) => {
            const { [user.id]: _, ...rest } = p;
            return rest;
          });
          setPrimaryDraft((p) => {
            const { [user.id]: _, ...rest } = p;
            return rest;
          });
        } catch (e) {
          console.error("Update role gagal:", e);
          toast.error("Gagal memperbarui role. Silakan coba lagi.");
        }
      }

      if (dirtyLimit) {
        try {
          await updateBillLimit({
            variables: {
              userId: user.id,
              updateBillLimit: {
                name: user.name,
                limit_bill: String(newLimitNum),
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
    [
      pendingLimit,
      roleDraft,
      primaryDraft,
      updateRole,
      updateBillLimit,
      refetch,
    ],
  );

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
    const u = users.find((x: any) => x.id === userId) ?? {
      id: userId,
      name: "-",
      email: "-",
    };

    setActiveTab("users");

    await openHonorModal(u);
  };

  const closeHonorModal = () => setHonorUser(null);

  const honorRows: any[] = honorData?.userProgressSurveyByUserId ?? [];
  const honorRowsActive = useMemo(() => {
    return honorRows.filter((r) => isActiveInThisMonth(r.subSurveyActivity));
  }, [honorRows]);
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
    for (const r of honorRowsActive) {
      const key = r.subSurveyActivityId || "unknown";
      const prev = map.get(key);
      const add = Number(r.docsBill ?? 0);
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
      a.subName.localeCompare(b.subName, "id"),
    );
  }, [honorRowsActive]);

  const honorGrandTotal = useMemo(
    () => honorGrouped.reduce((acc, it) => acc + it.total, 0),
    [honorGrouped],
  );

  const honorGroupedHistory = useMemo(() => {
    const map = new Map<
      string,
      {
        subId: string;
        subName: string;
        activityType?: string;
        district?: string;
        lastUpdated: string;
        count: number;
        total: number;
      }
    >();
    for (const r of honorRows) {
      const key = r.subSurveyActivityId || "unknown";
      const prev = map.get(key);
      const add = Number(r.docsBill ?? 0);
      const limitBill = Number(honorData?.user?.limit_bill ?? 0);
      if (prev) {
        prev.count += 1;
        prev.total += add;
      } else {
        map.set(key, {
          subId: key,
          subName: r.subSurveyActivity?.name ?? "(Tanpa nama)",
          activityType: r.subSurveyActivity?.activityType,
          district: r.district?.name,
          lastUpdated: r.lastUpdated,
          count: 1,
          total: add,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.subName.localeCompare(b.subName, "id"),
    );
  }, [honorRows]);

  const limitBill = useMemo(() => {
    const direct = Number(honorUser?.limit_bill ?? honorUser?.limitBill ?? NaN);
    if (Number.isFinite(direct)) return direct;
    const fromRow = Number(honorRows?.[0]?.user?.limit_bill ?? NaN);
    return Number.isFinite(fromRow) ? fromRow : 0;
  }, [honorUser, honorRows]);

  const usedTotal = honorGrandTotal;
  const remain = Math.max(0, limitBill - usedTotal);

  if (userLoading) {
    return (
      <div className="max-w-screen-xl mx-auto px-3 py-6 font-Poppins">
        Memuat…
      </div>
    );
  }

  if (!currentUser || !isAllowed) {
    return null;
  }

  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-6 md:px-8 py-4 font-Poppins">
      {/* Header */}
      <div className="bg-orange-50 rounded-lg p-3 md:p-4 font-bold text-lg md:text-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-md mb-4">
        <span>Panel Kontrol Pengguna</span>
        <div className="flex flex-col gap-2">
          {canViewSignupCode && (
            <div className="flex flex-wrap items-center gap-2 text-xs font-normal">
              <span className="inline-flex items-center gap-2 rounded-md border bg-white/70 px-2 py-1">
                <span className="text-gray-600">Kode daftar:</span>
                {/* <span className="text-gray-600">
                  {dailySignupDate ? `(${dailySignupDate})` : ""}
                </span> */}
                <span className="font-mono font-semibold tracking-widest">
                  {dailyCodeLoading ? "MEMUAT…" : (dailySignupCode ?? "-")}
                </span>
              </span>
              <button
                type="button"
                onClick={copyDailyCode}
                disabled={!dailySignupCode || dailyCodeLoading}
                className="rounded-md border bg-white px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
              >
                Copy
              </button>
              {isSuperadmin && (
                <button
                  type="button"
                  onClick={regenerateDailyCode}
                  disabled={rotatingCode || dailyCodeLoading}
                  className="rounded-md border bg-white px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
                >
                  {rotatingCode ? "Regenerate…" : "Regenerate"}
                </button>
              )}
              <span className="text-gray-500">Kode berubah tiap hari.</span>
            </div>
          )}
        </div>
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
                      {!loading && !error && users.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-6 py-6 text-center text-gray-500"
                          >
                            Tidak ada pengguna cocok dengan "{searchTerm}"
                          </td>
                        </tr>
                      )}

                      {users.map((user: any) => {
                        const baseLimit = Number(
                          user.limit_bill ?? user.limitBill ?? 0,
                        );
                        const limitPending = pendingLimit[user.id];
                        const effectiveLimit =
                          limitPending ?? String(baseLimit);

                        const currentRolesRaw: string[] = Array.isArray(
                          user.roles,
                        )
                          ? user.roles
                          : user.primaryRole
                            ? [user.primaryRole]
                            : user.role
                              ? [user.role]
                              : [];

                        const draftRolesRaw: string[] =
                          roleDraft[user.id] ??
                          (Array.isArray(user.roles)
                            ? user.roles
                            : user.primaryRole
                              ? [user.primaryRole]
                              : user.role
                                ? [user.role]
                                : []);

                        const normalize = (arr: string[]) =>
                          Array.from(
                            new Set((arr ?? []).filter(Boolean)),
                          ).sort();

                        const currentRoles = normalize(currentRolesRaw);
                        const draftRoles = normalize(
                          draftRolesRaw.length ? draftRolesRaw : ["User"],
                        );

                        const currentPrimary =
                          user.primaryRole ?? currentRolesRaw[0] ?? "User";
                        const draftPrimary =
                          typeof primaryDraft[user.id] === "string" &&
                          primaryDraft[user.id].length > 0
                            ? primaryDraft[user.id]
                            : currentPrimary;

                        const dirtyRole =
                          JSON.stringify(draftRoles) !==
                            JSON.stringify(currentRoles) ||
                          String(draftPrimary ?? "") !==
                            String(currentPrimary ?? "");

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

                            {/* ROLE (multi) */}
                            <td className="px-4 md:px-6 py-3 align-middle">
                              {(() => {
                                const baseRoles: string[] =
                                  roleDraft[user.id] ??
                                  (Array.isArray(user.roles)
                                    ? user.roles
                                    : user.primaryRole
                                      ? [user.primaryRole]
                                      : user.role
                                        ? [user.role]
                                        : []);

                                const basePrimary =
                                  primaryDraft[user.id] ??
                                  user.primaryRole ??
                                  baseRoles[0] ??
                                  "User";

                                const toggleRole = (r: string) => {
                                  if (!isSuperadmin) return;

                                  const next = baseRoles.includes(r)
                                    ? baseRoles.filter((x) => x !== r)
                                    : [...baseRoles, r];

                                  const safeNext = next.length
                                    ? next
                                    : ["User"];

                                  setRoleDraft((p) => ({
                                    ...p,
                                    [user.id]: safeNext,
                                  }));

                                  if (!safeNext.includes(basePrimary)) {
                                    setPrimaryDraft((p) => ({
                                      ...p,
                                      [user.id]: safeNext[0],
                                    }));
                                  }
                                };

                                return (
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap gap-2">
                                      {ALL_ROLES.map((r) => {
                                        const active = baseRoles.includes(r);
                                        const primary = basePrimary === r;

                                        return (
                                          <div
                                            key={r}
                                            className="flex items-center gap-1"
                                          >
                                            <button
                                              type="button"
                                              disabled={!isSuperadmin}
                                              onClick={() => toggleRole(r)}
                                              className={[
                                                "px-3 py-1.5 rounded-full border text-xs font-semibold transition",
                                                active
                                                  ? "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                                                  : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100",
                                                !isSuperadmin
                                                  ? "opacity-60 cursor-not-allowed"
                                                  : "",
                                              ].join(" ")}
                                              title={
                                                active
                                                  ? "Klik untuk nonaktifkan role"
                                                  : "Klik untuk aktifkan role"
                                              }
                                            >
                                              {getRoleLabel(r)}
                                            </button>

                                            {active && (
                                              <button
                                                type="button"
                                                disabled={!isSuperadmin}
                                                onClick={() =>
                                                  setPrimaryDraft((p) => ({
                                                    ...p,
                                                    [user.id]: r,
                                                  }))
                                                }
                                                className={[
                                                  "h-7 w-7 inline-flex items-center justify-center rounded-full border text-xs transition",
                                                  primary
                                                    ? "bg-yellow-50 border-yellow-300 text-yellow-600"
                                                    : "bg-white border-gray-200 text-gray-400 hover:text-gray-600",
                                                  !isSuperadmin
                                                    ? "opacity-60 cursor-not-allowed"
                                                    : "",
                                                ].join(" ")}
                                                title={
                                                  primary
                                                    ? "Primary role"
                                                    : "Jadikan primary"
                                                }
                                                aria-label={
                                                  primary
                                                    ? "Primary role"
                                                    : "Jadikan primary"
                                                }
                                              >
                                                {primary ? "⭐" : "☆"}
                                              </button>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>

                                    <div className="text-[11px] text-gray-500">
                                      Klik role untuk aktif/nonaktif. Klik ⭐
                                      untuk menjadikan primary.
                                    </div>
                                  </div>
                                );
                              })()}
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
                                    Number(effectiveLimit || "0"),
                                  )}
                                  onChange={(e) =>
                                    handleLimitChange(user.id, e.target.value)
                                  }
                                  onFocus={(e) =>
                                    e.currentTarget.setSelectionRange(
                                      0,
                                      e.currentTarget.value.length,
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
                                  className={`border-blue-700 bg-blue-700 ${
                                    !dirty || isSaving
                                      ? ""
                                      : "hover:bg-blue-600"
                                  }`}
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
                                  className={`border-red-700 bg-red-700 ${
                                    !dirty || isSaving ? "" : "hover:bg-red-600"
                                  }`}
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
                <div className="text-gray-600">
                  Menampilkan {users.length} dari {totalUsers} pengguna
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={usersPage <= 1}
                    onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-2 rounded border disabled:opacity-50"
                  >
                    Sebelumnya
                  </button>
                  <div className="min-w-[110px] text-center">
                    Halaman {usersPage} / {totalPages}
                  </div>
                  <button
                    type="button"
                    disabled={usersPage >= totalPages}
                    onClick={() =>
                      setUsersPage((p) => Math.min(totalPages, p + 1))
                    }
                    className="px-3 py-2 rounded border disabled:opacity-50"
                  >
                    Berikutnya
                  </button>
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
                                <th className="px-4 py-2 text-right">Blok</th>
                                <th className="px-4 py-2 text-right">Honor</th>
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
                                    {fmtID.format(g.total)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-gray-50 border-t">
                                <td className="px-4 py-3 font-bold" colSpan={3}>
                                  Total Akumulasi Honor
                                </td>
                                <td className="px-4 py-3 text-right font-bold">
                                  {fmtID.format(honorGrandTotal)}
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
                                  <th className="px-3 py-2">Kecamatan</th>
                                  <th className="px-3 py-2 text-right">Blok</th>
                                  <th className="px-3 py-2 text-right">
                                    Honor
                                  </th>
                                  <th className="px-3 py-2">Terakhir diubah</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white">
                                {honorGroupedHistory.map((r, idx) => (
                                  <tr key={r.subId ?? idx} className="border-t">
                                    <td className="px-3 py-2">
                                      {r.subName ?? "-"}
                                    </td>
                                    <td className="px-3 py-2">
                                      {r.activityType ?? "-"}
                                    </td>
                                    <td className="px-3 py-2">
                                      {r.district ?? "-"}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      {fmtID.format(r.count ?? 0)}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      {fmtID.format(Number(r.total ?? 0))}
                                    </td>
                                    <td className="px-3 py-2">
                                      {r.lastUpdated
                                        ? new Date(
                                            r.lastUpdated,
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
