import type { AcademicYearResponse } from "../../api/catalog"

// قاموس لترجمة مفاتيح الـ API إلى العربية تلقائياً

export const fieldLabels: Record<string, string> = {
  id: "المعرف",

  title: "العنوان",

  name: "الاسم",

  fullName: "الاسم الكامل",

  firstName: "الاسم الأول",

  lastName: "اسم العائلة",

  email: "البريد الإلكتروني",

  phoneNumber: "رقم الهاتف",

  parentPhoneNumber: "هاتف ولي الأمر",

  studentNumber: "كود الطالب",

  isApproved: "حالة الاعتماد",

  registeredByTeacherName: "المعلم الذي استخدم الطالب كوده",

  teacherCode: "كود المعلم",

  teacherCodeUsed: "كود المعلم المستخدم",

  registrationCode: "كود التسجيل",

  referralCode: "كود الإحالة",

  academicYear: "الصف الدراسي",

  role: "الدور",

  status: "الحالة",

  createdAt: "تاريخ الإنشاء",

  updatedAt: "تاريخ التحديث",

  price: "السعر",

  courseName: "اسم الدورة",

  courseCount: "عدد الكورسات",

  coursesCount: "عدد الكورسات",

  totalCourses: "عدد الكورسات",

  studentCount: "عدد الطلاب",

  studentsCount: "عدد الطلاب",

  totalStudents: "عدد الطلاب",

  pendingRequests: "طلبات قيد الانتظار",

  pendingRequestsCount: "طلبات قيد الانتظار",

  enrollmentCount: "عدد الاشتراكات",

  enrollmentsCount: "عدد الاشتراكات",

  totalEnrollments: "عدد الاشتراكات",

  lessonCount: "عدد الدروس",

  lessonsCount: "عدد الدروس",

  totalLessons: "عدد الدروس",

  studentName: "اسم الطالب",

  teacherName: "اسم المعلم",

  description: "الوصف",

  isRead: "حالة القراءة",

  message: "الرسالة",
}

function studentDetailFields(record: Record<string, unknown>) {
  return Object.entries(record).filter(
    ([key, value]) =>
      !/(^id$|token|image|url|password)/i.test(key) &&
      value !== null &&
      (["string", "number", "boolean"].includes(typeof value) ||
        key === "academicYear"),
  )
}

export default function StudentDetailsCard({
  record,

  academicYears,
}: {
  record: Record<string, unknown>

  academicYears: AcademicYearResponse[]
}) {
  const teacherName =
    record.teacherName ??
    record.registeredByTeacherName ??
    record.referralTeacherName

  const teacherCode =
    record.teacherCodeUsed ?? record.teacherCode ?? record.referralCode

  return (
    <details className="mt-4 overflow-hidden rounded-[20px] border border-stroke bg-white shadow-sm">
      <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-nuwa-base transition hover:bg-nuwa-soft/50">
        عرض تفاصيل الطالب
      </summary>
      <dl className="grid gap-2 border-t border-stroke bg-canvas/50 p-4 sm:grid-cols-2">
        {studentDetailFields(record).map(([key, value]) => {
          const year =
            typeof value === "object" && value !== null
              ? value as Record<string, unknown>
              : null

          const namedYear = academicYears.find((item) => item.value === value)

          const shownValue =
            key === "academicYear"
              ? (year?.arabicName ??
                year?.name ??
                namedYear?.arabicName ??
                value)
              : value

          return (
            <div key={key} className="rounded-lg bg-white p-3">
              <dt className="text-xs font-semibold text-ink-muted">
                {fieldLabels[key] ?? key}
              </dt>
              <dd className="mt-1 break-words text-sm text-ink">
                <FormattedCardValue field={key} value={shownValue} />
              </dd>
            </div>
          )
        })}
      </dl>
      <div className="border-t border-stroke p-4">
        <h4 className="text-sm font-bold text-ink">
          المعلم المرتبط بكود التسجيل
        </h4>
        {teacherName ? (
          <p className="mt-1 text-sm text-ink-muted">
            {String(teacherName)}
            {teacherCode ? ` · كود ${String(teacherCode)}` : ""}
          </p>
        ) : (
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            بيانات الـ API الحالية لا تتضمن كود المعلم الذي استخدمه الطالب عند
            التسجيل.
          </p>
        )}
      </div>
    </details>
  )
}

export function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—"

  if (typeof value === "boolean") return value ? "نعم" : "لا"

  if (key.toLowerCase().includes("date") || key.toLowerCase().includes("at")) {
    const date = new Date(String(value))

    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString("ar-EG", {
        year: "numeric",

        month: "short",

        day: "numeric",
      })
    }
  }

  if (typeof value === "object") return JSON.stringify(value)

  return String(value)
}

export function FormattedCardValue({
  field,

  value,
}: {
  field: string

  value: unknown
}) {
  const formatted = formatValue(field, value)

  if (typeof value !== "string" || value.length <= 140) return formatted

  return (
    <>
      <span className="line-clamp-2">{formatted}</span>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-semibold text-nuwa-base">
          قراءة النص كاملاً
        </summary>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ink-muted">
          {formatted}
        </p>
      </details>
    </>
  )
}
