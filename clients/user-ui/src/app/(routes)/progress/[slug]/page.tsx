"use client";

import React, { useState } from "react";
import { GET_SURVEY_ACTIVITIES_BY_SLUG } from "@/src/graphql/actions/find-surveyact.action";
import { GET_ALL_SUB_SURVEY_ACTIVITIES } from "@/src/graphql/actions/find-allsubsurveyact.action";
import { GET_ALL_SUB_SURVEY_PROGRESS } from "@/src/graphql/actions/find-allsubsurveyprogress.action";
import { GET_USER_PROGRESS_BY_SUBSURVEY_ID } from "@/src/graphql/actions/find-usersurveyprogress.action";
import { useParams } from "next/navigation";
import { useQuery } from "@apollo/client";
import useUser from "@/src/hooks/useUser";

const ProgressTemplate = () => {
  const { user } = useUser();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { slug } = useParams() as { slug: string };
  const [selectedSubSurvey, setSelectedSubSurvey] = useState<string | null>(
    null
  );
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const { data: surveyData, loading: loadingSurvey } = useQuery(
    GET_SURVEY_ACTIVITIES_BY_SLUG,
    {
      variables: { slug },
      skip: !slug,
      fetchPolicy: "network-only",
    }
  );

  const surveyActivityId = surveyData?.surveyActivityBySlug?.id;
  const { data: subSurveyDataAll, loading: loadingSubSurveyAll } = useQuery(
    GET_ALL_SUB_SURVEY_ACTIVITIES,
    {
      variables: { surveyActivityId },
      skip: !surveyActivityId,
      fetchPolicy: "network-only",
    }
  );

  const { data: subSurveyData, loading: loadingSubSurvey } = useQuery(
    GET_ALL_SUB_SURVEY_PROGRESS,
    {
      variables: { subSurveyActivityId: selectedSubSurvey },
      skip: !selectedSubSurvey,
      fetchPolicy: "network-only",
    }
  );

  const { data: progressData, loading: loadingProgress } = useQuery(
    GET_USER_PROGRESS_BY_SUBSURVEY_ID,
    {
      variables: { subSurveyActivityId: selectedSubSurvey },
      skip: !selectedSubSurvey,
      fetchPolicy: "network-only",
    }
  );

  const subSurveyActivities = subSurveyDataAll?.subSurveyActivityById || [];
  const progress = subSurveyData?.subSurveyProgress || null;
  const userProgress = progressData?.userProgressBySubSurveyActivityId || null;

  if (loadingSurvey || loadingSubSurveyAll) return <div>Loading...</div>;
  if (!surveyData || !surveyData.surveyActivityBySlug) {
    return <div>Data tidak ditemukan.</div>;
  }

  return (
    <div className="px-8 py-4 space-y-4 font-Poppins">
      <div className="bg-orange-50 rounded-lg p-2 text-xl font-bold w-full shadow-md">
        <h1>Progres {surveyData.surveyActivityBySlug.name}</h1>
      </div>

      <div className="bg-orange-50 rounded-lg p-2 w-full shadow-md">
        <p className="font-semibold text-xl">Pilih Jenis Survei:</p>
        <div className="space-x-4 p-2 flex justify-start">
          {subSurveyActivities.map((subSurvey: any) => (
            <div key={subSurvey.id} className="relative group">
              <button
                onClick={() => {
                  setSelectedSubSurvey(subSurvey.id);
                  setSelectedName(subSurvey.name);
                }}
                className={`p-2 rounded-md border font-semibold w-[40%] ${
                  selectedSubSurvey === subSurvey.id
                    ? "bg-orange-500 text-white"
                    : "bg-slate-700 text-white hover:bg-orange-500"
                }`}
              >
                <span className="block truncate overflow-hidden text-ellipsis">
                  {subSurvey.name}
                </span>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-black text-white text-xs rounded py-1 px-2 whitespace-nowrap shadow-lg z-10">
                  {subSurvey.name}
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>

      {selectedSubSurvey && progress && (
        <div className="bg-orange-50 rounded-lg p-2 w-full shadow-md">
          <h1 className="text-xl font-bold">{selectedName}</h1>
          <div className="p-2 space-x-4 flex justify-between items-center">
            <div className="bg-slate-400 rounded-lg border w-full flex flex-col p-3 space-y-3 font-semibold">
              <p>Periode</p>
              <p className="text-xl">
                {new Date(progress.startDate).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}{" "}
                -{" "}
                {new Date(progress.endDate).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="bg-slate-400 rounded-lg border w-full flex flex-col p-3 space-y-3 font-semibold">
              <p>Target Sampel</p>
              <p className="text-xl">{progress.targetSample}</p>
            </div>
            <div className="bg-slate-400 rounded-lg border w-full flex flex-col p-2 space-y-2 font-semibold">
              <p>Wilayah</p>
              <div className="relative">
                <select
                  id="wilayah"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">-- Pilih Wilayah --</option>
                  <option value="Muara Enim">Muara Enim</option>
                  <option value="PALI">PALI</option>
                </select>
              </div>
            </div>
          </div>

          <div className="p-2">
            <p className="font-semibold text-sm mb-1 border-l-4 border-blue-500 pl-2">
              Progres kegiatan
            </p>
            <div className="w-full bg-gray-200 rounded-full h-3 relative">
              <div
                className="bg-blue-600 h-3 rounded-full"
                style={{
                  width: `${Math.round(
                    (progress.submitCount / progress.targetSample) * 100
                  )}%`,
                }}
              />
              <span className="absolute right-0 top-[-24px] text-blue-600 font-bold text-xs">
                {Math.round(
                  (progress.submitCount / progress.targetSample) * 100
                )}
                %
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>

          <div className="flex flex-col space-y-2 p-2">
            <p className="font-semibold text-xl">Progres Kegiatan</p>
          </div>

          <div className="p-2 space-x-4 flex justify-between items-center">
            <div className="bg-blue-300 rounded-md flex flex-col items-center space-y-2 w-full py-2">
              <p>Total Petugas</p>
              <p className="font-bold text-2xl text-blue-600">
                {progress.totalPetugas}
              </p>
            </div>
            <div className="bg-green-300 rounded-md flex flex-col items-center space-y-2 w-full py-2">
              <p>Sampel Submit</p>
              <p className="font-bold text-2xl text-green-600">
                {progress.submitCount}
              </p>
            </div>
            <div className="bg-purple-300 rounded-md flex flex-col items-center space-y-2 w-full py-2">
              <p>Sampel Approved</p>
              <p className="font-bold text-2xl text-purple-600">
                {progress.approvedCount}
              </p>
            </div>
            <div className="bg-red-300 rounded-md flex flex-col items-center space-y-2 w-full py-2">
              <p>Sampel Rejected</p>
              <p className="font-bold text-2xl text-red-600">
                {progress.rejectedCount}
              </p>
            </div>
          </div>

          <div className="mt-4 bg-orange-50 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-2 text-orange-600 border-b border-orange-200 pb-1">
              Petugas Pendataan Lapangan
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto text-sm text-left">
                <thead className="bg-gray-100 text-gray-700 font-semibold">
                  <tr>
                    <th className="px-4 py-2">NAMA PETUGAS</th>
                    <th className="px-4 py-2">WILAYAH TUGAS</th>
                    <th className="px-4 py-2">TARGET</th>
                    <th className="px-4 py-2">SUBMIT</th>
                    <th className="px-4 py-2">APPROVED</th>
                    <th className="px-4 py-2">REJECTED</th>
                    <th className="px-4 py-2">PROGRESS</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {userProgress?.map((progress: any) => {
                    const percent =
                      progress.totalAssigned > 0
                        ? Math.round(
                            (progress.submitCount / progress.totalAssigned) *
                              100
                          )
                        : 0;
                    return (
                      <tr key={progress.user.id}>
                        <td className="px-4 py-3 font-medium text-gray-800">
                          <div className="flex items-center space-x-2">
                            <div>
                              <p>{progress.user.name}</p>
                              <p className="text-xs text-gray-500">
                                {progress.user.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {progress.district.name ?? "-"}
                        </td>
                        <td className="px-4 py-3">{progress.totalAssigned}</td>
                        <td className="px-4 py-3">{progress.submitCount}</td>
                        <td className="px-4 py-3">{progress.approvedCount}</td>
                        <td className="px-4 py-3">{progress.rejectedCount}</td>
                        <td className="px-4 py-3">
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
                          <p className="text-xs text-gray-600 mt-1">
                            {percent}%
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressTemplate;
