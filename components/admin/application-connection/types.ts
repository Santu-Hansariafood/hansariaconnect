import type { TemplateActionButton } from "@/lib/templateActionButtons";

export type DashboardTab = "users" | "accounts" | "templates" | "profile";
export type ExampleLanguage = "JavaScript" | "Python" | "PHP";
export type MessageVariable = { name: string; value: string };

export type BuilderTemplate = {
  _id: string;
  adminId: string;
  name: string;
  body: string;
  subject?: string;
  header?: string;
  footer?: string;
  defaultLanguage?: string;
  translations?: Record<string, string>;
  buttons?: TemplateActionButton[];
};
