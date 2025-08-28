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
      const input = {
        ...formState,
        role: formState.role,
      };

      const { data } = await updateProfile({ variables: { input } });
      console.log("✅ Profil diperbarui:", data);
      toast.success("Profil berhasil diperbarui!");
    } catch (err) {
      console.error("❌ Gagal update:", err);
      toast.error("Gagal memperbarui profil.");
    }
  };

  // State untuk update user progress
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
    useLazyQuery(GET_USER_PROGRESS_BY_USER_ID, {
      fetchPolicy: "network-only",
    });

  useEffect(() => {
    if (user?.id) {
      fetchUserProgress({ variables: { userId: user.id } });
    }
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

  // === VALIDASI & STEPPER ===
  const clamp = (x: number, min = 0, max = Number.POSITIVE_INFINITY) =>
    Math.min(max, Math.max(min, Number.isFinite(x) ? x : 0));

  const applyConstraints = (draft: typeof updateUserProgressForm) => {
    let totalAssigned = clamp(Number(draft.totalAssigned), 0);
    let submitCount = clamp(Number(draft.submitCount), 0);
    let approvedCount = clamp(Number(draft.approvedCount), 0);
    let rejectedCount = clamp(Number(draft.rejectedCount), 0);

    let sum = submitCount + approvedCount + rejectedCount;

    if (isListing) {
      totalAssigned = sum;
    } else {
      if (sum > totalAssigned) {
        let overflow = sum - totalAssigned;

        const takeFromSubmit = Math.min(overflow, submitCount);
        submitCount -= takeFromSubmit;
        overflow -= takeFromSubmit;

        if (overflow > 0) {
          const takeFromRejected = Math.min(overflow, rejectedCount);
          rejectedCount -= takeFromRejected;
          overflow -= takeFromRejected;
        }
        if (overflow > 0) {
          const takeFromApproved = Math.min(overflow, approvedCount);
          approvedCount -= takeFromApproved;
          overflow -= takeFromApproved;
        }
        sum = submitCount + approvedCount + rejectedCount;
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
    field: "submitCount" | "approvedCount" | "rejectedCount",
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
              "Tidak bisa menambah Jumlah Submit di atas Total Sampel Petugas"
            );
            return prev;
          }
          submitCount += 1; // ✅ saat Listing, ini selalu boleh
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
    // ambil yang punya subSurveyActivity
    const pairs = rows
      .filter((up: any) => up?.subSurveyActivity?.id)
      .map(
        (up: any) => [up.subSurveyActivity.id, up.subSurveyActivity] as const
      );

    // dedup by id
    return Array.from(new Map(pairs).values());
  }, [userProgressData]);

  const handleChangeUpdateUserProgress = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { id, value } = e.target;
    if (id === "subSurveyActivityId") {
      // cari baris UP yg cocok dengan subSurvey terpilih
      const rows = userProgressData?.userProgressSurveyByUserId ?? [];
      const up = rows.find((r: any) => r?.subSurveyActivity?.id === value);
      setUpdateUserProgressForm((prev) => ({
        ...prev,
        subSurveyActivityId: value,
        districtId: getDistrictId(up), // isi sekarang juga
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

      // Normalisasi berdasar aturan terbaru
      const v0 = applyConstraints(updateUserProgressForm);

      // (opsional) cek negatif — mestinya sudah aman oleh clamp
      if (v0.submitCount < 0 || v0.approvedCount < 0 || v0.rejectedCount < 0) {
        toast.error("Angka tidak valid.");
        return;
      }

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

      // refetch semua observable queries yang masih aktif (kalau ada)
      await client.reFetchObservableQueries?.();

      // tarik ulang progres user dari server (bypass cache)
      if (user?.id) {
        await fetchUserProgress({
          variables: { userId: user.id },
          fetchPolicy: "network-only",
        });
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
    <div className="px-8 py-4 space-y-4 font-Poppins">
      <div className="bg-orange-50 rounded-lg p-2 font-bold text-xl flex justify-between items-center shadow-md">
        <span>Profil Diri</span>
        <button
          onClick={handleRefresh}
          disabled={refreshing || upLoading}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-blue-700 transition font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      <div className="bg-orange-50 rounded-lg p-4 shadow-md space-y-8">
        <div className="flex items-center gap-4">
          <img
            src={data?.user ? data.user.image : user?.image}
            alt="Profile"
            className="w-16 h-16 rounded-full"
          />
          <div>
            <h2 className="text-lg font-semibold">
              {data?.user ? data.user.name : user?.name}
            </h2>
            <p className="text-sm text-gray-600">
              {data?.user ? data.user.email : user?.email}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <p>
            <strong>Nomor Telepon:</strong> {user?.phone_number}
          </p>
          <p>
            <strong>Alamat:</strong> {user?.address}
          </p>
          <p>
            <strong>Role:</strong> {user?.role}
          </p>
        </div>
      </div>
      <div className="bg-orange-50 rounded-lg p-2 shadow-md space-y-4">
        <div className="text-xl">
          <strong>Perbarui profil diri</strong>
        </div>
        <div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="mb-4">
              <label className="block text-sm font-bold mb-2" htmlFor="name">
                Nama
              </label>
              <input
                type="text"
                id="name"
                value={formState.name}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-2" htmlFor="email">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={formState.email}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, email: e.target.value }))
                }
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-2" htmlFor="phone">
                Nomor Telepon
              </label>
              <input
                type="tel"
                id="phone"
                value={formState.phone_number}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    phone_number: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-2" htmlFor="address">
                Alamat
              </label>
              <input
                type="text"
                id="address"
                value={formState.address}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, address: e.target.value }))
                }
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div className="mb-4 hidden">
              <label className="block text-sm font-bold mb-2" htmlFor="role">
                Role
              </label>
              <input
                type="text"
                id="role"
                value={formState.role}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, role: e.target.value }))
                }
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <button
              disabled={loading}
              type="submit"
              className={`${styles.button} my-2 text-white`}
            >
              {loading ? "Menyimpan..." : "Perbarui"}
            </button>
          </form>
        </div>
      </div>
      <div className="bg-blue-100 rounded-lg p-4 shadow-md">
        <form onSubmit={handleUpdateUserProgress} className="space-y-3">
          <h3 className="text-lg font-bold">Update Data Petugas</h3>

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
              <option value="">
                {upLoading ? "Memuat..." : "-- Pilih Kegiatan --"}
              </option>
              {subSurveyOptions.map((sa: any) => (
                <option key={sa.id} value={sa.id}>
                  {sa.name}
                </option>
              ))}
            </select>
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
          </div>

          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <label
                htmlFor="totalAssigned"
                className="block text-sm font-bold mb-2"
              >
                {isListing ? "Total Listing Petugas" : "Total Sampel Petugas"}
              </label>
              <input
                type="number"
                id="totalAssigned"
                value={updateUserProgressForm.totalAssigned}
                readOnly
                className="w-full px-3 py-3 border rounded-md bg-white text-center text-2xl cursor-default focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-600">
                {isListing ? (
                  <>
                    Karena <b>Jenis Kegiatan Listing</b>,{" "}
                    <b>Total Listing Petugas</b> otomatis sama dengan{" "}
                    <b>Jumlah Submit, Approved, dan Rejected</b>.
                  </>
                ) : (
                  <>
                    Total Sampel Petugas adalah kuota kerja yang tidak boleh
                    dilampaui.
                  </>
                )}
              </p>
            </div>

            <div className="flex-1 min-w-[220px]">
              <label
                htmlFor="submitCount"
                className="block text-sm font-bold mb-2"
              >
                Jumlah Submit Oleh Petugas
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => step("submitCount", -1)}
                  disabled={
                    !updateUserProgressForm.subSurveyActivityId || !canDecSubmit
                  }
                  className="px-3 py-2 border rounded-md font-bold bg-red-500 text-white hover:bg-red-600"
                  aria-label="Kurangi Submit"
                >
                  -
                </button>
                <input
                  type="number"
                  id="submitCount"
                  value={updateUserProgressForm.submitCount}
                  readOnly
                  className="w-full px-3 py-3 border rounded-md bg-white text-center text-2xl cursor-default focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => step("submitCount", +1)}
                  disabled={
                    !updateUserProgressForm.subSurveyActivityId || !canIncSubmit
                  }
                  className="px-3 py-2 border rounded-md font-bold bg-green-500 text-white hover:bg-green-600"
                  aria-label="Tambah Submit"
                >
                  +
                </button>
              </div>
            </div>

            {/* Approved Count with stepper */}
            <div className="flex-1 min-w-[220px]">
              <label
                htmlFor="approvedCount"
                className="block text-sm font-bold mb-2"
              >
                Jumlah Approved Oleh PML
              </label>
              <div className="flex items-center gap-2">
                <button
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
                </button>
                <input
                  type="number"
                  id="approvedCount"
                  value={updateUserProgressForm.approvedCount}
                  readOnly
                  className="w-full px-3 py-3 border rounded-md bg-white text-center text-2xl cursor-default focus:outline-none"
                />
                <button
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
                </button>
              </div>
            </div>

            {/* Rejected Count with stepper */}
            <div className="flex-1 min-w-[220px]">
              <label
                htmlFor="rejectedCount"
                className="block text-sm font-bold mb-2"
              >
                Jumlah Rejected Oleh PML
              </label>
              <div className="flex items-center gap-2">
                <button
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
                </button>
                <input
                  type="number"
                  id="rejectedCount"
                  value={updateUserProgressForm.rejectedCount}
                  readOnly
                  className="w-full px-3 py-3 border rounded-md bg-white text-center text-2xl cursor-default focus:outline-none"
                />
                <button
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
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className={`${styles.button} my-2 text-white`}
            disabled={!updateUserProgressForm.userProgressId}
          >
            Update Progress
          </button>
        </form>
      </div>
    </div>
  );
}

export default Profile;
