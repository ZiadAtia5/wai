export type CourseEnrollmentStatus = "approved" | "pending" | "rejected";

type EnrollmentRecord = Record<string, unknown>;

function asRecord(value: unknown): EnrollmentRecord {
  return typeof value === "object" && value !== null
    ? (value as EnrollmentRecord)
    : {};
}

export function enrollmentStatus(value: unknown): CourseEnrollmentStatus {
  const enrollment = asRecord(value);
  const status = String(
    enrollment.status ?? enrollment.enrollmentStatus ?? enrollment.state ?? "",
  )
    .trim()
    .toLowerCase();

  if (
    enrollment.isRejected === true ||
    ["2", "rejected", "declined", "cancelled", "canceled"].includes(status)
  ) {
    return "rejected";
  }

  if (enrollment.isApproved === false) return "pending";

  if (
    enrollment.isApproved === true ||
    [
      "1",
      "3",
      "approved",
      "accepted",
      "active",
      "enrolled",
      "completed",
      "complete",
    ].includes(status)
  ) {
    return "approved";
  }

  return "pending";
}

export function enrollmentCourseId(value: unknown): string | null {
  const enrollment = asRecord(value);
  const course = asRecord(enrollment.course);
  const id = enrollment.courseId ?? course.id ?? course.courseId;

  return id === undefined || id === null ? null : String(id);
}

export function enrollmentRequestId(value: unknown): string | null {
  const enrollment = asRecord(value);
  const id = enrollment.id ?? enrollment.enrollmentId;

  return id === undefined || id === null ? null : String(id);
}

export function enrollmentRecords(value: unknown): EnrollmentRecord[] {
  if (Array.isArray(value)) return value.map(asRecord);

  const root = asRecord(value);
  const nested = asRecord(root.data);
  const candidates = [root, nested, asRecord(nested.data)];

  for (const candidate of candidates) {
    for (const key of ["items", "enrollments", "records"]) {
      if (Array.isArray(candidate[key])) {
        return (candidate[key] as unknown[]).map(asRecord);
      }
    }
  }

  if (Array.isArray(root.data)) return root.data.map(asRecord);
  if (Array.isArray(nested.data)) return nested.data.map(asRecord);

  return [];
}
