const STORAGE_KEY = "wai.pendingEnrollments";

export function clearPendingEnrollments(): void {
  window.sessionStorage.removeItem(STORAGE_KEY);
}

export function readPendingEnrollments(): Map<string, string> {
  try {
    const value: unknown = JSON.parse(
      window.sessionStorage.getItem(STORAGE_KEY) ?? "{}",
    );
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return new Map();
    }
    return new Map(
      Object.entries(value).map(([courseId, enrollmentId]) => [
        courseId,
        typeof enrollmentId === "string" ? enrollmentId : "",
      ]),
    );
  } catch {
    return new Map();
  }
}

export function rememberPendingEnrollment(
  courseId: string,
  enrollmentId = "",
): void {
  const pending = readPendingEnrollments();
  pending.set(courseId, enrollmentId);
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Object.fromEntries(pending)),
    );
  } catch {
    // Keep the request usable when browser storage is unavailable.
  }
}

export function forgetPendingEnrollment(courseId: string): void {
  const pending = readPendingEnrollments();
  pending.delete(courseId);
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Object.fromEntries(pending)),
    );
  } catch {
    // Keep the request usable when browser storage is unavailable.
  }
}
