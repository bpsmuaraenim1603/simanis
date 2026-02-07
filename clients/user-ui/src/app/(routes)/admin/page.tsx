"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  useApolloClient,
  useLazyQuery,
  useMutation,
  useQuery,
} from "@apollo/client";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
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
import { GET_ALL_OF_SUB_SURVEY_ACTIVITIES } from "@/src/graphql/actions/find-realallsubsurvey.action";
import { BULK_IMPORT_USERPROGRESS_EXCEL } from "@/src/graphql/actions/bulk-import-userprogress.action";
import { GET_USER_PROGRESS_BY_SUBSURVEY_ID } from "@/src/graphql/actions/find-usersurveyprogress.action";
import { GET_USER_PROGRESS_BY_USER_ID } from "@/src/graphql/actions/find-usersurveyprogressbyuser.action";
import {
  DELETE_SURVEY_ACTIVITY,
  DELETE_SUBSURVEY_ACTIVITY,
  DELETE_USER_SURVEY_PROGRESS,
} from "@/src/graphql/actions/delete";
import { LayoutGroup, motion } from "framer-motion";
import HUComboBox from "@/src/components/HUCombobox";
import HUSelect from "@/src/components/HUSelect";
import useUser from "@/src/hooks/useUser";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PATCH_USER_SAMPLES } from "@/src/graphql/actions/patch-usersamples.action";
import { getRoles } from "@/src/utils/roles";
import { GET_VILLAGES_BY_DISTRICT } from "@/src/graphql/actions/find-villages-by-district.action";
import { GET_ALL_OF_DISTRICT } from "@/src/graphql/actions/find-alldistrict.action";
import { GET_ALL_OF_VILLAGE } from "@/src/graphql/actions/find-allvillages.action";

/* ====== (type definitions sama persis dengan punyamu) ====== */
type SurveyActivity = { id: string; name: string; slug: string };
type District = { id: string; city: string; name: string };
type Village = { id: string; name: string; districtId: string };
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
  primaryRole?: string;
  roles?: string[];
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
  villageId: string;
  docsBill: string;
  progressRole: string;
};
type UserProgressWithUser = UserProgress & {
  user?: { name: string; email: string; limit_bill: number };
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
  const { user: currentUser, loading: userLoading } = useUser();
  const router = useRouter();
  const ALLOWED = ["Superadmin", "Admin"];
  const formatNUS = (n: number) => String(n).padStart(3, "0");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setQuery = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    Object.entries(patch).forEach(([k, v]) => {
      if (v == null || v === "") params.delete(k);
      else params.set(k, v);
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (userLoading) return;

    const roles = getRoles(currentUser);
    const allowed = roles.some((r) => ALLOWED.includes(r));

    if (!allowed) {
      toast.error("Akses ditolak. Mengarahkan ke Beranda");
      router.replace("/dashboard");
    }
  }, [userLoading, currentUser, router]);

  type Section = "tim" | "kegiatan" | "petugas";
  type Mode = "add" | "update";

  const [deleteSampleIds, setDeleteSampleIds] = useState<string[]>([]);
  const [section, setSection] = useState<Section>("tim");
  const [mode, setMode] = useState<Mode>("add");
  const [deleteMode, setDeleteMode] = useState(false);

  useEffect(() => {
    const tab = (searchParams?.get("tab") as Section) || "tim";
    const m = (searchParams?.get("mode") as Mode) || "add";
    const del = searchParams?.get("delete") === "1";

    setSection(tab);
    setMode(m);
    setDeleteMode(del);
  }, [searchParams]);

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
    villageId: "",
    docsBill: "",
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
    villageId: "",
    blockCount: "",
    docsBill: "",
    progressRole: "",
  });
  const emptySampleRow = {
    id: "",
    nus: "",
    identity: "",
    cacahStatus: "Belum_Cacah",
    approvalStatus: "Menunggu",
    geoLat: "",
    geoLng: "",
  };

  const [sampleListAdd, setSampleListAdd] = useState([emptySampleRow]);
  const [sampleListUpdate, setSampleListUpdate] = useState([emptySampleRow]);
  const [qSupervisor, setQSupervisor] = useState("");
  const [qEnumerator, setQEnumerator] = useState("");
  const [qUPUser, setQUPUser] = useState("");
  const qSupervisorDeb = useDebounced(qSupervisor);
  const [selectedDistrictIdAdd, setSelectedDistrictIdAdd] = useState<
    string | null
  >(null);
  const [villagesAdd, setVillagesAdd] = useState<Village[]>([]);
  const [selectedDistrictIdUpdate, setSelectedDistrictIdUpdate] = useState<
    string | null
  >(null);
  const [villagesUpdate, setVillagesUpdate] = useState<Village[]>([]);
  const [updateRoleFilter, setUpdateRoleFilter] = useState<
    "PETUGAS" | "PENGAWAS"
  >("PETUGAS");
  const prevUpdateDistrictIdRef = useRef<string>("");

  function matchesSearch(u: Partial<User>, q: string) {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [u.name, u.email, (u as any)?.phone_number].some((v) =>
      (v ?? "").toLowerCase().includes(s),
    );
  }
  function matchesUPSearch(up: UserProgressWithUser, q: string) {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [up.user?.name ?? "", up.user?.email ?? ""].some((v) =>
      v.toLowerCase().includes(s),
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
    GET_ALL_SUB_SURVEY_ACTIVITIES,
  );
  const [fetchSubForSubmitUP, { data: SubmitUPData }] = useLazyQuery(
    GET_ALL_SUB_SURVEY_ACTIVITIES,
  );
  const [fetchSubForUpdateUP, { data: UpdateUPData }] = useLazyQuery(
    GET_ALL_SUB_SURVEY_ACTIVITIES,
  );
  const { data: userData, refetch: refetchUsers } = useQuery(GET_ALL_USERS);
  const { data: allSubsData, refetch: refetchAllSubs } = useQuery(
    GET_ALL_OF_SUB_SURVEY_ACTIVITIES,
    { fetchPolicy: "cache-and-network" },
  );
  const { data: allDistrict, refetch: refetchAllDistrict } = useQuery(
    GET_ALL_OF_DISTRICT,
    { fetchPolicy: "cache-and-network" },
  );
  const { data: allVillage, refetch: refetchAllVillage } = useQuery(
    GET_ALL_OF_VILLAGE,
    { fetchPolicy: "cache-and-network" },
  );
  const [bulkImportExcel, { loading: importingExcel }] = useMutation(
    BULK_IMPORT_USERPROGRESS_EXCEL,
  );
  const { data: districtData, refetch: refetchDistricts } =
    useQuery(GET_ALL_OF_DISTRICT);
  const [fetchVillages, { data: villageData }] = useLazyQuery(
    GET_VILLAGES_BY_DISTRICT,
  );
  const [fetchUserProgress, { data: userProgressData }] = useLazyQuery(
    GET_USER_PROGRESS_BY_SUBSURVEY_ID,
  );
  const [
    fetchUserProgressByUser,
    { data: upByUserData, loading: upByUserLoading },
  ] = useLazyQuery(GET_USER_PROGRESS_BY_USER_ID, {
    fetchPolicy: "network-only",
  });
  const [
    fetchUserProgressByUserForUpdate,
    { data: upByUserUpdateData, loading: upByUserUpdateLoading },
  ] = useLazyQuery(GET_USER_PROGRESS_BY_USER_ID, {
    fetchPolicy: "network-only",
  });
  const [addSurveyActivity, { loading: loading1 }] =
    useMutation(ADD_SURVEY_ACTIVITY);
  const [addSubSurveyActivity, { loading: loading2 }] = useMutation(
    ADD_SUBSURVEY_ACTIVITY,
  );
  const [updateSurveyActivity] = useMutation(UPDATE_SURVEY_ACTIVITY);
  const [updateSubSurveyActivity] = useMutation(UPDATE_SUB_SURVEY_ACTIVITY);
  const [createUserSurveyProgress] = useMutation(CREATE_USER_PROGRESS);
  const [updateUserSurveyProgress] = useMutation(UPDATE_USER_PROGRESS);
  const [deleteSurveyActivity] = useMutation(DELETE_SURVEY_ACTIVITY);
  const [deleteSubSurveyActivity] = useMutation(DELETE_SUBSURVEY_ACTIVITY);
  const [deleteUserProgressMut] = useMutation(DELETE_USER_SURVEY_PROGRESS);
  const [patchUserSamples, { loading: patchSampleLoading }] =
    useMutation(PATCH_USER_SAMPLES);

  const toDateInput = (d?: string | Date) =>
    d ? new Date(d).toISOString().slice(0, 10) : "";

  const surveyMap = useMemo<Record<string, SurveyActivity>>(
    () =>
      Object.fromEntries(
        (data?.allSurveyActivities ?? []).map((s: SurveyActivity) => [s.id, s]),
      ),
    [data],
  );
  const subMap = useMemo<Record<string, SubSurveyActivity>>(
    () =>
      Object.fromEntries(
        (SubSurveydata?.subSurveyActivityById ?? []).map(
          (s: SubSurveyActivity) => [s.id, s],
        ),
      ),
    [SubSurveydata],
  );
  const upMap = useMemo<Record<string, UserProgressWithUser>>(
    () =>
      Object.fromEntries(
        (userProgressData?.userProgressBySubSurveyActivityId ?? []).map(
          (u: any) => [u.id, u],
        ),
      ),
    [userProgressData],
  );
  const toMoney = (v: any) => Number(v ?? 0);
  const sumDocs = (rows: any[]) =>
    rows.reduce((acc, r) => acc + toMoney(r.docsBill), 0);

  const isSameMonthYear = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

  const inRangeInclusive = (now: Date, start?: string, end?: string) => {
    if (!start || !end) return null;
    const s = new Date(start);
    const e = new Date(end);
    return now >= s && now <= e;
  };

  const getSubInfo = (subId?: string) => {
    if (!subId) return undefined;
    return subMap[subId];
  };

  const includeForThisMonth = (row: any, now = new Date()) => {
    const sub = getSubInfo(row?.subSurveyActivityId);
    if (sub?.startDate && sub?.endDate) {
      const ok = inRangeInclusive(now, sub.startDate, sub.endDate);
      if (ok !== null) return ok;
    }
    if (row?.lastUpdated) {
      const lu = new Date(row.lastUpdated);
      return isSameMonthYear(lu, now);
    }
    return false;
  };

  const prevSurveyIdRefUpdate = useRef<string | null>(null);

  const handleChangeF1 = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormStateF1((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  const handleChangeF2 = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setFormStateF2((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  const handleChangeUpdateF1 = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setUpdateStateF1((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  const handleChangeUpdateF2 = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
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
    e: React.FormEvent<HTMLFormElement>,
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
    e: React.FormEvent<HTMLFormElement>,
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
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) =>
    setUserProgressForm((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  const handleChangeUpdateUserProgress = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) =>
    setUpdateUserProgressForm((prev) => ({
      ...prev,
      [e.target.id]: e.target.value,
    }));

  const handleSubmitUserProgress = async (
    e: React.FormEvent<HTMLFormElement>,
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
      }

      if (userProgressForm.userId) {
        if (!upByUserData) {
          await fetchUserProgressByUser({
            variables: { userId: userProgressForm.userId },
          });
        }
        if (willExceedAdd) {
          toast.error(
            `Honor petugas melebihi limit pengguna.\n` +
              `Limit: ${limitBillAdd.toLocaleString("id-ID")} • Terpakai: ${usedDocsAdd.toLocaleString("id-ID")} • ` +
              `Sisa: ${remainDocsAdd.toLocaleString("id-ID")}`,
          );
          return;
        }
      }

      await createUserSurveyProgress({
        variables: {
          input: {
            userId: userProgressForm.userId,
            superVisorId: userProgressForm.superVisorId,
            subSurveyActivityId: userProgressForm.subSurveyActivityId,
            districtId: userProgressForm.districtId,
            villageId: userProgressForm.villageId,
            docsBill: userProgressForm.docsBill,
            blockCount: userProgressForm.blockCount,
            totalAssigned: 0,
            submitCount: 0,
            approvedCount: 0,
            rejectedCount: 0,
            samples: sampleListAdd.map((s, idx) => ({
              nus: formatNUS(idx + 1),
              identity: s.identity,
              cacahStatus: s.cacahStatus,
              approvalStatus: s.approvalStatus,
              geoLat: s.geoLat ? Number(s.geoLat) : null,
              geoLng: s.geoLng ? Number(s.geoLng) : null,
            })),
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
        villageId: "",
        docsBill: "",
        superVisorId: userProgressForm.superVisorId,
      });
      setSampleListAdd([emptySampleRow]);
    } catch (err) {
      toast.error("Gagal tambah user progress");
      console.error(err);
    }
  };

  const handleUpdateUserProgress = async (
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();
    try {
      if (updateUserProgressForm.subSurveyActivityId) {
        const isPetugas =
          (updateUserProgressForm.progressRole ?? "") === "PETUGAS";

        if (!isPetugas) {
          await updateUserSurveyProgress({
            variables: {
              input: {
                id: updateUserProgressForm.userProgressId,
                districtId: updateUserProgressForm.districtId,
                villageId: updateUserProgressForm.villageId,
                blockCount: updateUserProgressForm.blockCount,
                docsBill: updateUserProgressForm.docsBill,
              },
            },
          });
          toast.success("Blok pengawas berhasil diupdate!");
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
            villageId: "",
            blockCount: "",
            docsBill: "",
            progressRole: "",
          });
          setDeleteSampleIds([]);
          return;
        }
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
            `Alokasi melebihi batas untuk petugas ini (${allowedMax}).`,
          );
          return;
        }
        if (allowedMax <= 0) {
          toast.error("Tidak ada sisa sampel yang dapat dialokasikan.");
          return;
        }

        if (currentUP?.userId) {
          if (!upByUserUpdateData) {
            await fetchUserProgressByUserForUpdate({
              variables: { userId: currentUP.userId },
            });
          }
          if (willExceedUpdate) {
            toast.error(
              `Honor petugas melebihi limit pengguna.\n` +
                `Limit: ${limitBillUpdate.toLocaleString("id-ID")} • Terpakai : ${usedDocsUpdateOthers.toLocaleString("id-ID")} • ` +
                `Sisa untuk baris ini: ${remainDocsUpdate.toLocaleString("id-ID")}`,
            );
            return;
          }
        }

        await updateUserSurveyProgress({
          variables: {
            input: {
              id: updateUserProgressForm.userProgressId,
              blockCount: updateUserProgressForm.blockCount,
              totalAssigned: cappedTotalAssigned,
              submitCount: Number(updateUserProgressForm.submitCount),
              approvedCount: Number(updateUserProgressForm.approvedCount),
              rejectedCount: Number(updateUserProgressForm.rejectedCount),
              districtId: updateUserProgressForm.districtId,
              villageId: updateUserProgressForm.villageId,
              docsBill: updateUserProgressForm.docsBill,
              samples: sampleListUpdate.map((s, idx) => ({
                ...(s.id ? { id: s.id } : {}),
                nus: s.nus,
                identity: s.identity,
                cacahStatus: s.cacahStatus,
                approvalStatus: s.approvalStatus,
                geoLat: s.geoLat ? Number(s.geoLat) : null,
                geoLng: s.geoLng ? Number(s.geoLng) : null,
              })),
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
        villageId: "",
        blockCount: "",
        docsBill: "",
        progressRole: "",
      });
      setSampleListUpdate([emptySampleRow]);
      setDeleteSampleIds([]);
    } catch (err) {
      toast.error("Gagal perbarui petugas");
      console.error(err);
    }
  };

  const handleDeleteSurveyAct = async () => {
    const id = updateStateF1.surveyActivityId;
    if (!id) return toast.error("Pilih Tim terlebih dahulu.");
    if (!window.confirm("Hapus Tim beserta seluruh turunannya?")) return;

    try {
      const { data } = await deleteSurveyActivity({
        variables: { input: { id } },
      });
      if (data?.deleteSurveyActivity?.success) {
        toast.success(data?.deleteSurveyActivity?.message ?? "Tim terhapus.");
        setUpdateStateF1({ surveyActivityId: "", name: "", slug: "" });
        await handleRefresh();
      } else {
        toast.error("Gagal menghapus Tim.");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Gagal menghapus Tim.");
      console.error(e);
    }
  };

  const handleDeleteSubSurveyAct = async () => {
    const id = updateStateF2.subSurveyActivityId;
    if (!id) return toast.error("Pilih Kegiatan terlebih dahulu.");
    if (!window.confirm("Hapus Kegiatan & data terkait (SPJ, JobLetter, dsb)?"))
      return;

    try {
      const { data } = await deleteSubSurveyActivity({
        variables: { input: { id } },
      });
      if (data?.deleteSubSurveyActivity?.success) {
        toast.success(
          data?.deleteSubSurveyActivity?.message ?? "Kegiatan terhapus.",
        );
        setUpdateStateF2((prev) => ({
          ...prev,
          name: "",
          slug: "",
          surveyActivityId: "",
          startDate: "",
          endDate: "",
          targetSample: 0,
          sampleType: "",
          activityType: "",
        }));
        await handleRefresh();
      } else {
        toast.error("Gagal menghapus Kegiatan.");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Gagal menghapus Kegiatan.");
      console.error(e);
    }
  };

  const handleDeleteUserProgress = async () => {
    const id = updateUserProgressForm.userProgressId;
    if (!id) return toast.error("Pilih Petugas terlebih dahulu.");
    if (!window.confirm("Hapus Petugas?")) return;

    try {
      const { data } = await deleteUserProgressMut({
        variables: { input: { id } },
      });
      if (data?.deleteUserSurveyProgress?.success) {
        toast.success(
          data?.deleteUserSurveyProgress?.message ?? "Petugas terhapus.",
        );
        setUpdateUserProgressForm((prev) => ({
          ...prev,
          userProgressId: "",
          totalAssigned: 0,
          submitCount: 0,
          approvedCount: 0,
          rejectedCount: 0,
          lastUpdated: "",
          districtId: "",
          villageId: "",
          docsBill: "",
        }));
        setSampleListUpdate([emptySampleRow]);
        await handleRefresh();
      } else {
        toast.error("Gagal menghapus Petugas.");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Gagal menghapus Petugas.");
      console.error(e);
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
          }),
        );
      }
      if (userProgressForm.surveyActivityId) {
        jobs.push(
          fetchSubForSubmitUP({
            variables: { surveyActivityId: userProgressForm.surveyActivityId },
            fetchPolicy: "network-only",
          }),
        );
      }
      if (updateUserProgressForm.surveyActivityId) {
        jobs.push(
          fetchSubForUpdateUP({
            variables: {
              surveyActivityId: updateUserProgressForm.surveyActivityId,
            },
            fetchPolicy: "network-only",
          }),
        );
      }
      if (updateUserProgressForm.subSurveyActivityId) {
        jobs.push(
          fetchUserProgress({
            variables: {
              subSurveyActivityId: updateUserProgressForm.subSurveyActivityId,
            },
            fetchPolicy: "network-only",
          }),
        );
      }
      if (userProgressForm.subSurveyActivityId) {
        jobs.push(
          fetchUserProgress({
            variables: {
              subSurveyActivityId: userProgressForm.subSurveyActivityId,
            },
            fetchPolicy: "network-only",
          }),
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

  const handleDownloadTemplateUserProgress = () => {
    const users = (userData?.getUsers ?? []) as any[];
    const subs = (allSubsData?.allSubSurveyActivities ?? []) as any[];
    const districts = (allDistrict?.allDistricts ?? []) as any[];
    const villages = (allVillage?.allVillages ?? []) as any[];

    const uploadSheetRows = [
      {
        "Nomor Petugas": 1,
        "Id Kegiatan": "Copy dari MASTER_KEGIATAN",
        "Id Petugas": "Copy dari MASTER_PENGGUNA",
        "Id Pengawas": "Copy dari MASTER_PENGGUNA",
        "Id Kecamatan": "Copy dari MASTER_KECAMATAN",
        "Id Desa": "Copy dari MASTER_DESA",
        "Nama Blok": "",
        "Honor Petugas": "",
        "Honor Pengawas": "",
      },
    ];

    const masterUsers = users.map((u, i) => ({
      No: i + 1,
      "Nama Pengguna": u.name,
      "Email Pengguna": u.email,
      "Peran Pengguna": u.primaryRole ?? u.roles ?? "",
      "Id Pengguna": u.id,
      "Masukkan Daftar Nama Pengguna":
        "Sesuaikan dengan nama asli yang tertera (gunakan proper)",
      "Masukkan Daftar Nama Pengawas":
        "Sesuaikan dengan nama asli yang tertera (gunakan proper)",
      "Formula Ambil Id Pengguna": `=VLOOKUP(F${i + 2};$B:$E;4;FALSE)`,
      "Formula Ambil Id Pengawas": `=VLOOKUP(G${i + 2};$B:$E;4;FALSE)`,
    }));

    const masterSubs = subs.map((s, i) => ({
      No: i + 1,
      "Nama Kegiatan": s.name,
      "Tanggal Mulai": s.startDate ? new Date(s.startDate).toISOString() : "",
      "Tanggal Selesai": s.endDate ? new Date(s.endDate).toISOString() : "",
      "Target Sample": s.targetSample ?? "",
      "Jenis Sample": s.sampleType ?? "",
      "Jenis Kegiatan": s.activityType ?? "",
      "Id Kegiatan": s.id,
      "": "Ambil Id Kegiatan dari sini",
    }));

    const masterDistrict = districts.map((s, i) => ({
      No: i + 1,
      "Nama Kota": s.city,
      "Nama Kecamatan": s.name,
      "Kode Wilayah": s.coderegion,
      "Id Kecamatan": s.id,
      "Masukkan Daftar Nama Kecamatan": "Pastikan nama sesuai (gunakan proper)",
      "Formula Ambil Id Kecamatan": `=VLOOKUP(F${i + 2};$C:$E;3;FALSE)`,
    }));

    const masterVillage = villages.map((s, i) => ({
      No: i + 1,
      "Id Kecamatan": s.districtId,
      "Nama Desa": s.name,
      "Kode Wilayah": s.coderegion,
      "Kode Kecamatan-Desa": `${s.districtId}-${s.name}`,
      "Id Desa": s.id,
      "Id Kecamatan Terpilih":
        "Ambil Id kecamatan terpilih (G) dari MASTER_KECAMATAN",
      "Masukkan Daftar Nama Desa": "Pastikan nama sesuai (gunakan proper)",
      "Kode Kecamatan-Desa Terpilih": `=G${i + 2}&"-"&H${i + 2}`,
      "Formula Ambil Id Desa": `=VLOOKUP(I${i + 2};$E:$F;2;FALSE)`,
    }));

    const sampleRows = [
      {
        "Nomor Petugas":
          "Hubungkan sampel dengan menambahkan nomor petugas dari sheet UPLOAD_PETUGAS",
        nus: "",
        identity: "",
        cacahStatus: "",
        approvalStatus: "",
        geoLat: "",
        geoLng: "",
      },
    ];

    const wb = XLSX.utils.book_new();

    const wsUpload = XLSX.utils.json_to_sheet(uploadSheetRows);
    wsUpload["!cols"] = [
      { wch: 5 }, // nomor petugas
      { wch: 36 }, // subSurveyActivityId
      { wch: 28 }, // userId
      { wch: 28 }, // superVisorId
      { wch: 30 }, // districtId
      { wch: 24 }, // villageId
      { wch: 12 }, // blockCount
      { wch: 18 }, // docsBillPetugas
      { wch: 18 }, // docsBillPengawas
    ];

    const wsUsers = XLSX.utils.json_to_sheet(masterUsers);
    wsUsers["!cols"] = [
      { wch: 5 },
      { wch: 36 },
      { wch: 28 },
      { wch: 28 },
      { wch: 36 },
      { wch: 40 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
    ];

    const wsSubs = XLSX.utils.json_to_sheet(masterSubs);
    wsSubs["!cols"] = [
      { wch: 5 },
      { wch: 32 },
      { wch: 36 },
      { wch: 24 },
      { wch: 24 },
      { wch: 12 },
      { wch: 14 },
      { wch: 36 },
    ];

    const wsSamples = XLSX.utils.json_to_sheet(sampleRows);
    wsSamples["!cols"] = [
      { wch: 10 }, // NoPetugas
      { wch: 8 }, // nus
      { wch: 30 }, // identity
      { wch: 16 }, // cacahStatus
      { wch: 16 }, // approvalStatus
      { wch: 14 }, // geoLat
      { wch: 14 }, // geoLng
    ];

    const wsDistrict = XLSX.utils.json_to_sheet(masterDistrict);
    wsDistrict["!cols"] = [
      { wch: 5 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 36 },
      { wch: 36 },
    ];

    const wsVillage = XLSX.utils.json_to_sheet(masterVillage);
    wsVillage["!cols"] = [
      { wch: 5 },
      { wch: 36 },
      { wch: 20 },
      { wch: 20 },
      { wch: 36 },
      { wch: 36 },
      { wch: 36 },
      { wch: 30 },
      { wch: 36 },
    ];

    XLSX.utils.book_append_sheet(wb, wsUpload, "UPLOAD_PETUGAS");
    XLSX.utils.book_append_sheet(wb, wsSamples, "UPLOAD_SAMPEL");
    XLSX.utils.book_append_sheet(wb, wsUsers, "MASTER_PENGGUNA");
    XLSX.utils.book_append_sheet(wb, wsSubs, "MASTER_KEGIATAN");
    XLSX.utils.book_append_sheet(wb, wsDistrict, "MASTER_KECAMATAN");
    XLSX.utils.book_append_sheet(wb, wsVillage, "MASTER_DESA");

    XLSX.writeFile(wb, "Template_Upload_Petugas.xlsx");
  };

  const handleUploadExcelUserProgress = async (file: File) => {
    try {
      const res = await bulkImportExcel({ variables: { file } });
      const r = res.data?.bulkImportUserProgressExcel;

      const errCount = r?.errors?.length ?? 0;
      toast.success(
        `Import selesai.
        Petugas: +${r.insertedPetugas} / upd ${r.updatedPetugas}
        Pengawas: +${r.insertedPengawas} / upd ${r.updatedPengawas}
        Error: ${errCount}`,
      );

      if (errCount) {
        console.table(r.errors);
        toast.error("Ada error baris. Lihat console.table(errors).");
      }

      handleRefresh();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Gagal import excel");
    }
  };

  const setUPField = <K extends keyof typeof userProgressForm>(
    key: K,
    value: (typeof userProgressForm)[K],
  ) => {
    setUserProgressForm((prev) => ({ ...prev, [key]: value }));
  };

  const setUpdateUPField = <K extends keyof typeof updateUserProgressForm>(
    key: K,
    value: (typeof updateUserProgressForm)[K],
  ) => {
    setUpdateUserProgressForm((prev) => ({ ...prev, [key]: value }));
  };

  const setF2Field = <K extends keyof typeof updateStateF2>(
    key: K,
    value: (typeof updateStateF2)[K],
  ) => {
    setFormStateF2((prev) => ({ ...prev, [key]: value }));
  };

  const setUpdateF2Field = <K extends keyof typeof updateStateF2>(
    key: K,
    value: (typeof updateStateF2)[K],
  ) => {
    setUpdateStateF2((prev) => ({ ...prev, [key]: value }));
  };

  const setUpdateF1Field = <K extends keyof typeof updateStateF1>(
    key: K,
    value: (typeof updateStateF1)[K],
  ) => {
    setUpdateStateF1((prev) => ({ ...prev, [key]: value }));
  };

  const toOpts = <T,>(
    rows: T[],
    pick: (row: T) => { value: string; label: string; subLabel?: string },
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
    if (!userProgressForm.districtId) return;

    fetchVillages({ variables: { districtId: userProgressForm.districtId } });

    setUserProgressForm((prev) => ({ ...prev, villageId: "" }));
  }, [userProgressForm.districtId, fetchVillages]);

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
    const districtId = updateUserProgressForm.districtId || "";
    const prevDistrictId = prevUpdateDistrictIdRef.current || "";

    if (!districtId) {
      setSelectedDistrictIdUpdate(null);
      setVillagesUpdate([]);
      if (prevDistrictId) {
        setUpdateUserProgressForm((prev) => ({ ...prev, villageId: "" }));
      }
      prevUpdateDistrictIdRef.current = "";
      return;
    }

    setSelectedDistrictIdUpdate(districtId);
    (async () => {
      const res = await fetchVillages({ variables: { districtId } });
      setVillagesUpdate(res.data?.villagesByDistrict ?? []);

      if (prevDistrictId && prevDistrictId !== districtId) {
        setUpdateUserProgressForm((prev) => ({ ...prev, villageId: "" }));
      }
      prevUpdateDistrictIdRef.current = districtId;
    })();
  }, [updateUserProgressForm.districtId, fetchVillages]);

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
      superVisorId: "",
      userId: "",
      districtId: "",
      villageId: "",
      blockCount: "",
      docsBill: "",
    }));
    setSampleListAdd([emptySampleRow]);
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
        villageId: up.villageId ?? "",
        blockCount: up.blockCount ?? "",
        docsBill: up.docsBill ?? "",
        progressRole: up.progressRole ?? "",
      }));
      setSelectedDistrictIdUpdate(up.districtId ?? null);
    } else {
      if (!updateUserProgressForm.userProgressId) {
        setUpdateUserProgressForm((prev) => ({
          ...prev,
          totalAssigned: 0,
          submitCount: 0,
          approvedCount: 0,
          rejectedCount: 0,
          lastUpdated: "",
          districtId: "",
          villageId: "",
          blockCount: "",
          docsBill: "",
          progressRole: "",
        }));
        setSelectedDistrictIdUpdate(null);
      }
    }
  }, [updateUserProgressForm.userProgressId, upMap]);

  useEffect(() => {
    setUpdateUserProgressForm((prev) => ({ ...prev, userProgressId: "" }));
  }, [updateUserProgressForm.subSurveyActivityId]);

  useEffect(() => {
    const curr = updateUserProgressForm?.surveyActivityId || "";
    const prev = prevSurveyIdRefUpdate.current || "";

    if (curr !== prev) {
      setUpdateUserProgressForm((s: any) => ({
        ...s,
        subSurveyActivityId: "",
        userId: "",
      }));
    }

    prevSurveyIdRefUpdate.current = curr;
  }, [updateUserProgressForm?.surveyActivityId, setUpdateUserProgressForm]);

  useEffect(() => {
    if (userProgressForm.subSurveyActivityId)
      fetchUserProgress({
        variables: {
          subSurveyActivityId: userProgressForm.subSurveyActivityId,
        },
      });
  }, [userProgressForm.subSurveyActivityId, fetchUserProgress]);

  useEffect(() => {
    if (userProgressForm.userId) {
      fetchUserProgressByUser({
        variables: { userId: userProgressForm.userId },
      });
    }
  }, [userProgressForm.userId, fetchUserProgressByUser]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDeleteMode(false);
        setQuery({ tab: section, mode, delete: null });
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [section, mode]);

  useEffect(() => {
    const hasTab = searchParams?.has("tab");
    const hasMode = searchParams?.has("mode");

    if (hasTab && hasMode) return;

    const params = new URLSearchParams(searchParams?.toString() || "");
    if (!hasTab) params.set("tab", section);
    if (!hasMode) params.set("mode", mode);
    if (deleteMode) params.set("delete", "1");

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, []);

  /*===================== LOGIC ===================== */
  const selectedSubForAdd = useMemo(
    () =>
      (SubmitUPData?.subSurveyActivityById ?? []).find(
        (s: SubSurveyActivity) => s.id === userProgressForm.subSurveyActivityId,
      ),
    [SubmitUPData, userProgressForm.subSurveyActivityId],
  );
  const assignedSumForAdd = useMemo(
    () =>
      (userProgressData?.userProgressBySubSurveyActivityId ?? []).reduce(
        (acc: number, up: UserProgress) => acc + Number(up.totalAssigned ?? 0),
        0,
      ),
    [userProgressData],
  );
  const remainingQuotaForAdd = Math.max(
    0,
    Number(selectedSubForAdd?.targetSample ?? 0) - assignedSumForAdd,
  );

  const selectedSubForUpdate = useMemo(
    () =>
      (UpdateUPData?.subSurveyActivityById ?? []).find(
        (s: SubSurveyActivity) =>
          s.id === updateUserProgressForm.subSurveyActivityId,
      ),
    [UpdateUPData, updateUserProgressForm.subSurveyActivityId],
  );
  const isListingUpdate =
    (selectedSubForUpdate?.activityType ?? "") === "Listing";
  const upListForUpdate: UserProgress[] =
    userProgressData?.userProgressBySubSurveyActivityId ?? [];
  const upPetugasOnlyForQuota = useMemo(
    () =>
      upListForUpdate.filter((u: any) => (u.progressRole ?? "") === "PETUGAS"),
    [upListForUpdate],
  );
  const filteredUPsForUpdate = useMemo(
    () => upListForUpdate.filter((up) => matchesUPSearch(up as any, qUPUser)),
    [upListForUpdate, qUPUser],
  );
  const currentUP = useMemo(
    () =>
      upListForUpdate.find(
        (u) => u.id === updateUserProgressForm.userProgressId,
      ),
    [upListForUpdate, updateUserProgressForm.userProgressId],
  );
  const sumAllAssignedForUpdate = useMemo(
    () =>
      upPetugasOnlyForQuota.reduce(
        (acc: number, u) => acc + Number(u.totalAssigned ?? 0),
        0,
      ),
    [upPetugasOnlyForQuota],
  );
  const allowedMaxForUpdate = useMemo(() => {
    if ((currentUP?.progressRole ?? "") !== "PETUGAS") return 0;
    const target = Number(selectedSubForUpdate?.targetSample ?? 0);
    const currentAssigned = Number(currentUP?.totalAssigned ?? 0);
    const others = sumAllAssignedForUpdate - currentAssigned;
    return Math.max(0, target - others);
  }, [selectedSubForUpdate, currentUP, sumAllAssignedForUpdate]);

  const existingUPForAdd: UserProgressWithUser[] =
    userProgressData?.userProgressBySubSurveyActivityId ?? [];
  const usedUserIdsForAdd = useMemo(
    () => new Set(existingUPForAdd.map((up) => up.userId)),
    [existingUPForAdd],
  );

  const supervisors: User[] = useMemo(
    () =>
      (userData?.getUsers ?? []).filter((u: any) =>
        getRoles(u).includes("Supervisor"),
      ),
    [userData],
  );
  const filteredSupervisors = useMemo(
    () => supervisors.filter((u) => matchesSearch(u, qSupervisorDeb)),
    [supervisors, qSupervisorDeb],
  );
  const admins: User[] = useMemo(
    () =>
      (userData?.getUsers ?? []).filter((u: any) =>
        getRoles(u).includes("Admin"),
      ),
    [userData],
  );
  const enumeratorsForAdd: User[] = useMemo(
    () =>
      (userData?.getUsers ?? [])
        // .filter((u: User) => u.role !== "Supervisor")
        // .filter((u: User) => u.role !== "Admin")
        .filter((u: User) => !getRoles(u).includes("Superadmin")),
    [userData, usedUserIdsForAdd],
  );
  const filteredEnumeratorsForAdd = useMemo(
    () => enumeratorsForAdd.filter((u) => matchesSearch(u, qEnumerator)),
    [enumeratorsForAdd, qEnumerator],
  );
  const selectedUserForAdd = useMemo(
    () =>
      (userData?.getUsers ?? []).find(
        (u: any) => u.id === userProgressForm.userId,
      ),
    [userData, userProgressForm.userId],
  );
  const limitBillAdd = toMoney(selectedUserForAdd?.limit_bill);
  const usedDocsAdd = useMemo(() => {
    const rows = upByUserData?.userProgressSurveyByUserId ?? [];
    const filtered = rows.filter((r: any) => includeForThisMonth(r));
    return sumDocs(filtered);
  }, [upByUserData, subMap]);
  const newDocsAdd = toMoney(userProgressForm.docsBill);
  const remainDocsAdd = Math.max(0, limitBillAdd - usedDocsAdd);
  const willExceedAdd = newDocsAdd > remainDocsAdd;

  const selectedUserForUpdate = currentUP
    ? (userData?.getUsers ?? []).find((u: any) => u.id === currentUP.userId)
    : null;

  const limitBillUpdate = toMoney(selectedUserForUpdate?.limit_bill);

  const usedDocsUpdateAll = useMemo(() => {
    const rows = upByUserUpdateData?.userProgressSurveyByUserId ?? [];
    const filtered = rows.filter((r: any) => includeForThisMonth(r));
    return sumDocs(filtered);
  }, [upByUserUpdateData, subMap]);

  const currentRowCounted = currentUP ? includeForThisMonth(currentUP) : false;
  const currentRowOldDocs = toMoney(currentUP?.docsBill);
  const usedDocsUpdateOthers = Math.max(
    0,
    usedDocsUpdateAll - (currentRowCounted ? currentRowOldDocs : 0),
  );
  const newDocsUpdate = toMoney(updateUserProgressForm.docsBill);
  const remainDocsUpdate = Math.max(
    0,
    limitBillUpdate - usedDocsUpdateOthers,
  );
  const willExceedUpdate = newDocsUpdate > remainDocsUpdate;
  const nusToNumber = (nus: string) => {
    const n = Number(String(nus ?? "").trim());
    return Number.isFinite(n) ? n : 0;
  };

  const getNextNus = (rows: any[]) => {
    const max = Math.max(0, ...(rows ?? []).map((r) => nusToNumber(r.nus)));
    return formatNUS(max + 1);
  };

  const sortByNusAsc = (rows: any[]) =>
    [...(rows ?? [])].sort((a, b) => nusToNumber(a.nus) - nusToNumber(b.nus));

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

  useEffect(() => {
    const uid = currentUP?.userId;
    if (uid) {
      fetchUserProgressByUserForUpdate({ variables: { userId: uid } });
    }
  }, [currentUP?.userId, fetchUserProgressByUserForUpdate]);

  useEffect(() => {
    if (!currentUP) {
      setSampleListUpdate([]);
      return;
    }

    const samples = (currentUP as any)?.samples ?? [];
    if (Array.isArray(samples) && samples.length > 0) {
      const mapped = samples.map((s: any) => ({
        id: s.id,
        nus: s.nus ?? "",
        identity: s.identity ?? "",
        cacahStatus: s.cacahStatus ?? "Belum_Cacah",
        approvalStatus: s.approvalStatus ?? "Menunggu",
        geoLat: s.geoLat != null ? String(s.geoLat) : "",
        geoLng: s.geoLng != null ? String(s.geoLng) : "",
      }));

      setSampleListUpdate(sortByNusAsc(mapped));
    } else {
      setSampleListUpdate([]);
    }
  }, [currentUP?.id]);

  useEffect(() => {
    if (!userProgressForm.userId) {
      setSampleListAdd([]);
    }
  }, [userProgressForm.userId]);

  useEffect(() => {
    if (!updateUserProgressForm.userProgressId) {
      setSampleListUpdate([]);
      setDeleteSampleIds([]);
    }
  }, [updateUserProgressForm.userProgressId]);

  /* ===================== UI ===================== */
  if (userLoading) {
    return (
      <div className="max-w-screen-xl mx-auto px-3 py-6 font-Poppins">
        Memuat…
      </div>
    );
  }

  if (!currentUser) return null;

  const roles = getRoles(currentUser);
  const allowed = roles.some((r) => ALLOWED.includes(r));

  if (!allowed) {
    return null;
  }

  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-6 md:px-8 py-6 space-y-4 font-Poppins">
      {/* Main Tabs + actions */}
      <div className="bg-orange-50 rounded-lg p-3 md:p-4 font-bold text-lg md:text-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-md">
        <span>Panel Manajemen Tim</span>
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <Tabs
          tabs={[
            { key: "tim", label: "Tim" },
            { key: "kegiatan", label: "Kegiatan Survei" },
            { key: "petugas", label: "Petugas" },
          ]}
          value={section}
          onChange={(k) => {
            setSection(k);
            setQuery({ tab: k, mode, delete: deleteMode ? "1" : null });
          }}
        />

        <div
          className={`flex ${mode === "update" ? "justify-between" : "justify-end"} space-x-3`}
        >
          {mode === "update" && (
            <button
              type="button"
              onClick={() => {
                const next = !deleteMode;
                setDeleteMode(next);
                setQuery({ tab: section, mode, delete: next ? "1" : null });
              }}
              className={`px-4 py-1 my-3 rounded-lg text-sm text-white ${
                deleteMode
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-gray-700 hover:bg-gray-800"
              }`}
              title={
                deleteMode ? "Matikan Mode Hapus (Esc)" : "Aktifkan Mode Hapus"
              }
            >
              {deleteMode ? "Selesai Hapus" : "Mode Hapus"}
            </button>
          )}
          <SubTabs
            tabs={[
              { key: "add", label: "Tambah" },
              { key: "update", label: "Ubah" },
            ]}
            value={mode}
            onChange={(m) => {
              setMode(m);
              const nextDelete = m === "update" ? deleteMode : false;
              setDeleteMode(nextDelete);
              setQuery({
                tab: section,
                mode: m,
                delete: nextDelete ? "1" : null,
              });
            }}
          />
        </div>
      </div>

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
            <div className="md:col-span-2 flex justify-end">
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
            <div className="md:col-span-2 flex items-center gap-4">
              {deleteMode ? (
                <button
                  type="button"
                  onClick={handleDeleteSurveyAct}
                  className="my-2 px-6 py-3 rounded-full bg-red-600 text-white font-semibold hover:bg-red-700 w-full"
                >
                  Hapus Tim
                </button>
              ) : (
                <button
                  type="submit"
                  className={`${styles.button} my-2 text-white`}
                >
                  Perbarui Tim
                </button>
              )}
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
            <div className="md:col-span-2 flex justify-end">
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
                        }),
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
            <div className="md:col-span-2 flex gap-2">
              {deleteMode ? (
                <button
                  type="button"
                  onClick={handleDeleteSubSurveyAct}
                  className="my-2 px-6 py-3 rounded-full bg-red-600 text-white font-semibold hover:bg-red-700 w-full"
                >
                  Hapus Kegiatan
                </button>
              ) : (
                <button
                  type="submit"
                  className={`${styles.button} my-2 text-white`}
                >
                  Perbarui Kegiatan
                </button>
              )}
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
            <div className="md:col-span-2 flex justify-between">
              <h3 className="text-lg font-bold">Tambah Blok Petugas</h3>
              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={handleDownloadTemplateUserProgress}
                  className="px-3 py-2 rounded-md bg-green-600 text-white hover:bg-green-700"
                >
                  Download Template Upload
                </button>

                <label
                  className={`px-3 py-2 rounded-md text-white cursor-pointer ${importingExcel ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}`}
                >
                  {importingExcel ? "Sedang Upload" : "Upload Excel"}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadExcelUserProgress(f);
                      e.currentTarget.value = "";
                    }}
                    disabled={importingExcel}
                  />
                </label>
              </div>
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
                        }),
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
              {userProgressForm.userId && (
                <p className="mt-1 text-xs">
                  Limit: <b>{limitBillAdd.toLocaleString("id-ID")}</b> •
                  Terpakai: <b>{usedDocsAdd.toLocaleString("id-ID")}</b> •
                  Sisa:{" "}
                  <b className={remainDocsAdd <= 0 ? "text-red-600" : ""}>
                    {remainDocsAdd.toLocaleString("id-ID")}
                  </b>
                </p>
              )}
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
                onValueChange={async (v) => {
                  const districtId = (v ?? "") as string;
                  setUPField("districtId", districtId);
                  setSelectedDistrictIdAdd(districtId);

                  if (districtId) {
                    const res = await fetchVillages({
                      variables: { districtId },
                    });
                    setVillagesAdd(res.data?.villagesByDistrict ?? []);
                  } else {
                    setVillagesAdd([]);
                  }
                }}
                options={districtData?.allDistricts?.map((d: District) => ({
                  value: d.id,
                  label: d.name ?? "-",
                }))}
                placeholder="-- Pilih Kecamatan --"
              />
            </div>

            <div>
              <label
                htmlFor="villageId"
                className="block text-sm font-bold mb-2"
              >
                Desa
              </label>
              <HUSelect
                value={userProgressForm.villageId || null}
                onValueChange={(v) =>
                  setUPField("villageId", (v ?? "") as string)
                }
                options={villagesAdd.map((v: Village) => ({
                  value: v.id,
                  label: v.name,
                }))}
                placeholder={
                  selectedDistrictIdAdd
                    ? "-- Pilih Desa --"
                    : "Pilih kecamatan dulu"
                }
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
                placeholder="Tuliskan Nama Blok"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div>
              <label
                htmlFor="docsBill"
                className="block text-sm font-bold mb-2"
              >
                Honor Petugas
              </label>
              <input
                id="docsBill"
                type="number"
                value={userProgressForm.docsBill}
                onChange={handleChangeUserProgress}
                placeholder="Sertakan Jumlah Honor"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              {userProgressForm.userId && (
                <p
                  className={`mt-1 text-xs ${willExceedAdd ? "text-red-600" : "text-gray-600"}`}
                >
                  Akan terpakai: {newDocsAdd.toLocaleString("id-ID")}{" "}
                  {willExceedAdd &&
                    "— Melebihi limit! Total honor sudah mencapai " +
                      (usedDocsAdd + newDocsAdd).toLocaleString("id-ID")}
                </p>
              )}
            </div>
            {/* === Daftar Sampel Blok Petugas (ADD) === */}
            <div className="md:col-span-2 border rounded-md p-3 bg-white">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
                <h4 className="font-bold text-sm">
                  Daftar Sampel Blok Petugas ({sampleListAdd.length} Baris)
                </h4>
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setSampleListAdd((prev) => [...prev, emptySampleRow])
                    }
                    className="flex flex-row items-center justify-center px-3 rounded-md cursor-pointer bg-[#2190ff] min-h-[30px] w-full sm:w-auto font-Poppins font-semibold text-white hover:bg-[#1977cc] transition-colors text-sm"
                  >
                    + Tambah Baris
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                <div className="overflow-x-auto">
                  <div className="min-w-[720px] md:min-w-0 px-1">
                    {sampleListAdd.map((row, idx) => (
                      <div
                        key={idx}
                        className="flex gap-2 items-center my-2 w-full"
                      >
                        <input
                          placeholder="NUS"
                          value={formatNUS(idx + 1)}
                          readOnly
                          className="w-full sm:col-span-2 md:col-span-1 px-3 py-2 border rounded-md bg-white"
                        />

                        <input
                          placeholder="Identitas"
                          value={row.identity}
                          onChange={(e) =>
                            setSampleListAdd((prev) =>
                              prev.map((r, i) =>
                                i === idx
                                  ? { ...r, identity: e.target.value }
                                  : r,
                              ),
                            )
                          }
                          className="w-full sm:col-span-2 md:col-span-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />

                        <select
                          value={row.cacahStatus}
                          onChange={(e) =>
                            setSampleListAdd((prev) =>
                              prev.map((r, i) =>
                                i === idx
                                  ? { ...r, cacahStatus: e.target.value }
                                  : r,
                              ),
                            )
                          }
                          className="w-full px-3 py-2 border rounded-md bg-white text-sm"
                        >
                          <option value="Belum_Cacah">Belum Dicacah</option>
                          <option value="Selesai">Selesai</option>
                          {/* <option value="Drop_Out">Drop Out</option> */}
                        </select>

                        <select
                          value={row.approvalStatus}
                          onChange={(e) =>
                            setSampleListAdd((prev) =>
                              prev.map((r, i) =>
                                i === idx
                                  ? { ...r, approvalStatus: e.target.value }
                                  : r,
                              ),
                            )
                          }
                          className="w-full px-3 py-2 border rounded-md bg-white text-sm"
                        >
                          <option value="Menunggu">Menunggu</option>
                          <option value="Disetujui">Disetujui</option>
                          <option value="Ditolak">Ditolak</option>
                        </select>

                        <input
                          placeholder="Lat"
                          value={row.geoLat ?? ""}
                          onChange={(e) =>
                            setSampleListAdd((prev) =>
                              prev.map((r, i) =>
                                i === idx
                                  ? { ...r, geoLat: e.target.value }
                                  : r,
                              ),
                            )
                          }
                          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <input
                          placeholder="Lng"
                          value={row.geoLng ?? ""}
                          onChange={(e) =>
                            setSampleListAdd((prev) =>
                              prev.map((r, i) =>
                                i === idx
                                  ? { ...r, geoLng: e.target.value }
                                  : r,
                              ),
                            )
                          }
                          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSampleListAdd((prev) =>
                              prev.filter((_, i) => i !== idx),
                            );
                          }}
                          className="px-3 py-2 border rounded-md text-sm bg-red-500 text-white hover:bg-red-600 transition-colors font-semibold"
                        >
                          Hapus
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end">
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
              <h3 className="text-lg font-bold">Perbarui Blok Petugas</h3>
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
                          label: s.name,
                        }),
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
            </div>{" "}
            <div>
              <label className="block text-sm font-bold mb-2">Role</label>
              <HUSelect
                value={updateRoleFilter}
                onValueChange={(v) => {
                  const role = (v ?? "PETUGAS") as "PETUGAS" | "PENGAWAS";
                  setUpdateRoleFilter(role);
                  // reset pilihan UP agar tidak nyangkut dari role sebelumnya
                  setUpdateUPField("userProgressId", "");
                  setUpdateUPField("progressRole", "");
                }}
                options={[
                  { value: "PETUGAS", label: "PETUGAS" },
                  { value: "PENGAWAS", label: "PENGAWAS" },
                ]}
                placeholder="-- Pilih Role --"
              />
            </div>
            <div>
              <label
                htmlFor="userProgressId"
                className="block text-sm font-bold mb-2"
              >
                Blok Petugas
              </label>

              <HUComboBox
                value={updateUserProgressForm.userProgressId || null}
                onValueChange={async (v) => {
                  const id = (v ?? "") as string;
                  if (!id) {
                    setUpdateUserProgressForm((prev) => ({
                      ...prev,
                      userProgressId: "",
                      totalAssigned: 0,
                      submitCount: 0,
                      approvedCount: 0,
                      rejectedCount: 0,
                      lastUpdated: "",
                      districtId: "",
                      villageId: "",
                      blockCount: "",
                      docsBill: "",
                      progressRole: "",
                    }));
                    setSelectedDistrictIdUpdate(null);
                    setVillagesUpdate([]);
                    return;
                  }

                  const up = upMap[id];
                  if (!up) {
                    // fallback aman kalau map belum siap
                    setUpdateUPField("userProgressId", id);
                    return;
                  }

                  setUpdateUserProgressForm((prev) => ({
                    ...prev,
                    userProgressId: id,
                    totalAssigned: Number(up.totalAssigned ?? 0),
                    submitCount: Number(up.submitCount ?? 0),
                    approvedCount: Number(up.approvedCount ?? 0),
                    rejectedCount: Number(up.rejectedCount ?? 0),
                    lastUpdated: toDateInput(up.lastUpdated),
                    districtId: up.districtId ?? "",
                    villageId: up.villageId ?? "",
                    blockCount: up.blockCount ?? "",
                    docsBill: up.docsBill ?? "",
                    progressRole: up.progressRole ?? "",
                  }));

                  const districtId = up.districtId ?? "";
                  setSelectedDistrictIdUpdate(districtId || null);
                  if (up.districtId) {
                    const res = await fetchVillages({
                      variables: { districtId: up.districtId },
                    });
                    setVillagesUpdate(res.data?.villagesByDistrict ?? []);
                  } else {
                    setVillagesUpdate([]);
                  }
                }}
                options={filteredUPsForUpdate
                  .filter(
                    (up: any) => (up.progressRole ?? "") === updateRoleFilter,
                  )
                  .map((up: any) => ({
                    value: up.id,
                    label: `${up.user?.name ?? "-"} - ${up.village?.name ?? "-"}`,
                    subLabel: up.user?.email ?? "",
                    onvalueChange: () => {
                      setUpdateUPField("progressRole", up.progressRole ?? 0);
                    },
                  }))}
                placeholder={
                  updateRoleFilter === "PENGAWAS"
                    ? "-- Pilih Blok Pengawas --"
                    : "-- Pilih Blok Petugas --"
                }
              />
              {currentUP?.userId && (
                <p className="mt-1 text-xs">
                  Limit: <b>{limitBillUpdate.toLocaleString("id-ID")}</b> •
                  Terpakai:{" "}
                  <b>{usedDocsUpdateOthers.toLocaleString("id-ID")}</b> • Sisa
                  untuk baris ini:{" "}
                  <b className={remainDocsUpdate <= 0 ? "text-red-600" : ""}>
                    {remainDocsUpdate.toLocaleString("id-ID")}
                  </b>
                </p>
              )}
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
                onValueChange={async (v) => {
                  const districtId = (v ?? "") as string;
                  setUpdateUPField("districtId", districtId);
                  setSelectedDistrictIdUpdate(districtId);

                  if (districtId) {
                    const res = await fetchVillages({
                      variables: { districtId },
                    });
                    setVillagesUpdate(res.data?.villagesByDistrict ?? []);
                  } else {
                    setVillagesUpdate([]);
                  }
                }}
                options={districtData?.allDistricts?.map((d: District) => ({
                  value: d.id,
                  label: d.name,
                }))}
                placeholder="-- Pilih Kecamatan --"
              />
            </div>
            <div>
              <label
                htmlFor="villageId"
                className="block text-sm font-bold mb-2"
              >
                Desa
              </label>
              <HUSelect
                value={updateUserProgressForm.villageId || null}
                onValueChange={(v) =>
                  setUpdateUPField("villageId", (v ?? "") as string)
                }
                options={villagesUpdate.map((v: Village) => ({
                  value: v.id,
                  label: v.name,
                }))}
                placeholder={
                  selectedDistrictIdUpdate
                    ? "-- Pilih Desa --"
                    : "Pilih kecamatan dulu"
                }
              />
            </div>
            <div>
              <label
                htmlFor="docsBill"
                className="block text-sm font-bold mb-2"
              >
                Honor Petugas
              </label>
              <input
                id="docsBill"
                type="number"
                value={updateUserProgressForm.docsBill}
                onChange={handleChangeUpdateUserProgress}
                placeholder="Sertakan Jumlah Honor"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              {currentUP?.userId && (
                <p
                  className={`mt-1 text-xs ${willExceedUpdate ? "text-red-600" : "text-gray-600"}`}
                >
                  Akan terpakai: {newDocsUpdate.toLocaleString("id-ID")}{" "}
                  {willExceedUpdate &&
                    "— Melebihi limit! Total honor sudah mencapai " +
                      (usedDocsUpdateOthers + newDocsUpdate).toLocaleString(
                        "id-ID",
                      )}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="blockCount"
                className="block text-sm font-bold mb-2"
              >
                Nama Blok
              </label>
              <input
                id="blockCount"
                type="text"
                value={updateUserProgressForm.blockCount}
                onChange={(e) => setUpdateUPField("blockCount", e.target.value)}
                placeholder="Contoh: A, B, 01, BLOK-1"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            {/* === Daftar Sampel Blok Petugas (UPDATE) === */}
            {updateUserProgressForm.progressRole === "PETUGAS" && (
              <div className="md:col-span-2 border rounded-md p-3 bg-white">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
                  <h4 className="font-bold text-sm">
                    Daftar Sampel Blok Petugas ({sampleListUpdate.length} Baris)
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setSampleListUpdate((prev) => {
                        const nus = getNextNus(prev);
                        const next = [...prev, { ...emptySampleRow, nus }];
                        return sortByNusAsc(next);
                      })
                    }
                    className="flex flex-row items-center justify-center px-3 rounded-md cursor-pointer bg-[#2190ff] min-h-[30px] font-Poppins font-semibold text-white hover:bg-[#1977cc] transition-colors text-sm"
                    disabled={!updateUserProgressForm.userProgressId}
                    title={
                      !updateUserProgressForm.userProgressId
                        ? "Pilih Blok Petugas dulu"
                        : ""
                    }
                  >
                    + Tambah Baris
                  </button>
                </div>

                {!updateUserProgressForm.userProgressId ? (
                  <div className="text-xs text-gray-600">
                    Pilih Blok Petugas terlebih dahulu untuk memuat sampel.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    <div className="overflow-x-auto">
                      <div className="min-w-[720px] md:min-w-0 px-1">
                        {sampleListUpdate.map((row, idx) => (
                          <div
                            key={idx}
                            className="flex gap-2 items-center my-2 w-full"
                          >
                            <input
                              placeholder="NUS"
                              value={row.nus}
                              readOnly
                              className="w-full sm:col-span-2 md:col-span-1 px-3 py-2 border rounded-md bg-white"
                            />

                            <input
                              placeholder="Identitas"
                              value={row.identity}
                              onChange={(e) =>
                                setSampleListUpdate((prev) =>
                                  prev.map((r, i) =>
                                    i === idx
                                      ? { ...r, identity: e.target.value }
                                      : r,
                                  ),
                                )
                              }
                              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />

                            <select
                              value={row.cacahStatus}
                              onChange={(e) =>
                                setSampleListUpdate((prev) =>
                                  prev.map((r, i) =>
                                    i === idx
                                      ? { ...r, cacahStatus: e.target.value }
                                      : r,
                                  ),
                                )
                              }
                              className="w-full px-3 py-2 border rounded-md bg-white text-sm"
                            >
                              <option value="Belum_Cacah">Belum Dicacah</option>
                              <option value="Selesai">Selesai</option>
                              {/* <option value="Drop_Out">Drop Out</option> */}
                            </select>

                            <select
                              value={row.approvalStatus}
                              onChange={(e) =>
                                setSampleListUpdate((prev) =>
                                  prev.map((r, i) =>
                                    i === idx
                                      ? { ...r, approvalStatus: e.target.value }
                                      : r,
                                  ),
                                )
                              }
                              className="w-full px-3 py-2 border rounded-md bg-white text-sm"
                            >
                              <option value="Menunggu">Menunggu</option>
                              <option value="Disetujui">Disetujui</option>
                              <option value="Ditolak">Ditolak</option>
                            </select>

                            <input
                              placeholder="Lat"
                              value={row.geoLat ?? ""}
                              onChange={(e) =>
                                setSampleListUpdate((prev) =>
                                  prev.map((r, i) =>
                                    i === idx
                                      ? { ...r, geoLat: e.target.value }
                                      : r,
                                  ),
                                )
                              }
                              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />

                            <input
                              placeholder="Lng"
                              value={row.geoLng ?? ""}
                              onChange={(e) =>
                                setSampleListUpdate((prev) =>
                                  prev.map((r, i) =>
                                    i === idx
                                      ? { ...r, geoLng: e.target.value }
                                      : r,
                                  ),
                                )
                              }
                              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />

                            {/* Hapus baris dari UI */}
                            <button
                              type="button"
                              disabled={patchSampleLoading}
                              onClick={async () => {
                                const row: any = sampleListUpdate[idx];

                                if (!row?.id) {
                                  setSampleListUpdate((prev) =>
                                    sortByNusAsc(
                                      prev.filter((_, i) => i !== idx),
                                    ),
                                  );

                                  return;
                                }

                                const userProgressId =
                                  updateUserProgressForm.userProgressId;
                                if (!userProgressId) {
                                  toast.error("User Progress belum dipilih.");
                                  return;
                                }

                                if (
                                  !window.confirm(
                                    "Hapus sample ini beserta fotonya?",
                                  )
                                )
                                  return;

                                try {
                                  await patchUserSamples({
                                    variables: {
                                      input: {
                                        userProgressId,
                                        deleteSampleIds: [row.id],
                                      },
                                    },
                                  });

                                  setSampleListUpdate((prev) =>
                                    prev.filter((_, i) => i !== idx),
                                  );
                                } catch (err) {
                                  console.error(err);
                                  toast.error("Gagal menghapus sample.");
                                }
                              }}
                              className="px-3 py-2 border rounded-md text-sm bg-red-500 text-white hover:bg-red-600 transition-colors font-semibold disabled:opacity-60"
                            >
                              Hapus
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="md:col-span-2 flex gap-2">
              {deleteMode ? (
                <button
                  type="button"
                  onClick={handleDeleteUserProgress}
                  className="my-2 px-6 py-3 rounded-full bg-red-600 text-white font-semibold hover:bg-red-700 w-full"
                >
                  Hapus Petugas
                </button>
              ) : (
                <button
                  type="submit"
                  className={`${styles.button} my-2 text-white`}
                >
                  Perbarui Blok Petugas
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default Admin;
