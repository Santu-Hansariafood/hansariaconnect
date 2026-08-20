export const autoCorrectSpelling = async (text: string) => {
  try {
    const response = await fetch("/api/spellcheck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await response.json();
    return response.ok && typeof data?.text === "string" ? data.text : text;
  } catch {
    return text;
  }
};