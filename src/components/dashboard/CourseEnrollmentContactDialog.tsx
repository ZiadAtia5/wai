import { useEffect, useRef, useState } from "react";

import { AnimatePresence, motion } from "framer-motion";

import { createPortal } from "react-dom";

import {
  CheckCircle2,
  LoaderCircle,
  MessageCircle,
  Phone,
  Send,
  X,
} from "lucide-react";

import { ApiError, getAuthToken } from "../../api/client";

import { coursesApi, studentsApi, teachersApi } from "../../api/endpoints";

import { enrollmentStatus } from "../../utils/courseEnrollments";

import CourseTeacherAvatar from "../CourseTeacherAvatar";

import type { NavigateFn } from "../../types";

import { notifyError, notifySuccess } from "../../utils/notifications";

import {
  forgetPendingEnrollment,
  readPendingEnrollments,
  rememberPendingEnrollment,
} from "../../utils/pendingEnrollments";

type CourseRecord = Record<string, unknown>;

function asRecord(value: unknown): CourseRecord | null {
  return typeof value === "object" && value !== null
    ? (value as CourseRecord)
    : null;
}

function unwrap(value: unknown): unknown {
  let current = value;

  for (let depth = 0; depth < 5; depth += 1) {
    const response = asRecord(current);

    if (!response || !("data" in response)) break;

    current = response.data;
  }

  return current;
}

function nestedRecord(value: unknown): CourseRecord {
  return asRecord(value) ?? {};
}

function readPhone(value: unknown): string {
  const queue = [nestedRecord(value)];

  const visited = new Set<CourseRecord>();

  const relatedKeys = [
    "teacher",

    "instructor",

    "teacherProfile",

    "instructorProfile",

    "profile",

    "user",

    "owner",
  ];

  const phoneKeys = [
    "mobileNumber",

    "mobile",

    "teacherPhoneNumber",

    "instructorPhoneNumber",

    "whatsappPhoneNumber",

    "whatsAppPhoneNumber",

    "whatsappNumber",

    "whatsAppNumber",

    "phoneNumber",

    "phone",
  ];

  while (queue.length && visited.size < 12) {
    const candidate = queue.shift();

    if (!candidate || visited.has(candidate)) continue;

    visited.add(candidate);

    for (const key of phoneKeys) {
      const phone = candidate[key];

      if (
        (typeof phone === "string" || typeof phone === "number") &&
        String(phone).trim()
      ) {
        return String(phone).trim();
      }
    }

    for (const key of relatedKeys) {
      const related = asRecord(candidate[key]);

      if (related) queue.push(related);
    }
  }

  return "";
}

function titleOf(course: CourseRecord): string {
  const title = course.title ?? course.name ?? course.courseName;

  return typeof title === "string" && title.trim()
    ? title.trim()
    : "الدورة التعليمية";
}

function teacherNameOf(course: CourseRecord): string {
  const teacher =
    asRecord(course.teacher) ??
    asRecord(course.instructor) ??
    asRecord(course.teacherProfile);

  const name =
    course.teacherName ??
    course.instructorName ??
    teacher?.fullName ??
    teacher?.name;

  return typeof name === "string" && name.trim() ? name.trim() : "معلم الدورة";
}

function teacherIdOf(course: CourseRecord): string {
  const teacher =
    asRecord(course.teacher) ??
    asRecord(course.instructor) ??
    asRecord(course.teacherProfile) ??
    asRecord(course.teacher_profile) ??
    asRecord(course.instructor_profile);

  const id =
    course.teacherId ??
    course.teacher_id ??
    course.instructorId ??
    course.instructor_id ??
    teacher?.id ??
    teacher?.teacherId ??
    teacher?.teacher_id ??
    teacher?.userId ??
    teacher?.user_id;

  return id === undefined || id === null ? "" : String(id);
}

function whatsappPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");

  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.startsWith("0")) digits = `20${digits.slice(1)}`;

  return digits;
}

export default function CourseEnrollmentContactDialog({
  course,

  onClose,
  navigate,
  isEnrolled = false,
  isPending = false,
  onEnrollmentRequested,
  onEnrollmentCancelled,
}: {
  course: CourseRecord | null;

  onClose: () => void;
  navigate?: NavigateFn;
  isEnrolled?: boolean;
  isPending?: boolean;
  onEnrollmentRequested?: (courseId: string) => void;
  onEnrollmentCancelled?: (courseId: string) => void;
}) {
  const [phone, setPhone] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [requesting, setRequesting] = useState(false);

  const [requestSent, setRequestSent] = useState(false);

  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

  const [checkingRequest, setCheckingRequest] = useState(false);

  const [requestMessage, setRequestMessage] = useState("");

  const requestId = useRef(0);

  useEffect(() => {
    if (!course) return;

    const currentRequestId = ++requestId.current;

    let active = true;

    const updateIfActive = (callback: () => void) => {
      if (active && requestId.current === currentRequestId) callback();
    };

    setPhone(readPhone(course));

    setError("");
    setLoading(false);
    const id = course.id ?? course.courseId;
    const storedPending =
      id == null ? undefined : readPendingEnrollments().get(String(id));
    const hasPendingRequest = isPending || storedPending !== undefined;
    setPendingRequestId(hasPendingRequest ? (storedPending ?? "") : null);
    setRequestSent(isEnrolled || hasPendingRequest);
    setCheckingRequest(false);
    setRequestMessage(
      hasPendingRequest
        ? "وصل طلبك للمعلم وهو قيد المراجعة. يمكنك التواصل معه لتسريع العملية أو إلغاء الطلب."
        : "",
    );

    const loadContact = async () => {
      let resolvedCourse = course;
      let detailError: unknown = null;

      if (!readPhone(resolvedCourse)) {
        const id = course.id ?? course.courseId;
        if (id !== undefined && id !== null) {
          setLoading(true);

          try {
            const response = unwrap(await coursesApi.publicDetail(String(id)));

            updateIfActive(() => {
              const details = asRecord(response);

              if (!details) return;

              const nested =
                asRecord(details.course) ??
                asRecord(details.courseDetails) ??
                details;

              resolvedCourse = { ...course, ...nested };
            });
          } catch (cause) {
            detailError = cause;
          }
        }
      }

      let resolvedPhone = readPhone(resolvedCourse);

      const teacherId = teacherIdOf(resolvedCourse);

      if (!resolvedPhone && teacherId) {
        setLoading(true);

        const profileLoaders = getAuthToken()
          ? [
              () => teachersApi.byId(teacherId),
              () => teachersApi.publicById(teacherId),
            ]
          : [() => teachersApi.publicById(teacherId)];
        let lookupError: unknown = null;

        for (const loadProfile of profileLoaders) {
          try {
            const response = unwrap(await loadProfile());
            const teacher = asRecord(response);

            if (!teacher) continue;

            resolvedPhone = readPhone(teacher);
            updateIfActive(() => {
              resolvedCourse = { ...resolvedCourse, teacher };
            });

            if (resolvedPhone) break;
          } catch (cause) {
            lookupError = cause;
          }
        }

        if (!resolvedPhone && lookupError) {
          updateIfActive(() => {
            setError(
              lookupError instanceof Error
                ? lookupError.message
                : "تعذر تحميل رقم تواصل المعلم.",
            );
          });
        }
      }

      updateIfActive(() => {
        setPhone(resolvedPhone);

        if (!resolvedPhone && detailError && !teacherId && !error) {
          setError(
            detailError instanceof Error
              ? detailError.message
              : "تعذر تحميل بيانات التواصل الخاصة بالدورة.",
          );
        }

        setLoading(false);
      });
    };

    void loadContact();

    return () => {
      active = false;

      requestId.current += 1;
    };
  }, [course, isEnrolled, isPending]);

  useEffect(() => {
    if (!course) return;

    const id = course.id ?? course.courseId;
    const role = (
      window.sessionStorage.getItem("eduhub.auth.role") ?? ""
    ).toLowerCase();
    if (id == null || !getAuthToken() || !role.includes("student")) return;

    let active = true;
    setCheckingRequest(true);
    studentsApi
      .enrollments({ page: 1, pageSize: 100 })
      .then((response) => {
        if (!active) return;
        const value = unwrap(response);
        const root = asRecord(value);
        const nested = asRecord(root?.data);
        const rows = Array.isArray(value)
          ? value
          : Array.isArray(root?.items)
            ? root.items
            : Array.isArray(root?.enrollments)
              ? root.enrollments
              : Array.isArray(nested?.items)
                ? nested.items
                : Array.isArray(nested?.enrollments)
                  ? nested.enrollments
                  : [];
        const existing = rows.map(asRecord).find((row) => {
          const relatedCourse = asRecord(row?.course);
          return (
            String(
              row?.courseId ??
                relatedCourse?.id ??
                relatedCourse?.courseId ??
                "",
            ) === String(id)
          );
        });
        if (!existing) return;

        const status = enrollmentStatus(existing);
        if (status === "rejected") {
          forgetPendingEnrollment(String(id));
          setPendingRequestId(null);
          setRequestSent(false);
          onEnrollmentCancelled?.(String(id));
          return;
        }

        const approved = status === "approved";
        const enrollmentId = existing.id ?? existing.enrollmentId;
        if (approved) {
          forgetPendingEnrollment(String(id));
          setPendingRequestId(null);
        } else {
          rememberPendingEnrollment(
            String(id),
            enrollmentId == null ? "" : String(enrollmentId),
          );
          setPendingRequestId(enrollmentId == null ? "" : String(enrollmentId));
        }
        onEnrollmentRequested?.(String(id));
        setRequestSent(true);
        setRequestMessage(
          approved
            ? "أنت مسجل بالفعل في هذه الدورة."
            : "وصل طلبك للمعلم وهو قيد المراجعة. يمكنك التواصل معه لتسريع العملية أو إلغاء الطلب.",
        );
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setCheckingRequest(false);
      });

    return () => {
      active = false;
    };
  }, [course, onEnrollmentCancelled, onEnrollmentRequested]);

  useEffect(() => {
    if (!course) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [course, onClose]);

  const normalizedPhone = whatsappPhone(phone);
  const courseId = course?.id ?? course?.courseId;
  const pending = pendingRequestId !== null;
  const enrollmentComplete = isEnrolled || requestSent;

  async function requestEnrollment() {
    if (
      !course ||
      courseId === undefined ||
      courseId === null ||
      requesting ||
      checkingRequest
    ) {
      return;
    }

    if (enrollmentComplete) {
      setRequestMessage(
        "تم إرسال طلبك بالفعل. تواصل مع المعلم عبر واتساب لإتمام الدفع.",
      );
      return;
    }

    if (!getAuthToken()) {
      setRequestMessage("سجّل الدخول بحساب الطالب أولًا لإرسال طلب الالتحاق.");
      navigate?.("login");
      return;
    }

    const role = (
      window.sessionStorage.getItem("eduhub.auth.role") ?? ""
    ).toLowerCase();

    if (!role.includes("student")) {
      const message = "طلب الالتحاق متاح لحساب الطالب فقط.";
      setRequestMessage(message);
      notifyError(new Error(message));
      return;
    }

    const storedRequest = readPendingEnrollments().get(String(courseId));
    if (storedRequest !== undefined) {
      setPendingRequestId(storedRequest);
      setRequestSent(true);
      setRequestMessage(
        "تم إرسال طلبك بالفعل. يمكنك إلغاؤه أو التواصل مع المدرس عبر واتساب.",
      );
      return;
    }

    setRequesting(true);
    setRequestMessage("");

    try {
      const currentEnrollments = unwrap(
        await studentsApi.enrollments({ page: 1, pageSize: 100 }),
      );
      const root = asRecord(currentEnrollments);
      const nested = asRecord(root?.data);
      const rows = Array.isArray(currentEnrollments)
        ? currentEnrollments
        : Array.isArray(root?.items)
          ? root.items
          : Array.isArray(root?.enrollments)
            ? root.enrollments
            : Array.isArray(nested?.items)
              ? nested.items
              : Array.isArray(nested?.enrollments)
                ? nested.enrollments
                : [];
      const existing = rows.map(asRecord).find((row) => {
        const relatedCourse = asRecord(row?.course);
        return (
          String(
            row?.courseId ?? relatedCourse?.id ?? relatedCourse?.courseId ?? "",
          ) === String(courseId)
        );
      });
      if (existing) {
        const status = enrollmentStatus(existing);
        if (status !== "rejected") {
          const approved = status === "approved";
          if (!approved) {
            const id = existing.id ?? existing.enrollmentId;
            rememberPendingEnrollment(
              String(courseId),
              id == null ? "" : String(id),
            );
            setPendingRequestId(id == null ? "" : String(id));
          } else {
            forgetPendingEnrollment(String(courseId));
            setPendingRequestId(null);
          }
          setRequestSent(true);
          setRequestMessage(
            approved
              ? "أنت مسجل بالفعل في هذه الدورة."
              : "تم إرسال طلبك بالفعل. يمكنك إلغاؤه أو التواصل مع المدرس عبر واتساب.",
          );
          return;
        }
      }

      const response = await coursesApi.enroll(String(courseId));
      const enrollment = asRecord(unwrap(response));
      const id = enrollment?.id ?? enrollment?.enrollmentId;
      rememberPendingEnrollment(String(courseId), id == null ? "" : String(id));
      setPendingRequestId(id == null ? "" : String(id));
      setRequestSent(true);
      setRequestMessage(
        "تم إرسال طلبك للمعلم. تواصل معه عبر واتساب لإتمام الدفع، وسيعتمد اشتراكك بعد تأكيد الدفع.",
      );
      onEnrollmentRequested?.(String(courseId));
      notifySuccess("تم إرسال طلب الالتحاق بنجاح.");
    } catch (cause) {
      if (
        (cause instanceof ApiError && cause.status === 409) ||
        (cause instanceof Error &&
          /already|duplicate|enrolled|enrollment|مسجل|التحاق|مكرر/i.test(
            cause.message,
          ))
      ) {
        rememberPendingEnrollment(String(courseId), "");
        setPendingRequestId("");
        setRequestSent(true);
        setRequestMessage(
          "لديك طلب التحاق مسجل بالفعل. تواصل مع المعلم عبر واتساب لإتمام الدفع، وسيعتمد اشتراكك بعد تأكيد الدفع.",
        );
        onEnrollmentRequested?.(String(courseId));
        return;
      }

      const message =
        cause instanceof Error ? cause.message : "تعذر إرسال طلب الالتحاق.";
      setRequestMessage(message);
      notifyError(cause, "تعذر إرسال طلب الالتحاق.");
    } finally {
      setRequesting(false);
    }
  }

  async function cancelEnrollment() {
    if (courseId == null || requesting) return;

    setRequesting(true);
    setRequestMessage("");
    try {
      let id = pendingRequestId || "";
      if (!id) {
        const response = await studentsApi.enrollments({
          page: 1,
          pageSize: 100,
        });
        const enrollment = unwrap(response);
        const root = asRecord(enrollment);
        const nested = asRecord(root?.data);
        const rows = Array.isArray(enrollment)
          ? enrollment
          : Array.isArray(root?.items)
            ? root.items
            : Array.isArray(root?.enrollments)
              ? root.enrollments
              : Array.isArray(nested?.items)
                ? nested.items
                : Array.isArray(nested?.enrollments)
                  ? nested.enrollments
                  : [];
        const match = rows.map(asRecord).find((row) => {
          const relatedCourse = asRecord(row?.course);
          return (
            String(
              row?.courseId ??
                relatedCourse?.id ??
                relatedCourse?.courseId ??
                "",
            ) === String(courseId)
          );
        });
        id = String(match?.id ?? match?.enrollmentId ?? "");
      }
      if (!id) throw new Error("تعذر العثور على طلب الالتحاق لإلغائه.");

      await studentsApi.cancelEnrollment(id);
      forgetPendingEnrollment(String(courseId));
      setPendingRequestId(null);
      setRequestSent(false);
      setRequestMessage("");
      onEnrollmentCancelled?.(String(courseId));
      notifySuccess("تم إلغاء طلب الالتحاق بنجاح.");
    } catch (cause) {
      setRequestMessage(
        cause instanceof Error ? cause.message : "تعذر إلغاء طلب الالتحاق.",
      );
      notifyError(cause, "تعذر إلغاء طلب الالتحاق.");
    } finally {
      setRequesting(false);
    }
  }

  return createPortal(
    <AnimatePresence>
      {course && (
        <motion.div
          className="fixed inset-0 z-[200] grid place-items-center overflow-hidden bg-emerald-950/55 p-2 backdrop-blur-sm sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-contact-title"
            className="my-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden overscroll-contain rounded-2xl bg-surface shadow-2xl shadow-emerald-950/25 sm:max-h-[calc(100dvh-2rem)] sm:rounded-[28px] md:flex-row"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="relative shrink-0 overflow-hidden bg-gradient-to-l from-nuwa-deep via-nuwa-base to-[#24865b] px-5 pb-4 pt-5 text-white sm:px-6 sm:pb-5 sm:pt-6 md:flex md:w-[40%] md:flex-col md:justify-center md:px-8">
              <span
                aria-hidden="true"
                className="absolute -left-7 -top-14 size-36 rounded-full border-[18px] border-white/10"
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق نافذة التواصل"
                className="absolute left-4 top-4 z-10 grid size-9 place-items-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
              >
                <X size={18} />
              </button>
              <span className="relative inline-flex size-10 items-center justify-center rounded-xl bg-white/15 text-emerald-100 ring-1 ring-white/15 sm:size-12 sm:rounded-2xl">
                <MessageCircle size={21} className="sm:size-6" />
              </span>
              <p className="relative mt-4 text-xs font-semibold text-white/75">
                طلب الالتحاق بالدورة
              </p>
              <h2
                id="course-contact-title"
                className="relative mt-1 line-clamp-2 text-xl font-bold"
              >
                {titleOf(course)}
              </h2>
              <p className="relative mt-2 text-xs leading-5 text-white/75 sm:text-sm sm:leading-6">
                أرسل طلبك للمعلم أولًا، ثم تواصل معه عبر واتساب لإتمام الدفع
                ليعتمد اشتراكك بعد تأكيده.
              </p>
            </div>

            <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain p-4 sm:space-y-4 sm:p-5 md:flex-1 md:p-7">
              <div className="flex items-center gap-3 rounded-2xl border border-stroke bg-white p-3 sm:p-4">
                <CourseTeacherAvatar
                  course={course}
                  name={teacherNameOf(course)}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-ink-muted">
                    معلم الدورة
                  </p>
                  <p className="mt-1 truncate text-sm font-bold text-ink">
                    {teacherNameOf(course)}
                  </p>
                </div>
              </div>

              <ol className="grid gap-2 rounded-2xl border border-stroke bg-white p-3 text-xs sm:gap-3 sm:p-4 sm:text-sm">
                <li className="flex items-start gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-nuwa-soft text-[11px] font-extrabold text-nuwa-base sm:size-7 sm:text-xs">
                    ١
                  </span>
                  <span className="leading-6 text-ink">
                    {pending ? (
                      <>
                        وصل طلبك للمعلم وهو قيد المراجعة. تواصل معه عبر واتساب
                        لتسريع العملية.
                      </>
                    ) : (
                      <>
                        اضغط <strong>طلب الالتحاق بالدورة</strong> لإرسال طلبك
                        إلى المعلم.
                      </>
                    )}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-nuwa-soft text-[11px] font-extrabold text-nuwa-base sm:size-7 sm:text-xs">
                    ٢
                  </span>
                  <span className="leading-6 text-ink">
                    {pending
                      ? "إذا كنت تريد التراجع، يمكنك إلغاء طلب الالتحاق من هنا."
                      : "تواصل مع المعلم عبر واتساب لإتمام الدفع؛ وبعد تأكيد الدفع يعتمد اشتراكك في الدورة."}
                  </span>
                </li>
              </ol>

              {loading ? (
                <div
                  aria-live="polite"
                  className="flex min-h-16 items-center justify-center gap-2 rounded-2xl border border-stroke bg-canvas/60 text-sm font-semibold text-ink-muted"
                >
                  <LoaderCircle size={18} className="animate-spin" />
                  جارٍ تحميل رقم التواصل...
                </div>
              ) : phone ? (
                <div className="rounded-2xl border border-emerald-900/10 bg-emerald-50/70 p-3 sm:p-4">
                  <p className="text-xs font-semibold text-ink-muted">
                    رقم التواصل عبر واتساب
                  </p>
                  <a
                    href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                    dir="ltr"
                    className="mt-1 inline-flex items-center gap-2 text-lg font-bold tabular-nums text-ink transition hover:text-nuwa-base"
                  >
                    <Phone size={17} className="text-nuwa-base" />
                    {phone}
                  </a>
                </div>
              ) : (
                <div
                  role={error ? "alert" : "status"}
                  className={`rounded-2xl border p-4 text-sm leading-6 ${
                    error
                      ? "border-danger/20 bg-danger-light text-danger"
                      : "border-warning/25 bg-warning-light text-ink"
                  }`}
                >
                  {error ||
                    "لم يضف المعلم رقم واتساب للتواصل بعد. يرجى المحاولة لاحقاً أو التواصل مع إدارة المنصة."}
                </div>
              )}

              {requestMessage && (
                <p
                  role={requestSent ? "status" : "alert"}
                  className={`rounded-xl px-3 py-2.5 text-xs leading-5 ${
                    requestSent
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border border-amber-200 bg-amber-50 text-amber-900"
                  }`}
                >
                  {requestSent && (
                    <CheckCircle2 className="me-1 inline" size={15} />
                  )}
                  {requestMessage}
                </p>
              )}

              <div className="grid gap-2 lg:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    pending ? void cancelEnrollment() : void requestEnrollment()
                  }
                  disabled={
                    requesting ||
                    checkingRequest ||
                    (enrollmentComplete && !pending) ||
                    courseId === undefined ||
                    courseId === null
                  }
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold leading-5 text-white shadow-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nuwa-bright focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-12 sm:px-4 sm:py-3 sm:text-sm ${
                    pending
                      ? "bg-danger hover:bg-danger/90"
                      : "bg-nuwa-base hover:bg-nuwa-deep"
                  }`}
                >
                  {requesting ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : checkingRequest ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : pending ? (
                    <X size={17} />
                  ) : enrollmentComplete ? (
                    <CheckCircle2 size={17} />
                  ) : (
                    <Send size={17} />
                  )}
                  {requesting
                    ? pending
                      ? "جارٍ إلغاء الطلب..."
                      : "جارٍ إرسال الطلب..."
                    : checkingRequest
                      ? "جارٍ التحقق من الطلب..."
                      : pending
                        ? "إلغاء الطلب"
                        : enrollmentComplete
                          ? "تم إرسال طلب الالتحاق"
                          : "طلب الالتحاق بالدورة"}
                </button>
                {phone && normalizedPhone ? (
                  <a
                    href={`https://wa.me/${normalizedPhone}?text=${encodeURIComponent(
                      `السلام عليكم، أرغب في الالتحاق بدورة ${titleOf(course)} وإتمام الدفع.`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#16855b] px-3 py-2.5 text-xs font-bold leading-5 text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#116b49] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16855b] focus-visible:ring-offset-2 sm:min-h-12 sm:px-4 sm:py-3 sm:text-sm"
                  >
                    <MessageCircle size={18} />
                    تواصل مع المعلم واتساب
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#16855b] px-3 py-2.5 text-xs font-bold leading-5 text-white opacity-50 sm:min-h-12 sm:px-4 sm:py-3 sm:text-sm"
                  >
                    <MessageCircle size={18} />
                    رقم واتساب غير متاح
                  </button>
                )}
              </div>
              <p className="text-center text-[11px] leading-5 text-ink-muted">
                بعد إرسال طلب الالتحاق، أكمل الدفع مع المعلم عبر واتساب ليعتمد
                اشتراكك.
              </p>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
