import { AppState, Pressable, Text, View, type AppStateStatus } from "react-native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

import type { SubmissionValidationResult, WhoVaDraft, WhoVaDraftController } from "@drguptavivek/who-2022-va";
import { WhoVaForm } from "@drguptavivek/who-2022-va/native";

import { DemoChrome, EmptyState, styles } from "./DemoLayout";
import { countAnswers, useDemoState } from "./DemoState";

export function FormRouteScreen({
  draft,
  emptyMessage,
  formKey,
  title
}: {
  draft?: WhoVaDraft;
  emptyMessage?: string;
  formKey: string;
  title: string;
}) {
  const router = useRouter();
  const { addCompleted, draftStore, setLastUpdate } = useDemoState();
  const draftControllerRef = useRef<WhoVaDraftController | undefined>(undefined);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const saveBeforeRoute = useCallback(
    async (route: Parameters<typeof router.push>[0]) => {
      await draftControllerRef.current?.saveDraft();
      router.push(route);
    },
    [router]
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasActive = appStateRef.current === "active";
      appStateRef.current = nextState;
      if (!wasActive || nextState === "active") return;
      setLastUpdate("Saving draft before app backgrounding");
      void draftControllerRef.current?.saveDraft();
    });

    return () => subscription.remove();
  }, [setLastUpdate]);

  if (emptyMessage) {
    return (
      <DemoChrome>
        <View style={styles.formToolbar}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void saveBeforeRoute("/")}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>Home</Text>
          </Pressable>
          <Text style={styles.formToolbarTitle}>{title}</Text>
        </View>
        <View style={styles.screen}>
          <EmptyState message={emptyMessage} />
        </View>
      </DemoChrome>
    );
  }

  return (
    <DemoChrome>
      <View style={styles.formShell}>
        <View style={styles.formToolbar}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void saveBeforeRoute("/")}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>Home</Text>
          </Pressable>
          <Text style={styles.formToolbarTitle}>{title}</Text>
        </View>
        <WhoVaForm
          key={formKey}
          draftId={draft?.id}
          draftStore={draftStore}
          initialData={draft?.data}
          autoSaveDraftOnChange
          onChange={(data) => {
            setLastUpdate(`${Object.keys(data).length} draft answers captured`);
          }}
          onComplete={(result: SubmissionValidationResult) => {
            addCompleted(result);
            router.push("/completed");
          }}
          onDraftController={(controller) => {
            draftControllerRef.current = controller;
          }}
          onDraftError={(error) => {
            setLastUpdate(`Draft save failed: ${error.message}`);
          }}
          onDraftSaved={(savedDraft) => {
            setLastUpdate(`Draft saved: ${countAnswers(savedDraft)} answers`);
          }}
        />
      </View>
    </DemoChrome>
  );
}
