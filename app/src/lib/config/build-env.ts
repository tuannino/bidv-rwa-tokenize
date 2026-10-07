/** Chỉ metadata công khai được nhúng vào bản dựng; không đưa secret vào next.config.env. */
export function buildMetadataEnv(): Record<string, string> {
  const values = {
    BUILD_COMMIT_SHA: process.env.BUILD_COMMIT_SHA,
    BUILD_BRANCH: process.env.BUILD_BRANCH,
    BUILD_TIME: process.env.BUILD_TIME,
  };
  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1]?.trim())),
  );
}
