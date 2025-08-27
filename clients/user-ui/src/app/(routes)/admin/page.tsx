"use client";

import React, { useEffect, useState } from "react";
import { useLazyQuery, useMutation, useQuery } from "@apollo/client";
import toast from "react-hot-toast";
import styles from "@/src/utils/style";
import { ADD_SURVEY_ACTIVITY } from "@/src/graphql/actions/add-surveyact.action";
import { ADD_SUBSURVEY_ACTIVITY } from "@/src/graphql/actions/add-subsurveyact.action";
import { GET_ALL_SURVEY_ACTIVITIES } from "@/src/graphql/actions/find-allsurveyact.action";
import { UPDATE_SURVEY_ACTIVITY } from "@/src/graphql/actions/update-survey.action";
import { UPDATE_SUB_SURVEY_ACTIVITY } from "@/src/graphql/actions/update-subsurvey.action";
import { GET_ALL_SUB_SURVEY_ACTIVITIES } from "@/src/graphql/actions/find-allsubsurveyact.action";
import { CREATE_USER_PROGRESS } from "@/src/graphql/actions/create-userprogress.action";
import { UPDATE_USER_PROGRESS } from "@/src/graphql/actions/update-userprogress.action";
import { GET_ALL_USERS } from "@/src/graphql/actions/find-allusers.action";
import { GET_USER_PROGRESS_BY_SUBSURVEY_ID } from "@/src/graphql/actions/find-usersurveyprogress.action";
import { GET_ALL_DISTRICT } from "@/src/graphql/actions/find-alldistrict.action";
import { LayoutGroup, motion } from "framer-motion";

/* ===================== Types ===================== */
type SurveyActivity = { id: string; name: string; slug: string };
type District = { id: string; city: string; name: string };
type SubSurveyActivity = {
  id: string;
  name: string;
  slug: string;
  surveyActivityId: string;
  startDate: string;
  endDate: string;
  targetSample: number;
  sampleType: string;
  activityType: string;
};
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
type UserProgress = {
  id: string;
  userId: string;
  subSurveyActivityId: string;
  totalAssigned: number;
  submitCount: number;
  approvedCount: number;
  rejectedCount: number;
  lastUpdated: string;
  districtId: string;
};
type UserProgressWithUser = UserProgress & {
  user?: { name: string; email: string };
};

/* =============== Simple Tabs Components =============== */
function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  value: T;
  onChange: (k: T) => void;
}) {
  return (
    <div className="flex gap-2 border-b border-gray-200">
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={[
              "px-4 py-2 text-sm font-medium rounded-t-lg",
              active
                ? "bg-white border-x border-t border-gray-200 -mb-px"
                : "text-gray-600 hover:text-gray-900",
            ].join(" ")}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function SubTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  value: T;
  onChange: (k: T) => void;
}) {
  return (
    <LayoutGroup>
      <div
        className="inline-flex rounded-xl bg-gray-100 p-1 my-3"
        role="tablist"
        aria-label="SubTabs"
      >
        {tabs.map((t) => {
          const active = value === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.key)}
              className="relative px-4 py-2 text-sm font-medium rounded-lg focus:outline-none select-none"
            >
              {/* Pill putih yang bergerak antar tab */}
              {active && (
                <motion.span
                  layoutId="subtab-pill" // kunci animasi
                  className="absolute inset-0 rounded-lg bg-white shadow"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              {/* Teks di atas pill */}
              <span
                className={`relative z-10 ${active ? "text-gray-900" : "text-gray-600"}`}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

/* ===================== Main ===================== */
function Admin() {
  /* ---------- State untuk Tabs ---------- */
  const [section, setSection] = useState<"tim" | "kegiatan" | "petugas">("tim");
  const [mode, setMode] = useState<"add" | "update">("add");
  useEffect(() => {
    // setiap ganti section, default ke "add"
    setMode("add");
  }, [section]);

  /* ---------- State Form (SAMA seperti punyamu) ---------- */
  const [formStateF1, setFormStateF1] = useState({ name: "", slug: "" });
  const [updateStateF1, setUpdateStateF1] = useState({
    surveyActivityId: "",
    name: "",
    slug: "",
  });

  const [formStateF2, setFormStateF2] = useState({
    name: "",
    slug: "",
    surveyActivityId: "",
    startDate: "",
    endDate: "",
    targetSample: 0,
    sampleType: "",
    activityType: "",
  });
  const [updateStateF2, setUpdateStateF2] = useState({
    subSurveyActivityId: "",
    name: "",
    slug: "",
    surveyActivityId: "",
    startDate: "",
    endDate: "",
    targetSample: 0,
    sampleType: "",
    activityType: "",
  });

  const [userProgressForm, setUserProgressForm] = useState({
    userId: "",
    subSurveyActivityId: "",
    surveyActivityId: "",
    totalAssigned: 0,
    submitCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    lastUpdated: "",
    districtId: "",
  });

  const [updateUserProgressForm, setUpdateUserProgressForm] = useState({
    userProgressId: "",
    subSurveyActivityId: "",
    surveyActivityId: "",
    userId: "",
    totalAssigned: 0,
    submitCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    lastUpdated: "",
  });

  /* ---------- Queries & Mutations (SAMA) ---------- */
  const { data, loading } = useQuery(GET_ALL_SURVEY_ACTIVITIES);

  const [fetchSubForSubSurveys, { data: SubSurveydata }] = useLazyQuery(
    GET_ALL_SUB_SURVEY_ACTIVITIES
  );
  const [fetchSubForSubmitUP, { data: SubmitUPData }] = useLazyQuery(
    GET_ALL_SUB_SURVEY_ACTIVITIES
  );
  const [fetchSubForUpdateUP, { data: UpdateUPData }] = useLazyQuery(
    GET_ALL_SUB_SURVEY_ACTIVITIES
  );

  const { data: userData } = useQuery(GET_ALL_USERS);
  const { data: districtData } = useQuery(GET_ALL_DISTRICT);

  const [fetchUserProgress, { data: userProgressData }] = useLazyQuery(
    GET_USER_PROGRESS_BY_SUBSURVEY_ID
  );

  const [addSurveyActivity, { loading: loading1 }] =
    useMutation(ADD_SURVEY_ACTIVITY);
  const [addSubSurveyActivity, { loading: loading2 }] = useMutation(
    ADD_SUBSURVEY_ACTIVITY
  );
  const [updateSurveyActivity] = useMutation(UPDATE_SURVEY_ACTIVITY);
  const [updateSubSurveyActivity] = useMutation(UPDATE_SUB_SURVEY_ACTIVITY);
  const [createUserSurveyProgress] = useMutation(CREATE_USER_PROGRESS);
  const [updateUserSurveyProgress] = useMutation(UPDATE_USER_PROGRESS);

  // --- helper: format ke yyyy-mm-dd untuk <input type="date">
  const toDateInput = (d?: string | Date) =>
    d ? new Date(d).toISOString().slice(0, 10) : "";

  // --- memoized map lookup supaya O(1)
  const surveyMap = React.useMemo<Record<string, SurveyActivity>>(() => {
    return Object.fromEntries(
      (data?.allSurveyActivities ?? []).map((s: SurveyActivity) => [s.id, s])
    );
  }, [data]);

  const subMap = React.useMemo<Record<string, SubSurveyActivity>>(() => {
    return Object.fromEntries(
      (SubSurveydata?.subSurveyActivityById ?? []).map(
        (s: SubSurveyActivity) => [s.id, s]
      )
    );
  }, [SubSurveydata]);

  const upMap = React.useMemo<Record<string, UserProgressWithUser>>(() => {
    return Object.fromEntries(
      (userProgressData?.userProgressBySubSurveyActivityId ?? []).map(
        (u: UserProgressWithUser) => [u.id, u]
      )
    );
  }, [userProgressData]);

  /* ---------- Handlers (SAMA) ---------- */
  const handleChangeF1 = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormStateF1((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  };
  const handleChangeF2 = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormStateF2((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  };
  const handleChangeUpdateF1 = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setUpdateStateF1((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  };
  const handleChangeUpdateF2 = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setUpdateStateF2((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleSubmitSurveyAct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      if (!formStateF1.name || !formStateF1.slug) {
        toast.error("Nama dan slug wajib diisi!");
        return;
      }
      await addSurveyActivity({ variables: { input: { ...formStateF1 } } });
      toast.success("Data Tim berhasil ditambahkan!");
      setFormStateF1({ name: "", slug: "" });
    } catch (err: any) {
      toast.error("Gagal menambah Data Tim.");
      console.error("❌ Error create:", err);
    }
  };

  const handleSubmitSubSurveyAct = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    try {
      if (
        !formStateF2.name ||
        !formStateF2.slug ||
        !formStateF2.surveyActivityId ||
        !formStateF2.startDate ||
        !formStateF2.endDate ||
        !formStateF2.targetSample
      ) {
        toast.error("Semua field wajib diisi!");
        return;
      }
      await addSubSurveyActivity({
        variables: {
          input: {
            ...formStateF2,
            startDate: new Date(formStateF2.startDate),
            endDate: new Date(formStateF2.endDate),
            targetSample: parseInt(formStateF2.targetSample.toString(), 10),
            sampleType: formStateF2.sampleType,
            activityType: formStateF2.activityType,
          },
        },
      });
      toast.success("Kegiatan Survey berhasil ditambahkan!");
      setFormStateF2({
        name: "",
        slug: "",
        surveyActivityId: "",
        startDate: "",
        endDate: "",
        targetSample: 0,
        sampleType: "",
        activityType: "",
      });
    } catch (err: any) {
      toast.error("Gagal menambah Kegiatan Survey.");
      console.error("❌ Error create:", err);
    }
  };

  const handleUpdateSurveyAct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const { surveyActivityId, name, slug } = updateStateF1;
      if (!surveyActivityId || !name || !slug) {
        toast.error("Semua field wajib diisi!");
        return;
      }
      await updateSurveyActivity({
        variables: { surveyActivityId, input: { name, slug } },
      });
      toast.success("Tim berhasil diupdate!");
      setUpdateStateF1({ surveyActivityId: "", name: "", slug: "" });
    } catch (err) {
      toast.error("Gagal perbarui Tim.");
      console.error(err);
    }
  };

  const handleUpdateSubSurveyAct = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    try {
      const {
        subSurveyActivityId,
        name,
        slug,
        surveyActivityId,
        startDate,
        endDate,
        targetSample,
        sampleType,
        activityType,
      } = updateStateF2;
      if (
        !subSurveyActivityId ||
        !name ||
        !slug ||
        !surveyActivityId ||
        !startDate ||
        !endDate ||
        !targetSample ||
        !sampleType ||
        !activityType
      ) {
        toast.error("Semua field wajib diisi!");
        return;
      }
      await updateSubSurveyActivity({
        variables: {
          subSurveyActivityId,
          input: {
            name,
            slug,
            surveyActivityId,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            targetSample: parseInt(targetSample.toString(), 10),
            sampleType,
          },
        },
      });
      toast.success("Kegiatan berhasil diupdate!");
      setUpdateStateF2({
        subSurveyActivityId: "",
        name: "",
        slug: "",
        surveyActivityId: "",
        startDate: "",
        endDate: "",
        targetSample: 0,
        sampleType: "",
        activityType: "",
      });
    } catch (err) {
      toast.error("Gagal perbarui kegiatan.");
      console.error(err);
    }
  };

  const handleChangeUserProgress = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setUserProgressForm((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  };
  const handleChangeUpdateUserProgress = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setUpdateUserProgressForm((prev) => ({
      ...prev,
      [e.target.id]: e.target.value,
    }));
  };

  const handleSubmitUserProgress = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    try {
      if (userProgressForm.subSurveyActivityId && userProgressForm.userId) {
        const totalTarget = Number(selectedSubForAdd?.targetSample ?? 0);
        const already = assignedSumForAdd;
        const remain = Math.max(0, totalTarget - already);
        if (Number(userProgressForm.totalAssigned) > remain) {
          toast.error(
            `Alokasi melebihi sisa sampel (${remain}). Sesuaikan jumlahnya.`
          );
          return;
        }
        if (remain <= 0) {
          toast.error("Sisa sampel sudah habis untuk kegiatan ini.");
          return;
        }
        if (usedUserIdsForAdd.has(userProgressForm.userId)) {
          toast.error("Petugas ini sudah ditugaskan pada kegiatan ini.");
          return;
        }
      }

      await createUserSurveyProgress({
        variables: {
          input: {
            userId: userProgressForm.userId,
            subSurveyActivityId: userProgressForm.subSurveyActivityId,
            totalAssigned: Number(userProgressForm.totalAssigned),
            submitCount: Number(userProgressForm.submitCount),
            approvedCount: Number(userProgressForm.approvedCount),
            rejectedCount: Number(userProgressForm.rejectedCount),
            lastUpdated: new Date().toISOString(),
            districtId: userProgressForm.districtId,
          },
        },
      });
      toast.success("UserProgress berhasil ditambahkan!");
      setUserProgressForm({
        surveyActivityId: "",
        subSurveyActivityId: "",
        userId: "",
        totalAssigned: 0,
        submitCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        lastUpdated: "",
        districtId: "",
      });
    } catch (err) {
      toast.error("Gagal tambah user progress");
      console.error(err);
    }
  };

  const handleUpdateUserProgress = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    try {
      if (updateUserProgressForm.subSurveyActivityId) {
        const target = Number(selectedSubForUpdate?.targetSample ?? 0);
        const currentAssigned = Number(currentUP?.totalAssigned ?? 0);
        const others = sumAllAssignedForUpdate - currentAssigned;
        const allowedMax = Math.max(0, target - others);

        if (Number(updateUserProgressForm.totalAssigned) > allowedMax) {
          toast.error(
            `Alokasi melebihi batas untuk petugas ini (${allowedMax}).`
          );
          return;
        }
        if (allowedMax <= 0) {
          toast.error("Tidak ada sisa sampel yang dapat dialokasikan.");
          return;
        }
      }

      await updateUserSurveyProgress({
        variables: {
          userProgressId: updateUserProgressForm.userProgressId,
          input: {
            totalAssigned: Number(updateUserProgressForm.totalAssigned),
            submitCount: Number(updateUserProgressForm.submitCount),
            approvedCount: Number(updateUserProgressForm.approvedCount),
            rejectedCount: Number(updateUserProgressForm.rejectedCount),
            lastUpdated: new Date(
              updateUserProgressForm.lastUpdated
            ).toISOString(),
          },
        },
      });
      toast.success("Petugas berhasil diupdate!");
      setUpdateUserProgressForm({
        userProgressId: "",
        subSurveyActivityId: "",
        surveyActivityId: "",
        userId: "",
        totalAssigned: 0,
        submitCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        lastUpdated: "",
      });
    } catch (err) {
      toast.error("Gagal perbarui petugas");
      console.error(err);
    }
  };

  /* ---------- Effects (SAMA) ---------- */
  useEffect(() => {
    if (updateStateF2.surveyActivityId) {
      fetchSubForSubSurveys({
        variables: { surveyActivityId: updateStateF2.surveyActivityId },
      });
    }
  }, [updateStateF2.surveyActivityId, fetchSubForSubSurveys]);

  useEffect(() => {
    if (userProgressForm.surveyActivityId) {
      fetchSubForSubmitUP({
        variables: { surveyActivityId: userProgressForm.surveyActivityId },
      });
    }
  }, [userProgressForm.surveyActivityId, fetchSubForSubmitUP]);

  useEffect(() => {
    if (updateUserProgressForm.surveyActivityId) {
      fetchSubForUpdateUP({
        variables: {
          surveyActivityId: updateUserProgressForm.surveyActivityId,
        },
      });
    }
  }, [updateUserProgressForm.surveyActivityId, fetchSubForUpdateUP]);

  useEffect(() => {
    if (updateUserProgressForm.subSurveyActivityId) {
      fetchUserProgress({
        variables: {
          subSurveyActivityId: updateUserProgressForm.subSurveyActivityId,
        },
      });
    }
  }, [updateUserProgressForm.subSurveyActivityId, fetchUserProgress]);

  useEffect(() => {
    const s = surveyMap[updateStateF1.surveyActivityId];
    if (s) {
      setUpdateStateF1((prev) => ({
        ...prev,
        name: s.name ?? "",
        slug: s.slug ?? "",
      }));
    } else {
      setUpdateStateF1((prev) => ({ ...prev, name: "", slug: "" }));
    }
  }, [updateStateF1.surveyActivityId, surveyMap]);

  useEffect(() => {
    const sub = subMap[updateStateF2.subSurveyActivityId];
    if (sub) {
      setUpdateStateF2((prev) => ({
        ...prev,
        name: sub.name ?? "",
        slug: sub.slug ?? "",
        surveyActivityId: sub.surveyActivityId ?? prev.surveyActivityId,
        startDate: toDateInput(sub.startDate),
        endDate: toDateInput(sub.endDate),
        targetSample: Number(sub.targetSample ?? 0),
        sampleType: sub.sampleType ?? prev.sampleType,
        activityType: sub.activityType ?? prev.activityType,
      }));
    } else {
      // jika direset, biarkan nilai input manual/terakhir
    }
  }, [updateStateF2.subSurveyActivityId, subMap]);

  useEffect(() => {
    setUserProgressForm((prev) => ({
      ...prev,
      subSurveyActivityId: "",
      userId: "",
    }));
  }, [userProgressForm.surveyActivityId]);

  useEffect(() => {
    const up = upMap[updateUserProgressForm.userProgressId];
    if (up) {
      setUpdateUserProgressForm((prev) => ({
        ...prev,
        // opsional: sinkronkan subSurveyActivityId kalau mau
        // subSurveyActivityId: up.subSurveyActivityId ?? prev.subSurveyActivityId,
        totalAssigned: Number(up.totalAssigned ?? 0),
        submitCount: Number(up.submitCount ?? 0),
        approvedCount: Number(up.approvedCount ?? 0),
        rejectedCount: Number(up.rejectedCount ?? 0),
        // tampilkan tanggal di input date; kalau bukan date input, ganti sesuai kebutuhan
        lastUpdated: toDateInput(up.lastUpdated),
      }));
    } else {
      // kosongkan bila pilihan direset
      setUpdateUserProgressForm((prev) => ({
        ...prev,
        totalAssigned: 0,
        submitCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        lastUpdated: "",
      }));
    }
  }, [updateUserProgressForm.userProgressId, upMap]);

  useEffect(() => {
    // kamu sudah memanggil fetchUserProgress di efek lain; cukup reset pilihan id-nya
    setUpdateUserProgressForm((prev) => ({ ...prev, userProgressId: "" }));
  }, [updateUserProgressForm.subSurveyActivityId]);

  useEffect(() => {
    if (userProgressForm.subSurveyActivityId) {
      fetchUserProgress({
        variables: {
          subSurveyActivityId: userProgressForm.subSurveyActivityId,
        },
      });
    }
  }, [userProgressForm.subSurveyActivityId, fetchUserProgress]);

  useEffect(() => {
    if (userProgressForm.subSurveyActivityId) {
      fetchUserProgress({
        variables: {
          subSurveyActivityId: userProgressForm.subSurveyActivityId,
        },
      });
    }
  }, [userProgressForm.subSurveyActivityId, fetchUserProgress]);

  /*===================== LOGIC ===================== */
  const selectedSubForAdd = React.useMemo(() => {
    return (SubmitUPData?.subSurveyActivityById ?? []).find(
      (s: SubSurveyActivity) => s.id === userProgressForm.subSurveyActivityId
    );
  }, [SubmitUPData, userProgressForm.subSurveyActivityId]);

  // total yang sudah dialokasikan ke semua petugas pada sub-kegiatan tsb
  const assignedSumForAdd = React.useMemo(() => {
    const list = userProgressData?.userProgressBySubSurveyActivityId ?? [];
    return list.reduce(
      (acc: number, up: UserProgress) => acc + Number(up.totalAssigned ?? 0),
      0
    );
  }, [userProgressData]);

  const remainingQuotaForAdd = Math.max(
    0,
    Number(selectedSubForAdd?.targetSample ?? 0) - assignedSumForAdd
  );

  const selectedSubForUpdate = React.useMemo(() => {
    return (UpdateUPData?.subSurveyActivityById ?? []).find(
      (s: SubSurveyActivity) =>
        s.id === updateUserProgressForm.subSurveyActivityId
    );
  }, [UpdateUPData, updateUserProgressForm.subSurveyActivityId]);

  const upListForUpdate: UserProgress[] =
    userProgressData?.userProgressBySubSurveyActivityId ?? [];

  const currentUP = React.useMemo(() => {
    return upListForUpdate.find(
      (u) => u.id === updateUserProgressForm.userProgressId
    );
  }, [upListForUpdate, updateUserProgressForm.userProgressId]);

  const sumAllAssignedForUpdate = React.useMemo(() => {
    return upListForUpdate.reduce(
      (acc: number, u) => acc + Number(u.totalAssigned ?? 0),
      0
    );
  }, [upListForUpdate]);

  const allowedMaxForUpdate = React.useMemo(() => {
    const target = Number(selectedSubForUpdate?.targetSample ?? 0);
    const currentAssigned = Number(currentUP?.totalAssigned ?? 0);
    const others = sumAllAssignedForUpdate - currentAssigned;
    return Math.max(0, target - others);
  }, [selectedSubForUpdate, currentUP, sumAllAssignedForUpdate]);

  const existingUPForAdd: UserProgressWithUser[] =
    userProgressData?.userProgressBySubSurveyActivityId ?? [];

  const usedUserIdsForAdd = React.useMemo(() => {
    return new Set(existingUPForAdd.map((up) => up.userId));
  }, [existingUPForAdd]);

  /* ===================== UI ===================== */
  return (
    <div className="px-8 py-6 space-y-4 font-Poppins">
      {/* Main Tabs */}
      <Tabs
        tabs={[
          { key: "tim", label: "Tim" },
          { key: "kegiatan", label: "Kegiatan Survei" },
          { key: "petugas", label: "Petugas" },
        ]}
        value={section}
        onChange={setSection}
      />

      {/* Sub Tabs */}
      <div className="flex items-center justify-between">
        <SubTabs
          tabs={[
            { key: "add", label: "Tambah" },
            { key: "update", label: "Ubah" },
          ]}
          value={mode}
          onChange={setMode}
        />
        {loading && <span className="text-xs text-gray-500">Memuat data…</span>}
      </div>

      {/* ---------- TIM ---------- */}
      {section === "tim" && mode === "add" && (
        <div className="bg-orange-50 rounded-lg p-4 shadow-md">
          <form onSubmit={handleSubmitSurveyAct} className="space-y-4">
            <h3 className="text-lg font-bold">Tambahkan Tim</h3>
            <div>
              <label htmlFor="name" className="block text-sm font-bold mb-2">
                Nama Tim
              </label>
              <input
                type="text"
                id="name"
                value={formStateF1.name}
                onChange={handleChangeF1}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label htmlFor="slug" className="block text-sm font-bold mb-2">
                Slug
              </label>
              <input
                type="text"
                id="slug"
                value={formStateF1.slug}
                onChange={handleChangeF1}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <button
              disabled={loading1}
              type="submit"
              className={`${styles.button} my-2 text-white`}
            >
              {loading1 ? "Menyimpan..." : "Tambah"}
            </button>
          </form>
        </div>
      )}

      {section === "tim" && mode === "update" && (
        <div className="bg-blue-50 rounded-lg p-4 shadow-md">
          <form onSubmit={handleUpdateSurveyAct} className="space-y-4">
            <h3 className="text-lg font-bold">Perbarui Tim</h3>
            <div>
              <label htmlFor="name" className="block text-sm font-bold mb-2">
                Nama Tim
              </label>
              <select
                id="surveyActivityId"
                value={updateStateF1.surveyActivityId}
                onChange={handleChangeUpdateF1}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Pilih Tim --</option>
                {data?.allSurveyActivities.map((s: SurveyActivity) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-bold mb-2">
                Nama Tim Baru
              </label>
              <input
                type="text"
                id="name"
                placeholder="Nama baru"
                value={updateStateF1.name}
                onChange={handleChangeUpdateF1}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label htmlFor="slug" className="block text-sm font-bold mb-2">
                Nama Slug Baru
              </label>
              <input
                type="text"
                id="slug"
                placeholder="Slug baru"
                value={updateStateF1.slug}
                onChange={handleChangeUpdateF1}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <button
              type="submit"
              className={`${styles.button} my-2 text-white`}
            >
              Perbarui Tim
            </button>
          </form>
        </div>
      )}

      {/* ---------- KEGIATAN SURVEI ---------- */}
      {section === "kegiatan" && mode === "add" && (
        <div className="bg-orange-50 rounded-lg p-4 shadow-md">
          <form onSubmit={handleSubmitSubSurveyAct} className="space-y-4">
            <h3 className="text-lg font-bold">Tambah Kegiatan</h3>
            <div>
              <label htmlFor="name" className="block text-sm font-bold mb-2">
                Nama Kegiatan
              </label>
              <input
                type="text"
                id="name"
                value={formStateF2.name}
                onChange={handleChangeF2}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label htmlFor="slug" className="block text-sm font-bold mb-2">
                Slug
              </label>
              <input
                type="text"
                id="slug"
                value={formStateF2.slug}
                onChange={handleChangeF2}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label
                htmlFor="surveyActivityId"
                className="block text-sm font-bold mb-2"
              >
                Tim
              </label>
              <select
                name="surveyActivityId"
                id="surveyActivityId"
                value={formStateF2.surveyActivityId}
                onChange={handleChangeF2}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Pilih Tim --</option>
                {data?.allSurveyActivities.map(
                  (surveyActivity: SurveyActivity) => (
                    <option key={surveyActivity.id} value={surveyActivity.id}>
                      {surveyActivity.name}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <label
                htmlFor="startDate"
                className="block text-sm font-bold mb-2"
              >
                Tanggal Mulai
              </label>
              <input
                type="date"
                id="startDate"
                value={formStateF2.startDate}
                onChange={handleChangeF2}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-bold mb-2">
                Tanggal Selesai
              </label>
              <input
                type="date"
                id="endDate"
                value={formStateF2.endDate}
                onChange={handleChangeF2}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label
                htmlFor="targetSample"
                className="block text-sm font-bold mb-2"
              >
                Target Sampel
              </label>
              <input
                type="number"
                id="targetSample"
                value={formStateF2.targetSample}
                onChange={handleChangeF2}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label
                htmlFor="sampleType"
                className="block text-sm font-bold mb-2"
              >
                Jenis Sampel
              </label>
              <input
                type="text"
                id="sampleType"
                value={formStateF2.sampleType}
                onChange={handleChangeF2}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label
                htmlFor="activityType"
                className="block text-sm font-bold mb-2"
              >
                Jenis Kegiatan
              </label>
              <select
                id="activityType"
                value={formStateF2.activityType}
                onChange={handleChangeF2}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Pilih Jenis Kegiatan --</option>
                <option value="Listing">Listing</option>
                <option value="Pencacahan">Pencacahan</option>
              </select>
            </div>
            <button
              disabled={loading2}
              type="submit"
              className={`${styles.button} my-2 text-white`}
            >
              {loading2 ? "Menyimpan..." : "Tambah"}
            </button>
          </form>
        </div>
      )}

      {section === "kegiatan" && mode === "update" && (
        <div className="bg-blue-50 rounded-lg p-4 shadow-md">
          <form onSubmit={handleUpdateSubSurveyAct} className="space-y-4">
            <h3 className="text-lg font-bold">Perbarui Kegiatan</h3>
            <div>
              <label
                htmlFor="surveyActivityId"
                className="block text-sm font-bold mb-2"
              >
                Tim Penyelenggara Kegiatan
              </label>
              <select
                id="surveyActivityId"
                value={updateStateF2.surveyActivityId}
                onChange={handleChangeUpdateF2}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Pilih Tim --</option>
                {data?.allSurveyActivities.map((s: SurveyActivity) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="subSurveyActivityId"
                className="block text-sm font-bold mb-2"
              >
                Kegiatan Survei
              </label>
              <select
                id="subSurveyActivityId"
                value={updateStateF2.subSurveyActivityId}
                onChange={handleChangeUpdateF2}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Pilih Kegiatan --</option>
                {SubSurveydata?.subSurveyActivityById?.map(
                  (sub: SubSurveyActivity) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-bold mb-2">
                Nama Kegiatan Baru
              </label>
              <input
                type="text"
                id="name"
                placeholder="Nama baru"
                value={updateStateF2.name}
                onChange={handleChangeUpdateF2}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label htmlFor="slug" className="block text-sm font-bold mb-2">
                Nama Slug Baru
              </label>
              <input
                type="text"
                id="slug"
                placeholder="Slug baru"
                value={updateStateF2.slug}
                onChange={handleChangeUpdateF2}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label
                htmlFor="startDate"
                className="block text-sm font-bold mb-2"
              >
                Tanggal Mulai
              </label>
              <input
                type="date"
                id="startDate"
                value={updateStateF2.startDate}
                onChange={handleChangeUpdateF2}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-bold mb-2">
                Tanggal Selesai
              </label>
              <input
                type="date"
                id="endDate"
                value={updateStateF2.endDate}
                onChange={handleChangeUpdateF2}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label
                htmlFor="targetSample"
                className="block text-sm font-bold mb-2"
              >
                Target Sample
              </label>
              <input
                type="number"
                id="targetSample"
                value={updateStateF2.targetSample}
                onChange={handleChangeUpdateF2}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label
                htmlFor="sampleType"
                className="block text-sm font-bold mb-2"
              >
                Jenis Sampel
              </label>
              <input
                type="text"
                id="sampleType"
                value={updateStateF2.sampleType}
                onChange={handleChangeUpdateF2}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label
                htmlFor="activityType"
                className="block text-sm font-bold mb-2"
              >
                Jenis Kegiatan
              </label>
              <input
                type="text"
                id="activityType"
                value={updateStateF2.activityType}
                onChange={handleChangeUpdateF2}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <button
              type="submit"
              className={`${styles.button} my-2 text-white`}
            >
              Perbarui Kegiatan
            </button>
          </form>
        </div>
      )}

      {/* ---------- PETUGAS ---------- */}
      {section === "petugas" && mode === "add" && (
        <div className="bg-orange-50 rounded-lg p-4 shadow-md">
          <form onSubmit={handleSubmitUserProgress} className="space-y-3">
            <h3 className="text-lg font-bold">Tambah Petugas</h3>
            <div>
              <label
                htmlFor="surveyActivityId"
                className="block text-sm font-bold mb-2"
              >
                Tim Penyelenggara Kegiatan
              </label>
              <select
                id="surveyActivityId"
                value={userProgressForm.surveyActivityId}
                onChange={handleChangeUserProgress}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Pilih Tim --</option>
                {data?.allSurveyActivities.map((s: SurveyActivity) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="subSurveyActivityId"
                className="block text-sm font-bold mb-2"
              >
                Kegiatan Survei
              </label>
              <select
                id="subSurveyActivityId"
                value={userProgressForm.subSurveyActivityId}
                onChange={handleChangeUserProgress}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Pilih Kegiatan --</option>
                {SubmitUPData?.subSurveyActivityById?.map(
                  (sub: SubSurveyActivity) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  )
                )}
              </select>
              {userProgressForm.subSurveyActivityId && (
                <div className="mt-1 text-xs">
                  <span className="inline-block rounded bg-white border px-2 py-1">
                    Target total: <b>{selectedSubForAdd?.targetSample ?? 0}</b>{" "}
                    • Sudah dialokasikan: <b>{assignedSumForAdd}</b> • Sisa
                    sample: <b>{remainingQuotaForAdd}</b>
                  </span>
                </div>
              )}
            </div>
            <div>
              <label htmlFor="userId" className="block text-sm font-bold mb-2">
                Petugas
              </label>
              <select
                id="userId"
                value={userProgressForm.userId}
                onChange={handleChangeUserProgress}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                disabled={!userProgressForm.subSurveyActivityId}
              >
                <option value="">
                  {userProgressForm.subSurveyActivityId
                    ? "-- Pilih Pengguna --"
                    : "Pilih Kegiatan dulu"}
                </option>

                {userData?.getUsers?.map((user: User) => {
                  const alreadyUsed = usedUserIdsForAdd.has(user.id);

                  if (alreadyUsed) return null;
                  
                  return (
                    <option key={user.id} value={user.id}>
                      {user.name} - {user.email}
                    </option>
                  );
                })}
              </select>

              {/* Info bila semua user sudah terdaftar */}
              {userProgressForm.subSurveyActivityId &&
                (userData?.getUsers?.length ?? 0) > 0 &&
                usedUserIdsForAdd.size >= (userData?.getUsers?.length ?? 0) && (
                  <p className="mt-1 text-xs text-red-600">
                    Semua pengguna sudah terdaftar pada kegiatan ini.
                  </p>
                )}
            </div>

            <div>
              <label
                htmlFor="totalAssigned"
                className="block text-sm font-bold mb-2"
              >
                Total Sampel Petugas
              </label>
              <input
                type="number"
                id="totalAssigned"
                placeholder="Total Assigned"
                min={0}
                max={
                  userProgressForm.subSurveyActivityId
                    ? remainingQuotaForAdd
                    : undefined
                }
                value={userProgressForm.totalAssigned}
                onChange={(e) => {
                  const raw = Number(e.target.value);
                  const capped = userProgressForm.subSurveyActivityId
                    ? Math.min(Math.max(0, raw), remainingQuotaForAdd)
                    : Math.max(0, raw);
                  setUserProgressForm((prev) => ({
                    ...prev,
                    totalAssigned: capped,
                  }));
                }}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              {/* ⬇️ hint validasi */}
              {userProgressForm.subSurveyActivityId && (
                <p className="mt-1 text-xs text-gray-600">
                  Maksimal alokasi untuk petugas ini:{" "}
                  <b>{remainingQuotaForAdd}</b>
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="submitCount"
                className="block text-sm font-bold mb-2"
              >
                Jumlah Submit oleh Petugas
              </label>
              <input
                type="number"
                id="submitCount"
                placeholder="Submit Count"
                value={userProgressForm.submitCount}
                onChange={handleChangeUserProgress}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label
                htmlFor="approvedCount"
                className="block text-sm font-bold mb-2"
              >
                Jumlah Approved oleh PML
              </label>
              <input
                type="number"
                id="approvedCount"
                placeholder="Approved Count"
                value={userProgressForm.approvedCount}
                onChange={handleChangeUserProgress}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label
                htmlFor="rejectedCount"
                className="block text-sm font-bold mb-2"
              >
                Jumlah Rejected oleh PML
              </label>
              <input
                type="number"
                id="rejectedCount"
                placeholder="Rejected Count"
                value={userProgressForm.rejectedCount}
                onChange={handleChangeUserProgress}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label htmlFor="districtId" className="block text-sm font-bold">
                Kecamatan
              </label>
              <select
                id="districtId"
                value={userProgressForm.districtId}
                onChange={handleChangeUserProgress}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Pilih Kecamatan --</option>
                {districtData?.getAllSurveyDistrict?.map(
                  (district: District) => (
                    <option key={district.id} value={district.id}>
                      {district.name}
                    </option>
                  )
                )}
              </select>
            </div>
            <button
              type="submit"
              className={`${styles.button} my-2 text-white`}
              disabled={
                !!userProgressForm.subSurveyActivityId &&
                remainingQuotaForAdd <= 0
              }
            >
              Tambah
            </button>
          </form>
        </div>
      )}

      {section === "petugas" && mode === "update" && (
        <div className="bg-blue-100 rounded-lg p-4 shadow-md">
          <form onSubmit={handleUpdateUserProgress} className="space-y-3">
            <h3 className="text-lg font-bold">Perbarui Petugas</h3>
            <div>
              <label
                htmlFor="surveyActivityId"
                className="block text-sm font-bold mb-2"
              >
                Tim Penyelenggara Kegiatan
              </label>
              <select
                id="surveyActivityId"
                value={updateUserProgressForm.surveyActivityId}
                onChange={handleChangeUpdateUserProgress}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Pilih Tim --</option>
                {data?.allSurveyActivities.map((s: SurveyActivity) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="subSurveyActivityId"
                className="block text-sm font-bold mb-2"
              >
                Kegiatan Survei
              </label>
              <select
                id="subSurveyActivityId"
                value={updateUserProgressForm.subSurveyActivityId}
                onChange={handleChangeUpdateUserProgress}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Pilih Kegiatan --</option>
                {UpdateUPData?.subSurveyActivityById?.map(
                  (sub: SubSurveyActivity) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  )
                )}
              </select>
              {updateUserProgressForm.subSurveyActivityId && (
                <div className="mt-1 text-xs">
                  <span className="inline-block rounded bg-white border px-2 py-1">
                    Target total:{" "}
                    <b>{selectedSubForUpdate?.targetSample ?? 0}</b> • Total
                    alokasi (semua): <b>{sumAllAssignedForUpdate}</b> • Maks
                    yang bisa Anda set untuk petugas ini:{" "}
                    <b>{allowedMaxForUpdate}</b>
                  </span>
                </div>
              )}
            </div>
            <div>
              <label
                htmlFor="userProgressId"
                className="block text-sm font-bold mb-2"
              >
                Petugas
              </label>
              <select
                id="userProgressId"
                value={updateUserProgressForm.userProgressId}
                onChange={handleChangeUpdateUserProgress}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Pilih Petugas --</option>
                {userProgressData?.userProgressBySubSurveyActivityId?.map(
                  (up: UserProgressWithUser) => (
                    <option key={up.id} value={up.id}>
                      {up.user?.name} - {up.user?.email}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <label
                htmlFor="totalAssigned"
                className="block text-sm font-bold mb-2"
              >
                Total Sampel Petugas
              </label>
              <input
                type="number"
                id="totalAssigned"
                placeholder="Total Assigned"
                min={0}
                max={
                  updateUserProgressForm.subSurveyActivityId
                    ? allowedMaxForUpdate
                    : undefined
                }
                value={updateUserProgressForm.totalAssigned}
                onChange={(e) => {
                  const raw = Number(e.target.value);
                  const capped = updateUserProgressForm.subSurveyActivityId
                    ? Math.min(Math.max(0, raw), allowedMaxForUpdate)
                    : Math.max(0, raw);
                  setUpdateUserProgressForm((prev) => ({
                    ...prev,
                    totalAssigned: capped,
                  }));
                }}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              {updateUserProgressForm.subSurveyActivityId && (
                <p className="mt-1 text-xs text-gray-600">
                  Maksimal alokasi terbaru untuk petugas ini:{" "}
                  <b>{allowedMaxForUpdate}</b>
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="submitCount"
                className="block text-sm font-bold mb-2"
              >
                Jumlah Submit oleh Petugas
              </label>
              <input
                type="number"
                id="submitCount"
                placeholder="Submit Count"
                value={updateUserProgressForm.submitCount}
                onChange={handleChangeUpdateUserProgress}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label
                htmlFor="approvedCount"
                className="block text-sm font-bold mb-2"
              >
                Jumlah Approved oleh PML
              </label>
              <input
                type="number"
                id="approvedCount"
                placeholder="Approved Count"
                value={updateUserProgressForm.approvedCount}
                onChange={handleChangeUpdateUserProgress}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label
                htmlFor="rejectedCount"
                className="block text-sm font-bold mb-2"
              >
                Jumlah Rejected oleh PML
              </label>
              <input
                type="number"
                id="rejectedCount"
                placeholder="Rejected Count"
                value={updateUserProgressForm.rejectedCount}
                onChange={handleChangeUpdateUserProgress}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <button
              type="submit"
              className={`${styles.button} my-2 text-white`}
            >
              Update
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default Admin;
