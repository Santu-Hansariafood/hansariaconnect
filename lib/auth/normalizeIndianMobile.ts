export const normalizeIndianMobile = (value: unknown): string | null => {
  const input = String(value ?? "").trim();
  if (!/^\+?[\d\s().-]+$/.test(input)) return null;

  const digits = input.replace(/\D/g, "");
  const mobile =
    digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;

  return /^[6-9]\d{9}$/.test(mobile) ? mobile : null;
};
