export function parseResourceLinks(text: string): string[] {
  return text.split(/\n+/).map(s => s.trim()).filter(Boolean).map(value => {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("invalid_resource_link");
    return url.href;
  });
}

export function pageBinding(index: number, grouped: boolean, rootId: string, parentId: string | null, start: number) {
  return {
    id: index === 0 && !parentId ? rootId : crypto.randomUUID(),
    parent_lesson_id: parentId || (grouped && index > 0 ? rootId : null),
    page_number: grouped || parentId ? start + index : 1,
    grouped_pages: grouped && !parentId,
  };
}

export function groupPages<T extends { id: string; parent_lesson_id: string | null; grouped_pages?: boolean }>(pages: T[], selected: T): T[] {
  if (!selected.grouped_pages) return pages;
  const root = selected.parent_lesson_id || selected.id;
  return pages.filter(p => p.id === root || p.parent_lesson_id === root);
}

export function displayEntries<T extends { parent_lesson_id: string | null; grouped_pages?: boolean }>(pages: T[]): T[] {
  return pages.filter(p => !p.grouped_pages || !p.parent_lesson_id);
}