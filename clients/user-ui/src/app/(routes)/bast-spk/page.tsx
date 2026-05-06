"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useLazyQuery, useMutation, useQuery } from "@apollo/client";
import toast from "react-hot-toast";
import HUComboBox, { HUOption } from "@/src/components/HUCombobox";
import useUser from "@/src/hooks/useUser";
import { hasAnyRole } from "@/src/utils/roles";
import styles from "@/src/utils/style";
import { GET_ALL_USERS } from "@/src/graphql/actions/find-allusers.action";
import { GET_MONTHLY_STAFF_DOC_PREVIEW } from "@/src/graphql/actions/get-monthly-staff-doc-preview.action";
import { GENERATE_MONTHLY_STAFF_DOCS } from "@/src/graphql/actions/generate-monthly-staff-docs.action";
import { PPK_OPTIONS } from "@/src/graphql/actions/users.ppkOptions.gql";
import { GET_MONTHLY_ADMIN_DOC_RECAP_BY_USER_MONTH } from "@/src/graphql/actions/get-monthly-admin-doc-recap-by-user-month.action";
import { GET_MONTHLY_DOC_NUMBER_SUGGESTION } from "@/src/graphql/actions/get-monthly-doc-number-suggestion.action";

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
  unitName: string;
  editUnitName: string;
  included: boolean;
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
  const { data: ppkData } = useQuery(PPK_OPTIONS);

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
  const [petugasJobName, setPetugasJobName] = useState<string>("");
  const [petugasVillageName, setPetugasVillageName] = useState<string>("");
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());

  const [spkDocDate, setSpkDocDate] = useState<string>(
    now.toISOString().slice(0, 10),
  );
  const [bastDocDate, setBastDocDate] = useState<string>(
    now.toISOString().slice(0, 10),
  );
  const [ppkName, setPpkName] = useState<string>("");
  const [ppkNip, setPpkNip] = useState<string>("");
  const [nomorSPK, setNomorSPK] = useState<string>("");
  const [nomorBAST, setNomorBAST] = useState<string>("");
  const [spkUrl, setSpkUrl] = useState<string | null>(null);
  const [bastUrl, setBastUrl] = useState<string | null>(null);
  const [expiresAtInfo, setExpiresAtInfo] = useState<string>("");
  const [ppkUserId, setPpkUserId] = useState<string>("");

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
          const editTotalCost = Number(
            (editTotalDocs * editUnitCost).toFixed(2),
          );
          return {
            ...r,
            editTotalDocs,
            editTotalCost,
            editUnitCost,
            editUnitName: "Dokumen",
            unitName: "Dokumen",
            included: r.eligible,
          };
        });
        setRows(mapped);
        if (mapped.length === 0) toast("Tidak ada kegiatan pada periode ini.");
      },
      onError: (e) => toast.error(e.message),
    },
  );

  const [generateDocs, { loading: genLoading }] = useMutation(
    GENERATE_MONTHLY_STAFF_DOCS,
    {
      onCompleted: (res) => {
        const out = res?.generateMonthlyStaffDocs;
        if (!out?.spkUrl || !out?.bastUrl) {
          return toast.error("URL dokumen tidak ditemukan.");
        }
        setNomorSPK(out?.nomorSPK ?? "");
        setNomorBAST(out?.nomorBAST ?? "");
        if (out?.expiresAt) {
          const dt = new Date(out.expiresAt);
          setExpiresAtInfo(dt.toLocaleString());
        } else {
          setExpiresAtInfo("");
        }
        setSpkUrl(out?.spkUrl ?? null);
        setBastUrl(out?.bastUrl ?? null);
        toast.success("SPK & BAST berhasil dibuat.");
      },
      onError: (e) => toast.error(e.message),
    },
  );

  const [loadRecap] = useLazyQuery(GET_MONTHLY_ADMIN_DOC_RECAP_BY_USER_MONTH, {
    fetchPolicy: "no-cache",
    onCompleted: (res) => {
      const recap = res?.monthlyAdminDocRecapByUserMonth;

      if (!recap) {
        setPpkUserId("");
        setPpkName("");
        setPpkNip("");
        setNomorSPK("");
        setNomorBAST("");
        return;
      }

      const nextPpkId = recap.ppkUserId ?? recap.ppkUser?.id ?? "";
      setPpkUserId(nextPpkId);

      setPpkName(recap.ppkUser?.name ?? recap.ppkName ?? "");
      setPpkNip(recap.ppkUser?.nip ?? recap.ppkNip ?? "");

      setNomorSPK(recap.spkNumber ?? "");
      setNomorBAST(recap.bastNumber ?? "");
    },
    onError: () => {
      setPpkUserId("");
      setPpkName("");
      setPpkNip("");
      setNomorSPK("");
      setNomorBAST("");
    },
  });

  const [loadNumberSuggestion] = useLazyQuery(
    GET_MONTHLY_DOC_NUMBER_SUGGESTION,
    {
      fetchPolicy: "no-cache",
      onCompleted: (res) => {
        const suggestion = res?.monthlyDocNumberSuggestion;
        if (!suggestion) return;

        setNomorSPK(String(suggestion.nomorSPK ?? ""));
        setNomorBAST(String(suggestion.nomorBAST ?? ""));
      },
    },
  );

  const ppkOptions: HUOption[] = useMemo(() => {
    return (ppkData?.ppkOptions ?? []).map((p: any) => ({
      value: p.id,
      label: p.name,
      subLabel: p.nip ?? "-",
    }));
  }, [ppkData]);

  useEffect(() => {
    if (ppkUserId) return;
    const opts = (ppkData?.ppkOptions ?? []) as any[];
    if (!opts.length) return;
    const def = opts.find((x) => x?.isDefault) ?? opts[0];
    if (!def?.id) return;
    setPpkUserId(def.id);
    setPpkName(def.name ?? "");
    setPpkNip(def.nip ?? "");
  }, [ppkData, ppkUserId]);

  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null;
    return users.find((u: any) => u.id === selectedUserId) ?? null;
  }, [selectedUserId, users]);

  const eligibleCount = useMemo(
    () => rows.filter((r) => r.eligible).length,
    [rows],
  );

  useEffect(() => {
    if (!selectedUser) {
      setPetugasJobName("");
      setPetugasVillageName("");
      return;
    }
    setPetugasJobName(selectedUser.job_name ?? "");
    setPetugasVillageName(selectedUser.village?.name ?? "");
  }, [selectedUser]);

  useEffect(() => {
    if (!selectedUserId) return;

    setSpkUrl(null);
    setBastUrl(null);
    setExpiresAtInfo("");

    loadRecap({ variables: { userId: selectedUserId, year, month } });
    loadNumberSuggestion({
      variables: { userId: selectedUserId, year, month },
    });
  }, [selectedUserId, year, month, loadRecap, loadNumberSuggestion]);

  const onRecalcRow = (idx: number, next: Partial<EditableRow>) => {
    setRows((prev) => {
      const clone = [...prev];
      const cur = clone[idx];
      const merged = { ...cur, ...next };

      const td = toNumber(merged.editTotalDocs);
      const uc = toNumber(merged.unitCost);
      merged.editTotalCost = Number((td * uc).toFixed(2));

      clone[idx] = merged;
      return clone;
    });
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
          Preview kegiatan bulanan petugas. Dokumen hanya dibuat untuk kegiatan
          yang sudah selesai.
        </p>
        {expiresAtInfo ? (
          <p className="text-xs text-gray-500 mt-1">
            Link & file dokumen berlaku sampai: {expiresAtInfo}
          </p>
        ) : null}
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
            <label className="block text-sm font-semibold mb-1">
              Nama Pekerjaan (Petugas)
            </label>
            <input
              className="w-full rounded-md border px-3 py-2 bg-white"
              value={petugasJobName}
              onChange={(e) => setPetugasJobName(e.target.value)}
              placeholder="Contoh: PPL / Mitra Statistik / dll"
              disabled={!selectedUserId}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Nama Desa (Petugas)
            </label>
            <input
              className="w-full rounded-md border px-3 py-2 bg-white"
              value={petugasVillageName}
              onChange={(e) => setPetugasVillageName(e.target.value)}
              placeholder="Contoh: Desa Mulyaguna"
              disabled={!selectedUserId}
            />
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
            <label className="block text-sm font-semibold mb-1">
              Tanggal Dokumen SPK
            </label>
            <input
              className="w-full rounded-md border px-3 py-2 bg-white"
              type="date"
              value={spkDocDate}
              onChange={(e) => setSpkDocDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Tanggal Dokumen BAST
            </label>
            <input
              className="w-full rounded-md border px-3 py-2 bg-white"
              type="date"
              value={bastDocDate}
              onChange={(e) => setBastDocDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-semibold">PPK</label>
            <HUComboBox
              value={ppkUserId || null}
              onValueChange={(v) => {
                const id = (v ?? "") as string;
                setPpkUserId(id);

                const picked = (ppkData?.ppkOptions ?? []).find(
                  (x: any) => x.id === id,
                );
                setPpkName(picked?.name ?? "");
                setPpkNip(picked?.nip ?? "");
              }}
              options={ppkOptions}
              placeholder="-- Pilih PPK --"
            />
          </div>

          <div className="md:col-span-2 xl:col-span-3 rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-700">
            Format nomor otomatis tampil setelah petugas dan bulan dipilih.
            {nomorSPK || nomorBAST ? (
              <div className="mt-1 text-xs text-gray-600">
                SPK: <b>{nomorSPK || "-"}</b> | BAST: <b>{nomorBAST || "-"}</b>
              </div>
            ) : null}
          </div>\<div>
            <label className="block text-sm font-semibold mb-1">Nomor SPK</label>
            <input
              className="w-full rounded-md border px-3 py-2 bg-white"
              value={nomorSPK}
              onChange={(e) => setNomorSPK(e.target.value)}
              placeholder="Nomor SPK otomatis, bisa diubah"
              disabled={!selectedUserId}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Nomor BAST</label>
            <input
              className="w-full rounded-md border px-3 py-2 bg-white"
              value={nomorBAST}
              onChange={(e) => setNomorBAST(e.target.value)}
              placeholder="Nomor BAST otomatis, bisa diubah"
              disabled={!selectedUserId}
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            className={`${styles.button} !w-auto`}
            onClick={() => {
              if (!selectedUserId) return toast.error("Pilih petugas dulu.");
              loadPreview({
                variables: { userId: selectedUserId, month, year },
              });
            }}
            disabled={previewLoading}
          >
            {previewLoading ? "Memuat..." : "Tampilkan Kegiatan"}
          </button>
        </div>

        {selectedUser && (
          <div className="text-sm text-gray-700">
            Petugas: <span className="font-semibold">{selectedUser.name}</span>{" "}
            | Periode:{" "}
            <span className="font-semibold">
              {monthName(month)} {year}
            </span>{" "}
            | Kegiatan selesai:{" "}
            <span className="font-semibold">{eligibleCount}</span>
          </div>
        )}
      </div>

      {/* TABEL PREVIEW */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Preview Kegiatan</h2>
          <span className="text-sm text-gray-600">
            Editable hanya untuk kegiatan selesai.
          </span>
        </div>

        <div className="overflow-auto">
          <table className="min-w-[1100px] w-full text-sm border">
            <thead className="bg-gray-50">
              <tr>
                <th className="border p-2 text-left">Kegiatan</th>
                <th className="border p-2">Start</th>
                <th className="border p-2">End</th>
                <th className="border p-2">Status</th>
                <th className="border p-2">Satuan</th>
                <th className="border p-2">Jumlah Satuan</th>
                <th className="border p-2">Harga Satuan Pekerjaan</th>
                <th className="border p-2">Total Honor</th>
                <th className="border p-2">Kode Beban</th>
                <th className="border p-2">Masukkan</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    className="border p-3 text-center text-gray-600"
                    colSpan={9}
                  >
                    Belum ada data. Klik “Tampilkan Kegiatan”.
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => {
                  const disabled = !r.eligible;
                  return (
                    <tr
                      key={r.subSurveyActivityId}
                      className={disabled ? "opacity-60" : ""}
                    >
                      <td className="border p-2">{r.activityName}</td>
                      <td className="border p-2 text-center">
                        {String(r.startDate).slice(0, 10)}
                      </td>
                      <td className="border p-2 text-center">
                        {String(r.endDate).slice(0, 10)}
                      </td>
                      <td className="border p-2 text-center">
                        <span
                          className={`px-2 py-1 rounded text-xs ${r.eligible ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-800"}`}
                        >
                          {r.eligible ? "Selesai" : "Belum selesai"}
                        </span>
                      </td>
                      <td className="border p-2">
                        <input
                          className="w-28 border rounded px-2 py-1 bg-white"
                          disabled={disabled}
                          value={r.editUnitName}
                          onChange={(e) =>
                            onRecalcRow(idx, { editUnitName: e.target.value })
                          }
                          placeholder="Dokumen/Segmen/Petugas"
                        />
                      </td>
                      <td className="border p-2 text-center">
                        <input
                          className="w-24 border rounded px-2 py-1 bg-white text-right"
                          type="number"
                          disabled={disabled}
                          value={r.editTotalDocs}
                          onChange={(e) =>
                            onRecalcRow(idx, {
                              editTotalDocs: toNumber(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td className="border p-2 text-right">
                        <input
                          className="w-24 border rounded px-2 py-1 bg-white text-left"
                          type="number"
                          disabled={disabled}
                          value={r.editUnitCost}
                          onChange={(e) =>
                            onRecalcRow(idx, {
                              editUnitCost: toNumber(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td className="border p-2 text-right">
                        {toNumber(r.editTotalCost).toLocaleString("id-ID")}
                      </td>
                      <td className="border p-2">
                        {r.budgetCode ? String(r.budgetCode) : "-"}
                      </td>
                      <td className="border p-2 text-center">
                        <input
                          type="checkbox"
                          disabled={!r.eligible}
                          checked={!!r.included}
                          onChange={(e) =>
                            setRows((prev) => {
                              const clone = [...prev];
                              clone[idx] = {
                                ...clone[idx],
                                included: e.target.checked,
                              };
                              return clone;
                            })
                          }
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-3 items-end">
          <button
            className={`${styles.button} !w-auto`}
            disabled={genLoading || !selectedUserId || eligibleCount === 0}
            onClick={() => {
              if (!selectedUserId) return toast.error("Pilih petugas dulu.");
              if (!ppkUserId.trim()) return toast.error("PPK wajib dipilih.");
              if (!spkDocDate)
                return toast.error("Tanggal dokumen SPK wajib diisi.");
              if (!bastDocDate)
                return toast.error("Tanggal dokumen BAST wajib diisi.");
              if (!petugasJobName.trim())
                return toast.error("Nama pekerjaan petugas wajib diisi.");
              if (!petugasVillageName.trim())
                return toast.error("Nama desa petugas wajib diisi.");

              const payloadRows = rows
                .filter((r) => r.eligible && r.included)
                .map((r) => ({
                  subSurveyActivityId: r.subSurveyActivityId,
                  unitName: (r.editUnitName || "Dokumen").trim() || "Dokumen",
                  totalDocs: toNumber(r.editTotalDocs),
                  included: !!r.included,
                }));

              setSpkUrl(null);
              setBastUrl(null);

              generateDocs({
                variables: {
                  input: {
                    userId: selectedUserId,
                    month,
                    year,
                    ppkUserId,
                    ppkName,
                    ppkNip,
                    nomorSPK: nomorSPK.trim(),
                    nomorBAST: nomorBAST.trim(),
                    spkDocDate: new Date(spkDocDate),
                    bastDocDate: new Date(bastDocDate),
                    pekerjaanPetugas: petugasJobName,
                    desaTinggalPetugas: petugasVillageName,
                    rows: payloadRows,
                  },
                },
              });
            }}
          >
            {genLoading ? "Membuat Dokumen..." : "Buat SPK & BAST"}
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
              disabled={!spkUrl}
              onClick={() => window.open(spkUrl!, "_blank")}
            >
              Download SPK
            </button>

            <button
              type="button"
              className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50"
              disabled={!bastUrl}
              onClick={() => window.open(bastUrl!, "_blank")}
            >
              Download BAST
            </button>
          </div>
        </div>

        {expiresAtInfo && (
          <p className="mt-2 text-sm text-gray-600">
            File tersimpan sementara. Akan terhapus otomatis sekitar:{" "}
            <b>{expiresAtInfo}</b>
          </p>
        )}

        {eligibleCount === 0 && rows.length > 0 && (
          <p className="mt-3 text-sm text-yellow-700">
            Tidak ada kegiatan selesai pada periode ini. Dokumen belum bisa
            dibuat.
          </p>
        )}
      </div>
    </div>
  );
}
