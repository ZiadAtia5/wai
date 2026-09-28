export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const REQUEST_TIMEOUT_MS = 15_000;
const AUTH_TOKEN_KEY = "eduhub.auth.token";

export function getAuthToken(): string | null {
  return window.sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  window.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL;

  if (!configuredUrl) {
    throw new ApiError("لم يتم ضبط عنوان الخادم (VITE_API_BASE_URL).");
  }

  const baseUrl = configuredUrl.trim().replace(/\/+$/, "");

  try {
    const parsedUrl = new URL(baseUrl);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error("Unsupported API protocol");
    }

    return baseUrl;
  } catch {
    throw new ApiError("إعداد عنوان الخادم غير صالح.");
  }
}

export function isSecureApiConfigured(): boolean {
  try {
    return new URL(getApiBaseUrl()).protocol === "https:";
  } catch {
    return false;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const method = (options.method || "GET").toUpperCase();

  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new ApiError("مسار الطلب غير صالح.");
  }

  const apiUrlObject = new URL(baseUrl);

  // التحقق مما إذا كان سيرفر الـ API نفسه شغال على اللوكل
  const isApiLocalhost =
    apiUrlObject.hostname === "localhost" ||
    apiUrlObject.hostname === "127.0.0.1";

  // يمنع الاتصال غير المشفّر فقط إذا كان الـ API سيرفر خارجي (ليس localhost) وليس طلب GET
  if (
    apiUrlObject.protocol !== "https:" &&
    !isApiLocalhost &&
    !["GET", "HEAD", "OPTIONS"].includes(method)
  ) {
    throw new ApiError("تم إيقاف إرسال البيانات لأن اتصال الخادم غير مشفر.");
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  const headers = new Headers(options.headers);
  const token = getAuthToken();

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  headers.set("Accept", "application/json");

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
      mode: "cors",
      credentials: "omit",
    });

    if (!response.ok) {
      throw new ApiError(getHttpErrorMessage(response.status), response.status);
    }

    if (response.status === 204) return undefined as T;

    const responseText = await response.text();
    if (!responseText) return undefined as T;

    try {
      return JSON.parse(responseText) as T;
    } catch {
      throw new ApiError("استجابة الخادم ليست بصيغة JSON متوقعة.");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("انتهت مهلة الاتصال بالخادم.");
    }

    throw new ApiError("تعذر الاتصال بالخادم. تحقق من الاتصال وحاول مجدداً.");
  } finally {
    window.clearTimeout(timeout);
  }
}

function getHttpErrorMessage(status: number): string {
  if (status === 401) return "يلزم تسجيل الدخول للوصول إلى هذه البيانات.";
  if (status === 403) return "لا تملك صلاحية الوصول إلى هذه البيانات.";
  if (status === 404) return "المورد المطلوب غير موجود.";
  if (status === 422) return "تحقق من البيانات المدخلة ثم حاول مجدداً.";
  if (status === 429) return "طلبات كثيرة. انتظر قليلاً ثم حاول مجدداً.";
  if (status >= 500) return "حدث خطأ في الخادم. حاول مجدداً لاحقاً.";
  return "تعذر إكمال الطلب إلى الخادم.";
}
