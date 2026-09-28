export type View =
  | "landing"
  | "login"
  | "register"
  | "public:courses"
  | "public:teachers"
  | `public:course:${string}`
  | "dashboard";

export interface NavigateFn {
  (view: View): void;
}
