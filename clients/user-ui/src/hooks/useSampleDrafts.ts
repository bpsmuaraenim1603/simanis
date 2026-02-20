'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  DraftSample,
  getDraftSamples,
  setDraftSamples,
  clearDraftSamples,
} from '../utils/sampleDraftStorage';

function genTempId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useSampleDrafts(userProgressId: string | undefined) {
  const [drafts, setDrafts] = useState<DraftSample[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProgressId) {
      setDrafts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      const data = await getDraftSamples(userProgressId);
      if (!cancelled) {
        setDrafts(data);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userProgressId]);

  const syncToDb = useCallback(
    async (next: DraftSample[]) => {
      if (!userProgressId) return;
      setDrafts(next);
      await setDraftSamples(userProgressId, next);
    },
    [userProgressId],
  );

  const upsertDraft = useCallback(
    async (
      draft: Omit<DraftSample, 'tempId' | 'createdAt' | 'updatedAt'> & {
        tempId?: string;
      },
    ) => {
      const now = Date.now();
      setDrafts((prev) => {
        let next: DraftSample[];
        if (draft.tempId) {
          next = prev.map((d) =>
            d.tempId === draft.tempId
              ? {
                  ...d,
                  ...draft,
                  updatedAt: now,
                }
              : d,
          );
        } else {
          const newDraft: DraftSample = {
            ...draft,
            tempId: genTempId(),
            createdAt: now,
            updatedAt: now,
          };
          next = [...prev, newDraft];
        }
        setDraftSamples(userProgressId!, next).catch(() => {});
        return next;
      });
    },
    [userProgressId],
  );

  const removeDraft = useCallback(
    async (tempId: string) => {
      setDrafts((prev) => {
        const next = prev.filter((d) => d.tempId !== tempId);
        setDraftSamples(userProgressId!, next).catch(() => {});
        return next;
      });
    },
    [userProgressId],
  );

  const clearAllDrafts = useCallback(async () => {
    setDrafts([]);
    if (userProgressId) {
      await clearDraftSamples(userProgressId);
    }
  }, [userProgressId]);

  return {
    drafts,
    loading,
    upsertDraft,
    removeDraft,
    clearAllDrafts,
  };
}
