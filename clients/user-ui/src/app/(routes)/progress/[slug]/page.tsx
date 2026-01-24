"use client";

import React, { useMemo, useState } from "react";
import { GET_SURVEY_ACTIVITIES_BY_SLUG } from "@/src/graphql/actions/find-surveyact.action";
import { GET_ALL_SUB_SURVEY_ACTIVITIES } from "@/src/graphql/actions/find-allsubsurveyact.action";
import { GET_ALL_SUB_SURVEY_PROGRESS } from "@/src/graphql/actions/find-allsubsurveyprogress.action";
import { GET_USER_PROGRESS_BY_SUBSURVEY_ID } from "@/src/graphql/actions/find-usersurveyprogress.action";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useQuery } from "@apollo/client";
import useUser from "@/src/hooks/useUser";
import HUComboBox from "@/src/components/HUCombobox";
import * as XLSX from "xlsx";

type ProgressRow = {
  user: { id: string; name: string; email: string };
  superVisor?: { id: string; name: string; email: string } | null;
  superVisorId?: string | null;
  progressRole?: string | null;
  district?: { name?: string | null; city?: string | null } | null;
  totalAssigned: number;
  submitCount: number;
  approvedCount: number;
  rejectedCount: number;
};

const ProgressTemplate = () => {
  const { user } = useUser();
  const { slug } = useParams() as { slug: string };
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const setQuery = React.useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      for (const [k, v] of Object.entries(patch)) {
        if (!v) params.delete(k);
        else params.set(k, v);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );
  const selectedCityQ = searchParams?.get("city") || "";
  const selectedSubSlug = searchParams?.get("sub") || "";

  const [selectedSubSurvey, setSelectedSubSurvey] = useState<string | null>(
    null,
  );
  const [progressRole, setProgressRole] = useState<string | null>("PETUGAS");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string>("");

  const { data: surveyData, loading: loadingSurvey } = useQuery(
    GET_SURVEY_ACTIVITIES_BY_SLUG,
    { variables: { slug }, skip: !slug, fetchPolicy: "network-only" },
  );
  const surveyActivityId = surveyData?.surveyActivityBySlug?.id;
  const { data: subSurveyDataAll, loading: loadingSubSurveyAll } = useQuery(
    GET_ALL_SUB_SURVEY_ACTIVITIES,
    {
      variables: { surveyActivityId },
      skip: !surveyActivityId,
      fetchPolicy: "network-only",
    },
  );
  const { data: subSurveyData } = useQuery(GET_ALL_SUB_SURVEY_PROGRESS, {
    variables: { subSurveyActivityId: selectedSubSurvey },
    skip: !selectedSubSurvey,
    fetchPolicy: "network-only",
  });
  const { data: progressData } = useQuery(GET_USER_PROGRESS_BY_SUBSURVEY_ID, {
    variables: { subSurveyActivityId: selectedSubSurvey },
    skip: !selectedSubSurvey,
    fetchPolicy: "network-only",
  });
  const subSurveyActivities = subSurveyDataAll?.subSurveyActivityById ?? [];
  const progress = subSurveyData?.subSurveyProgress ?? null;
  const userProgress: ProgressRow[] =
    (progressData?.userProgressBySubSurveyActivityId as ProgressRow[]) ?? [];
  const cities = useMemo<string[]>(() => {
    const list = userProgress
      .map((p) => p?.district?.city ?? "")
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    return Array.from(new Set<string>(list)).sort((a, b) =>
      a.localeCompare(b, "id"),
    );
  }, [userProgress]);
  const filteredUserProgress: ProgressRow[] = useMemo(() => {
    if (!selectedCity) return userProgress;
    return userProgress.filter((p) => p?.district?.city === selectedCity);
  }, [userProgress, selectedCity]);
  const aggregatedUserProgress = useMemo(() => {
    const rows =
      selectedCity && selectedCity.length > 0
        ? userProgress.filter((p) => p?.district?.city === selectedCity)
        : userProgress;

    type Agg = {
      user: { id: string; name: string; email: string };
      superVisor: { id: string; name: string; email: string } | null;
      superVisorId?: string | null;
      progressRole?: string | null;
      totalAssigned: number;
      submitCount: number;
      approvedCount: number;
      rejectedCount: number;
      districts: Set<string>;
      cities: Set<string>;
    };
    const map = new Map<string, Agg>();
    for (const r of rows) {
      const key = r.user?.id;
      if (!key) continue;

      const distName = r.district?.name ?? "";
      const cityName = r.district?.city ?? "";

      let agg = map.get(key);
      if (!agg) {
        agg = {
          user: { ...r.user },
          superVisor: r.superVisor ?? null,
          superVisorId: r.superVisorId ?? null,
          progressRole: r.progressRole ?? null,
          totalAssigned: 0,
          submitCount: 0,
          approvedCount: 0,
          rejectedCount: 0,
          districts: new Set<string>(),
          cities: new Set<string>(),
        };
        map.set(key, agg);
      }

      agg.totalAssigned += r.totalAssigned ?? 0;
      agg.submitCount += r.submitCount ?? 0;
      agg.approvedCount += r.approvedCount ?? 0;
      agg.rejectedCount += r.rejectedCount ?? 0;
      if (distName) agg.districts.add(distName);
      if (cityName) agg.cities.add(cityName);
    }

    const onlyPetugas = Array.from(map.values()).filter((row) => {
      const role = (row.progressRole ?? "").toUpperCase();
      return role === "PETUGAS";
    });

    return onlyPetugas.sort(
      (a, b) => (b.approvedCount ?? 0) - (a.approvedCount ?? 0),
    );
  }, [userProgress, selectedCity]);

  const groupedBySupervisor = useMemo(() => {
    type Group = {
      supervisorId: string;
      supervisorName: string;
      supervisorEmail?: string;
      members: typeof aggregatedUserProgress;
    };

    const groups = new Map<string, Group>();

    for (const row of aggregatedUserProgress) {
      const id =
        row.superVisorId && row.superVisorId.length > 0
          ? row.superVisorId
          : "NO_SUPERVISOR";

      const supName =
        id === "NO_SUPERVISOR"
          ? "Tanpa Pengawas"
          : (row.superVisor?.name ?? "(Pengawas tidak diketahui)");

      const supEmail = row.superVisor?.email;

      if (!groups.has(id)) {
        groups.set(id, {
          supervisorId: id,
          supervisorName: supName,
          supervisorEmail: supEmail,
          members: [],
        });
      }

      groups.get(id)!.members.push(row);
    }

    return Array.from(groups.values()).sort((a, b) =>
      a.supervisorName.localeCompare(b.supervisorName, "id"),
    );
  }, [aggregatedUserProgress]);

  React.useEffect(() => {
    if (!selectedSubSlug) return;
    if (!subSurveyActivities?.length) return;

    const current = subSurveyActivities.find(
      (s: any) => s.id === selectedSubSurvey,
    );
    if (current?.slug === selectedSubSlug) return;

    const found = subSurveyActivities.find(
      (s: any) => s.slug === selectedSubSlug,
    );
    if (!found) return;

    setSelectedSubSurvey(found.id);
    setSelectedName(found.name);
    setSelectedCity("");
  }, [selectedSubSlug, subSurveyActivities, selectedSubSurvey]);

  React.useEffect(() => {
    setSelectedCity(selectedCityQ);
  }, [selectedCityQ]);

  const overallPercent =
    progress && progress.targetSample > 0
      ? Math.round(
          ((progress.submitCount + progress.approvedCount) /
            progress.targetSample) *
            100,
        )
      : 0;
  const cityOptions = useMemo(
    () => [
      { value: "", label: "-- Semua Wilayah --" },
      ...cities.map((c) => ({ value: c, label: c })),
    ],
    [cities],
  );

  const handleExportProgress = () => {
    if (!aggregatedUserProgress.length) {
      alert("Tidak ada data untuk diexport.");
      return;
    }

    const rows = aggregatedUserProgress.map((row, idx) => {
      const cityText = Array.from(row.cities).join(", ");
      const districtText = Array.from(row.districts).join(", ");
      const percent =
        row.totalAssigned > 0
          ? Math.round((row.submitCount / row.totalAssigned) * 100)
          : 0;
      const percentApproved =
        row.totalAssigned > 0
          ? Math.round((row.approvedCount / row.totalAssigned) * 100)
          : 0;

      return {
        No: idx + 1,
        Nama: row.user.name,
        Email: row.user.email,
        Pengawas: row.superVisor?.name ?? "",
        Kota: cityText,
        Wilayah: districtText,
        TotalAssigned: row.totalAssigned,
        SubmitCount: row.submitCount,
        ApprovedCount: row.approvedCount,
        PersenSubmit: percent,
        PersenApproved: percentApproved,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PROGRESS_PETUGAS");

    const fileName = `Progress_${selectedName || "Kegiatan"}_${
      selectedCity || "ALL"
    }.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  if (loadingSurvey || loadingSubSurveyAll) return <div>Loading...</div>;
  if (!surveyData || !surveyData.surveyActivityBySlug)
    return <div>Data tidak ditemukan.</div>;

  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-6 md:px-8 py-4 space-y-4 font-Poppins">
      <div className="bg-orange-50 rounded-lg p-3 md:p-4 text-lg md:text-xl font-bold w-full shadow-md">
        <h1>Progres {surveyData.surveyActivityBySlug.name}</h1>
      </div>

      {/* Pilihan sub survey */}
      <div className="bg-orange-50 rounded-lg p-3 md:p-4 w-full shadow-md">
        <p className="font-semibold text-base md:text-lg mb-2">
          Pilih Jenis Survei:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {subSurveyActivities.map((subSurvey: any) => (
            <div key={subSurvey.id} className="relative group">
              <button
                onClick={() => {
                  setSelectedSubSurvey(subSurvey.id);
                  setSelectedName(subSurvey.name);
                  setSelectedCity("");
                  setQuery({ sub: subSurvey.slug });
                }}
                className={`w-full p-2 rounded-md border font-semibold ${
                  selectedSubSurvey === subSurvey.id
                    ? "bg-orange-500 text-white"
                    : "bg-slate-700 text-white hover:bg-orange-500"
                }`}
              >
                <span className="block truncate">{subSurvey.name}</span>
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-black text-white text-xs rounded py-1 px-2 whitespace-nowrap shadow-lg z-10">
                {subSurvey.name}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedSubSurvey && progress && (
        <div className="bg-orange-50 rounded-lg p-3 md:p-4 w-full shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
            <h1 className="text-lg md:text-xl font-bold">{selectedName}</h1>
            <button
              type="button"
              onClick={handleExportProgress}
              className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold border border-gray-300 bg-white hover:bg-gray-50"
            >
              Ekspor Progress Petugas
            </button>
          </div>

          {/* Ringkasan atas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-400 rounded-lg border w-full p-3 space-y-2 font-semibold">
              <p>Periode</p>
              <p className="text-base md:text-xl">
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

            <div className="bg-slate-400 rounded-lg border w-full p-3 space-y-2 font-semibold">
              <p>Target Sampel {progress.activityType}</p>
              <p className="text-base md:text-xl">
                {progress.targetSample} {progress.sampleType}
              </p>
            </div>

            <div className="bg-slate-400 rounded-lg border w-full p-3 space-y-2 font-semibold">
              <p>Wilayah (Kota/Kab.)</p>
              <HUComboBox
                value={selectedCity || null}
                onValueChange={(v) => {
                  const next = v ?? "";
                  setSelectedCity(next);
                  setQuery({
                    sub: selectedSubSlug || null,
                    city: next || null,
                  });
                }}
                options={cityOptions ? cityOptions : []}
                placeholder="-- Semua Wilayah --"
                className="w-full"
              />
              {!cities.length && (
                <p className="text-xs text-gray-700 mt-1">
                  Tidak ada data kota yang tersedia.
                </p>
              )}
            </div>
          </div>

          {/* Progress bar global */}
          <div>
            <p className="font-semibold text-sm mb-1 border-l-4 border-blue-500 pl-2">
              Progres kegiatan
            </p>
            <div className="w-full bg-gray-200 rounded-full h-3 relative">
              <div
                className="bg-blue-600 h-3 rounded-full"
                style={{ width: `${overallPercent}%` }}
              />
              <span className="absolute right-0 -top-6 text-blue-600 font-bold text-xs">
                {overallPercent}%
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Ringkasan angka 4 kolom */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-gray-300 rounded-md flex flex-col items-center space-y-1 w-full py-2">
              <p>Total Petugas</p>
              <p className="font-bold text-xl md:text-2xl text-gray-600">
                {aggregatedUserProgress.length}
              </p>
            </div>
            <div className="bg-blue-300 rounded-md flex flex-col items-center space-y-1 w-full py-2">
              <p>Sampel Disubmit</p>
              <p className="font-bold text-xl md:text-2xl text-blue-600">
                {progress.submitCount}
              </p>
            </div>
            <div className="bg-green-300 rounded-md flex flex-col items-center space-y-1 w-full py-2">
              <p>Sampel Disetujui</p>
              <p className="font-bold text-xl md:text-2xl text-green-600">
                {progress.approvedCount}
              </p>
            </div>
            {/* <div className="bg-red-300 rounded-md flex flex-col items-center space-y-1 w-full py-2">
              <p>Sampel Ditolak</p>
              <p className="font-bold text-xl md:text-2xl text-red-600">
                {progress.rejectedCount}
              </p>
            </div> */}
          </div>

          {/* Tabel petugas */}
          <div className="mt-2 bg-orange-50 rounded-lg">
            <h2 className="text-base md:text-lg font-semibold mb-2 text-orange-600 border-b border-orange-200 pb-1">
              Petugas Pendataan Lapangan
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full table-auto text-sm text-left">
                <thead className="bg-gray-100 text-gray-700 font-semibold">
                  <tr>
                    <th className="px-4 py-2">NAMA PETUGAS</th>
                    <th className="px-4 py-2">WILAYAH TUGAS</th>
                    <th className="px-4 py-2">TARGET</th>
                    <th className="px-4 py-2">DISUBMIT</th>
                    <th className="px-4 py-2">DISETUJUI</th>
                    {/* <th className="px-4 py-2">DITOLAK</th> */}
                    <th className="px-4 py-2">PROGRESS</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {groupedBySupervisor.map((group) => (
                    <React.Fragment key={group.supervisorId}>
                      <tr className="bg-slate-100">
                        <td
                          colSpan={7}
                          className="px-4 py-2 font-bold text-gray-800"
                        >
                          Pengawas: {group.supervisorName}
                          {group.supervisorEmail && (
                            <span className="text-xs text-gray-500 ml-2">
                              ({group.supervisorEmail})
                            </span>
                          )}
                        </td>
                      </tr>

                      {group.members.map((row, idx) => {
                        const cityText = Array.from(row.cities).join(", ");
                        const districtText = Array.from(row.districts).join(
                          ", ",
                        );
                        const percent =
                          row.totalAssigned > 0
                            ? Math.round(
                                (row.submitCount / row.totalAssigned) * 100,
                              )
                            : 0;
                        const percentApproved =
                          row.totalAssigned > 0
                            ? Math.round(
                                (row.approvedCount / row.totalAssigned) * 100,
                              )
                            : 0;

                        return (
                          <tr key={row.user.id} className="border-b">
                            {/* <td className="px-4 py-3 text-sm text-gray-500">
                              {idx + 1}
                            </td> */}
                            <td className="px-4 py-3">
                              <p className="font-semibold">{row.user.name}</p>
                              <p className="text-xs text-gray-500 truncate">
                                {row.user.email}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {cityText ? `${cityText}: ` : ""}
                              {districtText}
                            </td>
                            <td className="px-4 py-3">{row.totalAssigned}</td>
                            <td className="px-4 py-3">{row.submitCount}</td>
                            <td className="px-4 py-3">{row.approvedCount}</td>
                            {/* <td className="px-4 py-3">{row.rejectedCount}</td> */}
                            <td className="px-4 py-3">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${percent >= 80 ? "bg-green-500" : percent >= 50 ? "bg-yellow-400" : "bg-red-400"}`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                              <p className="text-xs text-gray-600 mt-1">
                                {percent}% Disubmit
                              </p>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${percentApproved >= 80 ? "bg-green-500" : percentApproved >= 50 ? "bg-yellow-400" : "bg-red-400"}`}
                                  style={{ width: `${percentApproved}%` }}
                                />
                              </div>
                              <p className="text-xs text-gray-600 mt-1">
                                {percentApproved}% Disetujui
                              </p>
                            </td>
                          </tr>
                        );
                      })}
                      {!aggregatedUserProgress.length && (
                        <tr>
                          <td className="px-4 py-3 text-gray-600" colSpan={7}>
                            Tidak ada data untuk wilayah yang dipilih.
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
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
