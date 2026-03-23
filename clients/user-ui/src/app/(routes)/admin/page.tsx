"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import styles from "@/src/utils/style";
import HUSelect from "@/src/components/HUSelect";
import HUComboBox from "@/src/components/HUCombobox";
import {
  Save,
  X,
  Pencil,
  Trash2,
  Copy,
  Plus,
  ChevronDown,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import useUser from "@/src/hooks/useUser";
import { GET_ALL_USERS } from "@/src/graphql/actions/find-allusers.action";
import { GET_ALL_SURVEY_ACTIVITIES } from "@/src/graphql/actions/find-allsurveyact.action";
import { ADD_SURVEY_ACTIVITY } from "@/src/graphql/actions/add-surveyact.action";
import { UPDATE_SURVEY_ACTIVITY } from "@/src/graphql/actions/update-survey.action";
import {
  DELETE_SURVEY_ACTIVITY,
  DELETE_SUBSURVEY_ACTIVITY,
  DELETE_USER_SURVEY_PROGRESS,
} from "@/src/graphql/actions/delete";
import { GET_ALL_SUB_SURVEY_ACTIVITIES } from "@/src/graphql/actions/find-allsubsurveyact.action";
import { ADD_SUBSURVEY_ACTIVITY } from "@/src/graphql/actions/add-subsurveyact.action";
import { UPDATE_SUB_SURVEY_ACTIVITY } from "@/src/graphql/actions/update-subsurvey.action";
import { GET_USER_PROGRESS_BY_SUBSURVEY_ID } from "@/src/graphql/actions/find-usersurveyprogress.action";
import { CREATE_USER_PROGRESS } from "@/src/graphql/actions/create-userprogress.action";
import { UPDATE_USER_PROGRESS } from "@/src/graphql/actions/update-userprogress.action";
import { BULK_IMPORT_USERPROGRESS_EXCEL } from "@/src/graphql/actions/bulk-import-userprogress.action";
import { GET_ALL_OF_DISTRICT } from "@/src/graphql/actions/find-alldistrict.action";
import { GET_ALL_OF_VILLAGE } from "@/src/graphql/actions/find-allvillages.action";
import UpdateActivityStatusModal from "@/src/components/UpdateActivityStatusModal";
import {
  CREATE_SAMPLE_TYPE,
  GET_ALL_SAMPLE_TYPES,
} from "@/src/graphql/actions/sample-types.action";

type User = {
  id: string;
  name: string;
  email: string;
  primaryRole: string;
  roles: string[];
  limit_bill?: string;
  districtId?: string | null;
  villageId?: string | null;
};
type SurveyActivity = {
  id: string;
  name: string;
  slug: string;
  chiefId: string;
  chief?: { id: string; name: string };
};
type SubSurveyActivity = {
  id: string;
  name: string;
  slug: string;
  surveyActivityId: string;
  startDate: string;
  endDate: string;
  targetSample: number;
  sampleType: string;
  priceCompareUnit?: "SAMPEL" | "BLOK" | string;
  activityType: string;
  status?: string;
  budgetCode?: string | null;
  unitWorkPrice?: number | null;
};
type SampleType = {
  id: string;
  name: string;
};
type District = { id: string; city: string; name: string; coderegion?: string };
type Village = {
  id: string;
  name: string;
  districtId: string;
  coderegion?: string;
};

type UserSample = {
  id?: string;
  nus: string;
  identity: string;
  cacahStatus: string;
  approvalStatus: string;
  geoLat?: number | null;
  geoLng?: number | null;
};

type UserProgress = {
  id: string;
  userId: string;
  progressRole: "PETUGAS" | "PENGAWAS" | string;
  subSurveyActivityId?: string | null;
  districtId?: string | null;
  villageId?: string | null;
  superVisorId?: string | null;
  blockCount?: string | null;
  docsBill?: string | null;
  user?: User;
  superVisor?: User;
  district?: District;
  village?: Village;
  samples?: UserSample[];
};

function toMoney(v: any) {
  const n = Number(String(v ?? "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function formatSlug(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

type TabKey = "tim" | "kegiatan" | "petugas";

type IconButtonProps = {
  title: string;
  onClick: () => void;
  variant?: "primary" | "danger" | "neutral";
  disabled?: boolean;
  children: React.ReactNode;
};

function IconButton({
  title,
  onClick,
  children,
  variant = "neutral",
  disabled,
}: IconButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-md border px-2 py-1 transition disabled:opacity-60 disabled:cursor-not-allowed";
  const variants: Record<string, string> = {
    primary: "bg-gray-900 text-white border-gray-900 hover:bg-gray-800",
    danger: "bg-red-600 text-white border-red-600 hover:bg-red-500",
    neutral: "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]}`}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

function Pager({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (n: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-sm text-gray-700">
      <div className="flex items-center gap-2">
        <span>
          Menampilkan <b>{from}</b>–<b>{to}</b> dari <b>{total}</b>
        </span>
        <select
          className="px-2 py-1 border rounded-md bg-white"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}/hal
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <IconButton
          title="Sebelumnya"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          <ChevronLeft size={16} />
        </IconButton>
        <span>
          Hal <b>{page}</b>/<b>{totalPages}</b>
        </span>
        <IconButton
          title="Berikutnya"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          <ChevronRight size={16} />
        </IconButton>
      </div>
    </div>
  );
}

export default function Admin() {
  const router = useRouter();
  const { user } = useUser();
  const isKeuangan =
    user?.primaryRole === "Keuangan" ||
    (user?.roles ?? []).includes("Keuangan");

  const isAdmin = user?.primaryRole === "Admin";
  const isSuperAdmin = (user?.roles ?? []).includes("SuperAdmin");

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [pickedStatus, setPickedStatus] = useState<{
    id: string;
    status: string;
  } | null>(null);
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabKey>("tim");

  useEffect(() => {
    const t = (searchParams.get("tab") ?? "") as TabKey;
    if (t === "tim" || t === "kegiatan" || t === "petugas") setTab(t);
  }, [searchParams]);

  function setTabPersist(next: TabKey) {
    setTab(next);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("tab", next);
    router.replace(`?${sp.toString()}`, { scroll: false } as any);
  }

  const [timPage, setTimPage] = useState(1);
  const [timPageSize, setTimPageSize] = useState(20);

  const [kegiatanPage, setKegiatanPage] = useState(1);
  const [kegiatanPageSize, setKegiatanPageSize] = useState(20);

  const [petugasPage, setPetugasPage] = useState(1);
  const [petugasPageSize, setPetugasPageSize] = useState(10);

  const { data: usersData } = useQuery(GET_ALL_USERS);
  const { data: timData, refetch: refetchTim } = useQuery(
    GET_ALL_SURVEY_ACTIVITIES,
  );
  const { data: districtData } = useQuery(GET_ALL_OF_DISTRICT);
  const { data: villageData } = useQuery(GET_ALL_OF_VILLAGE);

  const users: User[] = (usersData?.getUsers ?? []) as any[];
  const tims: SurveyActivity[] = (timData?.allSurveyActivities ?? []) as any[];
  const districts: District[] = (districtData?.allDistricts ?? []) as any[];
  const villages: Village[] = (villageData?.allVillages ?? []) as any[];

  useEffect(() => setTimPage(1), [tims.length]);

  const pagedTims = useMemo(() => {
    const start = (timPage - 1) * timPageSize;
    return tims.slice(start, start + timPageSize);
  }, [tims, timPage, timPageSize]);

  const [createTim, { loading: creatingTim }] =
    useMutation(ADD_SURVEY_ACTIVITY);
  const [updateTim] = useMutation(UPDATE_SURVEY_ACTIVITY);
  const [deleteTim] = useMutation(DELETE_SURVEY_ACTIVITY);

  const [createKegiatan] = useMutation(ADD_SUBSURVEY_ACTIVITY);
  const [updateKegiatan] = useMutation(UPDATE_SUB_SURVEY_ACTIVITY);
  const [deleteKegiatan] = useMutation(DELETE_SUBSURVEY_ACTIVITY);

  const [createUserProgress, { loading: creatingUserProgress }] =
    useMutation(CREATE_USER_PROGRESS);
  const [updateUserProgress, { loading: updatingUserProgress }] =
    useMutation(UPDATE_USER_PROGRESS);
  const [deleteUserProgress] = useMutation(DELETE_USER_SURVEY_PROGRESS);
  const [bulkImportExcel, { loading: uploadingExcel }] = useMutation(
    BULK_IMPORT_USERPROGRESS_EXCEL,
  );

  // =========================
  // TAB: TIM
  // =========================
  const [timDraft, setTimDraft] = useState({ name: "", slug: "", chiefId: "" });
  const [timSlugTouched, setTimSlugTouched] = useState(false);
  const [timRowEdits, setTimRowEdits] = useState<
    Record<string, { name: string; slug: string; chiefId: string }>
  >({});

  useEffect(() => {
    const next: Record<
      string,
      { name: string; slug: string; chiefId: string }
    > = {};
    for (const t of tims)
      next[t.id] = { name: t.name, slug: t.slug, chiefId: t.chiefId };
    setTimRowEdits(next);
  }, [tims.length]);

  const userOptions = useMemo(
    () =>
      users
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((u) => ({ value: u.id, label: `${u.name} (${u.email})` })),
    [users],
  );

  const ketuaOptions = useMemo(
    () =>
      users
        .filter((u) => u.primaryRole === "Admin")
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((u) => ({ value: u.id, label: `${u.name} (${u.email})` })),
    [users],
  );

  const petugasOptions = useMemo(
    () =>
      users
        .filter((u) => u.roles.includes("User"))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((u) => ({ value: u.id, label: `${u.name} (${u.email})` })),
    [users],
  );

  const pengawasOptions = useMemo(
    () =>
      users
        .filter((u) => u.roles.includes("Supervisor"))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((u) => ({ value: u.id, label: `${u.name} (${u.email})` })),
    [users],
  );

  function isPrimarySupervisor(userId?: string | null) {
    if (!userId) return false;
    const u = users.find((x) => x.id === userId);
    return String(u?.primaryRole ?? "") === "Supervisor";
  }

  function getUserLocation(userId?: string | null) {
    const u = users.find((x) => x.id === userId);
    return {
      districtId: (u as any)?.districtId ? String((u as any).districtId) : null,
      villageId: (u as any)?.villageId ? String((u as any).villageId) : null,
    };
  }

  function nextBlockName(petugasId: string, pengawasId: string) {
    const nums: number[] = [];
    for (const up of upList) {
      if (String(up.progressRole) !== "PETUGAS") continue;
      if (up.userId !== petugasId) continue;
      if (String(up.superVisorId ?? "") !== String(pengawasId ?? "")) continue;
      const raw = String(up.blockCount ?? "");
      const m = raw.match(/\bblok\s*0*(\d+)\b/i);
      if (m) nums.push(Number(m[1]));
    }
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `Blok ${String(next).padStart(3, "0")}`;
  }

  async function handleAddTim() {
    const name = timDraft.name.trim();
    const slug = formatSlug(timDraft.slug || timDraft.name);
    const chiefId = timDraft.chiefId;

    if (!name || !slug || !chiefId)
      return toast.error("Nama, slug, dan ketua tim wajib diisi.");
    try {
      await createTim({ variables: { input: { name, slug, chiefId } } });
      toast.success("Tim ditambahkan.");
      setTimDraft({ name: "", slug: "", chiefId: "" });
      setTimSlugTouched(false);
      await refetchTim();
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal menambah tim.");
    }
  }

  async function handleSaveTimRow(id: string) {
    const row = timRowEdits[id];
    if (!row) return;
    const name = row.name.trim();
    const slug = formatSlug(row.slug || row.name);
    const chiefId = row.chiefId;
    if (!name || !slug || !chiefId)
      return toast.error("Nama, slug, dan ketua tim wajib diisi.");
    try {
      await updateTim({
        variables: { surveyActivityId: id, input: { name, slug, chiefId } },
      });
      toast.success("Tim diupdate.");
      await refetchTim();
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal update tim.");
    }
  }

  async function handleDeleteTim(id: string) {
    if (!window.confirm("Hapus tim beserta seluruh turunannya?")) return;
    try {
      const res = await deleteTim({ variables: { input: { id } } });
      if (res?.data?.deleteSurveyActivity?.success) {
        toast.success(
          res?.data?.deleteSurveyActivity?.message ?? "Tim dihapus.",
        );
        await refetchTim();
      } else
        toast.error(
          res?.data?.deleteSurveyActivity?.message ?? "Gagal hapus tim.",
        );
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal hapus tim.");
    }
  }

  // =========================
  // TAB: KEGIATAN
  // =========================
  const [selectedTimId, setSelectedTimId] = useState<string>("");
  const [kegiatanSearch, setKegiatanSearch] = useState("");
  const [kegiatanModalOpen, setKegiatanModalOpen] = useState(false);
  const [kegiatanModalMode, setKegiatanModalMode] = useState<"add" | "edit">(
    "add",
  );
  const [sampleTypeModalOpen, setSampleTypeModalOpen] = useState(false);
  const [sampleTypeNameDraft, setSampleTypeNameDraft] = useState("");
  const [kegiatanSlugTouched, setKegiatanSlugTouched] = useState(false);
  const [kegiatanDraft, setKegiatanDraft] = useState<
    Partial<SubSurveyActivity>
  >({
    name: "",
    slug: "",
    startDate: "",
    endDate: "",
    targetSample: 0,
    sampleType: "",
    priceCompareUnit: "SAMPEL",
    activityType: "",
  });
  const [draftSampleCount, setDraftSampleCount] = useState<number | null>(null);
  const [activeBlockOldSampleCount, setActiveBlockOldSampleCount] = useState(0);

  const { data: kegiatanData, refetch: refetchKegiatan } = useQuery(
    GET_ALL_SUB_SURVEY_ACTIVITIES,
    {
      variables: { surveyActivityId: selectedTimId || "__" },
      skip: !selectedTimId,
    },
  );

  const {
    data: sampleTypesData,
    refetch: refetchSampleTypes,
    loading: sampleTypesLoading,
  } = useQuery(GET_ALL_SAMPLE_TYPES);

  const [createSampleType] = useMutation(CREATE_SAMPLE_TYPE);

  const sampleTypeOptions = useMemo(() => {
    const list: SampleType[] = (sampleTypesData?.allSurveySampleTypes ??
      []) as any[];
    return list
      .map((x) => ({ value: x.name, label: x.name }))
      .sort((a, b) => a.label.localeCompare(b.label, "id"));
  }, [sampleTypesData]);

  const kegiatanList: SubSurveyActivity[] =
    (kegiatanData?.subSurveyActivityById ?? []) as any[];

  const [selectedKegiatanId, setSelectedKegiatanId] = useState<string>("");

  const [addPairDistrictId, setAddPairDistrictId] = useState<string>("");
  const [addPairVillageId, setAddPairVillageId] = useState<string>("");

  const addPairVillageOptions = useMemo(() => {
    if (!addPairDistrictId) return [];
    return villages
      .filter((v) => v.districtId === addPairDistrictId)
      .map((v) => ({ value: v.id, label: v.name }));
  }, [villages, addPairDistrictId]);

  const selectedKegiatan = useMemo(
    () => kegiatanList.find((k) => k.id === selectedKegiatanId) ?? null,
    [kegiatanList, selectedKegiatanId],
  );
  const defaultUnitWorkPrice = Number(selectedKegiatan?.unitWorkPrice ?? 0);
  const filteredKegiatan = useMemo(() => {
    const q = kegiatanSearch.trim().toLowerCase();
    if (!q) return kegiatanList;
    return kegiatanList.filter(
      (x) =>
        x.name.toLowerCase().includes(q) || x.slug.toLowerCase().includes(q),
    );
  }, [kegiatanList, kegiatanSearch]);

  useEffect(
    () => setKegiatanPage(1),
    [selectedTimId, kegiatanSearch, kegiatanList.length],
  );

  const pagedKegiatan = useMemo(() => {
    const start = (kegiatanPage - 1) * kegiatanPageSize;
    return filteredKegiatan.slice(start, start + kegiatanPageSize);
  }, [filteredKegiatan, kegiatanPage, kegiatanPageSize]);

  function openAddKegiatan() {
    if (!selectedTimId) return toast.error("Pilih tim dulu.");
    setKegiatanModalMode("add");
    setKegiatanDraft({
      name: "",
      slug: "",
      startDate: "",
      endDate: "",
      targetSample: 0,
      sampleType: "",
      priceCompareUnit: "SAMPEL",
      activityType: "",
      budgetCode: "",
      unitWorkPrice: 0,
    });
    setKegiatanModalOpen(true);
  }

  function openEditKegiatan(k: SubSurveyActivity) {
    setKegiatanModalMode("edit");
    setKegiatanDraft({
      ...k,
      startDate: k.startDate?.slice(0, 10),
      endDate: k.endDate?.slice(0, 10),
    });
    setKegiatanModalOpen(true);
  }

  async function saveKegiatan() {
    const name = String(kegiatanDraft.name ?? "").trim();
    const slug = formatSlug(
      String(kegiatanDraft.slug ?? kegiatanDraft.name ?? ""),
    );
    const startDate = String(kegiatanDraft.startDate ?? "");
    const endDate = String(kegiatanDraft.endDate ?? "");
    const targetSample = Number(kegiatanDraft.targetSample ?? 0);
    const sampleType = String(kegiatanDraft.sampleType ?? "").trim();
    const priceCompareUnit = String(
      kegiatanDraft.priceCompareUnit ?? "SAMPEL",
    ).trim();
    const activityType = String(kegiatanDraft.activityType ?? "").trim();
    const budgetCode = String(kegiatanDraft.budgetCode ?? "").trim();
    const unitWorkPrice = Number(kegiatanDraft.unitWorkPrice ?? 0);

    if (!selectedTimId) return toast.error("Pilih tim dulu.");
    if (
      !name ||
      !slug ||
      !startDate ||
      !endDate ||
      !sampleType ||
      !priceCompareUnit ||
      !activityType
    )
      return toast.error("Semua field wajib diisi.");

    try {
      if (kegiatanModalMode === "add") {
        await createKegiatan({
          variables: {
            input: {
              name,
              slug,
              surveyActivityId: selectedTimId,
              startDate: new Date(startDate),
              endDate: new Date(endDate),
              targetSample: Number.isFinite(targetSample) ? targetSample : 0,
              sampleType,
              priceCompareUnit: (priceCompareUnit as any) || "SAMPEL",
              activityType,
              budgetCode: budgetCode || null,
              unitWorkPrice: Number.isFinite(unitWorkPrice) ? unitWorkPrice : 0,
            },
          },
        });
        toast.success("Kegiatan ditambahkan.");
      } else {
        const id = String(kegiatanDraft.id ?? "");
        await updateKegiatan({
          variables: {
            subSurveyActivityId: id,
            input: {
              name,
              slug,
              surveyActivityId: selectedTimId,
              startDate: new Date(startDate),
              endDate: new Date(endDate),
              targetSample: Number.isFinite(targetSample) ? targetSample : 0,
              sampleType,
              priceCompareUnit: (priceCompareUnit as any) || "SAMPEL",
              activityType,
              budgetCode: budgetCode || null,
              unitWorkPrice: Number.isFinite(unitWorkPrice) ? unitWorkPrice : 0,
            },
          },
        });
        toast.success("Kegiatan diupdate.");
      }
      setKegiatanModalOpen(false);
      setKegiatanSlugTouched(false);
      await refetchKegiatan();
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal menyimpan kegiatan.");
    }
  }

  async function handleCreateSampleType() {
    const name = String(sampleTypeNameDraft ?? "").trim();
    if (!name) return toast.error("Nama jenis sampel wajib diisi.");
    try {
      await createSampleType({ variables: { input: { name } } });
      toast.success("Jenis sampel ditambahkan.");
      setSampleTypeNameDraft("");
      setSampleTypeModalOpen(false);
      await refetchSampleTypes();
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal menambah jenis sampel.");
    }
  }

  async function handleDeleteKegiatan(id: string) {
    if (!window.confirm("Hapus kegiatan ini?")) return;
    try {
      const res = await deleteKegiatan({ variables: { input: { id } } });
      if (res?.data?.deleteSubSurveyActivity?.success) {
        toast.success(
          res?.data?.deleteSubSurveyActivity?.message ?? "Kegiatan dihapus.",
        );
        await refetchKegiatan();
      } else
        toast.error(
          res?.data?.deleteSubSurveyActivity?.message ??
            "Gagal hapus kegiatan.",
        );
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal hapus kegiatan.");
    }
  }

  async function handleCopyKegiatan(k: SubSurveyActivity) {
    const suffix = Date.now().toString(36).slice(-4);
    const name = `${k.name} (Copy)`;
    const slug = `${formatSlug(k.slug)}-copy-${suffix}`;
    try {
      await createKegiatan({
        variables: {
          input: {
            name,
            slug,
            surveyActivityId: k.surveyActivityId,
            startDate: new Date(k.startDate),
            endDate: new Date(k.endDate),
            targetSample: Number(k.targetSample ?? 0),
            sampleType: k.sampleType,
            activityType: k.activityType,
            priceCompareUnit: k.priceCompareUnit,
          },
        },
      });
      toast.success("Kegiatan disalin.");
      await refetchKegiatan();
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal copy kegiatan.");
    }
  }

  // =========================
  // TAB: PETUGAS
  // =========================
  const [petugasSearch, setPetugasSearch] = useState("");
  const [expandedPairs, setExpandedPairs] = useState<Record<string, boolean>>(
    {},
  );

  const {
    data: upData,
    refetch: refetchUP,
    loading: loadingUP,
  } = useQuery(GET_USER_PROGRESS_BY_SUBSURVEY_ID, {
    variables: { subSurveyActivityId: selectedKegiatanId || "__" },
    skip: !selectedKegiatanId,
  });
  const upList: UserProgress[] = (upData?.userProgressBySubSurveyActivityId ??
    []) as any[];

  const pengawasByKey = useMemo(() => {
    const m = new Map<string, UserProgress>();
    for (const u of upList) {
      if (String(u.progressRole) !== "PENGAWAS") continue;
      m.set(`${u.userId}||${u.blockCount ?? ""}`, u);
    }
    return m;
  }, [upList]);

  const petugasBlocks = useMemo(
    () => upList.filter((u) => String(u.progressRole) === "PETUGAS"),
    [upList],
  );

  type Pair = {
    key: string;
    userId: string;
    superVisorId: string;
    petugasName: string;
    pengawasName: string;
    blocks: Array<{
      petugas: UserProgress;
      pengawas?: UserProgress;
    }>;
  };

  const pairs: Pair[] = useMemo(() => {
    const g = new Map<string, Pair>();
    for (const p of petugasBlocks) {
      const key = `${p.userId}||${p.superVisorId ?? ""}`;
      const petName = p.user?.name ?? "-";
      const supName = p.superVisor?.name ?? "-";
      const pair = g.get(key) ?? {
        key,
        userId: p.userId,
        superVisorId: String(p.superVisorId ?? ""),
        petugasName: petName,
        pengawasName: supName,
        blocks: [],
      };
      pair.blocks.push({
        petugas: p,
        pengawas: p.superVisorId
          ? pengawasByKey.get(`${p.superVisorId}||${p.blockCount ?? ""}`)
          : undefined,
      });
      g.set(key, pair);
    }
    return Array.from(g.values()).sort((a, b) =>
      a.petugasName.localeCompare(b.petugasName),
    );
  }, [petugasBlocks, pengawasByKey]);

  const [addPairOpen, setAddPairOpen] = useState(false);
  const [addPairPetugasId, setAddPairPetugasId] = useState<string>("");
  const [addPairPengawasId, setAddPairPengawasId] = useState<string>("");
  const [addPairSampleCount, setAddPairSampleCount] = useState<number>(1);
  const [addPairHonorTouchedPetugas, setAddPairHonorTouchedPetugas] =
    useState(false);
  const [addPairHonorTouchedPengawas, setAddPairHonorTouchedPengawas] =
    useState(false);

  const [addPairHonorDokPetugas, setAddPairHonorDokPetugas] = useState<string>(
    String(defaultUnitWorkPrice),
  );
  const [addPairHonorDokPengawas, setAddPairHonorDokPengawas] =
    useState<string>(String(defaultUnitWorkPrice));

  async function handleAddPair() {
    if (!selectedKegiatanId) return toast.error("Pilih kegiatan dulu.");
    if (!addPairPetugasId) return toast.error("Petugas wajib dipilih.");
    if (!addPairDistrictId) return toast.error("Kecamatan wajib dipilih.");
    if (!addPairVillageId) return toast.error("Desa wajib dipilih.");
    const n = Number(addPairSampleCount);
    if (!Number.isFinite(n) || n <= 0)
      return toast.error("Jumlah sampel wajib angka > 0.");

    const selectedVillage = villages.find((v) => v.id === addPairVillageId);
    if (selectedVillage && selectedVillage.districtId !== addPairDistrictId) {
      return toast.error("Desa tidak sesuai dengan kecamatan yang dipilih.");
    }

    const blockCount = nextBlockName(addPairPetugasId, addPairPengawasId || "");

    const petugasIsSup = isPrimarySupervisor(addPairPetugasId);
    const pengawasIsSup = isPrimarySupervisor(addPairPengawasId);

    const unitPetugas = petugasIsSup ? 0 : toMoney(addPairHonorDokPetugas);
    const unitPengawas =
      !addPairPengawasId || pengawasIsSup
        ? 0
        : toMoney(addPairHonorDokPengawas);

    const districtId = addPairDistrictId || null;
    const villageId = addPairVillageId || null;

    try {
      await createUserProgress({
        variables: {
          input: {
            userId: addPairPetugasId,
            superVisorId: addPairPengawasId || "",
            subSurveyActivityId: selectedKegiatanId,
            blockCount,
            districtId,
            villageId,
            docsBill: String(unitPetugas * n),
            docsBillPengawas: addPairPengawasId
              ? String(unitPengawas * n)
              : "0",
            totalAssigned: 0,
            submitCount: 0,
            approvedCount: 0,
            rejectedCount: 0,
            samples: Array.from({ length: n }).map((_, idx) => ({
              nus: String(idx + 1).padStart(3, "0"),
              identity: "",
              cacahStatus: "Belum_Cacah",
              approvalStatus: "Menunggu",
              geoLat: null,
              geoLng: null,
            })),
          },
        },
      });
      toast.success("Blok petugas–pengawas ditambahkan.");
      setAddPairSampleCount(1);
      setAddPairHonorDokPetugas(String(defaultUnitWorkPrice));
      setAddPairHonorDokPengawas(String(defaultUnitWorkPrice));
      setAddPairHonorTouchedPetugas(false);
      setAddPairHonorTouchedPengawas(false);
      await refetchUP();
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal menambahkan pair.");
    }
  }

  useEffect(() => {
    if (!addPairOpen) return;

    const petugasIsSup = isPrimarySupervisor(addPairPetugasId);
    const pengawasIsSup = isPrimarySupervisor(addPairPengawasId);

    if (!addPairHonorTouchedPetugas) {
      setAddPairHonorDokPetugas(
        String(petugasIsSup ? 0 : defaultUnitWorkPrice),
      );
    }

    if (!addPairHonorTouchedPengawas) {
      setAddPairHonorDokPengawas(
        String(!addPairPengawasId || pengawasIsSup ? 0 : defaultUnitWorkPrice),
      );
    }
  }, [
    addPairOpen,
    defaultUnitWorkPrice,
    addPairPetugasId,
    addPairPengawasId,
    addPairHonorTouchedPetugas,
    addPairHonorTouchedPengawas,
  ]);

  const filteredPairs = useMemo(() => {
    const q = petugasSearch.trim().toLowerCase();
    if (!q) return pairs;
    return pairs.filter((p) =>
      (p.petugasName + " " + p.pengawasName).toLowerCase().includes(q),
    );
  }, [pairs, petugasSearch]);

  useEffect(
    () => setPetugasPage(1),
    [selectedKegiatanId, petugasSearch, pairs.length],
  );

  const pagedPairs = useMemo(() => {
    const start = (petugasPage - 1) * petugasPageSize;
    return filteredPairs.slice(start, start + petugasPageSize);
  }, [filteredPairs, petugasPage, petugasPageSize]);

  const [pairEdits, setPairEdits] = useState<
    Record<string, { userId: string; superVisorId: string }>
  >({});
  useEffect(() => {
    const next: Record<string, { userId: string; superVisorId: string }> = {};
    for (const p of pairs)
      next[p.key] = { userId: p.userId, superVisorId: p.superVisorId };
    setPairEdits(next);
  }, [pairs.length]);

  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockModalMode, setBlockModalMode] = useState<"add" | "edit">("add");
  const [activePairKey, setActivePairKey] = useState<string>("");
  const [activeBlock, setActiveBlock] = useState<{
    petugasId?: string;
    pengawasId?: string;
  } | null>(null);
  const [identityBlock, setIdentityBlock] = useState({
    petugasName: "",
    pengawasName: "",
  });
  const [blockForm, setBlockForm] = useState({
    blockCount: "",
    districtId: "",
    villageId: "",
    honorPetugas: "",
    honorPengawas: "",
    honorDokPetugas: "",
    honorDokPengawas: "",
  });
  const [samples, setSamples] = useState<
    Array<{ identity: string; cacahStatus: string; approvalStatus: string }>
  >([{ identity: "", cacahStatus: "Belum_Cacah", approvalStatus: "Menunggu" }]);

  const districtOptions = useMemo(
    () =>
      districts.map((d) => ({
        value: d.id,
        label: `${d.name}${d.city ? `, ${d.city}` : ""}`,
      })),
    [districts.length],
  );
  const villageOptions = useMemo(() => {
    const filtered = blockForm.districtId
      ? villages.filter((v) => v.districtId === blockForm.districtId)
      : villages;
    return filtered.map((v) => ({ value: v.id, label: v.name }));
  }, [villages.length, blockForm.districtId]);

  const activeEditPair = useMemo(() => {
    const pair = pairs.find((p) => p.key === activePairKey);
    return (
      pairEdits[activePairKey] ?? {
        userId: pair?.userId ?? "",
        superVisorId: pair?.superVisorId ?? "",
      }
    );
  }, [activePairKey, pairEdits, pairs]);

  const activePetugasIsSup = useMemo(
    () => isPrimarySupervisor(activeEditPair.userId),
    [activeEditPair.userId, users.length],
  );
  const activePengawasIsSup = useMemo(
    () => isPrimarySupervisor(activeEditPair.superVisorId),
    [activeEditPair.superVisorId, users.length],
  );

  useEffect(() => {
    if (!blockModalOpen) return;
    const pair = pairs.find((p) => p.key === activePairKey);
    const editPair = pairEdits[activePairKey] ?? {
      userId: pair?.userId ?? "",
      superVisorId: pair?.superVisorId ?? "",
    };

    const petugasIsSup = isPrimarySupervisor(editPair.userId);
    const pengawasIsSup = isPrimarySupervisor(editPair.superVisorId);

    const perPetugas = petugasIsSup ? 0 : toMoney(blockForm.honorDokPetugas);
    const perPengawas =
      !editPair.superVisorId || pengawasIsSup
        ? 0
        : toMoney(blockForm.honorDokPengawas);

    setBlockForm((p) => ({
      ...p,
      honorDokPetugas: String(perPetugas),
      honorDokPengawas: String(perPengawas),
      honorPetugas: String(perPetugas * samples.length),
      honorPengawas: String(perPengawas * samples.length),
    }));
  }, [
    blockModalOpen,
    samples.length,
    blockForm.honorDokPetugas,
    blockForm.honorDokPengawas,
    activePairKey,
    pairEdits,
    pairs.length,
  ]);

  function safePerSample(total: any, count: number) {
    if (!count || count <= 0) return "0";
    const n = Number(total ?? 0);
    if (!Number.isFinite(n)) return "0";
    return String(n / count);
  }

  function openAddBlock(pairKey: string) {
    setActivePairKey(pairKey);
    setActiveBlock(null);
    setBlockModalMode("add");
    const pair = pairs.find((p) => p.key === pairKey);
    const edit = pairEdits[pairKey] ?? {
      userId: pair?.userId ?? "",
      superVisorId: pair?.superVisorId ?? "",
    };

    const petugasIsSup = isPrimarySupervisor(edit.userId);
    const pengawasIsSup = isPrimarySupervisor(edit.superVisorId);

    const { districtId, villageId } = getUserLocation(edit.userId);

    setBlockForm({
      blockCount: nextBlockName(edit.userId, edit.superVisorId || ""),
      districtId: districtId ?? "",
      villageId: villageId ?? "",
      honorPetugas: "",
      honorPengawas: "",
      honorDokPetugas: String(petugasIsSup ? 0 : defaultUnitWorkPrice),
      honorDokPengawas: String(
        !edit.superVisorId || pengawasIsSup ? 0 : defaultUnitWorkPrice,
      ),
    });
    setSamples([
      { identity: "", cacahStatus: "Belum_Cacah", approvalStatus: "Menunggu" },
    ]);
    setDraftSampleCount(1);
    setActiveBlockOldSampleCount(0);
    setBlockModalOpen(true);
  }

  function openEditBlock(
    pairKey: string,
    petugas: UserProgress,
    pengawas?: UserProgress,
  ) {
    setActivePairKey(pairKey);
    setActiveBlock({ petugasId: petugas.id, pengawasId: pengawas?.id });
    setIdentityBlock({
      petugasName: petugas.user?.name ?? "",
      pengawasName: pengawas?.user?.name ?? "",
    });
    setBlockModalMode("edit");
    const list = (petugas.samples ?? []).map((s) => ({
      identity: s.identity,
      cacahStatus: (s.cacahStatus as any) ?? "Belum_Cacah",
      approvalStatus: (s.approvalStatus as any) ?? "Menunggu",
    }));
    const count = list.length || 0;
    const petugasIsSup = isPrimarySupervisor(petugas.userId);
    const pengawasIsSup = isPrimarySupervisor(pengawas?.userId);

    const unitPetugas = petugasIsSup
      ? "0"
      : count > 0 && toMoney(petugas.docsBill) > 0
        ? safePerSample(petugas.docsBill, count)
        : String(defaultUnitWorkPrice);
    const unitPengawas =
      !pengawas || pengawasIsSup
        ? "0"
        : count > 0 && toMoney(pengawas.docsBill) > 0
          ? safePerSample(pengawas?.docsBill, count)
          : String(defaultUnitWorkPrice);
    setBlockForm({
      blockCount: String(petugas.blockCount ?? ""),
      districtId: String(petugas.districtId ?? ""),
      villageId: String(petugas.villageId ?? ""),
      honorPetugas: String(toMoney(unitPetugas) * count),
      honorPengawas: String(toMoney(unitPengawas) * count),
      honorDokPetugas: String(toMoney(unitPetugas)),
      honorDokPengawas: String(toMoney(unitPengawas)),
    });

    setSamples(
      list.length
        ? list
        : [
            {
              identity: "",
              cacahStatus: "Belum_Cacah",
              approvalStatus: "Menunggu",
            },
          ],
    );
    setDraftSampleCount(count > 0 ? count : 1);
    setActiveBlockOldSampleCount(count);
    setBlockModalOpen(true);
  }

  async function savePair(pairKey: string) {
    const edit = pairEdits[pairKey];
    if (!edit?.userId) return toast.error("Petugas wajib dipilih.");
    const pair = pairs.find((p) => p.key === pairKey);
    if (!pair) return;

    try {
      for (const b of pair.blocks) {
        const { districtId, villageId } = getUserLocation(edit.userId);
        await updateUserProgress({
          variables: {
            input: {
              id: b.petugas.id,
              userId: edit.userId,
              superVisorId: edit.superVisorId || null,
              districtId,
              villageId,
            },
          },
        });
      }
      toast.success("Petugas/Pengawas diupdate.");
      await refetchUP();
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal update petugas/pengawas.");
    }
  }

  async function deletePair(pairKey: string) {
    const pair = pairs.find((p) => p.key === pairKey);
    if (!pair) return;
    if (!window.confirm("Hapus semua blok pada petugas-pengawas ini?")) return;
    try {
      const ids = uniq(
        pair.blocks.flatMap(
          (b) => [b.petugas.id, b.pengawas?.id].filter(Boolean) as string[],
        ),
      );
      for (const id of ids) {
        await deleteUserProgress({ variables: { input: { id } } });
      }
      toast.success("List dihapus.");
      await refetchUP();
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal menghapus list.");
    }
  }

  async function deleteBlock(petugasId: string, pengawasId?: string) {
    if (!window.confirm("Hapus blok ini?")) return;
    try {
      await deleteUserProgress({ variables: { input: { id: petugasId } } });
      if (pengawasId)
        await deleteUserProgress({ variables: { input: { id: pengawasId } } });
      toast.success("Blok dihapus.");
      await refetchUP();
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal hapus blok.");
    }
  }

  async function saveBlock() {
    if (!selectedKegiatanId) return toast.error("Pilih kegiatan dulu.");
    const pair = pairs.find((p) => p.key === activePairKey);
    if (!pair) return toast.error("Pair tidak ditemukan.");
    const editPair = pairEdits[activePairKey] ?? {
      userId: pair.userId,
      superVisorId: pair.superVisorId,
    };

    const blockCount = blockForm.blockCount.trim();
    const districtId = blockForm.districtId || null;
    const villageId = blockForm.villageId || null;
    if (!blockCount) return toast.error("Nama blok wajib diisi.");
    if (!editPair.userId) return toast.error("Petugas wajib dipilih.");

    const sampleCount = Math.max(0, samples.length);
    const honorPetugas = Number(blockForm.honorPetugas);
    const honorPengawas = Number(blockForm.honorPengawas);
    const docsBillPetugas = String(honorPetugas);
    const docsBillPengawas = String(honorPengawas);

    const petugasUser = users.find((u) => u.id === editPair.userId);
    const petugasLimit = Number(petugasUser?.limit_bill ?? 0);
    const petugasBill = Number(docsBillPetugas);
    if (petugasLimit > 0 && petugasBill > petugasLimit) {
      return toast.error(
        `Honor petugas melebihi limit bill (${petugasLimit.toLocaleString("id-ID")}).`,
      );
    }

    if (editPair.superVisorId) {
      const pengawasUser = users.find((u) => u.id === editPair.superVisorId);
      const pengawasLimit = Number(pengawasUser?.limit_bill ?? 0);
      const pengawasBill = Number(docsBillPengawas);
      if (pengawasLimit > 0 && pengawasBill > pengawasLimit) {
        return toast.error(
          `Honor pengawas melebihi limit bill (${pengawasLimit.toLocaleString("id-ID")}).`,
        );
      }
    }

    try {
      if (blockModalMode === "add") {
        await createUserProgress({
          variables: {
            input: {
              userId: editPair.userId,
              superVisorId: editPair.superVisorId || "",
              subSurveyActivityId: selectedKegiatanId,
              districtId,
              villageId,
              blockCount,
              docsBill: docsBillPetugas,
              docsBillPengawas,
              totalAssigned: 0,
              submitCount: 0,
              approvedCount: 0,
              rejectedCount: 0,
              samples: samples.map((s, idx) => ({
                nus: String(idx + 1).padStart(3, "0"),
                identity: s.identity,
                cacahStatus: s.cacahStatus,
                approvalStatus: s.approvalStatus,
                geoLat: null,
                geoLng: null,
              })),
            },
          },
        });
        toast.success("Blok ditambahkan.");
      } else {
        if (!activeBlock?.petugasId) return;
        await updateUserProgress({
          variables: {
            input: {
              id: activeBlock.petugasId,
              districtId,
              villageId,
              blockCount,
              docsBill: docsBillPetugas,
              docsBillPengawas: editPair.superVisorId ? docsBillPengawas : null,
              superVisorId: editPair.superVisorId || null,
              samples: samples.map((s, idx) => ({
                nus: String(idx + 1).padStart(3, "0"),
                identity: s.identity,
                cacahStatus: s.cacahStatus,
                approvalStatus: s.approvalStatus,
                geoLat: null,
                geoLng: null,
              })),
            },
          },
        });

        toast.success("Blok diupdate.");
      }

      setBlockModalOpen(false);
      setDraftSampleCount(null);
      setActiveBlockOldSampleCount(0);
      await refetchUP();
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal menyimpan blok.");
    }
  }

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const blockModalScrollRef = useRef<HTMLDivElement | null>(null);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(false);

  useEffect(() => {
    if (!blockModalOpen || !shouldScrollToBottom) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = blockModalScrollRef.current;
        if (!el) return;

        el.scrollTo({
          top: el.scrollHeight,
          behavior: "smooth",
        });

        setShouldScrollToBottom(false);
      });
    });
  }, [samples.length, blockModalOpen, shouldScrollToBottom]);

  function pickUploadPetugasSheet(wb: any) {
    const target = "UPLOAD_PETUGAS";
    const sheetName = wb.SheetNames.includes(target)
      ? target
      : wb.SheetNames[0];
    return { sheetName, ws: wb.Sheets[sheetName] };
  }

  async function handleUploadExcel(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const { sheetName, ws } = pickUploadPetugasSheet(wb);
      if (!ws) throw new Error(`Sheet tidak ditemukan: ${sheetName}`);
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

      const errors: Array<{ row: number; message: string }> = [];
      rows.forEach((r: any, i: number) => {
        const rowNo = i + 2;
        const petugasId = String(r["Id Petugas"] ?? "").trim();
        const pengawasId = String(r["Id Pengawas"] ?? "").trim();
        const honorPetugas = Number(r["Honor Petugas"]);
        const honorPengawas = Number(r["Honor Pengawas"]);

        if (petugasId) {
          const u = users.find((x) => x.id === petugasId);
          const lim = Number(u?.limit_bill ?? 0);
          if (lim > 0 && honorPetugas > lim)
            errors.push({
              row: rowNo,
              message: `Honor petugas (${honorPetugas.toLocaleString("id-ID")}) > limit_bill (${lim.toLocaleString("id-ID")})`,
            });
        }
        if (pengawasId) {
          const u = users.find((x) => x.id === pengawasId);
          const lim = Number(u?.limit_bill ?? 0);
          if (lim > 0 && honorPengawas > lim)
            errors.push({
              row: rowNo,
              message: `Honor pengawas (${honorPengawas.toLocaleString("id-ID")}) > limit_bill (${lim.toLocaleString("id-ID")})`,
            });
        }
      });

      if (errors.length) {
        console.error("Limit bill validation errors:", errors);
        toast.error(
          `Upload dibatalkan. Ada ${errors.length} baris melebihi limit_bill. (Detail ada di console)`,
        );
        return;
      }

      const res = await bulkImportExcel({ variables: { file } });
      const r = res?.data?.bulkImportUserProgressExcel;
      if (r?.errors?.length) {
        toast.error(
          `Upload selesai dengan ${r.errors.length} error. Cek baris yang ditolak.`,
        );
        console.error(r.errors);
      } else {
        toast.success("Upload selesai.");
      }
      await refetchUP();
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal upload excel.");
    }
  }

  function downloadTemplate() {
    const subs: SubSurveyActivity[] = (kegiatanList ?? []) as any[];

    const uploadSheetRows = [
      {
        "Nomor Petugas": 1,
        "Id Kegiatan": "Copy dari MASTER_KEGIATAN",
        "Id Petugas": "Copy dari MASTER_PENGGUNA",
        "Id Pengawas": "Copy dari MASTER_PENGGUNA",
        "Id Kecamatan": "Copy dari MASTER_KECAMATAN",
        "Id Desa": "Copy dari MASTER_DESA",
        "Nama Blok": "",
        "Jumlah Sampel": "",
        "Honor Petugas": "",
        "Honor Pengawas": "",
      },
    ];

    const masterUsers = users.map((u, i) => ({
      No: i + 1,
      "Nama Pengguna": u.name,
      "Email Pengguna": u.email,
      "Id Pengguna": u.id,
      "Masukkan Daftar Nama Pengguna": "Sesuaikan dengan nama asli (proper)",
      "Masukkan Daftar Nama Pengawas": "Sesuaikan dengan nama asli (proper)",
      "Formula Ambil Id Pengguna": `=VLOOKUP(E${i + 2};$B:$D;3;FALSE)`,
      "Formula Ambil Id Pengawas": `=VLOOKUP(F${i + 2};$B:$D;3;FALSE)`,
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

    const masterDistrict = districts.map((d, i) => ({
      No: i + 1,
      "Nama Kota": d.city,
      "Nama Kecamatan": d.name,
      "Id Kecamatan": d.id,
    }));

    const masterVillage = villages.map((v, i) => ({
      No: i + 1,
      "Id Kecamatan": v.districtId,
      "Nama Desa": v.name,
      "Id Desa": v.id,
    }));

    const sampleRows = [
      {
        "Nomor Petugas": "Isi sesuai Nomor Petugas pada sheet UPLOAD_PETUGAS",
        NUS: "",
        "Identitas Sampel": "",
        "Status Cacah": "",
        "Status Approval": "",
        GeoLat: "",
        GeoLng: "",
      },
    ];

    const wb = XLSX.utils.book_new();
    const wsUpload = XLSX.utils.json_to_sheet(uploadSheetRows);
    const wsUsers = XLSX.utils.json_to_sheet(masterUsers);
    const wsSubs = XLSX.utils.json_to_sheet(masterSubs);
    const wsDistrict = XLSX.utils.json_to_sheet(masterDistrict);
    const wsVillage = XLSX.utils.json_to_sheet(masterVillage);
    const wsSamples = XLSX.utils.json_to_sheet(sampleRows);

    XLSX.utils.book_append_sheet(wb, wsUpload, "UPLOAD_PETUGAS");
    XLSX.utils.book_append_sheet(wb, wsSamples, "UPLOAD_SAMPEL");
    XLSX.utils.book_append_sheet(wb, wsUsers, "MASTER_PENGGUNA");
    XLSX.utils.book_append_sheet(wb, wsSubs, "MASTER_KEGIATAN");
    XLSX.utils.book_append_sheet(wb, wsDistrict, "MASTER_KECAMATAN");
    XLSX.utils.book_append_sheet(wb, wsVillage, "MASTER_DESA");

    XLSX.writeFile(wb, `Template_Upload_Petugas.xlsx`);
  }

  // =========================
  // UI
  // =========================
  const tabBtn = (k: TabKey, label: string) => (
    <button
      type="button"
      onClick={() => setTabPersist(k)}
      className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === k ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800 hover:bg-gray-200"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-6 md:px-8 py-6 space-y-4 font-Poppins">
      <div className="bg-orange-50 rounded-lg p-3 md:p-4 font-bold text-lg md:text-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-md">
        <span>Admin</span>
        <div className="flex gap-2">
          {tabBtn("tim", "Tim")}
          {tabBtn("kegiatan", "Kegiatan")}
          {tabBtn("petugas", "Petugas")}
        </div>
      </div>

      {/* ================= TIM ================= */}
      {tab === "tim" && (
        <div className="bg-white rounded-lg p-4 shadow-md space-y-3">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 w-full">
              <input
                className="w-full px-3 py-2 border rounded-md bg-white"
                placeholder="Nama tim"
                value={timDraft.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setTimDraft((p) => ({
                    ...p,
                    name,
                    slug: timSlugTouched ? p.slug : formatSlug(name),
                  }));
                }}
              />
              <input
                className="w-full px-3 py-2 border rounded-md bg-white"
                placeholder="Slug"
                value={timDraft.slug}
                onChange={(e) => {
                  setTimSlugTouched(true);
                  setTimDraft((p) => ({ ...p, slug: e.target.value }));
                }}
              />
              <HUSelect
                value={timDraft.chiefId || null}
                onValueChange={(v) =>
                  setTimDraft((p) => ({ ...p, chiefId: (v ?? "") as string }))
                }
                options={ketuaOptions}
                placeholder="Ketua tim"
              />
            </div>
            <button
              type="button"
              onClick={handleAddTim}
              disabled={creatingTim}
              className={`${styles.button} text-white w-full`}
            >
              {creatingTim ? "Menyimpan..." : "Tambah Tim"}
            </button>
          </div>

          <div className="overflow-auto max-h-[60vh] border rounded-lg">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b bg-gray-50">
                  <th className="py-2 px-3 sticky top-0 bg-gray-50 z-10 font-semibold text-gray-700">
                    Nama Tim
                  </th>
                  <th className="py-2 px-3 sticky top-0 bg-gray-50 z-10 font-semibold text-gray-700">
                    Slug
                  </th>
                  <th className="py-2 px-3 sticky top-0 bg-gray-50 z-10 font-semibold text-gray-700">
                    Ketua Tim
                  </th>
                  <th className="py-2 px-3 w-28 sticky top-0 bg-gray-50 z-10 font-semibold text-gray-700">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagedTims.map((t) => {
                  const row = timRowEdits[t.id] ?? {
                    name: t.name,
                    slug: t.slug,
                    chiefId: t.chiefId,
                  };
                  return (
                    <tr
                      key={t.id}
                      className="text-left border-b hover:bg-gray-50"
                    >
                      <td className="py-2 px-3">
                        <input
                          className="w-full px-2 py-1 border rounded bg-white"
                          value={row.name}
                          onChange={(e) =>
                            setTimRowEdits((p) => ({
                              ...p,
                              [t.id]: { ...row, name: e.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          className="w-full px-2 py-1 border rounded bg-white"
                          value={row.slug}
                          onChange={(e) =>
                            setTimRowEdits((p) => ({
                              ...p,
                              [t.id]: { ...row, slug: e.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="py-2 px-3">
                        <HUSelect
                          value={row.chiefId || null}
                          onValueChange={(v) =>
                            setTimRowEdits((p) => ({
                              ...p,
                              [t.id]: { ...row, chiefId: (v ?? "") as string },
                            }))
                          }
                          options={ketuaOptions}
                          placeholder="Pilih ketua tim"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex gap-2">
                          <IconButton
                            title="Simpan"
                            onClick={() => handleSaveTimRow(t.id)}
                            variant="primary"
                          >
                            <Save size={16} />
                          </IconButton>
                          <IconButton
                            title="Hapus"
                            onClick={() => handleDeleteTim(t.id)}
                            variant="danger"
                          >
                            <X size={16} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pager
            page={timPage}
            pageSize={timPageSize}
            total={tims.length}
            onPageChange={setTimPage}
            onPageSizeChange={setTimPageSize}
          />
        </div>
      )}

      {/* ================= KEGIATAN ================= */}
      {tab === "kegiatan" && (
        <div className="bg-white rounded-lg p-4 shadow-md space-y-3">
          <div className="py-4 space-y-2 w-full">
            <div className="flex justify-between space-x-2 w-full">
              <HUSelect
                value={selectedTimId || null}
                onValueChange={(v) => {
                  setSelectedTimId((v ?? "") as string);
                  setSelectedKegiatanId("");
                }}
                options={tims.map((t) => ({ value: t.id, label: t.name }))}
                placeholder="Pilih tim"
                className="w-full"
              />
              <div className="relative w-full">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  className="w-full pl-9 pr-3 py-2 border rounded-md bg-white"
                  placeholder="Cari kegiatan"
                  value={kegiatanSearch}
                  onChange={(e) => setKegiatanSearch(e.target.value)}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={openAddKegiatan}
              className={`${styles.button} text-white`}
            >
              Tambah Kegiatan
            </button>
          </div>

          <div className="overflow-auto max-h-[60vh] border rounded-lg">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b bg-gray-50">
                  <th className="py-2 px-3 sticky top-0 bg-gray-50 z-10 font-semibold text-gray-700">
                    Nama Kegiatan
                  </th>
                  <th className="py-2 px-3 w-32 sticky top-0 bg-gray-50 z-10 font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="py-2 px-3 w-40 sticky top-0 bg-gray-50 z-10 font-semibold text-gray-700">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagedKegiatan.map((k) => (
                  <tr
                    key={k.id}
                    className="text-left border-b hover:bg-gray-50"
                  >
                    <td className="py-2 px-3">{k.name}</td>
                    <td className="py-2 px-3">
                      {isKeuangan ? (
                        <IconButton
                          title="Ubah Status"
                          onClick={() => {
                            setPickedStatus({
                              id: k.id,
                              status: k.status ?? "BERJALAN",
                            });
                            setStatusModalOpen(true);
                          }}
                          variant="neutral"
                        >
                          <span className="text-xs font-semibold">
                            {k.status ?? "-"}
                          </span>
                        </IconButton>
                      ) : (
                        <span className="rounded border px-2 py-1 text-xs">
                          {k.status ?? "-"}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex gap-2">
                        <IconButton
                          title="Update"
                          onClick={() => openEditKegiatan(k)}
                          variant="neutral"
                        >
                          <Pencil size={16} />
                        </IconButton>
                        <IconButton
                          title="Copy"
                          onClick={() => handleCopyKegiatan(k)}
                          variant="neutral"
                        >
                          <Copy size={16} />
                        </IconButton>
                        <IconButton
                          title="Hapus"
                          onClick={() => handleDeleteKegiatan(k.id)}
                          variant="danger"
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pager
            page={kegiatanPage}
            pageSize={kegiatanPageSize}
            total={filteredKegiatan.length}
            onPageChange={setKegiatanPage}
            onPageSizeChange={setKegiatanPageSize}
          />

          {kegiatanModalOpen && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-3 z-50">
              <div className="bg-white w-full max-w-2xl rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold">
                    {kegiatanModalMode === "add"
                      ? "Tambah Kegiatan"
                      : "Update Kegiatan"}
                  </div>
                  <IconButton
                    title="Tutup"
                    onClick={() => setKegiatanModalOpen(false)}
                    variant="neutral"
                  >
                    <X size={16} />
                  </IconButton>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <div className="text-sm font-semibold mb-1">
                      Nama kegiatan
                    </div>
                    <input
                      className="w-full px-3 py-2 border rounded bg-white"
                      value={String(kegiatanDraft.name ?? "")}
                      onChange={(e) => {
                        const name = e.target.value;
                        setKegiatanDraft((p) => ({
                          ...p,
                          name,
                          slug: kegiatanSlugTouched ? p.slug : formatSlug(name),
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-1">Slug</div>
                    <input
                      className="w-full px-3 py-2 border rounded bg-white"
                      value={String(kegiatanDraft.slug ?? "")}
                      onChange={(e) => {
                        setKegiatanSlugTouched(true);
                        setKegiatanDraft((p) => ({
                          ...p,
                          slug: e.target.value,
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-1">
                      Tanggal mulai
                    </div>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border rounded bg-white text-black"
                      value={String(kegiatanDraft.startDate ?? "")}
                      onChange={(e) =>
                        setKegiatanDraft((p) => ({
                          ...p,
                          startDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-1">
                      Tanggal selesai
                    </div>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border rounded bg-white"
                      value={String(kegiatanDraft.endDate ?? "")}
                      onChange={(e) =>
                        setKegiatanDraft((p) => ({
                          ...p,
                          endDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-1">
                      Target sampel
                    </div>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border rounded bg-white"
                      value={Number(kegiatanDraft.targetSample ?? 0)}
                      onChange={(e) =>
                        setKegiatanDraft((p) => ({
                          ...p,
                          targetSample: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-1">
                      Jenis sampel
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <HUSelect
                          value={String(kegiatanDraft.sampleType ?? "") || null}
                          onValueChange={(v) =>
                            setKegiatanDraft((p) => ({
                              ...p,
                              sampleType: (v ?? "") as string,
                            }))
                          }
                          options={sampleTypeOptions}
                          placeholder={
                            sampleTypesLoading ? "Memuat..." : "Pilih"
                          }
                        />
                      </div>
                      <IconButton
                        title="Tambah jenis sampel"
                        onClick={() => setSampleTypeModalOpen(true)}
                        variant="neutral"
                      >
                        <Plus size={16} />
                      </IconButton>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-1">
                      Jenis kegiatan
                    </div>
                    <HUSelect
                      value={String(kegiatanDraft.activityType ?? "") || null}
                      onValueChange={(v) =>
                        setKegiatanDraft((p) => ({
                          ...p,
                          activityType: (v ?? "") as string,
                        }))
                      }
                      options={[
                        { value: "Listing", label: "Listing" },
                        { value: "Pencacahan", label: "Pencacahan" },
                      ]}
                      placeholder="Pilih"
                    />
                  </div>

                  <div>
                    <div className="text-sm font-semibold mb-1">
                      Kode beban anggaran (opsional)
                    </div>
                    <input
                      className="w-full px-3 py-2 border rounded bg-white"
                      value={String(kegiatanDraft.budgetCode ?? "")}
                      onChange={(e) =>
                        setKegiatanDraft((p) => ({
                          ...p,
                          budgetCode: e.target.value,
                        }))
                      }
                      placeholder="Contoh: 123.45.678"
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-1">
                      Harga satuan pekerjaan
                    </div>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border rounded bg-white"
                      value={Number(kegiatanDraft.unitWorkPrice ?? 0)}
                      onChange={(e) =>
                        setKegiatanDraft((p) => ({
                          ...p,
                          unitWorkPrice: Number(e.target.value),
                        }))
                      }
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-1">
                      Satuan pembanding harga
                    </div>
                    <HUSelect
                      value={
                        String(kegiatanDraft.priceCompareUnit ?? "SAMPEL") ||
                        "SAMPEL"
                      }
                      onValueChange={(v) =>
                        setKegiatanDraft((p) => ({
                          ...p,
                          priceCompareUnit: (v ?? "SAMPEL") as any,
                        }))
                      }
                      options={[
                        { value: "SAMPEL", label: "Sampel" },
                        { value: "BLOK", label: "Blok" },
                      ]}
                      placeholder="Pilih"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setKegiatanModalOpen(false)}
                    className="px-4 py-2 rounded bg-gray-100"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={saveKegiatan}
                    className={`${styles.button} text-white`}
                  >
                    Simpan
                  </button>
                </div>
              </div>
            </div>
          )}

          {sampleTypeModalOpen && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-3 z-50">
              <div className="bg-white w-full max-w-md rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold">Tambah Jenis Sampel</div>
                  <IconButton
                    title="Tutup"
                    onClick={() => setSampleTypeModalOpen(false)}
                    variant="neutral"
                  >
                    <X size={16} />
                  </IconButton>
                </div>

                <div>
                  <div className="text-sm font-semibold mb-1">Nama</div>
                  <input
                    className="w-full px-3 py-2 border rounded bg-white"
                    value={sampleTypeNameDraft}
                    onChange={(e) => setSampleTypeNameDraft(e.target.value)}
                    placeholder="Contoh: Sampel Rumah Tangga"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSampleTypeModalOpen(false)}
                    className="px-4 py-2 rounded bg-gray-100"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateSampleType}
                    className={`${styles.button} text-white`}
                  >
                    Simpan
                  </button>
                </div>
              </div>
            </div>
          )}

          <UpdateActivityStatusModal
            open={statusModalOpen}
            onClose={() => {
              setStatusModalOpen(false);
              refetchKegiatan();
            }}
            activityId={pickedStatus?.id ?? ""}
            currentStatus={pickedStatus?.status ?? "BERJALAN"}
          />
        </div>
      )}

      {/* ================= PETUGAS ================= */}
      {tab === "petugas" && (
        <div className="bg-white rounded-lg p-4 shadow-md space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <HUSelect
              value={selectedTimId || null}
              onValueChange={(v) => {
                setSelectedTimId((v ?? "") as string);
                setSelectedKegiatanId("");
              }}
              options={tims.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Pilih tim"
            />
            <HUComboBox
              value={selectedKegiatanId || null}
              onValueChange={(v) => setSelectedKegiatanId((v ?? "") as string)}
              options={(kegiatanList ?? []).map((k) => ({
                value: k.id,
                label: k.name,
              }))}
              placeholder="Pilih kegiatan"
            />
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                className="w-full pl-9 pr-3 py-2 border rounded-md bg-white"
                placeholder="Cari petugas/pengawas"
                value={petugasSearch}
                onChange={(e) => setPetugasSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={downloadTemplate}
                className="px-4 py-2 rounded bg-gray-800 text-white"
              >
                Download Template Excel
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUploadExcel(f);
                  e.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingExcel}
                className="px-4 py-2 rounded bg-blue-600 text-white"
              >
                {uploadingExcel ? "Uploading..." : "Upload Excel"}
              </button>
              <button
                type="button"
                onClick={() => setExpandedPairs({})}
                className="px-4 py-2 rounded bg-gray-200 text-gray-800"
              >
                Tutup Semua Dropdown
              </button>
            </div>
            <div className="text-xs text-gray-500">
              <button
                type="button"
                disabled={selectedKegiatanId === ""}
                onClick={() => setAddPairOpen((v) => !v)}
                className={`${styles.button} text-white w-full`}
              >
                Tambah Petugas
              </button>
            </div>
          </div>

          {addPairOpen && (
            <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <HUComboBox
                  value={addPairPetugasId || null}
                  onValueChange={(v) => {
                    const id = (v ?? "") as string;
                    setAddPairPetugasId(id);

                    const loc = getUserLocation(id);
                    setAddPairDistrictId(loc.districtId ?? "");
                    setAddPairVillageId(loc.villageId ?? "");

                    if (!addPairHonorTouchedPetugas) {
                      setAddPairHonorDokPetugas(
                        String(
                          isPrimarySupervisor(id) ? 0 : defaultUnitWorkPrice,
                        ),
                      );
                    }
                  }}
                  options={petugasOptions}
                  placeholder="Pilih petugas"
                />
                <HUComboBox
                  value={addPairPengawasId || null}
                  onValueChange={(v) => {
                    const id = (v ?? "") as string;
                    setAddPairPengawasId(id);

                    if (!addPairHonorTouchedPengawas) {
                      setAddPairHonorDokPengawas(
                        String(
                          !id || isPrimarySupervisor(id)
                            ? 0
                            : defaultUnitWorkPrice,
                        ),
                      );
                    }
                  }}
                  options={pengawasOptions}
                  placeholder="Pilih pengawas"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="text-sm">Kecamatan</label>
                  <HUSelect
                    value={addPairDistrictId || null}
                    onValueChange={(v) => {
                      setAddPairDistrictId((v ?? "") as string);
                      setAddPairVillageId("");
                    }}
                    options={districtOptions}
                    placeholder="Pilih kecamatan"
                  />
                </div>

                <div>
                  <label className="text-sm">Desa</label>
                  <HUSelect
                    value={addPairVillageId || null}
                    onValueChange={(v) =>
                      setAddPairVillageId((v ?? "") as string)
                    }
                    options={addPairVillageOptions}
                    placeholder="Pilih desa"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label htmlFor="addPairSampleCount" className="text-sm">
                    Jumlah Sampel
                  </label>
                  <input
                    id="addPairSampleCount"
                    className="w-full px-3 py-2 border rounded-md bg-white"
                    placeholder="Jumlah sampel"
                    inputMode="numeric"
                    value={String(addPairSampleCount)}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9]/g, "");
                      setAddPairSampleCount(v ? Number(v) : 0);
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="addPairHonorDokPetugas" className="text-sm">
                    Honor/dok petugas
                  </label>
                  <input
                    id="addPairHonorDokPetugas"
                    className="w-full px-3 py-2 border rounded-md bg-white"
                    placeholder="Honor/dok petugas"
                    inputMode="numeric"
                    disabled={isPrimarySupervisor(addPairPetugasId)}
                    value={
                      isPrimarySupervisor(addPairPetugasId)
                        ? "0"
                        : String(addPairHonorDokPetugas)
                    }
                    onChange={(e) => {
                      setAddPairHonorTouchedPetugas(true);
                      setAddPairHonorDokPetugas(
                        e.target.value.replace(/[^0-9]/g, ""),
                      );
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="addPairHonorDokPengawas" className="text-sm">
                    Honor/dok pengawas
                  </label>
                  <input
                    id="addPairHonorDokPengawas"
                    className="w-full px-3 py-2 border rounded-md bg-white"
                    placeholder="Honor/dok pengawas"
                    inputMode="numeric"
                    disabled={
                      !addPairPengawasId ||
                      isPrimarySupervisor(addPairPengawasId)
                    }
                    value={
                      !addPairPengawasId ||
                      isPrimarySupervisor(addPairPengawasId)
                        ? "0"
                        : String(addPairHonorDokPengawas)
                    }
                    onChange={(e) => {
                      setAddPairHonorTouchedPengawas(true);
                      setAddPairHonorDokPengawas(
                        e.target.value.replace(/[^0-9]/g, ""),
                      );
                    }}
                  />
                </div>
              </div>
              <div className="text-xs text-gray-600">
                Blok akan dibuat otomatis:{" "}
                <b>
                  {addPairPetugasId
                    ? nextBlockName(addPairPetugasId, addPairPengawasId || "")
                    : "-"}
                </b>
                {" • "}
                Total honor petugas:{" "}
                <b>
                  {(
                    (isPrimarySupervisor(addPairPetugasId)
                      ? 0
                      : toMoney(addPairHonorDokPetugas)) *
                    (Number(addPairSampleCount) || 0)
                  ).toLocaleString("id-ID")}
                </b>
                {" • "}
                Total honor pengawas:{" "}
                <b>
                  {(
                    (!addPairPengawasId ||
                    isPrimarySupervisor(addPairPengawasId)
                      ? 0
                      : toMoney(addPairHonorDokPengawas)) *
                    (Number(addPairSampleCount) || 0)
                  ).toLocaleString("id-ID")}
                </b>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleAddPair()}
                  disabled={creatingUserProgress}
                  className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
                >
                  {creatingUserProgress ? "Menyimpan..." : "Simpan"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddPairOpen(false);
                    setAddPairPetugasId("");
                    setAddPairPengawasId("");
                    setAddPairDistrictId("");
                    setAddPairVillageId("");
                    setAddPairSampleCount(1);
                    setAddPairHonorDokPetugas(String(defaultUnitWorkPrice));
                    setAddPairHonorDokPengawas(String(defaultUnitWorkPrice));
                    setAddPairHonorTouchedPetugas(false);
                    setAddPairHonorTouchedPengawas(false);
                  }}
                  className="px-4 py-2 rounded bg-white border"
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          <div className="overflow-auto max-h-[60vh] border rounded-lg">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b bg-gray-50">
                  <th className="py-2 px-3 sticky top-0 bg-gray-50 z-10 font-semibold text-gray-700">
                    Petugas
                  </th>
                  <th className="py-2 px-3 sticky top-0 bg-gray-50 z-10 font-semibold text-gray-700">
                    Pengawas
                  </th>
                  <th className="py-2 px-3 w-40 sticky top-0 bg-gray-50 z-10 font-semibold text-gray-700">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {!selectedKegiatanId ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-gray-500">
                      Pilih kegiatan dulu.
                    </td>
                  </tr>
                ) : loadingUP ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-gray-500">
                      Data sedang dimuat...
                    </td>
                  </tr>
                ) : pagedPairs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-gray-500">
                      Belum ada data.
                    </td>
                  </tr>
                ) : (
                  pagedPairs.map((p) => {
                    const edit = pairEdits[p.key] ?? {
                      userId: p.userId,
                      superVisorId: p.superVisorId,
                    };
                    const expanded = !!expandedPairs[p.key];
                    const serverSampleCount = p.blocks.reduce(
                      (acc, b) => acc + (b.petugas.samples?.length ?? 0),
                      0,
                    );

                    const shownSampleCount =
                      blockModalOpen &&
                      activePairKey === p.key &&
                      draftSampleCount !== null
                        ? serverSampleCount -
                          activeBlockOldSampleCount +
                          draftSampleCount
                        : serverSampleCount;

                    return (
                      <React.Fragment key={p.key}>
                        <tr className="border-b hover:bg-gray-50 py-2">
                          <td className="py-2 px-3">
                            <HUComboBox
                              value={edit.userId || null}
                              onValueChange={(v) =>
                                setPairEdits((prev) => ({
                                  ...prev,
                                  [p.key]: {
                                    ...edit,
                                    userId: (v ?? "") as string,
                                  },
                                }))
                              }
                              options={userOptions}
                              placeholder="Pilih petugas"
                            />
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-600">
                              <span className="px-2 py-0.5 rounded bg-gray-100">
                                Blok: {p.blocks.length}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-gray-100">
                                Sampel: {shownSampleCount}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <HUComboBox
                              value={edit.superVisorId || null}
                              onValueChange={(v) =>
                                setPairEdits((prev) => ({
                                  ...prev,
                                  [p.key]: {
                                    ...edit,
                                    superVisorId: (v ?? "") as string,
                                  },
                                }))
                              }
                              options={[
                                { value: "", label: "-" },
                                ...userOptions,
                              ]}
                              placeholder="Pilih pengawas"
                            />
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-600 py-[10px]"></div>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex gap-2">
                              <IconButton
                                title="Tambah blok"
                                onClick={() => openAddBlock(p.key)}
                                variant="neutral"
                              >
                                <Plus size={16} />
                              </IconButton>
                              <IconButton
                                title="Simpan petugas/pengawas"
                                onClick={() => savePair(p.key)}
                                variant="primary"
                              >
                                <Save size={16} />
                              </IconButton>
                              <IconButton
                                title="Hapus list"
                                onClick={() => deletePair(p.key)}
                                variant="danger"
                              >
                                <X size={16} />
                              </IconButton>
                              <IconButton
                                title="Tampilkan blok"
                                onClick={() =>
                                  setExpandedPairs((x) => ({
                                    ...x,
                                    [p.key]: !expanded,
                                  }))
                                }
                                variant="neutral"
                              >
                                <ChevronDown size={16} />
                              </IconButton>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-600 py-[10px]"></div>
                          </td>
                        </tr>

                        {expanded && (
                          <tr className="border-b bg-gray-50">
                            <td colSpan={3} className="py-2">
                              <div className="space-y-2">
                                {p.blocks.map((b) => {
                                  const dName = b.petugas.district?.name ?? "-";
                                  const vName = b.petugas.village?.name ?? "-";
                                  const pengawasDocs =
                                    b.pengawas?.docsBill ?? "0";
                                  const blockLabel = (() => {
                                    const bc = String(
                                      b.petugas.blockCount ?? "",
                                    );
                                    if (!bc) return "(tanpa nama blok)";
                                    return bc.startsWith("DRAFT-")
                                      ? "DRAFT"
                                      : bc;
                                  })();
                                  return (
                                    <div
                                      key={b.petugas.id}
                                      className="flex items-center justify-between gap-2 border rounded p-2 bg-white"
                                    >
                                      <div className="text-sm">
                                        <div className="font-semibold">
                                          {blockLabel}
                                        </div>
                                        <div className="text-xs text-gray-600">
                                          {dName} • {vName} • Honor petugas:{" "}
                                          {toMoney(
                                            b.petugas.docsBill,
                                          ).toLocaleString("id-ID")}{" "}
                                          • Honor pengawas:{" "}
                                          {toMoney(pengawasDocs).toLocaleString(
                                            "id-ID",
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <IconButton
                                          title="Update blok"
                                          onClick={() =>
                                            openEditBlock(
                                              p.key,
                                              b.petugas,
                                              b.pengawas,
                                            )
                                          }
                                          variant="neutral"
                                        >
                                          <Pencil size={16} />
                                        </IconButton>
                                        <IconButton
                                          title="Hapus blok"
                                          onClick={() =>
                                            deleteBlock(
                                              b.petugas.id,
                                              b.pengawas?.id,
                                            )
                                          }
                                          variant="danger"
                                        >
                                          <Trash2 size={16} />
                                        </IconButton>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <Pager
            page={petugasPage}
            pageSize={petugasPageSize}
            total={filteredPairs.length}
            onPageChange={setPetugasPage}
            onPageSizeChange={setPetugasPageSize}
          />

          {blockModalOpen && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-3 z-50">
              <div
                ref={blockModalScrollRef}
                className="bg-white w-full max-w-4xl rounded-lg p-4 space-y-3 max-h-[90vh] overflow-auto"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold">
                    {blockModalMode === "add"
                      ? "Tambah Blok"
                      : `Update Blok (${identityBlock.petugasName}-${identityBlock.pengawasName})`}
                  </div>
                  <IconButton
                    title="Tutup"
                    onClick={() => {
                      setBlockModalOpen(false);
                      setDraftSampleCount(null);
                      setActiveBlockOldSampleCount(0);
                    }}
                    variant="neutral"
                  >
                    <X size={16} />
                  </IconButton>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <div className="text-sm font-semibold mb-1">Nama blok</div>
                    <input
                      className="w-full px-3 py-2 border rounded bg-white"
                      value={blockForm.blockCount}
                      onChange={(e) =>
                        setBlockForm((p) => ({
                          ...p,
                          blockCount: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <div className="text-sm font-semibold mb-1">
                        Harga satuan pekerjaan
                      </div>
                      <input
                        className="w-full px-3 py-2 border rounded bg-white"
                        value={toMoney(
                          String(defaultUnitWorkPrice),
                        ).toLocaleString("id-ID")}
                        disabled
                      />
                    </div>

                    <div>
                      <div className="text-sm font-semibold mb-1">
                        Honor petugas per sampel
                      </div>
                      <input
                        className="w-full px-3 py-2 border rounded bg-white"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        disabled={activePetugasIsSup}
                        value={
                          activePetugasIsSup
                            ? "0"
                            : (toMoney(
                                blockForm.honorDokPetugas,
                              ).toLocaleString("id-ID") ?? "")
                        }
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, "");
                          setBlockForm((p) => ({
                            ...p,
                            honorDokPetugas: raw,
                          }));
                        }}
                      />
                    </div>

                    <div>
                      <div className="text-sm font-semibold mb-1">
                        Honor pengawas per sampel
                      </div>
                      <input
                        className="w-full px-3 py-2 border rounded bg-white"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        disabled={
                          !activeEditPair.superVisorId || activePengawasIsSup
                        }
                        value={
                          !activeEditPair.superVisorId || activePengawasIsSup
                            ? "0"
                            : (toMoney(
                                blockForm.honorDokPengawas,
                              ).toLocaleString("id-ID") ?? "")
                        }
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, "");
                          setBlockForm((p) => ({
                            ...p,
                            honorDokPengawas: raw,
                          }));
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-1">Kecamatan</div>
                    <HUSelect
                      value={blockForm.districtId || null}
                      onValueChange={(v) =>
                        setBlockForm((p) => ({
                          ...p,
                          districtId: (v ?? "") as string,
                          villageId: "",
                        }))
                      }
                      options={districtOptions}
                      placeholder="Pilih kecamatan"
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-1">Desa</div>
                    <HUSelect
                      value={blockForm.villageId || null}
                      onValueChange={(v) =>
                        setBlockForm((p) => ({
                          ...p,
                          villageId: (v ?? "") as string,
                        }))
                      }
                      options={villageOptions}
                      placeholder="Pilih desa"
                    />
                  </div>
                </div>

                <div className="border rounded p-3">
                  <div className="font-semibold mb-2">Tabel sampel</div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left border-b bg-gray-50">
                          <th className="py-2 pr-3 sticky top-0 bg-gray-50 z-10 font-semibold text-gray-700">
                            Identity
                          </th>
                          <th className="py-2 pr-3 sticky top-0 bg-gray-50 z-10 font-semibold text-gray-700">
                            Cacah
                          </th>
                          <th className="py-2 pr-3 sticky top-0 bg-gray-50 z-10 font-semibold text-gray-700">
                            Approval
                          </th>
                          <th className="py-2 pr-3 w-20 sticky top-0 bg-gray-50 z-10 font-semibold text-gray-700">
                            Aksi
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {samples.map((s, i) => (
                          <tr key={i} className="border-b hover:bg-gray-50">
                            <td className="py-2 pr-3">
                              <input
                                className="w-full px-2 py-1 border rounded bg-white"
                                value={s.identity}
                                onChange={(e) =>
                                  setSamples((prev) =>
                                    prev.map((x, idx) =>
                                      idx === i
                                        ? { ...x, identity: e.target.value }
                                        : x,
                                    ),
                                  )
                                }
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <HUSelect
                                value={s.cacahStatus || null}
                                onValueChange={(v) =>
                                  setSamples((prev) =>
                                    prev.map((x, idx) =>
                                      idx === i
                                        ? {
                                            ...x,
                                            cacahStatus: (v ?? "") as string,
                                          }
                                        : x,
                                    ),
                                  )
                                }
                                options={[
                                  { value: "Belum_Cacah", label: "Belum" },
                                  { value: "Selesai", label: "Selesai" },
                                ]}
                                placeholder="Pilih"
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <HUSelect
                                value={s.approvalStatus || null}
                                onValueChange={(v) =>
                                  setSamples((prev) =>
                                    prev.map((x, idx) =>
                                      idx === i
                                        ? {
                                            ...x,
                                            approvalStatus: (v ?? "") as string,
                                          }
                                        : x,
                                    ),
                                  )
                                }
                                options={[
                                  { value: "Menunggu", label: "Menunggu" },
                                  { value: "Disetujui", label: "Disetujui" },
                                  { value: "Ditolak", label: "Ditolak" },
                                ]}
                                placeholder="Pilih"
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <IconButton
                                title="Hapus sampel"
                                onClick={() =>
                                  setSamples((prev) => {
                                    const next0 = prev.filter(
                                      (_, idx) => idx !== i,
                                    );
                                    const next =
                                      next0.length > 0
                                        ? next0
                                        : [
                                            {
                                              identity: "",
                                              cacahStatus: "Belum_Cacah",
                                              approvalStatus: "Menunggu",
                                            },
                                          ];
                                    setDraftSampleCount(next.length);
                                    return next;
                                  })
                                }
                                variant="danger"
                              >
                                <Trash2 size={16} />
                              </IconButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSamples((p) => {
                          const next = [
                            ...p,
                            {
                              identity: "",
                              cacahStatus: "Belum_Cacah",
                              approvalStatus: "Menunggu",
                            },
                          ];
                          setDraftSampleCount(next.length);
                          setShouldScrollToBottom(true);
                          return next;
                        })
                      }
                      className="px-3 py-2 rounded bg-gray-100"
                    >
                      Tambah baris
                    </button>
                    <div className="text-sm text-gray-600">
                      Jumlah sampel : {samples.length} • Honor petugas:{" "}
                      {toMoney(blockForm.honorPetugas).toLocaleString("id-ID")}{" "}
                      • Honor pengawas:{" "}
                      {toMoney(blockForm.honorPengawas).toLocaleString("id-ID")}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBlockModalOpen(false);
                      setDraftSampleCount(null);
                      setActiveBlockOldSampleCount(0);
                    }}
                    className="px-4 py-2 rounded bg-gray-100"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={saveBlock}
                    disabled={creatingUserProgress || updatingUserProgress}
                    className={`${styles.button} text-white`}
                  >
                    {creatingUserProgress || updatingUserProgress
                      ? "Menyimpan..."
                      : "Simpan"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
