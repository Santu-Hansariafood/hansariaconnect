import { z } from "zod";

export const templateActionButtonSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("call"),
    label: z.string().trim().min(1).max(30),
    phoneNumber: z.string().regex(/^\+[1-9]\d{7,14}$/),
  }),
  z.object({
    type: z.literal("reply"),
    label: z.string().trim().min(1).max(30),
    replyText: z.string().max(500).optional(),
  }),
  z.object({
    type: z.literal("confirm"),
    label: z.string().trim().min(1).max(30),
    replyText: z.string().trim().min(1).max(500),
  }),
]);

export const templateActionButtonsSchema = z
  .array(templateActionButtonSchema)
  .max(3)
  .superRefine((buttons, context) => {
    const types = new Set<string>();
    buttons.forEach((button, index) => {
      if (types.has(button.type)) {
        context.addIssue({
          code: "custom",
          message: `Only one ${button.type} button is allowed`,
          path: [index, "type"],
        });
      }
      types.add(button.type);
    });
  });

export type TemplateActionButton = z.infer<typeof templateActionButtonSchema>;
export type TemplateActionType = TemplateActionButton["type"];
