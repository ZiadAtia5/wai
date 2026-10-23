export type View = "landing" | "login" | "register" | "public:courses" | "public:course-detail" | "public:teachers" | "teacher:platform" | "dashboard"

export interface NavigateFn {
  (
    view: View,
    params?: { courseId?: string; teacherId?: string },
  ): void
}
