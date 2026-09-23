/**
 * Compares two dot-separated version strings (e.g. OIBus version numbers, or version-shaped
 * directory names) component-by-component as numbers instead of as plain strings, so "3.10"
 * sorts after "3.9" rather than before it (a plain string compare puts "3.10" right after "3.1",
 * since '0' < '2' at the first differing character). Any non-numeric component falls back to a
 * string comparison so unexpected values still sort deterministically instead of throwing.
 *
 * A pre-release suffix (everything after the first '-', as in OIBus beta tags like
 * "3.9.0-beta-6") follows semver precedence: a pre-release sorts before its release
 * ("3.9.0-beta-6" < "3.9.0"), and pre-releases of the same version compare identifier by
 * identifier, numerically where both are numbers ("3.9.0-beta-9" < "3.9.0-beta-10").
 *
 * Shared by the entity-migration directory ordering (`migration-service.ts`) and the
 * settings-upgrade registry (`getUpgradesNewerThan`), which both need the same "3.9" < "3.10"
 * semantics.
 */
export function compareVersions(a: string, b: string): number {
  const [aCore, aPreRelease] = splitPreRelease(a);
  const [bCore, bPreRelease] = splitPreRelease(b);
  const coreComparison = compareIdentifiers(aCore.split('.'), bCore.split('.'));
  if (coreComparison !== 0) {
    return coreComparison;
  }
  if (aPreRelease === null || bPreRelease === null) {
    // A release has higher precedence than any of its pre-releases
    if (aPreRelease === bPreRelease) return 0;
    return aPreRelease === null ? 1 : -1;
  }
  return compareIdentifiers(aPreRelease.split(/[.-]/), bPreRelease.split(/[.-]/));
}

function splitPreRelease(version: string): [string, string | null] {
  const index = version.indexOf('-');
  return index === -1 ? [version, null] : [version.slice(0, index), version.slice(index + 1)];
}

function compareIdentifiers(aParts: Array<string>, bParts: Array<string>): number {
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
