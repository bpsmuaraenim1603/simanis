"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { ADD_JOBLETTER } from "@/src/graphql/actions/add-jobletter.action";
import { GET_ALL_JOBLETTERS } from "@/src/graphql/actions/find-alljobletter.action";
import { UPDATE_JOB_LETTER_STATUS } from "@/src/graphql/actions/update-jobletterstatus.action";
import { GET_ALL_OF_SUB_SURVEY_ACTIVITIES } from "@/src/graphql/actions/find-realallsubsurvey.action";
import { GET_USER_PROGRESS_BY_SUBSURVEY_ID } from "@/src/graphql/actions/find-usersurveyprogress.action";
import toast from "react-hot-toast";
import styles from "@/src/utils/style";
import useUser from "@/src/hooks/useUser";

/* ===== Types minimal yang dipakai di halaman ini ===== */
type SubSurveyActivity = {
  id: string;
  name: string;
};

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

export default function Partners() {
  const { user } = useUser();

  // ===== Form state =====
  const [input, setInput] = useState({
    userId: "",
    subSurveyActivityId: "",
    region: "", // otomatis dari petugas
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

  // ===== Apollo hooks =====
  const [createJobLetter, { loading }] = useMutation(ADD_JOBLETTER, {
    refetchQueries: [{ query: GET_ALL_JOBLETTERS }],
  });
  const [updateJobLetterStatus, { loading: loadingUpdate }] = useMutation(
    UPDATE_JOB_LETTER_STATUS,
    { refetchQueries: [{ query: GET_ALL_JOBLETTERS }] }
  );

  const { data: dataSubSurvey } = useQuery(GET_ALL_OF_SUB_SURVEY_ACTIVITIES);
  const { data: dataJobLetter } = useQuery(GET_ALL_JOBLETTERS);

  // Petugas by subSurvey (pakai lazy query karena tergantung pilihan kegiatan)
  const [fetchUPBySub, { data: upData, loading: loadingUP }] = useLazyQuery(
    GET_USER_PROGRESS_BY_SUBSURVEY_ID,
    { fetchPolicy: "network-only" }
  );

  // ===== Helpers =====
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setInput({ ...input, [e.target.id]: e.target.value });
  };
  const handleChangeUpdate = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setUpdate({ ...update, [e.target.id]: e.target.value });
  };
  const handleFilter = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFilter({ ...filter, [e.target.id]: e.target.value });
  };
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
  };

  // Ketika pilih kegiatan, fetch petugas (userProgress) untuk kegiatan itu
  useEffect(() => {
    if (input.subSurveyActivityId) {
      fetchUPBySub({
        variables: { subSurveyActivityId: input.subSurveyActivityId },
      });
      // reset petugas & region ketika ganti kegiatan
      setInput((prev) => ({ ...prev, userId: "", region: "" }));
    }
  }, [input.subSurveyActivityId, fetchUPBySub]);

  // Build list petugas dari userProgress
  const petugasList: UserProgressForSelect[] = useMemo(
    () => upData?.userProgressBySubSurveyActivityId ?? [],
    [upData]
  );

  // Ambil region dari userProgress (district) saat user memilih petugas
  const handleSelectPetugas = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const userId = e.target.value;
    const selectedUP = petugasList.find((p) => p.userId === userId);
    const regionAuto =
      selectedUP?.district?.city?.trim() ||
      selectedUP?.district?.name?.trim() ||
      "";
    setInput((prev) => ({ ...prev, userId, region: regionAuto }));
  };

  // ===== Submit create job letter =====
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
          file, // opsional
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

  // ===== Submit update status =====
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
    } catch (error) {
      toast.error("Gagal memperbarui Surat Tugas!");
      console.error(error);
    }
  };

  return (
    <div className="px-8 py-4 space-y-4 font-Poppins">
      <div className="bg-orange-50 rounded-lg p-2 font-bold text-xl flex justify-between shadow-md">
        Surat Tugas Petugas
      </div>

      {/* ===== Filter table ===== */}
      <div className="bg-orange-50 rounded-lg p-2 font-bold text-xl shadow-md space-y-5">
        <div>Filter Petugas</div>
        <div className="flex justify-between space-x-14 text-sm">
          <div className="w-full">
            Wilayah
            <select
              id="wilayah"
              onChange={handleFilter}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">-- Pilih Wilayah --</option>
              <option value="Muara Enim">Muara Enim</option>
              <option value="PALI">PALI</option>
            </select>
          </div>
          <div className="w-full">
            Jenis Survei
            <select
              id="survei"
              onChange={handleFilter}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">-- Pilih Jenis Survei --</option>
              {dataSubSurvey?.allSubSurveyActivities?.map(
                (survei: SubSurveyActivity) => (
                  <option key={survei.id} value={survei.name}>
                    {survei.name}
                  </option>
                )
              )}
            </select>
          </div>
          <div className="w-full">
            Status Persetujuan
            <select
              id="statusPengajuan"
              onChange={handleFilter}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">-- Pilih Status Persetujuan --</option>
              <option value="Menunggu">Menunggu</option>
              <option value="Disetujui">Disetujui</option>
              <option value="Ditolak">Ditolak</option>
            </select>
          </div>
        </div>
      </div>

      {/* ===== Table ===== */}
      <div className="font-bold text-xl">Daftar Petugas</div>
      <div className="relative shadow-md">
        <div className="overflow-x-auto">
          <table className="table-fixed w-full text-sm text-left text-gray-500">
            <thead className="text-gray-700 bg-orange-50 block w-full sm:rounded-t-lg">
              <tr className="table w-full table-fixed">
                <th className="px-6 py-3 uppercase">Nama Petugas</th>
                <th className="px-6 py-3 uppercase">Wilayah</th>
                <th className="px-6 py-3 uppercase">Jenis Survei</th>
                <th className="px-6 py-3 uppercase text-center">
                  Status Surat Tugas
                </th>
                <th className="px-6 py-3 uppercase">Status Persetujuan</th>
                <th className="px-6 py-3 uppercase flex justify-end">Aksi</th>
              </tr>
            </thead>
            <tbody className="block max-h-96 overflow-y-auto w-full">
              {dataJobLetter?.getAllJobLetters
                ?.filter((jl: JobLetterWithUserNSubSurvey) => {
                  if (user?.role !== "Admin" && jl.userId !== user?.id)
                    return false;
                  const matchesRegion =
                    !filter.wilayah || jl.region === filter.wilayah;
                  const matchesSurvei =
                    !filter.survei ||
                    jl.subSurveyActivity?.name?.includes(filter.survei);
                  const matchesStatus =
                    !filter.statusPengajuan ||
                    jl.agreeState === filter.statusPengajuan;
                  return matchesRegion && matchesSurvei && matchesStatus;
                })
                .map((jl: JobLetterWithUserNSubSurvey) => (
                  <tr
                    key={jl.id}
                    className="table w-full table-fixed bg-white text-black"
                  >
                    <td className="px-6 py-3 font-semibold">
                      {jl.user?.name ?? "-"}
                    </td>
                    <td className="px-6 py-3 font-semibold">{jl.region}</td>
                    <td className="px-6 py-3 font-semibold">
                      {jl.subSurveyActivity?.name ?? "-"}
                    </td>
                    <td className="px-6 py-3">
                      {jl.submitDate ? (
                        <div>
                          <span className="inline-block px-2 py-1 text-sm font-medium text-green-700 bg-green-100 rounded-xl">
                            Diserahkan
                          </span>
                          <br />
                          <span>{jl.submitDate.split("T")[0]}</span>
                        </div>
                      ) : (
                        <div>
                          <span className="inline-block px-2 py-1 text-sm font-medium text-yellow-700 bg-yellow-100 rounded-xl">
                            Belum Diserahkan
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div>
                        {jl.agreeState === "Disetujui" ? (
                          <span className="inline-block px-2 py-1 text-sm font-medium text-green-700 bg-green-100 rounded-xl">
                            Disetujui
                          </span>
                        ) : jl.agreeState === "Ditolak" ? (
                          <span className="inline-block px-2 py-1 text-sm font-medium text-red-700 bg-red-100 rounded-xl">
                            Ditolak
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-1 text-sm font-medium text-yellow-700 bg-yellow-100 rounded-xl">
                            Menunggu
                          </span>
                        )}
                        <br />
                        <span>{jl.approveDate?.split?.("T")?.[0] ?? ""}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right flex items-center gap-2 justify-end">
                      <button
                        onClick={() => {
                          setSelectedJobLetter(jl);
                          setUpdate((prev) => ({ ...prev, id: jl.id }));
                          setIsModalOpen(true);
                        }}
                        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Lihat Detail
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Form Pengajuan Surat Tugas ===== */}
      <div className="bg-orange-50 rounded-lg p-4 shadow-md">
        <h1 className="font-bold text-2xl mb-4">Form Pengajuan Surat Tugas</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Kegiatan Survei */}
          <div>
            <label className="block text-sm mb-1 font-semibold">
              Kegiatan Survei
            </label>
            <select
              id="subSurveyActivityId"
              value={input.subSurveyActivityId}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">-- Pilih Kegiatan --</option>
              {dataSubSurvey?.allSubSurveyActivities?.map(
                (sub: SubSurveyActivity) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Petugas (dari userProgress by subSurvey) */}
          <div>
            <label className="block text-sm mb-1 font-semibold">
              Petugas{" "}
              {loadingUP && (
                <span className="text-xs text-gray-500">(memuat…)</span>
              )}
            </label>
            <select
              id="userId"
              value={input.userId}
              onChange={handleSelectPetugas}
              disabled={!input.subSurveyActivityId || loadingUP}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100"
            >
              <option value="">-- Pilih Petugas --</option>
              {petugasList.map((p) => (
                <option key={p.id} value={p.userId}>
                  {p.user?.name ?? p.userId}
                </option>
              ))}
            </select>
            {!loadingUP &&
              input.subSurveyActivityId &&
              petugasList.length === 0 && (
                <p className="text-xs text-red-600 mt-1">
                  Belum ada petugas untuk kegiatan ini.
                </p>
              )}
          </div>

          <div>
            <label className="block text-sm mb-1 font-semibold">
              Wilayah (otomatis dari petugas)
            </label>
            <input
              type="text"
              id="region"
              value={input.region}
              onChange={() => {}}
              readOnly
              disabled
              placeholder="Pilih petugas untuk mengisi wilayah"
              className="w-full px-3 py-2 border rounded-md bg-gray-100 text-gray-700"
            />
          </div>

          {/* File */}
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
              Format: PDF/JPG/PNG. Maks 1MB.
            </p>
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

      {/* ===== Modal Detail ===== */}
      {isModalOpen && selectedJobLetter && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-50 font-Poppins overflow-y-auto py-6">
          <div className="bg-white w-full max-w-2xl mx-auto rounded-lg shadow-lg max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b shrink-0">
              <h2 className="text-xl font-bold text-gray-800">
                Detail Pengajuan Surat Tugas
              </h2>
              {selectedJobLetter.eviLetterSignedUrl && (
                <a
                  target="_blank"
                  href={selectedJobLetter.eviLetterSignedUrl}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md"
                >
                  Lihat Bukti
                </a>
              )}
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
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
                <p className="mb-1">
                  <strong>Status Persetujuan:</strong>
                </p>
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

              {user?.role === "Admin" && (
                <form
                  onSubmit={handleUpdate}
                  className="space-y-3 pt-4 border-t mt-4"
                >
                  <input
                    type="hidden"
                    id="id"
                    onChange={handleChangeUpdate}
                    value={update.id}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ubah Status
                    </label>
                    <select
                      id="status"
                      value={update.status}
                      onChange={handleChangeUpdate}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">-- Pilih Status --</option>
                      <option value="Menunggu">Menunggu</option>
                      <option value="Disetujui">Disetujui</option>
                      <option value="Ditolak">Ditolak</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Catatan
                    </label>
                    <input
                      type="text"
                      id="rejectNote"
                      value={update.rejectNote}
                      onChange={handleChangeUpdate}
                      placeholder="Catatan jika ditolak atau alasan lainnya"
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div className="flex justify-between pt-4">
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
                    >
                      Tutup
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
