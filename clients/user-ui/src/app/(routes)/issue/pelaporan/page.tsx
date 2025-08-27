"use client";

import React, { useState } from "react";
import { useMutation, useQuery, ApolloError } from "@apollo/client";
import { ADD_ISSUE_COMMENT } from "@/src/graphql/actions/issue.action";
import { GET_CONTENT_ISSUES } from "@/src/graphql/actions/get-allcontentissues.action";
import { ADD_CONTENT_ISSUES } from "@/src/graphql/actions/add-content-issues.action";
import { UPDATE_CONTENT_ISSUES_ACTION } from "@/src/graphql/actions/update-content-issues.action";
import { GET_ALL_OF_SUB_SURVEY_ACTIVITIES } from "@/src/graphql/actions/find-realallsubsurvey.action";
import useUser from "@/src/hooks/useUser";
import toast from "react-hot-toast";

export enum IssueStatus {
  Waiting = "Waiting",
  InProgress = "InProgress",
  Resolved = "Resolved",
}

export default function ContentIssueForm() {
  type SubSurveyActivity = { id: string; name: string };
  type ContentIssue = { id: string; content: string; issueStatus: IssueStatus };
  const { user } = useUser();

  // State untuk form ContentIssue
  const [contentInput, setContentInput] = useState({
    // id: "", // untuk update
    content: "",
    issueStatus: "Waiting" as any, // default tanpa enum FE

    subSurveyActivityId: "",
  });

  // state untuk mode update
  const [isUpdateMode, setIsUpdateMode] = useState({
    id: "", // untuk update
    content: "",
    issueStatus: IssueStatus.Waiting, // default tanpa enum FE
  });

  // State untuk komentar
  const [commentInput, setCommentInput] = useState({
    contentId: "",
    message: "",
    subSurveyActivityId: "",
  });

  const [createContentIssue] = useMutation(ADD_CONTENT_ISSUES, {
    refetchQueries: [{ query: GET_CONTENT_ISSUES }],
  });
  const [updateContentIssue] = useMutation(UPDATE_CONTENT_ISSUES_ACTION, {
    refetchQueries: [{ query: GET_CONTENT_ISSUES }],
  });
  const [addIssueComment] = useMutation(ADD_ISSUE_COMMENT);

  const { data: subSurveyData } = useQuery(GET_ALL_OF_SUB_SURVEY_ACTIVITIES);
  const { data, loading, error } = useQuery(GET_CONTENT_ISSUES);

  // Handler submit laporan kendala
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
      setContentInput({
        content: "",
        issueStatus: "Waiting",
        subSurveyActivityId: "",
      });
    } catch (error) {
      toast.error("Gagal membuat laporan");
      const err = error as ApolloError;
      console.log("GQL errors:", err.graphQLErrors);
      console.log("Network error:", err.networkError);
      console.log("Message:", err.message);
    }
  };

  // handler submit update laporan kendala
  const handleUpdateIssue = async (issueId: string) => {
    try {
      // Pastikan state update sesuai dengan baris yang diklik
      if (isUpdateMode.id !== issueId) {
        toast.error("Silakan ubah data pada baris ini sebelum menekan update.");
        return;
      }
      if (!isUpdateMode.content || !isUpdateMode.issueStatus) {
        toast.error("Isi laporan dan status kendala!");
        return;
      }

      await updateContentIssue({
        variables: {
          id: isUpdateMode.id,
          input: {
            content: isUpdateMode.content,
            issueStatus: isUpdateMode.issueStatus,
          },
        },
      });

      toast.success("Laporan kendala berhasil diupdate");
      setIsUpdateMode({
        id: "",
        content: "",
        issueStatus: IssueStatus.Waiting,
      });
    } catch (error) {
      toast.error("Gagal mengupdate laporan");
      const err = error as ApolloError;
      console.log("GQL errors:", err.graphQLErrors);
      console.log("Network error:", err.networkError);
      console.log("Message:", err.message);
    }
  };

  // // Handler submit komentar
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!commentInput.message || !commentInput.contentId) {
        toast.error("Pesan komentar wajib diisi!");
        return;
      }

      await addIssueComment({
        variables: { input: { ...commentInput, userId: user?.id } },
      });

      toast.success("Komentar berhasil ditambahkan");
      setCommentInput({ contentId: "", message: "", subSurveyActivityId: "" });
    } catch (error) {
      toast.error("Gagal menambahkan komentar");
    }
  };

  // if (loading) return <p>Loading...</p>;
  // if (error) return <p>Error: {error.message}</p>;

  return (
    <div className="space-y-6">
      {/* Form Laporan Kendala */}
      <div className="bg-orange-50 rounded-lg p-4 shadow-md">
        <h2 className="text-lg font-bold mb-4">Form Laporan Kendala</h2>
        <form onSubmit={handleSubmitContentIssue} className="space-y-3">
          <select
            value={contentInput.subSurveyActivityId}
            onChange={(e) =>
              setContentInput({
                ...contentInput,
                subSurveyActivityId: e.target.value,
              })
            }
            className="w-full border px-3 py-2 rounded bg-white"
          >
            <option value="">-- Pilih Kegiatan --</option>
            {subSurveyData?.allSubSurveyActivities?.map(
              (sub: SubSurveyActivity) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              )
            )}
          </select>

          <textarea
            value={contentInput.content}
            onChange={(e) =>
              setContentInput({ ...contentInput, content: e.target.value })
            }
            placeholder="Tuliskan kendala..."
            className="w-full border px-3 py-2 rounded bg-white"
          />

          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Kirim Laporan
          </button>
        </form>
      </div>

      
      
      {/* Form Update Laporan Kendala */}

      <div className="bg-orange-50 rounded-lg p-4 shadow-md">
        <h2 className="text-lg font-bold mb-4">Update Laporan Kendala</h2>
        <table className="table-fixed w-full text-sm text-left text-gray-500">
          <thead className="text-gray-700 bg-orange-50 block w-full sm:rounded-t-lg">
            <tr className="table w-full table-fixed">
              <th scope="col" className="px-6 py-3 uppercase">
                <div className="flex items-center">Kendala</div>
              </th>
              <th scope="col" className="px-6 py-3 uppercase">
                <div className="flex items-center">Status</div>
              </th>

              <th scope="col" className="px-6 py-3 uppercase">
                <div className="flex items-center">Aksi</div>
              </th>
            </tr>
          </thead>

          <tbody className="block max-h-96 overflow-y-auto w-full">
            {data?.contentIssues?.map((issue: ContentIssue) => (
              <tr key={issue.id} className="table w-full table-fixed border-b">
                <td className="px-6 py-4 align-top">
                  {/* {jangan gunakan text area dan option} */}
                  {issue.content
                    ? isUpdateMode.id === issue.id
                      ? (<input
                          type="text"
                          value={isUpdateMode.content}
                          onChange={(e) =>
                            setIsUpdateMode({
                              ...isUpdateMode,
                              id: issue.id,
                              content: e.target.value,
                              issueStatus: isUpdateMode.id === issue.id ? isUpdateMode.issueStatus : issue.issueStatus,
                            })
                          }
                          className="w-full border px-3 py-2 rounded bg-white"
                        />)
                      : issue.content
                    : "No Content"}

                  
                </td>
                <td className="px-6 py-4 align-top">
                  
                  {issue.issueStatus === IssueStatus.Resolved && (
                    <span className="bg-green-100 text-green-700 px-2 py-"
                    >{issue.issueStatus}</span>
                  )}
                  {issue.issueStatus === IssueStatus.InProgress && (
                    <span className="bg-yellow-100 text-yellow-700 px-2 py-"
                    >{issue.issueStatus}</span>
                  )}
                  {issue.issueStatus === IssueStatus.Waiting && (
                    <span className="bg-red-100 text-red-700 px-2 py-"
                    >{issue.issueStatus}</span>
                  )}
                  

                  {/* {issue.issueStatus
                    ? isUpdateMode.id === issue.id
                      ? (<input
                          type="text"
                          value={isUpdateMode.issueStatus}
                          onChange={(e) =>
                            setIsUpdateMode({
                              ...isUpdateMode,
                              id: issue.id,
                              issueStatus: e.target.value as IssueStatus,
                              content: isUpdateMode.id === issue.id ? isUpdateMode.content : issue.content,
                            })
                          }
                          className="w-full border px-3 py-2 rounded bg-white"
                        />)
                      : issue.issueStatus
                    : "No Status"} */}
                  
                  
                </td>

                <td className="px-6 py-4 align-top">
                  <button
                    onClick={() => handleUpdateIssue(issue.id)}
                    className="bg-blue-500 text-white px-4 py-2 rounded"
                  >
                    Update Laporan
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* <div className="bg-orange-50 rounded-lg p-4 shadow-md">
        <h2 className="text-lg font-bold mb-4">Form Update Laporan Kendala</h2>
        <form onSubmit={handleSubmitContentIssueUpdate} className="space-y-3">
          <table className="table-fixed w-full text-sm text-left text-gray-500">
            <thead className="text-gray-700 bg-orange-50 block w-full sm:rounded-t-lg">
              <tr className="table w-full table-fixed">
                <th scope="col" className="px-6 py-3 uppercase">
                  <div className="flex items-center">Kendala</div>
                </th>
                <th scope="col" className="px-6 py-3 uppercase">
                  <div className="flex items-center">Status</div>
                </th>
                <th scope="col" className="px-6 py-3 uppercase">
                  <div className="flex items-center">Aksi</div>
                </th>
              </tr>
            </thead>

            
            

            <tbody className="block max-h-96 overflow-y-auto w-full">
              {data?.contentIssues?.map((issue: any) => (
                <tr
                  key={issue.id}
                  className="table w-full table-fixed border-b"
                >
                  <td className="px-6 py-4 align-top">
                    <textarea
                      value={
                        isUpdateMode.id === issue.id
                          ? isUpdateMode.content
                          : issue.content
                      }
                      onChange={(e) =>
                        setIsUpdateMode({
                          ...isUpdateMode,
                          id: issue.id,
                          issueStatus: e.target.value,
                        })
                      }
                      className="w-full border px-3 py-2 rounded bg-white"
                    />
                  </td>
                  <td className="px-6 py-4 align-top">
                    <select
                      value={
                        isUpdateMode.id === issue.id
                          ? isUpdateMode.issueStatus
                          : issue.issueStatus
                      }
                      onChange={(e) =>
                        setIsUpdateMode({
                          ...isUpdateMode,
                          id: issue.id,
                          issueStatus: e.target.value,
                        })
                      }
                      className="w-full border px-3 py-2 rounded bg-white"
                    >
                      <option value="Waiting">Waiting</option>
                      <option value="InProgress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <button
                      type="submit"
                      className="bg-blue-500 text-white px-4 py-2 rounded"
                    >
                      Update Laporan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </form>
      </div> */}

      {/* Form Tambah Komentar */}
      <div className="bg-orange-50 rounded-lg p-4 shadow-md">
        <h2 className="text-lg font-bold mb-4">Form Komentar Kendala</h2>
        <form onSubmit={handleSubmitComment} className="space-y-3">
          <input
            type="text"
            placeholder="ID Laporan Kendala"
            value={commentInput.contentId}
            onChange={(e) =>
              setCommentInput({ ...commentInput, contentId: e.target.value })
            }
            className="w-full border px-3 py-2 rounded bg-white"
          />

          <textarea
            value={commentInput.message}
            onChange={(e) =>
              setCommentInput({ ...commentInput, message: e.target.value })
            }
            placeholder="Tulis komentar..."
            className="w-full border px-3 py-2 rounded bg-white"
          />

          <button
            type="submit"
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            Kirim Komentar
          </button>
        </form>
      </div>
    </div>
  );
}
