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
  type User = {
    id: string;
    name: string;
    email: string;
    password: string;
    role: string;
    address: string;
    phone_number: string;
    updatedAt: string;
  };

  type SubSurveyActivity = {
    id: string;
    name: string;
    slug: string;
    surveyActivityId: string;
    startDate: string;
    endDate: string;
    targetSample: number;
  };

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
    user: {
      id: string;
      name: string;
    };
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
      ])
    ),
  ];

  const toggleTable = (index: string) => {
    setIsMinimized((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const toggleAllTables = (close: boolean) => {
    const newState: Record<string, boolean> = {};
    Object.keys(
      filteredEvents.reduce<Record<string, CalendarEvent[]>>(
        (groups, event) => {
          const key = event.surveyEvent;
          if (!groups[key]) groups[key] = [];
          groups[key].push(event);
          return groups;
        },
        {}
      )
    ).forEach((key) => {
      newState[key] = close;
    });

    setIsMinimized(newState);
  };

  const fetchEvents = async () => {
    try {
      const res = await axios.get("../../../../api/cals", {
        headers: { "Cache-Control": "no-store" },
      });

      if (res.status !== 200) {
        throw new Error("Gagal terhubung ke database");
      }

      // Convert numeric ids to strings for FullCalendar compatibility
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
    const isTitleMatch = event.title
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const isThisSurvey = event.surveyEvent
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const isInfoMatch = event.info
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    return isTitleMatch || isThisSurvey || isInfoMatch;
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

  useEffect(() => {
    const groupedEvents = filteredEvents.reduce<
      Record<string, CalendarEvent[]>
    >((groups, event) => {
      const key = event.surveyEvent;
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
      return groups;
    }, {});

    const allClosed = Object.keys(groupedEvents).every(
      (surveyEvent) => isMinimized[surveyEvent] === true
    );

    setIsCloseTable(allClosed);
  }, [isMinimized, filteredEvents]);

  useEffect(() => {
    fetchEvents();
  }, []);

  return (
    <div className="px-8 py-4 space-y-4 font-Poppins">
      <div className="bg-orange-50 rounded-lg p-2 font-bold text-xl flex justify-between shadow-md">
        Beranda
        <button
          onClick={fetchEvents}
          className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm hover:bg-blue-700 transition font-semibold"
        >
          Refresh
        </button>
      </div>
      <div className="relative shadow-md">
        <table className="table-fixed w-full text-sm text-left text-gray-500">
          <thead className="text-gray-700 bg-gray-200 block w-full sm:rounded-t-lg">
            <tr className="table w-full table-fixed">
              <th scope="col" className="px-6 py-3 uppercase">
                Kegiatan Survei
              </th>
              <th scope="col" className="px-6 py-3 uppercase">
                <div className="flex items-center">Jadwal Kegiatan</div>
              </th>
              <th scope="col" className="px-6 py-3 uppercase">
                <div className="flex items-center">Keterangan</div>
              </th>
              <th scope="col" className="px-6 py-3">
                <div className="flex items-center">
                  <input
                    type="text"
                    placeholder="Cari kegiatan..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border focus:outline-none border-gray-300 bg-white rounded-md px-3 py-1 text-sm font-thin w-full"
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="block max-h-96 overflow-y-auto w-full">
            {/* Empty state: tidak ada data / hasil pencarian */}
            {groupedEntries.length === 0 ? (
              <tr className="table w-full">
                <td colSpan={4} className="px-6 py-6 text-center text-gray-500">
                  {searchTerm ? (
                    <>
                      Tidak ada kegiatan yang cocok untuk "
                      <span className="font-semibold">{searchTerm}</span>"
                    </>
                  ) : (
                    "Belum ada jadwal kegiatan."
                  )}
                </td>
              </tr>
            ) : null}

            {groupedEntries.map(([surveyEvent, events]) => {
              events.sort(
                (a, b) =>
                  new Date(a.start).getTime() - new Date(b.start).getTime()
              );
              const minimized = isMinimized[surveyEvent] ?? false;
              return (
                <React.Fragment key={surveyEvent}>
                  <tr className="bg-gray-100 border-b border-gray-300 table w-full table-fixed">
                    <td
                      colSpan={3}
                      className="px-6 py-2 font-bold text-gray-800"
                    >
                      {surveyEvent}
                    </td>
                    <td className="px-6 py-2 text-gray-600">
                      <div className="flex justify-end">
                        <button onClick={() => toggleTable(surveyEvent)}>
                          {minimized || isCloseTable ? (
                            <ChevronUp size={16} className="mt-1" />
                          ) : (
                            <ChevronDown size={16} className="mt-1" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                  <AnimatePresence>
                    {minimized || isCloseTable
                      ? null
                      : events.map((event) => (
                          <tr
                            key={event.id}
                            className="bg-white border-b border-gray-200 table w-full table-fixed"
                          >
                            <td
                              scope="row"
                              className="px-12 py-2 font-medium text-gray-900 whitespace-nowrap"
                            >
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
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.1 }}
                              >
                                <a
                                  href="#"
                                  className="font-medium text-blue-600 hover:underline"
                                >
                                  Edit
                                </a>
                              </motion.div>
                            </td>
                          </tr>
                        ))}
                  </AnimatePresence>
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot className="block w-full rounded-b-lg">
            <tr className="text-gray-700 bg-gray-200 table w-full table-fixed">
              <td colSpan={4} className="px-6 py-2">
                <div className="flex justify-end items-center">
                  {isCloseTable ? (
                    <button
                      onClick={() => toggleAllTables(false)}
                      className="flex items-center px-2 bg-gray-900 rounded-md border-gray-900 border-2"
                    >
                      <p className="text-sm font-bold text-white">
                        Buka Jadwal
                      </p>
                      <div className="pl-1 pb-1">
                        <ChevronDown size={16} className="mt-1 text-white" />
                      </div>
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleAllTables(true)}
                      className="flex items-center px-2 bg-gray-900 rounded-md border-gray-900 border-2"
                    >
                      <p className="text-sm font-bold text-white">
                        Tutup Jadwal
                      </p>
                      <div className="pl-1 pb-1">
                        <ChevronUp size={16} className="mt-1 text-white" />
                      </div>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="space-x-4 flex justify-between items-center">
        <div className="p-2 bg-orange-50 rounded-lg shadow-md font-bold w-full">
          <h2>PROGRES PENDATAAN BULAN INI</h2>
        </div>
        <div className="p-2 bg-orange-50 rounded-lg shadow-md font-bold w-full">
          <h2>PENCAPAIAN PETUGAS</h2>
        </div>
      </div>
      <div className="space-x-4 flex justify-between items-center">
        <div className="p-2 bg-orange-50 rounded-lg shadow-md w-full">
          <p className="text-md font-bold">Petugas Aktif</p>
          <h2 className="font-bold text-2xl">
            {monthlyStats?.getMonthlySurveyStats?.totalActiveUsers ?? "-"}
          </h2>
          <p>Selama sebulan ini</p>
        </div>
        <div className="p-2 bg-orange-50 rounded-lg shadow-md w-full">
          <p className="text-md font-bold">Kendala Petugas</p>
          <h2 className="font-bold text-2xl">0</h2>
          <p>Selama sebulan ini</p>
        </div>
        <div className="p-2 bg-orange-50 rounded-lg shadow-md w-full">
          <p className="text-md font-bold">Pengumpulan ST</p>
          <h2 className="font-bold text-2xl">
            {monthlyStats?.getMonthlySurveyStats?.totalJobLetters ?? "-"}
          </h2>
          <p>Selama sebulan ini</p>
        </div>
        <div className="p-2 bg-orange-50 rounded-lg shadow-md w-full">
          <p className="text-md font-bold">Pengajuan Honor</p>
          <h2 className="font-bold text-2xl">
            {monthlyStats?.getMonthlySurveyStats?.totalSPJ ?? "-"}
          </h2>
          <p>Selama sebulan ini</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* Bagian kiri: Chart + Filter */}
        <div className="bg-orange-50 p-4 rounded-lg shadow-md w-full">
          <div className="mb-4">
            <label className="font-semibold">Filter Kegiatan Survei:</label>
            <br />
            <select
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white mt-2"
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

          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart
                data={filteredProgress}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
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

        {/* Bagian kanan: Pencapaian Petugas */}
        <div className="bg-orange-50 rounded-lg shadow-md p-4 w-full h-fit">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-bold">PENCAPAIAN PETUGAS</h3>
            <select
              className="text-sm px-3 py-1 border rounded-md bg-white focus:outline-none"
              value={selectedSubSurveyId}
              onChange={(e) => setSelectedSubSurveyId(e.target.value)}
            >
              <option value="">Semua Kegiatan</option>
              {subSurveyOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
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
                      <span>{progress.user.name}</span>
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
