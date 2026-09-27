export type View = "landing" | "login" | "register" | "public:courses" | "public:teachers"

export interface NavigateFn {
  (view: View): void
}
