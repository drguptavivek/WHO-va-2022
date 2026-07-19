import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { ActionButton, DemoChrome, ScreenScroll, styles } from "../components/DemoLayout";
import { useDemoState } from "../components/DemoState";

export default function HomeRoute() {
  const router = useRouter();
  const { beginNewInterview, completed, drafts, latestDraft } = useDemoState();

  return (
    <DemoChrome>
      <ScreenScroll>
        <Text style={styles.screenTitle}>Home</Text>
        <Text style={styles.screenCopy}>Open a new verbal autopsy interview or resume local demo work.</Text>
        <Text style={styles.screenCopy}>Routes: /start, /continue, /drafts, and /completed.</Text>
        <View style={styles.actionStack}>
          <ActionButton
            label="Start New"
            onPress={() => {
              beginNewInterview();
              router.push("/start");
            }}
          />
          <ActionButton
            disabled={!latestDraft}
            label="Continue Last"
            onPress={() => router.push("/continue")}
          />
          <ActionButton
            label={`Drafts (${drafts.length})`}
            onPress={() => router.push("/drafts")}
            variant="secondary"
          />
          <ActionButton
            label={`Completed (${completed.length})`}
            onPress={() => router.push("/completed")}
            variant="secondary"
          />
        </View>
      </ScreenScroll>
    </DemoChrome>
  );
}
