"use client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import { Fragment, SyntheticEvent, useState, useEffect, useRef } from "react";
import { Dialog, Transition } from "@headlessui/react";
import axios from "axios";
import Datetime from "react-datetime";
import "react-datetime/css/react-datetime.css";
import { AnimatePresence, motion } from "framer-motion";
import { GET_REAL_ALL_SUB_SURVEY_PROGRESS } from "@/src/graphql/actions/get-allsubsurveyprogress.action";
import { useQuery } from "@apollo/client";

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
  }).formatToParts(new Date(date));

  const get = (t: Intl.DateTimeFormatPart["type"]) =>
    parts.find(p => p.type === t)?.value ?? "";

  const day = get("day");
  const month = get("month");
  const year = get("year");
  const hour = get("hour");
  const minute = get("minute");
  const dayPeriod = (get("dayPeriod") || "").toUpperCase();

  return `${month}/${day}/${year} ${hour}:${minute}${dayPeriod ? " " + dayPeriod : ""}`;
}

export default function Calendar() {
  const [showCalendar, setShowCalendar] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [titleToDelete, setTitleToDelete] = useState("");
  const [newEvent, setNewEvent] = useState<CalendarEvent>({
    title: "",
    start: "",
    end: "",
    allDay: false,
    id: "",
    info: "",
    surveyEvent: "",
  });

  const calendarRef = useRef<any>(null);
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const years = Array.from(
    { length: 10 },
    (_, i) => new Date().getFullYear() - 5 + i
  );

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

  const { data: surveyPogressData } = useQuery<{
    getAllSubSurveyProgress: SubSurveyProgress[];
  }>(GET_REAL_ALL_SUB_SURVEY_PROGRESS);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  function handleDateChange(month: number | null, year: number | null) {
    const newMonth = month !== null ? month : selectedMonth;
    const newYear = year !== null ? year : selectedYear;
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
    const newDate = new Date(newYear, newMonth, 1);
    const calendarApi = calendarRef.current?.getApi();
    calendarApi?.gotoDate(newDate);
  }

  const [title, setTitle] = useState("");
  const [start, setStart] = useState<Date | string>(new Date());
  const [end, setEnd] = useState<Date | string>(new Date());
  const [allDay, setAllDay] = useState(false);
  const [id, setId] = useState("");
  const [info, setInfo] = useState("");
  const [surveyEvent, setSurveyEvent] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);

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

  useEffect(() => {
    fetchEvents();
  }, []);

  function handleDateRangeSelect(arg: {
    start: Date;
    end: Date;
    allDay: boolean;
  }) {
    const newId = String(new Date().getTime());
    setNewEvent({
      title: "",
      start: arg.start,
      end: arg.end,
      allDay: arg.allDay,
      info: "",
      surveyEvent: "",
      id: newId,
    });
    setStart(arg.start);
    setEnd(arg.end);
    setAllDay(arg.allDay);
    setId(newId);
    setTitle("");
    setInfo("");
    setSurveyEvent("");
    setShowModal(true);
  }

  function handleDeleteModal(data: { event: { id: string; title: string } }) {
    setShowDeleteModal(true);
    setIdToDelete(data.event.id);
    setTitleToDelete(data.event.title);
  }

  async function handleDeleteEvent() {
    if (!idToDelete) return;
    const eventToDelete = events.find((event) => event.id === idToDelete);
    if (!eventToDelete || !eventToDelete._id) {
      setShowDeleteModal(false);
      setIdToDelete(null);
      return;
    }
    try {
      const res = await axios.delete(`../api/cals?id=${eventToDelete._id}`, {
        headers: { "Cache-Control": "no-store" },
      });
      if (res.status === 200) {
        setEvents((prev) => prev.filter((event) => event.id !== idToDelete));
        const calendarApi = calendarRef.current?.getApi();
        const eventObj = calendarApi.getEventById(idToDelete);
        if (eventObj) eventObj.remove();
      } else {
        throw new Error("Gagal menghapus jadwal");
      }
    } catch (error) {
      console.error("Error deleting event:", error);
    } finally {
      setShowDeleteModal(false);
      setIdToDelete(null);
    }
  }

  function handleCloseModal() {
    setShowModal(false);
    setNewEvent({
      title: "",
      start: "",
      end: "",
      allDay: false,
      info: "",
      id: "",
      surveyEvent: "",
    });
    setShowDeleteModal(false);
    setIdToDelete(null);
  }

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ): void => {
    const { name, value } = e.target;
    setNewEvent((prev) => ({ ...prev, [name]: value }));
    if (name === "info") setInfo(value);
    if (name === "title") setTitle(value);
    if (name === "surveyEvent") setSurveyEvent(value);
  };

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    try {
      const eventData = { title, start, end, allDay, info, surveyEvent, id };
      const res = await axios.post("../../../../api/cals", eventData, {
        headers: { "Cache-Control": "no-store" },
      });
      if (res.status === 201) {
        const dbId = res.data._id;
        const newEventWithId: CalendarEvent = {
          title,
          start,
          end,
          allDay,
          info,
          surveyEvent,
          id,
          _id: dbId,
        };
        setEvents((prev) => [...prev, newEventWithId]);
        const calendarApi = calendarRef.current?.getApi();
        calendarApi.addEvent({
          id,
          title,
          start,
          end,
          allDay,
          extendedProps: { info, surveyEvent, _id: dbId },
        });
      } else {
        throw new Error("Gagal membuat jadwal");
      }
    } catch (error) {
      console.error("Error creating event:", error);
    } finally {
      setShowModal(false);
      setNewEvent({
        title: "",
        start: "",
        end: "",
        allDay: false,
        info: "",
        id: "",
        surveyEvent: "",
      });
      fetchEvents();
    }
  }

  const toggleCalendar = () => setShowCalendar(!showCalendar);

  return (
    <>
      <button
        onClick={toggleCalendar}
        className="flex items-center justify-center text-white hover:text-gray-200 mr-2 sm:mr-4"
        aria-label="Buka kalender"
        title="Kalender"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 sm:h-7 sm:w-7"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </button>

      <AnimatePresence>
        {showCalendar && (
          <>
            {/* Backdrop for mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-30 sm:hidden"
              onClick={toggleCalendar}
            />
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ duration: 0.2 }}
              onAnimationComplete={() =>
                calendarRef.current?.getApi?.()?.updateSize?.()
              }
              className="fixed top-14 sm:top-[60px] right-0 w-full sm:w-[600px] lg:w-[700px] h-[calc(100vh-56px)] sm:h-[calc(100vh-60px)] bg-white text-black shadow-lg z-40 overflow-auto"
            >
              <div className="p-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <button
                    onClick={toggleCalendar}
                    className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 w-full sm:w-auto"
                  >
                    Tutup Kalender
                  </button>
                  <div className="flex gap-2">
                    <select
                      onChange={(e) =>
                        handleDateChange(parseInt(e.target.value), null)
                      }
                      className="border rounded p-2 bg-white"
                      defaultValue={new Date().getMonth()}
                    >
                      {months.map((month, idx) => (
                        <option value={idx} key={idx}>
                          {month}
                        </option>
                      ))}
                    </select>
                    <select
                      onChange={(e) =>
                        handleDateChange(null, parseInt(e.target.value))
                      }
                      className="border rounded p-2 bg-white"
                      defaultValue={new Date().getFullYear()}
                    >
                      {years.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4">
                  <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, interactionPlugin, timeGridPlugin]}
                    headerToolbar={{ left: "", center: "", right: "" }}
                    events={events}
                    initialView="dayGridMonth"
                    nowIndicator
                    selectable
                    selectMirror
                    select={handleDateRangeSelect}
                    eventClick={(data) => handleDeleteModal(data)}
                    height="auto"
                    locale={"id"}
                    titleFormat={{ year: "numeric", month: "long" }}
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete modal */}
      <Transition.Root show={showDeleteModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={setShowDeleteModal}>
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
          <div className="fixed inset-0 z-50 overflow-y-auto">
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
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 w-full max-w-md sm:max-w-lg">
                  <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                    <Dialog.Title
                      as="h3"
                      className="text-base font-semibold leading-6 text-gray-900"
                    >
                      Hapus jadwal
                    </Dialog.Title>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Anda ingin menghapus jadwal &quot;{titleToDelete}&quot;?
                      </p>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                    <button
                      type="button"
                      className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto"
                      onClick={handleDeleteEvent}
                    >
                      Hapus
                    </button>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                      onClick={handleCloseModal}
                    >
                      Batal
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Create modal */}
      <Transition.Root show={showModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={setShowModal}>
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
          <div className="fixed inset-0 z-50 overflow-y-auto">
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
                <Dialog.Panel className="relative transform overflow-visible rounded-lg bg-white px-4 pb-4 pt-2 text-left shadow-xl transition-all sm:my-8 w-full max-w-md sm:max-w-lg sm:p-6">
                  <div className="text-center rounded-lg">
                    <Dialog.Title
                      as="h3"
                      className="text-base font-semibold leading-6 text-gray-900"
                    >
                      Tambah jadwal
                    </Dialog.Title>
                    <form action="submit" onSubmit={handleSubmit}>
                      <div className="mt-2">
                        <input
                          type="text"
                          name="title"
                          value={title}
                          onChange={handleChange}
                          className="block w-full rounded-md border-0 py-1.5 text-gray-900 bg-white shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:outline-none sm:text-sm p-2"
                          placeholder="Title"
                        />
                      </div>
                      <div className="mt-2">
                        <textarea
                          name="info"
                          value={info}
                          onChange={handleChange}
                          className="block w-full rounded-md border-0 py-1.5 text-gray-900 bg-white shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:outline-none sm:text-sm p-2"
                          placeholder="Info"
                        />
                      </div>
                      <div className="mt-2">
                        <select
                          name="surveyEvent"
                          value={surveyEvent}
                          onChange={handleChange}
                          className="w-full border p-2 rounded-md bg-white shadow-sm text-sm"
                        >
                          <option value="">Pilih Kegiatan Survei</option>
                          {[
                            ...new Set(
                              surveyPogressData?.getAllSubSurveyProgress.map(
                                (item: SubSurveyProgress) => item.name
                              ) ?? []
                            ),
                          ].map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <input
                          type="text"
                          readOnly
                          value={formatDateTime(start)}
                          className="mt-4 block w-full rounded-md border-0 py-1.5 text-gray-900 bg-white shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:outline-none sm:text-sm p-2"
                        />
                      </div>
                      <div
                        className="justify-center space-y-2 mt-4"
                      >
                        <label className="text-black">
                          Tentukan rentang waktu
                        </label>
                        <Datetime
                          inputProps={{
                            readOnly: true,
                            className:
                              "relative mt-1 block w-full rounded-md border-0 py-1.5 text-gray-900 bg-white shadow-sm ring-1 ring-inset ring-gray-300 focus:outline-none sm:text-sm p-2",
                            placeholder: "Pilih tanggal & waktu",
                          }}
                          closeOnSelect
                          value={end}
                          onChange={(date) => {
                            if (typeof date === "object" && "toDate" in date)
                              setEnd(date.toDate());
                            else setEnd(date as Date | string);
                          }}
                        />
                      </div>
                      <div className="mt-5 sm:mt-6 grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                        <button
                          type="submit"
                          className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2 disabled:opacity-40"
                          disabled={title === "" || surveyEvent === ""}
                        >
                          Buat
                        </button>
                        <button
                          type="button"
                          className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
                          onClick={handleCloseModal}
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
    </>
  );
}
