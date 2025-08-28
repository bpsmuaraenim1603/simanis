"use client";

import React, { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { ADD_SPJ } from "@/src/graphql/actions/add-spj.action";
import { GET_ALL_SPJ } from "@/src/graphql/actions/find-allspj.action";
import { UPDATE_SPJ_STATUS } from "@/src/graphql/actions/update-spjstatus.action";
import styles from "@/src/utils/style";
import { GET_ALL_USERS } from "@/src/graphql/actions/find-allusers.action";
import { GET_ALL_OF_SUB_SURVEY_ACTIVITIES } from "@/src/graphql/actions/find-realallsubsurvey.action";
import toast from "react-hot-toast";
import useUser from "@/src/hooks/useUser";

function SPJ() {
  type User = {
    id: string;
    name: string;
    email: string;
    password: string;
    role: string;
    address: string;
    phone_number: string;
    updatedAt: string;
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
    approveDate: string;
    eviDocumentUrl: string;
    verifyNote: string;
  };

  type SPJWithUserNSubSurvey = SPJ & {
    user?: {
      id: string;
      name: string;
    };
    subSurveyActivity?: {
      id: string;
      name: string;
    };
  };

  const [input, setInput] = useState({
    userId: "",
    subSurveyActivityId: "",
    eviDocumentUrl: "",
  });

  const [update, setUpdate] = useState({
    id: "",
    status: "Disetujui",
    verifyNote: "",
  });

  const [filter, setFilter] = useState({
    jenisSurvei: "",
    statusPengajuan: "",
  });

  const [selectedSPJ, setSelectedSPJ] = useState<SPJWithUserNSubSurvey | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [createSPJ, { loading, data, error }] = useMutation(ADD_SPJ);
  const [
    updateStatus,
    { loading: newloading, data: newData, error: newError },
  ] = useMutation(UPDATE_SPJ_STATUS);
  const { data: userData } = useQuery(GET_ALL_USERS);
  const { data: subSurveyData } = useQuery(GET_ALL_OF_SUB_SURVEY_ACTIVITIES);
  const { data: SPJData } = useQuery(GET_ALL_SPJ);

  const { user } = useUser();

  // === Tambahan: state & handler upload ke Google Drive ===
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    try {
      if (!file) {
        toast.error("Pilih file dulu ya.");
        return;
      }
      if (!input.subSurveyActivityId) {
        toast.error("Pilih Kegiatan terlebih dahulu.");
        return;
      }
      setUploading(true);

      const fd = new FormData();
      fd.append("file", file);
      // gunakan ID kegiatan agar penamaan rapi di Drive
      fd.append("spjId", input.subSurveyActivityId);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/uploads/spj-drive`,
        {
          method: "POST",
          body: fd,
        }
      );

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Upload gagal (${res.status})`);
      }

      const data = await res.json();
      // Drive mengembalikan webViewLink → simpan sebagai eviDocumentUrl
      setInput((prev) => ({ ...prev, eviDocumentUrl: data.webViewLink }));
      toast.success("File berhasil diupload ke Google Drive!");
    } catch (err: any) {
      toast.error(err?.message || "Gagal upload file");
    } finally {
      setUploading(false);
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!input.userId || !input.subSurveyActivityId) {
        toast.error("Semua field wajib diisi!");
        return;
      }
      await createSPJ({ variables: { input } });
      toast.success("Pengajuan Honor berhasil ditambahkan!");
      setInput({
        userId: "",
        subSurveyActivityId: "",
        eviDocumentUrl: "",
      });
    } catch (error) {
      toast.error("Gagal menambahkan SPJ!");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!update.id || !update.status || !update.verifyNote) {
        toast.error("Semua field wajib diisi!");
        return;
      }

      await updateStatus({ variables: { input: update } });
      toast.success("Status Pengajuan Honor berhasil diperbarui!");
      setUpdate({ id: "", status: "", verifyNote: "" });
    } catch (error) {
      toast.error("Gagal memperbarui Status Pengajuan Honor!");
      console.error(error);
    }
  };

  return (
    <div className="px-8 py-4 space-y-4 font-Poppins">
      <div className="bg-orange-50 rounded-lg p-2 font-bold text-xl flex justify-between shadow-md">
        Pengajuan Honor
      </div>
      <div className="bg-orange-50 rounded-lg p-2 font-bold text-xl shadow-md space-y-5">
        <div>Filter SPJ</div>
        <div className="flex justify-between space-x-14 text-sm">
          <div className="w-full">
            Jenis Survei
            <select
              id="jenisSurvei"
              onChange={(e) =>
                setFilter({ ...filter, jenisSurvei: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">-- Pilih Jenis Survei --</option>
              {subSurveyData?.allSubSurveyActivities?.map(
                (sub: SubSurveyActivity) => (
                  <option key={sub.id} value={sub.name}>
                    {sub.name}
                  </option>
                )
              )}
            </select>
          </div>
          <div className="w-full">
            Status Pengajuan
            <select
              id="statusPengajuan"
              onChange={(e) =>
                setFilter({ ...filter, statusPengajuan: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">-- Pilih Status Pengajuan --</option>
              <option value="Menunggu">Menunggu</option>
              <option value="Disetujui">Disetujui</option>
              <option value="Ditolak">Ditolak</option>
            </select>
          </div>
        </div>
      </div>
      <div className="font-bold text-xl">Monitoring Pengajuan Honor</div>
      <div className="relative shadow-md">
        <table className="table-fixed w-full text-sm text-left text-gray-500">
          <thead className="text-gray-700 bg-orange-50 block w-full sm:rounded-t-lg">
            <tr className="table w-full table-fixed">
              <th scope="col" className="px-6 py-3 uppercase">
                <div className="flex items-center">Nama Petugas</div>
              </th>
              <th scope="col" className="px-6 py-3 uppercase">
                <div className="flex items-center">Kegiatan Survei</div>
              </th>
              <th scope="col" className="px-6 py-3 uppercase">
                <div className="flex items-center">Status Pengajuan</div>
              </th>
              <th scope="col" className="px-6 py-3 uppercase flex justify-end">
                <div className="flex items-center">Aksi</div>
              </th>
            </tr>
          </thead>
          <tbody className="block max-h-96 overflow-y-auto w-full">
            {SPJData?.getAllSPJ
              ?.filter((spj: SPJWithUserNSubSurvey) => {
                if (user?.role !== "Admin" && spj.userId !== user?.id) {
                  return false;
                }
                const matchesJenis =
                  !filter.jenisSurvei ||
                  spj.subSurveyActivity?.name === filter.jenisSurvei;
                const matchesPengajuan =
                  !filter.statusPengajuan ||
                  spj.submitState === filter.statusPengajuan;
                return matchesJenis && matchesPengajuan;
              })
              .map((spj: SPJWithUserNSubSurvey) => (
                <tr
                  key={spj.id}
                  className="table w-full table-fixed bg-white border-b text-black font-semibold"
                >
                  <td className="px-6 py-4">{spj?.user?.name || "-"}</td>
                  <td className="px-6 py-4">
                    {spj?.subSurveyActivity?.name || "-"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-2 py-1 text-sm font-medium rounded
              ${
                spj.submitState === "Disetujui"
                  ? "bg-green-100 text-green-700"
                  : spj.submitState === "Ditolak"
                    ? "bg-red-100 text-red-700"
                    : "bg-yellow-100 text-yellow-700"
              }`}
                    >
                      {spj?.submitState}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => {
                        setSelectedSPJ(spj);
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
      {/* Form Pengajuan Honor */}
      {user?.role === "Admin" && (
        <div className="bg-orange-50 rounded-lg p-4 shadow-md">
          <h1 className="text-2xl font-bold mb-4">Form Pengajuan Honor</h1>
          <form onSubmit={handleSubmit} className="space-y-4 ">
            <div>
              <select
                id="userId"
                value={input.userId}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Pilih Pengguna --</option>
                {userData?.getUsers?.map((user: User) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                id="subSurveyActivityId"
                value={input.subSurveyActivityId}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Pilih Kegiatan --</option>
                {subSurveyData?.allSubSurveyActivities?.map(
                  (sub: SubSurveyActivity) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <input
                type="text"
                id="eviDocumentUrl"
                placeholder="Link Bukti Pengajuan Honor"
                value={input.eviDocumentUrl}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            {/* Upload bukti (Google Drive) */}
            <div className="space-y-2">
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading || !file}
                  className="px-3 py-2 bg-sky-600 text-white rounded disabled:opacity-60"
                >
                  {uploading ? "Mengunggah…" : "Upload Bukti"}
                </button>

                {input.eviDocumentUrl && (
                  <a
                    href={input.eviDocumentUrl}
                    target="_blank"
                    className="text-blue-600 underline break-all"
                  >
                    Lihat Bukti
                  </a>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`${styles.button} my-2 text-white`}
            >
              {loading ? "Mengirim..." : "Ajukan SPJ"}
            </button>
          </form>
        </div>
      )}
      {isModalOpen && selectedSPJ && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto py-6"
          role="dialog"
          aria-modal="true"
        >
          {/* Card modal */}
          <div className="bg-white w-[90%] max-w-lg rounded-lg shadow-lg max-h-[90vh] flex flex-col">
            {/* Header (tetap di atas) */}
            <div className="flex justify-between items-center px-6 py-4 border-b shrink-0">
              <h2 className="text-xl font-bold">Detail SPJ</h2>
              <p>
                <a
                  target="_blank"
                  href={selectedSPJ.eviDocumentUrl}
                  className="bg-blue-500 text-white px-2 py-1 rounded-md"
                >
                  Lihat Bukti
                </a>
              </p>
            </div>

            {/* Body (bagian ini yang scroll) */}
            <div className="p-6 space-y-3 overflow-y-auto">
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

              <div className="pt-2">
                <p className="mb-1">
                  <strong>Status Persetujuan:</strong>
                </p>
                <span
                  className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${
                    selectedSPJ.submitState === "Disetujui"
                      ? "bg-green-100 text-green-700"
                      : selectedSPJ.submitState === "Ditolak"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {selectedSPJ.submitState}
                </span>
              </div>

              {user?.role === "Admin" && (
                <form
                  onSubmit={handleUpdate}
                  className="space-y-3 pt-4 border-t mt-4"
                >
                  <h3 className="font-semibold">Form Ubah Status SPJ</h3>

                  <input
                    type="hidden"
                    id="id"
                    value={update.id}
                    onChange={handleChangeUpdate}
                  />

                  <div>
                    <select
                      id="status"
                      value={update.status}
                      onChange={(e) =>
                        setUpdate({
                          ...update,
                          status: e.target.value,
                          id: selectedSPJ.id,
                        })
                      }
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="Menunggu">Menunggu</option>
                      <option value="Disetujui">Disetujui</option>
                      <option value="Ditolak">Ditolak</option>
                    </select>
                  </div>

                  <div>
                    <input
                      type="text"
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
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={newloading}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                  >
                    {newloading ? "Menyimpan..." : "Simpan Perubahan"}
                  </button>
                </form>
              )}
            </div>

            {/* Footer (tetap di bawah) */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t shrink-0">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedSPJ(null);
                  setUpdate({ id: "", status: "Disetujui", verifyNote: "" });
                }}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SPJ;
