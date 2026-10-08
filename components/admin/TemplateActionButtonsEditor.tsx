"use client";

import { useState } from "react";
import type { TemplateActionButton } from "@/lib/templateActionButtons";

type ActionType = TemplateActionButton["type"];

type TemplateActionButtonsEditorProps = {
  value: TemplateActionButton[];
  onChange: (buttons: TemplateActionButton[]) => void;
  idPrefix: string;
};

const defaultButton = (type: ActionType): TemplateActionButton => {
  if (type === "call") {
    return { type, label: "Call us", phoneNumber: "" };
  }
  if (type === "reply") {
    return { type, label: "Reply", replyText: "" };
  }
  return { type, label: "Confirm", replyText: "Confirmed" };
};

export default function TemplateActionButtonsEditor({
  value,
  onChange,
  idPrefix,
}: TemplateActionButtonsEditorProps) {
  const [nextType, setNextType] = useState<ActionType>("call");
  const canAdd =
    value.length < 3 && !value.some((button) => button.type === nextType);

  const updateButton = (
    index: number,
    updates: Partial<TemplateActionButton>,
  ) => {
    onChange(
      value.map((button, buttonIndex) =>
        buttonIndex === index ? { ...button, ...updates } as TemplateActionButton : button,
      ),
    );
  };

  return (
    <fieldset className="mt-4 space-y-3 rounded-xl border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-800">
        Recipient action buttons (optional)
      </legend>
      <p className="text-xs leading-5 text-slate-600">
        Call opens the phone app, Reply opens the chat composer, and Confirm
        sends a reply to the sender. Up to three buttons; one of each type.
        Button labels and actions are shared by all template translations.
      </p>
      {value.map((button, index) => (
        <div
          key={button.type}
          className="space-y-2 rounded-lg bg-slate-50 p-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold capitalize text-slate-800">
              {button.type} button
            </p>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
              className="text-sm text-rose-700 hover:underline"
            >
              Remove
            </button>
          </div>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Button label
            <input
              value={button.label}
              onChange={(event) => updateButton(index, { label: event.target.value })}
              maxLength={30}
              className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
              required
            />
          </label>
          {button.type === "call" && (
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Phone number (include country code)
              <input
                type="tel"
                value={button.phoneNumber}
                onChange={(event) =>
                  updateButton(index, { phoneNumber: event.target.value })
                }
                placeholder="+14155550123"
                pattern="^\+[1-9][0-9]{7,14}$"
                className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
                required
              />
            </label>
          )}
          {button.type === "reply" && (
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Optional starter text
              <input
                value={button.replyText || ""}
                onChange={(event) =>
                  updateButton(index, { replyText: event.target.value })
                }
                maxLength={500}
                placeholder="Leave blank to open an empty composer"
                className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
              />
            </label>
          )}
          {button.type === "confirm" && (
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Confirmation sent to the sender
              <input
                value={button.replyText}
                onChange={(event) =>
                  updateButton(index, { replyText: event.target.value })
                }
                maxLength={500}
                className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"
                required
              />
            </label>
          )}
        </div>
      ))}
      {value.length < 3 && (
        <div className="flex gap-2">
          <select
            value={nextType}
            onChange={(event) => setNextType(event.target.value as ActionType)}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            aria-label={`${idPrefix} button type to add`}
          >
            {(["call", "reply", "confirm"] as const)
              .filter((type) => !value.some((button) => button.type === type))
              .map((type) => (
                <option key={type} value={type}>
                  {type === "call" ? "Call" : type === "reply" ? "Reply" : "Confirm"}
                </option>
              ))}
          </select>
          <button
            type="button"
            disabled={!canAdd}
            onClick={() => {
              onChange([...value, defaultButton(nextType)]);
              const nextAvailable = (["call", "reply", "confirm"] as const).find(
                (type) => type !== nextType && !value.some((button) => button.type === type),
              );
              if (nextAvailable) setNextType(nextAvailable);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            Add button
          </button>
        </div>
      )}
    </fieldset>
  );
}
