import React, { useMemo, useState } from "react";
import { useMutation } from "@apollo/client";
import { UPDATE_SUBSURVEY_STATUS } from "../graphql/actions/surveyact.updateStatus.gql";

type Props = {
  open: boolean;
  onClose: () => void;
  activityId: string;
  currentStatus: "BERJALAN" | "SELESAI" | string;
};

export default function UpdateActivityStatusModal({
  open,
  onClose,
  activityId,
  currentStatus,
}: Props) {
  const [status, setStatus] = useState(currentStatus);

  const [mutate, { loading, error }] = useMutation(UPDATE_SUBSURVEY_STATUS, {
    onCompleted: () => {
      onClose();
    },
    refetchQueries: ["GetSubSurveyActivities", "GetAllSubSurveyProgress"],
  });

  const canSave = useMemo(() => !!activityId && !!status && status !== currentStatus, [
    activityId,
    status,
    currentStatus,
  ]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow">
        <div className="mb-3 text-lg font-semibold">Ubah Status Kegiatan</div>

        <label className="mb-2 block text-sm">Status</label>
        <select
          className="w-full rounded border p-2"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="BERJALAN">BERJALAN</option>
          <option value="SELESAI">SELESAI</option>
        </select>

        {error ? (
          <div className="mt-2 text-sm text-red-600">
            Gagal mengubah status
          </div>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded border px-3 py-2" onClick={onClose} disabled={loading}>
            Batal
          </button>
          <button
            className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
            disabled={!canSave || loading}
            onClick={() =>
              mutate({
                variables: {
                  input: { subSurveyActivityId: activityId, status },
                },
              })
            }
          >
            {loading ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
