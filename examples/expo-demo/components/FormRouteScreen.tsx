import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { AppState, Platform, Pressable, Text, View, type AppStateStatus } from "react-native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

import type {
  InstrumentQuestion,
  SubmissionData,
  SubmissionValidationResult,
  WhoVaDraft,
  WhoVaDraftController
} from "@drguptavivek/who-2022-va";
import { WhoVaForm } from "@drguptavivek/who-2022-va/native";

import { DemoChrome, EmptyState, styles } from "./DemoLayout";
import { countAnswers, useDemoState } from "./DemoState";

function dateFromIso(value: string | undefined): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function isoFromDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function pickAndroidDate(
  question: InstrumentQuestion,
  _data: SubmissionData,
  currentValue?: string
): Promise<string | undefined> {
  if (Platform.OS !== "android") return Promise.resolve(undefined);
  return new Promise((resolve) => {
    DateTimePickerAndroid.open({
      mode: "date",
      value: dateFromIso(currentValue),
      onChange: (event, selectedDate) => {
        resolve(event.type === "set" && selectedDate ? isoFromDate(selectedDate) : undefined);
      }
    });
  });
}

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
          platform={{ pickDate: pickAndroidDate }}
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
