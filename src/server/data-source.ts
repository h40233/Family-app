export function usesDatabaseRuntime(scope?: string) {
  const globalSetting = process.env.FAMILY_OS_DATA_SOURCE;
  const scopedSetting = scope
    ? process.env[`FAMILY_OS_${scope.toUpperCase()}_DATA_SOURCE`]
    : undefined;

  return globalSetting === "database" || scopedSetting === "database";
}
