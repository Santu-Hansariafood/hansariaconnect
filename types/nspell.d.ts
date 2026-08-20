declare module "nspell" {
  interface SpellChecker {
    correct(word: string): boolean;
    suggest(word: string): string[];
  }

  interface Dictionary {
    aff: Uint8Array;
    dic: Uint8Array;
  }

  const nspell: (dictionary: Dictionary) => SpellChecker;
  export default nspell;
}