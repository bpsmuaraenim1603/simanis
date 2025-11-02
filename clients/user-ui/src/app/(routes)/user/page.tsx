"use client";

import HUComboBox from "@/src/components/HUCombobox";
import { GET_USER_PROGRESS_BY_USER_ID } from "@/src/graphql/actions/find-usersurveyprogressbyuser.action";
import { UPDATE_USER_PROGRESS } from "@/src/graphql/actions/update-userprogress.action";
import useUser from "@/src/hooks/useUser";
import styles from "@/src/utils/style";
import { useLazyQuery, useMutation } from "@apollo/client";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useMemo } from "react";
import toast from "react-hot-toast";

type SubSurveyOption = { id: string; name: string };

export default function UserPage() {
  const getDistrictId = (up: any) =>
    up?.districtId ??
    up?.district?.id ??
    up?.subSurveyActivity?.districtId ??
    up?.subSurveyActivity?.district?.id ??
    "";

  const { user, loading } = useUser();

  const router = useRouter();

  // roles yang diizinkan
  const ALLOWED = new Set(["Superadmin", "User"]);

  React.useEffect(() => {
    if (loading) return;
    const role = user?.role ?? "";

    if (!ALLOWED.has(role)) {
      toast.error("Akses ditolak. Mengarahkan ke Beranda");
      router.replace("/dashboard");
    }
  }, [loading, user?.role, router]);

  // ===== Update user progress =====
  const [updateUserProgressForm, setUpdateUserProgressForm] = useState({
    userProgressId: "",
    subSurveyActivityId: "",
    totalAssigned: 0,
    submitCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    blockCount: "",
    lastUpdated: "",
    districtId: "",
  });
  const [selectedBlock, setSelectedBlock] = useState<string>("");

  const [fetchUserProgress, { data: userProgressData, loading: upLoading }] =
    useLazyQuery(GET_USER_PROGRESS_BY_USER_ID, { fetchPolicy: "network-only" });

  useEffect(() => {
    if (user?.id) fetchUserProgress({ variables: { userId: user.id } });
  }, [user?.id, fetchUserProgress]);

  const [updateUserSurveyProgress] = useMutation(UPDATE_USER_PROGRESS);

  const currentUP = useMemo(() => {
    const rows = userProgressData?.userProgressSurveyByUserId ?? [];
    const filtered = rows.filter(
      (up: any) =>
        up?.subSurveyActivity?.id === updateUserProgressForm.subSurveyActivityId
    );
    if (filtered.length === 0) return undefined;

    const blk = (selectedBlock ?? "").toString().trim();
    if (blk) {
      const byBlock = filtered.find(
        (up: any) => (up?.blockCount ?? "").toString().trim() === blk
      );
      return byBlock ?? filtered[0];
    }
    return filtered[0];
  }, [
    userProgressData,
    updateUserProgressForm.subSurveyActivityId,
    selectedBlock,
  ]);

  const rawType = currentUP?.subSurveyActivity?.activityType ?? "";
  const isListing = rawType.toLowerCase() === "listing";

  const sum =
    updateUserProgressForm.submitCount +
    updateUserProgressForm.approvedCount +
    updateUserProgressForm.rejectedCount;

  const canIncSubmit = isListing
    ? true
    : sum < updateUserProgressForm.totalAssigned;
  const canDecSubmit = updateUserProgressForm.submitCount > 0;

  const canIncApproved = updateUserProgressForm.submitCount > 0;
  const canDecApproved = updateUserProgressForm.approvedCount > 0;

  const canIncRejected = updateUserProgressForm.submitCount > 0;
  const canDecRejected = updateUserProgressForm.rejectedCount > 0;

  const canFixSubmit = updateUserProgressForm.rejectedCount > 0;

  const clamp = (x: number, min = 0, max = Number.POSITIVE_INFINITY) =>
    Math.min(max, Math.max(min, Number.isFinite(x) ? x : 0));

  const applyConstraints = (draft: typeof updateUserProgressForm) => {
    let totalAssigned = clamp(Number(draft.totalAssigned), 0);
    let submitCount = clamp(Number(draft.submitCount), 0);
    let approvedCount = clamp(Number(draft.approvedCount), 0);
    let rejectedCount = clamp(Number(draft.rejectedCount), 0);
    let s = submitCount + approvedCount + rejectedCount;

    if (isListing && s > totalAssigned) {
      totalAssigned = s;
    } else if (s > totalAssigned) {
      let overflow = s - totalAssigned;
      const takeFromSubmit = Math.min(overflow, submitCount);
      submitCount -= takeFromSubmit;
      overflow -= takeFromSubmit;
      if (overflow > 0) {
        const t = Math.min(overflow, rejectedCount);
        rejectedCount -= t;
        overflow -= t;
      }
      if (overflow > 0) {
        const t = Math.min(overflow, approvedCount);
        approvedCount -= t;
      }
    }

    return {
      ...draft,
      totalAssigned,
      submitCount,
      approvedCount,
      rejectedCount,
    };
  };

  useEffect(() => {
    if (currentUP) {
      setUpdateUserProgressForm((prev) =>
        applyConstraints({
          ...prev,
          userProgressId: currentUP.id,
          subSurveyActivityId: currentUP.subSurveyActivity?.id ?? "",
          totalAssigned: Number(currentUP.totalAssigned ?? 0),
          submitCount: Number(currentUP.submitCount ?? 0),
          approvedCount: Number(currentUP.approvedCount ?? 0),
          rejectedCount: Number(currentUP.rejectedCount ?? 0),
          lastUpdated: new Date().toISOString(),
          districtId: getDistrictId(currentUP),
        })
      );
    } else {
      setUpdateUserProgressForm((prev) => ({
        ...prev,
        userProgressId: "",
        subSurveyActivityId: "",
        totalAssigned: 0,
        submitCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        lastUpdated: "",
        districtId: "",
      }));
    }
  }, [currentUP]);

  useEffect(() => {
    setUpdateUserProgressForm((prev) => applyConstraints(prev));
  }, [isListing, currentUP?.id]);

  const step = (
    field: "submitCount" | "approvedCount" | "rejectedCount" | "fixcount",
    delta: number
  ) => {
    setUpdateUserProgressForm((prev) => {
      let { submitCount, approvedCount, rejectedCount, totalAssigned } = prev;

      if (field === "submitCount") {
        if (delta > 0) {
          if (
            !isListing &&
            submitCount + approvedCount + rejectedCount >= totalAssigned
          ) {
            toast.error(
              "Tidak bisa menambah Submit di atas Total Sampel Petugas"
            );
            return prev;
          }
          submitCount += 1;
        } else {
          if (submitCount <= 0) return prev;
          submitCount -= 1;
        }
      }

      if (field === "approvedCount") {
        if (delta > 0) {
          if (submitCount <= 0) {
            toast.error("Tidak ada pending untuk di-approve");
            return prev;
          }
          submitCount -= 1;
          approvedCount += 1;
        } else {
          if (approvedCount <= 0) return prev;
          approvedCount -= 1;
          submitCount += 1;
        }
      }

      if (field === "rejectedCount") {
        if (delta > 0) {
          if (submitCount <= 0) {
            toast.error("Tidak ada pending untuk di-reject");
            return prev;
          }
          submitCount -= 1;
          rejectedCount += 1;
        } else {
          if (rejectedCount <= 0) return prev;
          rejectedCount -= 1;
          submitCount += 1;
        }
      }

      if (field === "fixcount") {
        if (rejectedCount <= 0) {
          toast.error("Tidak ada data yang perlu diperbaiki");
          return prev;
        } else {
          submitCount += 1;
          rejectedCount -= 1;
        }
      }

      return applyConstraints({
        ...prev,
        submitCount,
        approvedCount,
        rejectedCount,
        lastUpdated: new Date().toISOString(),
      });
    });
  };

  const subSurveyOptions = React.useMemo(() => {
    const rows = userProgressData?.userProgressSurveyByUserId ?? [];
    const pairs = rows
      .filter((up: any) => up?.subSurveyActivity?.id)
      .map(
        (up: any) => [up.subSurveyActivity.id, up.subSurveyActivity] as const
      );
    return Array.from(new Map(pairs).values());
  }, [userProgressData]);

  const subSurveyHUOptions = useMemo(() => {
    const rows = (
      Array.isArray(subSurveyOptions) ? subSurveyOptions : []
    ) as SubSurveyOption[];
    return rows.map(({ id, name }) => ({ value: id, label: name ?? "-" }));
  }, [subSurveyOptions]);

  const blockHUOptions = useMemo(() => {
    const rows = userProgressData?.userProgressSurveyByUserId ?? [];

    const filtered = updateUserProgressForm.subSurveyActivityId
      ? rows.filter(
          (r: any) =>
            r?.subSurveyActivity?.id ===
            updateUserProgressForm.subSurveyActivityId
        )
      : [];

    const blocks: string[] = filtered
      .map((r: any) => String(r?.blockCount ?? "").trim())
      .filter((v: string) => v.length > 0);

    // <-- Set<string> -> Array<string>
    const uniq: string[] = Array.from(new Set<string>(blocks)).sort((a, b) =>
      a.localeCompare(b, "id")
    );

    return uniq.map((b) => ({ value: b, label: `Blok ${b}` }));
  }, [userProgressData, updateUserProgressForm.subSurveyActivityId]);

  useEffect(() => {
    setSelectedBlock("");
  }, [updateUserProgressForm.subSurveyActivityId]);

  useEffect(() => {
    if (!updateUserProgressForm.subSurveyActivityId) return;
    if (!blockHUOptions.length) return;
    if (blockHUOptions.length === 1) {
      setSelectedBlock(blockHUOptions[0].value);
    }
  }, [blockHUOptions, updateUserProgressForm.subSurveyActivityId]);

  const handleChangeUpdateUserProgress = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { id, value } = e.target;
    if (id === "subSurveyActivityId") {
      const rows = userProgressData?.userProgressSurveyByUserId ?? [];
      const up = rows.find((r: any) => r?.subSurveyActivity?.id === value);
      setUpdateUserProgressForm((prev) => ({
        ...prev,
        subSurveyActivityId: value,
        districtId: getDistrictId(up),
      }));
    } else {
      setUpdateUserProgressForm((prev) => ({ ...prev, [id]: value }));
    }
  };

  const handleUpdateUserProgress = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    try {
      if (!updateUserProgressForm.userProgressId) {
        toast.error("Pilih kegiatan survei terlebih dahulu.");
        return;
      }
      const v0 = applyConstraints(updateUserProgressForm);
      if (!isListing && v0.submitCount > v0.totalAssigned) {
        toast.error("Jumlah Submit tidak boleh melebihi Total Sampel Petugas");
        return;
      }
      const updateTotalAssigned =
        v0.submitCount < v0.totalAssigned
          ? (currentUP?.totalAssigned ?? 0)
          : v0.totalAssigned;
      await updateUserSurveyProgress({
        variables: {
          userProgressId: v0.userProgressId,
          input: {
            totalAssigned: Number(updateTotalAssigned),
            submitCount: Number(v0.submitCount),
            approvedCount: Number(v0.approvedCount),
            rejectedCount: Number(v0.rejectedCount),
            lastUpdated: new Date().toISOString(),
            districtId: v0.districtId,
          },
        },
      });
      await fetchUserProgress({ variables: { userId: user!.id } });
      toast.success("UserProgress berhasil diupdate!");
    } catch (err) {
      toast.error("Gagal update user progress");
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-screen-xl mx-auto px-3 py-6 font-Poppins">
        Memuat…
      </div>
    );
  }
  if (!user || !ALLOWED.has(user.role ?? "")) {
    return null;
  }

  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-6 md:px-8 py-4 space-y-4 font-Poppins">
      <div className="bg-orange-50 rounded-lg p-3 md:p-4 font-bold text-lg md:text-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-md">
        <span>Panel Petugas</span>
      </div>
      <div className="bg-blue-100 rounded-lg p-4 shadow-md">
        <form onSubmit={handleUpdateUserProgress} className="space-y-3">
          <h3 className="text-base md:text-lg font-bold">
            Update Data Petugas
          </h3>

          <div>
            <label
              htmlFor="subSurveyActivityId"
              className="block text-sm font-bold mb-1"
            >
              Kegiatan Survei
            </label>
            <HUComboBox
              value={updateUserProgressForm.subSurveyActivityId || null}
              onValueChange={(v) =>
                setUpdateUserProgressForm((p) => ({
                  ...p,
                  subSurveyActivityId: (v ?? "") as string,
                }))
              }
              options={subSurveyHUOptions}
              placeholder="-- Pilih kegiatan survei --"
            />
            {updateUserProgressForm.subSurveyActivityId && (
              <p className="mt-1 text-xs">
                Tipe kegiatan:{" "}
                <span
                  className={`px-2 py-0.5 rounded ${isListing ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
                >
                  {isListing ? "Listing" : "Non-Listing"}
                </span>
              </p>
            )}
            <div className="mt-2">
              <label className="block text-sm font-bold mb-1">Blok</label>
              <HUComboBox
                value={selectedBlock || null}
                onValueChange={(v) => setSelectedBlock((v ?? "") as string)}
                options={blockHUOptions}
                placeholder={
                  !updateUserProgressForm.subSurveyActivityId
                    ? "Pilih kegiatan dulu"
                    : blockHUOptions.length === 0
                      ? "Tidak ada blok"
                      : "-- Pilih Blok --"
                }
                disabled={
                  !updateUserProgressForm.subSurveyActivityId ||
                  blockHUOptions.length === 0
                }
              />
              {!!selectedBlock && (
                <p className="mt-1 text-xs text-gray-600">
                  Menampilkan data untuk <b>Blok {selectedBlock}</b>.
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label
                  htmlFor="totalAssigned"
                  className="block text-sm font-bold mb-1"
                >
                  {isListing ? "Total Listing Petugas" : "Total Sampel Petugas"}
                </label>
                <input
                  id="totalAssigned"
                  type="number"
                  readOnly
                  value={updateUserProgressForm.totalAssigned}
                  className="w-full px-3 py-3 border rounded-md bg-white text-center text-xl sm:text-2xl cursor-default focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-600">
                  {isListing
                    ? "Listing: total = Submit + Approved + Rejected."
                    : "Non-Listing: (Submit + Approved + Rejected) ≤ Total Sampel."}
                </p>
              </div>

              {/* Approved */}
              <div className="flex-1 min-w-[220px]">
                <label
                  htmlFor="approvedCount"
                  className="block text-sm font-bold mb-1"
                >
                  Jumlah Approved Oleh PML
                </label>
                <div className="flex items-center gap-2">
                  {/* <button
                  type="button"
                  onClick={() => step("approvedCount", -1)}
                  disabled={
                    !updateUserProgressForm.subSurveyActivityId ||
                    !canDecApproved
                  }
                  className="px-3 py-2 border rounded-md font-bold bg-red-500 text-white hover:bg-red-600"
                  aria-label="Kurangi Approved"
                >
                  -
                </button> */}
                  <input
                    readOnly
                    id="approvedCount"
                    value={updateUserProgressForm.approvedCount}
                    className="w-full px-3 py-3 border rounded-md bg-white text-center text-xl sm:text-2xl cursor-default focus:outline-none"
                  />
                  {/* <button
                  type="button"
                  onClick={() => step("approvedCount", +1)}
                  disabled={
                    !updateUserProgressForm.subSurveyActivityId ||
                    !canIncApproved
                  }
                  className="px-3 py-2 border rounded-md font-bold bg-green-500 text-white hover:bg-green-600"
                  aria-label="Tambah Approved"
                >
                  +
                </button> */}
                </div>
              </div>

              {/* Rejected */}
              <div className="flex-1 min-w-[220px]">
                <label
                  htmlFor="rejectedCount"
                  className="block text-sm font-bold mb-1"
                >
                  Jumlah Rejected Oleh PML
                </label>
                <div className="flex items-center gap-2">
                  {/* <button
                  type="button"
                  onClick={() => step("rejectedCount", -1)}
                  disabled={
                    !updateUserProgressForm.subSurveyActivityId ||
                    !canDecRejected
                  }
                  className="px-3 py-2 border rounded-md font-bold bg-red-500 text-white hover:bg-red-600"
                  aria-label="Kurangi Rejected"
                >
                  -
                </button> */}
                  <input
                    readOnly
                    id="rejectedCount"
                    value={updateUserProgressForm.rejectedCount}
                    className="w-full px-3 py-3 border rounded-md bg-white text-center text-xl sm:text-2xl cursor-default focus:outline-none"
                  />
                  {/* <button
                  type="button"
                  onClick={() => step("rejectedCount", +1)}
                  disabled={
                    !updateUserProgressForm.subSurveyActivityId ||
                    !canIncRejected
                  }
                  className="px-3 py-2 border rounded-md font-bold bg-green-500 text-white hover:bg-green-600"
                  aria-label="Tambah Rejected"
                >
                  +
                </button> */}
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex-1 min-w-[220px] mt-4 mb-8 lg:px-72">
              <label
                htmlFor="submitCount"
                className="block text-sm font-bold mb-1"
              >
                Jumlah Submit Oleh Petugas
              </label>
              <div>
                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => step("submitCount", -1)}
                    disabled={
                      !updateUserProgressForm.subSurveyActivityId ||
                      !canDecSubmit
                    }
                    className="px-3 py-2 border rounded-md font-bold bg-red-500 text-white hover:bg-red-600"
                    aria-label="Kurangi Submit"
                  >
                    -
                  </button>
                  <input
                    readOnly
                    id="submitCount"
                    value={updateUserProgressForm.submitCount}
                    className="w-full px-3 py-3 border rounded-md bg-white text-center text-xl sm:text-2xl cursor-default focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => step("submitCount", +1)}
                    disabled={
                      !updateUserProgressForm.subSurveyActivityId ||
                      !canIncSubmit
                    }
                    className="px-3 py-2 border rounded-md font-bold bg-green-500 text-white hover:bg-green-600"
                    aria-label="Tambah Submit"
                  >
                    +
                  </button>
                </div>
                <div className="flex justify-center mt-1">
                  <button
                    type="button"
                    onClick={() => step("fixcount", 1)}
                    disabled={
                      !updateUserProgressForm.subSurveyActivityId ||
                      !canFixSubmit
                    }
                    className="p-1 border rounded-md bg-blue-500 text-white text-center text-md hover:bg-blue-600"
                    aria-label="Tambah Perbaikan"
                  >
                    Tambah perbaikan
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className={`${styles.button} my-2 text-white w-full sm:w-auto`}
            disabled={!updateUserProgressForm.userProgressId}
          >
            Simpan Perubahan
          </button>
        </form>
      </div>
    </div>
  );
}
