"use client";

import React, { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useApolloClient, useLazyQuery, useQuery } from "@apollo/client";
import useUser from "@/src/hooks/useUser";
import { GET_ALL_SURVEY_ACTIVITIES } from "@/src/graphql/actions/find-allsurveyact.action";
import { GET_ALL_SUB_SURVEY_ACTIVITIES } from "@/src/graphql/actions/find-allsubsurveyact.action";
import { GET_USER_PROGRESS_BY_SUBSURVEY_ID } from "@/src/graphql/actions/find-usersurveyprogress.action";
import { UPDATE_USER_PROGRESS } from "@/src/graphql/actions/update-userprogress.action";
import styles from "@/src/utils/style";
import HUComboBox from "@/src/components/HUCombobox";
import HUSelect from "@/src/components/HUSelect";

/* ==== (type definitions sama persis dengan punyamu) ==== */
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

  const {
    data: saData,
    loading: saLoading,
    refetch: refetchSA,
  } = useQuery(GET_ALL_SURVEY_ACTIVITIES, { fetchPolicy: "cache-and-network" });
  const [fetchSubs, { data: subsData, loading: subsLoading }] = useLazyQuery(
    GET_ALL_SUB_SURVEY_ACTIVITIES,
    { fetchPolicy: "network-only" }
  );
  const [fetchUP, { data: upData, loading: upLoading, refetch: refetchUP }] =
    useLazyQuery(GET_USER_PROGRESS_BY_SUBSURVEY_ID, {
      fetchPolicy: "network-only",
    });

  const [surveyActivityId, setSurveyActivityId] = React.useState("");
  const [subSurveyActivityId, setSubSurveyActivityId] = React.useState("");
  const [selectedUserProgressId, setSelectedUserProgressId] =
    React.useState("");

  React.useEffect(() => {
    setSubSurveyActivityId("");
    setSelectedUserProgressId("");
    if (surveyActivityId) fetchSubs({ variables: { surveyActivityId } });
  }, [surveyActivityId, fetchSubs]);

  React.useEffect(() => {
    setSelectedUserProgressId("");
    if (subSurveyActivityId) fetchUP({ variables: { subSurveyActivityId } });
  }, [subSurveyActivityId, fetchUP]);

  const surveyActivities: SurveyActivity[] = saData?.allSurveyActivities ?? [];

  const teamOptions = useMemo(
    () => surveyActivities.map((s) => ({ value: s.id, label: s.name })),
    [surveyActivities]
  );

  const subActivities: SubSurveyActivity[] =
    subsData?.subSurveyActivityById ?? [];

  const kegiatanOptions = useMemo(
    () =>
      subActivities.map((sub) => ({
        value: sub.id,
        label: `${sub.name}${sub.activityType ? ` (${sub.activityType})` : ""}`,
      })),
    [subActivities]
  );
  const allUPRows: UserProgressRow[] =
    upData?.userProgressBySubSurveyActivityId ?? [];

  const supervisorId = me?.id ?? "";
  const myUPRows = React.useMemo(() => {
    const rowsForSub = allUPRows.filter(
      (r) => r.subSurveyActivityId === subSurveyActivityId
    );
    const svFieldExist = rowsForSub.some(
      (r) => typeof r.superVisorId !== "undefined"
    );
    if (!svFieldExist) return rowsForSub;
    const mine = rowsForSub.filter(
      (r) => (r.superVisorId ?? "") === supervisorId
    );
    return mine.length ? mine : rowsForSub;
  }, [allUPRows, subSurveyActivityId, supervisorId]);

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

  const petugasComboOptions = useMemo(
    () => petugasOptions.map((p) => ({ value: p.upId, label: p.label })),
    [petugasOptions]
  );

  const currentUP: UserProgressRow | undefined = React.useMemo(
    () => myUPRows.find((r) => r.id === selectedUserProgressId),
    [myUPRows, selectedUserProgressId]
  );

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
            const t = Math.min(overflow, rejectedCount);
            rejectedCount -= t;
            overflow -= t;
          }
          if (overflow > 0) {
            const t = Math.min(overflow, approvedCount);
            approvedCount -= t;
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
    <div className="max-w-screen-xl mx-auto px-3 sm:px-6 md:px-8 py-6 space-y-4 font-Poppins">
      <div className="bg-orange-50 rounded-lg p-3 md:p-4 shadow flex items-center justify-between">
        <h1 className="text-base md:text-lg font-bold">Panel Pengawas</h1>
        {(saLoading || subsLoading || upLoading) && (
          <span className="text-xs text-gray-500">Memuat data…</span>
        )}
      </div>

      {/* Filter bertingkat */}
      <div className="bg-white rounded-xl p-4 shadow space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tim */}
          <div>
            <label className="block text-sm font-semibold mb-1">Tim</label>
            <HUComboBox
              value={surveyActivityId || null}
              onValueChange={(v) => setSurveyActivityId(v ?? "")}
              options={teamOptions}
              placeholder={saLoading ? "Memuat…" : "-- Pilih Tim --"}
              className="w-full"
            />
          </div>

          {/* Kegiatan */}
          <div>
            <label className="block text-sm font-semibold mb-1">
              Kegiatan Survei
            </label>
            <HUSelect
              value={subSurveyActivityId || null}
              onValueChange={(v) => setSubSurveyActivityId(v ?? "")}
              options={kegiatanOptions}
              placeholder={
                !surveyActivityId
                  ? "Pilih Tim dulu"
                  : subsLoading
                    ? "Memuat…"
                    : "-- Pilih Kegiatan --"
              }
              disabled={!surveyActivityId || subsLoading}
              className="w-full"
            />
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
            <HUComboBox
              value={selectedUserProgressId || null}
              onValueChange={(v) => setSelectedUserProgressId(v ?? "")}
              options={petugasComboOptions}
              placeholder={
                !subSurveyActivityId
                  ? "Pilih Kegiatan dulu"
                  : upLoading
                    ? "Memuat…"
                    : petugasOptions.length === 0
                      ? "Tidak ada petugas"
                      : "-- Pilih Petugas --"
              }
              disabled={
                !subSurveyActivityId || upLoading || petugasOptions.length === 0
              }
              className="w-full"
            />
            {!!subSurveyActivityId && (
              <p className="text-[11px] text-gray-500 mt-1">
                {myUPRows.some((r) => (r.superVisorId ?? "") === supervisorId)
                  ? "Menampilkan petugas di bawah pengawasan Anda."
                  : "superVisorId tidak ditemukan/bernilai null; menampilkan semua petugas."}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Form Update */}
      <form
        onSubmit={onSubmit}
        className="bg-blue-50 rounded-xl p-4 shadow space-y-4"
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

          {(["submitCount", "approvedCount", "rejectedCount"] as const).map(
            (key) => (
              <div key={key}>
                <label className="block text-sm font-semibold mb-1">
                  {key === "submitCount"
                    ? "Submit"
                    : key === "approvedCount"
                      ? "Approved"
                      : "Rejected"}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 border rounded-md font-bold bg-red-500 text-white hover:bg-red-600"
                    onClick={() => step(key, -1)}
                  >
                    -
                  </button>
                  <input
                    readOnly
                    value={form[key]}
                    className="w-full px-3 py-2 border rounded-md bg-white text-center"
                  />
                  <button
                    type="button"
                    className="px-3 py-2 border rounded-md font-bold bg-green-500 text-white hover:bg-green-600"
                    onClick={() => step(key, +1)}
                  >
                    +
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        <button
          disabled={!form.userProgressId || saving}
          className={`${styles.button} my-2 text-white w-full sm:w-auto`}
        >
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </form>

      <div className="bg-white rounded-xl p-4 shadow">
        <h3 className="text-base font-bold mb-2">Ringkasan Kegiatan</h3>
        {subSurveyActivityId ? (
          <div className="flex flex-wrap gap-2 sm:gap-4 text-sm">
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
