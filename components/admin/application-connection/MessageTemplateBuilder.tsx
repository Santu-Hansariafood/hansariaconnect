import type { MessageVariable } from "./types";

type MessageTemplateBuilderProps = {
  header: string;
  body: string;
  footer: string;
  variables: MessageVariable[];
  isPlatformAdmin: boolean;
  onHeaderChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onFooterChange: (value: string) => void;
  onVariablesChange: (variables: MessageVariable[]) => void;
};

export default function MessageTemplateBuilder({
  header,
  body,
  footer,
  variables,
  isPlatformAdmin,
  onHeaderChange,
  onBodyChange,
  onFooterChange,
  onVariablesChange,
}: MessageTemplateBuilderProps) {
  const linkColor = isPlatformAdmin
    ? "text-indigo-700 dark:text-indigo-300"
    : "text-emerald-700 dark:text-emerald-300";
  const hasDuplicateNames =
    new Set(variables.map(({ name }) => name)).size !== variables.length;
  const hasInvalidVariableNames = variables.some(
    ({ name }) => !/^[a-zA-Z0-9_]+$/.test(name),
  );

  const updateVariableName = (index: number, name: string) => {
    const safeName = name.replace(/[^a-zA-Z0-9_]/g, "");
    const previousName = variables[index].name;
    onVariablesChange(
      variables.map((variable, currentIndex) =>
        currentIndex === index ? { ...variable, name: safeName } : variable,
      ),
    );
    if (previousName) {
      onBodyChange(body.replaceAll(`{{${previousName}}}`, `{{${safeName}}}`));
    }
  };

  const addVariable = () => {
    const name = `variable${variables.length + 1}`;
    onVariablesChange([
      ...variables,
      { name, value: `Example ${variables.length + 1}` },
    ]);
    onBodyChange(`${body}${body.trim() ? " " : ""}{{${name}}}`);
  };

  return (
    <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <h3 className="font-semibold text-slate-900 dark:text-slate-100">Build your message</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Header, body, and footer are combined into the message sent by the API.
        Add placeholders in the body, then set their names and example values
        below.
      </p>
      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Header (optional)
          <input
            value={header}
            onChange={(event) => onHeaderChange(event.target.value)}
            maxLength={2000}
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            placeholder="e.g. Order update"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Message body
          <textarea
            value={body}
            onChange={(event) => onBodyChange(event.target.value)}
            maxLength={2000}
            rows={4}
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            placeholder="Write your message here"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Footer (optional)
          <input
            value={footer}
            onChange={(event) => onFooterChange(event.target.value)}
            maxLength={2000}
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            placeholder="e.g. Reply if you need help."
          />
        </label>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold text-slate-900 dark:text-slate-100">Message variables</h4>
          <button
            type="button"
            onClick={addVariable}
            disabled={variables.length >= 100}
            className={`text-sm font-semibold hover:underline disabled:cursor-not-allowed disabled:text-slate-400 ${linkColor}`}
          >
            + Add variable
          </button>
        </div>
        <div className="mt-2 space-y-3">
          {variables.map((variable, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800 sm:grid-cols-[auto_1fr_1fr]"
            >
              <span className="pt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Variable {index + 1}
              </span>
              <label className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                Placeholder name
                <input
                  value={variable.name}
                  onChange={(event) =>
                    updateVariableName(index, event.target.value)
                  }
                  className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  placeholder="e.g. name"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                Example value
                <input
                  value={variable.value}
                  onChange={(event) =>
                    onVariablesChange(
                      variables.map((item, currentIndex) =>
                        currentIndex === index
                          ? { ...item, value: event.target.value }
                          : item,
                      ),
                    )
                  }
                  className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  placeholder="e.g. Asha"
                />
              </label>
              <p className="text-xs text-slate-500 sm:col-start-2 dark:text-slate-400">
                Use <code>{`{{${variable.name || "name"}}}`}</code> in the
                message body.
              </p>
            </div>
          ))}
        </div>
        {hasDuplicateNames && (
          <p className="mt-2 text-sm text-red-700 dark:text-red-300" role="alert">
            Each placeholder name must be unique.
          </p>
        )}
        {hasInvalidVariableNames && (
          <p className="mt-2 text-sm text-red-700 dark:text-red-300" role="alert">
            Variable names must contain only letters, numbers, and underscores.
          </p>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Merged message preview
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">
          {[header, body, footer]
            .map((part) => part.trim())
            .filter(Boolean)
            .join("\n") || "Your message preview will appear here."}
        </p>
      </div>
    </section>
  );
}
