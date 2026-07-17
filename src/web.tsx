import { Pressable, ScrollView, Text, TextInput, View } from "react-native-web";

import { createWhoVaForm } from "./ui/create-who-va-form.js";

export * from "./index.js";
export type { WhoVaFormProps, WhoVaPlatformServices } from "./ui/create-who-va-form.js";

export const WhoVaForm = createWhoVaForm({ View, Text, TextInput, Pressable, ScrollView });
