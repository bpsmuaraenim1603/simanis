"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import { GET_REAL_ALL_SUB_SURVEY_PROGRESS } from "@/src/graphql/actions/get-allsubsurveyprogress.action";
import { GET_MONTHLY_DASHBOARD_STATS } from "@/src/graphql/actions/get-allmonthlyprogress.action";
import { GET_REAL_ALL_USER_PROGRESS } from "@/src/graphql/actions/get-alluserprogress.action";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import HUComboBox from "@/src/components/HUCombobox";
import "react-datetime/css/react-datetime.css";
import MonthlyStaffUsageWidget from "@/src/components/MonthlyStaffUsageWidget";

function Dashboard() {
  type SubSurveyProgress = {
    startDate: string;
    endDate: string;
    targetSample: number;
    totalPetugas: number;
    submitCount: number;
    approvedCount: number;
    rejectedCount: number;
    name: string;
    subSurveyActivityId: string;
  };

  type UserProgress = {
    user: { id: string; name: string };
    userId: string;
    subSurveyActivity: {
      id: string;
      name: string;
      slug: string;
      surveyActivityId: string;
      startDate: string;
      endDate: string;
      targetSample: number;
    };
    subSurveyActivityId: string;
    totalAssigned: number;
    submitCount: number;
    approvedCount: number;
    rejectedCount: number;
    lastUpdated: string;
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSurvey, setSelectedSurvey] = useState<string>("");
  const [selectedSubSurveyId, setSelectedSubSurveyId] = useState<string>("");

  const { data: surveyPogressData } = useQuery<{
    getAllSubSurveyProgress: SubSurveyProgress[];
  }>(GET_REAL_ALL_SUB_SURVEY_PROGRESS);

  const { data: monthlyStats } = useQuery(GET_MONTHLY_DASHBOARD_STATS);

  const activeUserIdSet = useMemo(() => {
    const ids = monthlyStats?.getMonthlySurveyStats?.activeUserIds ?? [];
    return new Set(ids);
  }, [monthlyStats]);

  const activeSubSurveyIdSet = useMemo(() => {
    const ids =
      monthlyStats?.getMonthlySurveyStats?.activeSubSurveyActivityIds ?? [];
    return new Set(ids);
  }, [monthlyStats]);

  const surveyNameOptions = useMemo(() => {
    const rows = surveyPogressData?.getAllSubSurveyProgress ?? [];

    const onlyActive = activeSubSurveyIdSet.size
      ? rows.filter((r) => activeSubSurveyIdSet.has(r.subSurveyActivityId))
      : [];

    const names = [...new Set(onlyActive.map((r) => r.name).filter(Boolean))];
    return names.map((n) => ({ value: String(n), label: String(n) }));
  }, [surveyPogressData, activeSubSurveyIdSet]);

  const { data: userProgressData } = useQuery<{
    allUserSurveyProgress: UserProgress[];
  }>(GET_REAL_ALL_USER_PROGRESS);

  const aggregatedUserProgress = useMemo(() => {
    const rows = userProgressData?.allUserSurveyProgress ?? [];

    if (!activeSubSurveyIdSet.size || !activeUserIdSet.size) return [];

    const onlyActive = rows
      .filter((r) => activeSubSurveyIdSet.has(r.subSurveyActivity.id))
      .filter((r) => activeUserIdSet.has(r.user.id));

    const filtered = selectedSubSurveyId
      ? onlyActive.filter((r) => r.subSurveyActivity.id === selectedSubSurveyId)
      : onlyActive;

    type Agg = {
      key: string;
      user: { id: string; name: string };
      subSurveyActivity: { id: string; name: string };
      totalAssigned: number;
      submitCount: number;
      approvedCount: number;
      rejectedCount: number;
      lastUpdated: string;
    };

    const map = new Map<string, Agg>();

    for (const r of filtered) {
      const key = `${r.user.id}__${r.subSurveyActivity.id}`;
      const prev = map.get(key);

      if (!prev) {
        map.set(key, {
          key,
          user: r.user,
          subSurveyActivity: {
            id: r.subSurveyActivity.id,
            name: r.subSurveyActivity.name,
          },
          totalAssigned: r.totalAssigned,
          submitCount: r.submitCount,
          approvedCount: r.approvedCount,
          rejectedCount: r.rejectedCount,
          lastUpdated: r.lastUpdated,
        });
      } else {
        prev.totalAssigned += r.totalAssigned;
        prev.submitCount += r.submitCount;
        prev.approvedCount += r.approvedCount;
        prev.rejectedCount += r.rejectedCount;
        prev.lastUpdated =
          new Date(r.lastUpdated) > new Date(prev.lastUpdated)
            ? r.lastUpdated
            : prev.lastUpdated;
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.approvedCount - a.approvedCount
    );
  }, [
    userProgressData,
    selectedSubSurveyId,
    activeSubSurveyIdSet,
    activeUserIdSet,
  ]);

  const subSurveyIdOptions = useMemo(() => {
    const list = userProgressData?.allUserSurveyProgress ?? [];

    const onlyActive = activeSubSurveyIdSet.size
      ? list.filter((r) => activeSubSurveyIdSet.has(r.subSurveyActivity.id))
      : [];

    const map = new Map<string, string>();
    for (const it of onlyActive) {
      map.set(it.subSurveyActivity.id, it.subSurveyActivity.name);
    }

    return Array.from(map.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [userProgressData, activeSubSurveyIdSet]);

  const filteredProgress = useMemo(() => {
    const rows = surveyPogressData?.getAllSubSurveyProgress ?? [];

    const onlyActive = activeSubSurveyIdSet.size
      ? rows.filter((r) => activeSubSurveyIdSet.has(r.subSurveyActivityId))
      : [];

    return !selectedSurvey
      ? onlyActive
      : onlyActive.filter((r) =>
          (r.name || "").toLowerCase().includes(selectedSurvey.toLowerCase())
        );
  }, [surveyPogressData, selectedSurvey, activeSubSurveyIdSet]);

  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-6 md:px-8 py-4 space-y-4 font-Poppins">
      {/* Header */}
      <div className="bg-orange-50 rounded-lg p-3 md:p-4 font-bold text-lg md:text-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-md">
        <span>Beranda</span>
        {/* <button
          onClick={fetchEvents}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition font-semibold w-full sm:w-auto"
        >
          Refresh
        </button> */}
      </div>

      {/* Toolbar pencarian */}
      <div className="bg-white rounded-lg p-3 shadow flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <label className="text-sm font-medium">Cari kegiatan</label>
        <input
          type="text"
          placeholder="Nama kegiatan / info …"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border focus:outline-none border-gray-300 bg-white rounded-md px-3 py-2 text-sm w-full sm:max-w-sm"
        />
      </div>

      <MonthlyStaffUsageWidget />

      {/* ======= Chart & Leaderboard ======= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* Kiri: Chart + Filter */}
        <div className="bg-orange-50 p-4 rounded-lg shadow-md w-full">
          <div className="mb-3 md:mb-4">
            <label className="font-semibold">Filter Kegiatan Survei:</label>
            <HUComboBox
              value={selectedSurvey || null}
              onValueChange={(v) => setSelectedSurvey(v ?? "")}
              options={surveyNameOptions}
              placeholder="Semua Survei"
            />
          </div>

          <div className="w-full h-64 md:h-80">
            <ResponsiveContainer>
              <BarChart
                data={filteredProgress}
                margin={{ top: 20, right: 20, left: 4, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-15}
                  textAnchor="end"
                  height={60}
                  interval={0}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="targetSample"
                  fill="#f97316"
                  name="Target Sampel"
                />
                <Bar
                  dataKey="submitCount"
                  fill="#3b82f6"
                  name="Submit Sampel"
                />
                <Bar dataKey="approvedCount" fill="#22c55e" name="Approved" />
                {/* <Bar dataKey="rejectedCount" fill="#ef4444" name="Rejected" /> */}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Kanan: Pencapaian Petugas */}
        <div className="bg-orange-50 rounded-lg shadow-md p-4 w-full h-fit">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
            <label className="font-semibold">Pencapaian Petugas</label>
            <HUComboBox
              value={selectedSubSurveyId || null}
              onValueChange={(v) => setSelectedSubSurveyId(v ?? "")}
              options={subSurveyIdOptions}
              placeholder="Semua Kegiatan"
            />
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {aggregatedUserProgress.map((agg) => {
              const percent =
                agg.totalAssigned > 0
                  ? Math.round(
                      ((agg.submitCount + agg.rejectedCount) /
                        agg.totalAssigned) *
                        100
                    )
                  : 0;

              const percentApproved =
                agg.totalAssigned > 0
                  ? Math.round((agg.approvedCount / agg.totalAssigned) * 100)
                  : 0;

              const pct = Math.max(0, Math.min(100, percent));
              const pctApproved = Math.max(0, Math.min(100, percentApproved));

              return (
                <div key={agg.key} className="space-y-1">
                  <div className="flex justify-between font-semibold text-sm">
                    <span className="truncate pr-2">
                      {agg.user.name} ·{" "}
                      <span className="text-gray-700">
                        {agg.subSurveyActivity.name}
                      </span>{" "}
                    </span>
                    <span>{pct}%</span>
                  </div>

                  <div className="relative w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full ${
                        pct >= 80
                          ? "bg-green-500"
                          : pct >= 50
                            ? "bg-yellow-400"
                            : "bg-red-400"
                      }`}
                      style={{ width: `${pct}%` }}
                      title={`Submit: ${pct}%`}
                    />
                    <div
                      className="absolute inset-y-0 left-0 rounded-full z-10 bg-blue-600"
                      style={{ width: `${pctApproved}%` }}
                      title={`Disetujui: ${pctApproved}%`}
                    />
                  </div>

                  <p className="text-xs text-gray-600">
                    Target: {agg.totalAssigned} sampel, Disubmit:{" "}
                    {agg.submitCount + agg.rejectedCount} sampel, Disetujui:{" "}
                    {agg.approvedCount} sampel
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-gray-600">
                    <span className="relative inline-flex items-center gap-1">
                      <span className="absolute inline-block w-9 h-2 rounded bg-green-500 align-middle" />
                      <span className="absolute inline-block w-6 h-2 z-10 rounded bg-yellow-400 align-middle" />
                      <span className="absolute inline-block w-3 h-2 z-20 rounded bg-red-400 align-middle" />
                    </span>
                    <p className="ml-7">Submit</p>
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block w-3 h-2 rounded bg-blue-600 align-middle" />{" "}
                      Disetujui
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
