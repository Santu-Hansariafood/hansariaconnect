import nspell from "nspell";
import dictionary from "dictionary-en";

const spellChecker = nspell(dictionary);
const protectedTokenPattern = /https?:\/\/\S+|www\.\S+|@[A-Za-z0-9_]+/g;
const wordPattern = /\b[A-Za-z][A-Za-z'-]*\b/g;

const preserveCase = (original: string, replacement: string) => {
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] === original[0].toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
};

export const correctSpelling = (text: string) => {
  const protectedTokens: string[] = [];
  const masked = text.replace(protectedTokenPattern, (token) => {
    const index = protectedTokens.push(token) - 1;
    return `PROTECTEDTOKEN${index}X`;
  });

  const corrected = masked.replace(wordPattern, (word) => {
    if (word.startsWith("PROTECTEDTOKEN") || spellChecker.correct(word)) {
      return word;
    }

    const suggestion = spellChecker.suggest(word)[0];
    return suggestion ? preserveCase(word, suggestion) : word;
  });

  return corrected.replace(/PROTECTEDTOKEN(\d+)X/g, (_match, index: string) => {
    return protectedTokens[Number(index)] || "";
  });
};