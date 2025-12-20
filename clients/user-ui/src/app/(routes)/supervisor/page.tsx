"use client";

import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  useApolloClient,
  useLazyQuery,
  useMutation,
  useQuery,
} from "@apollo/client";
import useUser from "@/src/hooks/useUser";
import { useRouter } from "next/navigation";

import { GET_ALL_SURVEY_ACTIVITIES } from "@/src/graphql/actions/find-allsurveyact.action";
import { GET_ALL_SUB_SURVEY_ACTIVITIES } from "@/src/graphql/actions/find-allsubsurveyact.action";
import { GET_USER_PROGRESS_BY_SUBSURVEY_ID } from "@/src/graphql/actions/find-usersurveyprogress.action";
import { PATCH_USER_SAMPLES } from "@/src/graphql/actions/patch-usersamples.action";

/* ========= Types (minimal & sesuai query) ========= */
type SurveyActivity = { id: string; name: string };

type SubSurveyActivity = {
  id: string;
  name: string;
  activityType?: string | null;
  surveyActivityId: string;
  startDate?: string | null;
  endDate?: string | null;
};

type UserLite = { id: string; name: string; email?: string | null };

type UserProgressRow = {
  id: string;
  userId: string;
  subSurveyActivityId: string;
  districtId?: string | null;
  totalAssigned: number;
  submitCount: number;
  approvedCount: number;
  rejectedCount: number;
  lastUpdated?: string | null;
  superVisorId?: string | null;
  blockCount: string;
  villageName?: string | null;

  user?: UserLite | null;
  subSurveyActivity?: {
    id: string;
    name?: string | null;
    activityType?: string | null;
  } | null;
  district?: { id: string; name?: string | null; city?: string | null } | null;

  samples?: {
    id: string;
    nus: string;
    identity?: string | null;
    cacahStatus: string;
    approvalStatus: string;
    geoLat?: number | null;
    geoLng?: number | null;
  }[];
};

type ViewMode = "activity" | "blocks" | "detail";

/* ========= Helpers ========= */
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

export default function SupervisorManagePage() {
  const { user: currentUser, loading: userLoading } = useUser();
  const apollo = useApolloClient();
  const router = useRouter();

  // roles yang diizinkan
  const ALLOWED = new Set(["Superadmin", "Supervisor", "Admin"]);

  useEffect(() => {
    if (userLoading) return;
    const role = currentUser?.role ?? "";
    if (!ALLOWED.has(role)) {
      toast.error("Akses ditolak. Mengarahkan ke Beranda");
      router.replace("/dashboard");
    }
  }, [userLoading, currentUser?.role, router]);

  // ===== Ambil semua tim, lalu fetch semua sub-kegiatan (tanpa UI pilih tim) =====
  const { data: saData, loading: saLoading } = useQuery(
    GET_ALL_SURVEY_ACTIVITIES,
    {
      fetchPolicy: "cache-and-network",
    }
  );

  const [allSubActivities, setAllSubActivities] = useState<SubSurveyActivity[]>(
    []
  );
  const [subsLoading, setSubsLoading] = useState(false);

  useEffect(() => {
    async function loadAllSubs() {
      const surveyActivities: SurveyActivity[] =
        saData?.allSurveyActivities ?? [];
      if (!surveyActivities.length) {
        setAllSubActivities([]);
        return;
      }

      setSubsLoading(true);
      try {
        const results = await Promise.all(
          surveyActivities.map((sa) =>
            apollo.query({
              query: GET_ALL_SUB_SURVEY_ACTIVITIES,
              variables: { surveyActivityId: sa.id },
              fetchPolicy: "network-only",
            })
          )
        );

        // sesuai file sebelumnya: subsData?.subSurveyActivityById
        const merged: SubSurveyActivity[] = results
          .flatMap(
            (r) => (r.data?.subSurveyActivityById ?? []) as SubSurveyActivity[]
          )
          .filter(Boolean);

        // uniq by id
        const map = new Map<string, SubSurveyActivity>();
        for (const s of merged) if (s?.id) map.set(s.id, s);
        setAllSubActivities(Array.from(map.values()));
      } catch (e: any) {
        console.error(e);
        toast.error("Gagal memuat daftar kegiatan.");
        setAllSubActivities([]);
      } finally {
        setSubsLoading(false);
      }
    }

    loadAllSubs();
  }, [saData, apollo]);

  // ===== Fetch user progress per subSurveyActivity =====
  const [fetchUP, { data: upData, loading: upLoading }] = useLazyQuery(
    GET_USER_PROGRESS_BY_SUBSURVEY_ID,
    {
      fetchPolicy: "network-only",
    }
  );

  const [patchUserSamples, { loading: patching }] =
    useMutation(PATCH_USER_SAMPLES);

  // ===== View state =====
  const [viewMode, setViewMode] = useState<ViewMode>("activity");
  const [subSurveyActivityId, setSubSurveyActivityId] = useState("");
  const [selectedUserProgressId, setSelectedUserProgressId] = useState("");

  // supervisor filter (kalau field tersedia)
  const supervisorId = currentUser?.id ?? "";

  const allUPRows: UserProgressRow[] =
    upData?.userProgressBySubSurveyActivityId ?? [];

  const myUPRows = useMemo(() => {
    const rows = allUPRows.filter(
      (r) => r.subSurveyActivityId === subSurveyActivityId
    );

    const svFieldExist = rows.some(
      (r) => typeof r.superVisorId !== "undefined"
    );
    if (!svFieldExist) return rows;

    if (currentUser?.role === "Superadmin") return rows;
    return rows.filter((r) => (r.superVisorId ?? "") === supervisorId);
  }, [allUPRows, subSurveyActivityId, supervisorId, currentUser?.role]);

  const selectedSub = useMemo(
    () => allSubActivities.find((s) => s.id === subSurveyActivityId),
    [allSubActivities, subSurveyActivityId]
  );

  const isListing =
    (
      selectedSub?.activityType ??
      myUPRows?.[0]?.subSurveyActivity?.activityType ??
      ""
    )
      .toString()
      .toLowerCase() === "listing";

  // ===== Activity cards (tampilan awal) =====
  const activityCards = useMemo(() => {
    // urutkan by startDate terbaru
    return [...(allSubActivities ?? [])].sort((a, b) => {
      const aStart = a?.startDate ? new Date(a.startDate).getTime() : 0;
      const bStart = b?.startDate ? new Date(b.startDate).getTime() : 0;
      return bStart - aStart;
    });
  }, [allSubActivities]);

  function openActivity(activityId: string) {
    setSubSurveyActivityId(activityId);
    setSelectedUserProgressId("");
    setViewMode("blocks");
    fetchUP({ variables: { subSurveyActivityId: activityId } });
  }

  function backToActivityList() {
    setViewMode("activity");
    setSubSurveyActivityId("");
    setSelectedUserProgressId("");
  }

  // ===== Cards berdasarkan BLOK (1 row = 1 blok + 1 desa/kec) =====
  const blockCards = useMemo(() => {
    const rows = [...myUPRows];

    // sort: nama petugas -> blok
    rows.sort((a, b) => {
      const an = (a.user?.name ?? "").toString();
      const bn = (b.user?.name ?? "").toString();
      const c1 = an.localeCompare(bn, "id");
      if (c1 !== 0) return c1;
      return (a.blockCount ?? "")
        .toString()
        .localeCompare((b.blockCount ?? "").toString(), "id");
    });

    return rows;
  }, [myUPRows]);

  const currentUP: UserProgressRow | undefined = useMemo(
    () => myUPRows.find((r) => r.id === selectedUserProgressId),
    [myUPRows, selectedUserProgressId]
  );

  const [approvedSamples, setApprovedSamples] = useState<any[]>([]);
  const [mapModal, setMapModal] = useState<null | { index: number }>(null);

  const mapSamples = useMemo(() => {
    return (approvedSamples ?? []).filter((s: any) => {
      const lat = Number(s.geoLat);
      const lng = Number(s.geoLng);
      return Number.isFinite(lat) && Number.isFinite(lng);
    });
  }, [approvedSamples]);

  const mapCount = mapSamples.length;

  const activeSample = useMemo(() => {
    if (!mapModal) return null;
    const idx = Math.min(Math.max(mapModal.index, 0), mapCount - 1);
    return mapSamples[idx] ?? null;
  }, [mapModal, mapSamples, mapCount]);

  const goPrev = () =>
    setMapModal((prev) =>
      prev ? { index: Math.max(prev.index - 1, 0) } : prev
    );

  const goNext = () =>
    setMapModal((prev) =>
      prev ? { index: Math.min(prev.index + 1, mapCount - 1) } : prev
    );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!mapModal) return;
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "Escape") setMapModal(null);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mapModal, mapCount]);

  useEffect(() => {
    if (currentUP?.samples) {
      const sorted = [...currentUP.samples].sort(
        (a: any, b: any) => Number(a.nus) - Number(b.nus)
      );
      setApprovedSamples(sorted);
    } else {
      setApprovedSamples([]);
    }
  }, [currentUP?.id, currentUP?.samples]);

  // ===== Approval =====
  async function setSampleApproval(
    sampleId: string,
    status: "Disetujui" | "Ditolak" | "Menunggu"
  ) {
    if (!currentUP?.id) return toast.error("Pilih blok dulu.");
    try {
      await patchUserSamples({
        variables: {
          input: {
            userProgressId: currentUP.id,
            updateSamples: [{ id: sampleId, approvalStatus: status }],
          },
        },
      });
      await fetchUP({ variables: { subSurveyActivityId } });
      toast.success(
        status === "Disetujui" ? "Sampel disetujui" : "Sampel dikembalikan"
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal update approval");
    }
  }

  function openBlockCard(row: UserProgressRow) {
    setSelectedUserProgressId(row.id);
    setViewMode("detail");
  }

  function backToBlockList() {
    setViewMode("blocks");
    setSelectedUserProgressId("");
  }

  // ===== Guard =====
  if (userLoading) {
    return (
      <div className="max-w-screen-xl mx-auto px-3 py-6 font-Poppins">
        Memuat…
      </div>
    );
  }
  if (!currentUser || !ALLOWED.has(currentUser.role ?? "")) {
    return null;
  }

  const disabled = saLoading || subsLoading || upLoading;

  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-6 md:px-8 py-6 space-y-4 font-Poppins">
      <div className="bg-orange-50 rounded-lg p-3 md:p-4 shadow flex items-center justify-between">
        <h1 className="text-base md:text-lg font-bold">Panel Pengawas</h1>
        {disabled && (
          <span className="text-xs text-gray-500">Memuat data…</span>
        )}
      </div>

      {/* ===== MODE 1: LIST KEGIATAN (seperti User) ===== */}
      {viewMode === "activity" ? (
        <div className="bg-blue-50 rounded-xl p-4 shadow space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-base font-bold">Pilih Kegiatan Survei</div>
              <p className="text-xs text-gray-600">
                Klik kegiatan untuk melihat daftar blok.
              </p>
            </div>
          </div>

          {saLoading || subsLoading ? (
            <div className="text-sm text-gray-600">Memuat kegiatan…</div>
          ) : activityCards.length === 0 ? (
            <div className="text-sm text-gray-600">
              Belum ada kegiatan yang tersedia.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activityCards.map((act) => {
                const isListingCard =
                  (act?.activityType ?? "").toString().toLowerCase() ===
                  "listing";
                return (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => openActivity(act.id)}
                    className="text-left bg-white border rounded-lg p-3 shadow-sm hover:shadow transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold leading-snug">
                        {act.name ?? "-"}
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

                    <div className="mt-1 text-xs text-gray-600">
                      Jadwal:{" "}
                      <span className="font-medium">
                        {fmtDateRange(act.startDate, act.endDate)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* ===== MODE 2: LIST BLOK (berdasarkan kegiatan terpilih) ===== */}
      {viewMode === "blocks" ? (
        <div className="bg-blue-50 rounded-xl p-4 shadow space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-base font-bold">Daftar Blok</div>
              <button
                type="button"
                onClick={backToActivityList}
                className="px-3 py-1.5 rounded-md bg-white border hover:bg-gray-50 text-sm"
              >
                ← Kegiatan
              </button>
            </div>

            <p className="text-sm text-gray-600 grid sm:grid-cols-[8%_1fr] grid-cols-[20%_1fr] grid-rows-2 my-2">
              Kegiatan<span>: {selectedSub?.name ?? "-"}</span>
              Jadwal
              <span>
                : {fmtDateRange(selectedSub?.startDate, selectedSub?.endDate)}
              </span>
            </p>
          </div>

          {upLoading ? (
            <div className="text-sm text-gray-600">Memuat blok…</div>
          ) : blockCards.length === 0 ? (
            <div className="text-sm text-gray-600">
              Tidak ada progres pada kegiatan ini (atau belum ter-assign ke
              pengawas).
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {blockCards.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => openBlockCard(r)}
                  className="text-left bg-white border rounded-lg p-3 shadow-sm hover:shadow transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold leading-snug">
                        {r.user?.name ?? "-"}
                      </div>
                      {r.user?.email ? (
                        <div className="text-xs text-gray-500">
                          {r.user.email}
                        </div>
                      ) : null}
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                      Blok {r.blockCount ?? "-"}
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-[30%_1fr] grid-cols-[40%_1fr] grid-rows-3 mt-2 text-xs text-gray-700 space-y-0.5">
                    Kabupaten/Kota
                    <span className="font-medium">
                      : {r.district?.city ?? "-"}
                    </span>
                    Kecamatan
                    <span className="font-medium">
                      : {r.district?.name ?? "-"}
                    </span>
                    Desa
                    <span className="font-medium">
                      : {r.villageName ?? "-"}
                    </span>
                  </div>

                  <div className="mt-2 w-full text-xs">
                    <div className="rounded-md bg-blue-50 p-2">
                      <div>Assigned</div>
                      <div className="font-semibold">
                        {Number(r.totalAssigned ?? 0)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-green-50 p-2">
                      <div>Submit</div>
                      <div className="font-semibold">
                        {Number(r.submitCount ?? 0)}
                      </div>
                    </div>
                    <div className="rounded-md bg-emerald-50 p-2">
                      <div>Approved</div>
                      <div className="font-semibold">
                        {Number(r.approvedCount ?? 0)}
                      </div>
                    </div>
                    {/* <div className="rounded-md bg-red-50 p-2">
                      <div>Rejected</div>
                      <div className="font-semibold">{Number(r.rejectedCount ?? 0)}</div>
                    </div> */}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* ===== MODE 3: DETAIL (approve sampel) ===== */}
      {viewMode === "detail" ? (
        <div className="bg-blue-50 rounded-xl p-4 shadow space-y-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={backToBlockList}
              className="px-3 py-2 rounded-md bg-white border hover:bg-gray-50 text-sm"
            >
              ← Kembali
            </button>
          </div>

          <div className="bg-white border rounded-lg p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">
                  {currentUP?.user?.name ?? "-"}
                </div>
                {currentUP?.user?.email ? (
                  <div className="text-xs text-gray-500">
                    {currentUP.user.email}
                  </div>
                ) : null}

                <div className="text-xs text-gray-700 mt-2 space-y-0.5">
                  <div>
                    Kegiatan:{" "}
                    <span className="font-medium">
                      {selectedSub?.name ?? "-"}
                    </span>
                  </div>
                  <div>
                    Rentang:{" "}
                    <span className="font-medium">
                      {fmtDateRange(
                        selectedSub?.startDate,
                        selectedSub?.endDate
                      )}
                    </span>
                  </div>
                  <div>
                    Blok:{" "}
                    <span className="font-medium">
                      {currentUP?.blockCount ?? "-"}
                    </span>
                  </div>
                  <div>
                    Kab/Kota:{" "}
                    <span className="font-medium">
                      {currentUP?.district?.city ?? "-"}
                    </span>
                  </div>
                  <div>
                    Kecamatan:{" "}
                    <span className="font-medium">
                      {currentUP?.district?.name ?? "-"}
                    </span>
                  </div>
                  <div>
                    Desa:{" "}
                    <span className="font-medium">
                      {currentUP?.villageName ?? "-"}
                    </span>
                  </div>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                {currentUP?.blockCount
                  ? `Blok ${currentUP.blockCount}`
                  : "Blok -"}
              </span>
            </div>
          </div>

          <h3 className="text-base font-bold">
            {isListing ? "Approve Listing Petugas" : "Approve Sample Petugas"}
          </h3>

          {/* Tabel sampel */}
          <div>
            <div className="w-full rounded-lg border border-gray-200 overflow-x-auto bg-white">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left">
                    <th className="p-2 sm:p-3">NUS</th>
                    <th className="p-2 sm:p-3">Identitas</th>
                    <th className="p-2 sm:p-3">Status Cacah</th>
                    <th className="p-2 sm:p-3">Approval</th>
                    <th className="p-2 sm:p-3">Lokasi</th>
                    <th className="p-2 sm:p-3">Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {approvedSamples.map((s: any) => {
                    const canApprove = s.cacahStatus === "Selesai";
                    return (
                      <tr key={s.id} className="border-t">
                        <td className="p-2 sm:p-3">{s.nus}</td>
                        <td className="p-2 sm:p-3">{s.identity}</td>
                        <td className="p-2 sm:p-3">
                          {s.cacahStatus === "Selesai" ? (
                            <span className="inline-block px-3 py-1 rounded bg-green-100 text-green-700">
                              Selesai Dicacah
                            </span>
                          ) : (
                            <span className="inline-block px-3 py-1 rounded bg-red-100 text-red-700">
                              Belum Dicacah
                            </span>
                          )}
                        </td>
                        <td className="p-2 sm:p-3">
                          {s.approvalStatus === "Menunggu" ? (
                            <span className="inline-block px-3 py-1 rounded bg-yellow-100 text-yellow-700">
                              Menunggu
                            </span>
                          ) : s.approvalStatus === "Ditolak" ? (
                            <span className="inline-block px-3 py-1 rounded bg-red-100 text-red-700">
                              Ditolak
                            </span>
                          ) : (
                            <span className="inline-block px-3 py-1 rounded bg-green-100 text-green-700">
                              Disetujui
                            </span>
                          )}
                        </td>
                        <td className="p-2 sm:p-3">
                          {Number.isFinite(Number(s.geoLat)) &&
                          Number.isFinite(Number(s.geoLng)) ? (
                            <button
                              type="button"
                              className="px-3 py-1 rounded bg-purple-600 text-white disabled:opacity-40"
                              onClick={() => {
                                const idx = mapSamples.findIndex(
                                  (x: any) => x.id === s.id
                                );
                                if (idx === -1) {
                                  toast.error(
                                    "Sampel ini belum punya koordinat."
                                  );
                                  return;
                                }
                                setMapModal({ index: idx });
                              }}
                            >
                              Lihat peta
                            </button>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>

                        <td className="p-2 sm:p-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={!canApprove || patching}
                              className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-40"
                              onClick={() =>
                                setSampleApproval(s.id, "Disetujui")
                              }
                            >
                              Setuju
                            </button>
                            <button
                              type="button"
                              disabled={!canApprove || patching}
                              className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-40"
                              onClick={() =>
                                setSampleApproval(s.id, "Menunggu")
                              }
                            >
                              Tolak
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {approvedSamples.length === 0 && (
                    <tr>
                      <td className="p-3 text-gray-500" colSpan={6}>
                        {!currentUP?.id
                          ? "Pilih blok untuk melihat sampel."
                          : "Belum ada sampel untuk progres ini."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {mapModal && activeSample && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                  onClick={() => setMapModal(null)}
                >
                  <div
                    className="w-full max-w-5xl rounded-2xl bg-white shadow-xl overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                      <div className="font-semibold text-gray-800">
                        {activeSample.nus} — {activeSample.identity ?? "-"}
                      </div>

                      <button
                        type="button"
                        className="px-3 py-1 rounded bg-gray-600 text-white"
                        onClick={() => setMapModal(null)}
                      >
                        Tutup
                      </button>
                    </div>

                    <div className="p-0">
                      {activeSample.geoLat && activeSample.geoLng ? (
                        <iframe
                          className="w-full h-[60vh] sm:h-[70vh]"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          src={`https://www.google.com/maps?q=${activeSample.geoLat},${activeSample.geoLng}&z=17&output=embed`}
                        />
                      ) : (
                        <div className="p-6 text-gray-600">
                          Lokasi belum tersedia untuk sampel ini.
                        </div>
                      )}
                    </div>

                    <div className="px-4 py-3 border-t text-xs text-gray-500">
                      Koordinat: {activeSample.geoLat ?? "-"},{" "}
                      {activeSample.geoLng ?? "-"}
                    </div>

                    {mapCount > 1 && (
                      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-3 border-t bg-gray-50">
                        <button
                          type="button"
                          disabled={mapModal.index <= 0}
                          onClick={goPrev}
                          className="px-3 py-2 rounded-lg bg-white shadow disabled:opacity-40 text-sm"
                        >
                          ← Sebelumnya
                        </button>

                        <div className="text-[11px] sm:text-xs text-gray-500 text-center">
                          Sampel {mapModal.index + 1} dari {mapCount}
                        </div>

                        <button
                          type="button"
                          disabled={mapModal.index >= mapCount - 1}
                          onClick={goNext}
                          className="px-3 py-2 rounded-lg bg-white shadow disabled:opacity-40 text-sm"
                        >
                          Berikutnya →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
