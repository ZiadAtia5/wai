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

const LEGACY_AUTH_TOKEN_KEY = "eduhub.auth.token";

let authToken: string | null = null;

if (typeof window !== "undefined") {
  try {
    window.sessionStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
  } catch {
    // Ignore unavailable browser storage; access tokens remain memory-only.
  }
}

type ApiRequestOptions = RequestInit & { skipAuth?: boolean };

export function getAuthToken(): string | null {
  return authToken;
}

export function setAuthToken(token: string): void {
  const normalizedToken = token.trim();

  if (!normalizedToken) {
    throw new ApiError("لم يرسل الخادم رمز جلسة صالحاً.");
  }

  authToken = normalizedToken;
}

export function clearAuthToken(): void {
  authToken = null;

  try {
    window.sessionStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
  } catch {
    // The in-memory token is still cleared if browser storage is unavailable.
  }
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

export function resolveApiAssetUrl(path: string): string {
  const trimmedPath = path.trim();

  if (/^(?:data:image\/|blob:)/i.test(trimmedPath)) return trimmedPath;

  let url: URL;

  try {
    const apiUrl = new URL(getApiBaseUrl());

    const baseUrl = `${apiUrl.origin}/`;

    url = new URL(trimmedPath, baseUrl);
  } catch {
    throw new ApiError("مسار ملف الخادم غير صالح.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ApiError("بروتوكول ملف الخادم غير مدعوم.");
  }

  return url.toString();
}

export function resolveApiImageUrl(path: string, width = 1280): string {
  const resolvedUrl = resolveApiAssetUrl(path);

  try {
    const url = new URL(resolvedUrl);

    if (
      url.hostname !== "res.cloudinary.com" ||
      !url.pathname.includes("/image/upload/") ||
      url.searchParams.has("signature") ||
      url.searchParams.has("__cld_token__")
    ) {
      return resolvedUrl;
    }

    const segments = url.pathname.split("/");
    const uploadIndex = segments.indexOf("upload");

    if (uploadIndex < 0) return resolvedUrl;

    const remainingSegments = segments.slice(uploadIndex + 1);

    if (remainingSegments.some((segment) => segment.startsWith("s--"))) {
      return resolvedUrl;
    }

    const existingOptions = remainingSegments.flatMap((segment) =>
      segment.split(","),
    );
    const safeWidth = Math.min(2400, Math.max(64, Math.round(width)));
    const transformations = [
      existingOptions.includes("f_auto") ? null : "f_auto",
      existingOptions.includes("q_auto") ? null : "q_auto",
      existingOptions.some((option) => /^w_\d+$/.test(option))
        ? null
        : `w_${safeWidth}`,
      existingOptions.some((option) => option.startsWith("c_"))
        ? null
        : "c_limit",
    ].filter((option): option is string => option !== null);

    if (transformations.length) {
      segments.splice(uploadIndex + 1, 0, transformations.join(","));
      url.pathname = segments.join("/");
    }

    if (url.protocol === "http:") url.protocol = "https:";

    return url.toString();
  } catch {
    return resolvedUrl;
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

  options: ApiRequestOptions = {},

  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
  const { skipAuth = false, ...requestOptions } = options;

  const baseUrl = getApiBaseUrl();

  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new ApiError("مسار الطلب غير صالح.");
  }

  const apiUrlObject = new URL(baseUrl);

  // التحقق مما إذا كان سيرفر الـ API نفسه شغال على اللوكل

  const isApiLocalhost =
    apiUrlObject.hostname === "localhost" ||
    apiUrlObject.hostname === "127.0.0.1";

  if (isApiLocalhost && import.meta.env.PROD) {
    throw new ApiError("إعداد الخادم المحلي غير مسموح في بيئة الإنتاج.");
  }

  // لا تسمح بإرسال أي بيانات أو رموز جلسات إلى API خارجي عبر اتصال غير مشفر.

  if (apiUrlObject.protocol !== "https:" && !isApiLocalhost) {
    throw new ApiError("تم إيقاف الاتصال لأن اتصال الخادم غير مشفر.");
  }

  const controller = new AbortController();

  const timeout = window.setTimeout(
    () => controller.abort(),

    timeoutMs,
  );

  const headers = new Headers(requestOptions.headers);

  const token = getAuthToken();

  if (!skipAuth && token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (
    requestOptions.body &&
    !(requestOptions.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  headers.set("Accept", "application/json");

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...requestOptions,

      headers,

      signal: controller.signal,

      mode: "cors",

      credentials: "omit",
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearAuthToken();

        window.sessionStorage.removeItem("eduhub.auth.role");
        window.sessionStorage.removeItem("eduhub.auth.name");
        window.sessionStorage.removeItem("eduhub.auth.image");

        window.dispatchEvent(new Event("eduhub:auth-expired"));
      }

      let message = getHttpErrorMessage(response.status);

      try {
        const payload: unknown = await response.json();

        if (typeof payload === "object" && payload !== null) {
          const body = payload as Record<string, unknown>;

          const candidate = body.message ?? body.detail ?? body.title;

          if (typeof candidate === "string" && candidate.trim()) {
            message = candidate;
          }
        }
      } catch {
        // Keep the status-specific message when the API has no JSON error body.
      }

      throw new ApiError(message, response.status);
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

  if (status === 403) return "تعذر تحميل البيانات المطلوبة الآن.";

  if (status === 404) return "المورد المطلوب غير موجود.";

  if (status === 422) return "تحقق من البيانات المدخلة ثم حاول مجدداً.";

  if (status === 429) return "طلبات كثيرة. انتظر قليلاً ثم حاول مجدداً.";

  if (status >= 500) return "حدث خطأ في الخادم. حاول مجدداً لاحقاً.";

  return "تعذر إكمال الطلب إلى الخادم.";
}
