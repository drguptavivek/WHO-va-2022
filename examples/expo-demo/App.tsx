import { useMemo, useState } from "react";
import { Platform, SafeAreaView, StatusBar, Text, View } from "react-native";

import type { WhoVaDraft, WhoVaDraftStore } from "@drguptavivek/who-2022-va";
import { WhoVaForm } from "@drguptavivek/who-2022-va/native";

export default function App() {
  const [lastUpdate, setLastUpdate] = useState("No answers yet");
  const draftStore = useMemo<WhoVaDraftStore>(() => {
    const drafts = new Map<string, WhoVaDraft>();
    return {
      save(draft) {
        drafts.set(draft.id, draft);
      },
      load(id) {
        return drafts.get(id);
      }
    };
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <StatusBar barStyle="dark-content" />
      <View
        style={{
          borderBottomColor: "#d7dee8",
          borderBottomWidth: 1,
          padding: 16,
          paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 16
        }}
      >
        <Text style={{ color: "#0f172a", fontSize: 20, fontWeight: "700" }}>WHO VA 2022 Demo</Text>
        <Text style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>{lastUpdate}</Text>
      </View>
      <WhoVaForm
        draftStore={draftStore}
        onChange={(data) => {
          setLastUpdate(`${Object.keys(data).length} draft answers captured`);
        }}
        onDraftError={(error) => {
          setLastUpdate(`Draft save failed: ${error.message}`);
        }}
        onDraftSaved={(draft) => {
          setLastUpdate(`Draft saved: ${Object.keys(draft.data).length} answers`);
        }}
        onComplete={(result) => {
          setLastUpdate(`Submission ready with ${Object.keys(result.data).length} answers`);
          console.log("validated submission", result);
        }}
      />
    </SafeAreaView>
  );
}
