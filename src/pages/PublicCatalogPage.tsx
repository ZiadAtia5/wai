import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LoaderCircle,
  MessageCircle,
  Phone,
  X,
} from "lucide-react"

import { AnimatePresence, motion } from "framer-motion"

import { ApiError, resolveApiAssetUrl } from "../api/client"

import { getAuthToken } from "../api/client"

import { studentsApi, teachersApi } from "../api/endpoints"

import {
  getAcademicYears,
  type AcademicYearResponse,
  type ApiRecord,
  type PagedResult,
} from "../api/catalog"

import ApiQueryState from "../components/ApiQueryState"

import SearchBar from "../components/SearchBar"

import PersonAvatar from "../components/PersonAvatar"

import CourseMetadataBadges from "../components/CourseMetadataBadges"

import CourseTeacherAvatar from "../components/CourseTeacherAvatar"

import { Skeleton, SkeletonText } from "../components/Skeleton"

import { CatalogGridSkeleton } from "../components/loading/SkeletonLayouts"

import {
  staggerContainerVariants,
  staggerItemVariants,
} from "../components/motion/PageTransition"

import { useApiQuery } from "../hooks/useApiQuery"

import type { NavigateFn } from "../types"

import { formatEgp } from "../utils/currency"

import { notifyError, notifySuccess } from "../utils/notifications"

interface PublicCatalogPageProps {
  title: string

  description: string

  emptyMessage: string

  load: (
    page?: number,

    pageSize?: number,

    search?: string,

    academicYear?: string,
  ) => Promise<PagedResult<ApiRecord>>

  loadDetail?: (id: string) => Promise<unknown>

  loadRelated?: (id: string) => Promise<unknown>

  action?: (id: string) => Promise<unknown>

  actionLabel?: string

  navigate?: NavigateFn

  personCards?: boolean

  courseCatalog?: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null
}

function titleOf(record: Record<string, unknown>): string {
  return String(
    record.title ??
      record.fullName ??
      record.name ??
      record.teacherName ??
      record.email ??
      "عنصر من المنصة",
  )
}

function personNameOf(record: Record<string, unknown>): string {
  const fullName =
    record.fullName ??
    record.name ??
    record.teacherName ??
    [record.firstName, record.lastName].filter(Boolean).join(" ")

  return typeof fullName === "string" && fullName.trim()
    ? fullName.trim()
    : "معلم"
}

function personBioOf(record: Record<string, unknown>): string {
  const bio = record.bio ?? record.description

  return typeof bio === "string" ? bio : ""
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-"

  return typeof value === "object" ? JSON.stringify(value) : String(value)
}

function teacherNameOf(record: Record<string, unknown>): string | null {
  const nested = asRecord(record.teacher)

  const value =
    record.teacherName ??
    record.instructorName ??
    nested?.fullName ??
    nested?.name ??
    asRecord(record.instructor)?.fullName ??
    asRecord(record.instructor)?.name

  return typeof value === "string" && value.trim() ? value.trim() : null
}

function nestedRecord(
  record: Record<string, unknown>,

  key: string,
): Record<string, unknown> {
  return asRecord(record[key]) ?? {}
}

function teacherPhoneOf(record: Record<string, unknown>): string {
  const queue = [record]

  const visited = new Set<Record<string, unknown>>()

  const nestedKeys = [
    "teacher",

    "instructor",

    "teacherProfile",

    "instructorProfile",

    "profile",

    "user",

    "owner",
  ]

  while (queue.length && visited.size < 12) {
    const candidate = queue.shift()

    if (!candidate || visited.has(candidate)) continue

    visited.add(candidate)

    for (const key of [
      "teacherPhoneNumber",
      "instructorPhoneNumber",
      "whatsappPhoneNumber",

      "whatsAppPhoneNumber",

      "whatsappNumber",

      "whatsAppNumber",

      "phoneNumber",

      "phone",

      "mobileNumber",

      "mobile",
    ]) {
      const value = candidate[key]

      if (
        (typeof value === "string" || typeof value === "number") &&
        String(value).trim()
      ) {
        return String(value).trim()
      }
    }

    for (const key of nestedKeys) {
      const nested = asRecord(candidate[key])

      if (nested) queue.push(nested)
    }
  }

  return ""
}

function teacherIdOf(record: Record<string, unknown>): string {
  const teacher =
    Object.keys(nestedRecord(record, "teacher")).length > 0
      ? nestedRecord(record, "teacher")
      : nestedRecord(record, "instructor")

  const id =
    record.teacherId ??
    record.instructorId ??
    teacher.id ??
    teacher.teacherId ??
    teacher.userId

  return id === undefined || id === null ? "" : String(id).trim()
}

function whatsappPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "")

  if (digits.startsWith("00")) digits = digits.slice(2)

  if (digits.startsWith("0")) digits = `20${digits.slice(1)}`

  return digits
}

function unwrapApiResponse(value: unknown): unknown {
  let current = value

  for (let depth = 0; depth < 5; depth += 1) {
    const response = asRecord(current)

    if (!response || !("data" in response)) break

    current = response.data
  }

  return current
}

function scalarFields(record: Record<string, unknown>): [string, unknown][] {
  return Object.entries(record).filter(
    ([key, value]) =>
      !/(^id$|id$|token|image|url|createdAt|updatedAt)/i.test(key) &&
      key !== "description" &&
      value !== null &&
      ["string", "number", "boolean"].includes(typeof value),
  )
}

function normalizeArabic(value: string): string {
  return value

    .normalize("NFD")

    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")

    .replace(/[أإآ]/g, "ا")

    .replace(/ى/g, "ي")

    .replace(/ة/g, "ه")

    .toLocaleLowerCase("ar")

    .trim()
}

function subjectValues(record: Record<string, unknown>): string[] {
  const subjects = record.subjects ?? record.teachingSubjects

  const values = Array.isArray(subjects)
    ? subjects.map((subject) => {
        const nested = asRecord(subject)

        return String(nested?.name ?? nested?.subjectName ?? subject ?? "")
      })
    : []

  const primary =
    record.subjectName ??
    record.subject ??
    record.specialization ??
    record.specialty

  if (primary) values.unshift(String(primary))

  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function highlightMatch(text: string, query: string) {
  const normalizedQuery = normalizeArabic(query)

  if (!normalizedQuery) return text

  let normalizedText = ""

  const sourcePositions: number[] = []

  const sourceEnds: number[] = []

  let sourceOffset = 0

  Array.from(text).forEach((character) => {
    const normalizedCharacter = normalizeArabic(character)

    for (const part of normalizedCharacter) {
      normalizedText += part

      sourcePositions.push(sourceOffset)

      sourceEnds.push(sourceOffset + character.length)
    }

    sourceOffset += character.length
  })

  const matchIndex = normalizedText.indexOf(normalizedQuery)

  if (matchIndex < 0) return text

  const start = sourcePositions[matchIndex]

  const end = sourceEnds[matchIndex + normalizedQuery.length - 1]

  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded bg-nuwa-soft px-0.5 text-inherit">
        {text.slice(start, end)}
      </mark>
      {text.slice(end)}
    </>
  )
}

export default function PublicCatalogPage({
  title,

  description,

  emptyMessage,

  load,

  loadDetail,

  loadRelated,

  action,

  actionLabel,

  navigate,

  personCards = false,

  courseCatalog = false,
}: PublicCatalogPageProps) {
  const [page, setPage] = useState(1)

  const [reloadKey, setReloadKey] = useState(0)

  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)

  const [related, setRelated] = useState<unknown>(null)

  const [, setActionMessage] = useState("")

  const [actionLoading, setActionLoading] = useState(false)

  const [contactCourse, setContactCourse] =
    useState<Record<string, unknown> | null>(null)

  const [contactPhone, setContactPhone] = useState("")

  const [contactLoading, setContactLoading] = useState(false)

  const [contactError, setContactError] = useState("")

  const [contactRequestSent, setContactRequestSent] = useState(false)

  const [contactRequestLoading, setContactRequestLoading] = useState(false)

  const [contactRequestMessage, setContactRequestMessage] = useState("")

  const contactRequestId = useRef(0)

  function closeEnrollmentContact() {
    contactRequestId.current += 1
    setContactCourse(null)
    setContactLoading(false)
  }

  useEffect(() => {
    if (!contactCourse) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeEnrollmentContact()
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [contactCourse])

  const [searchInput, setSearchInput] = useState(
    () =>
      new URLSearchParams(window.location.search).get("search")?.trim() ?? "",
  )

  const [search, setSearch] = useState(
    () =>
      new URLSearchParams(window.location.search).get("search")?.trim() ?? "",
  )

  const [subjectFilter, setSubjectFilter] = useState("")

  const [academicYear, setAcademicYear] = useState("")

  const [academicYears, setAcademicYears] = useState<AcademicYearResponse[]>([])

  const [academicYearsLoading, setAcademicYearsLoading] = useState(false)

  const [relatedLoading, setRelatedLoading] = useState(false)

  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(
    () => new Set(),
  )

  const [enrollmentChecked, setEnrollmentChecked] = useState(false)

  useEffect(() => {
    const role = window.sessionStorage.getItem("eduhub.auth.role") ?? ""

    if (!action || !role.includes("student") || !getAuthToken()) {
      setEnrollmentChecked(true)

      return
    }

    let active = true

    studentsApi

      .enrollments({ page: 1, pageSize: 100 })

      .then((response) => {
        if (!active) return

        const root = asRecord(response)

        const nested = asRecord(root?.data)

        const items = Array.isArray(response)
          ? response
          : Array.isArray(root?.items)
            ? root.items
            : Array.isArray(root?.enrollments)
              ? root.enrollments
              : Array.isArray(root?.data)
                ? root.data
                : Array.isArray(nested?.items)
                  ? nested.items
                  : Array.isArray(nested?.enrollments)
                    ? nested.enrollments
                    : []

        const ids = items.flatMap((item) => {
          const record = asRecord(item)

          const course = asRecord(record?.course)

          const id = record?.courseId ?? course?.id

          return id === undefined || id === null ? [] : [String(id)]
        })

        setEnrolledCourseIds(new Set(ids))
      })

      .catch(() => undefined)

      .finally(() => {
        if (active) setEnrollmentChecked(true)
      })

    return () => {
      active = false
    }
  }, [action])

  useEffect(() => {
    if (personCards) return

    let active = true

    setAcademicYearsLoading(true)

    getAcademicYears()

      .then((years) => {
        if (active) setAcademicYears(years)
      })

      .catch(() => undefined)

      .finally(() => {
        if (active) setAcademicYearsLoading(false)
      })

    return () => {
      active = false
    }
  }, [personCards])

  const pageLoader = useCallback(
    () => load(page, personCards ? 3 : 12, search, academicYear),

    [load, page, personCards, search, academicYear],
  )

  const catalogCacheKey =
    personCards || courseCatalog
      ? `${
          personCards ? "public-teachers" : "public-courses"
        }:${page}:${search}:${academicYear}`
      : undefined

  const { data, error, loading } = useApiQuery(
    pageLoader,

    reloadKey,

    true,

    catalogCacheKey,
  )

  const filterOptions = useMemo(() => {
    if (personCards) {
      const values = (data?.items ?? []).flatMap((item) => {
        const record = asRecord(item)

        return record ? subjectValues(record) : []
      })

      return [...new Set(values)].map((value) => ({ value, label: value }))
    }

    return academicYears.map((year) => ({
      value: String(year.value),

      label: year.arabicName,
    }))
  }, [academicYears, data, personCards])

  const visibleItems = useMemo(() => {
    const query = normalizeArabic(search)

    const filteredItems = (data?.items ?? []).filter((item) => {
      const record = asRecord(item)

      if (!record) return false

      if (
        personCards &&
        subjectFilter &&
        !subjectValues(record).some((subject) => subject === subjectFilter)
      ) {
        return false
      }

      const year = String(record.academicYear ?? record.grade ?? "")

      const selectedYearLabel = filterOptions.find(
        (option) => option.value === academicYear,
      )?.label

      if (
        !personCards &&
        academicYear &&
        year !== academicYear &&
        year !== selectedYearLabel
      ) {
        return false
      }

      if (!query) return true

      const searchable = [
        titleOf(record),

        personNameOf(record),

        personBioOf(record),

        String(record.description ?? record.bio ?? ""),

        String(record.email ?? ""),

        ...subjectValues(record),
      ]

      return searchable.some((value) => normalizeArabic(value).includes(query))
    })

    if (!courseCatalog || enrolledCourseIds.size === 0) return filteredItems

    return filteredItems.sort((first, second) => {
      const firstRecord = asRecord(first)
      const secondRecord = asRecord(second)
      const firstId = firstRecord?.id ?? firstRecord?.courseId
      const secondId = secondRecord?.id ?? secondRecord?.courseId
      const firstEnrolled =
        firstId !== undefined &&
        firstId !== null &&
        enrolledCourseIds.has(String(firstId))
      const secondEnrolled =
        secondId !== undefined &&
        secondId !== null &&
        enrolledCourseIds.has(String(secondId))

      return Number(secondEnrolled) - Number(firstEnrolled)
    })
  }, [
    academicYear,
    courseCatalog,
    data,
    enrolledCourseIds,
    filterOptions,
    personCards,
    search,
    subjectFilter,
  ])

  async function selectRecord(item: ApiRecord) {
    const record = asRecord(item)

    if (!record) return

    setDetail(record)

    setRelated(null)

    setActionMessage("")

    if (record.id === undefined || record.id === null) {
      setRelatedLoading(false)

      return
    }

    setRelatedLoading(Boolean(loadRelated))

    try {
      const id = String(record.id)

      if (loadDetail) {
        const result = asRecord(await loadDetail(id))

        if (result) setDetail(result)
      }

      if (loadRelated) setRelated(await loadRelated(id))
    } catch (cause) {
      notifyError(cause, "تعذر تحميل التفاصيل.")

      setActionMessage(
        cause instanceof ApiError ? cause.message : "تعذر تحميل التفاصيل.",
      )
    } finally {
      setRelatedLoading(false)
    }
  }

  async function openEnrollmentContact(
    course: Record<string, unknown>,
  ): Promise<void> {
    const requestId = ++contactRequestId.current
    setContactCourse(course)
    const courseId = course.id ?? course.courseId
    setContactRequestSent(
      courseId !== undefined &&
        courseId !== null &&
        enrollmentChecked &&
        enrolledCourseIds.has(String(courseId)),
    )
    setContactRequestMessage("")

    setContactError("")

    const listedPhone = teacherPhoneOf(course)

    setContactPhone(listedPhone)

    if (listedPhone) {
      setContactLoading(false)

      return
    }

    setContactLoading(true)

    let resolvedCourse = course

    let detailError: unknown = null

    let lookupError = ""

    try {
      const courseId = course.id ?? course.courseId

      if (loadDetail && courseId !== undefined && courseId !== null) {
        const detailResponse = await loadDetail(String(courseId))
        if (requestId !== contactRequestId.current) return

        const detailRecord = asRecord(unwrapApiResponse(detailResponse))

        if (detailRecord) {
          const nestedCourse =
            asRecord(detailRecord.course) ??
            asRecord(detailRecord.courseDetails) ??
            detailRecord

          resolvedCourse = { ...course, ...nestedCourse }

          setContactCourse(resolvedCourse)
        }
      }
    } catch (cause) {
      detailError = cause
    }

    let phone = teacherPhoneOf(resolvedCourse)

    if (!phone) {
      const teacherId = teacherIdOf(resolvedCourse)

      if (teacherId) {
        try {
          const teacherResponse = await teachersApi.byId(teacherId)
          if (requestId !== contactRequestId.current) return

          const teacherRecord = asRecord(unwrapApiResponse(teacherResponse))

          if (teacherRecord) {
            phone = teacherPhoneOf(teacherRecord)

            resolvedCourse = {
              ...resolvedCourse,

              teacher: teacherRecord,
            }

            setContactCourse(resolvedCourse)
          }
        } catch (cause) {
          if (requestId !== contactRequestId.current) return
          lookupError =
            cause instanceof Error
              ? cause.message
              : "تعذر تحميل رقم تواصل المعلم."
        }
      }
    }

    if (requestId !== contactRequestId.current) return

    setContactPhone(phone)

    if (!phone) {
      if (lookupError) {
        setContactError(lookupError)
      } else if (detailError && !teacherIdOf(resolvedCourse)) {
        setContactError(
          detailError instanceof Error
            ? detailError.message
            : "تعذر تحميل بيانات التواصل الخاصة بالدورة.",
        )
      }
    }

    setContactLoading(false)
  }

  async function requestContactEnrollment(): Promise<void> {
    const courseId = contactCourse?.id ?? contactCourse?.courseId

    if (
      courseId === undefined ||
      courseId === null ||
      !action ||
      contactRequestLoading
    ) {
      return
    }

    if (contactRequestSent) {
      setContactRequestMessage(
        "تم إرسال طلبك بالفعل. تواصل مع المعلم عبر واتساب لإتمام الدفع.",
      )
      return
    }

    if (!getAuthToken()) {
      setContactRequestMessage(
        "سجّل الدخول بحساب الطالب أولًا لإرسال طلب الالتحاق.",
      )
      navigate?.("login")
      return
    }

    const role = (
      window.sessionStorage.getItem("eduhub.auth.role") ?? ""
    ).toLowerCase()

    if (!role.includes("student")) {
      const message = "طلب الالتحاق متاح لحساب الطالب فقط."
      setContactRequestMessage(message)
      notifyError(new Error(message))
      return
    }

    setContactRequestLoading(true)
    setContactRequestMessage("")

    try {
      await action(String(courseId))
      setContactRequestSent(true)
      setEnrolledCourseIds((current) => new Set(current).add(String(courseId)))
      setContactRequestMessage(
        "تم إرسال طلبك للمعلم. تواصل معه عبر واتساب لإتمام الدفع، وسيعتمد اشتراكك بعد تأكيد الدفع.",
      )
      notifySuccess("تم إرسال طلب الالتحاق بنجاح.")
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ""
      const duplicate =
        (cause instanceof ApiError && cause.status === 409) ||
        /already|duplicate|enrolled|enrollment|مسجل|التحاق|مكرر/i.test(message)

      if (duplicate) {
        setContactRequestSent(true)
        setEnrolledCourseIds((current) =>
          new Set(current).add(String(courseId)),
        )
        setContactRequestMessage(
          "لديك طلب التحاق مسجل بالفعل. تواصل مع المعلم عبر واتساب لإتمام الدفع، وسيعتمد اشتراكك بعد تأكيد الدفع.",
        )
        return
      }

      setContactRequestMessage(message || "تعذر إرسال طلب الالتحاق.")
      notifyError(cause, "تعذر إرسال طلب الالتحاق.")
    } finally {
      setContactRequestLoading(false)
    }
  }

  async function runAction() {
    if (courseCatalog) {
      if (detail) void openEnrollmentContact(detail)

      return
    }

    if (!action || detail?.id === undefined || detail.id === null) return

    const courseId = String(detail.id)

    if (enrolledCourseIds.has(courseId)) {
      setActionMessage("أنت مسجل بالفعل في هذه الدورة.")

      return
    }

    if (!getAuthToken()) {
      notifyError(new Error("يجب تسجيل الدخول أولاً لإرسال طلب الالتحاق."))

      setActionMessage("سجّل الدخول أولاً لإرسال طلب الالتحاق.")

      navigate?.("login")

      return
    }

    if (
      courseCatalog &&
      !(window.sessionStorage.getItem("eduhub.auth.role") ?? "")

        .toLowerCase()

        .includes("student")
    ) {
      const message = "طلب الالتحاق بالدورات متاح لحساب الطالب فقط."

      notifyError(new Error(message))

      setActionMessage(message)

      return
    }

    if (actionLoading) return

    setActionLoading(true)

    try {
      await action(courseId)

      setEnrolledCourseIds((current) => new Set(current).add(courseId))

      notifySuccess("تم إرسال طلب الالتحاق بنجاح.")

      setActionMessage("تم إرسال طلب الالتحاق بنجاح.")
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ""

      const duplicate =
        (cause instanceof ApiError && cause.status === 409) ||
        /already|duplicate|enrolled|enrollment|مسجل|التحاق|مكرر/i.test(message)

      if (duplicate) {
        setEnrolledCourseIds((current) => new Set(current).add(courseId))

        setActionMessage("أنت مسجل بالفعل في هذه الدورة.")

        notifySuccess("أنت مسجل بالفعل في هذه الدورة.")

        return
      }

      notifyError(cause, "تعذر إرسال طلب الالتحاق.")

      setActionMessage(
        cause instanceof Error ? cause.message : "تعذر تنفيذ الطلب.",
      )
    } finally {
      setActionLoading(false)
    }
  }

  const relatedItems = Array.isArray(related)
    ? related
    : asRecord(related) && Array.isArray(asRecord(related)?.items)
      ? asRecord(related)?.items as unknown[]
      : []

  const detailFields = detail ? scalarFields(detail) : []

  const catalogHeader = courseCatalog || personCards

  const disableEntryAnimations = catalogHeader

  const resultCount = subjectFilter
    ? visibleItems.length
    : (data?.totalCount ?? visibleItems.length)

  const contactWhatsappPhone = whatsappPhone(contactPhone)

  const submitSearch = () => {
    const nextSearch = searchInput.trim()

    setPage(1)

    setSearch(nextSearch)

    setDetail(null)

    navigate?.(personCards ? "public:teachers" : "public:courses", {
      search: nextSearch,
    })
  }

  const clearCatalogSearch = () => {
    setSearchInput("")

    setSearch("")

    setAcademicYear("")

    setSubjectFilter("")

    setPage(1)

    setDetail(null)

    navigate?.(personCards ? "public:teachers" : "public:courses", {
      search: "",
    })
  }

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <header
        className={
          catalogHeader
            ? "px-4 pt-5 sm:px-6 lg:px-8"
            : "border-b border-stroke bg-surface"
        }
      >
        <motion.div
          className={`relative mx-auto ${
            catalogHeader
              ? "isolate max-w-7xl overflow-hidden rounded-[32px] border border-emerald-800/20 px-5 py-6 text-white shadow-xl shadow-emerald-950/10 sm:px-8 sm:py-7 md:px-10 md:py-8"
              : "max-w-360 px-6 py-8 md:px-10"
          }`}
        >
          {catalogHeader && (
            <motion.div
              aria-hidden="true"
              initial={disableEntryAnimations ? false : { y: 12 }}
              animate={disableEntryAnimations ? undefined : { y: 0 }}
              transition={{
                type: "tween",

                duration: 0.38,

                ease: [0.22, 1, 0.36, 1],
              }}
              className="absolute inset-0 -z-10 rounded-[32px] bg-gradient-to-l from-[#0b3b25] via-emerald-900 to-[#176b43]"
            />
          )}
          {catalogHeader && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-20 left-8 -z-10 size-48 rounded-full border border-white/10 sm:left-16"
            />
          )}
          {catalogHeader && (
            <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-50">
              {personCards ? (
                <>
                  <GraduationCap size={15} /> معلمو منصة وَعي
                </>
              ) : (
                <>
                  <BookOpen size={15} /> تعلّم على وتيرتك
                </>
              )}
            </span>
          )}
          <div className="flex flex-wrap items-center justify-between gap-4 sm:gap-6">
            <div>
              <h1
                className={`mb-1 font-bold tracking-tight ${
                  catalogHeader ? "text-2xl md:text-3xl" : "text-2xl text-ink"
                }`}
              >
                {title}
              </h1>
              <p
                className={`max-w-2xl text-sm leading-6 ${
                  catalogHeader ? "text-emerald-50/80" : "text-ink-muted"
                }`}
              >
                {description}
              </p>
            </div>
            {catalogHeader && loading && !data && (
              <div
                aria-busy="true"
                className="inline-flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5"
              >
                <Skeleton className="h-7 w-14 bg-white/25" />
                <Skeleton className="h-3 w-20 bg-white/20" />
              </div>
            )}
            {catalogHeader && data && !error && (
              <div className="inline-flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5">
                <strong className="text-2xl leading-none">
                  {data.totalCount}
                </strong>
                <span className="text-xs text-emerald-50/75">
                  {personCards ? "معلم مسجل" : "دورة متاحة"}
                </span>
              </div>
            )}
          </div>
          {!catalogHeader && loading && <Skeleton className="mt-3 h-4 w-40" />}
          {!catalogHeader && data && !error && (
            <p className="mt-3 text-xs text-ink-muted" aria-live="polite">
              إجمالي النتائج : {data.totalCount}
            </p>
          )}
        </motion.div>
      </header>

      <main
        className={`mx-auto min-w-0 px-4 py-6 sm:px-6 sm:py-8 md:px-10 ${
          catalogHeader ? "max-w-7xl" : "max-w-360"
        }`}
      >
        <motion.div
          variants={staggerItemVariants}
          initial={disableEntryAnimations ? false : "hidden"}
          animate={disableEntryAnimations ? undefined : "visible"}
          className="-mx-4 mb-7 border-y border-stroke/40 bg-canvas px-4 py-3 sm:-mx-6 sm:px-6 md:-mx-10 md:px-10"
        >
          <div className="mx-auto max-w-360">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <SearchBar
                  value={searchInput}
                  onChange={(value) => {
                    setSearchInput(value)

                    if (!value.trim()) {
                      setSearch("")

                      setPage(1)

                      setDetail(null)

                      navigate?.(
                        personCards ? "public:teachers" : "public:courses",

                        { search: "" },
                      )
                    }
                  }}
                  onSubmit={submitSearch}
                  label={personCards ? "البحث عن معلم" : "البحث عن دورة"}
                  placeholder={
                    personCards
                      ? "ابحث باسم المعلم أو تخصصه"
                      : "ابحث عن دورة أو مادة أو معلم"
                  }
                />
              </div>
              <motion.span
                key={resultCount}
                initial={
                  disableEntryAnimations ? false : { opacity: 0.5, scale: 0.94 }
                }
                animate={
                  disableEntryAnimations ? undefined : { opacity: 1, scale: 1 }
                }
                aria-live="polite"
                className="shrink-0 text-xs font-semibold text-ink-muted sm:text-sm"
              >
                {loading && data
                  ? "جارٍ التحديث..."
                  : `${resultCount} ${personCards ? "معلم" : "دورة"}`}
              </motion.span>
            </div>
            {catalogHeader && (
              <div className="mt-3 flex items-center gap-3">
                <div
                  aria-busy={!personCards && academicYearsLoading}
                  className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible"
                >
                  <motion.button
                    type="button"
                    aria-pressed={!academicYear && !subjectFilter}
                    whileTap={
                      disableEntryAnimations ? undefined : { scale: 0.97 }
                    }
                    onClick={() => {
                      setAcademicYear("")

                      setSubjectFilter("")
                    }}
                    className={`relative isolate min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors ${
                      !academicYear && !subjectFilter
                        ? "text-nuwa-deep"
                        : "bg-white/75 text-ink-muted hover:text-nuwa-base"
                    }`}
                  >
                    {!academicYear && !subjectFilter && (
                      <motion.span
                        layoutId={
                          disableEntryAnimations
                            ? undefined
                            : `catalog-filter-${
                                personCards ? "teachers" : "courses"
                              }`
                        }
                        className="absolute inset-0 z-0 rounded-full bg-nuwa-soft"
                        transition={{
                          type: "spring",

                          stiffness: 420,

                          damping: 34,
                        }}
                      />
                    )}
                    <span className="relative z-10">الكل</span>
                  </motion.button>
                  {filterOptions.map((option) => {
                    const selected = personCards
                      ? subjectFilter === option.value
                      : academicYear === option.value

                    return (
                      <motion.button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        whileTap={
                          disableEntryAnimations ? undefined : { scale: 0.97 }
                        }
                        onClick={() => {
                          if (personCards) setSubjectFilter(option.value)
                          else {
                            setAcademicYear(option.value)

                            setPage(1)
                          }

                          setDetail(null)
                        }}
                        className={`relative isolate min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors ${
                          selected
                            ? "text-nuwa-deep"
                            : "bg-white/75 text-ink-muted hover:text-nuwa-base"
                        }`}
                      >
                        {selected && (
                          <motion.span
                            layoutId={
                              disableEntryAnimations
                                ? undefined
                                : `catalog-filter-${
                                    personCards ? "teachers" : "courses"
                                  }`
                            }
                            className="absolute inset-0 z-0 rounded-full bg-nuwa-soft"
                            transition={{
                              type: "spring",

                              stiffness: 420,

                              damping: 34,
                            }}
                          />
                        )}
                        <span className="relative z-10">{option.label}</span>
                      </motion.button>
                    )
                  })}
                </div>
                {(searchInput || academicYear || subjectFilter) && (
                  <motion.button
                    type="button"
                    whileTap={
                      disableEntryAnimations ? undefined : { scale: 0.97 }
                    }
                    onClick={() => {
                      clearCatalogSearch()
                    }}
                    className="min-h-10 shrink-0 rounded-full px-3 text-xs font-semibold text-nuwa-base transition hover:bg-nuwa-soft"
                  >
                    مسح الكل
                  </motion.button>
                )}
              </div>
            )}
          </div>
        </motion.div>
        {detail && (
          <section
            className={`mb-8 overflow-hidden rounded-[28px] border border-stroke bg-surface shadow-lg shadow-slate-900/5 ${
              courseCatalog ? "" : "p-5"
            }`}
            aria-live="polite"
          >
            {courseCatalog && (
              <div className="relative flex min-h-44 items-end overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-700 px-6 py-7 text-white md:min-h-56 md:px-9">
                {String(
                  detail.coverImageUrl ??
                    detail.thumbnailUrl ??
                    detail.imageUrl ??
                    "",
                ) && (
                  <img
                    src={resolveApiAssetUrl(
                      String(
                        detail.coverImageUrl ??
                          detail.thumbnailUrl ??
                          detail.imageUrl,
                      ),
                    )}
                    alt=""
                    className="absolute inset-0 size-full object-cover opacity-30"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 to-transparent" />
                <div className="relative z-10 max-w-3xl">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur">
                    <GraduationCap size={15} /> تفاصيل الدورة
                  </span>
                  <h2 className="mt-3 text-2xl font-bold leading-tight md:text-3xl">
                    {titleOf(detail)}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDetail(null)

                    setRelated(null)
                  }}
                  className="absolute left-5 top-5 z-10 inline-flex h-10 items-center gap-2 rounded-full border border-white/25 bg-black/15 px-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
                >
                  إغلاق <ArrowLeft size={16} />
                </button>
              </div>
            )}
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stroke pb-4">
              <div>
                {personCards && (
                  <div className="flex items-center gap-4">
                    <PersonAvatar
                      name={personNameOf(detail)}
                      imageUrl={String(
                        detail.avatarUrl ??
                          detail.profileImageUrl ??
                          detail.imageUrl ??
                          "",
                      )}
                      size="lg"
                    />
                    <div>
                      <p className="text-xs font-semibold text-nuwa-base">
                        معلم في منصة وَعي
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-ink">
                        {personNameOf(detail)}
                      </h2>
                    </div>
                  </div>
                )}
                {!courseCatalog && !personCards && (
                  <>
                    <p className="text-xs font-semibold text-nuwa-base">
                      التفاصيل
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-ink">
                      {titleOf(detail)}
                    </h2>
                  </>
                )}
                {courseCatalog && (
                  <div className="flex flex-wrap gap-2">
                    {detail.academicYear != null && (
                      <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900">
                        {String(detail.academicYear)}
                      </span>
                    )}
                    {detail.subjectName != null && (
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                        {String(detail.subjectName)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {!courseCatalog && !personCards && (
                <button
                  onClick={() => {
                    setDetail(null)

                    setRelated(null)
                  }}
                  className="h-9 border border-stroke px-3 text-sm"
                >
                  إغلاق
                </button>
              )}
            </div>
            {personCards && personBioOf(detail) && (
              <p className="mt-4 whitespace-pre-line rounded-2xl bg-canvas p-5 text-sm leading-8 text-ink-muted">
                {personBioOf(detail)}
              </p>
            )}
            {!personCards &&
              typeof (detail.description ?? detail.bio) === "string" && (
                <p
                  className={`whitespace-pre-line text-sm leading-8 text-ink-muted ${
                    courseCatalog
                      ? "px-6 py-5 md:px-9 md:py-7 md:text-base"
                      : "mt-4 rounded-xl border border-stroke bg-canvas p-4"
                  }`}
                >
                  {String(detail.description ?? detail.bio)}
                </p>
              )}
            {!personCards && (
              <dl
                className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${
                  courseCatalog ? "px-6 pb-6 md:px-9" : "mt-4"
                }`}
              >
                {detailFields

                  .filter(
                    ([key]) => !/(^id$|image|url|description|bio)/i.test(key),
                  )

                  .slice(0, courseCatalog ? 9 : 6)

                  .map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs text-ink-muted">{key}</dt>
                      <dd
                        className={`mt-1 wrap-break-word text-sm text-ink ${
                          courseCatalog ? "rounded-xl bg-canvas p-3" : ""
                        }`}
                      >
                        {displayValue(value)}
                      </dd>
                    </div>
                  ))}
              </dl>
            )}
            {!personCards && detailFields.length > 6 && (
              <details className="mt-4 rounded-xl border border-stroke bg-canvas">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-nuwa-base">
                  عرض التفاصيل الإضافية ({detailFields.length - 6})
                </summary>
                <dl className="grid gap-3 border-t border-stroke p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {detailFields.slice(6).map(([key, value]) => (
                    <div key={key} className="rounded-lg bg-white p-3">
                      <dt className="text-xs text-ink-muted">{key}</dt>
                      <dd className="mt-1 break-words text-sm text-ink">
                        {displayValue(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
            {action && (
              <button
                type="button"
                disabled={
                  actionLoading ||
                  (enrolledCourseIds.has(String(detail.id)) &&
                    enrollmentChecked)
                }
                onClick={() => void runAction()}
                className={`inline-flex h-12 items-center justify-center rounded-xl bg-nuwa-base px-6 text-sm font-bold text-white shadow-md shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:bg-nuwa-deep disabled:cursor-not-allowed disabled:opacity-60 ${
                  courseCatalog
                    ? "mx-6 mb-6 w-[calc(100%-3rem)] md:mx-9 md:w-auto md:min-w-64"
                    : "mt-5"
                }`}
              >
                {actionLoading
                  ? "جارٍ الإرسال..."
                  : enrolledCourseIds.has(String(detail.id)) &&
                      enrollmentChecked
                    ? "مسجل بالفعل"
                    : (actionLabel ?? "تنفيذ")}
              </button>
            )}
            {loadRelated && (
              <div className="mt-5 border-t border-stroke pt-4">
                <h3 className="mb-3 font-semibold text-ink">
                  {personCards ? "الدورات التعليمية" : "الدورات"}
                </h3>
                {relatedLoading ? (
                  <div aria-busy="true" className="grid gap-2 sm:grid-cols-2">
                    {[0, 1].map((index) => (
                      <div
                        key={index}
                        aria-hidden="true"
                        className="rounded-2xl border border-stroke bg-white p-4"
                      >
                        <Skeleton className="h-36 w-full rounded-2xl" />
                        <Skeleton className="mt-4 h-5 w-2/3" />
                        <SkeletonText className="mt-3" lines={2} />
                        <div className="mt-4 flex justify-between border-t border-stroke pt-3">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : relatedItems.length === 0 ? (
                  <p className="text-sm text-ink-muted">لا توجد دورات متاحة.</p>
                ) : (
                  <div className="grid gap-2 lg:grid-cols-2">
                    {relatedItems.map((item, index) => {
                      const record = asRecord(item)

                      if (!record) return null

                      const courseId = record.id

                      const courseTitle = String(
                        record.title ?? record.name ?? "دورة تعليمية",
                      )

                      const coverImage = String(
                        record.coverImageUrl ??
                          record.thumbnailUrl ??
                          record.imageUrl ??
                          "",
                      )

                      const coverImageUrl = coverImage
                        ? resolveApiAssetUrl(coverImage)
                        : ""

                      if (personCards) {
                        return (
                          <button
                            key={String(courseId ?? index)}
                            type="button"
                            disabled={
                              courseId === undefined || courseId === null
                            }
                            onClick={() => {
                              if (courseId !== undefined && courseId !== null) {
                                navigate?.("public:course-detail", {
                                  courseId: String(courseId),
                                })
                              }
                            }}
                            className="group overflow-hidden rounded-2xl border border-stroke bg-white text-start shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-nuwa-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:shadow-sm"
                          >
                            <div className="relative flex h-36 items-end overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-700 p-4">
                              {coverImageUrl ? (
                                <img
                                  src={coverImageUrl}
                                  alt=""
                                  className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105"
                                />
                              ) : (
                                <>
                                  <div className="absolute -left-6 -top-10 size-40 rounded-full border border-white/15" />
                                  <BookOpen
                                    size={38}
                                    className="absolute left-5 top-5 text-white/75"
                                  />
                                </>
                              )}
                              <span className="relative rounded-full border border-white/20 bg-black/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                                {String(record.academicYear ?? "دورة تعليمية")}
                              </span>
                            </div>
                            <div className="p-4">
                              <h4 className="line-clamp-1 font-bold text-ink">
                                {courseTitle}
                              </h4>
                              <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-ink-muted">
                                {String(
                                  record.description ??
                                    "محتوى تعليمي منظم يساعدك على التقدم خطوة بخطوة.",
                                )}
                              </p>
                              <div className="mt-4 flex items-center justify-between gap-3 border-t border-stroke pt-3 text-xs">
                                <span className="line-clamp-1 text-ink-muted">
                                  {String(record.subjectName ?? "دورة تعليمية")}
                                </span>
                                <span className="shrink-0 font-semibold text-nuwa-base">
                                  تفاصيل الدورة
                                  <ArrowLeft
                                    size={14}
                                    className="ms-1 inline"
                                  />
                                </span>
                              </div>
                            </div>
                          </button>
                        )
                      }

                      return (
                        <article
                          key={String(courseId ?? index)}
                          className="overflow-hidden rounded-2xl border border-stroke p-3"
                        >
                          <h4 className="font-medium text-ink">
                            {courseTitle}
                          </h4>
                          <p className="mt-1 text-xs text-ink-muted">
                            {scalarFields(record)

                              .slice(0, 3)

                              .map(
                                ([key, value]) =>
                                  `${key}: ${displayValue(value)}`,
                              )

                              .join(" · ")}
                          </p>
                        </article>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        <ApiQueryState
          loading={loading && !data}
          loadingContent={
            <CatalogGridSkeleton
              kind={
                personCards ? "person" : courseCatalog ? "course" : "record"
              }
              count={data ? visibleItems.length : 12}
            />
          }
          error={error}
          isEmpty={false}
          emptyMessage={emptyMessage}
          onRetry={() => setReloadKey((key) => key + 1)}
        >
          {data && (
            <>
              {visibleItems.length === 0 ? (
                <motion.div
                  initial={
                    disableEntryAnimations ? false : { opacity: 0, y: 12 }
                  }
                  animate={
                    disableEntryAnimations ? undefined : { opacity: 1, y: 0 }
                  }
                  className="grid min-h-64 place-items-center rounded-3xl border border-dashed border-stroke-strong bg-surface px-6 py-12 text-center"
                >
                  <div>
                    <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-nuwa-soft text-nuwa-base">
                      {personCards ? (
                        <GraduationCap size={25} aria-hidden="true" />
                      ) : (
                        <BookOpen size={25} aria-hidden="true" />
                      )}
                    </span>
                    <h2 className="mt-4 text-lg font-bold text-ink">
                      لا توجد نتائج مطابقة
                    </h2>
                    <p className="mt-2 text-sm text-ink-muted">
                      جرّب كلمات بحث أخرى أو أزل عوامل التصفية.
                    </p>
                    <button
                      type="button"
                      onClick={clearCatalogSearch}
                      className="mt-5 min-h-11 rounded-xl bg-nuwa-base px-5 text-sm font-semibold text-white transition hover:bg-nuwa-deep active:scale-[0.97]"
                    >
                      إعادة ضبط البحث
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  layout={!disableEntryAnimations}
                  variants={
                    disableEntryAnimations
                      ? undefined
                      : staggerContainerVariants
                  }
                  initial={disableEntryAnimations ? false : "hidden"}
                  animate={disableEntryAnimations ? undefined : "visible"}
                  className={`grid gap-3 sm:gap-5 md:grid-cols-2 ${
                    courseCatalog ? "xl:grid-cols-3" : "lg:grid-cols-3"
                  }`}
                >
                  <AnimatePresence initial={false} mode="popLayout">
                    {visibleItems.map((item, index) => {
                      const record = asRecord(item)

                      if (!record) return null

                      const cardTitle = personCards
                        ? personNameOf(record)
                        : titleOf(record)

                      const cardDescription = String(
                        personCards
                          ? personBioOf(record)
                          : (record.description ??
                              record.bio ??
                              record.subjectName ??
                              record.academicYear ??
                              ""),
                      )

                      const teacherSubjects = personCards
                        ? subjectValues(record)
                        : []

                      const cover = String(
                        record.coverImageUrl ??
                          record.thumbnailUrl ??
                          record.imageUrl ??
                          "",
                      )

                      const subjectName =
                        record.subjectName != null
                          ? String(record.subjectName)
                          : null

                      const year =
                        record.academicYear != null
                          ? String(record.academicYear)
                          : null

                      const price = record.price

                      const isFree = price === 0 || price === "0"

                      const courseIdentifier = record.id ?? record.courseId

                      const teacherImage = String(
                        record.avatarUrl ??
                          record.profileImageUrl ??
                          record.imageUrl ??
                          "",
                      )

                      return (
                        <motion.article
                          key={String(record.id ?? index)}
                          layout={!disableEntryAnimations}
                          variants={
                            disableEntryAnimations
                              ? undefined
                              : staggerItemVariants
                          }
                          exit={
                            disableEntryAnimations
                              ? undefined
                              : { opacity: 0, y: 12 }
                          }
                          whileHover={
                            disableEntryAnimations ? undefined : { y: -6 }
                          }
                          whileTap={
                            disableEntryAnimations ? undefined : { scale: 0.98 }
                          }
                          transition={
                            disableEntryAnimations
                              ? undefined
                              : {
                                  type: "spring",

                                  stiffness: 260,

                                  damping: 26,
                                }
                          }
                          className={`group relative flex flex-col overflow-hidden rounded-3xl ${
                            personCards ? "min-h-[26rem]" : "min-h-80"
                          } border border-stroke bg-surface text-start shadow-sm transition-shadow duration-300 hover:border-emerald-300/60 hover:shadow-[0_24px_48px_-24px_rgba(11,59,37,.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800`}
                        >
                          <button
                            type="button"
                            aria-label={
                              courseCatalog
                                ? `عرض تفاصيل الدورة: ${cardTitle}`
                                : personCards
                                  ? `عرض ملف المعلم: ${cardTitle}`
                                  : `عرض التفاصيل: ${cardTitle}`
                            }
                            onClick={() => {
                              if (
                                courseCatalog &&
                                navigate &&
                                courseIdentifier != null
                              ) {
                                navigate("public:course-detail", {
                                  courseId: String(courseIdentifier),
                                })

                                return
                              }

                              if (personCards) {
                                const id = record.id ?? record.teacherId

                                if (
                                  id !== undefined &&
                                  id !== null &&
                                  navigate
                                ) {
                                  navigate("teacher:platform", {
                                    teacherId: String(id),
                                  })

                                  return
                                }
                              }

                              void selectRecord(item)
                            }}
                            className="absolute inset-0 z-20 rounded-3xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
                          />
                          {/* ============ كارت الدورة ============ */}
                          {courseCatalog && (
                            <>
                              {/* ============ قسم غلاف الدورة والشارات ============ */}
                              <div className="relative h-52 w-full overflow-hidden bg-gradient-to-br from-[#072d1c] via-[#0e5233] to-[#187d4d]">
                                {/* الصورة أو الشكل الاحتياطي */}
                                {cover ? (
                                  <img
                                    src={resolveApiAssetUrl(cover)}
                                    alt=""
                                    loading="lazy"
                                    className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                                  />
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="absolute -right-10 -top-10 size-48 rounded-full border border-white/10 bg-white/5 blur-sm" />
                                    <div className="absolute -left-10 -bottom-10 size-36 rounded-full border border-white/10 bg-white/5 blur-sm" />
                                    <div className="relative z-10 grid size-16 place-items-center rounded-2xl border border-white/20 bg-white/10 shadow-inner backdrop-blur-md transition-transform duration-500 group-hover:scale-110">
                                      <BookOpen
                                        size={30}
                                        className="text-emerald-200"
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* تدرج احترافي ناعم متعدد الطبقات ليجعل الكتابة والشارات مقروءة بوضوح */}
                                <div className="absolute inset-0 bg-gradient-to-t from-[#091e15]/90 via-[#091e15]/30 to-black/20 transition-opacity duration-300 group-hover:opacity-85" />

                                {/* الشارات العلوية (المادة + السنة الدراسية) */}
                                <div className="absolute inset-x-3.5 top-3.5 z-10 flex items-center justify-between gap-2">
                                  {subjectName ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-emerald-950/60 px-3 py-1 text-[11px] font-bold text-emerald-200 shadow-sm backdrop-blur-md">
                                      <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                      {subjectName}
                                    </span>
                                  ) : (
                                    <span />
                                  )}

                                  {year && (
                                    <span className="inline-flex items-center rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[11px] font-semibold text-white/90 shadow-sm backdrop-blur-md">
                                      {year}
                                    </span>
                                  )}
                                </div>

                                {/* شارة السعر السفلية داخل الغلاف بأسلوب بطاقة زجاجية */}
                                {price !== undefined && (
                                  <div className="absolute bottom-3.5 right-3.5 z-10">
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-xl px-3.5 py-1.5 text-xs font-black shadow-xl backdrop-blur-md transition-all duration-300 group-hover:scale-105 ${
                                        isFree
                                          ? "border border-emerald-400/50 bg-emerald-500/90 text-white shadow-emerald-950/40"
                                          : "border border-white/30 bg-white/95 text-emerald-950 shadow-black/20"
                                      }`}
                                    >
                                      {isFree ? "مجاني" : formatEgp(price)}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* ============ جسم الكارت والمحتوى ============ */}
                              <div className="flex flex-1 flex-col justify-between p-5 bg-surface transition-colors duration-300 group-hover:bg-emerald-50/20">
                                <div>
                                  <CourseMetadataBadges course={record} />
                                  {/* عنوان الدورة */}
                                  <h2 className="line-clamp-2 text-base font-bold leading-snug text-ink transition-colors duration-300 group-hover:text-nuwa-base">
                                    {highlightMatch(cardTitle, search)}
                                  </h2>

                                  {/* وصف مختصر */}
                                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-muted/90 font-normal">
                                    {highlightMatch(cardDescription, search)}
                                  </p>
                                </div>

                                {/* ============ تذييل الكارت (المعلم + الزر) ============ */}
                                <div className="mt-5 flex items-center justify-between gap-3 border-t border-stroke/50 pt-3.5">
                                  {/* بيانات المعلم */}
                                  <div className="flex min-w-0 items-center gap-2.5">
                                    <CourseTeacherAvatar
                                      course={record}
                                      name={teacherNameOf(record) ?? "معلم وَعي"}
                                    />
                                    <div className="flex min-w-0 flex-col">
                                      <span className="text-[10px] font-medium text-ink-muted/70">
                                        المعلم
                                      </span>
                                      <span className="truncate text-xs font-bold text-ink/90">
                                        {teacherNameOf(record) ?? "منصة وَعي"}
                                      </span>
                                    </div>
                                  </div>

                                  {/* زر التفاعل "التفاصيل" */}
                                  <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-nuwa-soft px-3.5 py-1.5 text-xs font-bold text-nuwa-deep transition-all duration-300 group-hover:bg-nuwa-base group-hover:text-white group-hover:shadow-md group-hover:shadow-emerald-900/10">
                                    <span>التفاصيل</span>
                                    <ArrowLeft
                                      size={13}
                                      className="transition-transform duration-300 group-hover:-translate-x-1"
                                    />
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                          {/* ============ كارت المعلم ============ */}
                          {personCards && (
                            <>
                              {/* الصورة تملأ الكارت */}
                              <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-700">
                                {teacherImage ? (
                                  <img
                                    src={resolveApiAssetUrl(teacherImage)}
                                    alt={personNameOf(record)}
                                    loading="lazy"
                                    className="size-full object-cover transition duration-700 group-hover:scale-105"
                                  />
                                ) : (
                                  <div className="grid size-full place-items-center pb-24">
                                    <span className="grid size-28 place-items-center rounded-full border border-white/20 bg-white/10 text-5xl font-bold text-white/90">
                                      {personNameOf(record).charAt(0)}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* تدرج خفيف فوق الصورة عشان الشارات تبان */}
                              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/45 to-transparent" />

                              {/* التخصص: فوق شمال */}
                              <div className="absolute left-4 top-4 z-10 flex max-w-[70%] flex-wrap gap-1.5">
                                <span
                                  className="truncate rounded-full border border-white/40 bg-white/90 px-3 py-1.5 text-xs font-bold text-emerald-950 shadow-sm"
                                  title={teacherSubjects.join("، ") || "التخصص"}
                                >
                                  {teacherSubjects[0] ?? "معلم على منصة وَعي"}
                                </span>
                                {teacherSubjects.length > 1 && (
                                  <span className="rounded-full border border-white/30 bg-black/35 px-2.5 py-1.5 text-xs font-bold text-white backdrop-blur">
                                    +{teacherSubjects.length - 1}
                                  </span>
                                )}
                              </div>

                              {/* عدد الدورات: فوق يمين */}
                              {record.courseCount !== undefined && (
                                <span className="absolute right-4 top-4 z-10 rounded-full border border-white/25 bg-black/35 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                                  {displayValue(record.courseCount)} دورة
                                </span>
                              )}

                              {/* طبقة البلور من تحت */}
                              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-emerald-950/90 via-emerald-950/55 to-transparent backdrop-blur-md [mask-image:linear-gradient(to_top,black_60%,transparent)] [-webkit-mask-image:linear-gradient(to_top,black_60%,transparent)]" />

                              {/* التفاصيل */}
                              <div className="relative z-10 mt-auto flex flex-col p-5 text-white">
                                <h2 className="text-xl font-bold leading-7">
                                  {highlightMatch(cardTitle, search)}
                                </h2>
                                <p className="mt-2 line-clamp-2 text-sm leading-7 text-white/80">
                                  {cardDescription
                                    ? highlightMatch(cardDescription, search)
                                    : "معلم على منصة وَعي"}
                                </p>
                                <span className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white/15 py-2.5 text-sm font-bold text-white ring-1 ring-white/25 backdrop-blur transition-colors group-hover:bg-white group-hover:text-emerald-950">
                                  استكشف دورات المعلم
                                  <ArrowLeft
                                    size={15}
                                    className="transition-transform duration-300 group-hover:-translate-x-1"
                                  />
                                </span>
                              </div>
                            </>
                          )}

                          {/* ============ الكارت العام (fallback) ============ */}
                          {!courseCatalog && !personCards && (
                            <div className="flex flex-1 flex-col p-5">
                              <h2 className="font-semibold leading-7 text-ink">
                                {highlightMatch(cardTitle, search)}
                              </h2>
                              <p className="mt-2 line-clamp-3 text-sm leading-7 text-ink-muted">
                                {highlightMatch(cardDescription, search)}
                              </p>
                              <span className="mt-auto pt-4 text-sm font-semibold text-nuwa-base">
                                عرض التفاصيل
                              </span>
                            </div>
                          )}
                          {courseCatalog && (
                            <div className="relative z-30 bg-surface px-4 pb-4 pt-1">
                              <button
                                type="button"
                                disabled={
                                  courseIdentifier == null ||
                                  (enrolledCourseIds.has(
                                    String(courseIdentifier),
                                  ) &&
                                    enrollmentChecked)
                                }
                                onClick={(event) => {
                                  event.stopPropagation()

                                  void openEnrollmentContact(record)
                                }}
                                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-nuwa-base px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-nuwa-base/15 transition hover:-translate-y-0.5 hover:bg-nuwa-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nuwa-bright focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-ink-muted"
                              >
                                <MessageCircle size={17} />
                                {enrolledCourseIds.has(
                                  String(courseIdentifier),
                                ) && enrollmentChecked
                                  ? "مسجل بالفعل"
                                  : "طلب الالتحاق بالدورة"}
                              </button>
                            </div>
                          )}
                        </motion.article>
                      )
                    })}
                  </AnimatePresence>
                </motion.div>
              )}
              {data.totalPages > 1 &&
                (courseCatalog || personCards ? (
                  <nav
                    className="mt-10 flex items-center justify-center gap-5"
                    aria-label={
                      personCards ? "صفحات المعلمين" : "صفحات الدورات"
                    }
                    dir="ltr"
                  >
                    <button
                      type="button"
                      aria-label={
                        personCards ? "صفحة المعلمين السابقة" : "الصفحة السابقة"
                      }
                      disabled={page <= 1 || loading}
                      onClick={() => {
                        setPage((value) => Math.max(1, value - 1))
                        setDetail(null)
                      }}
                      className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-ink shadow-[0_4px_18px_rgba(15,23,42,0.10)] transition hover:-translate-y-0.5 hover:text-nuwa-base disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft size={20} aria-hidden="true" />
                    </button>
                    <div className="flex items-center justify-center gap-2.5">
                      {Array.from(
                        { length: Math.min(data.totalPages, 5) },
                        (_, index) =>
                          Math.max(1, Math.min(page - 2, data.totalPages - 4)) +
                          index,
                      ).map((pageNumber) => (
                        <button
                          key={pageNumber}
                          type="button"
                          aria-label={`الانتقال إلى الصفحة ${pageNumber.toLocaleString("ar-EG")}`}
                          aria-current={
                            page === pageNumber ? "page" : undefined
                          }
                          disabled={loading}
                          onClick={() => {
                            setPage(pageNumber)
                            setDetail(null)
                          }}
                          className={`h-3 rounded-full transition-all duration-300 disabled:cursor-wait ${
                            page === pageNumber
                              ? "w-12 bg-[#6d28d9]"
                              : "w-3 bg-[#e6e7ef] hover:bg-[#c4b5fd]"
                          }`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      aria-label={
                        personCards ? "صفحة المعلمين التالية" : "الصفحة التالية"
                      }
                      disabled={page >= data.totalPages || loading}
                      onClick={() => {
                        setPage((value) => Math.min(data.totalPages, value + 1))
                        setDetail(null)
                      }}
                      className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-ink shadow-[0_4px_18px_rgba(15,23,42,0.10)] transition hover:-translate-y-0.5 hover:text-nuwa-base disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight size={20} aria-hidden="true" />
                    </button>
                    <span className="sr-only" aria-live="polite">
                      صفحة {page.toLocaleString("ar-EG")} من{" "}
                      {data.totalPages.toLocaleString("ar-EG")}
                    </span>
                  </nav>
                ) : (
                  <nav
                    className="mt-6 flex items-center justify-between border-t border-stroke pt-4"
                    aria-label="صفحات النتائج"
                  >
                    <button
                      disabled={page <= 1}
                      onClick={() => {
                        setPage((value) => value - 1)

                        setDetail(null)
                      }}
                      className="h-10 border border-stroke px-4 text-sm disabled:opacity-40"
                    >
                      السابق
                    </button>
                    <span className="text-sm text-ink-muted">
                      صفحة {data.page} من {data.totalPages}
                    </span>
                    <button
                      disabled={page >= data.totalPages}
                      onClick={() => {
                        setPage((value) => value + 1)

                        setDetail(null)
                      }}
                      className="h-10 border border-stroke px-4 text-sm disabled:opacity-40"
                    >
                      التالي
                    </button>
                  </nav>
                ))}
            </>
          )}
        </ApiQueryState>
      </main>
      <AnimatePresence>
        {contactCourse && (
          <motion.div
            className="fixed inset-0 z-[200] grid place-items-center overflow-hidden bg-emerald-950/55 p-2 backdrop-blur-sm sm:p-4"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeEnrollmentContact()
              }
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
              className="my-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-md flex-col overflow-hidden overscroll-contain rounded-2xl border border-white/60 bg-surface shadow-2xl shadow-emerald-950/25 sm:max-h-[calc(100dvh-2rem)] sm:rounded-[28px]"
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <div className="relative shrink-0 overflow-hidden bg-gradient-to-l from-nuwa-deep via-nuwa-base to-[#24865b] px-5 pb-4 pt-5 text-white sm:px-6 sm:pb-5 sm:pt-6">
                <span
                  aria-hidden="true"
                  className="absolute -left-7 -top-14 size-36 rounded-full border-[18px] border-white/10"
                />
                <button
                  type="button"
                  onClick={closeEnrollmentContact}
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
                  {titleOf(contactCourse)}
                </h2>
                <p className="relative mt-2 text-xs leading-5 text-white/75 sm:text-sm sm:leading-6">
                  أرسل طلبك للمعلم أولًا، ثم تواصل معه عبر واتساب لإتمام الدفع.
                </p>
              </div>

              <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain p-4 sm:space-y-4 sm:p-5">
                <div className="flex items-center gap-3 rounded-2xl border border-stroke bg-white p-3 sm:p-4">
                  <CourseTeacherAvatar
                    course={contactCourse}
                    name={teacherNameOf(contactCourse) ?? "معلم الدورة"}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-ink-muted">
                      معلم الدورة
                    </p>
                    <p className="mt-1 truncate text-sm font-bold text-ink">
                      {teacherNameOf(contactCourse) ?? "معلم الدورة"}
                    </p>
                  </div>
                </div>

                <ol className="grid gap-2 rounded-2xl border border-stroke bg-white p-3 text-xs sm:gap-3 sm:p-4 sm:text-sm">
                  <li className="flex items-start gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-nuwa-soft text-[11px] font-extrabold text-nuwa-base sm:size-7 sm:text-xs">
                      ١
                    </span>
                    <span className="leading-6 text-ink">
                      اضغط <strong>طلب الالتحاق بالدورة</strong> لإرسال طلبك إلى
                      المعلم.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-nuwa-soft text-[11px] font-extrabold text-nuwa-base sm:size-7 sm:text-xs">
                      ٢
                    </span>
                    <span className="leading-6 text-ink">
                      تواصل مع المعلم عبر واتساب لإتمام الدفع؛ وبعد تأكيد الدفع
                      يعتمد اشتراكك في الدورة.
                    </span>
                  </li>
                </ol>

                {contactLoading ? (
                  <div
                    aria-live="polite"
                    className="flex min-h-16 items-center justify-center gap-2 rounded-2xl border border-stroke bg-canvas/60 text-sm font-semibold text-ink-muted"
                  >
                    <LoaderCircle size={18} className="animate-spin" />
                    جارٍ تحميل رقم التواصل...
                  </div>
                ) : contactPhone ? (
                  <div className="rounded-2xl border border-emerald-900/10 bg-emerald-50/70 p-3 sm:p-4">
                    <p className="text-xs font-semibold text-ink-muted">
                      رقم التواصل عبر واتساب
                    </p>
                    <a
                      href={`tel:${contactPhone.replace(/[^\d+]/g, "")}`}
                      dir="ltr"
                      className="mt-1 inline-flex items-center gap-2 text-lg font-bold tabular-nums text-ink transition hover:text-nuwa-base"
                    >
                      <Phone size={17} className="text-nuwa-base" />
                      {contactPhone}
                    </a>
                  </div>
                ) : (
                  <div
                    role={contactError ? "alert" : "status"}
                    className={`rounded-2xl border p-4 text-sm leading-6 ${
                      contactError
                        ? "border-danger/20 bg-danger-light text-danger"
                        : "border-warning/25 bg-warning-light text-ink"
                    }`}
                  >
                    {contactError ||
                      "لم يضف المعلم رقم واتساب للتواصل بعد. يرجى المحاولة لاحقاً أو التواصل مع إدارة المنصة."}
                    {contactError && (
                      <button
                        type="button"
                        onClick={() =>
                          void openEnrollmentContact(contactCourse)
                        }
                        className="mt-2 block font-bold underline"
                      >
                        إعادة المحاولة
                      </button>
                    )}
                  </div>
                )}

                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void requestContactEnrollment()}
                    disabled={
                      contactRequestLoading ||
                      contactRequestSent ||
                      (contactCourse.id == null &&
                        contactCourse.courseId == null)
                    }
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-nuwa-base px-3 py-2.5 text-xs font-bold leading-5 text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-nuwa-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nuwa-bright focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-12 sm:px-4 sm:py-3 sm:text-sm"
                  >
                    {contactRequestLoading ? (
                      <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                      <MessageCircle size={17} />
                    )}
                    {contactRequestLoading
                      ? "جارٍ إرسال الطلب..."
                      : contactRequestSent
                        ? "تم إرسال طلب الالتحاق"
                        : "طلب الالتحاق بالدورة"}
                  </button>
                  {contactPhone && contactWhatsappPhone ? (
                    <a
                      href={`https://wa.me/${contactWhatsappPhone}?text=${encodeURIComponent(
                        `السلام عليكم، أرسلت طلب الالتحاق بدورة ${titleOf(contactCourse)} وأرغب في إتمام الدفع.`,
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
                {contactRequestMessage && (
                  <p
                    role={contactRequestSent ? "status" : "alert"}
                    className={`rounded-xl px-3 py-2.5 text-xs leading-5 ${
                      contactRequestSent
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border border-amber-200 bg-amber-50 text-amber-900"
                    }`}
                  >
                    {contactRequestMessage}
                  </p>
                )}
                <p className="text-center text-[11px] leading-5 text-ink-muted">
                  بعد إرسال طلب الالتحاق، أكمل الدفع مع المعلم واتساب وانتظر
                  اعتماده.
                </p>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
