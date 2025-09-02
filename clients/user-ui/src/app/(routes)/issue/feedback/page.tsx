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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
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
      subSurveyActivityId: activityId || null, // ✅ filter kegiatan
      status: statusFilter || null, // ✅ filter status
      search: searchTerm || null, // kirim juga pencarian teks
      skip: 0,
      take: 100,
    },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

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

  // Filter pencarian (di content/status/kegiatan/reporter/komentar)
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

  // Group by Kegiatan
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
    // tetap buka panel; data akan ter-refresh dari refetchQueries
    await refetch();
  };

  return (
    <div className="px-8 py-4 space-y-4 font-Poppins">
      <div className="bg-orange-50 rounded-lg p-2 font-bold text-xl flex justify-between shadow-md">
        Feedback
      </div>

      {/* Filter ringkas di atas tabel */}
      <div className="bg-orange-50 rounded-lg p-2 font-bold text-xl shadow-md space-y-5">
        <div>Daftar Kendala & Komentar</div>
        <div className="flex justify-between space-x-14 text-sm">
          <div className="w-full">
            Kegiatan Survei
            <select
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              title="Pilih kegiatan survei"
            >
              <option value="">Semua Kegiatan</option>
              {subSurveyData?.allSubSurveyActivities?.map(
                (sub: SubSurveyActivity) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                )
              )}
            </select>
          </div>
          <div className="w-full">
            Status Kendala
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as IssueStatusValue | "")
              }
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              title="Pilih status issue"
            >
              <option value="">Semua Status</option>
              {ISSUE_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ====== TABEL ====== */}
      <div className="relative shadow-md">
        <table className="table-fixed w-full text-sm text-left text-gray-500">
          <thead className="text-gray-700 bg-gray-200 block w-full sm:rounded-t-lg">
            <tr className="table w-full table-fixed">
              <th scope="col" className="px-6 py-3 uppercase">
                Kegiatan Survei
              </th>
              <th scope="col" className="px-6 py-3 uppercase">
                <div className="flex items-center">Tanggal Laporan</div>
              </th>
              <th scope="col" className="px-6 py-3 uppercase">
                <div className="flex items-center">Keterangan</div>
              </th>
              <th scope="col" className="px-6 py-3">
                <div className="gap-2 items-center">
                  {/* Search teks */}
                  <input
                    type="text"
                    placeholder="Cari isu/komentar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border focus:outline-none border-gray-300 bg-white rounded-md px-3 py-1 text-sm font-thin w-full"
                  />
                </div>
              </th>
            </tr>
          </thead>

          <tbody className="block max-h-96 overflow-y-auto w-full">
            {loading ? (
              <tr className="table w-full table-fixed">
                <td className="px-6 py-4" colSpan={4}>
                  Memuat data…
                </td>
              </tr>
            ) : (
              <>
                {groupedEntries.length === 0 && (
                  <tr className="table w-full table-fixed">
                    <td
                      colSpan={4}
                      className="px-6 py-6 text-center text-gray-500"
                    >
                      {searchTerm || activityId || statusFilter ? (
                        <>
                          Tidak ada isu yang cocok dengan filter/pencarian saat
                          ini.
                        </>
                      ) : (
                        "Belum ada isu/kendala yang dilaporkan."
                      )}
                    </td>
                  </tr>
                )}
                {groupedEntries.map(([activityName, items]) => {
                  const minimized = isMinimized[activityName] ?? false;

                  return (
                    <React.Fragment key={activityName}>
                      {/* Header Group */}
                      <tr className="bg-gray-100 border-b border-gray-300 table w-full table-fixed">
                        <td
                          colSpan={3}
                          className="px-6 py-2 font-bold text-gray-800"
                        >
                          {activityName}
                        </td>
                        <td className="px-6 py-2 text-gray-600">
                          <div className="flex justify-end">
                            <button onClick={() => toggleTable(activityName)}>
                              {minimized || isCloseTable ? (
                                <svg width="16" height="16" viewBox="0 0 24 24">
                                  <path
                                    fill="currentColor"
                                    d="m7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6l-6 6z"
                                  />
                                </svg>
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24">
                                  <path
                                    fill="currentColor"
                                    d="m7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6l-6-6z"
                                  />
                                </svg>
                              )}
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
                                  <tr className="bg-white border-b border-gray-200 table w-full table-fixed">
                                    {/* Kegiatan Survei (isi kendala) */}
                                    <td
                                      scope="row"
                                      className="px-12 py-4 font-medium text-gray-900 whitespace-pre-wrap align-top"
                                    >
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
                                    <td className="px-6 pt-6 align-top">
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.1 }}
                                      >
                                        {fmtDate(it.createdAt)}
                                      </motion.div>
                                    </td>

                                    {/* Keterangan (status & komentar ringkas) */}
                                    <td className="px-6 py-3 align-top">
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.1 }}
                                        className="space-y-2"
                                      >
                                        {/* Status */}
                                        <div className="inline-flex items-center gap-2">
                                          <span className="text-xs font-semibold text-gray-600">
                                            Status:
                                          </span>
                                          <span
                                            className={[
                                              "px-2 py-0.5 rounded-md text-xs font-bold",
                                              it.issueStatus === "Resolved"
                                                ? "bg-green-100 text-green-700"
                                                : it.issueStatus ===
                                                    "InProgress"
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

                                        {/* Ringkasan jumlah komentar */}
                                        <div className="text-xs text-gray-600">
                                          Komentar:{" "}
                                          <span className="font-semibold">
                                            {it.IssueComment?.length ?? 0}
                                          </span>
                                        </div>
                                      </motion.div>
                                    </td>

                                    {/* Aksi */}
                                    <td className="px-6 pt-5 text-right align-top">
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.1 }}
                                      >
                                        <button
                                          onClick={() =>
                                            onToggleCommentPanel(it.id)
                                          }
                                          className="font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded text-sm"
                                        >
                                          {opened
                                            ? "Tutup"
                                            : "Masukkan Komentar"}
                                        </button>
                                      </motion.div>
                                    </td>
                                  </tr>

                                  {/* Panel Komentar + Form (inline) */}
                                  <tr className="table w-full table-fixed">
                                    <td colSpan={4} className="px-6 pt-2 pb-4">
                                      <AnimatePresence>
                                        {opened && (
                                          <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{
                                              height: "auto",
                                              opacity: 1,
                                            }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.15 }}
                                            className="rounded-md border border-gray-200 p-4 bg-gray-50"
                                          >
                                            {/* Komentar terkait (editable) */}
                                            <div className="space-y-1">
                                              <div className="text-sm font-semibold text-gray-600">
                                                Komentar (
                                                {it.IssueComment?.length ?? 0})
                                              </div>

                                              <ul className="ml-0 pt-4 space-y-2">
                                                {(it.IssueComment ?? []).map(
                                                  (c) => (
                                                    <li
                                                      key={c.id}
                                                      className="text-sm bg-slate-200 rounded-md text-gray-700 p-2"
                                                    >
                                                      {editCommentId ===
                                                      c.id ? (
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
                                                              onClick={
                                                                onCancelEdit
                                                              }
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
                                                              {c.user?.name ??
                                                                "Anon"}
                                                              :
                                                            </span>{" "}
                                                            {c.message}{" "}
                                                            <span className="text-xs text-gray-400">
                                                              (
                                                              {fmtDate(
                                                                c.createdAt
                                                              )}
                                                              )
                                                            </span>
                                                          </div>
                                                          {c.user?.id ===
                                                            user?.id && (
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
                                                  )
                                                )}

                                                {(it.IssueComment ?? [])
                                                  .length === 0 && (
                                                  <li className="text-xs text-gray-400 italic">
                                                    Belum ada komentar
                                                  </li>
                                                )}
                                              </ul>
                                            </div>

                                            {/* Form komentar */}
                                            <div className="space-y-2 pt-4">
                                              <label className="text-sm font-semibold text-gray-700">
                                                Tambah Komentar
                                              </label>
                                              <textarea
                                                value={commentDraft}
                                                onChange={(e) =>
                                                  setCommentDraft(
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="Tulis komentar..."
                                                className="w-full border px-3 py-2 rounded bg-white min-h-[90px]"
                                              />
                                              <div className="flex justify-end">
                                                <button
                                                  onClick={() =>
                                                    handleSubmitCommentInline(
                                                      it
                                                    )
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
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </td>
                                  </tr>
                                </React.Fragment>
                              );
                            })}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })}
              </>
            )}
          </tbody>

          {/* FOOTER: buka/tutup semua */}
          <tfoot className="block w-full rounded-b-lg">
            <tr className="text-gray-700 bg-gray-200 table w-full table-fixed">
              <td colSpan={4} className="px-6 py-2">
                <div className="flex justify-end items-center">
                  {isCloseTable ? (
                    <button
                      onClick={() => toggleAllTables(false)}
                      className="flex items-center px-2 bg-gray-900 rounded-md border-gray-900 border-2"
                    >
                      <p className="text-sm font-bold text-white">Buka Semua</p>
                      <div className="pl-1 pb-1">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          className="text-white"
                        >
                          <path
                            fill="currentColor"
                            d="m7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6l-6-6z"
                          />
                        </svg>
                      </div>
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleAllTables(true)}
                      className="flex items-center px-2 bg-gray-900 rounded-md border-gray-900 border-2"
                    >
                      <p className="text-sm font-bold text-white">
                        Tutup Semua
                      </p>
                      <div className="pl-1 pb-1">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          className="text-white"
                        >
                          <path
                            fill="currentColor"
                            d="m7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6l-6 6z"
                          />
                        </svg>
                      </div>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
