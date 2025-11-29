import React from "react";
import harmfulWordsJson from "@/data/harmfulWords.json";

const harmfulWords: string[] = harmfulWordsJson.words;

export const detectHarmfulWords = (text: string) => {
  const tokens = text.toLowerCase().split(/\W+/); // split into words only

  const found = harmfulWords.filter((hw) =>
    tokens.includes(hw.toLowerCase())
  );

  return {
    hasWarning: found.length > 0,
    warnings: found,
  };
};

export const extractLinks = (txt: string) => {
  const regex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  return txt.match(regex) || [];
};

export const validateUrl = (raw: string) => {
  try {
    const u = raw.startsWith("http") ? raw : `http://${raw}`;
    const parsed = new URL(u);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
};

export const formatRichText = (txt: string) => {
  const parts: React.ReactNode[] = [];
  let i = 0;

  while (i < txt.length) {
    const sub = txt.slice(i);

    const candidates: Array<{
      start: number;
      end: number;
      kind: string;
      value: string;
    }> = [];

    const bold = sub.match(/\*([^*]+)\*/);
    if (bold && bold.index !== undefined)
      candidates.push({
        start: bold.index,
        end: bold.index + bold[0].length,
        kind: "bold",
        value: bold[1],
      });

    const italic = sub.match(/_([^_]+)_/);
    if (italic && italic.index !== undefined)
      candidates.push({
        start: italic.index,
        end: italic.index + italic[0].length,
        kind: "italic",
        value: italic[1],
      });

    const strike = sub.match(/~([^~]+)~/);
    if (strike && strike.index !== undefined)
      candidates.push({
        start: strike.index,
        end: strike.index + strike[0].length,
        kind: "strike",
        value: strike[1],
      });

    const code = sub.match(/`([^`]+)`/);
    if (code && code.index !== undefined)
      candidates.push({
        start: code.index,
        end: code.index + code[0].length,
        kind: "code",
        value: code[1],
      });

    const mention = sub.match(/@([A-Za-z0-9_]+)/);
    if (mention && mention.index !== undefined)
      candidates.push({
        start: mention.index,
        end: mention.index + mention[0].length,
        kind: "mention",
        value: mention[0],
      });

    const link = sub.match(/(https?:\/\/[^\s]+|www\.[^\s]+)/);
    if (link && link.index !== undefined)
      candidates.push({
        start: link.index,
        end: link.index + link[0].length,
        kind: "link",
        value: link[0],
      });

    if (!candidates.length) {
      const lines = sub.split("\n");
      lines.forEach((line, idx) => {
        parts.push(<span key={`plain-${i}-${idx}`}>{line}</span>);
        if (idx < lines.length - 1)
          parts.push(<br key={`plain-br-${i}-${idx}`} />);
      });
      break;
    }

    candidates.sort((a, b) => a.start - b.start);
    const first = candidates[0];

    const before = sub.slice(0, first.start);
    if (before) {
      const beforeLines = before.split("\n");
      beforeLines.forEach((line, idx) => {
        parts.push(<span key={`before-${i}-${idx}`}>{line}</span>);
        if (idx < beforeLines.length - 1)
          parts.push(<br key={`before-br-${i}-${idx}`} />);
      });
    }

    const content = first.value;

    switch (first.kind) {
      case "bold":
        parts.push(<strong key={`bold-${i}`}>{content}</strong>);
        break;

      case "italic":
        parts.push(<em key={`italic-${i}`}>{content}</em>);
        break;

      case "strike":
        parts.push(
          <span key={`strike-${i}`} className="line-through opacity-70">
            {content}
          </span>
        );
        break;

      case "code":
        parts.push(
          <code
            key={`code-${i}`}
            className="px-1 py-0.5 bg-gray-200 text-gray-800 rounded"
          >
            {content}
          </code>
        );
        break;

      case "mention":
        parts.push(
          <span key={`mention-${i}`} className="text-blue-600 font-medium">
            {content}
          </span>
        );
        break;

      case "link":
        const safe = content.startsWith("http")
          ? content
          : `http://${content}`;
        parts.push(
          <a
            key={`link-${i}`}
            href={safe}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-blue-600"
          >
            {content}
          </a>
        );
        break;
    }

    i += first.end;
  }

  const warningResult = detectHarmfulWords(txt);

  return {
    nodes: parts,
    hasWarning: warningResult.hasWarning,
    warnings: warningResult.warnings,
  };
};
