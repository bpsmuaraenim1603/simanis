"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  useApolloClient,
  useLazyQuery,
  useMutation,
  useQuery,
} from "@apollo/client";
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
import HUComboBox from "@/src/components/HUCombobox";
import HUSelect from "@/src/components/HUSelect";

/* ====== (type definitions sama persis dengan punyamu) ====== */
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
  blockCount: string;
  lastUpdated: string;
  districtId: string;
};
type UserProgressWithUser = UserProgress & {
  user?: { name: string; email: string };
};

/* =============== Tabs Components (dioptimasi responsif) =============== */
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
    <div className="flex flex-wrap gap-2 border-b border-gray-200">
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
        className="inline-flex flex-wrap rounded-xl bg-gray-100 p-1 my-3"
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
              {active && (
                <motion.span
                  layoutId="subtab-pill"
                  className="absolute inset-0 rounded-lg bg-white shadow"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
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
  const [section, setSection] = useState<"tim" | "kegiatan" | "petugas">("tim");
  const [mode, setMode] = useState<"add" | "update">("add");
  useEffect(() => {
    setMode("add");
  }, [section]);

  const client = useApolloClient();
  const [refreshing, setRefreshing] = useState(false);

  /* ---------- State Form (sama) ---------- */
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
    superVisorId: "",
    subSurveyActivityId: "",
    surveyActivityId: "",
    totalAssigned: 0,
    submitCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    blockCount: "",
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
    districtId: "",
  });
  const [qSupervisor, setQSupervisor] = useState("");
  const [qEnumerator, setQEnumerator] = useState("");
  const [qUPUser, setQUPUser] = useState("");
  const qSupervisorDeb = useDebounced(qSupervisor);

  function matchesSearch(u: Partial<User>, q: string) {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [u.name, u.email, (u as any)?.phone_number].some((v) =>
      (v ?? "").toLowerCase().includes(s)
    );
  }
  function matchesUPSearch(up: UserProgressWithUser, q: string) {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [up.user?.name ?? "", up.user?.email ?? ""].some((v) =>
      v.toLowerCase().includes(s)
    );
  }
  function useDebounced<T>(value: T, delay = 200) {
    const [v, setV] = useState(value);
    useEffect(() => {
      const t = setTimeout(() => setV(value), delay);
      return () => clearTimeout(t);
    }, [value, delay]);
    return v;
  }

  /* ---------- Queries & Mutations (sama) ---------- */
  const {
    data,
    loading,
    refetch: refetchSurveyActs,
  } = useQuery(GET_ALL_SURVEY_ACTIVITIES);
  const [fetchSubForSubSurveys, { data: SubSurveydata }] = useLazyQuery(
    GET_ALL_SUB_SURVEY_ACTIVITIES
  );
  const [fetchSubForSubmitUP, { data: SubmitUPData }] = useLazyQuery(
    GET_ALL_SUB_SURVEY_ACTIVITIES
  );
  const [fetchSubForUpdateUP, { data: UpdateUPData }] = useLazyQuery(
    GET_ALL_SUB_SURVEY_ACTIVITIES
  );
  const { data: userData, refetch: refetchUsers } = useQuery(GET_ALL_USERS);
  const { data: districtData, refetch: refetchDistricts } =
    useQuery(GET_ALL_DISTRICT);
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

  const toDateInput = (d?: string | Date) =>
    d ? new Date(d).toISOString().slice(0, 10) : "";

  const surveyMap = useMemo<Record<string, SurveyActivity>>(
    () =>
      Object.fromEntries(
        (data?.allSurveyActivities ?? []).map((s: SurveyActivity) => [s.id, s])
      ),
    [data]
  );
  const subMap = useMemo<Record<string, SubSurveyActivity>>(
    () =>
      Object.fromEntries(
        (SubSurveydata?.subSurveyActivityById ?? []).map(
          (s: SubSurveyActivity) => [s.id, s]
        )
      ),
    [SubSurveydata]
  );
  const upMap = useMemo<Record<string, UserProgressWithUser>>(
    () =>
      Object.fromEntries(
        (userProgressData?.userProgressBySubSurveyActivityId ?? []).map(
          (u: any) => [u.id, u]
        )
      ),
    [userProgressData]
  );

  const handleChangeF1 = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormStateF1((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  const handleChangeF2 = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setFormStateF2((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  const handleChangeUpdateF1 = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setUpdateStateF1((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  const handleChangeUpdateF2 = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setUpdateStateF2((prev) => ({ ...prev, [e.target.id]: e.target.value }));

  const handleSubmitSurveyAct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      if (!formStateF1.name || !formStateF1.slug) {
        toast.error("Nama dan slug wajib diisi!");
        return;
      }
      await addSurveyActivity({ variables: { input: { ...formStateF1 } } });
      toast.success("Data Tim berhasil ditambahkan!");
      handleRefresh();
      setFormStateF1({ name: "", slug: "" });
    } catch (err) {
      toast.error("Gagal menambah Data Tim.");
      console.error("❌ Error create:", err);
    }
  };

  const handleSubmitSubSurveyAct = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    try {
      const f = formStateF2;
      if (
        !f.name ||
        !f.slug ||
        !f.surveyActivityId ||
        !f.startDate ||
        !f.endDate ||
        !f.targetSample
      ) {
        toast.error("Semua field wajib diisi!");
        return;
      }
      await addSubSurveyActivity({
        variables: {
          input: {
            ...f,
            startDate: new Date(f.startDate),
            endDate: new Date(f.endDate),
            targetSample: parseInt(f.targetSample.toString(), 10),
          },
        },
      });
      toast.success("Kegiatan Survey berhasil ditambahkan!");
      handleRefresh();
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
    } catch (err) {
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
      handleRefresh();
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
      const f = updateStateF2;
      if (
        !f.subSurveyActivityId ||
        !f.name ||
        !f.slug ||
        !f.surveyActivityId ||
        !f.startDate ||
        !f.endDate ||
        !f.targetSample ||
        !f.sampleType ||
        !f.activityType
      ) {
        toast.error("Semua field wajib diisi!");
        return;
      }
      await updateSubSurveyActivity({
        variables: {
          subSurveyActivityId: f.subSurveyActivityId,
          input: {
            name: f.name,
            slug: f.slug,
            surveyActivityId: f.surveyActivityId,
            startDate: new Date(f.startDate),
            endDate: new Date(f.endDate),
            targetSample: parseInt(f.targetSample.toString(), 10),
            sampleType: f.sampleType,
            activityType: f.activityType,
          },
        },
      });
      toast.success("Kegiatan berhasil diupdate!");
      handleRefresh();
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
  ) =>
    setUserProgressForm((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  const handleChangeUpdateUserProgress = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) =>
    setUpdateUserProgressForm((prev) => ({
      ...prev,
      [e.target.id]: e.target.value,
    }));

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
          toast.error(`Alokasi melebihi sisa sampel (${remain}).`);
          return;
        }
        if (remain <= 0) {
          toast.error("Sisa sampel sudah habis untuk kegiatan ini.");
          return;
        }
        // if (usedUserIdsForAdd.has(userProgressForm.userId)) {
        //   toast.error("Petugas ini sudah ditugaskan pada kegiatan ini.");
        //   return;
        // }
      }

      await createUserSurveyProgress({
        variables: {
          input: {
            userId: userProgressForm.userId,
            superVisorId: userProgressForm.superVisorId,
            subSurveyActivityId: userProgressForm.subSurveyActivityId,
            totalAssigned: Number(userProgressForm.totalAssigned),
            submitCount: Number(userProgressForm.submitCount),
            approvedCount: Number(userProgressForm.approvedCount),
            rejectedCount: Number(userProgressForm.rejectedCount),
            blockCount: userProgressForm.blockCount,
            lastUpdated: new Date().toISOString(),
            districtId: userProgressForm.districtId,
          },
        },
      });
      toast.success("UserProgress berhasil ditambahkan!");
      handleRefresh();
      setUserProgressForm({
        surveyActivityId: userProgressForm.surveyActivityId,
        subSurveyActivityId: userProgressForm.subSurveyActivityId,
        userId: "",
        totalAssigned: 0,
        submitCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        blockCount: "",
        lastUpdated: "",
        districtId: "",
        superVisorId: userProgressForm.superVisorId,
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

        const intendedTotalAssigned = isListingUpdate
          ? Number(updateUserProgressForm.submitCount ?? 0)
          : Number(updateUserProgressForm.totalAssigned ?? 0);

        const cappedTotalAssigned = updateUserProgressForm.subSurveyActivityId
          ? Math.min(Math.max(0, intendedTotalAssigned), allowedMax)
          : Math.max(0, intendedTotalAssigned);

        if (intendedTotalAssigned > allowedMax) {
          toast.error(
            `Alokasi melebihi batas untuk petugas ini (${allowedMax}).`
          );
          return;
        }
        if (allowedMax <= 0) {
          toast.error("Tidak ada sisa sampel yang dapat dialokasikan.");
          return;
        }

        await updateUserSurveyProgress({
          variables: {
            userProgressId: updateUserProgressForm.userProgressId,
            input: {
              totalAssigned: cappedTotalAssigned,
              submitCount: Number(updateUserProgressForm.submitCount),
              approvedCount: Number(updateUserProgressForm.approvedCount),
              rejectedCount: Number(updateUserProgressForm.rejectedCount),
              lastUpdated: new Date(
                updateUserProgressForm.lastUpdated
              ).toISOString(),
              districtId: updateUserProgressForm.districtId,
            },
          },
        });
      } else {
        toast.error("Pilih kegiatan survei terlebih dahulu.");
        return;
      }

      toast.success("Petugas berhasil diupdate!");
      handleRefresh();
      setUpdateUserProgressForm({
        userProgressId: "",
        subSurveyActivityId: updateUserProgressForm.subSurveyActivityId,
        surveyActivityId: updateUserProgressForm.surveyActivityId,
        userId: "",
        totalAssigned: 0,
        submitCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        lastUpdated: "",
        districtId: "",
      });
    } catch (err) {
      toast.error("Gagal perbarui petugas");
      console.error(err);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await client.reFetchObservableQueries?.();
      await Promise.all([
        refetchSurveyActs(),
        refetchUsers(),
        refetchDistricts(),
      ]);

      const jobs: Promise<any>[] = [];
      if (updateStateF2.surveyActivityId) {
        jobs.push(
          fetchSubForSubSurveys({
            variables: { surveyActivityId: updateStateF2.surveyActivityId },
            fetchPolicy: "network-only",
          })
        );
      }
      if (userProgressForm.surveyActivityId) {
        jobs.push(
          fetchSubForSubmitUP({
            variables: { surveyActivityId: userProgressForm.surveyActivityId },
            fetchPolicy: "network-only",
          })
        );
      }
      if (updateUserProgressForm.surveyActivityId) {
        jobs.push(
          fetchSubForUpdateUP({
            variables: {
              surveyActivityId: updateUserProgressForm.surveyActivityId,
            },
            fetchPolicy: "network-only",
          })
        );
      }
      if (updateUserProgressForm.subSurveyActivityId) {
        jobs.push(
          fetchUserProgress({
            variables: {
              subSurveyActivityId: updateUserProgressForm.subSurveyActivityId,
            },
            fetchPolicy: "network-only",
          })
        );
      }
      if (userProgressForm.subSurveyActivityId) {
        jobs.push(
          fetchUserProgress({
            variables: {
              subSurveyActivityId: userProgressForm.subSurveyActivityId,
            },
            fetchPolicy: "network-only",
          })
        );
      }
      if (jobs.length) await Promise.all(jobs);
    } catch (e) {
      console.error("Refresh error:", e);
      toast.error("Gagal refresh data");
    } finally {
      setRefreshing(false);
    }
  };

  // Setter generik untuk form UserProgress (tanpa event)
  const setUPField = <K extends keyof typeof userProgressForm>(
    key: K,
    value: (typeof userProgressForm)[K]
  ) => {
    setUserProgressForm((prev) => ({ ...prev, [key]: value }));
  };

  const setUpdateUPField = <K extends keyof typeof updateUserProgressForm>(
    key: K,
    value: (typeof updateUserProgressForm)[K]
  ) => {
    setUpdateUserProgressForm((prev) => ({ ...prev, [key]: value }));
  };

  const setF2Field = <K extends keyof typeof updateStateF2>(
    key: K,
    value: (typeof updateStateF2)[K]
  ) => {
    setFormStateF2((prev) => ({ ...prev, [key]: value }));
  };

  const setUpdateF2Field = <K extends keyof typeof updateStateF2>(
    key: K,
    value: (typeof updateStateF2)[K]
  ) => {
    setUpdateStateF2((prev) => ({ ...prev, [key]: value }));
  };

  const setUpdateF1Field = <K extends keyof typeof updateStateF1>(
    key: K,
    value: (typeof updateStateF1)[K]
  ) => {
    setUpdateStateF1((prev) => ({ ...prev, [key]: value }));
  };

  const toOpts = <T,>(
    rows: T[],
    pick: (row: T) => { value: string; label: string; subLabel?: string }
  ) => rows.map(pick);

  /* ---------- Effects (sama) ---------- */
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
    setUpdateStateF1((prev) => ({
      ...prev,
      name: s?.name ?? "",
      slug: s?.slug ?? "",
    }));
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
        totalAssigned: Number(up.totalAssigned ?? 0),
        submitCount: Number(up.submitCount ?? 0),
        approvedCount: Number(up.approvedCount ?? 0),
        rejectedCount: Number(up.rejectedCount ?? 0),
        lastUpdated: toDateInput(up.lastUpdated),
        districtId: up.districtId ?? "",
      }));
    } else {
      setUpdateUserProgressForm((prev) => ({
        ...prev,
        totalAssigned: 0,
        submitCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        lastUpdated: "",
        districtId: "",
      }));
    }
  }, [updateUserProgressForm.userProgressId, upMap]);

  useEffect(() => {
    setUpdateUserProgressForm((prev) => ({ ...prev, userProgressId: "" }));
  }, [updateUserProgressForm.subSurveyActivityId]);

  useEffect(() => {
    if (userProgressForm.subSurveyActivityId)
      fetchUserProgress({
        variables: {
          subSurveyActivityId: userProgressForm.subSurveyActivityId,
        },
      });
  }, [userProgressForm.subSurveyActivityId, fetchUserProgress]);

  /*===================== LOGIC ===================== */
  const selectedSubForAdd = useMemo(
    () =>
      (SubmitUPData?.subSurveyActivityById ?? []).find(
        (s: SubSurveyActivity) => s.id === userProgressForm.subSurveyActivityId
      ),
    [SubmitUPData, userProgressForm.subSurveyActivityId]
  );
  const assignedSumForAdd = useMemo(
    () =>
      (userProgressData?.userProgressBySubSurveyActivityId ?? []).reduce(
        (acc: number, up: UserProgress) => acc + Number(up.totalAssigned ?? 0),
        0
      ),
    [userProgressData]
  );
  const remainingQuotaForAdd = Math.max(
    0,
    Number(selectedSubForAdd?.targetSample ?? 0) - assignedSumForAdd
  );

  const selectedSubForUpdate = useMemo(
    () =>
      (UpdateUPData?.subSurveyActivityById ?? []).find(
        (s: SubSurveyActivity) =>
          s.id === updateUserProgressForm.subSurveyActivityId
      ),
    [UpdateUPData, updateUserProgressForm.subSurveyActivityId]
  );
  const isListingUpdate =
    (selectedSubForUpdate?.activityType ?? "") === "Listing";
  const upListForUpdate: UserProgress[] =
    userProgressData?.userProgressBySubSurveyActivityId ?? [];
  const filteredUPsForUpdate = useMemo(
    () => upListForUpdate.filter((up) => matchesUPSearch(up as any, qUPUser)),
    [upListForUpdate, qUPUser]
  );
  const currentUP = useMemo(
    () =>
      upListForUpdate.find(
        (u) => u.id === updateUserProgressForm.userProgressId
      ),
    [upListForUpdate, updateUserProgressForm.userProgressId]
  );
  const sumAllAssignedForUpdate = useMemo(
    () =>
      upListForUpdate.reduce(
        (acc: number, u) => acc + Number(u.totalAssigned ?? 0),
        0
      ),
    [upListForUpdate]
  );
  const allowedMaxForUpdate = useMemo(() => {
    const target = Number(selectedSubForUpdate?.targetSample ?? 0);
    const currentAssigned = Number(currentUP?.totalAssigned ?? 0);
    const others = sumAllAssignedForUpdate - currentAssigned;
    return Math.max(0, target - others);
  }, [selectedSubForUpdate, currentUP, sumAllAssignedForUpdate]);

  const existingUPForAdd: UserProgressWithUser[] =
    userProgressData?.userProgressBySubSurveyActivityId ?? [];
  const usedUserIdsForAdd = useMemo(
    () => new Set(existingUPForAdd.map((up) => up.userId)),
    [existingUPForAdd]
  );

  const supervisors: User[] = useMemo(
    () =>
      (userData?.getUsers ?? []).filter((u: User) => u.role === "Supervisor"),
    [userData]
  );
  const filteredSupervisors = useMemo(
    () => supervisors.filter((u) => matchesSearch(u, qSupervisorDeb)),
    [supervisors, qSupervisorDeb]
  );
  const admins: User[] = useMemo(
    () => (userData?.getUsers ?? []).filter((u: User) => u.role === "Admin"),
    [userData]
  );
  const enumeratorsForAdd: User[] = useMemo(
    () =>
      (userData?.getUsers ?? [])
        .filter((u: User) => u.role !== "Supervisor")
        .filter((u: User) => u.role !== "Admin")
        .filter((u: User) => u.role !== "Superadmin"),
        // .filter((u: User) => !usedUserIdsForAdd.has(u.id)),
    [userData, usedUserIdsForAdd]
  );
  const filteredEnumeratorsForAdd = useMemo(
    () => enumeratorsForAdd.filter((u) => matchesSearch(u, qEnumerator)),
    [enumeratorsForAdd, qEnumerator]
  );

  useEffect(() => {
    if (isListingUpdate) {
      const submit = Number(updateUserProgressForm.submitCount ?? 0);
      const capped = updateUserProgressForm.subSurveyActivityId
        ? Math.min(Math.max(0, submit), allowedMaxForUpdate)
        : Math.max(0, submit);
      setUpdateUserProgressForm((prev) => ({ ...prev, totalAssigned: capped }));
    }
  }, [
    isListingUpdate,
    updateUserProgressForm.submitCount,
    allowedMaxForUpdate,
    updateUserProgressForm.subSurveyActivityId,
  ]);

  /* ===================== UI ===================== */
  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-6 md:px-8 py-6 space-y-4 font-Poppins">
      {/* Main Tabs + actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <Tabs
          tabs={[
            { key: "tim", label: "Tim" },
            { key: "kegiatan", label: "Kegiatan Survei" },
            { key: "petugas", label: "Petugas" },
          ]}
          value={section}
          onChange={setSection}
        />
        <div className="flex items-center gap-2">
          {loading && (
            <span className="text-xs text-gray-500">Memuat data…</span>
          )}
          <button
            onClick={() => {
              handleRefresh();
              toast.success("Data telah di-refresh");
            }}
            disabled={refreshing}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition font-semibold w-full sm:w-auto"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <SubTabs
        tabs={[
          { key: "add", label: "Tambah" },
          { key: "update", label: "Ubah" },
        ]}
        value={mode}
        onChange={setMode}
      />

      {/* ---------- TIM ---------- */}
      {section === "tim" && mode === "add" && (
        <div className="bg-orange-50 rounded-lg p-4 shadow-md">
          <form
            onSubmit={handleSubmitSurveyAct}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="md:col-span-2">
              <h3 className="text-lg font-bold">Tambahkan Tim</h3>
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-bold mb-2">
                Nama Tim
              </label>
              <input
                type="text"
                id="name"
                value={formStateF1.name}
                onChange={handleChangeF1}
                placeholder="Contoh: Tim Sensus Penduduk"
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
                placeholder="Contoh: tim-sensus-penduduk"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div className="md:col-span-2">
              <button
                disabled={loading1}
                type="submit"
                className={`${styles.button} my-2 text-white w-full sm:w-auto`}
              >
                {loading1 ? "Menyimpan..." : "Tambah"}
              </button>
            </div>
          </form>
        </div>
      )}

      {section === "tim" && mode === "update" && (
        <div className="bg-blue-50 rounded-lg p-4 shadow-md">
          <form
            onSubmit={handleUpdateSurveyAct}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="md:col-span-2">
              <h3 className="text-lg font-bold">Perbarui Tim</h3>
            </div>
            <div>
              <label
                htmlFor="surveyActivityId"
                className="block text-sm font-bold mb-2"
              >
                Pilih Tim
              </label>

              <HUSelect
                value={updateStateF1.surveyActivityId || null}
                onValueChange={(v) =>
                  setUpdateF1Field("surveyActivityId", (v ?? "") as string)
                }
                options={data?.allSurveyActivities.map((s: SurveyActivity) => ({
                  value: s.id,
                  label: s.name,
                }))}
                placeholder="-- Pilih Tim --"
              />
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-bold mb-2">
                Nama Tim Baru
              </label>
              <input
                id="name"
                value={updateStateF1.name}
                onChange={handleChangeUpdateF1}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label htmlFor="slug" className="block text-sm font-bold mb-2">
                Slug Baru
              </label>
              <input
                id="slug"
                value={updateStateF1.slug}
                onChange={handleChangeUpdateF1}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                className={`${styles.button} my-2 text-white w-full sm:w-auto`}
              >
                Perbarui Tim
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------- KEGIATAN SURVEI ---------- */}
      {section === "kegiatan" && mode === "add" && (
        <div className="bg-orange-50 rounded-lg p-4 shadow-md">
          <form
            onSubmit={handleSubmitSubSurveyAct}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="md:col-span-2">
              <h3 className="text-lg font-bold">Tambah Kegiatan</h3>
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-bold mb-2">
                Nama Kegiatan
              </label>
              <input
                id="name"
                value={formStateF2.name}
                onChange={handleChangeF2}
                placeholder="Contoh: Sensus Penduduk 2020"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label htmlFor="slug" className="block text-sm font-bold mb-2">
                Slug
              </label>
              <input
                id="slug"
                value={formStateF2.slug}
                onChange={handleChangeF2}
                placeholder="Contoh: sensus-penduduk-2020"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label
                htmlFor="surveyActivityId"
                className="block text-sm font-bold mb-2"
              >
                Tim Penyelenggara
              </label>

              <HUSelect
                value={formStateF2.surveyActivityId || null}
                onValueChange={(v) =>
                  setF2Field("surveyActivityId", (v ?? "") as string)
                }
                options={data?.allSurveyActivities.map((s: SurveyActivity) => ({
                  value: s.id,
                  label: s.name,
                }))}
                placeholder="-- Pilih Tim --"
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
                id="sampleType"
                value={formStateF2.sampleType}
                onChange={handleChangeF2}
                placeholder="Contoh: Rumah Tangga, SLS, dll"
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

              <HUSelect
                value={formStateF2.activityType || null}
                onValueChange={(v) =>
                  setF2Field("activityType", (v ?? "") as string)
                }
                options={[
                  { value: "Listing", label: "Listing" },
                  { value: "Pencacahan", label: "Pencacahan" },
                ]}
                placeholder="-- Pilih Jenis Kegiatan --"
              />
            </div>
            <div className="md:col-span-2">
              <button
                disabled={loading2}
                type="submit"
                className={`${styles.button} my-2 text-white w-full sm:w-auto`}
              >
                {loading2 ? "Menyimpan..." : "Tambah"}
              </button>
            </div>
          </form>
        </div>
      )}

      {section === "kegiatan" && mode === "update" && (
        <div className="bg-blue-50 rounded-lg p-4 shadow-md">
          <form
            onSubmit={handleUpdateSubSurveyAct}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="md:col-span-2">
              <h3 className="text-lg font-bold">Perbarui Kegiatan</h3>
            </div>
            <div>
              <label
                htmlFor="surveyActivityId"
                className="block text-sm font-bold mb-2"
              >
                Tim Penyelenggara
              </label>

              <HUSelect
                value={updateStateF2.surveyActivityId || null}
                onValueChange={(v) =>
                  setUpdateF2Field("surveyActivityId", (v ?? "") as string)
                }
                options={data?.allSurveyActivities.map((s: SurveyActivity) => ({
                  value: s.id,
                  label: s.name,
                }))}
                placeholder="-- Pilih Tim --"
              />
            </div>
            <div>
              <label
                htmlFor="subSurveyActivityId"
                className="block text-sm font-bold mb-2"
              >
                Kegiatan Survei
              </label>

              <HUSelect
                value={updateStateF2.subSurveyActivityId || null}
                onValueChange={(v) =>
                  setUpdateF2Field("subSurveyActivityId", (v ?? "") as string)
                }
                options={
                  SubSurveydata?.subSurveyActivityById
                    ? SubSurveydata?.subSurveyActivityById.map(
                        (s: SubSurveyActivity) => ({
                          value: s.id,
                          label: s.name,
                        })
                      )
                    : []
                }
                placeholder="-- Pilih Kegiatan --"
              />
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-bold mb-2">
                Nama Kegiatan Baru
              </label>
              <input
                id="name"
                value={updateStateF2.name}
                onChange={handleChangeUpdateF2}
                placeholder="Contoh: Sensus Penduduk 2020"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label htmlFor="slug" className="block text-sm font-bold mb-2">
                Slug Baru
              </label>
              <input
                id="slug"
                value={updateStateF2.slug}
                onChange={handleChangeUpdateF2}
                placeholder="Contoh: sensus-penduduk-2020"
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
                id="sampleType"
                value={updateStateF2.sampleType}
                onChange={handleChangeUpdateF2}
                placeholder="Contoh: Rumah Tangga, SLS, dll"
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

              <HUSelect
                value={updateStateF2.activityType || null}
                onValueChange={(v) =>
                  setUpdateF2Field("activityType", (v ?? "") as string)
                }
                options={[
                  { label: "Listing", value: "Listing" },
                  { label: "Pencacahan", value: "Pencacahan" },
                ]}
                placeholder="-- Pilih Jenis Kegiatan --"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                className={`${styles.button} my-2 text-white w-full sm:w-auto`}
              >
                Perbarui Kegiatan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------- PETUGAS ---------- */}
      {section === "petugas" && mode === "add" && (
        <div className="bg-orange-50 rounded-lg p-4 shadow-md">
          <form
            onSubmit={handleSubmitUserProgress}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="md:col-span-2">
              <h3 className="text-lg font-bold">Tambah Petugas</h3>
            </div>

            <div>
              <label
                htmlFor="surveyActivityId"
                className="block text-sm font-bold mb-2"
              >
                Tim Penyelenggara
              </label>
              <HUComboBox
                value={userProgressForm.surveyActivityId || null}
                onValueChange={(v) =>
                  setUPField("surveyActivityId", (v ?? "") as string)
                }
                options={data?.allSurveyActivities.map((s: SurveyActivity) => ({
                  value: s.id,
                  label: s.name ?? "",
                }))}
                placeholder="-- Pilih Tim Penyelenggara --"
              />
            </div>

            <div>
              <label
                htmlFor="subSurveyActivityId"
                className="block text-sm font-bold mb-2"
              >
                Kegiatan Survei
              </label>

              <HUSelect
                value={userProgressForm.subSurveyActivityId || null}
                onValueChange={(v) =>
                  setUPField("subSurveyActivityId", (v ?? "") as string)
                }
                options={
                  SubmitUPData?.subSurveyActivityById
                    ? SubmitUPData?.subSurveyActivityById?.map(
                        (sub: SubSurveyActivity) => ({
                          label: sub.name,
                          value: sub.id,
                        })
                      )
                    : []
                }
                placeholder="-- Pilih Kegiatan --"
              />
              {userProgressForm.subSurveyActivityId && (
                <div className="mt-1 text-xs">
                  <span className="inline-block rounded bg-white border px-2 py-1">
                    Target total: <b>{selectedSubForAdd?.targetSample ?? 0}</b>{" "}
                    • Sudah dialokasikan: <b>{assignedSumForAdd}</b> • Sisa:{" "}
                    <b>{remainingQuotaForAdd}</b>
                  </span>
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="superVisorId"
                className="block text-sm font-bold mb-2"
              >
                Pengawas
              </label>

              <HUComboBox
                value={userProgressForm.superVisorId || null}
                onValueChange={(v) =>
                  setUPField("superVisorId", (v ?? "") as string)
                }
                options={supervisors.map((u) => ({
                  value: u.id,
                  label: u.name ?? "-",
                  subLabel: u.email ?? "",
                }))}
                placeholder="-- Pilih Pengawas --"
              />
            </div>

            <div>
              <label htmlFor="userId" className="block text-sm font-bold mb-2">
                Petugas
              </label>

              <HUComboBox
                value={userProgressForm.userId || null}
                onValueChange={(v) => setUPField("userId", (v ?? "") as string)}
                options={enumeratorsForAdd.map((u) => ({
                  value: u.id,
                  label: u.name ?? "-",
                  subLabel: u.email ?? "",
                }))}
                placeholder="-- Pilih Petugas --"
              />
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
                min={0}
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
            </div>

            <div>
              <label
                htmlFor="submitCount"
                className="block text-sm font-bold mb-2"
              >
                Jumlah Submit
              </label>
              <input
                id="submitCount"
                type="number"
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
                Jumlah Approved
              </label>
              <input
                id="approvedCount"
                type="number"
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
                Jumlah Rejected
              </label>
              <input
                id="rejectedCount"
                type="number"
                value={userProgressForm.rejectedCount}
                onChange={handleChangeUserProgress}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div>
              <label
                htmlFor="districtId"
                className="block text-sm font-bold mb-2"
              >
                Kecamatan
              </label>

              <HUComboBox
                value={userProgressForm.districtId || null}
                onValueChange={(v) =>
                  setUPField("districtId", (v ?? "") as string)
                }
                options={districtData?.getAllSurveyDistrict?.map(
                  (d: District) => ({
                    value: d.id,
                    label: d.name ?? "-",
                  })
                )}
                placeholder="-- Pilih Kecamatan --"
              />
            </div>

            <div>
              <label
                htmlFor="blockCount"
                className="block text-sm font-bold mb-2"
              >
                Blok Pendataan
              </label>
              <input
                id="blockCount"
                type="text"
                value={userProgressForm.blockCount}
                onChange={handleChangeUserProgress}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                className={`${styles.button} my-2 text-white w-full sm:w-auto`}
                disabled={
                  !!userProgressForm.subSurveyActivityId &&
                  remainingQuotaForAdd <= 0
                }
              >
                Tambah
              </button>
            </div>
          </form>
        </div>
      )}

      {section === "petugas" && mode === "update" && (
        <div className="bg-blue-100 rounded-lg p-4 shadow-md">
          <form
            onSubmit={handleUpdateUserProgress}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="md:col-span-2">
              <h3 className="text-lg font-bold">Perbarui Petugas</h3>
            </div>

            <div>
              <label
                htmlFor="surveyActivityId"
                className="block text-sm font-bold mb-2"
              >
                Tim Penyelenggara
              </label>

              <HUComboBox
                value={updateUserProgressForm.surveyActivityId || null}
                onValueChange={(v) =>
                  setUpdateUPField("surveyActivityId", (v ?? "") as string)
                }
                options={data?.allSurveyActivities.map((s: SurveyActivity) => ({
                  value: s.id,
                  label: s.name ?? "-",
                }))}
                placeholder="-- Pilih Tim Penyelenggara --"
              />
            </div>

            <div>
              <label
                htmlFor="subSurveyActivityId"
                className="block text-sm font-bold mb-2"
              >
                Kegiatan Survei
              </label>

              <HUSelect
                value={updateUserProgressForm.subSurveyActivityId || null}
                onValueChange={(v) =>
                  setUpdateUPField("subSurveyActivityId", (v ?? "") as string)
                }
                options={
                  UpdateUPData?.subSurveyActivityById
                    ? UpdateUPData?.subSurveyActivityById?.map(
                        (s: SubSurveyActivity) => ({
                          value: s.id,
                          label: s.name ?? "-",
                        })
                      )
                    : []
                }
                placeholder="-- Pilih Kegiatan --"
              />
              {updateUserProgressForm.subSurveyActivityId && (
                <div className="mt-1 text-xs">
                  <span className="inline-block rounded bg-white border px-2 py-1">
                    Target total:{" "}
                    <b>{selectedSubForUpdate?.targetSample ?? 0}</b> • Total
                    alokasi: <b>{sumAllAssignedForUpdate}</b> • Maks untuk
                    petugas ini: <b>{allowedMaxForUpdate}</b>
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

              <HUComboBox
                value={updateUserProgressForm.userProgressId || null}
                onValueChange={(v) =>
                  setUpdateUPField("userProgressId", (v ?? "") as string)
                }
                options={filteredUPsForUpdate.map(
                  (up: UserProgressWithUser) => ({
                    value: up.id,
                    label: up.user?.name ?? "-",
                    subLabel: up.user?.email ?? "",
                  })
                )}
                placeholder="-- Pilih Petugas --"
              />
            </div>

            <div>
              <label
                htmlFor="totalAssigned"
                className="block text-sm font-bold mb-2"
              >
                Total Sampel Petugas
              </label>
              <input
                id="totalAssigned"
                type="number"
                min={0}
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
                Jumlah Submit
              </label>
              <input
                id="submitCount"
                type="number"
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
                Jumlah Approved
              </label>
              <input
                id="approvedCount"
                type="number"
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
                Jumlah Rejected
              </label>
              <input
                id="rejectedCount"
                type="number"
                value={updateUserProgressForm.rejectedCount}
                onChange={handleChangeUpdateUserProgress}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div>
              <label
                htmlFor="districtId"
                className="block text-sm font-bold mb-2"
              >
                Kecamatan
              </label>

              <HUComboBox
                value={updateUserProgressForm.districtId || null}
                onValueChange={(v) =>
                  setUpdateUPField("districtId", (v ?? "") as string)
                }
                options={districtData?.getAllSurveyDistrict?.map(
                  (d: District) => ({
                    value: d.id,
                    label: d.name,
                  })
                )}
                placeholder="-- Pilih Kecamatan --"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                className={`${styles.button} my-2 text-white w-full sm:w-auto`}
              >
                Update
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default Admin;
