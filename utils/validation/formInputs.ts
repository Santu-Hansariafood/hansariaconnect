export const normalizeIndianMobileInput = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const nationalNumber =
    digits.length === 12 && digits.startsWith("91")
      ? digits.slice(2)
      : digits;
  return nationalNumber.slice(0, 10);
};

export const isValidIndianMobile = (value: string) =>
  /^[6-9]\d{9}$/.test(value);

export const normalizeEmailInput = (value: string) =>
  value.trim().toLowerCase();

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normalizeNameInput = (value: string) =>
  value
    .replace(/[^\p{L}\p{M}\s.'’-]/gu, "")
    .replace(/^(\s*)(\p{L})/u, (_match, leading: string, first: string) =>
      leading + first.toUpperCase(),
    );

export const isValidPersonName = (value: string) =>
  /^\p{L}[\p{L}\p{M} .'’-]*$/u.test(value.trim());
