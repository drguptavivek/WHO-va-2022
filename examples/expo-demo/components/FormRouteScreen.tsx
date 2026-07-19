import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import type { SubmissionValidationResult, WhoVaDraft } from "@drguptavivek/who-2022-va";
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

  if (emptyMessage) {
    return (
      <DemoChrome>
        <View style={styles.formToolbar}>
          <Pressable accessibilityRole="button" onPress={() => router.push("/")} style={styles.backButton}>
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
          <Pressable accessibilityRole="button" onPress={() => router.push("/")} style={styles.backButton}>
            <Text style={styles.backButtonText}>Home</Text>
          </Pressable>
          <Text style={styles.formToolbarTitle}>{title}</Text>
        </View>
        <WhoVaForm
          key={formKey}
          draftId={draft?.id}
          draftStore={draftStore}
          initialData={draft?.data}
          onChange={(data) => {
            setLastUpdate(`${Object.keys(data).length} draft answers captured`);
          }}
          onComplete={(result: SubmissionValidationResult) => {
            addCompleted(result);
            router.push("/completed");
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
