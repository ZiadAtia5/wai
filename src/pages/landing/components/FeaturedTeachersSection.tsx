import { useState } from "react";

import { ArrowLeft, BadgeCheck, GraduationCap } from "lucide-react";

import { resolveApiAssetUrl } from "../../../api/client";

import type { NavigateFn } from "../../../types";
import { TeacherCardSkeleton } from "./LandingSkeletons";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function teacherName(record: Record<string, unknown>): string {
  const name =
    record.fullName ??
    record.name ??
    record.displayName ??
    [record.firstName, record.lastName].filter(Boolean).join(" ");

  return typeof name === "string" && name.trim() ? name.trim() : "معلم وَعي";
}

function TeacherCard({
  record,

  navigate,
}: {
  record: Record<string, unknown>;

  navigate: NavigateFn;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  const id = record.id ?? record.teacherId;

  const name = teacherName(record);

  const avatar = asRecord(record.avatar);

  const imageCandidate =
    record.avatarUrl ??
    record.profileImageUrl ??
    record.profile_image_url ??
    record.profileImage ??
    record.imageUrl ??
    (typeof record.avatar === "string" ? record.avatar : undefined) ??
    avatar.url ??
    avatar.src;

  const imageUrl = typeof imageCandidate === "string" ? imageCandidate : "";

  const imageSrc = imageUrl && !imageFailed ? resolveApiAssetUrl(imageUrl) : "";

  const subject = String(
    record.specialty ??
      record.specialization ??
      record.subjectName ??
      record.subject ??
      "معلم متخصص",
  );

  const description = String(
    record.bio ??
      record.description ??
      "خبرة تعليمية تساعدك على الفهم والتقدم بثقة.",
  );

  return (
    <button
      type="button"
      disabled={id === undefined || id === null}
      onClick={() => navigate("teacher:platform", { teacherId: String(id) })}
      aria-label={`عرض ملف ${name}`}
      className="group overflow-hidden rounded-xl border border-stroke bg-white text-start shadow-nuwa transition duration-300 hover:-translate-y-1 hover:border-nuwa-bright hover:shadow-nuwa-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nuwa-base disabled:cursor-default"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#e5eee7]">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={name}
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            className="size-full object-cover object-center transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(145deg,#e4f0e7,#cddfd2)]" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-nuwa-deep/60 to-transparent" />
        <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg border border-white/60 bg-white/95 px-2.5 py-1.5 text-[11px] font-bold text-nuwa-deep shadow-sm">
          <BadgeCheck size={14} className="text-nuwa-base" aria-hidden="true" />
          معلم وَعي
        </span>
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 text-xs font-semibold text-white">
          <GraduationCap size={15} aria-hidden="true" />
          {subject}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <span className="block truncate text-base font-bold text-ink sm:text-lg">
          {name}
        </span>
        <span className="mt-2 block min-h-12 text-sm leading-6 text-ink-muted line-clamp-2">
          {description}
        </span>
        <span className="mt-4 flex items-center justify-between border-t border-stroke pt-3 text-sm font-bold text-nuwa-base">
          عرض الملف التعليمي
          <span className="grid size-8 place-items-center rounded-full bg-nuwa-soft transition group-hover:bg-nuwa-base group-hover:text-white">
            <ArrowLeft size={16} aria-hidden="true" />
          </span>
        </span>
      </div>
    </button>
  );
}

export default function FeaturedTeachersSection({
  teachers,

  loading,

  navigate,
}: {
  teachers: unknown[];

  loading: boolean;

  navigate: NavigateFn;
}) {
  const visibleTeachers = teachers.slice(0, 4);

  const gridLayout =
    loading || visibleTeachers.length > 2
      ? "lg:grid-cols-4"
      : visibleTeachers.length === 2
        ? "lg:mx-auto lg:max-w-4xl lg:grid-cols-2"
        : "lg:mx-auto lg:max-w-sm lg:grid-cols-1";

  if (!loading && visibleTeachers.length === 0) return null;

  return (
    <section className="border-y border-stroke bg-[#f5f8f5] py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-nuwa-base">
              خبرة تقود تعلّمك
            </p>
            <h2 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">
              تعرّف على معلمي وَعي
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate("public:teachers")}
            className="inline-flex items-center gap-2 text-sm font-bold text-nuwa-base transition hover:text-nuwa-deep"
          >
            جميع المعلمين
            <ArrowLeft size={16} aria-hidden="true" />
          </button>
        </div>

        <div
          className={`mt-7 grid gap-4 sm:grid-cols-2 ${gridLayout}`}
          style={{
            maxWidth:
              loading || visibleTeachers.length > 2
                ? undefined
                : visibleTeachers.length === 2
                  ? "56rem"
                  : "24rem",

            marginInline: "auto",
          }}
        >
          {loading
            ? [0, 1, 2, 3].map((item) => (
                <TeacherCardSkeleton key={item} />
              ))
            : visibleTeachers.map((item, index) => {
                const record = asRecord(item);

                return (
                  <TeacherCard
                    key={String(record.id ?? record.teacherId ?? index)}
                    record={record}
                    navigate={navigate}
                  />
                );
              })}
        </div>
      </div>
    </section>
  );
}
