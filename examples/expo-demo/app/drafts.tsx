import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { DemoChrome, EmptyState, ScreenHeader, ScreenScroll, styles } from "../components/DemoLayout";
import { countAnswers, formatDateTime, useDemoState } from "../components/DemoState";

export default function DraftsRoute() {
  const router = useRouter();
  const { beginNewInterview, drafts } = useDemoState();

  return (
    <DemoChrome>
      <ScreenScroll>
        <ScreenHeader
          actionLabel="Start New"
          onAction={() => {
            beginNewInterview();
            router.push("/start");
          }}
          title="Drafts"
        />
        {drafts.length === 0 ? (
          <EmptyState message="No local drafts saved in this demo session." />
        ) : (
          drafts.map((draft) => (
            <Pressable
              accessibilityRole="button"
              key={draft.id}
              onPress={() => router.push({ pathname: "/continue", params: { draftId: draft.id } })}
              style={styles.listItem}
            >
              <View style={styles.listItemText}>
                <Text style={styles.listItemTitle}>{countAnswers(draft)} answers</Text>
                <Text style={styles.listItemMeta}>Updated {formatDateTime(draft.updatedAt)}</Text>
                <Text numberOfLines={1} style={styles.listItemId}>
                  {draft.id}
                </Text>
              </View>
              <Text style={styles.listItemAction}>Open</Text>
            </Pressable>
          ))
        )}
      </ScreenScroll>
    </DemoChrome>
  );
}
