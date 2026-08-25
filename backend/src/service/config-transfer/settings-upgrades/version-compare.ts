/**
 * Compares two dot-separated version strings (e.g. OIBus version numbers, or version-shaped
 * directory names) component-by-component as numbers instead of as plain strings, so "3.10"
 * sorts after "3.9" rather than before it (a plain string compare puts "3.10" right after "3.1",
 * since '0' < '2' at the first differing character). Any non-numeric component falls back to a
 * string comparison so unexpected values still sort deterministically instead of throwing.
 *
 * Shared by the entity-migration directory ordering (`migration-service.ts`) and the
 * settings-upgrade registry (`getUpgradesNewerThan`), which both need the same "3.9" < "3.10"
 * semantics.
 */
export function compareVersions(a: string, b: string): number {
  const aParts = a.split('.');
  const bParts = b.split('.');
  const length = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < length; i++) {
    const aPart = aParts[i] ?? '';
    const bPart = bParts[i] ?? '';
    const aNum = Number(aPart);
    const bNum = Number(bPart);
    if (aPart !== '' && bPart !== '' && Number.isFinite(aNum) && Number.isFinite(bNum)) {
      if (aNum !== bNum) {
        return aNum - bNum;
      }
    } else if (aPart !== bPart) {
      return aPart > bPart ? 1 : -1;
    }
  }
  return 0;
}
