export type StudentProfile = { id: string; full_name: string | null; birth_date: string | null; class_stream: string | null; bio_link: string | null };
export function safeBioLink(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try { const url = new URL(value.trim()); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function profileComplete(profile: StudentProfile | null | undefined): boolean {
  return !!profile?.full_name?.trim() && !!profile.birth_date && !!profile.class_stream?.trim();
}
export function ageAt(birthDate: string, today = new Date()): number {
  const [year, month, day] = birthDate.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return NaN;
  return today.getFullYear() - year - (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day) ? 1 : 0);
}