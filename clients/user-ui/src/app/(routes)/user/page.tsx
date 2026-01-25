"use client";

import { GET_USER_PROGRESS_BY_USER_ID } from "@/src/graphql/actions/find-usersurveyprogressbyuser.action";
import { PATCH_USER_SAMPLES } from "@/src/graphql/actions/patch-usersamples.action";
import { UPLOAD_SURVEY_SAMPLE_PHOTO } from "@/src/graphql/actions/upload-survey-sample-photo.action";
import useUser from "@/src/hooks/useUser";
import { useLazyQuery, useMutation } from "@apollo/client";
import { Dialog, Transition } from "@headlessui/react";
import { useRouter } from "next/navigation";
import React, { Fragment, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import exifr from "exifr";
import dynamic from "next/dynamic";
import { getRoles } from "@/src/utils/roles";
import { EXPORT_USER_SAMPLE_PHOTOS } from "@/src/graphql/actions/export-user-sample-photos.action";

type ViewMode = "list" | "detail";

export default function UserPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  const ALLOWED = new Set(["Superadmin", "User"]);

  const roles = useMemo(() => getRoles(user), [user]);
  const allowed = useMemo(() => roles.some((r) => ALLOWED.has(r)), [roles]);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!allowed) {
      toast.error("Akses ditolak. Mengarahkan ke Beranda");
      router.replace("/dashboard");
    }
  }, [loading, user, allowed, router]);

  const getDistrictId = (up: any) =>
    up?.districtId ??
    up?.district?.id ??
    up?.subSurveyActivity?.districtId ??
    up?.subSurveyActivity?.district?.id ??
    "";

  const getVillageId = (up: any) =>
    up?.villageId ??
    up?.village?.id ??
    up?.subSurveyActivity?.villageId ??
    up?.subSurveyActivity?.village?.id ??
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
    villageId: "",
  });
  const [selectedBlock, setSelectedBlock] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [fetchUserProgress, { data: userProgressData, loading: upLoading }] =
    useLazyQuery(GET_USER_PROGRESS_BY_USER_ID, { fetchPolicy: "network-only" });
  useEffect(() => {
    if (user?.id) fetchUserProgress({ variables: { userId: user.id } });
  }, [user?.id, fetchUserProgress]);
  const [patchUserSamples] = useMutation(PATCH_USER_SAMPLES);
  const [uploadSurveySamplePhoto] = useMutation(UPLOAD_SURVEY_SAMPLE_PHOTO);
  const [exportUserSamplePhotos, { loading: exportingPhotos }] = useMutation(
    EXPORT_USER_SAMPLE_PHOTOS,
  );
  const [editableSamples, setEditableSamples] = useState<any[]>([]);
  const [locatingId, setLocatingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [showCacahModal, setShowCacahModal] = useState(false);
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const [draftIdentity, setDraftIdentity] = useState<string>("");
  const [draftLat, setDraftLat] = useState<number | null>(null);
  const [draftLng, setDraftLng] = useState<number | null>(null);
  const [draftPhotoFile, setDraftPhotoFile] = useState<File | null>(null);
  const [draftPhotoPreview, setDraftPhotoPreview] = useState<string | null>(
    null,
  );
  const [savingModal, setSavingModal] = useState(false);
  const [qIdentity, setQIdentity] = useState("");
  const [isLocationConfirmed, setIsLocationConfirmed] = useState(false);
  const [coordText, setCoordText] = useState("");

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

  function isTodayInRange(startDate?: string | null, endDate?: string | null) {
    if (!startDate || !endDate) return false;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const start = new Date(startDate);
    const end = new Date(endDate);

    const startDay = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
    );
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    return (
      startDay.getTime() <= today.getTime() &&
      today.getTime() <= endDay.getTime()
    );
  }

  // ===== Cards kegiatan (list tombol) =====
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

    return Array.from(map.values())
      .filter((c) => isTodayInRange(c.activity?.startDate, c.activity?.endDate))
      .sort((a, b) => {
        const aStart = a.activity?.startDate
          ? new Date(a.activity.startDate).getTime()
          : 0;
        const bStart = b.activity?.startDate
          ? new Date(b.activity.startDate).getTime()
          : 0;
        return bStart - aStart;
      });
  }, [userProgressData]);

  const LocationPickerMap = dynamic(
    () => import("@/src/components/LocationPickerMap"),
    { ssr: false },
  );

  const filteredSamples = useMemo(() => {
    const name = qIdentity.trim().toLowerCase();

    return (editableSamples ?? []).filter((s: any) => {
      const sIdentity = String(s.identity ?? "").toLowerCase();
      const okIdentity = !name || sIdentity.includes(name);
      return okIdentity;
    });
  }, [editableSamples, qIdentity]);

  // ===== Cards BLOK (setelah pilih kegiatan) =====
  const blockCards = useMemo(() => {
    const rows: any[] = userProgressData?.userProgressSurveyByUserId ?? [];
    const actId = updateUserProgressForm.subSurveyActivityId;
    if (!actId) return [];

    const filtered = rows.filter(
      (r: any) => r?.subSurveyActivity?.id === actId,
    );

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
      (up: any) => up?.subSurveyActivity?.id === actId,
    );
    if (filtered.length === 0) return undefined;

    const blk = (selectedBlock ?? "").toString().trim();
    if (blk) {
      const byBlock = filtered.find(
        (up: any) => String(up?.blockCount ?? "").trim() === blk,
      );
      return byBlock ?? filtered[0];
    }
    return filtered[0];
  }, [
    userProgressData,
    updateUserProgressForm.subSurveyActivityId,
    selectedBlock,
  ]);

  const isListingActivity =
    String(currentUP?.subSurveyActivity?.activityType ?? "").toLowerCase() ===
    "listing";

  useEffect(() => {
    if (!currentUP?.samples) return setEditableSamples([]);
    const sorted = [...currentUP.samples].sort(
      (a: any, b: any) => Number(a.nus) - Number(b.nus),
    );
    setEditableSamples(sorted.map((s: any) => ({ ...s })));
  }, [
    userProgressData,
    updateUserProgressForm.subSurveyActivityId,
    selectedBlock,
  ]);

  useEffect(() => {
    function applyFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const mode = (params.get("mode") as "list" | "detail") || "list";
      const activityId = params.get("activityId") || "";
      const block = params.get("block") || "";

      setViewMode(mode);

      if (activityId) {
        const rows: any[] = userProgressData?.userProgressSurveyByUserId ?? [];
        const up = rows.find(
          (r: any) => r?.subSurveyActivity?.id === activityId,
        );

        setUpdateUserProgressForm((p) => ({
          ...p,
          subSurveyActivityId: activityId,
          districtId: getDistrictId(up),
          villageId: getVillageId(up),
        }));
      } else {
        setUpdateUserProgressForm((p) => ({ ...p, subSurveyActivityId: "" }));
      }

      setSelectedBlock(block);
    }

    applyFromUrl();

    window.addEventListener("popstate", applyFromUrl);
    return () => window.removeEventListener("popstate", applyFromUrl);
  }, [userProgressData]);

  useEffect(() => {
    function handlePopState(e: PopStateEvent) {
      if (showCacahModal) {
        setShowCacahModal(false);
        setActiveSampleId(null);
        resetModalDraft();
      }
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showCacahModal]);

  // ===== Navigasi view =====
  function openActivity(activityId: string) {
    const rows: any[] = userProgressData?.userProgressSurveyByUserId ?? [];
    const up = rows.find((r: any) => r?.subSurveyActivity?.id === activityId);

    setUpdateUserProgressForm((prev) => ({
      ...prev,
      subSurveyActivityId: activityId,
      districtId: getDistrictId(up),
      villageId: getVillageId(up),
    }));

    setSelectedBlock("");
    setViewMode("detail");
    setRouteState({ mode: "detail", activityId, block: "" });
  }

  function backToList() {
    if (selectedBlock) {
      setSelectedBlock("");
      setRouteState({ block: "" });
      return;
    } else {
      setViewMode("list");
      setUpdateUserProgressForm((prev) => ({
        ...prev,
        subSurveyActivityId: "",
      }));
      setRouteState({ mode: "list", activityId: "", block: "" });
      return;
    }
  }

  // ===== Guard UI =====
  if (loading) {
    return (
      <div className="max-w-screen-xl mx-auto px-3 py-6 font-Poppins">
        Memuat…
      </div>
    );
  }

  if (!user) return null;

  if (!allowed) {
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

  function parseLatLngText(input: string): { lat: number; lng: number } | null {
    if (!input) return null;

    const cleaned = input.trim().replace(/\s+/g, " ");
    const parts = cleaned.includes(",")
      ? cleaned.split(",")
      : cleaned.split(" ");

    if (parts.length !== 2) return null;

    const lat = Number(parts[0].trim());
    const lng = Number(parts[1].trim());

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    if (lat < -11 || lat > 6) return null;
    if (lng < 95 || lng > 141) return null;

    return { lat, lng };
  }

  function fmtCoord(v: any, digits = 10) {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(digits) : String(v ?? "");
  }

  function getSampleById(sampleId: string) {
    return editableSamples.find((s) => s.id === sampleId);
  }

  function resetModalDraft() {
    setDraftIdentity("");
    setDraftLat(null);
    setDraftLng(null);
    setCoordText("");
    setDraftPhotoFile(null);
    if (draftPhotoPreview) URL.revokeObjectURL(draftPhotoPreview);
    setDraftPhotoPreview(null);
    setIsLocationConfirmed(false);
  }

  async function getCurrentLocation() {
    if (!navigator.geolocation)
      throw new Error("Browser tidak mendukung lokasi.");
    return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(new Error(err.message)),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    });
  }

  async function openStartModal(sampleId: string) {
    const s = getSampleById(sampleId);
    if (!s) return toast.error("Sample tidak ditemukan.");

    resetModalDraft();
    setActiveSampleId(sampleId);
    setDraftIdentity(String(s.identity ?? "").trim());

    setLocatingId(sampleId);
    const toastId = toast.loading("Mengambil lokasi...");
    try {
      const { lat, lng } = await getCurrentLocation();
      setDraftLat(lat);
      setDraftLng(lng);
      toast.success("Lokasi didapat", { id: toastId });
    } catch (e: any) {
      toast.error("Gagal ambil lokasi: " + (e?.message || "Unknown"), {
        id: toastId,
      });
    } finally {
      setLocatingId(null);
      window.history.pushState({ cacahModal: true }, "");
      setShowCacahModal(true);
    }
  }

  async function openAddSampleModal() {
    resetModalDraft();
    setActiveSampleId(null);
    setShowCacahModal(false);

    setLocatingId("__add__");
    const toastId = toast.loading("Mengambil lokasi...");

    try {
      const { lat, lng } = await getCurrentLocation();
      setDraftLat(lat);
      setDraftLng(lng);
      toast.success("Lokasi didapat", { id: toastId });
    } catch (e: any) {
      toast.error("Gagal ambil lokasi: " + (e?.message || "Unknown"), {
        id: toastId,
      });
    } finally {
      setLocatingId(null);
      window.history.pushState({ cacahModal: true }, "");
      setShowCacahModal(true);
    }
  }

  async function compressImage(file: File, maxW = 1280, quality = 0.75) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);

    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("Gagal load gambar"));
    });

    const ratio = img.width > maxW ? maxW / img.width : 1;
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas tidak tersedia");

    ctx.drawImage(img, 0, 0, w, h);

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Gagal kompres"))),
        "image/jpeg",
        quality,
      );
    });

    URL.revokeObjectURL(img.src);

    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
      type: "image/jpeg",
    });
  }

  function extractLatLngFromTextOrUrl(
    input: string,
  ): { lat: number; lng: number } | null {
    if (!input) return null;
    const s = input.trim();

    const coord = (() => {
      const cleaned = s.replace(/\s+/g, " ");
      const parts = cleaned.includes(",")
        ? cleaned.split(",")
        : cleaned.split(" ");
      if (parts.length !== 2) return null;
      const lat = Number(parts[0].trim());
      const lng = Number(parts[1].trim());
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    })();
    if (coord) return coord;

    const atMatch = s.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (atMatch) return { lat: Number(atMatch[1]), lng: Number(atMatch[2]) };

    const qMatch = s.match(/[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (qMatch) return { lat: Number(qMatch[1]), lng: Number(qMatch[2]) };

    return null;
  }

  function isMapsShortLink(input: string) {
    const s = input.trim();
    return (
      /^https?:\/\/maps\.app\.goo\.gl\/.+/i.test(s) ||
      /^https?:\/\/goo\.gl\/maps\/.+/i.test(s)
    );
  }

  function isSameLocalDay(a: Date, b: Date) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  async function ensurePhotoIsToday(file: File) {
    let exifDate: any = null;

    try {
      const exif = await exifr.parse(file, {
        tiff: true,
        exif: true,
        gps: false,
      });
      exifDate =
        exif?.DateTimeOriginal || exif?.CreateDate || exif?.ModifyDate || null;
    } catch {
      exifDate = null;
    }

    if (!exifDate) {
      throw new Error(
        "Tanggal foto tidak bisa diverifikasi. Ambil foto baru dari kamera ya.",
      );
    }

    const photoDate = new Date(exifDate);
    const today = new Date();

    if (!isSameLocalDay(photoDate, today)) {
      throw new Error(
        "Foto bukan dari hari ini. Tolong ambil foto baru hari ini ya.",
      );
    }
  }

  function openViewModal(sampleId: string) {
    const s = getSampleById(sampleId);
    if (!s) return toast.error("Sample tidak ditemukan.");
    resetModalDraft();
    setActiveSampleId(sampleId);
    setDraftIdentity(String(s.identity ?? "").trim());
    setDraftLat(s.geoLat ?? null);
    setDraftLng(s.geoLng ?? null);
    window.history.pushState({ cacahModal: true }, "");
    setShowCacahModal(true);
  }

  function closeCacahModal() {
    setShowCacahModal(false);
    setActiveSampleId(null);
    resetModalDraft();

    if (window.history.state?.cacahModal) {
      window.history.back();
    }
  }

  async function onPickPhoto(file: File | null) {
    if (!file) {
      setDraftPhotoFile(null);
      if (draftPhotoPreview) URL.revokeObjectURL(draftPhotoPreview);
      setDraftPhotoPreview(null);
      return;
    }

    try {
      await ensurePhotoIsToday(file);
    } catch (e: any) {
      toast.error(e?.message || "Foto tidak valid.");
      return;
    }

    setDraftPhotoFile(file);
    if (draftPhotoPreview) URL.revokeObjectURL(draftPhotoPreview);
    setDraftPhotoPreview(URL.createObjectURL(file));
  }

  async function saveCacahModal() {
    const userProgressId =
      currentUP?.id || updateUserProgressForm.userProgressId;
    if (!userProgressId) return toast.error("Pilih kegiatan & blok dulu ya.");

    const isAddMode = !activeSampleId;

    const nextIdentity = String(draftIdentity ?? "").trim();
    if (!nextIdentity) return toast.error("Nama responden wajib diisi.");
    // if (draftLat == null || draftLng == null) {
    //   return toast.error("Lokasi belum ada. Coba ambil lokasi dulu ya.");
    // }
    if (!isLocationConfirmed)
      return toast.error("Centang konfirmasi lokasi dulu ya.");

    setSavingModal(true);

    try {
      let photoPath: string | null | undefined = undefined;

      if (draftPhotoFile) {
        const compressed = await compressImage(draftPhotoFile, 1280, 0.75);

        if (!isAddMode) {
          const up = await uploadSurveySamplePhoto({
            variables: { sampleId: activeSampleId, file: compressed },
          });
          photoPath = up?.data?.uploadSurveySamplePhoto || null;
        }
      }

      if (isAddMode) {
        const nus = nextNus(editableSamples);

        const createRes = await patchUserSamples({
          variables: {
            input: {
              userProgressId,
              createSamples: [
                {
                  nus,
                  identity: nextIdentity,
                  cacahStatus: "Selesai",
                  approvalStatus: "Menunggu",
                  geoLat: draftLat,
                  geoLng: draftLng,
                  geoCapturedAt: new Date().toISOString(),
                },
              ],
            },
          },
        });

        const createdSamples = createRes?.data?.patchUserSamples?.samples ?? [];
        const createdSample = createdSamples.find(
          (s: any) => Number(s.nus) === Number(nus),
        );

        const createdSampleId = createdSample?.id;
        if (!createdSampleId) {
          throw new Error("Sample berhasil dibuat, tapi ID tidak ditemukan.");
        }

        if (!createdSample?.id) {
          await fetchUserProgress({ variables: { userId: user!.id } });
          const refreshedRows: any[] =
            userProgressData?.userProgressSurveyByUserId ?? [];
          const refreshedUP = refreshedRows.find(
            (x: any) => x?.id === userProgressId,
          );
          const refreshedSample = refreshedUP?.samples?.find(
            (s: any) => Number(s.nus) === Number(nus),
          );
          if (!refreshedSample?.id)
            throw new Error("Sample berhasil dibuat, tapi ID tidak ditemukan.");
        }

        if (draftPhotoFile) {
          const compressed = await compressImage(draftPhotoFile, 1280, 0.75);

          const up = await uploadSurveySamplePhoto({
            variables: { sampleId: createdSampleId, file: compressed },
          });

          const photoPath = up?.data?.uploadSurveySamplePhoto || null;

          await patchUserSamples({
            variables: {
              input: {
                userProgressId,
                updateSamples: [
                  {
                    id: createdSampleId,
                    photoPath,
                    photoCapturedAt: new Date().toISOString(),
                  },
                ],
              },
            },
          });
        }

        toast.success("Sampel berhasil ditambahkan");
      } else {
        if (!activeSampleId) throw new Error("Sample ID tidak ada.");

        await patchUserSamples({
          variables: {
            input: {
              userProgressId,
              updateSamples: [
                {
                  id: activeSampleId,
                  identity: nextIdentity,
                  cacahStatus: "Selesai",
                  approvalStatus: "Menunggu",
                  geoLat: draftLat,
                  geoLng: draftLng,
                  geoCapturedAt: new Date().toISOString(),
                  ...(photoPath !== undefined
                    ? { photoPath, photoCapturedAt: new Date().toISOString() }
                    : {}),
                },
              ],
            },
          },
        });

        toast.success("Sampel berhasil disimpan");
      }

      closeCacahModal();
      await fetchUserProgress({ variables: { userId: user!.id } });
    } catch (e: any) {
      toast.error("Gagal menyimpan");
      showApolloError(e);
      await fetchUserProgress({ variables: { userId: user!.id } });
    } finally {
      setSavingModal(false);
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
              geoLat: null,
              geoLng: null,
              geoCapturedAt: null,
              photoPath: null,
              photoCapturedAt: null,
              photoSignedUrl: null,
            }
          : s,
      ),
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
                photoPath: null,
                photoCapturedAt: null,
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

  async function handleExportPhotos() {
    const userProgressId =
      currentUP?.id || updateUserProgressForm.userProgressId;

    if (!userProgressId) {
      toast.error("Progress belum dipilih.");
      return;
    }

    try {
      const res = await exportUserSamplePhotos({
        variables: { userProgressId },
      });

      const result = res.data?.exportUserSamplePhotos;
      const url = result?.zipUrl;
      const total = result?.totalPhotos ?? 0;

      if (!url || total === 0) {
        toast.error("Tidak ada foto sampel yang bisa diekspor.");
        return;
      }

      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      showApolloError(e);
    }
  }

  function setRouteState(next: {
    mode?: "list" | "detail";
    activityId?: string;
    block?: string;
  }) {
    const params = new URLSearchParams(window.location.search);

    if (next.mode !== undefined) params.set("mode", next.mode);
    if (next.activityId !== undefined) {
      if (next.activityId) params.set("activityId", next.activityId);
      else params.delete("activityId");
    }
    if (next.block !== undefined) {
      if (next.block) params.set("block", next.block);
      else params.delete("block");
    }

    router.push(`?${params.toString()}`);
  }

  function nextNus(samples: any[]) {
    const nums = (samples ?? [])
      .map((s) => Number(s.nus))
      .filter((n) => Number.isFinite(n));
    const max = nums.length ? Math.max(...nums) : 0;
    return String(max + 1).padStart(3, "0");
  }

  const isLocating =
    locatingId !== null &&
    (locatingId === activeSampleId || locatingId === "__add__");
  const activeSample = activeSampleId ? getSampleById(activeSampleId) : null;

  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-6 md:px-8 py-4 space-y-4 font-Poppins">
      <div className="bg-orange-50 rounded-lg p-3 md:p-4 font-bold text-lg md:text-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-md">
        <span>Panel Petugas</span>
      </div>

      <div className="bg-blue-100 rounded-lg p-4 shadow-md">
        <form onSubmit={(e) => e.preventDefault()} className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base md:text-lg font-bold">
              Update Data Petugas
            </h3>
            {viewMode !== "list" && (
              <button
                type="button"
                onClick={backToList}
                className="px-3 py-1.5 rounded-md bg-white border hover:bg-gray-50 text-sm"
              >
                ← Kembali
              </button>
            )}
          </div>

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

                        <div className="grid grid-cols-[auto,auto] gap-2 my-2 text-xs">
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
                          onClick={() => {
                            setSelectedBlock(block);
                            setRouteState({ block });
                          }}
                          className="text-left bg-white border rounded-lg p-3 shadow-sm hover:shadow transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-semibold">Blok {block}</div>
                          </div>

                          <div className="grid grid-cols-[auto,auto] gap-2 my-2 text-xs">
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
                              : {row?.village?.name ?? "-"}
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
                {isListingActivity && (
                  <button
                    type="button"
                    onClick={openAddSampleModal}
                    className="px-3 py-2 rounded-md bg-green-600 text-white text-sm font-semibold"
                  >
                    + Tambah Sampel
                  </button>
                )}
              </div>

              <div className="bg-white border rounded-md p-3">
                <div className="w-full">
                  <input
                    value={qIdentity}
                    onChange={(e) => setQIdentity(e.target.value)}
                    placeholder="Cari nama"
                    className="w-full rounded-md border px-3 py-2 text-sm bg-white"
                  />
                </div>
              </div>

              {editableSamples.length === 0 ? (
                <div className="text-sm opacity-70">Belum ada sampel.</div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm font-medium">Daftar Sampel</div>
                    <button
                      type="button"
                      onClick={handleExportPhotos}
                      disabled={exportingPhotos}
                      className="px-3 py-1.5 rounded-md border text-xs bg-white hover:bg-gray-50 disabled:opacity-60"
                    >
                      {exportingPhotos ? "Sedang Ekspor..." : "Ekspor Foto"}
                    </button>
                  </div>
                  <div className="bg-white rounded-md border overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-gray-700">
                        <tr>
                          <th className="text-left px-3 py-2">NUS</th>
                          <th className="text-left px-3 py-2">Responden</th>
                          <th className="text-left px-3 py-2">Status Cacah</th>
                          <th className="text-left px-3 py-2">
                            Status Persetujuan
                          </th>
                          <th className="text-right px-3 py-2">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSamples.map((s) => {
                          const isDone = s.cacahStatus === "Selesai";
                          const isApproved = s.approvalStatus === "Disetujui";
                          return (
                            <tr key={s.id} className="border-t">
                              <td className="px-3 py-2 font-semibold">
                                {s.nus}
                              </td>
                              <td className="px-3 py-2">{s.identity}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                                    isDone
                                      ? "bg-green-50 text-green-700"
                                      : "bg-red-50 text-red-700"
                                  }`}
                                >
                                  {isDone ? "Selesai Dicacah" : "Belum Dicacah"}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                                    s.approvalStatus === "Disetujui"
                                      ? "bg-green-50 text-green-700"
                                      : s.approvalStatus === "Ditolak"
                                        ? "bg-red-50 text-red-700"
                                        : "bg-yellow-50 text-yellow-700"
                                  }`}
                                >
                                  {s.approvalStatus ?? "Menunggu"}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex gap-2 justify-end">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      isDone
                                        ? openViewModal(s.id)
                                        : openStartModal(s.id)
                                    }
                                    disabled={
                                      locatingId === s.id ||
                                      resettingId === s.id ||
                                      (isDone ? false : isApproved)
                                    }
                                    className={`px-3 py-1.5 rounded-md ${isDone ? " bg-gray-200 text-black" : " bg-blue-600 text-white"} text-xs font-semibold disabled:opacity-70`}
                                  >
                                    {locatingId === s.id
                                      ? "Mengambil Lokasi..."
                                      : isDone
                                        ? "Lihat Keterangan"
                                        : "Mulai Pencacahan"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => resetCacah(s.id)}
                                    disabled={
                                      resettingId === s.id ||
                                      locatingId === s.id ||
                                      !isDone ||
                                      isApproved
                                    }
                                    className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-semibold disabled:opacity-70"
                                  >
                                    {resettingId === s.id
                                      ? "Mereset..."
                                      : "Reset"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </form>
      </div>

      {/* ===== Modal Mulai/Lihat Pencacahan ===== */}
      <Transition.Root show={showCacahModal} as={Fragment}>
        <Dialog as="div" className="relative z-30" onClose={closeCacahModal}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500/75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-30 pt-[56px] sm:pt-0">
            <div className="h-full w-full flex sm:items-center sm:justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="w-full bg-white shadow-xl overflow-hidden flex flex-col h-[calc(100dvh-56px)] sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:max-w-lg overflow-y-auto">
                  <div className="bg-white px-4 pb-5 pt-5 sm:pt-2 sm:px-6 sm:pb-0 rounded-lg">
                    <div className="shrink-0 px-4 py-3 border-b flex items-center justify-between">
                      <Dialog.Title className="text-base font-semibold text-gray-900">
                        {activeSample?.cacahStatus === "Selesai"
                          ? `Hasil Pencacahan (NUS: ${activeSample?.nus ?? "-"})`
                          : `Mulai Pencacahan (NUS: ${activeSample?.nus ?? "-"})`}
                      </Dialog.Title>

                      {/* <button
                        type="button"
                        onClick={closeCacahModal}
                        className="px-3 py-1.5 rounded bg-gray-700 text-white text-sm"
                      >
                        Tutup
                      </button> */}
                    </div>

                    <div
                      className="flex-1 overflow-y-auto overscroll-contain px-4 py-2 sm:px-0"
                      style={{ WebkitOverflowScrolling: "touch" }}
                    >
                      <div className="mt-3 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Nama Responden
                          </label>
                          <input
                            type="text"
                            value={draftIdentity}
                            onChange={(e) => setDraftIdentity(e.target.value)}
                            disabled={
                              activeSample?.approvalStatus === "Disetujui"
                            }
                            className="mt-1 block w-full rounded-md border-0 py-1.5 text-gray-900 bg-white shadow-sm ring-1 ring-inset ring-gray-300 focus:outline-none sm:text-sm p-2 disabled:opacity-70"
                            placeholder="Nama responden"
                          />
                        </div>

                        <div className="rounded-md border p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold">Lokasi</div>
                            <div className="flex gap-2">
                              {activeSample?.approvalStatus !== "Disetujui" && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setLocatingId(activeSampleId ?? "__add__");
                                    const tId = toast.loading(
                                      "Mengambil lokasi...",
                                    );
                                    try {
                                      const { lat, lng } =
                                        await getCurrentLocation();
                                      setDraftLat(lat);
                                      setDraftLng(lng);
                                      toast.success("Lokasi diperbarui", {
                                        id: tId,
                                      });
                                    } catch (e: any) {
                                      toast.error(
                                        "Gagal ambil lokasi: " +
                                          (e?.message || "Unknown"),
                                        { id: tId },
                                      );
                                    } finally {
                                      setLocatingId(null);
                                    }
                                  }}
                                  className="px-2 py-1 rounded-md bg-gray-100 text-gray-800 text-xs font-semibold"
                                >
                                  {isLocating ? "Mengambil..." : "Ambil Lokasi"}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  if (draftLat == null || draftLng == null) {
                                    toast.error("Koordinat belum ada");
                                    return;
                                  }
                                  openMap(Number(draftLat), Number(draftLng));
                                }}
                                className="px-2 py-1 rounded-md bg-purple-600 text-white text-xs font-semibold"
                              >
                                Lihat Lokasi
                              </button>
                            </div>
                          </div>

                          <div>
                            <div className="text-sm">
                              <div className="text-xs text-gray-500">
                                Koordinat
                              </div>
                              <div className="font-medium">
                                {draftLat ?? "-"}, {draftLng ?? "-"}
                              </div>
                            </div>
                          </div>
                          {activeSample?.approvalStatus !== "Disetujui" && (
                            <div className="mt-2">
                              <label className="text-xs text-gray-500">
                                Tempel koordinat (lat, lng)
                              </label>

                              <div className="flex gap-2 mt-1">
                                <input
                                  type="text"
                                  value={coordText}
                                  onChange={(e) => setCoordText(e.target.value)}
                                  placeholder="Contoh: -3.652537583654158, 103.75869158307493"
                                  className="flex-1 rounded-md border px-2 py-1 text-xs bg-white"
                                />

                                <button
                                  type="button"
                                  onClick={async () => {
                                    const raw = coordText.trim();
                                    if (!raw)
                                      return toast.error("Input kosong");

                                    const direct =
                                      extractLatLngFromTextOrUrl(raw);
                                    if (direct) {
                                      setDraftLat(direct.lat);
                                      setDraftLng(direct.lng);
                                      toast.success(
                                        "Koordinat berhasil diterapkan",
                                      );
                                      return;
                                    }

                                    if (isMapsShortLink(raw)) {
                                      const t = toast.loading(
                                        "Membuka link Google Maps...",
                                      );
                                      try {
                                        const r = await fetch(
                                          `/api/expand-maps?url=${encodeURIComponent(raw)}`,
                                        );
                                        const j = await r.json();
                                        if (!r.ok)
                                          throw new Error(
                                            j?.error || "Gagal expand link",
                                          );

                                        const parsed =
                                          extractLatLngFromTextOrUrl(
                                            j.finalUrl,
                                          );
                                        if (!parsed)
                                          throw new Error(
                                            "Koordinat tidak ditemukan dari link",
                                          );

                                        setDraftLat(parsed.lat);
                                        setDraftLng(parsed.lng);
                                        toast.success(
                                          "Koordinat berhasil diterapkan",
                                          { id: t },
                                        );
                                        return;
                                      } catch (e: any) {
                                        toast.error(
                                          e?.message || "Gagal membaca link",
                                          { id: t },
                                        );
                                        return;
                                      }
                                    }

                                    toast.error(
                                      "Format tidak dikenali. Paste koordinat atau link Google Maps.",
                                    );
                                  }}
                                  className="px-2 py-1 rounded-md bg-gray-100 text-gray-800 text-xs font-semibold"
                                >
                                  Terapkan
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {draftLat != null && draftLng != null ? (
                          <div className="mt-2 space-y-2">
                            <div className="text-xs text-gray-500">
                              Klik peta untuk memindahkan pin, atau geser
                              pinnya.
                            </div>

                            <LocationPickerMap
                              lat={Number(draftLat)}
                              lng={Number(draftLng)}
                              onChange={(lat, lng) => {
                                setDraftLat(lat);
                                setDraftLng(lng);
                              }}
                              height={260}
                            />
                          </div>
                        ) : (
                          <div className="text-xs opacity-70 mt-2">
                            Koordinat belum ada. Klik “Ambil Lokasi”.
                          </div>
                        )}

                        <div className="rounded-md border p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold">
                              Foto di Tempat
                            </div>
                            {activeSample?.photoSignedUrl ? (
                              <a
                                href={activeSample.photoSignedUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Buka foto tersimpan
                              </a>
                            ) : null}
                          </div>

                          {activeSample?.approvalStatus !== "Disetujui" && (
                            <div className="flex gap-2">
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                disabled={
                                  activeSample?.approvalStatus === "Disetujui"
                                }
                                onChange={(e) =>
                                  onPickPhoto(e.target.files?.[0] ?? null)
                                }
                                className="block w-full text-xs"
                              />
                            </div>
                          )}

                          {draftPhotoPreview ? (
                            <img
                              src={draftPhotoPreview}
                              alt="Preview"
                              className="mt-2 w-full max-h-64 object-contain rounded-md border"
                            />
                          ) : activeSample?.photoSignedUrl ? (
                            <img
                              src={activeSample.photoSignedUrl}
                              alt="Foto tersimpan"
                              className="mt-2 w-full max-h-64 object-contain rounded-md border"
                            />
                          ) : (
                            <div className="text-xs opacity-70">
                              Belum ada foto.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs px-8">
                    <input
                      type="checkbox"
                      checked={isLocationConfirmed}
                      onChange={(e) => setIsLocationConfirmed(e.target.checked)}
                    />
                    Saya sudah memastikan pin lokasi sudah benar
                  </label>

                  <div
                    className={`shrink-0 px-8 py-3 pb-6 sm:px-6 flex items-center ${activeSample?.approvalStatus === "Disetujui" ? "justify-end" : "justify-between"} gap-2`}
                  >
                    <button
                      type="button"
                      onClick={closeCacahModal}
                      className="px-3 py-2 rounded-md bg-white border text-sm font-semibold"
                    >
                      Tutup
                    </button>
                    {activeSample?.approvalStatus !== "Disetujui" && (
                      <button
                        type="button"
                        onClick={saveCacahModal}
                        disabled={
                          savingModal ||
                          activeSample?.approvalStatus === "Disetujui"
                        }
                        className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold disabled:opacity-70"
                      >
                        {savingModal ? "Menyimpan..." : "Simpan"}
                      </button>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  );
}
