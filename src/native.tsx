import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { createWhoVaForm } from "./ui/create-who-va-form.js";
import { createWhoVaQuestionControls } from "./ui/question-controls.js";

export * from "./index.js";
export { processNativeImageAttachment } from "./native-attachments.js";
export type * from "./native-attachments.js";
export type { WhoVaFormProps, WhoVaPlatformServices } from "./ui/create-who-va-form.js";

export const WhoVaForm = createWhoVaForm({ View, Text, TextInput, Pressable, ScrollView, Image });
export const WhoVaQuestionControls = createWhoVaQuestionControls({ View, Text, TextInput, Pressable, Image });
export type { WhoVaQuestionControlProps } from "./ui/question-controls.js";
