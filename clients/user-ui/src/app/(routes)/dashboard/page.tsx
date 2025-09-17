"use client";
import axios from "axios";
import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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

interface CalendarEvent {
  title: string;
  start: Date | string;
  end: Date | string;
  allDay: boolean;
  id: string;
  info: string;
  surveyEvent: string;
  _id?: number;
}

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

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isMinimized, setIsMinimized] = useState<Record<string, boolean>>({});
  const [isCloseTable, setIsCloseTable] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<string>("");
  const [selectedSubSurveyId, setSelectedSubSurveyId] = useState<string>("");

  const { data: surveyPogressData } = useQuery<{
    getAllSubSurveyProgress: SubSurveyProgress[];
  }>(GET_REAL_ALL_SUB_SURVEY_PROGRESS);

  const { data: monthlyStats } = useQuery(GET_MONTHLY_DASHBOARD_STATS);

  const { data: userProgressData } = useQuery<{
    allUserSurveyProgress: UserProgress[];
  }>(GET_REAL_ALL_USER_PROGRESS);

  const filteredProgress = useMemo(() => {
    const rows = surveyPogressData?.getAllSubSurveyProgress ?? [];
    return rows.filter((item) =>
      !selectedSurvey
        ? true
        : (item.name || "").toLowerCase().includes(selectedSurvey.toLowerCase())
    );
  }, [surveyPogressData, selectedSurvey]);

  const subSurveyOptions = [
    ...new Map(
      userProgressData?.allUserSurveyProgress?.map((item) => [
        item.subSurveyActivity.id,
        item.subSurveyActivity.name,
      ]) ?? []
    ),
  ];

  const fetchEvents = async () => {
    try {
      const res = await axios.get("../../../../api/cals", {
        headers: { "Cache-Control": "no-store" },
      });
      if (res.status !== 200) throw new Error("Gagal terhubung ke database");
      const formattedEvents = res.data.cals.map((event: any) => ({
        ...event,
        id: String(event.id),
      }));
      setEvents(formattedEvents);
    } catch (error) {
      console.log("Error memuat database: ", error);
    }
  };

  const filteredEvents = events.filter((event) => {
    const q = searchTerm.toLowerCase();
    return (
      event.title.toLowerCase().includes(q) ||
      event.surveyEvent.toLowerCase().includes(q) ||
      event.info.toLowerCase().includes(q)
    );
  });

  const groupedEntries = useMemo(() => {
    const groups = filteredEvents.reduce<Record<string, CalendarEvent[]>>(
      (acc, ev) => {
        const key = ev.surveyEvent;
        (acc[key] ||= []).push(ev);
        return acc;
      },
      {}
    );
    return Object.entries(groups);
  }, [filteredEvents]);

  const toggleTable = (key: string) =>
    setIsMinimized((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleAllTables = (close: boolean) => {
    const newState: Record<string, boolean> = {};
    groupedEntries.forEach(([key]) => (newState[key] = close));
    setIsMinimized(newState);
  };

  useEffect(() => {
    const grouped = filteredEvents.reduce<Record<string, CalendarEvent[]>>(
      (groups, e) => {
        (groups[e.surveyEvent] ||= []).push(e);
        return groups;
      },
      {}
    );
    const allClosed = Object.keys(grouped).every(
      (surveyEvent) => isMinimized[surveyEvent] === true
    );
    setIsCloseTable(allClosed);
  }, [isMinimized, filteredEvents]);

  useEffect(() => {
    fetchEvents();
  }, []);

  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-6 md:px-8 py-4 space-y-4 font-Poppins">
      {/* Header */}
      <div className="bg-orange-50 rounded-lg p-3 md:p-4 font-bold text-lg md:text-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-md">
        <span>Beranda</span>
        <button
          onClick={fetchEvents}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition font-semibold w-full sm:w-auto"
        >
          Refresh
        </button>
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

      {/* ======= Jadwal Kegiatan ======= */}
      {/* Desktop/Tablets: tabel scroll horizontal */}
      <div className="hidden sm:block bg-white rounded-lg shadow">
        <div className="w-full overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm text-left text-gray-600">
            <thead className="text-gray-700 bg-gray-200">
              <tr>
                <th className="px-6 py-3 uppercase">Kegiatan Survei</th>
                <th className="px-6 py-3 uppercase">Jadwal Kegiatan</th>
                <th className="px-6 py-3 uppercase">Keterangan</th>
                <th className="px-6 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {/* Empty */}
              {groupedEntries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-6 text-center text-gray-500">
                    {searchTerm ? (
                      <>
                        Tidak ada kegiatan yang cocok untuk{" "}
                        <span className="font-semibold">"{searchTerm}"</span>
                      </>
                    ) : (
                      "Belum ada jadwal kegiatan."
                    )}
                  </td>
                </tr>
              ) : null}

              {groupedEntries.map(([surveyEvent, list]) => {
                list.sort(
                  (a, b) => +new Date(a.start) - +new Date(b.start)
                );
                const minimized = isMinimized[surveyEvent] ?? false;
                return (
                  <React.Fragment key={surveyEvent}>
                    <tr className="bg-gray-100 border-y border-gray-300">
                      <td colSpan={3} className="px-6 py-2 font-bold text-gray-800">
                        {surveyEvent}
                      </td>
                      <td className="px-6 py-2">
                        <div className="flex justify-end">
                          <button
                            onClick={() => toggleTable(surveyEvent)}
                            className="inline-flex items-center px-2 py-1 rounded-md border text-sm"
                            title={minimized || isCloseTable ? "Buka" : "Tutup"}
                          >
                            {minimized || isCloseTable ? (
                              <>
                                <span className="mr-1">Buka</span>
                                <ChevronDown size={16} />
                              </>
                            ) : (
                              <>
                                <span className="mr-1">Tutup</span>
                                <ChevronUp size={16} />
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                    <AnimatePresence>
                      {(minimized || isCloseTable) ? null : list.map((event) => (
                        <tr key={event.id} className="bg-white border-b border-gray-200 align-top">
                          <td className="px-6 py-2 font-medium text-gray-900">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.1 }}
                            >
                              {event.title}
                            </motion.div>
                          </td>
                          <td className="px-6 py-2">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.1 }}
                            >
                              {new Date(event.start).toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}{" "}
                              -{" "}
                              {new Date(event.end).toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </motion.div>
                          </td>
                          <td className="px-6 py-2">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.1 }}
                            >
                              {event.info}
                            </motion.div>
                          </td>
                          <td className="px-6 py-2 text-right">
                            <a href="#" className="font-medium text-blue-600 hover:underline">
                              Edit
                            </a>
                          </td>
                        </tr>
                      ))}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="text-gray-700 bg-gray-200">
                <td colSpan={4} className="px-6 py-2">
                  <div className="flex justify-end items-center">
                    {isCloseTable ? (
                      <button
                        onClick={() => toggleAllTables(false)}
                        className="flex items-center px-3 py-1.5 rounded-md bg-gray-900 text-white"
                      >
                        <span className="mr-1">Buka Jadwal</span>
                        <ChevronDown size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleAllTables(true)}
                        className="flex items-center px-3 py-1.5 rounded-md bg-gray-900 text-white"
                      >
                        <span className="mr-1">Tutup Jadwal</span>
                        <ChevronUp size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Mobile: jadikan list kartu per kegiatan */}
      <div className="sm:hidden space-y-3">
        {groupedEntries.length === 0 ? (
          <div className="bg-white rounded-lg p-3 shadow text-center text-gray-500">
            {searchTerm ? (
              <>
                Tidak ada kegiatan yang cocok untuk{" "}
                <span className="font-semibold">"{searchTerm}"</span>
              </>
            ) : (
              "Belum ada jadwal kegiatan."
            )}
          </div>
        ) : null}

        {groupedEntries.map(([surveyEvent, list]) => {
          const minimized = isMinimized[surveyEvent] ?? false;
          const sorted = [...list].sort(
            (a, b) => +new Date(a.start) - +new Date(b.start)
          );
          return (
            <div key={surveyEvent} className="bg-white rounded-lg shadow">
              <div className="flex items-center justify-between px-3 py-2 border-b">
                <h3 className="font-semibold">{surveyEvent}</h3>
                <button
                  onClick={() => toggleTable(surveyEvent)}
                  className="inline-flex items-center px-2 py-1 rounded-md border text-sm"
                >
                  {minimized ? (
                    <>
                      <span className="mr-1">Buka</span>
                      <ChevronDown size={16} />
                    </>
                  ) : (
                    <>
                      <span className="mr-1">Tutup</span>
                      <ChevronUp size={16} />
                    </>
                  )}
                </button>
              </div>

              <AnimatePresence>
                {minimized ? null : (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="divide-y"
                  >
                    {sorted.map((event) => (
                      <li key={event.id} className="p-3">
                        <p className="font-medium text-gray-900">{event.title}</p>
                        <p className="text-sm text-gray-700">
                          {new Date(event.start).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}{" "}
                          -{" "}
                          {new Date(event.end).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        {event.info && (
                          <p className="text-sm text-gray-600 mt-1">{event.info}</p>
                        )}
                        <div className="pt-2">
                          <a href="#" className="text-blue-600 text-sm font-medium">
                            Edit
                          </a>
                        </div>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        <div className="flex justify-end">
          {isCloseTable ? (
            <button
              onClick={() => toggleAllTables(false)}
              className="flex items-center px-3 py-1.5 rounded-md bg-gray-900 text-white"
            >
              <span className="mr-1">Buka Semua</span>
              <ChevronDown size={16} />
            </button>
          ) : (
            <button
              onClick={() => toggleAllTables(true)}
              className="flex items-center px-3 py-1.5 rounded-md bg-gray-900 text-white"
            >
              <span className="mr-1">Tutup Semua</span>
              <ChevronUp size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ======= Headline Cards ======= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-3 md:p-4 bg-orange-50 rounded-lg shadow-md font-bold">
          <h2>PROGRES PENDATAAN BULAN INI</h2>
        </div>
        <div className="p-3 md:p-4 bg-orange-50 rounded-lg shadow-md font-bold">
          <h2>PENCAPAIAN PETUGAS</h2>
        </div>
      </div>

      {/* ======= KPI Cards ======= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        <div className="p-4 bg-orange-50 rounded-lg shadow-md">
          <p className="text-sm font-semibold">Petugas Aktif</p>
          <h2 className="font-bold text-2xl">
            {monthlyStats?.getMonthlySurveyStats?.totalActiveUsers ?? "-"}
          </h2>
          <p className="text-sm">Selama sebulan ini</p>
        </div>
        <div className="p-4 bg-orange-50 rounded-lg shadow-md">
          <p className="text-sm font-semibold">Kendala Petugas</p>
          <h2 className="font-bold text-2xl">0</h2>
          <p className="text-sm">Selama sebulan ini</p>
        </div>
        <div className="p-4 bg-orange-50 rounded-lg shadow-md">
          <p className="text-sm font-semibold">Pengumpulan ST</p>
          <h2 className="font-bold text-2xl">
            {monthlyStats?.getMonthlySurveyStats?.totalJobLetters ?? "-"}
          </h2>
          <p className="text-sm">Selama sebulan ini</p>
        </div>
        <div className="p-4 bg-orange-50 rounded-lg shadow-md">
          <p className="text-sm font-semibold">Pengajuan Honor</p>
          <h2 className="font-bold text-2xl">
            {monthlyStats?.getMonthlySurveyStats?.totalSPJ ?? "-"}
          </h2>
          <p className="text-sm">Selama sebulan ini</p>
        </div>
      </div>

      {/* ======= Chart & Leaderboard ======= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* Kiri: Chart + Filter */}
        <div className="bg-orange-50 p-4 rounded-lg shadow-md w-full">
          <div className="mb-3 md:mb-4">
            <label className="font-semibold">Filter Kegiatan Survei:</label>
            <select
              className="mt-2 w-full sm:w-auto px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              onChange={(e) => setSelectedSurvey(e.target.value)}
              value={selectedSurvey}
            >
              <option value="">Semua</option>
              {[
                ...new Set(
                  (surveyPogressData?.getAllSubSurveyProgress ?? [])
                    .map((item: SubSurveyProgress) => item.name)
                    .filter(Boolean)
                ),
              ].map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full h-64 md:h-80">
            <ResponsiveContainer>
              <BarChart
                data={filteredProgress}
                margin={{ top: 20, right: 20, left: 4, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="targetSample" fill="#f97316" name="Target Sampel" />
                <Bar dataKey="submitCount" fill="#3b82f6" name="Submit Sampel" />
                <Bar dataKey="approvedCount" fill="#22c55e" name="Approved" />
                <Bar dataKey="rejectedCount" fill="#ef4444" name="Rejected" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Kanan: Pencapaian Petugas */}
        <div className="bg-orange-50 rounded-lg shadow-md p-4 w-full h-fit">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
            <h3 className="text-base md:text-lg font-bold">PENCAPAIAN PETUGAS</h3>
            <select
              className="text-sm px-3 py-2 border rounded-md bg-white focus:outline-none w-full sm:w-auto"
              value={selectedSubSurveyId}
              onChange={(e) => setSelectedSubSurveyId(e.target.value)}
            >
              <option value="">Semua Kegiatan</option>
              {subSurveyOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name as string}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {userProgressData?.allUserSurveyProgress
              ?.filter(
                (progress) =>
                  !selectedSubSurveyId ||
                  progress.subSurveyActivity.id === selectedSubSurveyId
              )
              .map((progress, idx) => {
                const percent =
                  progress.totalAssigned > 0
                    ? Math.round(
                        (progress.submitCount / progress.totalAssigned) * 100
                      )
                    : 0;
                const key = `${progress.user.id}-${progress.subSurveyActivity.id}-${idx}`;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between font-semibold text-sm">
                      <span className="truncate pr-2">{progress.user.name}</span>
                      <span>{percent}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          percent >= 80
                            ? "bg-green-500"
                            : percent >= 50
                            ? "bg-yellow-400"
                            : "bg-red-400"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-600">
                      Target: {progress.totalAssigned} sampel, Selesai:{" "}
                      {progress.submitCount} sampel
                    </p>
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
