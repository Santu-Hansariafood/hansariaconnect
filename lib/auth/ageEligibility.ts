export const MINIMUM_REGISTRATION_AGE = 16;

export function getAgeOnDateOfBirth(
  dateOfBirth: string,
  today = new Date(),
): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;

  const [year, month, day] = dateOfBirth.split("-").map(Number);
  const birthDate = new Date(Date.UTC(year, month - 1, day));
  if (
    birthDate.getUTCFullYear() !== year ||
    birthDate.getUTCMonth() !== month - 1 ||
    birthDate.getUTCDate() !== day
  ) {
    return null;
  }

  const currentYear = today.getUTCFullYear();
  const currentMonth = today.getUTCMonth();
  const currentDay = today.getUTCDate();
  if (
    year > currentYear ||
    (year === currentYear &&
      (month - 1 > currentMonth ||
        (month - 1 === currentMonth && day > currentDay)))
  ) {
    return null;
  }

  let age = currentYear - year;
  if (
    currentMonth < month - 1 ||
    (currentMonth === month - 1 && currentDay < day)
  ) {
    age -= 1;
  }
  return age;
}
