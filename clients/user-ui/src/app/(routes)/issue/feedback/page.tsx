"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { AnimatePresence, motion } from "framer-motion";
import useUser from "@/src/hooks/useUser";
import { CONTENT_ISSUES } from "@/src/graphql/actions/find-all-content-issue.action";
import { ADD_ISSUE_COMMENT } from "@/src/graphql/actions/add-issue-comment.action";
import { UPDATE_ISSUE_COMMENT } from "@/src/graphql/actions/update-issue-comment.action";
import { GET_ALL_OF_SUB_SURVEY_ACTIVITIES } from "@/src/graphql/actions/find-realallsubsurvey.action";
import toast from "react-hot-toast";
import HUComboBox from "@/src/components/HUCombobox";

type IssueComment = {
  id: string;
  message: string;
  createdAt: string;
  user?: { id: string; name: string; email?: string };
};

type IssueItem = {
  id: string;
  content: string;
  issueStatus: string;
  createdAt: string;
  subSurveyActivity?: { id: string; name: string };
  subSurveyActivityId: string;
  reporter?: { id: string; name: string; email?: string };
  IssueComment?: IssueComment[];
};

const ISSUE_STATUS_OPTIONS = [
  { label: "Menunggu", value: "Waiting" },
  { label: "Sedang Diproses", value: "InProgress" },
  { label: "Selesai", value: "Resolved" },
];

type IssueStatusValue = (typeof ISSUE_STATUS_OPTIONS)[number]["value"];
type SubSurveyActivity = { id: string; name: string };

const formatID = (id: string) => `#${id?.slice(0, 6) ?? ""}`;
const fmtDate = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

export default function Issue() {
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [isMinimized, setIsMinimized] = useState<Record<string, boolean>>({});
  const [isCloseTable, setIsCloseTable] = useState(false);
  const [activityId, setActivityId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<IssueStatusValue | "">("");
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState<string>("");

  const { data: subSurveyData } = useQuery(GET_ALL_OF_SUB_SURVEY_ACTIVITIES);

  const { data, loading, refetch } = useQuery(CONTENT_ISSUES, {
    variables: {
      subSurveyActivityId: activityId || null,
      status: statusFilter || null,
      search: searchTerm || null,
      skip: 0,
      take: 100,
    },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const activityOptions = useMemo(
    () =>
      (subSurveyData?.allSubSurveyActivities ?? []).map(
        (sub: { id: string; name: string }) => ({
          value: sub.id,
          label: sub.name ?? "-",
        })
      ),
    [subSurveyData]
  );

  const statusOptions = useMemo(
    () => ISSUE_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    []
  );

  const [addIssueComment, { loading: commenting }] = useMutation(
    ADD_ISSUE_COMMENT,
    {
      refetchQueries: [
        {
          query: CONTENT_ISSUES,
          variables: {
            subSurveyActivityId: null,
            status: null,
            search: null,
            skip: 0,
            take: 100,
          },
        },
      ],
      awaitRefetchQueries: true,
    }
  );

  const [updateIssueComment, { loading: updatingComment }] = useMutation(
    UPDATE_ISSUE_COMMENT,
    {
      refetchQueries: [
        {
          query: CONTENT_ISSUES,
          variables: {
            subSurveyActivityId: null,
            status: null,
            search: null,
            skip: 0,
            take: 100,
          },
        },
      ],
      awaitRefetchQueries: true,
    }
  );

  const [editCommentId, setEditCommentId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  useEffect(() => {
    setEditCommentId(null);
    setEditDraft("");
  }, [openIssueId]);

  const onEditComment = (c: IssueComment) => {
    setEditCommentId(c.id);
    setEditDraft(c.message || "");
  };

  const onCancelEdit = () => {
    setEditCommentId(null);
    setEditDraft("");
  };

  const onSubmitEdit = async (issue: IssueItem) => {
    if (!editCommentId) return;
    if (!editDraft.trim()) {
      toast.error("Komentar tidak boleh kosong");
      return;
    }
    await updateIssueComment({
      variables: { input: { id: editCommentId, message: editDraft.trim() } },
    });
    toast.success("Komentar diperbarui");
    setEditCommentId(null);
    setEditDraft("");
    await refetch();
  };

  const issues: IssueItem[] = useMemo(() => data?.contentIssues ?? [], [data]);

  const filteredIssues = useMemo(() => {
    if (!searchTerm) return issues;
    const q = searchTerm.toLowerCase();
    return issues.filter((it) => {
      const inContent = it.content?.toLowerCase().includes(q);
      const inStatus = it.issueStatus?.toLowerCase().includes(q);
      const inActivity = it.subSurveyActivity?.name?.toLowerCase().includes(q);
      const inReporter = it.reporter?.name?.toLowerCase().includes(q);
      const inComments =
        it.IssueComment?.some(
          (c) =>
            c.message?.toLowerCase().includes(q) ||
            c.user?.name?.toLowerCase().includes(q)
        ) ?? false;
      return inContent || inStatus || inActivity || inReporter || inComments;
    });
  }, [issues, searchTerm]);

  const grouped = useMemo(() => {
    const groups: Record<string, IssueItem[]> = {};
    for (const it of filteredIssues) {
      const key = it.subSurveyActivity?.name || "Tanpa Kegiatan";
      if (!groups[key]) groups[key] = [];
      groups[key].push(it);
    }
    Object.values(groups).forEach((arr) =>
      arr.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    );
    return groups;
  }, [filteredIssues]);

  const groupedEntries = useMemo(() => Object.entries(grouped), [grouped]);

  const toggleTable = (key: string) =>
    setIsMinimized((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleAllTables = (close: boolean) => setIsCloseTable(close);

  const onToggleCommentPanel = (issueId: string) => {
    setCommentDraft("");
    setOpenIssueId((prev) => (prev === issueId ? null : issueId));
  };

  const handleSubmitCommentInline = async (issue: IssueItem) => {
    if (!commentDraft.trim()) return;
    await addIssueComment({
      variables: {
        input: {
          contentId: issue.id,
          message: commentDraft.trim(),
          subSurveyActivityId: issue.subSurveyActivityId,
          userId: user?.id,
        },
      },
    });
    setCommentDraft("");
    await refetch();
  };

  /* =================== UI =================== */
  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-6 md:px-8 py-4 space-y-4 font-Poppins">
      {/* Header */}
      <div className="bg-orange-50 rounded-lg p-3 md:p-4 font-bold text-lg md:text-xl shadow-md">
        Feedback
      </div>

      {/* Filter ringkas */}
      <div className="bg-white rounded-lg p-3 shadow space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">
              Kegiatan Survei
            </label>
            <HUComboBox
              value={activityId || null}
              onValueChange={(v) => setActivityId((v ?? "") as string)}
              options={activityOptions}
              placeholder="Pilih Kegiatan"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Status Kendala
            </label>
            <HUComboBox
              value={statusFilter || null}
              onValueChange={(v) =>
                setStatusFilter((v ?? "") as IssueStatusValue | "")
              }
              options={statusOptions}
              placeholder="Pilih Status"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Pencarian</label>
            <input
              type="text"
              placeholder="Cari isu/komentar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border focus:outline-none border-gray-300 bg-white rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* ====== DESKTOP (tabel) ====== */}
      <div className="hidden sm:block relative shadow-md rounded-lg overflow-hidden">
        <table className="table-fixed min-w-[900px] w-full text-sm text-left text-gray-600">
          <thead className="text-gray-700 bg-gray-200">
            <tr>
              <th className="px-6 py-3 uppercase">Kegiatan Survei</th>
              <th className="px-6 py-3 uppercase">Tanggal Laporan</th>
              <th className="px-6 py-3 uppercase">Keterangan</th>
              <th className="px-6 py-3 uppercase text-right">Aksi</th>
            </tr>
          </thead>

          <tbody className="bg-white">
            {loading ? (
              <tr>
                <td className="px-6 py-4" colSpan={4}>
                  Memuat data…
                </td>
              </tr>
            ) : groupedEntries.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-6 text-center text-gray-500">
                  {searchTerm || activityId || statusFilter
                    ? "Tidak ada isu yang cocok dengan filter/pencarian saat ini."
                    : "Belum ada isu/kendala yang dilaporkan."}
                </td>
              </tr>
            ) : (
              groupedEntries.map(([activityName, items]) => {
                const minimized = isMinimized[activityName] ?? false;
                return (
                  <React.Fragment key={activityName}>
                    {/* Header Group */}
                    <tr className="bg-gray-100 border-y border-gray-300">
                      <td
                        colSpan={3}
                        className="px-6 py-2 font-bold text-gray-800"
                      >
                        {activityName}
                      </td>
                      <td className="px-6 py-2">
                        <div className="flex justify-end">
                          <button
                            onClick={() => toggleTable(activityName)}
                            className="inline-flex items-center px-2 py-1 rounded-md border text-sm"
                            title={minimized || isCloseTable ? "Buka" : "Tutup"}
                          >
                            {minimized || isCloseTable ? "Buka" : "Tutup"}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Rows */}
                    <AnimatePresence>
                      {minimized || isCloseTable
                        ? null
                        : items.map((it) => {
                            const opened = openIssueId === it.id;
                            return (
                              <React.Fragment key={it.id}>
                                <tr className="border-b border-gray-200 align-top">
                                  {/* Kegiatan Survei (isi kendala) */}
                                  <td className="px-6 py-3 font-medium text-gray-900 whitespace-pre-wrap">
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.1 }}
                                    >
                                      <div className="text-gray-800">
                                        {it.content || "(tanpa isi)"}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1">
                                        {formatID(it.id)} • Pelapor:{" "}
                                        {it.reporter?.name || "-"}
                                      </div>
                                    </motion.div>
                                  </td>

                                  {/* Tanggal */}
                                  <td className="px-6 py-3 align-top">
                                    {fmtDate(it.createdAt)}
                                  </td>

                                  {/* Keterangan */}
                                  <td className="px-6 py-3 align-top">
                                    <div className="space-y-2">
                                      <div className="inline-flex items-center gap-2">
                                        <span className="text-xs font-semibold text-gray-600">
                                          Status:
                                        </span>
                                        <span
                                          className={[
                                            "px-2 py-0.5 rounded-md text-xs font-bold",
                                            it.issueStatus === "Resolved"
                                              ? "bg-green-100 text-green-700"
                                              : it.issueStatus === "InProgress"
                                                ? "bg-yellow-100 text-yellow-700"
                                                : "bg-gray-100 text-gray-700",
                                          ].join(" ")}
                                        >
                                          {it.issueStatus === "Waiting"
                                            ? "Menunggu"
                                            : it.issueStatus === "InProgress"
                                              ? "Sedang Diproses"
                                              : it.issueStatus === "Resolved"
                                                ? "Selesai"
                                                : it.issueStatus || "-"}
                                        </span>
                                      </div>
                                      <div className="text-xs text-gray-600">
                                        Komentar:{" "}
                                        <span className="font-semibold">
                                          {it.IssueComment?.length ?? 0}
                                        </span>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Aksi */}
                                  <td className="px-6 py-3 text-right align-top">
                                    <button
                                      onClick={() =>
                                        onToggleCommentPanel(it.id)
                                      }
                                      className="font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded text-sm"
                                    >
                                      {opened ? "Tutup" : "Masukkan Komentar"}
                                    </button>
                                  </td>
                                </tr>

                                {/* Panel Komentar + Form (inline) */}
                                {openIssueId === it.id && (
                                  <tr>
                                    <td colSpan={4} className="px-6 pt-2 pb-4">
                                      <div className="rounded-md border border-gray-200 p-4 bg-gray-50">
                                        {/* Komentar terkait (editable) */}
                                        <ul className="space-y-2">
                                          {(it.IssueComment ?? []).map((c) => (
                                            <li
                                              key={c.id}
                                              className="text-sm bg-slate-200 rounded-md text-gray-700 p-2"
                                            >
                                              {editCommentId === c.id ? (
                                                <div className="border rounded-md p-2 bg-white">
                                                  <textarea
                                                    value={editDraft}
                                                    onChange={(e) =>
                                                      setEditDraft(
                                                        e.target.value
                                                      )
                                                    }
                                                    className="w-full border px-3 py-2 rounded bg-white min-h-[80px]"
                                                    placeholder="Perbarui komentar…"
                                                  />
                                                  <div className="flex gap-2 justify-end mt-2">
                                                    <button
                                                      onClick={() =>
                                                        onSubmitEdit(it)
                                                      }
                                                      disabled={
                                                        updatingComment ||
                                                        !editDraft.trim()
                                                      }
                                                      className="bg-blue-600 text-white px-3 py-1.5 rounded disabled:opacity-60"
                                                    >
                                                      {updatingComment
                                                        ? "Menyimpan..."
                                                        : "Simpan"}
                                                    </button>
                                                    <button
                                                      onClick={onCancelEdit}
                                                      className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded"
                                                    >
                                                      Batal
                                                    </button>
                                                  </div>
                                                </div>
                                              ) : (
                                                <div className="flex items-start justify-between gap-2">
                                                  <div>
                                                    <span
                                                      className={`font-semibold ${c.user?.id === user?.id && "text-blue-600"}`}
                                                    >
                                                      {c.user?.name ?? "Anon"}:
                                                    </span>{" "}
                                                    {c.message}{" "}
                                                    <span className="text-xs text-gray-400">
                                                      ({fmtDate(c.createdAt)})
                                                    </span>
                                                  </div>
                                                  {c.user?.id === user?.id && (
                                                    <button
                                                      onClick={() =>
                                                        onEditComment(c)
                                                      }
                                                      className="text-blue-600 hover:underline whitespace-nowrap"
                                                    >
                                                      Ubah
                                                    </button>
                                                  )}
                                                </div>
                                              )}
                                            </li>
                                          ))}
                                          {(it.IssueComment ?? []).length ===
                                            0 && (
                                            <li className="text-xs text-gray-400 italic">
                                              Belum ada komentar
                                            </li>
                                          )}
                                        </ul>

                                        {/* Form komentar */}
                                        <div className="space-y-2 pt-4">
                                          <label className="text-sm font-semibold text-gray-700">
                                            Tambah Komentar
                                          </label>
                                          <textarea
                                            value={commentDraft}
                                            onChange={(e) =>
                                              setCommentDraft(e.target.value)
                                            }
                                            placeholder="Tulis komentar..."
                                            className="w-full border px-3 py-2 rounded bg-white min-h-[90px]"
                                          />
                                          <div className="flex justify-end">
                                            <button
                                              onClick={() =>
                                                handleSubmitCommentInline(it)
                                              }
                                              disabled={
                                                commenting ||
                                                !commentDraft.trim()
                                              }
                                              className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-60"
                                            >
                                              {commenting
                                                ? "Mengirim..."
                                                : "Kirim"}
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })
            )}
          </tbody>

          {/* FOOTER: buka/tutup semua */}
          <tfoot>
            <tr className="text-gray-700 bg-gray-200">
              <td colSpan={4} className="px-6 py-2">
                <div className="flex justify-end items-center">
                  {isCloseTable ? (
                    <button
                      onClick={() => toggleAllTables(false)}
                      className="flex items-center px-3 py-1.5 rounded-md bg-gray-900 text-white"
                    >
                      Buka Semua
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleAllTables(true)}
                      className="flex items-center px-3 py-1.5 rounded-md bg-gray-900 text-white"
                    >
                      Tutup Semua
                    </button>
                  )}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ====== MOBILE (kartu per kegiatan & isu) ====== */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <div className="bg-white rounded-lg p-3 shadow text-center">
            Memuat data…
          </div>
        ) : groupedEntries.length === 0 ? (
          <div className="bg-white rounded-lg p-3 shadow text-center text-gray-500">
            {searchTerm || activityId || statusFilter
              ? "Tidak ada isu yang cocok dengan filter/pencarian saat ini."
              : "Belum ada isu/kendala yang dilaporkan."}
          </div>
        ) : (
          groupedEntries.map(([activityName, items]) => {
            const minimized = isMinimized[activityName] ?? false;
            return (
              <div key={activityName} className="bg-white rounded-lg shadow">
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <h3 className="font-semibold">{activityName}</h3>
                  <button
                    onClick={() => toggleTable(activityName)}
                    className="inline-flex items-center px-2 py-1 rounded-md border text-sm"
                  >
                    {minimized ? "Buka" : "Tutup"}
                  </button>
                </div>

                <AnimatePresence>
                  {minimized || isCloseTable ? null : (
                    <motion.ul
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="divide-y"
                    >
                      {items.map((it) => {
                        const opened = openIssueId === it.id;
                        return (
                          <li key={it.id} className="p-3">
                            <p className="font-medium text-gray-900 whitespace-pre-wrap">
                              {it.content || "(tanpa isi)"}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              {formatID(it.id)} • Pelapor:{" "}
                              {it.reporter?.name || "-"} •{" "}
                              {fmtDate(it.createdAt)}
                            </p>
                            <div className="mt-2 flex items-center justify-between">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  it.issueStatus === "Resolved"
                                    ? "bg-green-100 text-green-700"
                                    : it.issueStatus === "InProgress"
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {it.issueStatus === "Waiting"
                                  ? "Menunggu"
                                  : it.issueStatus === "InProgress"
                                    ? "Sedang Diproses"
                                    : it.issueStatus === "Resolved"
                                      ? "Selesai"
                                      : it.issueStatus || "-"}
                              </span>
                              <button
                                onClick={() => onToggleCommentPanel(it.id)}
                                className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded"
                              >
                                {opened ? "Tutup" : "Komentar"}
                              </button>
                            </div>

                            {/* Komentar + Form */}
                            <AnimatePresence>
                              {opened && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                  className="rounded-md border border-gray-200 p-3 bg-gray-50 mt-3"
                                >
                                  <div className="text-sm font-semibold text-gray-600 mb-2">
                                    Komentar ({it.IssueComment?.length ?? 0})
                                  </div>

                                  <ul className="space-y-2">
                                    {(it.IssueComment ?? []).map((c) => (
                                      <li
                                        key={c.id}
                                        className="text-sm bg-slate-200 rounded-md text-gray-700 p-2"
                                      >
                                        {editCommentId === c.id ? (
                                          <div className="border rounded-md p-2 bg-white">
                                            <textarea
                                              value={editDraft}
                                              onChange={(e) =>
                                                setEditDraft(e.target.value)
                                              }
                                              className="w-full border px-3 py-2 rounded bg-white min-h-[80px]"
                                              placeholder="Perbarui komentar…"
                                            />
                                            <div className="flex gap-2 justify-end mt-2">
                                              <button
                                                onClick={() => onSubmitEdit(it)}
                                                disabled={
                                                  updatingComment ||
                                                  !editDraft.trim()
                                                }
                                                className="bg-blue-600 text-white px-3 py-1.5 rounded disabled:opacity-60"
                                              >
                                                {updatingComment
                                                  ? "Menyimpan..."
                                                  : "Simpan"}
                                              </button>
                                              <button
                                                onClick={onCancelEdit}
                                                className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded"
                                              >
                                                Batal
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex items-start justify-between gap-2">
                                            <div>
                                              <span
                                                className={`font-semibold ${c.user?.id === user?.id && "text-blue-600"}`}
                                              >
                                                {c.user?.name ?? "Anon"}:
                                              </span>{" "}
                                              {c.message}{" "}
                                              <span className="text-xs text-gray-400">
                                                ({fmtDate(c.createdAt)})
                                              </span>
                                            </div>
                                            {c.user?.id === user?.id && (
                                              <button
                                                onClick={() => onEditComment(c)}
                                                className="text-blue-600 hover:underline whitespace-nowrap"
                                              >
                                                Ubah
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </li>
                                    ))}

                                    {(it.IssueComment ?? []).length === 0 && (
                                      <li className="text-xs text-gray-400 italic">
                                        Belum ada komentar
                                      </li>
                                    )}
                                  </ul>

                                  {/* Form komentar */}
                                  <div className="space-y-2 pt-3">
                                    <label className="text-sm font-semibold text-gray-700">
                                      Tambah Komentar
                                    </label>
                                    <textarea
                                      value={commentDraft}
                                      onChange={(e) =>
                                        setCommentDraft(e.target.value)
                                      }
                                      placeholder="Tulis komentar..."
                                      className="w-full border px-3 py-2 rounded bg-white min-h-[90px]"
                                    />
                                    <div className="flex justify-end">
                                      <button
                                        onClick={() =>
                                          handleSubmitCommentInline(it)
                                        }
                                        disabled={
                                          commenting || !commentDraft.trim()
                                        }
                                        className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-60"
                                      >
                                        {commenting ? "Mengirim..." : "Kirim"}
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </li>
                        );
                      })}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
