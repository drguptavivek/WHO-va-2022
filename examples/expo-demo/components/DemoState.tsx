import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { SubmissionValidationResult, WhoVaDraft, WhoVaDraftStore } from "@drguptavivek/who-2022-va";

export interface CompletedSubmission {
  id: string;
  completedAt: string;
  result: SubmissionValidationResult;
}

interface DemoState {
  completed: CompletedSubmission[];
  draftStore: WhoVaDraftStore;
  drafts: WhoVaDraft[];
  latestDraft: WhoVaDraft | undefined;
  lastUpdate: string;
  newFormKey: number;
  addCompleted(result: SubmissionValidationResult): void;
  beginNewInterview(): void;
  getDraft(id: string | undefined): WhoVaDraft | undefined;
  setLastUpdate(message: string): void;
}

const DemoStateContext = createContext<DemoState | undefined>(undefined);

export function countAnswers(draft: WhoVaDraft): number {
  return Object.values(draft.data).filter((value) => value !== undefined && value !== null && value !== "")
    .length;
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

export function DemoStateProvider({ children }: { children: ReactNode }) {
  const [lastUpdate, setLastUpdate] = useState("No answers yet");
  const [drafts, setDrafts] = useState<WhoVaDraft[]>([]);
  const [completed, setCompleted] = useState<CompletedSubmission[]>([]);
  const [newFormKey, setNewFormKey] = useState(0);

  const draftStore = useMemo<WhoVaDraftStore>(() => {
    const draftMap = new Map<string, WhoVaDraft>();
    const publishDrafts = () => {
      setDrafts(
        Array.from(draftMap.values()).sort(
          (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
        )
      );
    };

    return {
      save(draft) {
        draftMap.set(draft.id, draft);
        publishDrafts();
      },
      load(id) {
        return draftMap.get(id);
      },
      remove(id) {
        draftMap.delete(id);
        publishDrafts();
      }
    };
  }, []);

  const value = useMemo<DemoState>(
    () => ({
      addCompleted(result) {
        setLastUpdate(`Submission ready with ${Object.keys(result.data).length} answers`);
        setCompleted((current) => [
          {
            completedAt: new Date().toISOString(),
            id: `completed-${Date.now()}`,
            result
          },
          ...current
        ]);
        console.log("validated submission", result);
      },
      beginNewInterview() {
        setNewFormKey((current) => current + 1);
        setLastUpdate("New interview started");
      },
      completed,
      draftStore,
      drafts,
      getDraft(id) {
        if (!id) return undefined;
        return drafts.find((draft) => draft.id === id);
      },
      latestDraft: drafts[0],
      lastUpdate,
      newFormKey,
      setLastUpdate
    }),
    [completed, draftStore, drafts, lastUpdate, newFormKey]
  );

  return <DemoStateContext.Provider value={value}>{children}</DemoStateContext.Provider>;
}

export function useDemoState(): DemoState {
  const state = useContext(DemoStateContext);
  if (!state) throw new Error("useDemoState must be used inside DemoStateProvider");
  return state;
}
