export function getEvidenceSourceAvailabilityMessage(sourceDocIds: string[] | undefined): string {
  const selectedCount = sourceDocIds?.length ?? 0;
  if (selectedCount === 0) {
    return "No Knowledge Hub assets were selected for this skill when it ran, so this output has no document citations.";
  }
  return `${selectedCount} selected Knowledge Hub asset${selectedCount === 1 ? " was" : "s were"} searched, but no usable document excerpt was available when this skill ran. This output therefore has no document citations; re-run the skill after indexing to assemble sources.`;
}
