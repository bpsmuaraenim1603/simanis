"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, ApolloError } from "@apollo/client";
import toast from "react-hot-toast";
import useUser from "@/src/hooks/useUser";
import { GET_ALL_OF_SUB_SURVEY_ACTIVITIES } from "@/src/graphql/actions/find-realallsubsurvey.action";
import { CONTENT_ISSUES } from "@/src/graphql/actions/find-all-content-issue.action";
import { CREATE_CONTENT_ISSUE } from "@/src/graphql/actions/add-content-issue.action";
import { UPDATE_CONTENT_ISSUE } from "@/src/graphql/actions/update-content-issue.action";

type SubSurveyActivity = { id: string; name: string };
type IssueItem = {
  id: string;
  content: string;
  issueStatus: string;
  subSurveyActivityId: string;
  createdAt: string;
};

const ISSUE_STATUS_OPTIONS = [
  { value: "Waiting", label: "Menunggu" },
  { value: "InProgress", label: "Sedang Diproses" },
  { value: "Resolved", label: "Selesai" },
] as const;

export default function ContentIssueForm() {
  const { user } = useUser();

  // State ADD
  const [contentInput, setContentInput] = useState({
    content: "",
    issueStatus: "Waiting",
    subSurveyActivityId: "",
  });

  // State UPDATE
  const [updateIssueState, setUpdateIssueState] = useState({
    subSurveyActivityId: "",
    selectedIssueId: "",
    content: "",
    issueStatus: "Waiting",
  });

  const { data: subSurveyData } = useQuery(GET_ALL_OF_SUB_SURVEY_ACTIVITIES);

  const { data: issuesData, loading: issuesLoading, refetch: refetchIssues } = useQuery(CONTENT_ISSUES, {
    variables: {
      subSurveyActivityId: updateIssueState.subSurveyActivityId || null,
      status: null,
      search: null,
      skip: 0,   // schema: Float
      take: 20,
    },
    fetchPolicy: "cache-and-network",
  });

  const issues: IssueItem[] = useMemo(() => issuesData?.contentIssues ?? [], [issuesData]);

  const [createContentIssue, { loading: creating }] = useMutation(CREATE_CONTENT_ISSUE, {
    refetchQueries: [{
      query: CONTENT_ISSUES,
      variables: { subSurveyActivityId: null, status: null, search: null, skip: 0, take: 20 },
    }],
    awaitRefetchQueries: true,
  });

  const [updateContentIssue, { loading: updatingIssue }] = useMutation(UPDATE_CONTENT_ISSUE, {
    refetchQueries: [{
      query: CONTENT_ISSUES,
      variables: { subSurveyActivityId: null, status: null, search: null, skip: 0, take: 20 },
    }],
    awaitRefetchQueries: true,
  });

  // sinkronisasi isi form update saat pilih issue
  useEffect(() => {
    const sel = issues.find((it) => it.id === updateIssueState.selectedIssueId);
    if (sel) {
      setUpdateIssueState((prev) => ({
        ...prev,
        content: sel.content ?? "",
        issueStatus: sel.issueStatus ?? "Waiting",
      }));
    } else {
      setUpdateIssueState((prev) => ({ ...prev, content: "", issueStatus: "Waiting" }));
    }
  }, [updateIssueState.selectedIssueId, issues]);

  // Submit ADD
  const handleSubmitContentIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!contentInput.content || !contentInput.subSurveyActivityId) {
        toast.error("Isi laporan dan pilih kegiatan!");
        return;
      }
      await createContentIssue({ variables: { input: { ...contentInput, reporterId: user?.id } } });
      toast.success("Laporan kendala berhasil dikirim");
      setContentInput({
        content: "",
        issueStatus: "Waiting",
        subSurveyActivityId: contentInput.subSurveyActivityId,
      });
      refetchIssues();
    } catch (error) {
      toast.error("Gagal membuat laporan");
      const err = error as ApolloError;
      console.log("GQL errors:", err.graphQLErrors);
      console.log("Network error:", err.networkError);
      console.log("Message:", err.message);
    }
  };

  // Submit UPDATE
  const handleUpdateContentIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { selectedIssueId, content, issueStatus } = updateIssueState;
      if (!selectedIssueId) {
        toast.error("Pilih laporan yang akan diupdate!");
        return;
      }
      await updateContentIssue({ variables: { input: { id: selectedIssueId, content, issueStatus } } });
      toast.success("Laporan kendala berhasil diperbarui");
      refetchIssues();
    } catch {
      toast.error("Gagal memperbarui laporan");
    }
  };

  return (
    <div className="px-8 py-4 space-y-6 font-Poppins">
      {/* ===== Tambah Issue ===== */}
      <div className="bg-orange-50 rounded-lg p-4 shadow-md">
        <h2 className="text-lg font-bold mb-4">Laporkan Kendala</h2>
        <form onSubmit={handleSubmitContentIssue} className="space-y-3">
          <select
            value={contentInput.subSurveyActivityId}
            onChange={(e) => {
              const id = e.target.value;
              setContentInput((prev) => ({ ...prev, subSurveyActivityId: id }));
            }}
            className="w-full border px-3 py-2 rounded bg-white"
          >
            <option value="">-- Pilih Kegiatan --</option>
            {subSurveyData?.allSubSurveyActivities?.map((sub: SubSurveyActivity) => (
              <option key={sub.id} value={sub.id}>{sub.name}</option>
            ))}
          </select>

          <textarea
            value={contentInput.content}
            onChange={(e) => setContentInput({ ...contentInput, content: e.target.value })}
            placeholder="Tuliskan kendala..."
            className="w-full border px-3 py-2 rounded bg-white min-h-[120px]"
          />

          <label className="block text-sm font-medium text-gray-700">Status</label>
          <select
            value={contentInput.issueStatus}
            onChange={(e) => setContentInput((p) => ({ ...p, issueStatus: e.target.value }))}
            className="w-full border px-3 py-2 rounded bg-white"
          >
            {ISSUE_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60" disabled={creating}>
            {creating ? "Mengirim..." : "Kirim Laporan"}
          </button>
        </form>
      </div>

      {/* ===== Ubah Issue ===== */}
      <div className="bg-blue-50 rounded-lg p-4 shadow-md">
        <h2 className="text-lg font-bold mb-4">Ubah Laporan Kendala</h2>
        <form onSubmit={handleUpdateContentIssue} className="space-y-3">
          <select
            value={updateIssueState.subSurveyActivityId}
            onChange={(e) => {
              const id = e.target.value;
              setUpdateIssueState((prev) => ({ ...prev, subSurveyActivityId: id, selectedIssueId: "" }));
              refetchIssues({ subSurveyActivityId: id || null, status: null, search: null, skip: 0, take: 20 });
            }}
            className="w-full border px-3 py-2 rounded bg-white"
          >
            <option value="">-- Pilih Kegiatan --</option>
            {subSurveyData?.allSubSurveyActivities?.map((sub: SubSurveyActivity) => (
              <option key={sub.id} value={sub.id}>{sub.name}</option>
            ))}
          </select>

          <select
            value={updateIssueState.selectedIssueId}
            onChange={(e) => setUpdateIssueState((prev) => ({ ...prev, selectedIssueId: e.target.value }))}
            className="w-full border px-3 py-2 rounded bg-white"
          >
            <option value="">{updateIssueState.subSurveyActivityId ? (issuesLoading ? "Memuat..." : "-- Pilih Laporan --") : "Pilih kegiatan dulu"}</option>
            {issues.map((it) => (
              <option key={it.id} value={it.id}>#{it.id.slice(0, 6)} • {it.content?.slice(0, 40) || "(tanpa isi)"}…</option>
            ))}
          </select>

          <textarea
            value={updateIssueState.content}
            onChange={(e) => setUpdateIssueState((p) => ({ ...p, content: e.target.value }))}
            placeholder="Perbarui isi kendala…"
            className="w-full border px-3 py-2 rounded bg-white min-h-[120px]"
          />
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <select
            value={updateIssueState.issueStatus}
            onChange={(e) => setUpdateIssueState((p) => ({ ...p, issueStatus: e.target.value }))}
            className="w-full border px-3 py-2 rounded bg-white"
          >
            {ISSUE_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60" disabled={updatingIssue}>
            {updatingIssue ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </form>
      </div>
    </div>
  );
}
