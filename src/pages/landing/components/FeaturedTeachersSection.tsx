import { useState } from "react"

import { ArrowLeft } from "lucide-react"

import { motion, useReducedMotion } from "framer-motion"

import { resolveApiAssetUrl } from "../../../api/client"

import type { NavigateFn } from "../../../types"

import { TeacherCardSkeleton } from "./LandingSkeletons"

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : {}
}

function teacherName(record: Record<string, unknown>): string {
  const name =
    record.fullName ??
    record.name ??
    record.displayName ??
    [record.firstName, record.lastName].filter(Boolean).join(" ")

  return typeof name === "string" && name.trim() ? name.trim() : "معلم وَعي"
}

function TeacherCard({
  record,

  navigate,
}: {
  record: Record<string, unknown>

  navigate: NavigateFn
}) {
  const [imageFailed, setImageFailed] = useState(false)

  const id = record.id ?? record.teacherId

  const name = teacherName(record)

  const avatar = asRecord(record.avatar)

  const imageCandidate =
    record.avatarUrl ??
    record.profileImageUrl ??
    record.profile_image_url ??
    record.profileImage ??
    record.imageUrl ??
    (typeof record.avatar === "string" ? record.avatar : undefined) ??
    avatar.url ??
    avatar.src

  const imageUrl = typeof imageCandidate === "string" ? imageCandidate : ""

  const imageSrc = imageUrl && !imageFailed ? resolveApiAssetUrl(imageUrl) : ""

  const rawSubjects = record.subjects ?? record.teachingSubjects

  const subjects = Array.isArray(rawSubjects)
    ? rawSubjects
        .map((subject) => {
          const value = asRecord(subject)

          return String(value.name ?? value.subjectName ?? subject ?? "").trim()
        })
        .filter(Boolean)
    : []

  const primarySubject =
    record.subjectName ??
    record.subject ??
    record.specialization ??
    record.specialty

  if (primarySubject) subjects.unshift(String(primarySubject))

  const uniqueSubjects = [...new Set(subjects)]

  const description = String(
    record.bio ??
      record.description ??
      "خبرة تعليمية تساعدك على الفهم والتقدم بثقة.",
  )

  return (
    <button
      type="button"
      disabled={id === undefined || id === null}
      onClick={() => navigate("teacher:platform", { teacherId: String(id) })}
      aria-label={`عرض ملف ${name}`}
      className="group relative flex min-h-[20rem] flex-col overflow-hidden rounded-2xl border border-stroke bg-surface text-start shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-emerald-300/70 hover:shadow-[0_16px_36px_-24px_rgba(11,59,37,.35)] focus-visible:border-emerald-300/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:cursor-default sm:min-h-[26rem] sm:rounded-3xl"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-700">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={name}
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center pb-24">
            <span className="grid size-28 place-items-center rounded-full border border-white/20 bg-white/10 text-5xl font-bold text-white/90">
              {name.charAt(0)}
            </span>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/45 to-transparent" />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_50%_100%,rgba(52,211,153,.22),transparent_65%)] opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100 group-focus-visible:opacity-100"
      />

      <div className="absolute left-2 top-2 z-10 flex max-w-[70%] flex-wrap gap-1 sm:left-4 sm:top-4 sm:gap-1.5">
        <span
          className="truncate rounded-full border border-white/40 bg-white/90 px-2 py-1 text-[10px] font-bold text-emerald-950 shadow-sm sm:px-3 sm:py-1.5 sm:text-xs"
          title={uniqueSubjects.join("، ") || "التخصص"}
        >
          {uniqueSubjects[0] ?? "معلم على منصة وَعي"}
        </span>
        {uniqueSubjects.length > 1 && (
          <span className="rounded-full border border-white/30 bg-black/35 px-2 py-1 text-[10px] font-bold text-white backdrop-blur sm:px-2.5 sm:py-1.5 sm:text-xs">
            +{uniqueSubjects.length - 1}
          </span>
        )}
      </div>

      {record.courseCount !== undefined && (
        <span className="absolute right-2 top-2 z-10 rounded-full border border-white/25 bg-black/35 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur sm:right-4 sm:top-4 sm:px-3 sm:py-1.5 sm:text-xs">
          {String(record.courseCount)} دورة
        </span>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-emerald-950/90 via-emerald-950/55 to-transparent backdrop-blur-md [mask-image:linear-gradient(to_top,black_60%,transparent)] [-webkit-mask-image:linear-gradient(to_top,black_60%,transparent)]" />

      <div className="relative z-10 mt-auto flex flex-col p-3 text-white sm:p-5">
        <h3 className="text-base font-bold leading-6 sm:text-xl sm:leading-7">
          {name}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/80 sm:mt-2 sm:text-sm sm:leading-7">
          {description}
        </p>
        <span className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/15 py-2 text-xs font-bold text-white opacity-100 ring-1 ring-white/25 backdrop-blur transition-[opacity,transform,background-color,color] duration-300 ease-out sm:mt-4 sm:py-2.5 sm:text-sm sm:translate-y-1 sm:opacity-0 group-hover:translate-y-0 group-hover:bg-white group-hover:text-emerald-950 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:bg-white group-focus-visible:text-emerald-950 group-focus-visible:opacity-100">
          استكشف
          <ArrowLeft size={15} aria-hidden="true" />
        </span>
      </div>
    </button>
  )
}

export default function FeaturedTeachersSection({
  teachers,

  loading,

  navigate,
}: {
  teachers: unknown[]

  loading: boolean

  navigate: NavigateFn
}) {
  const visibleTeachers = teachers.slice(0, 4)
  const reduce = !!useReducedMotion()

  const gridLayout =
    loading || visibleTeachers.length > 2
      ? "lg:grid-cols-4"
      : visibleTeachers.length === 2
        ? "lg:mx-auto lg:max-w-4xl lg:grid-cols-2"
        : "lg:mx-auto lg:max-w-sm lg:grid-cols-1"

  if (!loading && visibleTeachers.length === 0) return null

  return (
    <section className="border-y border-stroke bg-[#f5f8f5] py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <motion.div
            initial={
              reduce ? false : { opacity: 0, y: 22, filter: "blur(8px)" }
            }
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{
              duration: 0.7,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <p className="text-sm font-semibold text-nuwa-base">
              خبرة تقود تعلّمك
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl lg:text-5xl">
              تعرّف على معلمي وَعي
            </h2>
          </motion.div>
          <motion.button
            type="button"
            onClick={() => navigate("public:teachers")}
            initial={reduce ? false : { opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{
              duration: 0.55,
              delay: reduce ? 0 : 0.15,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="inline-flex items-center gap-2 text-sm font-bold text-nuwa-base transition hover:text-nuwa-deep"
          >
            جميع المعلمين
            <ArrowLeft size={16} aria-hidden="true" />
          </motion.button>
        </div>

        <div
          className={`mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 ${gridLayout}`}
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
            ? [0, 1, 2, 3].map((item) => <TeacherCardSkeleton key={item} />)
            : visibleTeachers.map((item, index) => {
                const record = asRecord(item)

                return (
                  <TeacherCard
                    key={String(record.id ?? record.teacherId ?? index)}
                    record={record}
                    navigate={navigate}
                  />
                )
              })}
        </div>
      </div>
    </section>
  )
}
