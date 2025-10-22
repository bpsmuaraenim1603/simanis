"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, ApolloError } from "@apollo/client";
import toast from "react-hot-toast";
import useUser from "@/src/hooks/useUser";
import { GET_ALL_OF_SUB_SURVEY_ACTIVITIES } from "@/src/graphql/actions/find-realallsubsurvey.action";
import { CONTENT_ISSUES } from "@/src/graphql/actions/find-all-content-issue.action";
import { CREATE_CONTENT_ISSUE } from "@/src/graphql/actions/add-content-issue.action";
import { UPDATE_CONTENT_ISSUE } from "@/src/graphql/actions/update-content-issue.action";
import HUComboBox from "@/src/components/HUCombobox";
import HUSelect from "@/src/components/HUSelect";

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

  const {
    data: issuesData,
    loading: issuesLoading,
    refetch: refetchIssues,
  } = useQuery(CONTENT_ISSUES, {
    variables: {
      subSurveyActivityId: updateIssueState.subSurveyActivityId || null,
      status: null,
      search: null,
      skip: 0,
      take: 20,
    },
    fetchPolicy: "cache-and-network",
  });

  const issues: IssueItem[] = useMemo(
    () => issuesData?.contentIssues ?? [],
    [issuesData]
  );

  const [createContentIssue, { loading: creating }] = useMutation(
    CREATE_CONTENT_ISSUE,
    {
      refetchQueries: [
        {
          query: CONTENT_ISSUES,
          variables: {
            subSurveyActivityId: null,
            status: null,
            search: null,
            skip: 0,
            take: 20,
          },
        },
      ],
      awaitRefetchQueries: true,
    }
  );

  const [updateContentIssue, { loading: updatingIssue }] = useMutation(
    UPDATE_CONTENT_ISSUE,
    {
      refetchQueries: [
        {
          query: CONTENT_ISSUES,
          variables: {
            subSurveyActivityId: null,
            status: null,
            search: null,
            skip: 0,
            take: 20,
          },
        },
      ],
      awaitRefetchQueries: true,
    }
  );

  const toOpts = <T,>(
    rows: T[],
    pick: (row: T) => { value: string; label: string; subLabel?: string }
  ) => rows?.map(pick) ?? [];

  const subSurveyOpts = toOpts(
    subSurveyData?.allSubSurveyActivities ?? [],
    (s: SubSurveyActivity) => ({
      value: s.id,
      label: s.name ?? "-",
    })
  );

  const issueOpts = toOpts(issues, (it) => ({
    value: it.id,
    label: `#${it.id.slice(0, 6)} • ${it.content?.slice(0, 40) || "(tanpa isi)"}…`,
  }));

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
      setUpdateIssueState((prev) => ({
        ...prev,
        content: "",
        issueStatus: "Waiting",
      }));
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
      await createContentIssue({
        variables: { input: { ...contentInput, reporterId: user?.id } },
      });
      toast.success("Laporan kendala berhasil dikirim");
      setContentInput((prev) => ({
        ...prev,
        content: "",
        issueStatus: "Waiting",
      }));
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
      await updateContentIssue({
        variables: { input: { id: selectedIssueId, content, issueStatus } },
      });
      toast.success("Laporan kendala berhasil diperbarui");
      refetchIssues();
    } catch {
      toast.error("Gagal memperbarui laporan");
    }
  };

  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-6 md:px-8 py-4 font-Poppins">
      <div className="bg-orange-50 rounded-lg p-3 md:p-4 shadow-md mb-4">
        <h1 className="text-lg md:text-xl font-bold">Laporan Kendala</h1>
        <p className="text-sm text-gray-600">
          Laporkan dan perbarui kendala terkait kegiatan survei.
        </p>
      </div>

      {/* Grid responsif: 1 kolom (mobile), 2 kolom (md+) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* ===== Tambah Issue ===== */}
        <div className="bg-white rounded-lg p-4 shadow-md">
          <h2 className="text-base md:text-lg font-bold mb-3">
            Laporkan Kendala
          </h2>
          <form onSubmit={handleSubmitContentIssue} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Kegiatan Survei
              </label>
              <HUComboBox
                value={contentInput.subSurveyActivityId || null}
                onValueChange={(v) =>
                  setContentInput((prev) => ({
                    ...prev,
                    subSurveyActivityId: (v ?? "") as string,
                  }))
                }
                options={subSurveyOpts}
                placeholder="Pilih kegiatan"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Isi Kendala
              </label>
              <textarea
                value={contentInput.content}
                onChange={(e) =>
                  setContentInput((prev) => ({
                    ...prev,
                    content: e.target.value,
                  }))
                }
                placeholder="Tuliskan kendala..."
                className="w-full border px-3 py-2 rounded bg-white min-h-[120px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <HUSelect
                value={contentInput.issueStatus || null}
                onValueChange={(v) =>
                  setContentInput((p) => ({
                    ...p,
                    issueStatus: (v ?? "Waiting") as string,
                  }))
                }
                options={ISSUE_STATUS_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded w-full sm:w-auto disabled:opacity-60"
            >
              {creating ? "Mengirim..." : "Kirim Laporan"}
            </button>
          </form>
        </div>

        {/* ===== Ubah Issue ===== */}
        <div className="bg-white rounded-lg p-4 shadow-md">
          <h2 className="text-base md:text-lg font-bold mb-3">
            Ubah Laporan Kendala
          </h2>
          <form onSubmit={handleUpdateContentIssue} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Kegiatan Survei
              </label>
              <HUComboBox
                value={updateIssueState.subSurveyActivityId || null}
                onValueChange={(v) => {
                  const id = (v ?? "") as string;
                  setUpdateIssueState((prev) => ({
                    ...prev,
                    subSurveyActivityId: id,
                    selectedIssueId: "",
                  }));
                  refetchIssues({
                    subSurveyActivityId: id || null,
                    status: null,
                    search: null,
                    skip: 0,
                    take: 20,
                  });
                }}
                options={subSurveyOpts}
                placeholder="Pilih kegiatan"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Pilih Laporan
              </label>
              <HUSelect
                value={updateIssueState.selectedIssueId || null}
                onValueChange={(v) =>
                  setUpdateIssueState((prev) => ({
                    ...prev,
                    selectedIssueId: (v ?? "") as string,
                  }))
                }
                options={
                  updateIssueState.subSurveyActivityId
                    ? issuesLoading
                      ? []
                      : issueOpts
                    : []
                }
                placeholder={
                  updateIssueState.subSurveyActivityId
                    ? issuesLoading
                      ? "Memuat…"
                      : "Pilih laporan"
                    : "Pilih kegiatan dulu"
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Isi Kendala
              </label>
              <textarea
                value={updateIssueState.content}
                onChange={(e) =>
                  setUpdateIssueState((p) => ({
                    ...p,
                    content: e.target.value,
                  }))
                }
                placeholder="Perbarui isi kendala…"
                className="w-full border px-3 py-2 rounded bg-white min-h-[120px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <HUSelect
                value={updateIssueState.issueStatus || null}
                onValueChange={(v) =>
                  setUpdateIssueState((p) => ({
                    ...p,
                    issueStatus: (v ?? "Waiting") as string,
                  }))
                }
                options={ISSUE_STATUS_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
              />
            </div>

            <button
              type="submit"
              disabled={updatingIssue}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded w-full sm:w-auto disabled:opacity-60"
            >
              {updatingIssue ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
