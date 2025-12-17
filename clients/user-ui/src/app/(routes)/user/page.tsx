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

  useEffect(() => {
    if (currentUP?.samples) {
      setEditableSamples(currentUP.samples.map((s: any) => ({ ...s })));
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

  // async function patchOneSample(sample: any) {
  //   const userProgressId =
  //     currentUP?.id || updateUserProgressForm.userProgressId;
  //   if (!userProgressId) return toast.error("Pilih kegiatan & blok dulu ya.");

  //   try {
  //     await patchUserSamples({
  //       variables: {
  //         input: {
  //           userProgressId,
  //           updateSamples: [
  //             {
  //               id: sample.id,
  //               cacahStatus: sample.cacahStatus,
  //               geoLat: sample.geoLat ?? null,
  //               geoLng: sample.geoLng ?? null,
  //               geoCapturedAt: new Date().toISOString(),
  //             },
  //           ],
  //         },
  //       },
  //     });

  //     await fetchUserProgress({ variables: { userId: user!.id } });
  //     toast.success("Tersimpan");
  //   } catch (e: any) {
  //     showApolloError(e);
  //   }
  // }

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
              geoLat: s.geoLat ?? null,
              geoLng: s.geoLng ?? null,
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

  async function patchSample(sample: any) {
    const userProgressId =
      currentUP?.id || updateUserProgressForm.userProgressId;
    if (!userProgressId) {
      toast.error(
        "User progress belum dipilih. Pilih kegiatan & blok dulu ya."
      );
      return;
    }

    await patchUserSamples({
      variables: {
        input: {
          userProgressId,
          updateSamples: [
            {
              id: sample.id,
              cacahStatus: sample.cacahStatus,
              geoLat: sample.geoLat,
              geoLng: sample.geoLng,
              geoCapturedAt: new Date().toISOString(),
            },
          ],
        },
      },
    });

    await fetchUserProgress({ variables: { userId: user!.id } });
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

  function ambilLokasiDanPatch(sampleId: string) {
    const userProgressId =
      currentUP?.id || updateUserProgressForm.userProgressId;
    if (!userProgressId) return toast.error("Pilih kegiatan & blok dulu ya.");

    if (!navigator.geolocation) {
      toast.error("Browser tidak mendukung lokasi.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await patchUserSamples({
            variables: {
              input: {
                userProgressId,
                updateSamples: [
                  {
                    id: sampleId,
                    geoLat: pos.coords.latitude,
                    geoLng: pos.coords.longitude,
                    geoCapturedAt: new Date().toISOString(),
                  },
                ],
              },
            },
          });

          await fetchUserProgress({ variables: { userId: user!.id } });
          toast.success("Lokasi tersimpan");
        } catch (e: any) {
          showApolloError(e);
        }
      },
      (err) => {
        // INI yang sebelumnya kamu belum punya
        toast.error(`Gagal ambil lokasi: ${err.message}`);
        console.log("Geolocation error:", err);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
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
              {!!selectedBlock && (
                <p className="mt-1 text-xs text-gray-600">
                  Menampilkan data untuk <b>Blok {selectedBlock}</b>.
                </p>
              )}
            </div>
          </div>

          {currentUP?.id ? (
            <div className="border rounded-md p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Daftar Sampel</h3>
                <div className="text-xs opacity-70">
                  Blok: {currentUP.blockCount ?? "-"}
                </div>
              </div>

              {editableSamples.length === 0 ? (
                <div className="text-sm opacity-70">Belum ada sampel.</div>
              ) : (
                <div className="space-y-2">
                  {editableSamples.map((s, idx) => (
                    <div
                      key={s.id}
                      className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center border rounded-md p-2"
                    >
                      <div className="text-sm font-medium">NUS: {s.nus}</div>

                      {/* Status Pencacahan */}
                      <select
                        value={s.cacahStatus}
                        onChange={(e) =>
                          setEditableSamples((prev) =>
                            prev.map((x, i) =>
                              i === idx
                                ? { ...x, cacahStatus: e.target.value }
                                : x
                            )
                          )
                        }
                        className="w-full px-3 py-2 border rounded-md bg-white text-sm"
                      >
                        <option value="Belum_Cacah">Belum Dicacah</option>
                        <option value="Selesai">Selesai</option>
                        {/* <option value="Drop_Out">Drop Out</option> */}
                      </select>

                      {/* Status Persetujuan (read-only untuk petugas) */}
                      <input
                        value={s.approvalStatus ?? "Menunggu"}
                        disabled
                        className="w-full px-3 py-2 border rounded-md bg-white text-sm"
                      />

                      {/* Geotag info */}
                      <div className="text-xs opacity-80">
                        {s.geoLat && s.geoLng
                          ? `${s.geoLat.toFixed?.(5) ?? s.geoLat}, ${s.geoLng.toFixed?.(5) ?? s.geoLng}`
                          : "Belum ada lokasi"}
                      </div>

                      <button
                        type="button"
                        onClick={() => ambilLokasiDanPatch(s.id)}
                        className="border rounded-md px-2 py-1 text-sm"
                        disabled={patching}
                      >
                        Ambil Lokasi
                      </button>

                      {/* <button
                        type="button"
                        onClick={() => patchOneSample(s)}
                        className="border rounded-md px-2 py-1 text-sm"
                        disabled={patching}
                      >
                        Simpan
                      </button> */}
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
        </form>
      </div>
    </div>
  );
}
