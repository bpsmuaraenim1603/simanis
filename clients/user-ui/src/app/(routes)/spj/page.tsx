"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { ADD_SPJ } from "@/src/graphql/actions/add-spj.action";
import { GET_ALL_SPJ } from "@/src/graphql/actions/find-allspj.action";
import { UPDATE_SPJ_STATUS } from "@/src/graphql/actions/update-spjstatus.action";
import styles from "@/src/utils/style";
import { GET_ALL_USERS } from "@/src/graphql/actions/find-allusers.action";
import { GET_ALL_OF_SUB_SURVEY_ACTIVITIES } from "@/src/graphql/actions/find-realallsubsurvey.action";
import toast from "react-hot-toast";
import useUser from "@/src/hooks/useUser";
import { GET_USER_PROGRESS_BY_SUBSURVEY_ID } from "@/src/graphql/actions/find-usersurveyprogress.action";
import { DELETE_SUBMIT_SPJ } from "@/src/graphql/actions/delete";
import HUComboBox from "@/src/components/HUCombobox";

/* ================= Helpers ================= */
const uid = () =>
  (typeof globalThis !== "undefined" &&
    (globalThis.crypto as any)?.randomUUID?.()) ||
  Math.random().toString(36).slice(2) + Date.now().toString(36);

type District = { id: string; name?: string; city?: string };
type UserProgress = {
  id: string;
  userId: string;
  district?: District | null;
  user?: { id: string; name: string } | null;
};
type SubSurveyActivity = {
  id: string;
  name: string;
  slug: string;
  surveyActivityId: string;
  startDate: string;
  endDate: string;
  targetSample: number;
};

type SPJ = {
  id: string;
  userId: string;
  subSurveyActivityId: string;
  submitState: string;
  submitDate: string;
  approveDate: string | null;
  verifyNote: string | null;
  eviDocumentPath: string | null;
  eviDocumentSignedUrl?: string | null;
};
type SPJWithUserNSubSurvey = SPJ & {
  user?: { id: string; name: string };
  subSurveyActivity?: { id: string; name: string };
};

function groupPetugasByUserId(items: UserProgress[]) {
  const map = new Map<
    string,
    { userId: string; name: string; subLabels: Set<string> }
  >();
  for (const it of items) {
    const key = it.userId;
    const name = it.user?.name || it.userId;
    const sub =
      it.district?.city?.trim() || "" || it.district?.name?.trim() || "";
    if (!map.has(key))
      map.set(key, { userId: key, name, subLabels: new Set() });
    if (sub) map.get(key)!.subLabels.add(sub);
  }
  return Array.from(map.values()).map((v) => ({
    value: v.userId,
    label: v.name,
    subLabel: v.subLabels.size ? Array.from(v.subLabels).join(", ") : undefined,
  }));
}

/* ================= Komponen ================= */
function SPJ() {
  const { user } = useUser();

  // ====== STATE FILTER (versi lama) ======
  const [filter, setFilter] = useState({
    jenisSurvei: "",
    statusPengajuan: "",
  });

  // ====== STATE MASS INPUT ======
  type Row = {
    id: string;
    userId: string;
    verifyNote: string;
    submitting?: boolean;
    result?: "ok" | "err";
    errMsg?: string;
  };
  const [subSurveyActivityId, setSubSurveyActivityId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[]>([
    { id: uid(), userId: "", verifyNote: "" },
  ]);

  // ====== MODAL DETAIL / UPDATE ======
  const [selectedSPJ, setSelectedSPJ] = useState<SPJWithUserNSubSurvey | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [update, setUpdate] = useState({
    id: "",
    status: "Disetujui",
    verifyNote: "",
  });
  const [deleteMode, setDeleteMode] = useState(false);

  // ====== QUERIES ======
  useQuery(GET_ALL_USERS);
  const { data: subSurveyData } = useQuery(GET_ALL_OF_SUB_SURVEY_ACTIVITIES);
  const { data: SPJData } = useQuery(GET_ALL_SPJ);
  const {
    data: userProgressData,
    loading: loadingPetugas,
    refetch: refetchPetugas,
  } = useQuery(GET_USER_PROGRESS_BY_SUBSURVEY_ID, {
    variables: { subSurveyActivityId },
    skip: !subSurveyActivityId,
    fetchPolicy: "cache-and-network",
  });

  // ====== MUTATIONS ======
  const [createSPJ] = useMutation(ADD_SPJ, {
    refetchQueries: [{ query: GET_ALL_SPJ }],
  });
  const [updateStatus, { loading: newloading }] = useMutation(
    UPDATE_SPJ_STATUS,
    {
      refetchQueries: [{ query: GET_ALL_SPJ }],
    }
  );
  const [deleteSPJ, { loading: deleting }] = useMutation(DELETE_SUBMIT_SPJ, {
    refetchQueries: [{ query: GET_ALL_SPJ }],
  });

  // ====== OPTIONS ======
  const activityOptions = useMemo(
    () =>
      (subSurveyData?.allSubSurveyActivities ?? []).map(
        (s: { id: string; name: string }) => ({
          value: s.id,
          label: s.name ?? "-",
        })
      ),
    [subSurveyData]
  );

  const petugasOptions = useMemo(() => {
    const raw: UserProgress[] =
      userProgressData?.userProgressBySubSurveyActivityId ?? [];
    return groupPetugasByUserId(raw);
  }, [userProgressData]);

  useEffect(() => {
    if (subSurveyActivityId) {
      setRows([{ id: uid(), userId: "", verifyNote: "" }]);
      refetchPetugas({ subSurveyActivityId });
    }
  }, [subSurveyActivityId, refetchPetugas]);

  // ====== FILTER “VERSI LAMA” DI CLIENT ======
  const filteredSPJ = useMemo(() => {
    const rows: SPJWithUserNSubSurvey[] = SPJData?.getAllSPJ ?? [];
    return rows.filter((spj) => {
      if (
        user?.role !== "Admin" &&
        user?.role !== "Superadmin" &&
        user?.role !== "Keuangan" &&
        spj.userId !== user?.id
      )
        return false;

      const matchesJenis =
        !filter.jenisSurvei ||
        spj.subSurveyActivity?.name === filter.jenisSurvei;
      const matchesPengajuan =
        !filter.statusPengajuan || spj.submitState === filter.statusPengajuan;
      return matchesJenis && matchesPengajuan;
    });
  }, [SPJData, user, filter]);

  const statusOptions = useMemo(
    () => [
      { value: "", label: "Semua Status" },
      { value: "Menunggu", label: "Menunggu" },
      { value: "Disetujui", label: "Disetujui" },
      { value: "Ditolak", label: "Ditolak" },
    ],
    []
  );

  // ====== HANDLERS ======
  const onAddRow = () =>
    setRows((prev) => [...prev, { id: uid(), userId: "", verifyNote: "" }]);
  const onRemoveRow = (id: string) =>
    setRows((prev) => prev.filter((r) => r.id !== id));
  const onSetRow = (id: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFile(e.target.files?.[0] || null);

  const isReady =
    !!subSurveyActivityId &&
    !!file &&
    rows.length > 0 &&
    rows.every((r) => !!r.userId);

  const submitAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReady) {
      toast.error("Lengkapi kegiatan, file bukti, dan petugas di semua baris.");
      return;
    }
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        submitting: true,
        result: undefined,
        errMsg: undefined,
      }))
    );

    let ok = 0,
      err = 0;
    for (const r of rows) {
      try {
        await createSPJ({
          variables: {
            input: {
              userId: r.userId,
              subSurveyActivityId,
              verifyNote: r.verifyNote || undefined,
            },
            file,
          },
        });
        ok++;
        onSetRow(r.id, { submitting: false, result: "ok" });
      } catch (ex: any) {
        err++;
        onSetRow(r.id, {
          submitting: false,
          result: "err",
          errMsg: ex?.message || "Gagal",
        });
      }
    }

    if (ok && !err) {
      toast.success(`Berhasil mengajukan ${ok} baris.`);
      setRows([{ id: uid(), userId: "", verifyNote: "" }]);
      setFile(null);
    } else if (ok && err) {
      toast(
        `Sebagian berhasil: OK ${ok}, Gagal ${err}. Periksa baris gagal lalu kirim ulang.`,
        { icon: "⚠️" }
      );
    } else {
      toast.error("Semua baris gagal terkirim.");
    }
  };

  const handleUpdateChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setUpdate((prev) => ({ ...prev, [e.target.id]: e.target.value }));

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!update.id || !update.status)
        return toast.error("Semua field wajib diisi!");
      await updateStatus({
        variables: {
          input: {
            id: update.id,
            status: update.status,
            verifyNote: update.verifyNote || undefined,
          },
        },
      });
      setIsModalOpen(false);
      toast.success("Status Pengajuan Honor berhasil diperbarui!");
      setUpdate({ id: "", status: "Disetujui", verifyNote: "" });
    } catch {
      toast.error("Gagal memperbarui Status Pengajuan Honor!");
    }
  };

  const canDelete = (spj: SPJWithUserNSubSurvey) =>
    user?.role === "Admin" || user?.role === "Superadmin";

  const handleDeleteSPJ = async (id: string) => {
    if (!id) return;
    const ok = window.confirm(
      "Hapus pengajuan honor (SPJ) ini beserta filenya?"
    );
    if (!ok) return;
    try {
      const { data } = await deleteSPJ({ variables: { input: { id } } });
      if (data?.deleteSubmitSPJ?.success) {
        toast.success(data.deleteSubmitSPJ.message ?? "SPJ terhapus.");
        if (selectedSPJ?.id === id) {
          setIsModalOpen(false);
          setSelectedSPJ(null);
        }
      } else {
        toast.error("Gagal menghapus SPJ.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Gagal menghapus SPJ.");
      console.error(e);
    }
  };

  /* ================= RENDER ================= */
  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-6 md:px-8 py-4 space-y-4 font-Poppins">
      <div className="bg-orange-50 rounded-lg p-3 md:p-4 font-bold text-lg md:text-xl shadow-md">
        Pengajuan Honor
      </div>

      {/* ===== FILTER VERSI LAMA ===== */}
      <div className="bg-white rounded-lg p-4 shadow space-y-3">
        <p className="font-semibold">Filter SPJ</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">
              Jenis Survei
            </label>
            <HUComboBox
              value={filter.jenisSurvei || null}
              onValueChange={(v) =>
                setFilter((prev) => ({
                  ...prev,
                  jenisSurvei: (v ?? "") as string,
                }))
              }
              options={[
                { value: "", label: "Semua Jenis Survei" },
                ...(subSurveyData?.allSubSurveyActivities ?? []).map(
                  (sub: SubSurveyActivity) => ({
                    value: sub.name,
                    label: sub.name,
                  })
                ),
              ]}
              placeholder="-- Pilih Jenis Survei --"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Status Pengajuan
            </label>
            <HUComboBox
              value={filter.statusPengajuan || null}
              onValueChange={(v) =>
                setFilter((prev) => ({
                  ...prev,
                  statusPengajuan: (v ?? "") as string,
                }))
              }
              options={statusOptions}
              placeholder="-- Pilih Status Pengajuan --"
            />
          </div>
        </div>
      </div>

      {/* ===== MONITORING (data?.getAllSPJ) ===== */}
      <div className="font-bold text-lg">Monitoring Pengajuan Honor</div>

      {/* Tabel desktop */}
      <div className="hidden sm:block relative shadow-md rounded-lg overflow-hidden">
        <table className="min-w-[720px] w-full text-sm text-left text-gray-600">
          <thead className="text-gray-700 bg-gray-200">
            <tr>
              <th className="px-6 py-3 uppercase">Nama Petugas</th>
              <th className="px-6 py-3 uppercase">Kegiatan Survei</th>
              <th className="px-6 py-3 uppercase">Status Pengajuan</th>
              <th className="px-6 py-3 uppercase text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {!SPJData && (
              <tr>
                <td colSpan={4} className="px-6 py-6 text-center">
                  Memuat data…
                </td>
              </tr>
            )}
            {SPJData && filteredSPJ.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-6 text-center text-gray-500">
                  {filter.jenisSurvei || filter.statusPengajuan
                    ? "Tidak ada pengajuan yang cocok dengan filter saat ini."
                    : "Belum ada pengajuan honor."}
                </td>
              </tr>
            )}
            {filteredSPJ.map((spj) => (
              <tr key={spj.id} className="border-t">
                <td className="px-6 py-4 font-semibold text-gray-900">
                  {spj.user?.name || "-"}
                </td>
                <td className="px-6 py-4">
                  {spj.subSurveyActivity?.name || "-"}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-block px-2 py-1 text-xs font-semibold rounded
                      ${
                        spj.submitState === "Disetujui"
                          ? "bg-green-100 text-green-700"
                          : spj.submitState === "Ditolak"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                      }`}
                  >
                    {spj.submitState}
                  </span>
                </td>
                <td className="px-3 py-4 text-right space-x-2">
                  <button
                    onClick={() => {
                      setSelectedSPJ(spj);
                      setIsModalOpen(true);
                      setUpdate((u) => ({ ...u, id: spj.id }));
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Lihat Detail
                  </button>

                  {canDelete(spj) && deleteMode && (
                    <button
                      onClick={() => handleDeleteSPJ(spj.id)}
                      disabled={deleting}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                      title="Hapus SPJ"
                    >
                      {deleting ? "Menghapus..." : "Hapus"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Kartu mobile */}
      <div className="sm:hidden space-y-3">
        {!SPJData ? (
          <div className="bg-white rounded-lg p-3 shadow text-center">
            Memuat data…
          </div>
        ) : filteredSPJ.length === 0 ? (
          <div className="bg-white rounded-lg p-3 shadow text-center text-gray-500">
            {filter.jenisSurvei || filter.statusPengajuan
              ? "Tidak ada pengajuan yang cocok dengan filter saat ini."
              : "Belum ada pengajuan honor."}
          </div>
        ) : (
          filteredSPJ.map((spj) => (
            <div key={spj.id} className="bg-white rounded-lg p-3 shadow">
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-semibold">{spj.user?.name || "-"}</p>
                  <p className="text-xs text-gray-600">
                    {spj.subSurveyActivity?.name || "-"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedSPJ(spj);
                      setIsModalOpen(true);
                      setUpdate((u) => ({ ...u, id: spj.id }));
                    }}
                    className="px-3 py-1 my-2 bg-blue-600 text-white rounded text-sm"
                  >
                    Detail
                  </button>
                  {canDelete(spj) && deleteMode && (
                    <button
                      onClick={() => handleDeleteSPJ(spj.id)}
                      disabled={deleting}
                      className="px-3 py-1 my-2 bg-red-600 text-white rounded text-sm disabled:opacity-50"
                    >
                      {deleting ? "..." : "Hapus"}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2 text-sm">
                <span className="text-gray-500 mr-1">Status:</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold
                    ${
                      spj.submitState === "Disetujui"
                        ? "bg-green-100 text-green-700"
                        : spj.submitState === "Ditolak"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                    }`}
                >
                  {spj.submitState}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="w-full flex justify-end">
      {(user?.role === "Admin" || user?.role === "Superadmin") && (
        <button
          type="button"
          onClick={() => setDeleteMode((v) => !v)}
          className={`px-3 py-2 rounded-md text-white outline-none
          ${deleteMode ? "bg-red-600 hover:bg-red-700" : "bg-gray-700 hover:bg-gray-800"}`}
          title={deleteMode ? "Matikan Mode Hapus" : "Aktifkan Mode Hapus"}
        >
          {deleteMode ? "Matikan Mode Hapus" : "Aktifkan Mode Hapus"}
        </button>
      )}
      </div>

      {/* ===== MODAL DETAIL / UPDATE ===== */}
      {isModalOpen && selectedSPJ && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto py-20"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-[92%] sm:w-[560px] rounded-lg shadow-lg max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-b">
              <h2 className="text-lg sm:text-xl font-bold">Detail SPJ</h2>
              {selectedSPJ.eviDocumentSignedUrl ? (
                <a
                  target="_blank"
                  href={selectedSPJ.eviDocumentSignedUrl || ""}
                  className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm"
                >
                  Lihat Bukti
                </a>
              ) : (
                <span className="text-xs text-gray-500">
                  (Bukti belum tersedia)
                </span>
              )}
            </div>

            <div className="p-4 sm:p-6 space-y-3 overflow-y-auto text-sm sm:text-base">
              <p>
                <strong>Nama Petugas:</strong> {selectedSPJ.user?.name || "-"}
              </p>
              <p>
                <strong>Jenis Survei:</strong>{" "}
                {selectedSPJ.subSurveyActivity?.name || "-"}
              </p>
              <p>
                <strong>Submit State:</strong> {selectedSPJ.submitState}
              </p>
              <p>
                <strong>Submit Date:</strong> {selectedSPJ.submitDate || "-"}
              </p>
              <p>
                <strong>Approve Date:</strong> {selectedSPJ.approveDate || "-"}
              </p>
              <p>
                <strong>Catatan:</strong> {selectedSPJ.verifyNote || "-"}
              </p>

              {user?.role === "Keuangan" || user?.role === "Superadmin" ? (
                <form
                  onSubmit={handleUpdate}
                  className="space-y-3 pt-4 border-t mt-2"
                >
                  <input
                    type="hidden"
                    id="id"
                    value={update.id}
                    onChange={handleUpdateChange}
                  />
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Ubah Status
                    </label>
                    <HUComboBox
                      value={update.status || null}
                      onValueChange={(v) =>
                        setUpdate((prev) => ({
                          ...prev,
                          status: (v ?? "") as string,
                          id: selectedSPJ.id,
                        }))
                      }
                      options={statusOptions.filter((o) => o.value)}
                      placeholder="Pilih status…"
                    />
                  </div>
                  <div>
                    <input
                      id="verifyNote"
                      placeholder="Catatan"
                      value={update.verifyNote}
                      onChange={(e) =>
                        setUpdate({
                          ...update,
                          verifyNote: e.target.value,
                          id: selectedSPJ.id,
                        })
                      }
                      className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={newloading}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                    >
                      {newloading ? "Menyimpan..." : "Update Status"}
                    </button>
                    <button
                      onClick={() => {
                        setIsModalOpen(false);
                        setSelectedSPJ(null);
                        setUpdate({
                          id: "",
                          status: "Disetujui",
                          verifyNote: "",
                        });
                      }}
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                      type="button"
                    >
                      Tutup
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedSPJ(null);
                  }}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 flex justify-center w-full mt-2"
                  type="button"
                >
                  Tutup
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== MASS INPUT AREA ===== */}
      {(user?.role === "Admin" || user?.role === "Superadmin") && (
        <div className="bg-white rounded-lg p-4 shadow space-y-3">
          <div>
            <label className="block text-sm font-semibold mb-1">
              Kegiatan Survei
            </label>
            <HUComboBox
              value={subSurveyActivityId || null}
              onValueChange={(v) => setSubSurveyActivityId((v ?? "") as string)}
              options={activityOptions}
              placeholder="-- Pilih Kegiatan --"
            />
          </div>

          <div className="grid md:grid-cols-[1fr_auto] gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">
                Bukti Pengajuan Honor
              </label>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={onFileChange}
                className="block w-full text-sm text-gray-900 file:mr-4 file:py-2 file:px-4
                           file:rounded-md file:border-gray-500 file:text-sm file:font-semibold
                           file:bg-white file:text-black hover:file:bg-gray-100"
              />
              <p className="text-xs text-gray-500 mt-1">
                Format: PDF/JPG/PNG. Sesuaikan dengan kebutuhan (Maks. 5MB)
              </p>
            </div>
            <div className="flex md:items-end">
              <button
                type="button"
                onClick={onAddRow}
                disabled={!subSurveyActivityId || loadingPetugas}
                className="h-[40px] px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 disabled:hover:bg-gray-800 disabled:opacity-50"
              >
                + Tambah Baris Petugas
              </button>
            </div>
          </div>

          {/* Tabel input massal */}
          <div className="relative">
            <div className="overflow-x-auto overflow-y-visible">
              <table className="relative z-0 min-w-[760px] w-full text-sm text-left text-gray-700">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Petugas</th>
                    <th className="px-3 py-2">Catatan</th>
                    <th className="px-3 py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="h-[100px]">
                  {rows.map((r, idx) => (
                    <tr key={r.id} className="border-t pb-52">
                      <td className="px-3 py-2">{idx + 1}</td>
                      <td className="px-3 py-2 min-w-[260px]">
                        <HUComboBox
                          value={r.userId || null}
                          onValueChange={(v) =>
                            onSetRow(r.id, { userId: (v ?? "") as string })
                          }
                          options={
                            loadingPetugas
                              ? []
                              : petugasOptions.map((opt) => ({
                                  ...opt,
                                  disabled:
                                    !!opt.value &&
                                    rows.some(
                                      (rr) =>
                                        rr.id !== r.id &&
                                        rr.userId === opt.value
                                    ),
                                }))
                          }
                          placeholder={
                            !subSurveyActivityId
                              ? "Pilih kegiatan dulu"
                              : loadingPetugas
                                ? "Memuat petugas…"
                                : "-- Pilih Petugas --"
                          }
                          disabled={!subSurveyActivityId || loadingPetugas}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={r.verifyNote}
                          onChange={(e) =>
                            onSetRow(r.id, { verifyNote: e.target.value })
                          }
                          placeholder="Catatan (opsional)"
                          className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {r.submitting ? (
                          <span className="text-xs text-gray-500">
                            Mengirim…
                          </span>
                        ) : r.result === "ok" ? (
                          <span className="text-xs text-green-700">OK</span>
                        ) : r.result === "err" ? (
                          <span
                            className="text-xs text-red-600"
                            title={r.errMsg}
                          >
                            Gagal
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onRemoveRow(r.id)}
                            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:hover:bg-red-500 disabled:opacity-50"
                            disabled={rows.length === 1}
                          >
                            Hapus
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-6 text-center text-gray-500"
                      >
                        Tambahkan minimal satu baris petugas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={submitAll}
              disabled={
                !subSurveyActivityId || !file || rows.some((r) => !r.userId)
              }
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:hover:bg-blue-600 disabled:opacity-50"
            >
              Ajukan Semua
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SPJ;
