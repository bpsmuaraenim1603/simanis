"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { ADD_JOBLETTER } from "@/src/graphql/actions/add-jobletter.action";
import { GET_ALL_JOBLETTERS } from "@/src/graphql/actions/find-alljobletter.action";
import { UPDATE_JOB_LETTER_STATUS } from "@/src/graphql/actions/update-jobletterstatus.action";
import { GET_ALL_OF_SUB_SURVEY_ACTIVITIES } from "@/src/graphql/actions/find-realallsubsurvey.action";
import { GET_USER_PROGRESS_BY_SUBSURVEY_ID } from "@/src/graphql/actions/find-usersurveyprogress.action";
import { DELETE_JOBLETTER } from "@/src/graphql/actions/delete";
import toast from "react-hot-toast";
import styles from "@/src/utils/style";
import useUser from "@/src/hooks/useUser";
import HUComboBox from "@/src/components/HUCombobox";

type SubSurveyActivity = { id: string; name: string };
type District = { id: string; name?: string; city?: string };
type UserProgressForSelect = {
  id: string;
  userId: string;
  district?: District | null;
  user?: { id: string; name: string } | null;
};
type JobLetter = {
  id: string;
  userId: string;
  subSurveyActivityId: string;
  region: string;
  submitDate: string;
  agreeState: string;
  approveDate: string | null;
  rejectNote: string | null;
  eviLetterSignedUrl?: string | null;
  subSurveyActivity?: { id: string; name: string } | null;
  user?: { id: string; name: string } | null;
};
type JobLetterWithUserNSubSurvey = JobLetter & {
  user?: { id: string; name: string } | null;
  subSurveyActivity?: { id: string; name: string } | null;
};

function groupPetugasByUserId(items: UserProgressForSelect[]) {
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

export default function Partners() {
  const { user } = useUser();

  // Form state
  const [input, setInput] = useState({
    userId: "",
    subSurveyActivityId: "",
    region: "",
    submitDate: new Date().toISOString(),
  });
  const [file, setFile] = useState<File | null>(null);

  const [update, setUpdate] = useState({
    id: "",
    status: "Menunggu",
    rejectNote: "",
  });
  const [filter, setFilter] = useState({
    wilayah: "",
    survei: "",
    statusPengajuan: "",
  });

  const [selectedJobLetter, setSelectedJobLetter] =
    useState<JobLetterWithUserNSubSurvey | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);

  // GQL
  const [createJobLetter, { loading }] = useMutation(ADD_JOBLETTER, {
    refetchQueries: [{ query: GET_ALL_JOBLETTERS }],
  });
  const [updateJobLetterStatus, { loading: loadingUpdate }] = useMutation(
    UPDATE_JOB_LETTER_STATUS,
    { refetchQueries: [{ query: GET_ALL_JOBLETTERS }] }
  );
  const { data: dataSubSurvey } = useQuery(GET_ALL_OF_SUB_SURVEY_ACTIVITIES);
  const { data: dataJobLetter } = useQuery(GET_ALL_JOBLETTERS);
  const [fetchUPBySub, { data: upData, loading: loadingUP }] = useLazyQuery(
    GET_USER_PROGRESS_BY_SUBSURVEY_ID,
    { fetchPolicy: "network-only" }
  );
  const [deleteJobLetter, { loading: deletingJL }] = useMutation(
    DELETE_JOBLETTER,
    {
      refetchQueries: [{ query: GET_ALL_JOBLETTERS }],
    }
  );

  const canDeleteJL = (jl: JobLetterWithUserNSubSurvey) =>
    user?.role === "Admin" ||
    user?.role === "Superadmin" ||
    user?.role === "Keuangan" ||
    jl.userId === user?.id;

  const handleDeleteJobLetter = async (id: string) => {
    if (!id) return;
    if (
      !window.confirm("Hapus pengajuan surat tugas ini beserta file buktinya?")
    )
      return;
    try {
      const { data } = await deleteJobLetter({ variables: { input: { id } } });
      if (data?.deleteJobLetter?.success) {
        toast.success(data.deleteJobLetter.message ?? "Surat Tugas terhapus.");
        if (selectedJobLetter?.id === id) {
          setIsModalOpen(false);
          setSelectedJobLetter(null);
        }
      } else {
        toast.error("Gagal menghapus Surat Tugas.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Gagal menghapus Surat Tugas.");
      console.error(e);
    }
  };

  // Helpers
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setInput({ ...input, [e.target.id]: e.target.value });
  const handleChangeUpdate = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setUpdate({ ...update, [e.target.id]: e.target.value });
  const handleFilter = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setFilter({ ...filter, [e.target.id]: e.target.value });
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFile(e.target.files?.[0] || null);

  useEffect(() => {
    if (input.subSurveyActivityId) {
      fetchUPBySub({
        variables: { subSurveyActivityId: input.subSurveyActivityId },
      });
      setInput((prev) => ({ ...prev, userId: "", region: "" }));
    }
  }, [input.subSurveyActivityId, fetchUPBySub]);

  const supervisorId = user?.id ?? "";

  const petugasList: UserProgressForSelect[] = useMemo(() => {
    const raw = upData?.userProgressBySubSurveyActivityId ?? [];
    if (!user) return [];

    // superadmin / admin bebas lihat semua
    if (
      user.role === "Superadmin" ||
      user.role === "Admin" ||
      user.role === "Keuangan"
    ) {
      return raw;
    }

    // supervisor hanya melihat petugas di bawah pengawasan dirinya
    if (user.role === "Supervisor") {
      return raw.filter((p: any) => (p.superVisorId ?? "") === supervisorId);
    }

    // petugas biasa hanya dirinya sendiri
    return raw.filter((p: any) => p.userId === supervisorId);
  }, [upData, user]);

  const regionOptions = useMemo(() => {
    const raw: string[] = (petugasList ?? [])
      .map((p) => p?.district?.city?.trim() || p?.district?.name?.trim() || "")
      .filter(Boolean);
    const uniq = Array.from(new Set(raw)).sort((a, b) => a.localeCompare(b));
    return uniq.map((r) => ({ value: r, label: r }));
  }, [petugasList]);

  const isAdmin =
    user?.role === "Admin" ||
    user?.role === "Superadmin" ||
    user?.role === "Supervisor";

  const isInPetugasList = useMemo(() => {
    if (!input.subSurveyActivityId) return false; // belum pilih kegiatan
    if (loadingUP) return false; // masih fetch daftar petugas
    return petugasList.some((p) => p.userId === user?.id);
  }, [input.subSurveyActivityId, loadingUP, petugasList, user?.id]);

  const canSeeForm = isAdmin || isInPetugasList;

  const handleSelectPetugas = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const userId = e.target.value;
    const selectedUP = petugasList.find((p) => p.userId === userId);
    const regionAuto =
      selectedUP?.district?.city?.trim() ||
      selectedUP?.district?.name?.trim() ||
      "";
    setInput((prev) => ({ ...prev, userId, region: regionAuto }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!input.subSurveyActivityId || !input.userId) {
        toast.error("Pilih kegiatan & petugas dulu.");
        return;
      }
      if (!input.region) {
        toast.error("Wilayah otomatis tidak ditemukan untuk petugas ini.");
        return;
      }

      await createJobLetter({
        variables: {
          input: {
            userId: input.userId,
            subSurveyActivityId: input.subSurveyActivityId,
            region: input.region,
            submitDate: input.submitDate,
          },
          file,
        },
      });

      toast.success("Surat Tugas berhasil ditambahkan!");
      setInput({
        userId: "",
        subSurveyActivityId: "",
        region: "",
        submitDate: new Date().toISOString(),
      });
      setFile(null);
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal menambahkan Surat Tugas!");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!update.id || !update.status) {
        toast.error("Semua field wajib diisi!");
        return;
      }
      await updateJobLetterStatus({ variables: { input: update } });
      setIsModalOpen(false);
      toast.success("Surat Tugas berhasil diperbarui!");
      setUpdate({ id: "", status: "Menunggu", rejectNote: "" });
    } catch {
      toast.error("Gagal memperbarui Surat Tugas!");
    }
  };

  const filteredJobLetters = useMemo(() => {
    const rows: JobLetterWithUserNSubSurvey[] =
      dataJobLetter?.getAllJobLetters ?? [];
    return rows.filter((jl) => {
      if (
        user?.role !== "Admin" &&
        user?.role !== "Superadmin" &&
        user?.role !== "Keuangan" &&
        jl.userId !== user?.id
      )
        return false;
      const byWilayah = !filter.wilayah || jl.region === filter.wilayah;
      const bySurvei =
        !filter.survei || jl.subSurveyActivity?.name?.includes(filter.survei);
      const byStatus =
        !filter.statusPengajuan || jl.agreeState === filter.statusPengajuan;
      return byWilayah && bySurvei && byStatus;
    });
  }, [dataJobLetter, user, filter]);

  const activityOptions = useMemo(
    () =>
      (dataSubSurvey?.allSubSurveyActivities ?? []).map(
        (sub: { id: string; name: string }) => ({
          value: sub.id,
          label: sub.name ?? "-",
        })
      ),
    [dataSubSurvey]
  );

  const statusOptions = useMemo(
    () => [
      { value: "Menunggu", label: "Menunggu" },
      { value: "Disetujui", label: "Disetujui" },
      { value: "Ditolak", label: "Ditolak" },
    ],
    []
  );

  const petugasOptions = useMemo(() => {
    // satukan per userId persis seperti di SPJ
    return groupPetugasByUserId(petugasList);
  }, [petugasList]);

  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-6 md:px-8 py-4 space-y-4 font-Poppins">
      {/* Header */}
      <div className="bg-orange-50 rounded-lg p-3 md:p-4 font-bold text-lg md:text-xl shadow-md">
        Surat Tugas Petugas
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg p-4 shadow space-y-3">
        <p className="font-semibold">Filter Petugas</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Wilayah</label>
            <HUComboBox
              value={filter.wilayah || null} // atau filter.region, sesuaikan nama state-mu
              onValueChange={(v) =>
                setFilter((prev) => ({ ...prev, wilayah: (v ?? "") as string }))
              }
              options={regionOptions}
              placeholder="-- Pilih Wilayah --"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Jenis Survei
            </label>
            <HUComboBox
              value={filter.survei || null}
              onValueChange={(v) =>
                setFilter((prev) => ({ ...prev, survei: (v ?? "") as string }))
              }
              options={
                // filter bekerja berdasarkan NAMA survei (bukan ID),
                // jadi opsi diisi label sebagai value juga:
                (dataSubSurvey?.allSubSurveyActivities ?? []).map(
                  (s: { id: string; name: string }) => ({
                    value: s.name ?? "-",
                    label: s.name ?? "-",
                  })
                )
              }
              placeholder="-- Pilih Jenis Survei --"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Status Persetujuan
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
              placeholder="-- Pilih Status Persetujuan --"
            />
          </div>
        </div>
      </div>

      {/* Tabel (desktop) */}
      <div className="hidden sm:block relative shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm text-left text-gray-600">
            <thead className="text-gray-700 bg-gray-200">
              <tr>
                <th className="px-6 py-3 uppercase">Nama Petugas</th>
                <th className="px-6 py-3 uppercase">Wilayah</th>
                <th className="px-6 py-3 uppercase">Jenis Survei</th>
                <th className="px-6 py-3 uppercase">Status Surat Tugas</th>
                <th className="px-6 py-3 uppercase">Status Persetujuan</th>
                <th className="px-6 py-3 uppercase text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {!dataJobLetter && (
                <tr>
                  <td colSpan={6} className="px-6 py-6 text-center">
                    Memuat data…
                  </td>
                </tr>
              )}
              {dataJobLetter && filteredJobLetters.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-6 text-center text-gray-500"
                  >
                    {filter.wilayah || filter.survei || filter.statusPengajuan
                      ? "Tidak ada surat tugas yang cocok dengan filter saat ini."
                      : "Belum ada surat tugas."}
                  </td>
                </tr>
              )}
              {filteredJobLetters.map((jl) => (
                <tr key={jl.id} className="border-t">
                  <td className="px-6 py-3 font-semibold text-gray-900">
                    {jl.user?.name ?? "-"}
                  </td>
                  <td className="px-6 py-3">{jl.region}</td>
                  <td className="px-6 py-3">
                    {jl.subSurveyActivity?.name ?? "-"}
                  </td>
                  <td className="px-6 py-3">
                    {jl.submitDate ? (
                      <div>
                        <span className="inline-block px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-xl">
                          Diserahkan
                        </span>
                        <br />
                        <span className="text-xs">
                          {jl.submitDate.split("T")[0]}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-block px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-xl">
                        Belum Diserahkan
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <div>
                      {jl.agreeState === "Disetujui" ? (
                        <span className="inline-block px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-xl">
                          Disetujui
                        </span>
                      ) : jl.agreeState === "Ditolak" ? (
                        <span className="inline-block px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-xl">
                          Ditolak
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-xl">
                          Menunggu
                        </span>
                      )}
                      <br />
                      <span className="text-xs">
                        {jl.approveDate?.split?.("T")?.[0] ?? ""}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-4 text-right space-x-2">
                    <button
                      onClick={() => {
                        setDeleteMode(false);
                        setSelectedJobLetter(jl);
                        setUpdate((p) => ({ ...p, id: jl.id }));
                        setIsModalOpen(true);
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Lihat Detail
                    </button>

                    {deleteMode && canDeleteJL(jl) && (
                      <button
                        onClick={() => handleDeleteJobLetter(jl.id)}
                        disabled={deletingJL}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                        title="Hapus Surat Tugas"
                      >
                        {deletingJL ? "Menghapus..." : "Hapus"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Kartu (mobile) */}
      <div className="sm:hidden space-y-3">
        {!dataJobLetter ? (
          <div className="bg-white rounded-lg p-3 shadow text-center">
            Memuat data…
          </div>
        ) : filteredJobLetters.length === 0 ? (
          <div className="bg-white rounded-lg p-3 shadow text-center text-gray-500">
            {filter.wilayah || filter.survei || filter.statusPengajuan
              ? "Tidak ada surat tugas yang cocok dengan filter saat ini."
              : "Belum ada surat tugas."}
          </div>
        ) : (
          filteredJobLetters.map((jl) => (
            <div key={jl.id} className="bg-white rounded-lg p-3 shadow">
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-semibold">{jl.user?.name ?? "-"}</p>
                  <p className="text-xs text-gray-600">
                    {jl.subSurveyActivity?.name ?? "-"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setDeleteMode(false);
                      setSelectedJobLetter(jl);
                      setUpdate((p) => ({ ...p, id: jl.id }));
                      setIsModalOpen(true);
                    }}
                    className={`px-3 py-1 ${deleteMode && "my-4"} my-2 bg-blue-600 text-white rounded text-sm`}
                  >
                    Detail
                  </button>
                  {deleteMode && canDeleteJL(jl) && (
                    <button
                      onClick={() => handleDeleteJobLetter(jl.id)}
                      disabled={deletingJL}
                      className="px-3 py-1 my-4 bg-red-600 text-white rounded text-sm disabled:opacity-50"
                    >
                      {deletingJL ? "..." : "Hapus"}
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Wilayah:</span>{" "}
                  {jl.region || "-"}
                </div>
                <div>
                  <span className="text-gray-500">ST:</span>{" "}
                  {jl.submitDate ? "Diserahkan" : "Belum"}
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Status:</span>{" "}
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold
                    ${
                      jl.agreeState === "Disetujui"
                        ? "bg-green-100 text-green-700"
                        : jl.agreeState === "Ditolak"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {jl.agreeState}
                  </span>
                </div>
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
            className={`px-3 py-2 rounded-md text-white text-sm md:text-base
              ${deleteMode ? "bg-red-600 hover:bg-red-700" : "bg-gray-700 hover:bg-gray-800"}`}
            title={deleteMode ? "Matikan Mode Hapus" : "Aktifkan Mode Hapus"}
          >
            {deleteMode ? "Matikan Mode Hapus" : "Aktifkan Mode Hapus"}
          </button>
        )}
      </div>

      {/* Form Pengajuan */}
      {canSeeForm && (
        <div className="bg-white rounded-lg p-4 shadow">
          <h2 className="font-bold text-lg mb-3">Form Pengajuan Surat Tugas</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1">
                Kegiatan Survei
              </label>
              <HUComboBox
                value={input.subSurveyActivityId || null}
                onValueChange={(v) =>
                  setInput((prev) => ({
                    ...prev,
                    subSurveyActivityId: (v ?? "") as string,
                  }))
                }
                options={activityOptions}
                placeholder="-- Pilih Kegiatan Survei --"
              />
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Petugas{" "}
                  {loadingUP && (
                    <span className="text-xs text-gray-500">(memuat…)</span>
                  )}
                </label>
                <HUComboBox
                  value={input.userId || null}
                  onValueChange={(v) => {
                    const userId = (v ?? "") as string;
                    const selectedUP = petugasList.find(
                      (p) => p.userId === userId
                    );
                    const regionAuto =
                      selectedUP?.district?.city?.trim() ||
                      selectedUP?.district?.name?.trim() ||
                      "";
                    setInput((prev) => ({
                      ...prev,
                      userId,
                      region: regionAuto,
                    }));
                  }}
                  options={petugasOptions}
                  placeholder={
                    !input.subSurveyActivityId
                      ? "Pilih kegiatan dulu"
                      : loadingUP
                        ? "Memuat daftar petugas…"
                        : "Pilih atau ketik nama petugas…"
                  }
                  disabled={!input.subSurveyActivityId || loadingUP}
                />
                {!loadingUP &&
                  input.subSurveyActivityId &&
                  petugasList.length === 0 && (
                    <p className="text-xs text-red-600 mt-1">
                      {user?.role === "Supervisor"
                        ? "Anda tidak memiliki petugas yang diawasi pada kegiatan ini."
                        : "Belum ada petugas untuk kegiatan ini."}
                    </p>
                  )}
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Wilayah (otomatis)
                </label>
                <input
                  id="region"
                  value={input.region}
                  readOnly
                  disabled
                  placeholder="Pilih petugas untuk mengisi wilayah"
                  className="w-full px-3 py-2 border rounded-md bg-gray-100 text-gray-700"
                />
              </div>
              <div>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleFile}
                  className="block w-full text-sm text-gray-900 file:mr-4 file:py-2 file:px-4
                         file:rounded-md file:border-gray-500 file:text-sm file:font-semibold
                         file:bg-white file:text-black hover:file:bg-gray-100"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Format: PDF/JPG/PNG. Sesuaikan dengan kebutuhan (Maks. 5MB)
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`${styles.button} my-2 text-white`}
            >
              {loading ? "Mengirim..." : "Ajukan Surat Tugas"}
            </button>
          </form>
        </div>
      )}

      {/* Modal Detail */}
      {isModalOpen && selectedJobLetter && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto py-20">
          <div className="bg-white w-[92%] sm:w-[560px] rounded-lg shadow-lg max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-b">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">
                Detail Pengajuan Surat Tugas
              </h2>
              {selectedJobLetter.eviLetterSignedUrl && (
                <a
                  target="_blank"
                  href={selectedJobLetter.eviLetterSignedUrl}
                  className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm"
                >
                  Lihat Bukti
                </a>
              )}
            </div>

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              <div className="text-sm sm:text-base">
                <p>
                  <strong>Nama Petugas:</strong>{" "}
                  {selectedJobLetter.user?.name || "-"}
                </p>
                <p>
                  <strong>Jenis Survei:</strong>{" "}
                  {selectedJobLetter.subSurveyActivity?.name || "-"}
                </p>
                <p>
                  <strong>Wilayah:</strong> {selectedJobLetter.region || "-"}
                </p>
                <p>
                  <strong>Catatan:</strong>{" "}
                  {selectedJobLetter.rejectNote || "-"}
                </p>
              </div>

              <div className="pt-2">
                <p className="mb-1 font-medium">Status Persetujuan:</p>
                <span
                  className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${
                    selectedJobLetter.agreeState === "Disetujui"
                      ? "bg-green-100 text-green-700"
                      : selectedJobLetter.agreeState === "Ditolak"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {selectedJobLetter.agreeState}
                </span>
              </div>

              {user?.role === "Keuangan" || user?.role === "Superadmin" ? (
                <form
                  onSubmit={handleUpdate}
                  className="space-y-3 pt-4 border-t mt-2"
                >
                  <input
                    type="hidden"
                    id="id"
                    onChange={handleChangeUpdate}
                    value={update.id}
                  />
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Ubah Status
                    </label>
                    <select
                      id="status"
                      value={update.status}
                      onChange={handleChangeUpdate}
                      className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Pilih Status --</option>
                      <option value="Menunggu">Menunggu</option>
                      <option value="Disetujui">Disetujui</option>
                      <option value="Ditolak">Ditolak</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Catatan
                    </label>
                    <input
                      id="rejectNote"
                      value={update.rejectNote}
                      onChange={handleChangeUpdate}
                      placeholder="Catatan jika ditolak / alasan lain"
                      className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={loadingUpdate}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                      {loadingUpdate ? "Menyimpan..." : "Update Status"}
                    </button>
                    <button
                      onClick={() => {
                        setIsModalOpen(false);
                        setSelectedJobLetter(null);
                        setUpdate({
                          id: "",
                          status: "Menunggu",
                          rejectNote: "",
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
                    setSelectedJobLetter(null);
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
    </div>
  );
}
