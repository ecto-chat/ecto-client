export type AutocompleteState = {
  type: '@' | '#';
  query: string;
  startIndex: number;
};

export function detectAutocomplete(
  text: string,
  cursorPos: number,
): AutocompleteState | null {
  // Scan backwards from cursor to find a trigger character (@ or #)
  for (let i = cursorPos - 1; i >= 0; i--) {
    const ch = text[i];
    // Space means no active trigger in this word
    if (ch === ' ' || ch === '\n') return null;
    if (ch === '@' || ch === '#') {
      // Trigger must be at start of text or preceded by whitespace
      if (i === 0 || text[i - 1] === ' ' || text[i - 1] === '\n') {
        return {
          type: ch as '@' | '#',
          query: text.slice(i + 1, cursorPos),
          startIndex: i,
        };
      }
      return null;
    }
  }
  return null;
}
