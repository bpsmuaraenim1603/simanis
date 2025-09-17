// src/app/profile/page.tsx — versi responsif
"use client";

import useUser from "@/src/hooks/useUser";
import { useApolloClient, useLazyQuery, useMutation } from "@apollo/client";
import { useSession } from "next-auth/react";
import { UPDATE_PROFILE } from "@/src/graphql/actions/update-user.action";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import styles from "@/src/utils/style";
import { UPDATE_USER_PROGRESS } from "@/src/graphql/actions/update-userprogress.action";
import { GET_USER_PROGRESS_BY_USER_ID } from "@/src/graphql/actions/find-usersurveyprogressbyuser.action";

function Profile() {
  const getDistrictId = (up: any) =>
    up?.districtId ??
    up?.district?.id ??
    up?.subSurveyActivity?.districtId ??
    up?.subSurveyActivity?.district?.id ??
    "";

  const { user } = useUser();
  const { data } = useSession();
  const [updateProfile, { loading }] = useMutation(UPDATE_PROFILE);
  const [formState, setFormState] = React.useState({
    name: user?.name || "",
    email: user?.email || "",
    phone_number: user?.phone_number || "",
    address: user?.address || "",
    role: user?.role || "",
  });

  const client = useApolloClient();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      setFormState({
        name: user.name || "",
        email: user.email || "",
        phone_number: user.phone_number || "",
        address: user.address || "",
        role: user.role || "",
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const input = { ...formState, role: formState.role };
      const { data } = await updateProfile({ variables: { input } });
      console.log("✅ Profil diperbarui:", data);
      toast.success("Profil berhasil diperbarui!");
    } catch (err) {
      console.error("❌ Gagal update:", err);
      toast.error("Gagal memperbarui profil.");
    }
  };

  // ===== Update user progress =====
  const [updateUserProgressForm, setUpdateUserProgressForm] = useState({
    userProgressId: "",
    subSurveyActivityId: "",
    totalAssigned: 0,
    submitCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    lastUpdated: "",
    districtId: "",
  });

  const [fetchUserProgress, { data: userProgressData, loading: upLoading }] =
    useLazyQuery(GET_USER_PROGRESS_BY_USER_ID, { fetchPolicy: "network-only" });

  useEffect(() => {
    if (user?.id) fetchUserProgress({ variables: { userId: user.id } });
  }, [user?.id, fetchUserProgress]);

  const [updateUserSurveyProgress] = useMutation(UPDATE_USER_PROGRESS);

  const currentUP = React.useMemo(() => {
    const rows = userProgressData?.userProgressSurveyByUserId ?? [];
    return rows.find(
      (up: any) =>
        up?.subSurveyActivity?.id === updateUserProgressForm.subSurveyActivityId
    );
  }, [userProgressData, updateUserProgressForm.subSurveyActivityId]);

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

  const clamp = (x: number, min = 0, max = Number.POSITIVE_INFINITY) =>
    Math.min(max, Math.max(min, Number.isFinite(x) ? x : 0));

  const applyConstraints = (draft: typeof updateUserProgressForm) => {
    let totalAssigned = clamp(Number(draft.totalAssigned), 0);
    let submitCount = clamp(Number(draft.submitCount), 0);
    let approvedCount = clamp(Number(draft.approvedCount), 0);
    let rejectedCount = clamp(Number(draft.rejectedCount), 0);

    let s = submitCount + approvedCount + rejectedCount;

    if (isListing) {
      totalAssigned = s;
    } else if (s > totalAssigned) {
      let overflow = s - totalAssigned;
      const takeFromSubmit = Math.min(overflow, submitCount);
      submitCount -= takeFromSubmit; overflow -= takeFromSubmit;
      if (overflow > 0) { const t = Math.min(overflow, rejectedCount); rejectedCount -= t; overflow -= t; }
      if (overflow > 0) { const t = Math.min(overflow, approvedCount); approvedCount -= t; }
    }

    return { ...draft, totalAssigned, submitCount, approvedCount, rejectedCount };
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
    field: "submitCount" | "approvedCount" | "rejectedCount",
    delta: number
  ) => {
    setUpdateUserProgressForm((prev) => {
      let { submitCount, approvedCount, rejectedCount, totalAssigned } = prev;

      if (field === "submitCount") {
        if (delta > 0) {
          if (!isListing && submitCount + approvedCount + rejectedCount >= totalAssigned) {
            toast.error("Tidak bisa menambah Submit di atas Total Sampel Petugas");
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
          if (submitCount <= 0) { toast.error("Tidak ada pending untuk di-approve"); return prev; }
          submitCount -= 1; approvedCount += 1;
        } else {
          if (approvedCount <= 0) return prev;
          approvedCount -= 1; submitCount += 1;
        }
      }

      if (field === "rejectedCount") {
        if (delta > 0) {
          if (submitCount <= 0) { toast.error("Tidak ada pending untuk di-reject"); return prev; }
          submitCount -= 1; rejectedCount += 1;
        } else {
          if (rejectedCount <= 0) return prev;
          rejectedCount -= 1; submitCount += 1;
        }
      }

      return applyConstraints({
        ...prev, submitCount, approvedCount, rejectedCount, lastUpdated: new Date().toISOString(),
      });
    });
  };

  const subSurveyOptions = React.useMemo(() => {
    const rows = userProgressData?.userProgressSurveyByUserId ?? [];
    const pairs = rows
      .filter((up: any) => up?.subSurveyActivity?.id)
      .map((up: any) => [up.subSurveyActivity.id, up.subSurveyActivity] as const);
    return Array.from(new Map(pairs).values());
  }, [userProgressData]);

  const handleChangeUpdateUserProgress = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { id, value } = e.target;
    if (id === "subSurveyActivityId") {
      const rows = userProgressData?.userProgressSurveyByUserId ?? [];
      const up = rows.find((r: any) => r?.subSurveyActivity?.id === value);
      setUpdateUserProgressForm((prev) => ({ ...prev, subSurveyActivityId: value, districtId: getDistrictId(up) }));
    } else {
      setUpdateUserProgressForm((prev) => ({ ...prev, [id]: value }));
    }
  };

  const handleUpdateUserProgress = async (e: React.FormEvent<HTMLFormElement>) => {
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
      await updateUserSurveyProgress({
        variables: {
          userProgressId: v0.userProgressId,
          input: {
            totalAssigned: Number(v0.totalAssigned),
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

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await client.reFetchObservableQueries?.();
      if (user?.id) {
        await fetchUserProgress({ variables: { userId: user.id }, fetchPolicy: "network-only" });
      }
      toast.success("Data profil & progres telah di-refresh");
    } catch (e) {
      console.error("Refresh error:", e);
      toast.error("Gagal me-refresh data");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="max-w-screen-xl mx-auto px-3 sm:px-6 md:px-8 py-4 space-y-4 font-Poppins">
      {/* Header */}
      <div className="bg-orange-50 rounded-lg p-3 md:p-4 font-bold text-lg md:text-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-md">
        <span>Profil Diri</span>
        <button
          onClick={handleRefresh}
          disabled={refreshing || upLoading}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-blue-700 transition font-semibold disabled:opacity-60 disabled:cursor-not-allowed w-full sm:w-auto"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Card profil ringkas */}
      <div className="bg-orange-50 rounded-lg p-4 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
          <img
            src={data?.user ? (data.user.image as string) : (user?.image as string)}
            alt="Profile"
            className="w-20 h-20 sm:w-16 sm:h-16 rounded-full object-cover"
          />
          <div className="text-center sm:text-left">
            <h2 className="text-lg font-semibold truncate max-w-[80vw]">{data?.user ? data.user.name : user?.name}</h2>
            <p className="text-sm text-gray-600 truncate max-w-[80vw]">{data?.user ? data.user.email : user?.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <p><strong>Nomor Telepon:</strong> {user?.phone_number || "-"}</p>
          <p><strong>Alamat:</strong> {user?.address || "-"}</p>
          <p><strong>Role:</strong> {user?.role || "-"}</p>
        </div>
      </div>

      {/* Form update profil */}
      <div className="bg-orange-50 rounded-lg p-4 shadow-md">
        <div className="text-base md:text-lg font-bold mb-3">Perbarui profil diri</div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1" htmlFor="name">Nama</label>
            <input
              id="name" type="text" value={formState.name}
              onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1" htmlFor="email">Email</label>
            <input
              id="email" type="email" value={formState.email}
              onChange={(e) => setFormState((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1" htmlFor="phone">Nomor Telepon</label>
            <input
              id="phone" type="tel" value={formState.phone_number}
              onChange={(e) => setFormState((prev) => ({ ...prev, phone_number: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1" htmlFor="address">Alamat</label>
            <input
              id="address" type="text" value={formState.address}
              onChange={(e) => setFormState((prev) => ({ ...prev, address: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <button disabled={loading} type="submit" className={`${styles.button} my-2 text-white w-full sm:w-auto`}>
            {loading ? "Menyimpan..." : "Perbarui"}
          </button>
        </form>
      </div>

      {/* Form update progress */}
      <div className="bg-blue-100 rounded-lg p-4 shadow-md">
        <form onSubmit={handleUpdateUserProgress} className="space-y-3">
          <h3 className="text-base md:text-lg font-bold">Update Data Petugas</h3>

          <div>
            <label htmlFor="subSurveyActivityId" className="block text-sm font-bold mb-1">Kegiatan Survei</label>
            <select
              id="subSurveyActivityId"
              value={updateUserProgressForm.subSurveyActivityId}
              onChange={handleChangeUpdateUserProgress}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">{upLoading ? "Memuat..." : "-- Pilih Kegiatan --"}</option>
              {subSurveyOptions.map((sa: any) => (
                <option key={sa.id} value={sa.id}>{sa.name}</option>
              ))}
            </select>
            {updateUserProgressForm.subSurveyActivityId && (
              <p className="mt-1 text-xs">
                Tipe kegiatan:{" "}
                <span className={`px-2 py-0.5 rounded ${isListing ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                  {isListing ? "Listing" : "Non-Listing"}
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="totalAssigned" className="block text-sm font-bold mb-1">
                {isListing ? "Total Listing Petugas" : "Total Sampel Petugas"}
              </label>
              <input
                id="totalAssigned" type="number" readOnly
                value={updateUserProgressForm.totalAssigned}
                className="w-full px-3 py-3 border rounded-md bg-white text-center text-xl sm:text-2xl cursor-default focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-600">
                {isListing ? "Listing: total = Submit + Approved + Rejected."
                           : "Non-Listing: (Submit + Approved + Rejected) ≤ Total Sampel."}
              </p>
            </div>

            {/* Submit */}
            <div className="flex-1 min-w-[220px]">
              <label htmlFor="submitCount" className="block text-sm font-bold mb-1">Jumlah Submit Oleh Petugas</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => step("submitCount", -1)} disabled={!updateUserProgressForm.subSurveyActivityId || !canDecSubmit}
                        className="px-3 py-2 border rounded-md font-bold bg-red-500 text-white hover:bg-red-600" aria-label="Kurangi Submit">-</button>
                <input readOnly id="submitCount" value={updateUserProgressForm.submitCount}
                       className="w-full px-3 py-3 border rounded-md bg-white text-center text-xl sm:text-2xl cursor-default focus:outline-none" />
                <button type="button" onClick={() => step("submitCount", +1)} disabled={!updateUserProgressForm.subSurveyActivityId || !canIncSubmit}
                        className="px-3 py-2 border rounded-md font-bold bg-green-500 text-white hover:bg-green-600" aria-label="Tambah Submit">+</button>
              </div>
            </div>

            {/* Approved */}
            <div className="flex-1 min-w-[220px]">
              <label htmlFor="approvedCount" className="block text-sm font-bold mb-1">Jumlah Approved Oleh PML</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => step("approvedCount", -1)} disabled={!updateUserProgressForm.subSurveyActivityId || !canDecApproved}
                        className="px-3 py-2 border rounded-md font-bold bg-red-500 text-white hover:bg-red-600" aria-label="Kurangi Approved">-</button>
                <input readOnly id="approvedCount" value={updateUserProgressForm.approvedCount}
                       className="w-full px-3 py-3 border rounded-md bg-white text-center text-xl sm:text-2xl cursor-default focus:outline-none" />
                <button type="button" onClick={() => step("approvedCount", +1)} disabled={!updateUserProgressForm.subSurveyActivityId || !canIncApproved}
                        className="px-3 py-2 border rounded-md font-bold bg-green-500 text-white hover:bg-green-600" aria-label="Tambah Approved">+</button>
              </div>
            </div>

            {/* Rejected */}
            <div className="flex-1 min-w-[220px]">
              <label htmlFor="rejectedCount" className="block text-sm font-bold mb-1">Jumlah Rejected Oleh PML</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => step("rejectedCount", -1)} disabled={!updateUserProgressForm.subSurveyActivityId || !canDecRejected}
                        className="px-3 py-2 border rounded-md font-bold bg-red-500 text-white hover:bg-red-600" aria-label="Kurangi Rejected">-</button>
                <input readOnly id="rejectedCount" value={updateUserProgressForm.rejectedCount}
                       className="w-full px-3 py-3 border rounded-md bg-white text-center text-xl sm:text-2xl cursor-default focus:outline-none" />
                <button type="button" onClick={() => step("rejectedCount", +1)} disabled={!updateUserProgressForm.subSurveyActivityId || !canIncRejected}
                        className="px-3 py-2 border rounded-md font-bold bg-green-500 text-white hover:bg-green-600" aria-label="Tambah Rejected">+</button>
              </div>
            </div>
          </div>

          <button type="submit" className={`${styles.button} my-2 text-white w-full sm:w-auto`} disabled={!updateUserProgressForm.userProgressId}>
            Simpan Perubahan
          </button>
        </form>
      </div>
    </div>
  );
}

export default Profile;
