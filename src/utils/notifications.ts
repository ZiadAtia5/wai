import { toast } from "react-toastify"

const errorTranslations: Array<[RegExp, string]> = [
  [/email.*(already|exist|taken)/i, "هذا البريد الإلكتروني مسجل بالفعل."],

  [
    /(invalid|incorrect|wrong).*(email|password|credential)|unauthorized/i,

    "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  ],

  [/password.*(match|same)/i, "كلمتا المرور غير متطابقتين."],

  [
    /network|fetch|connect|timeout|abort/i,

    "تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.",
  ],

  [
    /required|validation|invalid.*(input|request|data)/i,

    "راجع البيانات المدخلة وحاول مرة أخرى.",
  ],

  [/forbidden|access denied/i, "ليس لديك صلاحية لتنفيذ هذا الإجراء."],

  [/not found/i, "البيانات المطلوبة غير موجودة."],

  [
    /server error|internal server|500/i,

    "حدث خطأ في الخادم. حاول مرة أخرى لاحقاً.",
  ],
]

export function arabicErrorMessage(
  error: unknown,

  fallback = "تعذر إتمام العملية. حاول مرة أخرى.",
) {
  const message =
    typeof error === "string"
      ? error.trim()
      : error instanceof Error
        ? error.message.trim()
        : ""

  if (!message) return fallback

  if (/[؀-ۿ]/.test(message)) return message

  return (
    errorTranslations.find(([pattern]) => pattern.test(message))?.[1] ??
    fallback
  )
}

export function notifySuccess(message: string) {
  toast.success(message, { rtl: true })
}

export function notifyError(error: unknown, fallback?: string) {
  toast.error(arabicErrorMessage(error, fallback), { rtl: true })
}
