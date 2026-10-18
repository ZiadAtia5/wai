export type View = "landing" | "login" | "register" | "public:courses" | "public:course-detail" | "public:teachers" | "dashboard"

export interface NavigateFn {
  (view: View, params?: { courseId?: string }): void
}
