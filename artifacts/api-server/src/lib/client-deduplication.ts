export type SeedClientRecord = {
  id: number;
  name: string;
  phone: string;
  orders: number;
  revenue: number;
  lastVisit?: string | null;
  registeredAt?: string | null;
  initials?: string;
};

export type TrustedClientDuplicateGroup = {
  canonicalId: number;
  memberIds: number[];
  normalizedName: string;
  normalizedPhone: string;
};

export type SnapshotClientRecord = {
  id: number;
  name: string;
  initials: string;
  lastVisit: string;
  service: string;
  status: string;
  source: string;
  phone: string;
  email: string;
  notes: string;
};

export type MergedSnapshotClientGroup = {
  canonicalId: number;
  duplicateIds: number[];
};

export const normalizeClientName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");

export const normalizeClientPhone = (value: string) => {
  let digits = value.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  return digits.length === 10 || digits.length === 11 ? digits : "";
};

const dateOrdinal = (value: string | null | undefined): number | null => {
  const date = value?.trim();
  if (!date) return null;

  const brazilianDate = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brazilianDate) {
    const [, dayText, monthText, yearText] = brazilianDate;
    const day = Number(dayText);
    const month = Number(monthText);
    const year = Number(yearText);
    const timestamp = Date.UTC(year, month - 1, day);
    const parsed = new Date(timestamp);
    if (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    ) {
      return timestamp;
    }
    return null;
  }

  const isoDate = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) {
    const timestamp = Date.parse(date);
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  const timestamp = Date.parse(date);
  return Number.isNaN(timestamp) ? null : timestamp;
};

const chooseDate = <T extends { lastVisit?: string | null; registeredAt?: string | null }>(
  records: readonly T[],
  field: "lastVisit" | "registeredAt",
  direction: "latest" | "earliest",
) => {
  const values = records
    .map((record, index) => ({ value: record[field], index, ordinal: dateOrdinal(record[field]) }))
    .filter((entry): entry is { value: string; index: number; ordinal: number | null } =>
      typeof entry.value === "string" && entry.value.trim().length > 0,
    );

  values.sort((a, b) => {
    if (a.ordinal !== null && b.ordinal === null) return -1;
    if (a.ordinal === null && b.ordinal !== null) return 1;
    if (a.ordinal !== null && b.ordinal !== null && a.ordinal !== b.ordinal) {
      return direction === "latest" ? b.ordinal - a.ordinal : a.ordinal - b.ordinal;
    }
    return a.index - b.index;
  });
  return values[0]?.value;
};

const preferredName = (values: readonly string[]) =>
  [...new Set(values.map((value) => value.trim().replace(/\s+/g, " ")).filter(Boolean))]
    .sort((a, b) => {
      const aHasNaturalCase = a !== a.toLocaleUpperCase("pt-BR") && a !== a.toLocaleLowerCase("pt-BR");
      const bHasNaturalCase = b !== b.toLocaleUpperCase("pt-BR") && b !== b.toLocaleLowerCase("pt-BR");
      if (aHasNaturalCase !== bHasNaturalCase) return aHasNaturalCase ? -1 : 1;

      const aHasDiacritics = /[áéíóúàèìòùâêîôûãõç]/iu.test(a);
      const bHasDiacritics = /[áéíóúàèìòùâêîôûãõç]/iu.test(b);
      if (aHasDiacritics !== bHasDiacritics) return aHasDiacritics ? -1 : 1;
      if (a.length !== b.length) return b.length - a.length;
      return a.localeCompare(b, "pt-BR");
    })[0] ?? "";

const identityKey = (record: Pick<SeedClientRecord, "name" | "phone">) => {
  const name = normalizeClientName(record.name);
  const phone = normalizeClientPhone(record.phone);
  return name && phone ? JSON.stringify([name, phone]) : null;
};

export const identifyTrustedClientDuplicateGroups = (
  records: readonly SeedClientRecord[],
): TrustedClientDuplicateGroup[] => {
  const candidates = new Map<string, SeedClientRecord[]>();
  for (const record of records) {
    const key = identityKey(record);
    if (!key) continue;
    const group = candidates.get(key) ?? [];
    group.push(record);
    candidates.set(key, group);
  }

  return [...candidates.entries()]
    .flatMap(([key, group]) => {
      if (group.length < 2 || new Set(group.map((record) => record.id)).size !== group.length) {
        return [];
      }
      const first = group[0]!;
      if (
        typeof first.orders !== "number" ||
        !Number.isFinite(first.orders) ||
        typeof first.revenue !== "number" ||
        !Number.isFinite(first.revenue) ||
        group.some((record) => record.orders !== first.orders || record.revenue !== first.revenue)
      ) {
        return [];
      }

      const [normalizedName, normalizedPhone] = JSON.parse(key) as [string, string];
      const memberIds = group.map((record) => record.id).sort((a, b) => a - b);
      return [{
        canonicalId: memberIds[0]!,
        memberIds,
        normalizedName,
        normalizedPhone,
      }];
    })
    .sort((a, b) => a.canonicalId - b.canonicalId);
};

export const deduplicateSeedClientRecords = <T extends SeedClientRecord>(records: readonly T[]) => {
  const groups = identifyTrustedClientDuplicateGroups(records);
  const canonicalReplacements = new Map<number, T>();
  const duplicateIds = new Set<number>();

  for (const group of groups) {
    const members = group.memberIds
      .map((id) => records.find((record) => record.id === id))
      .filter((record): record is T => Boolean(record));
    const canonical = members.find((record) => record.id === group.canonicalId);
    if (!canonical || members.length !== group.memberIds.length) continue;

    const chosenName = preferredName(members.map((record) => record.name));
    const nameRecord = members.find((record) => record.name.trim() === chosenName) ?? canonical;
    canonicalReplacements.set(canonical.id, {
      ...canonical,
      name: chosenName || canonical.name,
      initials: nameRecord.initials ?? canonical.initials,
      lastVisit: chooseDate(members, "lastVisit", "latest") ?? canonical.lastVisit,
      registeredAt: chooseDate(members, "registeredAt", "earliest") ?? canonical.registeredAt,
    });
    for (const member of members) {
      if (member.id !== canonical.id) duplicateIds.add(member.id);
    }
  }

  return {
    records: records
      .filter((record) => !duplicateIds.has(record.id))
      .map((record) => canonicalReplacements.get(record.id) ?? record),
    groups,
    duplicateCount: duplicateIds.size,
  };
};

const onlyOneValue = <T extends SnapshotClientRecord>(
  records: readonly T[],
  field: "service" | "status" | "source",
) => {
  const values = new Map<string, string>();
  for (const record of records) {
    const value = record[field].trim();
    if (value) values.set(value.toLocaleLowerCase("pt-BR"), value);
  }
  return values.size <= 1 ? values.values().next().value as string | undefined : null;
};

const initialsForName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return (parts[0] ?? "").slice(0, 2).toLocaleUpperCase("pt-BR");
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toLocaleUpperCase("pt-BR");
};

export const mergeKnownSnapshotClientDuplicates = <T extends SnapshotClientRecord>(
  records: readonly T[],
  groups: readonly TrustedClientDuplicateGroup[],
  alreadyArchivedIds: ReadonlySet<number> = new Set(),
) => {
  const replacements = new Map<number, T>();
  const mergedGroups: MergedSnapshotClientGroup[] = [];
  const recordsById = new Map(records.map((record) => [record.id, record]));

  for (const group of groups) {
    if (group.memberIds.some((id) => alreadyArchivedIds.has(id))) continue;
    const members = group.memberIds
      .map((id) => recordsById.get(id))
      .filter((record): record is T => Boolean(record));
    if (members.length !== group.memberIds.length) continue;

    const matchingIdentityCount = records.filter((record) =>
      normalizeClientName(record.name) === group.normalizedName &&
      normalizeClientPhone(record.phone) === group.normalizedPhone,
    ).length;
    if (matchingIdentityCount !== group.memberIds.length) continue;
    if (members.some((record) =>
      normalizeClientName(record.name) !== group.normalizedName ||
      normalizeClientPhone(record.phone) !== group.normalizedPhone
    )) continue;

    const canonical = members.find((record) => record.id === group.canonicalId);
    if (!canonical) continue;

    const service = onlyOneValue(members, "service");
    const status = onlyOneValue(members, "status");
    const source = onlyOneValue(members, "source");
    if (service === null || status === null || source === null) continue;

    const emails = new Map<string, string>();
    for (const record of members) {
      const email = record.email.trim();
      if (email) emails.set(email.toLocaleLowerCase("pt-BR"), email);
    }
    if (emails.size > 1) continue;

    const name = preferredName(members.map((record) => record.name)) || canonical.name;
    const nameRecord = members.find((record) => record.name.trim().replace(/\s+/g, " ") === name);
    const notes = new Map<string, string>();
    for (const record of members) {
      const value = record.notes.trim();
      if (value) notes.set(value.replace(/\r\n/g, "\n"), value);
    }
    const duplicateIds = group.memberIds.filter((id) => id !== group.canonicalId);
    replacements.set(canonical.id, {
      ...canonical,
      name,
      initials: nameRecord?.initials || initialsForName(name),
      lastVisit: chooseDate(members, "lastVisit", "latest") ?? canonical.lastVisit,
      service: service ?? canonical.service,
      status: status ?? canonical.status,
      source: source ?? canonical.source,
      email: emails.values().next().value ?? "",
      notes: [...notes.values()].join("\n\n"),
    });
    mergedGroups.push({ canonicalId: group.canonicalId, duplicateIds });
  }

  return {
    clients: records.map((record) => replacements.get(record.id) ?? record),
    mergedGroups,
    duplicateCount: mergedGroups.reduce((total, group) => total + group.duplicateIds.length, 0),
  };
};