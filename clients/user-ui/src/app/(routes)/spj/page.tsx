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
import HUComboBox from "@/src/components/HUCombobox";

type District = { id: string; name?: string; city?: string };
type UserProgressForSelect = {
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

function SPJ() {
  const [input, setInput] = useState({
    userId: "",
    subSurveyActivityId: "",
    verifyNote: "",
  });
  const [file, setFile] = useState<File | null>(null);
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

  const [createSPJ, { loading }] = useMutation(ADD_SPJ, {
    refetchQueries: [{ query: GET_ALL_SPJ }],
  });
  const [updateStatus, { loading: newloading }] = useMutation(
    UPDATE_SPJ_STATUS,
    { refetchQueries: [{ query: GET_ALL_SPJ }] }
  );
  useQuery(GET_ALL_USERS); // dipakai untuk konsistensi cache (opsional)
  const { data: subSurveyData } = useQuery(GET_ALL_OF_SUB_SURVEY_ACTIVITIES);
  const { data: SPJData } = useQuery(GET_ALL_SPJ);
  const { data: userProgressData, loading: loadingPetugas } = useQuery(
    GET_USER_PROGRESS_BY_SUBSURVEY_ID,
    {
      variables: { subSurveyActivityId: input.subSurveyActivityId },
      skip: !input.subSurveyActivityId,
      fetchPolicy: "cache-and-network",
    }
  );
  const { user } = useUser();

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => setInput({ ...input, [e.target.id]: e.target.value });
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFile(e.target.files?.[0] || null);
  const handleChangeUpdate = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setUpdate({ ...update, [e.target.id]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!input.userId || !input.subSurveyActivityId) {
        toast.error("Semua field wajib diisi!");
        return;
      }
      await createSPJ({
        variables: {
          input: {
            userId: input.userId,
            subSurveyActivityId: input.subSurveyActivityId,
            verifyNote: input.verifyNote || undefined,
          },
          file,
        },
      });
      toast.success("Pengajuan Honor berhasil ditambahkan!");
      setInput({ userId: "", subSurveyActivityId: "", verifyNote: "" });
      setFile(null);
    } catch (error) {
      toast.error("Gagal menambahkan SPJ!");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!update.id || !update.status) {
        toast.error("Semua field wajib diisi!");
        return;
      }
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

  useEffect(() => {
    setInput((prev) => ({ ...prev, userId: "" }));
  }, [input.subSurveyActivityId]);

  const petugasOptions: UserProgressForSelect[] = useMemo(
    () => userProgressData?.userProgressBySubSurveyActivityId ?? [],
    [userProgressData]
  );

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

  const activityOptions = useMemo(
    () =>
      (subSurveyData?.allSubSurveyActivities ?? []).map(
        (sub: { id: string; name: string }) => ({
          value: sub.id,
          label: sub.name ?? "-",
        })
      ),
    [subSurveyData]
  );

  const statusOptions = useMemo(
    () => [
      { value: "", label: "Semua Status" }, // untuk filter
      { value: "Menunggu", label: "Menunggu" },
      { value: "Disetujui", label: "Disetujui" },
      { value: "Ditolak", label: "Ditolak" },
    ],
    []
  );

  const petugasOptionField = useMemo(
    () =>
      (userProgressData?.userProgressBySubSurveyActivityId ?? []).map(
        (u: UserProgressForSelect) => ({
          value: u.userId,
          label: u.user?.name || u.userId,
          subLabel:
            u.district?.city?.trim() || u.district?.name?.trim() || undefined,
        })
      ),
    [userProgressData]
  );

  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-6 md:px-8 py-4 space-y-4 font-Poppins">
      <div className="bg-orange-50 rounded-lg p-3 md:p-4 font-bold text-lg md:text-xl shadow-md">
        Pengajuan Honor
      </div>

      {/* Filter */}
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
                { value: "", label: "Semua Jenis Survei" }, // baris “kosongkan”
                ...(subSurveyData?.allSubSurveyActivities ?? []).map(
                  (sub: SubSurveyActivity) => ({
                    value: sub.name, // filter kamu membandingkan by name
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

      <div className="font-bold text-lg">Monitoring Pengajuan Honor</div>

      {/* Tabel (desktop) */}
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
                <td className="px-6 py-4 text-right">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Kartu (mobile) */}
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
                <button
                  onClick={() => {
                    setSelectedSPJ(spj);
                    setIsModalOpen(true);
                    setUpdate((u) => ({ ...u, id: spj.id }));
                  }}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                >
                  Detail
                </button>
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

      {/* Form (hanya Admin/Superadmin) */}
      {(user?.role === "Admin" || user?.role === "Superadmin") && (
        <div className="bg-white rounded-lg p-4 shadow">
          <h2 className="text-lg font-bold mb-3">Form Pengajuan Honor</h2>
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
                placeholder="-- Pilh Kegiatan Survei --"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">
                Petugas
              </label>
              <HUComboBox
                value={input.userId || null}
                onValueChange={(v) =>
                  setInput((prev) => ({ ...prev, userId: (v ?? "") as string }))
                }
                options={petugasOptionField}
                placeholder={
                  !input.subSurveyActivityId
                    ? "Pilih kegiatan dulu"
                    : loadingPetugas
                      ? "Memuat daftar petugas…"
                      : "-- Pilih Petugas --"
                }
                disabled={!input.subSurveyActivityId || loadingPetugas}
              />
              {!loadingPetugas &&
                input.subSurveyActivityId &&
                petugasOptions.length === 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    Belum ada petugas untuk kegiatan ini.
                  </p>
                )}
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">
                Catatan
              </label>
              <textarea
                id="verifyNote"
                placeholder="Catatan (opsional)"
                value={input.verifyNote}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <input
                type="file"
                id="file"
                accept=".pdf,image/*"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-900 file:mr-4 file:py-2 file:px-4
                           file:rounded-md file:border-gray-500 file:text-sm file:font-semibold
                           file:bg-white file:text-black hover:file:bg-gray-100"
              />
              <p className="text-xs text-gray-500 mt-1">
                Format: PDF/JPG/PNG. Maks 1MB.
              </p>
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

      {/* Modal Detail */}
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
                  href={selectedSPJ.eviDocumentSignedUrl}
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

              <div className="pt-2">
                <p className="mb-1 font-medium">Status Persetujuan:</p>
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

              {user?.role === "Keuangan" || user?.role === "Superadmin" ? (
                <form
                  onSubmit={handleUpdate}
                  className="space-y-3 pt-4 border-t mt-2"
                >
                  <input
                    type="hidden"
                    id="id"
                    value={update.id}
                    onChange={handleChangeUpdate}
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
                      options={statusOptions.filter((o) => o.value)} // hilangkan baris "Semua Status"
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
    </div>
  );
}

export default SPJ;
