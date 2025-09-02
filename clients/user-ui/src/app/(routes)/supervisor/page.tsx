"use client";

import React from "react";
import toast from "react-hot-toast";
import {
  useApolloClient,
  useLazyQuery,
  useMutation,
  useQuery,
} from "@apollo/client";
import useUser from "@/src/hooks/useUser";
import { GET_ALL_SURVEY_ACTIVITIES } from "@/src/graphql/actions/find-allsurveyact.action";
import { GET_ALL_SUB_SURVEY_ACTIVITIES } from "@/src/graphql/actions/find-allsubsurveyact.action";
import { GET_USER_PROGRESS_BY_SUBSURVEY_ID } from "@/src/graphql/actions/find-usersurveyprogress.action";
import { UPDATE_USER_PROGRESS } from "@/src/graphql/actions/update-userprogress.action";
import styles from "@/src/utils/style";

// ==== Types singkat ====
type SurveyActivity = { id: string; name: string };
type SubSurveyActivity = {
  id: string;
  name: string;
  activityType?: string | null;
  surveyActivityId: string;
};
type UserLite = { id: string; name: string; email?: string | null };
type UserProgressRow = {
  id: string;
  userId: string;
  superVisorId?: string | null;
  subSurveyActivityId: string;
  totalAssigned: number;
  submitCount: number;
  approvedCount: number;
  rejectedCount: number;
  lastUpdated?: string | null;
  districtId?: string | null;
  user?: UserLite | null;
  subSurveyActivity?: {
    id: string;
    name?: string | null;
    activityType?: string | null;
  } | null;
};

export default function SupervisorManagePage() {
  const { user: me } = useUser();
  const apollo = useApolloClient();

  // 1) TIM
  const {
    data: saData,
    loading: saLoading,
    refetch: refetchSA,
  } = useQuery(GET_ALL_SURVEY_ACTIVITIES, {
    fetchPolicy: "cache-and-network",
  });

  // 2) SUB-KEGIATAN (lazy, mengikuti admin)
  const [fetchSubs, { data: subsData, loading: subsLoading }] = useLazyQuery(
    GET_ALL_SUB_SURVEY_ACTIVITIES,
    {
      fetchPolicy: "network-only",
    }
  );

  // 3) USER PROGRESS (lazy, mengikuti admin)
  const [fetchUP, { data: upData, loading: upLoading, refetch: refetchUP }] =
    useLazyQuery(GET_USER_PROGRESS_BY_SUBSURVEY_ID, {
      fetchPolicy: "network-only",
    });

  // ===== Pilihan bertingkat =====
  const [surveyActivityId, setSurveyActivityId] = React.useState("");
  const [subSurveyActivityId, setSubSurveyActivityId] = React.useState("");
  const [selectedUserProgressId, setSelectedUserProgressId] =
    React.useState("");

  // Muat sub-kegiatan saat Tim ganti
  React.useEffect(() => {
    setSubSurveyActivityId("");
    setSelectedUserProgressId("");
    if (surveyActivityId) fetchSubs({ variables: { surveyActivityId } });
  }, [surveyActivityId, fetchSubs]);

  // Muat UP saat sub-kegiatan ganti
  React.useEffect(() => {
    setSelectedUserProgressId("");
    if (subSurveyActivityId) fetchUP({ variables: { subSurveyActivityId } });
  }, [subSurveyActivityId, fetchUP]);

  // ===== Sumber data dasar =====
  const surveyActivities: SurveyActivity[] = saData?.allSurveyActivities ?? [];
  const subActivities: SubSurveyActivity[] =
    subsData?.subSurveyActivityById ?? [];
  const allUPRows: UserProgressRow[] =
    upData?.userProgressBySubSurveyActivityId ?? [];

  // ===== Petugas: "mirip admin" + filter SV jika tersedia =====
  //  - Jika schema/response memuat superVisorId dan ada baris yg match me.id, tampilkan hanya yang match.
  //  - Jika tidak ada field tsb / tidak ada yang match, fallback ke semua (seperti admin) agar dropdown tidak kosong.
  const supervisorId = me?.id ?? "";
  const myUPRows = React.useMemo(() => {
    // hanya baris untuk sub-kegiatan terpilih (seharusnya allUPRows sudah demikian, tapi aman)
    const rowsForSub = allUPRows.filter(
      (r) => r.subSurveyActivityId === subSurveyActivityId
    );
    const svFieldExist = rowsForSub.some(
      (r) => typeof r.superVisorId !== "undefined"
    );
    if (!svFieldExist) return rowsForSub; // tidak ada kolom superVisorId di payload => tampilkan semua (mirip admin)
    const mine = rowsForSub.filter(
      (r) => (r.superVisorId ?? "") === supervisorId
    );
    return mine.length ? mine : rowsForSub; // kalau tidak ada yang match => fallback ke semua (mirip admin)
  }, [allUPRows, subSurveyActivityId, supervisorId]);

  // Opsi Petugas
  const petugasOptions = React.useMemo(
    () =>
      myUPRows.map((r) => ({
        upId: r.id,
        label: r.user?.name
          ? `${r.user.name}${r.user?.email ? ` - ${r.user.email}` : ""}`
          : r.userId,
      })),
    [myUPRows]
  );

  // Row aktif
  const currentUP: UserProgressRow | undefined = React.useMemo(
    () => myUPRows.find((r) => r.id === selectedUserProgressId),
    [myUPRows, selectedUserProgressId]
  );

  // Tipe kegiatan
  const selectedSub = React.useMemo(
    () => subActivities.find((s) => s.id === subSurveyActivityId),
    [subActivities, subSurveyActivityId]
  );
  const isListing =
    (
      selectedSub?.activityType ??
      currentUP?.subSurveyActivity?.activityType ??
      ""
    )
      .toString()
      .toLowerCase() === "listing";

  // ===== Form =====
  const [form, setForm] = React.useState({
    userProgressId: "",
    totalAssigned: 0,
    submitCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    districtId: "",
  });

  const clamp = (x: number, min = 0, max = Number.POSITIVE_INFINITY) =>
    Math.min(max, Math.max(min, Number.isFinite(x) ? x : 0));

  const applyConstraints = React.useCallback(
    (draft: typeof form) => {
      let totalAssigned = clamp(Number(draft.totalAssigned), 0);
      let submitCount = clamp(Number(draft.submitCount), 0);
      let approvedCount = clamp(Number(draft.approvedCount), 0);
      let rejectedCount = clamp(Number(draft.rejectedCount), 0);

      if (isListing) {
        totalAssigned = submitCount + approvedCount + rejectedCount;
      } else {
        const sum = submitCount + approvedCount + rejectedCount;
        if (sum > totalAssigned) {
          let overflow = sum - totalAssigned;
          const takeFromSubmit = Math.min(overflow, submitCount);
          submitCount -= takeFromSubmit;
          overflow -= takeFromSubmit;
          if (overflow > 0) {
            const takeFromRejected = Math.min(overflow, rejectedCount);
            rejectedCount -= takeFromRejected;
            overflow -= takeFromRejected;
          }
          if (overflow > 0) {
            const takeFromApproved = Math.min(overflow, approvedCount);
            approvedCount -= takeFromApproved;
          }
        }
      }
      return {
        ...draft,
        totalAssigned,
        submitCount,
        approvedCount,
        rejectedCount,
      };
    },
    [isListing]
  );

  // sinkron form ketika currentUP berubah
  React.useEffect(() => {
    if (!currentUP) {
      setForm({
        userProgressId: "",
        totalAssigned: 0,
        submitCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        districtId: "",
      });
      return;
    }
    setForm((prev) =>
      applyConstraints({
        ...prev,
        userProgressId: currentUP.id,
        totalAssigned: Number(currentUP.totalAssigned ?? 0),
        submitCount: Number(currentUP.submitCount ?? 0),
        approvedCount: Number(currentUP.approvedCount ?? 0),
        rejectedCount: Number(currentUP.rejectedCount ?? 0),
        districtId: currentUP.districtId ?? "",
      })
    );
  }, [currentUP, applyConstraints]);

  // stepper
  const step = (
    field: "submitCount" | "approvedCount" | "rejectedCount",
    delta: number
  ) => {
    setForm((prev) => {
      let { submitCount, approvedCount, rejectedCount } = prev;
      if (field === "submitCount") submitCount = clamp(submitCount + delta, 0);
      if (field === "approvedCount") {
        if (delta > 0) {
          if (submitCount <= 0) return prev;
          submitCount -= 1;
          approvedCount += 1;
        } else if (approvedCount > 0) {
          approvedCount -= 1;
          submitCount += 1;
        }
      }
      if (field === "rejectedCount") {
        if (delta > 0) {
          if (submitCount <= 0) return prev;
          submitCount -= 1;
          rejectedCount += 1;
        } else if (rejectedCount > 0) {
          rejectedCount -= 1;
          submitCount += 1;
        }
      }
      return applyConstraints({
        ...prev,
        submitCount,
        approvedCount,
        rejectedCount,
      });
    });
  };

  // submit update
  const [saving, setSaving] = React.useState(false);
  const onSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    if (!form.userProgressId) {
      toast.error("Pilih Tim, Kegiatan, dan Petugas terlebih dahulu.");
      return;
    }
    try {
      setSaving(true);
      await apollo.mutate({
        mutation: UPDATE_USER_PROGRESS,
        variables: {
          userProgressId: form.userProgressId,
          input: {
            totalAssigned: Number(form.totalAssigned),
            submitCount: Number(form.submitCount),
            approvedCount: Number(form.approvedCount),
            rejectedCount: Number(form.rejectedCount),
            lastUpdated: new Date().toISOString(),
            districtId: form.districtId || null,
          },
        },
      });
      toast.success("Progress petugas diperbarui.");
      if (subSurveyActivityId) await refetchUP?.({ subSurveyActivityId });
    } catch (err) {
      console.error(err);
      toast.error("Gagal memperbarui progress.");
    } finally {
      setSaving(false);
    }
  };

  // ringkasan sub-kegiatan (pakai myUPRows agar konsisten dengan dropdown)
  const summary = React.useMemo(() => {
    return myUPRows.reduce(
      (acc, r) => {
        acc.totalAssigned += Number(r.totalAssigned ?? 0);
        acc.submit += Number(r.submitCount ?? 0);
        acc.approved += Number(r.approvedCount ?? 0);
        acc.rejected += Number(r.rejectedCount ?? 0);
        return acc;
      },
      { totalAssigned: 0, submit: 0, approved: 0, rejected: 0 }
    );
  }, [myUPRows]);

  const disabled = saLoading || subsLoading || upLoading;

  return (
    <div className="px-8 py-6 space-y-4 font-Poppins">
      <div className="bg-orange-50 rounded-lg p-3 shadow flex items-center justify-between">
        <h1 className="text-lg font-bold">Panel Pengawas</h1>
        {(saLoading || subsLoading || upLoading) && (
          <span className="text-xs text-gray-500">Memuat data…</span>
        )}
      </div>

      {/* Filter bertingkat (mirip admin) */}
      <div className="bg-white rounded-xl p-4 shadow space-y-4">
        {/* Tim */}
        <div>
          <label className="block text-sm font-semibold mb-1">Tim</label>
          <select
            value={surveyActivityId}
            onChange={(e) => setSurveyActivityId(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            disabled={saLoading}
          >
            <option value="">
              {saLoading ? "Memuat…" : "-- Pilih Tim --"}
            </option>
            {surveyActivities.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Kegiatan */}
        <div>
          <label className="block text-sm font-semibold mb-1">
            Kegiatan Survei
          </label>
          <select
            value={subSurveyActivityId}
            onChange={(e) => setSubSurveyActivityId(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            disabled={!surveyActivityId || subsLoading}
          >
            <option value="">
              {!surveyActivityId
                ? "Pilih Tim dulu"
                : subsLoading
                  ? "Memuat…"
                  : "-- Pilih Kegiatan --"}
            </option>
            {subActivities.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name} {sub.activityType ? `(${sub.activityType})` : ""}
              </option>
            ))}
          </select>
          {!!subSurveyActivityId && (
            <p className="text-xs mt-1">
              Tipe kegiatan:{" "}
              <b>
                {isListing ? "Listing" : (selectedSub?.activityType ?? "-")}
              </b>
            </p>
          )}
        </div>

        {/* Petugas */}
        <div>
          <label className="block text-sm font-semibold mb-1">Petugas</label>
          <select
            value={selectedUserProgressId}
            onChange={(e) => setSelectedUserProgressId(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            disabled={
              !subSurveyActivityId || upLoading || petugasOptions.length === 0
            }
          >
            <option value="">
              {!subSurveyActivityId
                ? "Pilih Kegiatan dulu"
                : upLoading
                  ? "Memuat…"
                  : petugasOptions.length === 0
                    ? "Tidak ada petugas untuk kegiatan ini"
                    : "-- Pilih Petugas --"}
            </option>
            {petugasOptions.map((opt) => (
              <option key={opt.upId} value={opt.upId}>
                {opt.label}
              </option>
            ))}
          </select>
          {/* Info kecil: sedang difilter oleh supervisor atau fallback ke semua */}
          {!!subSurveyActivityId && (
            <p className="text-[11px] text-gray-500 mt-1">
              {myUPRows.some((r) => (r.superVisorId ?? "") === supervisorId)
                ? "Menampilkan petugas di bawah pengawasan Anda."
                : "superVisorId tidak ditemukan/bernilai null pada data; menampilkan semua petugas (mirip Admin)."}
            </p>
          )}
        </div>
      </div>

      {/* Form Update */}
      <form
        onSubmit={onSubmit}
        className="bg-blue-50 rounded-xl p-4 shadow space-y-3"
      >
        <h3 className="text-base font-bold">Update Data Petugas</h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">
              {isListing ? "Total Listing Petugas" : "Total Sampel Petugas"}
            </label>
            <input
              type="number"
              value={form.totalAssigned}
              onChange={(e) =>
                setForm((p) =>
                  applyConstraints({
                    ...p,
                    totalAssigned: Number(e.target.value),
                  })
                )
              }
              readOnly={isListing}
              className="w-full px-3 py-2 border rounded-md bg-white"
            />
            <p className="text-xs text-gray-600 mt-1">
              {isListing
                ? "Listing: total mengikuti Submit + Approved + Rejected."
                : "Non-Listing: (Submit + Approved + Rejected) tidak boleh melebihi Total Sampel."}
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Submit</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-2 border rounded-md font-bold bg-red-500 text-white hover:bg-red-600"
                onClick={() => step("submitCount", -1)}
              >
                -
              </button>
              <input
                readOnly
                value={form.submitCount}
                className="w-full px-3 py-2 border rounded-md bg-white text-center"
              />
              <button
                type="button"
                className="px-3 py-2 border rounded-md font-bold bg-green-500 text-white hover:bg-green-600"
                onClick={() => step("submitCount", +1)}
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Approved</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-2 border rounded-md font-bold bg-red-500 text-white hover:bg-red-600"
                onClick={() => step("approvedCount", -1)}
              >
                -
              </button>
              <input
                readOnly
                value={form.approvedCount}
                className="w-full px-3 py-2 border rounded-md bg-white text-center"
              />
              <button
                type="button"
                className="px-3 py-2 border rounded-md font-bold bg-green-500 text-white hover:bg-green-600"
                onClick={() => step("approvedCount", +1)}
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Rejected</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-2 border rounded-md font-bold bg-red-500 text-white hover:bg-red-600"
                onClick={() => step("rejectedCount", -1)}
              >
                -
              </button>
              <input
                readOnly
                value={form.rejectedCount}
                className="w-full px-3 py-2 border rounded-md bg-white text-center"
              />
              <button
                type="button"
                className="px-3 py-2 border rounded-md font-bold bg-green-500 text-white hover:bg-green-600"
                onClick={() => step("rejectedCount", +1)}
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="pt-2 hidden">
          <label className="block text-sm font-semibold mb-1">
            District ID (opsional)
          </label>
          <input
            type="text"
            value={form.districtId ?? ""}
            onChange={(e) =>
              setForm((p) => ({ ...p, districtId: e.target.value }))
            }
            className="w-full px-3 py-2 border rounded-md bg-white"
          />
        </div>

        <button
          disabled={!form.userProgressId || saving}
          className={`${styles.button} my-2 text-white`}
        >
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </form>

      <div className="bg-white rounded-xl p-4 shadow">
        <h3 className="text-base font-bold mb-2">
          Ringkasan Kegiatan (mengacu dropdown Petugas)
        </h3>
        {subSurveyActivityId ? (
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="px-3 py-2 rounded bg-gray-100">
              Total Assigned: <b>{summary.totalAssigned}</b>
            </span>
            <span className="px-3 py-2 rounded bg-gray-100">
              Submit: <b>{summary.submit}</b>
            </span>
            <span className="px-3 py-2 rounded bg-gray-100">
              Approved: <b>{summary.approved}</b>
            </span>
            <span className="px-3 py-2 rounded bg-gray-100">
              Rejected: <b>{summary.rejected}</b>
            </span>
          </div>
        ) : (
          <p className="text-gray-600 text-sm">
            Pilih Tim dan Kegiatan untuk melihat ringkasan.
          </p>
        )}
      </div>
    </div>
  );
}
