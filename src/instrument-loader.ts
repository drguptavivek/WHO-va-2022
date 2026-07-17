import { createWhoVaLanguageLoader, type LoadedWhoVaLanguage } from "./i18n.js";
import type { InstrumentDefinition } from "./types.js";

let instrumentPromise: Promise<InstrumentDefinition> | undefined;
let languageLoader: ReturnType<typeof createWhoVaLanguageLoader> | undefined;

export const WHO_VA_2022_LANGUAGES = [
  { locale: "en", label: "English" },
  { locale: "fr", label: "Français" },
  { locale: "hi", label: "हिन्दी" }
] as const;

/** Loads the built-in offline instrument once, when an interview first needs it. */
export function loadWhoVa2022Instrument(): Promise<InstrumentDefinition> {
  instrumentPromise ??= import("./instrument.js").then(({ whoVa2022Instrument }) => whoVa2022Instrument);
  return instrumentPromise;
}

/** Loads a built-in translation only when its locale is requested. */
export async function loadWhoVa2022Language(locale: string): Promise<LoadedWhoVaLanguage> {
  const instrument = await loadWhoVa2022Instrument();
  languageLoader ??= createWhoVaLanguageLoader(instrument, {
    fr: () => import("./languages/fr.js"),
    hi: () => import("./languages/hi.js")
  }, {
    maxCachedLanguages: 1
  });
  return languageLoader(locale);
}
