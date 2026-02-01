"use client";

import React, { useMemo, useState } from "react";
import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";
import toast from "react-hot-toast";
import HUComboBox, { HUOption } from "@/src/components/HUCombobox";
import useUser from "@/src/hooks/useUser";
import { hasAnyRole } from "@/src/utils/roles";
import styles from "@/src/utils/style";
import { GET_ALL_USERS } from "@/src/graphql/actions/find-allusers.action";
import { GET_MONTHLY_STAFF_DOC_PREVIEW } from "@/src/graphql/actions/get-monthly-staff-doc-preview.action";
import { GENERATE_MONTHLY_STAFF_DOCS } from "@/src/graphql/actions/generate-monthly-staff-docs.action";

type PreviewRow = {
  subSurveyActivityId: string;
  activityName: string;
  startDate: string;
  endDate: string;
  eligible: boolean;
  totalDocs: number;
  totalHonor: number;
  unitCost: number;
  budgetCode?: string | null;
};

type EditableRow = PreviewRow & {
  editTotalDocs: number;
  editUnitCost: number;
  editTotalCost: number;
  editBudgetCode: string;
};

function toNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function monthName(id: number) {
  const names = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  return names[id - 1] ?? String(id);
}

export default function BastSpkPage() {
  const { user } = useUser();
  const canAccess = hasAnyRole(user, ["Superadmin", "Admin", "Keuangan"]);

  const { data: usersData, loading: usersLoading } = useQuery(GET_ALL_USERS);
  const users = usersData?.getUsers ?? [];

  const userOptions: HUOption[] = useMemo(() => {
    return users
      .filter((u: any) => !!u?.id)
      .map((u: any) => ({
        value: u.id,
        label: u.name,
        subLabel: u.email,
      }));
  }, [users]);

  const now = new Date();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());

  const [docDate, setDocDate] = useState<string>(now.toISOString().slice(0, 10));
  const [ppkName, setPpkName] = useState<string>("");
  const [ppkNip, setPpkNip] = useState<string>("");

  // User hanya isi digit awal (nomor urut). Suffix otomatis mengikuti bulan & tahun.
  const [nomorUrutSpk, setNomorUrutSpk] = useState<string>("");
  const [nomorUrutBast, setNomorUrutBast] = useState<string>("");

  const mm = String(month).padStart(2, "0");
  const suffixSPK = `/BPS1603/PPK/SPK/${mm}/${year}`;
  const suffixBAST = `/BPS1603/PPK/BAST/${mm}/${year}`;

  const nomorSPK = nomorUrutSpk ? `${nomorUrutSpk}${suffixSPK}` : "";
  const nomorBAST = nomorUrutBast ? `${nomorUrutBast}${suffixBAST}` : "";

  const [rows, setRows] = useState<EditableRow[]>([]);

  const [loadPreview, { loading: previewLoading }] = useLazyQuery(
    GET_MONTHLY_STAFF_DOC_PREVIEW,
    {
      fetchPolicy: "no-cache",
      onCompleted: (res) => {
        const data: PreviewRow[] = res?.getMonthlyStaffDocPreview ?? [];
        const mapped: EditableRow[] = data.map((r) => {
          const editTotalDocs = toNumber(r.totalDocs);
          const editUnitCost = toNumber(r.unitCost);
          const editTotalCost = Number((editTotalDocs * editUnitCost).toFixed(2));
          return {
            ...r,
            editTotalDocs,
            editUnitCost,
            editTotalCost,
            editBudgetCode: String(r.budgetCode ?? ""),
          };
        });
        setRows(mapped);
        if (mapped.length === 0) toast("Tidak ada kegiatan pada periode ini.");
      },
      onError: (e) => toast.error(e.message),
    }
  );

  const [generateDocs, { loading: generating }] = useMutation(
    GENERATE_MONTHLY_STAFF_DOCS,
    {
      fetchPolicy: "no-cache",
      onError: (e) => toast.error(e.message),
    }
  );

  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null;
    return users.find((u: any) => u.id === selectedUserId) ?? null;
  }, [selectedUserId, users]);

  const eligibleCount = useMemo(() => rows.filter((r) => r.eligible).length, [rows]);

  const onRecalcRow = (idx: number, next: Partial<EditableRow>) => {
    setRows((prev) => {
      const clone = [...prev];
      const cur = clone[idx];
      const merged = { ...cur, ...next };

      const td = toNumber(merged.editTotalDocs);
      const uc = toNumber(merged.editUnitCost);
      merged.editTotalCost = Number((td * uc).toFixed(2));

      clone[idx] = merged;
      return clone;
    });
  };

  /**
   * ✅ Generate SPK+BAST via GraphQL (storage Google Drive).
   */
  const handleGenerateAndOpen = async () => {
    if (!selectedUserId) return toast.error("Petugas belum dipilih.");
    if (!ppkName.trim()) return toast.error("Nama PPK wajib diisi.");
    if (!ppkNip.trim()) return toast.error("NIP PPK wajib diisi.");
    if (!nomorUrutSpk.trim()) return toast.error("Nomor urut SPK wajib diisi.");
    if (!nomorUrutBast.trim()) return toast.error("Nomor urut BAST wajib diisi.");

    const eligibleRows = rows
      .filter((r) => r.eligible)
      .map((r) => ({
        subSurveyActivityId: r.subSurveyActivityId,
        totalDocs: toNumber(r.editTotalDocs),
        unitCost: toNumber(r.editUnitCost),
        totalCost: toNumber(r.editTotalCost),
        budgetCode: String(r.editBudgetCode || ""),
      }));

    if (eligibleRows.length === 0) {
      return toast.error("Tidak ada kegiatan eligible untuk dibuat dokumen.");
    }

    const input = {
      userId: selectedUserId,
      month,
      year,
      ppkName: ppkName.trim(),
      ppkNip: ppkNip.trim(),
      nomorSPK,
      nomorBAST,
      docDate: new Date(docDate), // GraphQLISODateTime
      rows: eligibleRows,
    };

    const res = await generateDocs({ variables: { input } });
    const out = res.data?.generateMonthlyStaffDocs;

    const spkUrl = out?.spkUrl;
    const bastUrl = out?.bastUrl;

    if (!spkUrl || !bastUrl) {
      return toast.error("Gagal membuat dokumen. URL tidak ditemukan.");
    }

    // Buka dua dokumen (Drive link).
    window.open(spkUrl, "_blank");
    window.open(bastUrl, "_blank");

    toast.success("Dokumen berhasil dibuat.");
  };

  if (!canAccess) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">BAST & SPK</h1>
        <p className="mt-2 text-red-600">Akses ditolak.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">BAST & SPK</h1>
        <p className="text-gray-600 mt-1">
          Preview kegiatan bulanan petugas (berdasarkan startDate). Dokumen hanya dibuat untuk kegiatan yang sudah selesai (endDate).
        </p>
      </div>

      {/* FILTER */}
      <div className="bg-white rounded-lg border p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Petugas</label>
            <HUComboBox
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              options={userOptions}
              placeholder={usersLoading ? "Memuat..." : "Pilih petugas"}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Bulan</label>
            <select
              className="w-full rounded-md border px-3 py-2 bg-white"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {monthName(i + 1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Tahun</label>
            <input
              className="w-full rounded-md border px-3 py-2 bg-white"
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Tanggal Dokumen</label>
            <input
              className="w-full rounded-md border px-3 py-2 bg-white"
              type="date"
              value={docDate}
              onChange={(e) => setDocDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Nama PPK</label>
            <input
              className="w-full rounded-md border px-3 py-2 bg-white"
              value={ppkName}
              onChange={(e) => setPpkName(e.target.value)}
              placeholder="Nama PPK"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">NIP PPK</label>
            <input
              className="w-full rounded-md border px-3 py-2 bg-white"
              value={ppkNip}
              onChange={(e) => setPpkNip(e.target.value)}
              placeholder="Contoh: 1987xxxxxxxxxxxx"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Nomor SPK (format lengkap)</label>
            <div className="flex items-center">
              <input
                className="w-28 rounded-r-none border px-3 py-2 bg-white font-mono"
                value={nomorUrutSpk}
                onChange={(e) => setNomorUrutSpk(e.target.value.replace(/\D/g, ""))}
                placeholder="123"
                inputMode="numeric"
              />
              <span className="border border-l-0 rounded-l-none rounded-md px-3 py-2 bg-gray-50 font-mono text-sm whitespace-nowrap">
                {suffixSPK}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Nomor BAST (format lengkap)</label>
            <div className="flex items-center">
              <input
                className="w-28 rounded-r-none border px-3 py-2 bg-white font-mono"
                value={nomorUrutBast}
                onChange={(e) => setNomorUrutBast(e.target.value.replace(/\D/g, ""))}
                placeholder="7"
                inputMode="numeric"
              />
              <span className="border border-l-0 rounded-l-none rounded-md px-3 py-2 bg-gray-50 font-mono text-sm whitespace-nowrap">
                {suffixBAST}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            className={`${styles.button} !w-auto`}
            onClick={() => {
              if (!selectedUserId) return toast.error("Pilih petugas dulu.");
              loadPreview({ variables: { userId: selectedUserId, month, year } });
            }}
            disabled={previewLoading}
          >
            {previewLoading ? "Memuat..." : "Tampilkan Kegiatan"}
          </button>
        </div>

        {selectedUser && (
          <div className="text-sm text-gray-700">
            Petugas: <span className="font-semibold">{selectedUser.name}</span> | Periode:{" "}
            <span className="font-semibold">{monthName(month)} {year}</span> | Kegiatan selesai:{" "}
            <span className="font-semibold">{eligibleCount}</span>
          </div>
        )}
      </div>

      {/* TABEL PREVIEW */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Preview Kegiatan</h2>
          <span className="text-sm text-gray-600">Editable hanya untuk kegiatan selesai.</span>
        </div>

        <div className="overflow-auto">
          <table className="min-w-[1100px] w-full text-sm border">
            <thead className="bg-gray-50">
              <tr>
                <th className="border p-2 text-left">Kegiatan</th>
                <th className="border p-2">Start</th>
                <th className="border p-2">End</th>
                <th className="border p-2">Status</th>
                <th className="border p-2">Jml Dokumen</th>
                <th className="border p-2">Total Honor</th>
                <th className="border p-2">Biaya/Dok</th>
                <th className="border p-2">Total Biaya</th>
                <th className="border p-2">Kode Beban</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="border p-3 text-center text-gray-600" colSpan={9}>
                    Belum ada data. Klik “Tampilkan Kegiatan”.
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => {
                  const disabled = !r.eligible;
                  return (
                    <tr key={r.subSurveyActivityId} className={disabled ? "opacity-60" : ""}>
                      <td className="border p-2">{r.activityName}</td>
                      <td className="border p-2 text-center">{String(r.startDate).slice(0, 10)}</td>
                      <td className="border p-2 text-center">{String(r.endDate).slice(0, 10)}</td>
                      <td className="border p-2 text-center">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            r.eligible ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {r.eligible ? "Selesai" : "Belum selesai"}
                        </span>
                      </td>

                      <td className="border p-2 text-center">
                        <input
                          className="w-24 border rounded px-2 py-1 bg-white text-right"
                          type="number"
                          disabled={disabled}
                          value={r.editTotalDocs}
                          onChange={(e) => onRecalcRow(idx, { editTotalDocs: toNumber(e.target.value) })}
                        />
                      </td>

                      <td className="border p-2 text-right">
                        {toNumber(r.totalHonor).toLocaleString("id-ID")}
                      </td>

                      <td className="border p-2 text-center">
                        <input
                          className="w-28 border rounded px-2 py-1 bg-white text-right"
                          type="number"
                          disabled={disabled}
                          value={r.editUnitCost}
                          onChange={(e) => onRecalcRow(idx, { editUnitCost: toNumber(e.target.value) })}
                        />
                      </td>

                      <td className="border p-2 text-center">
                        <input
                          className="w-32 border rounded px-2 py-1 bg-white text-right"
                          type="number"
                          disabled={disabled}
                          value={r.editTotalCost}
                          onChange={(e) => onRecalcRow(idx, { editTotalCost: toNumber(e.target.value) })}
                        />
                      </td>

                      <td className="border p-2">
                        <input
                          className="w-full border rounded px-2 py-1 bg-white"
                          disabled={disabled}
                          value={r.editBudgetCode}
                          onChange={(e) =>
                            setRows((prev) => {
                              const clone = [...prev];
                              clone[idx] = { ...clone[idx], editBudgetCode: e.target.value };
                              return clone;
                            })
                          }
                          placeholder="Kode beban anggaran"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            className={`${styles.button} !w-auto`}
            disabled={generating || !selectedUserId || eligibleCount === 0}
            onClick={handleGenerateAndOpen}
          >
            {generating ? "Membuat dokumen..." : "Generate & Download (SPK+BAST)"}
          </button>
        </div>

        {eligibleCount === 0 && rows.length > 0 && (
          <p className="mt-3 text-sm text-yellow-700">
            Tidak ada kegiatan selesai pada periode ini. Dokumen belum bisa dibuat.
          </p>
        )}
      </div>
    </div>
  );
}
