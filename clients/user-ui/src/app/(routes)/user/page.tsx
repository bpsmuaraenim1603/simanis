"use client";

import HUComboBox from "@/src/components/HUCombobox";
import { GET_USER_PROGRESS_BY_USER_ID } from "@/src/graphql/actions/find-usersurveyprogressbyuser.action";
import { PATCH_USER_SAMPLES } from "@/src/graphql/actions/patch-usersamples.action";
// import { UPDATE_USER_PROGRESS } from "@/src/graphql/actions/update-userprogress.action";
import useUser from "@/src/hooks/useUser";
import styles from "@/src/utils/style";
import { useLazyQuery, useMutation } from "@apollo/client";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useMemo } from "react";
import toast from "react-hot-toast";

type SubSurveyOption = { id: string; name: string };

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

export default function UserPage() {
  const getDistrictId = (up: any) =>
    up?.districtId ??
    up?.district?.id ??
    up?.subSurveyActivity?.districtId ??
    up?.subSurveyActivity?.district?.id ??
    "";

  const { user, loading } = useUser();

  const router = useRouter();

  // roles yang diizinkan
  const ALLOWED = new Set(["Superadmin", "User"]);

  React.useEffect(() => {
    if (loading) return;
    const role = user?.role ?? "";

    if (!ALLOWED.has(role)) {
      toast.error("Akses ditolak. Mengarahkan ke Beranda");
      router.replace("/dashboard");
    }
  }, [loading, user?.role, router]);

  // ===== Update user progress =====
  const [updateUserProgressForm, setUpdateUserProgressForm] = useState({
    userProgressId: "",
    subSurveyActivityId: "",
    totalAssigned: 0,
    submitCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    blockCount: "",
    lastUpdated: "",
    districtId: "",
  });
  const [selectedBlock, setSelectedBlock] = useState<string>("");

  const [fetchUserProgress, { data: userProgressData, loading: upLoading }] =
    useLazyQuery(GET_USER_PROGRESS_BY_USER_ID, { fetchPolicy: "network-only" });

  useEffect(() => {
    if (user?.id) fetchUserProgress({ variables: { userId: user.id } });
  }, [user?.id, fetchUserProgress]);

  const [patchUserSamples, { loading: patching }] =
    useMutation(PATCH_USER_SAMPLES);

  const currentUP = useMemo(() => {
    const rows = userProgressData?.userProgressSurveyByUserId ?? [];
    const filtered = rows.filter(
      (up: any) =>
        up?.subSurveyActivity?.id === updateUserProgressForm.subSurveyActivityId
    );
    if (filtered.length === 0) return undefined;

    const blk = (selectedBlock ?? "").toString().trim();
    if (blk) {
      const byBlock = filtered.find(
        (up: any) => (up?.blockCount ?? "").toString().trim() === blk
      );
      return byBlock ?? filtered[0];
    }
    return filtered[0];
  }, [
    userProgressData,
    updateUserProgressForm.subSurveyActivityId,
    selectedBlock,
  ]);

  const rawType = currentUP?.subSurveyActivity?.activityType ?? "";
  const isListing = rawType.toLowerCase() === "listing";

  const [editableSamples, setEditableSamples] = useState<any[]>([]);
  const [locatingId, setLocatingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUP?.samples) {
      const sorted = [...currentUP.samples].sort(
        (a: any, b: any) => Number(a.nus) - Number(b.nus)
      );

      setEditableSamples(sorted.map((s: any) => ({ ...s })));
    } else {
      setEditableSamples([]);
    }
  }, [currentUP?.id]);

  const subSurveyOptions = React.useMemo(() => {
    const rows = userProgressData?.userProgressSurveyByUserId ?? [];
    const pairs = rows
      .filter((up: any) => up?.subSurveyActivity?.id)
      .map(
        (up: any) => [up.subSurveyActivity.id, up.subSurveyActivity] as const
      );
    return Array.from(new Map(pairs).values());
  }, [userProgressData]);

  const subSurveyHUOptions = useMemo(() => {
    const rows = (
      Array.isArray(subSurveyOptions) ? subSurveyOptions : []
    ) as SubSurveyOption[];
    return rows.map(({ id, name }) => ({ value: id, label: name ?? "-" }));
  }, [subSurveyOptions]);

  const blockHUOptions = useMemo(() => {
    const rows = userProgressData?.userProgressSurveyByUserId ?? [];

    const filtered = updateUserProgressForm.subSurveyActivityId
      ? rows.filter(
          (r: any) =>
            r?.subSurveyActivity?.id ===
            updateUserProgressForm.subSurveyActivityId
        )
      : [];

    const blocks: string[] = filtered
      .map((r: any) => String(r?.blockCount ?? "").trim())
      .filter((v: string) => v.length > 0);

    // <-- Set<string> -> Array<string>
    const uniq: string[] = Array.from(new Set<string>(blocks)).sort((a, b) =>
      a.localeCompare(b, "id")
    );

    return uniq.map((b) => ({ value: b, label: `Blok ${b}` }));
  }, [userProgressData, updateUserProgressForm.subSurveyActivityId]);

  const toFloatOrNull = (v: any) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  useEffect(() => {
    setSelectedBlock("");
  }, [updateUserProgressForm.subSurveyActivityId]);

  useEffect(() => {
    if (!updateUserProgressForm.subSurveyActivityId) return;
    if (!blockHUOptions.length) return;
    if (blockHUOptions.length === 1) {
      setSelectedBlock(blockHUOptions[0].value);
    }
  }, [blockHUOptions, updateUserProgressForm.subSurveyActivityId]);

  const handleChangeUpdateUserProgress = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { id, value } = e.target;
    if (id === "subSurveyActivityId") {
      const rows = userProgressData?.userProgressSurveyByUserId ?? [];
      const up = rows.find((r: any) => r?.subSurveyActivity?.id === value);
      setUpdateUserProgressForm((prev) => ({
        ...prev,
        subSurveyActivityId: value,
        districtId: getDistrictId(up),
      }));
    } else {
      setUpdateUserProgressForm((prev) => ({ ...prev, [id]: value }));
    }
  };

  if (loading) {
    return (
      <div className="max-w-screen-xl mx-auto px-3 py-6 font-Poppins">
        Memuat…
      </div>
    );
  }
  if (!user || !ALLOWED.has(user.role ?? "")) {
    return null;
  }

  async function patchAllSamples() {
    const userProgressId =
      currentUP?.id || updateUserProgressForm.userProgressId;
    if (!userProgressId) return toast.error("Pilih kegiatan & blok dulu ya.");

    try {
      await patchUserSamples({
        variables: {
          input: {
            userProgressId,
            updateSamples: editableSamples.map((s) => ({
              id: s.id,
              cacahStatus: s.cacahStatus,
              geoLat: toFloatOrNull(s.geoLat),
              geoLng: toFloatOrNull(s.geoLng),
              geoCapturedAt: new Date().toISOString(),
            })),
          },
        },
      });

      await fetchUserProgress({ variables: { userId: user!.id } });
      toast.success("Semua sampel tersimpan");
    } catch (e: any) {
      showApolloError(e);
    }
  }

  function showApolloError(e: any) {
    console.log("ApolloError message:", e?.message);
    console.log("graphQLErrors:", e?.graphQLErrors);
    console.log("networkError:", e?.networkError);
    const msg =
      e?.graphQLErrors?.[0]?.message ||
      e?.networkError?.message ||
      e?.message ||
      "Terjadi error saat menyimpan.";
    toast.error(msg);
  }

  function openMap(lat: number, lng: number) {
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function fmtCoord(v: any, digits = 6) {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(digits) : String(v ?? "");
  }

  function ambilLokasiDanPatch(sampleId: string) {
    const userProgressId =
      currentUP?.id || updateUserProgressForm.userProgressId;
    if (!userProgressId) return toast.error("Pilih kegiatan & blok dulu ya.");

    const sampleIndex = editableSamples.findIndex((s) => s.id === sampleId);
    if (sampleIndex === -1)
      return toast.error("Sample tidak ditemukan di state.");

    if (!navigator.geolocation) {
      toast.error("Browser tidak mendukung lokasi.");
      return;
    }

    setLocatingId(sampleId);
    const toastId = toast.loading("Sedang mengambil lokasi...");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setEditableSamples((prev) =>
          prev.map((s, i) =>
            i === sampleIndex
              ? { ...s, geoLat: lat, geoLng: lng, cacahStatus: "Selesai" }
              : s
          )
        );

        try {
          await patchUserSamples({
            variables: {
              input: {
                userProgressId,
                updateSamples: [
                  {
                    id: sampleId,
                    cacahStatus: "Selesai",
                    geoLat: lat,
                    geoLng: lng,
                    geoCapturedAt: new Date().toISOString(),
                  },
                ],
              },
            },
          });

          toast.success("Lokasi tersimpan & status jadi Selesai", {
            id: toastId,
          });
          await fetchUserProgress({ variables: { userId: user!.id } });
        } catch (e: any) {
          toast.error("Gagal menyimpan lokasi", { id: toastId });
          showApolloError(e);
          await fetchUserProgress({ variables: { userId: user!.id } });
        } finally {
          setLocatingId(null);
        }
      },
      (err) => {
        toast.error(`Gagal ambil lokasi: ${err.message}`, { id: toastId });
        setLocatingId(null);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function resetCacah(sampleId: string) {
    const userProgressId =
      currentUP?.id || updateUserProgressForm.userProgressId;
    if (!userProgressId) return toast.error("Pilih kegiatan & blok dulu ya.");

    const sampleIndex = editableSamples.findIndex((s) => s.id === sampleId);
    if (sampleIndex === -1)
      return toast.error("Sample tidak ditemukan di state.");
    if (!window.confirm("Yakin ingin mereset sampel?")) return;

    setResettingId(sampleId);
    const toastId = toast.loading("Mereset pencacahan...");

    setEditableSamples((prev) =>
      prev.map((s, i) =>
        i === sampleIndex
          ? {
              ...s,
              cacahStatus: "Belum_Cacah",
              geoLat: null,
              geoLng: null,
              geoCapturedAt: null,
            }
          : s
      )
    );

    try {
      await patchUserSamples({
        variables: {
          input: {
            userProgressId,
            updateSamples: [
              {
                id: sampleId,
                cacahStatus: "Belum_Cacah",
                geoLat: null,
                geoLng: null,
                geoCapturedAt: null,
              },
            ],
          },
        },
      });

      toast.success("Berhasil direset", { id: toastId });
      await fetchUserProgress({ variables: { userId: user!.id } });
    } catch (e: any) {
      toast.error("Gagal reset", { id: toastId });
      showApolloError(e);
      await fetchUserProgress({ variables: { userId: user!.id } });
    } finally {
      setResettingId(null);
    }
  }

  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-6 md:px-8 py-4 space-y-4 font-Poppins">
      <div className="bg-orange-50 rounded-lg p-3 md:p-4 font-bold text-lg md:text-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-md">
        <span>Panel Petugas</span>
      </div>
      <div className="bg-blue-100 rounded-lg p-4 shadow-md">
        <form onSubmit={(e) => e.preventDefault()} className="space-y-3">
          <h3 className="text-base md:text-lg font-bold">
            Update Data Petugas
          </h3>

          <div>
            <label
              htmlFor="subSurveyActivityId"
              className="block text-sm font-bold mb-1"
            >
              Kegiatan Survei
            </label>
            <HUComboBox
              value={updateUserProgressForm.subSurveyActivityId || null}
              onValueChange={(v) =>
                setUpdateUserProgressForm((p) => ({
                  ...p,
                  subSurveyActivityId: (v ?? "") as string,
                }))
              }
              options={subSurveyHUOptions}
              placeholder="-- Pilih kegiatan survei --"
            />
            {updateUserProgressForm.subSurveyActivityId && (
              <p className="mt-1 text-xs">
                Tipe kegiatan:{" "}
                <span
                  className={`px-2 py-0.5 rounded ${isListing ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
                >
                  {isListing ? "Listing" : "Non-Listing"}
                </span>
              </p>
            )}
            <div className="mt-2">
              <label className="block text-sm font-bold mb-1">Blok</label>
              <HUComboBox
                value={selectedBlock || null}
                onValueChange={(v) => setSelectedBlock((v ?? "") as string)}
                options={blockHUOptions}
                placeholder={
                  !updateUserProgressForm.subSurveyActivityId
                    ? "Pilih kegiatan dulu"
                    : blockHUOptions.length === 0
                      ? "Tidak ada blok"
                      : "-- Pilih Blok --"
                }
                disabled={
                  !updateUserProgressForm.subSurveyActivityId ||
                  blockHUOptions.length === 0
                }
              />
            </div>
          </div>

          {selectedBlock ? (
            <div className="border rounded-md space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  Daftar Sampel ({editableSamples.length} Baris)
                </h3>
              </div>

              {editableSamples.length === 0 ? (
                <div className="text-sm opacity-70">Belum ada sampel.</div>
              ) : (
                <div className="space-y-2 bg-white p-2 rounded-md border">
                  {editableSamples.map((s, idx) => (
                    <div
                      key={s.id}
                      className="sm:flex sm:justify-between grid grid-cols-1 gap-2 items-center border rounded-md p-2"
                    >
                      <div className="text-sm font-semibold w-full">
                        NUS: {s.nus}
                      </div>

                      {/* Nama Sampel */}
                      <input
                        value={s.identity}
                        readOnly
                        className="w-full px-3 py-2 border rounded-md bg-white text-sm font-semibold focus:outline-none cursor-default"
                      />

                      {/* Status Pencacahan */}
                      <input
                        value={
                          s.cacahStatus === "Selesai"
                            ? "Selesai"
                            : "Belum Dicacah"
                        }
                        readOnly
                        className={`w-full px-3 py-2 border rounded-md ${s.cacahStatus === "Selesai" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"} text-sm font-semibold focus:outline-none cursor-default`}
                      />

                      {/* Status Persetujuan (read-only untuk petugas) */}
                      <input
                        value={s.approvalStatus ?? "Menunggu"}
                        disabled
                        className={`w-full px-3 py-2 border rounded-md ${s.approvalStatus === "Disetujui" ? "bg-green-50 text-green-700" : s.approvalStatus == "Ditolak" ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-700"} text-sm font-semibold focus:outline-none`}
                      />

                      <div className="flex gap-2 flex-wrap justify-end w-full">
                        {s.geoLat && s.geoLng ? (
                          <IconButton
                            label={`Lihat Lokasi (${fmtCoord(s.geoLat)}, ${fmtCoord(s.geoLng)})`}
                            onClick={() =>
                              openMap(Number(s.geoLat), Number(s.geoLng))
                            }
                            className="bg-purple-600 border-purple-600 hover:bg-purple-500"
                          >
                            {/* icon lokasi */}
                            <svg
                              viewBox="0 0 24 24"
                              className="h-5 w-5"
                              aria-hidden="true"
                            >
                              <path
                                d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11z"
                                fill="currentColor"
                                opacity=".15"
                              />
                              <path
                                d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11z"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                              <path
                                d="M12 11.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                            </svg>
                          </IconButton>
                        ) : (
                          <IconButton
                            label="Koordinat belum tersedia"
                            disabled
                            className="bg-purple-200 border-purple-200 text-purple-800"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="h-5 w-5"
                              aria-hidden="true"
                            >
                              <path
                                d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11z"
                                fill="currentColor"
                                opacity=".15"
                              />
                              <path
                                d="M7 7l10 10"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            </svg>
                          </IconButton>
                        )}
                        <IconButton
                          label={
                            locatingId === s.id
                              ? "Mengambil Lokasi..."
                              : s.cacahStatus === "Selesai"
                                ? "Sudah Dicacah"
                                : "Mulai Pencacahan"
                          }
                          onClick={() => ambilLokasiDanPatch(s.id)}
                          disabled={
                            s.cacahStatus === "Selesai" ||
                            locatingId === s.id ||
                            resettingId === s.id
                          }
                          className="bg-blue-600 border-blue-600 hover:bg-blue-500"
                        >
                          {/* icon pensil */}
                          <svg
                            viewBox="0 0 24 24"
                            className="h-5 w-5"
                            aria-hidden="true"
                          >
                            <path
                              d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0 0-2.1l-1.9-1.9a1.5 1.5 0 0 0-2.1 0L4 16v4z"
                              fill="currentColor"
                              opacity=".15"
                            />
                            <path
                              d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0 0-2.1l-1.9-1.9a1.5 1.5 0 0 0-2.1 0L4 16v4z"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M13.5 6.5l4 4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                        </IconButton>
                        {s.cacahStatus === "Selesai" && (
                          <IconButton
                            label={
                              resettingId === s.id ? "Mereset..." : "Reset"
                            }
                            onClick={() => resetCacah(s.id)}
                            disabled={
                              resettingId === s.id || locatingId === s.id
                            }
                            className="bg-red-600 border-red-600 hover:bg-red-500"
                          >
                            {/* icon reset */}
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
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm opacity-70">
              Pilih kegiatan dan blok untuk menampilkan sampel.
            </div>
          )}

          {/* <div className="md:col-span-2 flex justify-end">
            <button
              type="button"
              onClick={patchAllSamples}
              className={`${styles.button} my-2 text-white w-full sm:w-auto`}
              disabled={
                !currentUP?.id || editableSamples.length === 0 || patching
              }
            >
              Simpan Semua Sampel
            </button>
          </div> */}
        </form>
      </div>
    </div>
  );
}
