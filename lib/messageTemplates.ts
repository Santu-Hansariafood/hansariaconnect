export type TemplateVariables = Record<string, string | number | boolean>;

export const getTemplateVariableNames = (template: string): string[] =>
  Array.from(
    new Set(
      Array.from(
        template.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g),
        (match) => match[1],
      ),
    ),
  );

export const joinTemplateParts = (
  header: string | undefined,
  body: string,
  footer: string | undefined,
): string => [header, body, footer].filter((part) => Boolean(part?.trim())).join("\n");

export const renderMessageTemplate = (
  template: string,
  variables: TemplateVariables,
): { text: string; missingVariables: string[] } => {
  const missingVariables = getTemplateVariableNames(template).filter(
    (name) => !Object.prototype.hasOwnProperty.call(variables, name),
  );

  return {
    text: template.replace(
      /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
      (_, name: string) =>
        Object.prototype.hasOwnProperty.call(variables, name)
          ? String(variables[name])
          : `{{${name}}}`,
    ),
    missingVariables,
  };
};
