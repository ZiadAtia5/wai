import type { ReactNode } from "react";

import { BookOpen, GraduationCap } from "lucide-react";

import { resolveApiImageUrl } from "../api/client";

import CourseMetadataBadges from "./CourseMetadataBadges";

import CourseTeacherAvatar from "./CourseTeacherAvatar";

import { formatEgp } from "../utils/currency";

type CourseRecord = Record<string, unknown>;

interface CourseCardProps {
  course: CourseRecord;

  title?: string;

  description?: string;

  subject?: string;

  teacherName?: string;

  statusLabel?: string;

  statusTone?: string;

  footer?: ReactNode;

  children?: ReactNode;

  className?: string;
}

function nestedRecord(value: unknown): CourseRecord {
  return typeof value === "object" && value !== null
    ? (value as CourseRecord)
    : {};
}

export default function CourseCard({
  course,

  title,

  description,

  subject,

  teacherName,

  statusLabel,

  statusTone = "bg-emerald-100 text-emerald-800",

  footer,

  children,

  className = "",
}: CourseCardProps) {
  const resolvedTitle = String(title ?? course.title ?? course.name ?? "دورة");

  const resolvedSubject = String(
    subject ?? course.subjectName ?? nestedRecord(course.subject).name ?? "",
  );

  const resolvedTeacherName = String(
    teacherName ??
      course.teacherName ??
      nestedRecord(course.teacher).fullName ??
      nestedRecord(course.teacher).name ??
      "",
  );

  const coverImage =
    course.coverImageUrl ?? course.imageUrl ?? course.thumbnailUrl;

  const coverUrl =
    typeof coverImage === "string" ? resolveApiImageUrl(coverImage, 640) : "";

  const price = course.price;

  return (
    <article
      className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border border-stroke bg-white shadow-nuwa transition duration-200 hover:-translate-y-0.5 hover:border-nuwa-base/30 hover:shadow-nuwa-md ${className}`}
    >
      <div className="relative h-40 shrink-0 overflow-hidden bg-gradient-to-br from-nuwa-deep via-nuwa-base to-emerald-400 sm:h-44">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            width={640}
            height={360}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <>
            <div className="absolute -left-6 -top-14 size-40 rounded-full border border-white/20" />
            <div className="absolute -left-2 -top-8 size-28 rounded-full border border-white/20" />
            <BookOpen
              size={32}
              className="absolute left-4 top-4 text-white/70"
              aria-hidden="true"
            />
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/70 via-neutral-950/5 to-transparent" />
        {statusLabel && (
          <span
            className={`absolute bottom-3 right-3 rounded-full px-3 py-1.5 text-xs font-bold ${statusTone}`}
          >
            {statusLabel}
          </span>
        )}
        {price !== undefined && price !== null && (
          <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-nuwa-deep shadow-sm">
            {Number(price) === 0 ? "مجانية" : formatEgp(price)}
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
        {resolvedSubject && (
          <span className="mb-2 inline-flex w-fit max-w-full items-center gap-1.5 rounded-full bg-nuwa-soft px-2.5 py-1 text-[11px] font-semibold text-nuwa-deep">
            <GraduationCap size={13} aria-hidden="true" />
            <span className="truncate">{resolvedSubject}</span>
          </span>
        )}
        <CourseMetadataBadges course={course} />
        <h3 className="line-clamp-2 min-h-12 text-base font-bold leading-6 text-ink sm:text-lg">
          {resolvedTitle}
        </h3>
        <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-ink-muted">
          {String(
            description ?? course.description ?? "لا يوجد وصف مضاف للدورة.",
          )}
        </p>

        {resolvedTeacherName && (
          <div className="mt-4 flex min-w-0 items-center gap-2.5 border-t border-stroke/70 pt-3">
            <CourseTeacherAvatar course={course} name={resolvedTeacherName} />
            <span className="min-w-0 truncate text-xs font-semibold text-ink-muted">
              {resolvedTeacherName}
            </span>
          </div>
        )}

        {footer}
        {children && (
          <div className="mt-4 border-t border-stroke/70 pt-3">{children}</div>
        )}
      </div>
    </article>
  );
}
