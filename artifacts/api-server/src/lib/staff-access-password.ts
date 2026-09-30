export function defaultStaffPasswordFromEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;

  const [localPart, domain, ...extraParts] = email.trim().split("@");
  const password = localPart?.trim();
  if (!password || !domain?.trim() || extraParts.length > 0) return null;

  return password;
}