"use client";

import { GET_USER_PROGRESS_BY_USER_ID } from "@/src/graphql/actions/find-usersurveyprogressbyuser.action";
import { PATCH_USER_SAMPLES } from "@/src/graphql/actions/patch-usersamples.action";
import useUser from "@/src/hooks/useUser";
import { useLazyQuery, useMutation } from "@apollo/client";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

type ViewMode = "list" | "detail";

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
                  ${disabled ? "cursor-not-allowed opacity-50" : "hover:brightness-110"}
                  ${className}`}
    >
      {children}
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
  const { user, loading } = useUser();
  const router = useRouter();

  // roles yang diizinkan
  const ALLOWED = new Set(["Superadmin", "User"]);

  useEffect(() => {
    if (loading) return;
    const role = user?.role ?? "";
    if (!ALLOWED.has(role)) {
      toast.error("Akses ditolak. Mengarahkan ke Beranda");
      router.replace("/dashboard");
    }
  }, [loading, user?.role, router]);

  // helper districtId (fallback beberapa kemungkinan field)
  const getDistrictId = (up: any) =>
    up?.districtId ??
    up?.district?.id ??
    up?.subSurveyActivity?.districtId ??
    up?.subSurveyActivity?.district?.id ??
    "";

  // ===== State utama =====
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
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const [fetchUserProgress, { data: userProgressData, loading: upLoading }] =
    useLazyQuery(GET_USER_PROGRESS_BY_USER_ID, { fetchPolicy: "network-only" });

  useEffect(() => {
    if (user?.id) fetchUserProgress({ variables: { userId: user.id } });
  }, [user?.id, fetchUserProgress]);

  const [patchUserSamples] = useMutation(PATCH_USER_SAMPLES);

  const [editableSamples, setEditableSamples] = useState<any[]>([]);
  const [locatingId, setLocatingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [savingIdentityId, setSavingIdentityId] = useState<string | null>(null);

  // ===== Formatter tanggal =====
  function fmtDate(d: any) {
    if (!d) return "-";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function fmtDateRange(start: any, end: any) {
    if (!start && !end) return "-";
    if (start && !end) return `${fmtDate(start)} -`;
    if (!start && end) return `- ${fmtDate(end)}`;
    return `${fmtDate(start)} - ${fmtDate(end)}`;
  }

  // ===== Cards kegiatan (list tombol) =====
  // NOTE: karena beda blok bisa beda desa/kecamatan, di card kegiatan kita tampilkan "kota" saja.
  const activityCards = useMemo(() => {
    const rows: any[] = userProgressData?.userProgressSurveyByUserId ?? [];

    const map = new Map<
      string,
      {
        activity: any;
        rows: any[];
        totals: {
          totalAssigned: number;
          submitCount: number;
          approvedCount: number;
          rejectedCount: number;
        };
        blocks: string[];
        cityName?: string;
      }
    >();

    for (const up of rows) {
      const actId = up?.subSurveyActivity?.id;
      if (!actId) continue;

      const totalAssigned = Number(up?.totalAssigned ?? 0);
      const submitCount = Number(up?.submitCount ?? 0);
      const approvedCount = Number(up?.approvedCount ?? 0);
      const rejectedCount = Number(up?.rejectedCount ?? 0);

      const blk = String(up?.blockCount ?? "").trim();
      const cityName = up?.district?.city ?? undefined;

      const prev = map.get(actId);
      if (!prev) {
        map.set(actId, {
          activity: up?.subSurveyActivity,
          rows: [up],
          totals: { totalAssigned, submitCount, approvedCount, rejectedCount },
          blocks: blk ? [blk] : [],
          cityName,
        });
      } else {
        prev.rows.push(up);
        prev.totals.totalAssigned += totalAssigned;
        prev.totals.submitCount += submitCount;
        prev.totals.approvedCount += approvedCount;
        prev.totals.rejectedCount += rejectedCount;
        if (blk && !prev.blocks.includes(blk)) prev.blocks.push(blk);
        if (!prev.cityName && cityName) prev.cityName = cityName;
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const aStart = a.activity?.startDate
        ? new Date(a.activity.startDate).getTime()
        : 0;
      const bStart = b.activity?.startDate
        ? new Date(b.activity.startDate).getTime()
        : 0;
      return bStart - aStart;
    });
  }, [userProgressData]);

  // ===== Card kegiatan terpilih =====
  const selectedActivityCard = useMemo(() => {
    const id = updateUserProgressForm.subSurveyActivityId;
    if (!id) return undefined;
    return activityCards.find((c) => c.activity?.id === id);
  }, [activityCards, updateUserProgressForm.subSurveyActivityId]);

  // ===== Cards BLOK (setelah pilih kegiatan) =====
  const blockCards = useMemo(() => {
    const rows: any[] = userProgressData?.userProgressSurveyByUserId ?? [];
    const actId = updateUserProgressForm.subSurveyActivityId;
    if (!actId) return [];

    const filtered = rows.filter(
      (r: any) => r?.subSurveyActivity?.id === actId
    );

    // 1 row = 1 blok (biasanya). Kalau ada duplikat, kita ambil yang pertama.
    const map = new Map<string, any>();
    for (const r of filtered) {
      const blk = String(r?.blockCount ?? "").trim();
      if (!blk) continue;
      if (!map.has(blk)) map.set(blk, r);
    }

    return Array.from(map.entries())
      .map(([blk, row]) => ({
        block: blk,
        row,
      }))
      .sort((a, b) => a.block.localeCompare(b.block, "id"));
  }, [userProgressData, updateUserProgressForm.subSurveyActivityId]);

  // ===== Current UP (baris progress yang aktif sesuai kegiatan + blok) =====
  const currentUP = useMemo(() => {
    const rows: any[] = userProgressData?.userProgressSurveyByUserId ?? [];
    const actId = updateUserProgressForm.subSurveyActivityId;
    if (!actId) return undefined;

    const filtered = rows.filter(
      (up: any) => up?.subSurveyActivity?.id === actId
    );
    if (filtered.length === 0) return undefined;

    const blk = (selectedBlock ?? "").toString().trim();
    if (blk) {
      const byBlock = filtered.find(
        (up: any) => String(up?.blockCount ?? "").trim() === blk
      );
      return byBlock ?? filtered[0];
    }
    return filtered[0];
  }, [
    userProgressData,
    updateUserProgressForm.subSurveyActivityId,
    selectedBlock,
  ]);

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

  // ===== Navigasi view =====
  function openActivity(activityId: string) {
    const rows: any[] = userProgressData?.userProgressSurveyByUserId ?? [];
    const up = rows.find((r: any) => r?.subSurveyActivity?.id === activityId);

    setUpdateUserProgressForm((prev) => ({
      ...prev,
      subSurveyActivityId: activityId,
      districtId: getDistrictId(up),
    }));

    setSelectedBlock(""); // masuk ke list blok dulu
    setViewMode("detail");
  }

  function backToList() {
    setViewMode("list");
    setSelectedBlock("");
    setUpdateUserProgressForm((prev) => ({ ...prev, subSurveyActivityId: "" }));
  }

  function backToBlockCards() {
    setSelectedBlock("");
  }

  // ===== Guard UI =====
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

  async function ambilLokasiDanPatch(sampleId: string) {
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

  async function saveIdentity(sampleId: string) {
    const userProgressId =
      currentUP?.id || updateUserProgressForm.userProgressId;
    if (!userProgressId) return toast.error("Pilih kegiatan & blok dulu ya.");

    const sample = editableSamples.find((s) => s.id === sampleId);
    if (!sample) return toast.error("Sample tidak ditemukan.");

    const nextIdentity = String(sample.identity ?? "").trim();
    if (!nextIdentity) return toast.error("Nama responden tidak boleh kosong.");

    setSavingIdentityId(sampleId);
    const toastId = toast.loading("Menyimpan nama responden...");

    try {
      await patchUserSamples({
        variables: {
          input: {
            userProgressId,
            updateSamples: [
              {
                id: sampleId,
                identity: nextIdentity,
              },
            ],
          },
        },
      });

      toast.success("Nama responden tersimpan", { id: toastId });
      await fetchUserProgress({ variables: { userId: user!.id } });
    } catch (e: any) {
      toast.error("Gagal menyimpan nama responden", { id: toastId });
      showApolloError(e);
      await fetchUserProgress({ variables: { userId: user!.id } });
    } finally {
      setSavingIdentityId(null);
    }
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
              approvalStatus: "Menunggu",
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

          {viewMode === "list" ? (
            <div className="space-y-2">
              <p className="text-sm opacity-80">
                Pilih kegiatan survei untuk melihat assignment per blok.
              </p>

              {upLoading ? (
                <div className="text-sm opacity-70">Memuat kegiatan…</div>
              ) : activityCards.length === 0 ? (
                <div className="text-sm opacity-70">
                  Belum ada kegiatan survei yang ditugaskan.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activityCards.map((c) => {
                    const act = c.activity;
                    const rawType = (act?.activityType ?? "").toString();
                    const isListingCard = rawType.toLowerCase() === "listing";
                    const range = fmtDateRange(act?.startDate, act?.endDate);

                    return (
                      <button
                        key={act?.id}
                        type="button"
                        onClick={() => act?.id && openActivity(act.id)}
                        className="text-left bg-white border rounded-lg p-3 shadow-sm hover:shadow transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold leading-snug">
                            {act?.name ?? "-"}
                          </div>
                          <span
                            className={`shrink-0 px-2 py-0.5 rounded text-xs ${
                              isListingCard
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {isListingCard ? "Listing" : "Non-Listing"}
                          </span>
                        </div>

                        <div className="grid grid-cols-[35%,auto] gap-2 my-2 text-xs">
                          Jadwal<span className="font-medium">: {range}</span>
                          Kabupaten/Kota
                          <span className="font-medium">
                            : {c.cityName ?? "-"}
                          </span>
                        </div>

                        <div className="mt-2 w-full gap-2 text-sm">
                          <div className="rounded-md bg-blue-50 p-2">
                            <div>Assigned</div>
                            <div className="font-semibold">
                              {c.totals.totalAssigned}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                          <div className="rounded-md bg-green-50 p-2">
                            <div>Submit</div>
                            <div className="font-semibold">
                              {c.totals.submitCount}
                            </div>
                          </div>
                          <div className="rounded-md bg-emerald-50 p-2">
                            <div>Approved</div>
                            <div className="font-semibold">
                              {c.totals.approvedCount}
                            </div>
                          </div>
                          {/* <div className="rounded-md bg-red-50 p-2">
                            <div>Rejected</div>
                            <div className="font-semibold">
                              {c.totals.rejectedCount}
                            </div>
                          </div> */}
                        </div>

                        <div className="mt-2 text-sm">
                          Jumlah Blok Assignment:{" "}
                          <span className="font-medium">
                            {c.blocks.length || "-"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={backToList}
                  className="px-3 py-1.5 rounded-md bg-white border hover:bg-gray-50 text-sm"
                >
                  ← Kembali
                </button>

                {selectedBlock ? (
                  <button
                    type="button"
                    onClick={backToBlockCards}
                    className="px-3 py-1.5 rounded-md bg-white border hover:bg-gray-50 text-sm"
                  >
                    Pilih Blok
                  </button>
                ) : null}
              </div>

              {/* ===== List BLOK cards (tanpa combobox) ===== */}
              {!selectedBlock ? (
                <div className="space-y-2">
                  <div className="text-sm opacity-80">
                    Pilih blok untuk melihat daftar sampel.
                  </div>

                  {blockCards.length === 0 ? (
                    <div className="text-sm opacity-70">
                      Tidak ada blok untuk kegiatan ini.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {blockCards.map(({ block, row }) => (
                        <button
                          key={block}
                          type="button"
                          onClick={() => setSelectedBlock(block)}
                          className="text-left bg-white border rounded-lg p-3 shadow-sm hover:shadow transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-semibold">Blok {block}</div>
                          </div>

                          <div className="grid grid-cols-[35%,auto] gap-2 my-2 text-xs">
                            Kab/Kota
                            <span className="font-medium">
                              : {row?.district?.city ?? "-"}
                            </span>
                            Kecamatan
                            <span className="font-medium">
                              : {row?.district?.name ?? "-"}
                            </span>
                            Desa
                            <span className="font-medium">
                              : {row?.villageName ?? "-"}
                            </span>
                          </div>

                          <div className="mt-2 w-full text-sm">
                            <div className="rounded-md bg-blue-50 p-2">
                              <div>Assigned</div>
                              <div className="font-semibold">
                                {row?.totalAssigned ?? 0}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-md bg-green-50 p-2">
                              <div>Submit</div>
                              <div className="font-semibold">
                                {row?.submitCount ?? 0}
                              </div>
                            </div>
                            <div className="rounded-md bg-emerald-50 p-2">
                              <div>Approved</div>
                              <div className="font-semibold">
                                {row?.approvedCount ?? 0}
                              </div>
                            </div>
                            {/* <div className="rounded-md bg-red-50 p-2">
                              <div>Rejected</div>
                              <div className="font-semibold">{row?.rejectedCount ?? 0}</div>
                            </div> */}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* ===== Sampel (muncul setelah blok dipilih) ===== */}
          {viewMode === "detail" && selectedBlock ? (
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
                  {editableSamples.map((s) => (
                    <div
                      key={s.id}
                      className="sm:flex sm:justify-between grid grid-cols-1 gap-2 items-center border rounded-md p-2"
                    >
                      <div className="text-sm font-semibold w-full">
                        NUS: {s.nus}
                      </div>

                      <div className="flex flex-row gap-2 w-full">
                        <input
                          value={s.identity ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setEditableSamples((prev) =>
                              prev.map((x) =>
                                x.id === s.id ? { ...x, identity: v } : x
                              )
                            );
                          }}
                          disabled={s.approvalStatus === "Disetujui"}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveIdentity(s.id);
                            }
                          }}
                          placeholder="Nama Responden"
                          className="px-3 py-2 border rounded-md bg-white text-sm font-semibold focus:outline-none w-full"
                        />

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => saveIdentity(s.id)}
                            disabled={
                              savingIdentityId === s.id ||
                              locatingId === s.id ||
                              resettingId === s.id
                            }
                            className="px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold disabled:opacity-70"
                            title="Simpan nama responden"
                          >
                            {savingIdentityId === s.id
                              ? "Menyimpan..."
                              : "Simpan"}
                          </button>
                        </div>
                      </div>

                      <input
                        value={
                          s.cacahStatus === "Selesai"
                            ? "Selesai Dicacah"
                            : "Belum Dicacah"
                        }
                        readOnly
                        className={`w-full px-3 py-2 border rounded-md ${
                          s.cacahStatus === "Selesai"
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-700"
                        } text-sm font-semibold focus:outline-none cursor-default`}
                      />

                      <input
                        value={s.approvalStatus ?? "Menunggu"}
                        disabled
                        className={`w-full px-3 py-2 border rounded-md ${
                          s.approvalStatus === "Disetujui"
                            ? "bg-green-50 text-green-700"
                            : s.approvalStatus === "Ditolak"
                              ? "bg-red-50 text-red-700"
                              : "bg-yellow-50 text-yellow-700"
                        } text-sm font-semibold focus:outline-none`}
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
                            resettingId === s.id ||
                            s.approvalStatus === "Disetujui"
                          }
                          className="bg-blue-600 border-blue-600 hover:bg-blue-500"
                        >
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
                              resettingId === s.id ||
                              locatingId === s.id ||
                              s.approvalStatus === "Disetujui"
                            }
                            className="bg-red-600 border-red-600 hover:bg-red-500"
                          >
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
          ) : null}
        </form>
      </div>
    </div>
  );
}
