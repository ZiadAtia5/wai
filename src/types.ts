export type View =
  | "landing"
  | "login"
  | "register"
  | "public:courses"
  | "public:teachers"
  | "dashboard";

export interface NavigateFn {
  (view: View): void;
}
