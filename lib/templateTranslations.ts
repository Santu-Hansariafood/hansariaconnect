export type TemplateTranslations = Record<string, string>;

export function normalizeTemplateTranslations(value: unknown): TemplateTranslations {
  const entries =
    value instanceof Map
      ? Array.from(value.entries())
      : value && typeof value === "object"
        ? Object.entries(value)
        : [];

  return Object.fromEntries(
    entries.filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string",
    ).map(([language, text]) => [language.toLowerCase(), text]),
  );
}

export function getLocalizedTemplateText(
  fallback: string,
  translations: unknown,
  language: string,
): string {
  const normalized = normalizeTemplateTranslations(translations);
  const requestedLanguage = language.toLowerCase();
  return (
    normalized[requestedLanguage] ||
    normalized[requestedLanguage.split("-")[0]] ||
    fallback
  );
}
