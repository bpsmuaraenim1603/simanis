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
import HUComboBox from "@/src/components/HUCombobox";
import { Dialog, Transition } from "@headlessui/react";
import Datetime from "react-datetime";
import "react-datetime/css/react-datetime.css";
import { Fragment } from "react";

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

function formatDateTime(date: Date | string, use12h = true) {
  const parts = new Intl.DateTimeFormat("id-ID", {
    year: "numeric",
    month: "numeric",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: use12h,
    // timeZone: "Asia/Jakarta", // opsional
  }).formatToParts(new Date(date));

  const get = (t: Intl.DateTimeFormatPart["type"]) =>
    parts.find((p) => p.type === t)?.value ?? "";

  const day = get("day");
  const month = get("month");
  const year = get("year");
  const hour = get("hour");
  const minute = get("minute");
  const dayPeriod = (get("dayPeriod") || "").toUpperCase(); // AM/PM

  // rakit manual: dd/mm/yyyy spasi hh.mm AM/PM (tanpa koma)
  return `${month}/${day}/${year} ${hour}:${minute}${dayPeriod ? " " + dayPeriod : ""}`;
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

  const [showEditModal, setShowEditModal] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editInfo, setEditInfo] = useState("");
  const [editAllDay, setEditAllDay] = useState(false);
  const [editStart, setEditStart] = useState<Date | string>(new Date());
  const [editEnd, setEditEnd] = useState<Date | string>(new Date());

  const { data: surveyPogressData } = useQuery<{
    getAllSubSurveyProgress: SubSurveyProgress[];
  }>(GET_REAL_ALL_SUB_SURVEY_PROGRESS);

  const surveyNameOptions = useMemo(() => {
    const names = [
      ...new Set(
        (surveyPogressData?.getAllSubSurveyProgress ?? [])
          .map((it) => it.name)
          .filter(Boolean)
      ),
    ];
    return names.map((name) => ({ value: String(name), label: String(name) }));
  }, [surveyPogressData]);

  const { data: monthlyStats } = useQuery(GET_MONTHLY_DASHBOARD_STATS);

  const { data: userProgressData } = useQuery<{
    allUserSurveyProgress: UserProgress[];
  }>(GET_REAL_ALL_USER_PROGRESS);

  const aggregatedUserProgress = useMemo(() => {
    const rows = userProgressData?.allUserSurveyProgress ?? [];

    const filtered = selectedSubSurveyId
      ? rows.filter((r) => r.subSurveyActivity.id === selectedSubSurveyId)
      : rows;

    type Agg = {
      key: string; // userId__ssaId
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
          submitCount: r.submitCount+r.approvedCount+r.rejectedCount,
          approvedCount: r.approvedCount,
          rejectedCount: r.rejectedCount,
          lastUpdated: r.lastUpdated,
        });
      } else {
        // jika ada multi baris (mis. beda blok) untuk kegiatan yang sama → jumlahkan
        prev.totalAssigned += r.totalAssigned;
        prev.submitCount += r.submitCount+r.approvedCount+r.rejectedCount;
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
  }, [userProgressData, selectedSubSurveyId]);

  const subSurveyIdOptions = useMemo(() => {
    const list = userProgressData?.allUserSurveyProgress ?? [];
    const map = new Map<string, string>();
    for (const it of list) {
      map.set(it.subSurveyActivity.id, it.subSurveyActivity.name);
    }
    return Array.from(map.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [userProgressData]);

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

  // Buka modal dan isi form dengan data event terpilih
  function openEdit(ev: CalendarEvent) {
    setEditEvent(ev);
    setEditTitle(ev.title || "");
    setEditInfo(ev.info || "");
    setEditAllDay(!!ev.allDay);
    setEditStart(ev.start);
    setEditEnd(ev.end);
    setShowEditModal(true);
  }

  function closeEdit() {
    setShowEditModal(false);
    setEditEvent(null);
  }

  // Submit PUT ke /api/cals/:id sesuai signature kamu
  async function handleUpdate(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!editEvent || !("_id" in editEvent) || !editEvent._id) return;

    try {
      const payload = {
        newTitle: editTitle,
        newStart:
          editStart instanceof Date
            ? editStart.toISOString()
            : new Date(editStart).toISOString(),
        newEnd:
          editEnd instanceof Date
            ? editEnd.toISOString()
            : new Date(editEnd).toISOString(),
        newAllDay: editAllDay,
        newInfo: editInfo,
        // aku mapping ke "id" existing sebagai eveId (kalau kamu punya field lain, tinggal ganti di sini)
        newEveId: editEvent.id,
      };

      const res = await axios.put(
        `../../../../api/cals/${editEvent._id}`,
        payload,
        {
          headers: { "Cache-Control": "no-store" },
        }
      );

      if (res.status === 200) {
        // update state lokal biar tabel langsung refresh
        setEvents((prev) =>
          prev.map((it) =>
            it._id === editEvent._id
              ? {
                  ...it,
                  title: editTitle,
                  start: payload.newStart,
                  end: payload.newEnd,
                  allDay: editAllDay,
                  info: editInfo,
                }
              : it
          )
        );
        closeEdit();
      } else {
        throw new Error("Gagal update jadwal");
      }
    } catch (err) {
      console.error("Error update:", err);
      // boleh tambahkan toast kalau kamu pakai lib toast
    }
  }

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
                  <td
                    colSpan={4}
                    className="px-6 py-6 text-center text-gray-500"
                  >
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
                list.sort((a, b) => +new Date(a.start) - +new Date(b.start));
                const minimized = isMinimized[surveyEvent] ?? false;
                return (
                  <React.Fragment key={surveyEvent}>
                    <tr className="bg-gray-100 border-y border-gray-300">
                      <td
                        colSpan={3}
                        className="px-6 py-2 font-bold text-gray-800"
                      >
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
                      {minimized || isCloseTable
                        ? null
                        : list.map((event) => (
                            <tr
                              key={event.id}
                              className="bg-white border-b border-gray-200 align-top"
                            >
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
                                  {new Date(event.start).toLocaleDateString(
                                    "id-ID",
                                    {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    }
                                  )}{" "}
                                  -{" "}
                                  {new Date(event.end).toLocaleDateString(
                                    "id-ID",
                                    {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    }
                                  )}
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
                                <button
                                  onClick={() => openEdit(event)}
                                  className="font-medium text-blue-600 hover:underline"
                                >
                                  Edit
                                </button>
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
                        <p className="font-medium text-gray-900">
                          {event.title}
                        </p>
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
                          <p className="text-sm text-gray-600 mt-1">
                            {event.info}
                          </p>
                        )}
                        <div className="pt-2">
                          <button
                            onClick={() => openEdit(event)}
                            className="text-blue-600 text-sm font-medium"
                          >
                            Edit
                          </button>
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
          <h2>PROGRES PENDATAAN</h2>
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
        </div>
        <div className="p-4 bg-orange-50 rounded-lg shadow-md">
          <p className="text-sm font-semibold">Kendala Petugas</p>
          <h2 className="font-bold text-2xl">0</h2>
        </div>
        <div className="p-4 bg-orange-50 rounded-lg shadow-md">
          <p className="text-sm font-semibold">Pengumpulan ST</p>
          <h2 className="font-bold text-2xl">
            {monthlyStats?.getMonthlySurveyStats?.totalJobLetters ?? "-"}
          </h2>
        </div>
        <div className="p-4 bg-orange-50 rounded-lg shadow-md">
          <p className="text-sm font-semibold">Pengajuan Honor</p>
          <h2 className="font-bold text-2xl">
            {monthlyStats?.getMonthlySurveyStats?.totalSPJ ?? "-"}
          </h2>
        </div>
      </div>

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
                margin={{ top: 20, right: 20, left: 4, bottom: 8 }}
                barCategoryGap="100%"
                barGap={100}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
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
                <Bar dataKey="rejectedCount" fill="#ef4444" name="Rejected" />
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
                      ((agg.submitCount + agg.approvedCount) /
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
                      title={`Approved: ${pctApproved}%`}
                    />
                  </div>

                  <p className="text-xs text-gray-600">
                    Target: {agg.totalAssigned} sampel, Disubmit:{" "}
                    {agg.submitCount} sampel, Disetujui: {agg.approvedCount}{" "}
                    sampel
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
                      Approved
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* ===== Edit Modal ===== */}
      <Transition.Root show={showEditModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={setShowEditModal}>
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

          <div className="fixed inset-0 z-30 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-visible rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 w-full max-w-md sm:max-w-lg">
                  <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4 rounded-lg">
                    <Dialog.Title
                      as="h3"
                      className="text-base font-semibold leading-6 text-gray-900"
                    >
                      Edit Jadwal
                    </Dialog.Title>

                    <form className="mt-3 space-y-3" onSubmit={handleUpdate}>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Judul
                        </label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="mt-1 block w-full rounded-md border-0 py-1.5 text-gray-900 bg-white shadow-sm ring-1 ring-inset ring-gray-300 focus:outline-none sm:text-sm p-2"
                          placeholder="Judul kegiatan"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Keterangan
                        </label>
                        <textarea
                          value={editInfo}
                          onChange={(e) => setEditInfo(e.target.value)}
                          className="mt-1 block w-full rounded-md border-0 py-1.5 text-gray-900 bg-white shadow-sm ring-1 ring-inset ring-gray-300 focus:outline-none sm:text-sm p-2"
                          placeholder="Catatan / info tambahan"
                        />
                      </div>

                      <div className="items-center gap-2 hidden">
                        <input
                          id="editAllDay"
                          type="checkbox"
                          checked={editAllDay}
                          onChange={(e) => setEditAllDay(e.target.checked)}
                          className="bg-white text-white"
                        />
                        <label
                          htmlFor="editAllDay"
                          className="text-sm text-gray-700"
                        >
                          Sepanjang hari (All day)
                        </label>
                      </div>

                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700">
                          Mulai
                        </label>
                        <Datetime
                          inputProps={{
                            readOnly: true,
                            className:
                              "mt-1 block w-full rounded-md border-0 py-1.5 text-gray-900 bg-white shadow-sm ring-1 ring-inset ring-gray-300 focus:outline-none sm:text-sm p-2",
                            placeholder: "Pilih tanggal & waktu",
                          }}
                          value={formatDateTime(editStart)}
                          onChange={(d) => {
                            if (typeof d === "object" && "toDate" in d)
                              setEditStart(d.toDate());
                            else setEditStart(d as Date | string);
                          }}
                          closeOnSelect
                        />
                      </div>

                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700">
                          Selesai
                        </label>
                        <Datetime
                          inputProps={{
                            readOnly: true,
                            className:
                              "mt-1 block w-full rounded-md border-0 py-1.5 text-gray-900 bg-white shadow-sm ring-1 ring-inset ring-gray-300 focus:outline-none sm:text-sm p-2",
                            placeholder: "Pilih tanggal & waktu",
                          }}
                          value={formatDateTime(editEnd)}
                          onChange={(d) => {
                            if (typeof d === "object" && "toDate" in d)
                              setEditEnd(d.toDate());
                            else setEditEnd(d as Date | string);
                          }}
                          closeOnSelect
                        />
                      </div>

                      <div className="pt-2 sm:flex sm:flex-row-reverse sm:gap-2">
                        <button
                          type="submit"
                          className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:w-auto"
                          disabled={!editEvent}
                        >
                          Simpan
                        </button>
                        <button
                          type="button"
                          onClick={closeEdit}
                          className="mt-2 sm:mt-0 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:w-auto"
                        >
                          Batal
                        </button>
                      </div>
                    </form>
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

export default Dashboard;
