import { apiRequest } from "./client";

export type ApiObject = Record<string, unknown>;
export type QueryValue = string | number | boolean | undefined;

export interface PageQuery extends Record<string, QueryValue> {
  page?: number;
  pageSize?: number;
  search?: string;
  academicYear?: string | number;
}

function queryString(query: Record<string, QueryValue> = {}): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const value = params.toString();
  return value ? `?${value}` : "";
}

function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function upload<T>(
  path: string,
  file: File,
  fields: Record<string, string> = {},
): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));
  return apiRequest<T>(path, { method: "POST", body: form });
}

const get = <T>(path: string) => send<T>("GET", path);
const post = <T>(path: string, body?: unknown) => send<T>("POST", path, body);
const put = <T>(path: string, body?: unknown) => send<T>("PUT", path, body);
const del = <T>(path: string) => send<T>("DELETE", path);
const idPath = (id: string | number) => encodeURIComponent(String(id));

export const authApi = {
  registerStudent: (body: ApiObject) =>
    post<unknown>("/auth/register/student", body),
  login: (body: ApiObject) => post<unknown>("/auth/login", body),
};

export const adminApi = {
  createTeacher: (body: ApiObject) => post<unknown>("/admin/teachers", body),
  teachers: (query: PageQuery = {}) =>
    get<unknown>(`/admin/teachers${queryString(query)}`),
  teacher: (id: string | number) =>
    get<unknown>(`/admin/teachers/${idPath(id)}`),
  updateTeacher: (id: string | number, body: ApiObject) =>
    put<unknown>(`/admin/teachers/${idPath(id)}`, body),
  students: (query: PageQuery = {}) =>
    get<unknown>(`/admin/students${queryString(query)}`),
  student: (id: string | number) =>
    get<unknown>(`/admin/students/${idPath(id)}`),
  createSubject: (body: ApiObject) => post<unknown>("/admin/subjects", body),
  updateSubject: (id: string | number, body: ApiObject) =>
    put<unknown>(`/admin/subjects/${idPath(id)}`, body),
  deleteSubject: (id: string | number) =>
    del<void>(`/admin/subjects/${idPath(id)}`),
  courses: (query: PageQuery = {}) =>
    get<unknown>(`/admin/courses${queryString(query)}`),
  publishCourse: (id: string | number) =>
    put<unknown>(`/admin/courses/${idPath(id)}/publish`),
  unpublishCourse: (id: string | number) =>
    put<unknown>(`/admin/courses/${idPath(id)}/unpublish`),
  stats: () => get<unknown>("/admin/stats"),
};

export const studentsApi = {
  me: () => get<unknown>("/students/me"),
  updateMe: (body: ApiObject) => put<unknown>("/students/me", body),
  list: (query: PageQuery = {}) =>
    get<unknown>(`/students${queryString(query)}`),
  byId: (id: string | number) => get<unknown>(`/students/${idPath(id)}`),
  enrollments: (query: PageQuery = {}) =>
    get<unknown>(`/students/me/enrollments${queryString(query)}`),
  enrollment: (id: string | number) =>
    get<unknown>(`/students/me/enrollments/${idPath(id)}`),
  courseProgress: (courseId: string | number) =>
    get<unknown>(`/students/me/courses/${idPath(courseId)}/progress`),
  updateLessonProgress: (lessonId: string | number, body: ApiObject) =>
    put<unknown>(`/students/me/lessons/${idPath(lessonId)}/progress`, body),
};

export const teachersApi = {
  list: (query: PageQuery = {}) =>
    get<unknown>(`/teachers${queryString(query)}`),
  byId: (id: string | number) => get<unknown>(`/teachers/${idPath(id)}`),
  courses: (teacherId: string | number, query: PageQuery = {}) =>
    get<unknown>(`/teachers/${idPath(teacherId)}/courses${queryString(query)}`),
  me: () => get<unknown>("/teachers/me"),
  updateMe: (body: ApiObject) => put<unknown>("/teachers/me", body),
  uploadProfileImage: (file: File) =>
    upload<unknown>("/teachers/me/profile-image", file),
  deleteProfileImage: () => del<unknown>("/teachers/me/profile-image"),
  stats: () => get<unknown>("/teachers/me/stats"),
  coursesMine: (query: PageQuery = {}) =>
    get<unknown>(`/teachers/me/courses${queryString(query)}`),
  createCourse: (body: ApiObject) =>
    post<unknown>("/teachers/me/courses", body),
  course: (courseId: string | number) =>
    get<unknown>(`/teachers/me/courses/${idPath(courseId)}`),
  updateCourse: (courseId: string | number, body: ApiObject) =>
    put<unknown>(`/teachers/me/courses/${idPath(courseId)}`, body),
  deleteCourse: (courseId: string | number) =>
    del<void>(`/teachers/me/courses/${idPath(courseId)}`),
  publishCourse: (courseId: string | number) =>
    put<unknown>(`/teachers/me/courses/${idPath(courseId)}/publish`),
  unpublishCourse: (courseId: string | number) =>
    put<unknown>(`/teachers/me/courses/${idPath(courseId)}/unpublish`),
  uploadCourseCover: (courseId: string | number, file: File) =>
    upload<unknown>(`/teachers/me/courses/${idPath(courseId)}/cover`, file),
  deleteCourseCover: (courseId: string | number) =>
    del<unknown>(`/teachers/me/courses/${idPath(courseId)}/cover`),
  enrollmentRequests: (query: PageQuery = {}) =>
    get<unknown>(`/teachers/me/enrollment-requests${queryString(query)}`),
  approveEnrollment: (id: string | number) =>
    put<unknown>(`/teachers/me/enrollment-requests/${idPath(id)}/approve`),
  rejectEnrollment: (id: string | number) =>
    put<unknown>(`/teachers/me/enrollment-requests/${idPath(id)}/reject`),
  createModule: (courseId: string | number, body: ApiObject) =>
    post<unknown>(`/teachers/me/courses/${idPath(courseId)}/modules`, body),
  updateModule: (moduleId: string | number, body: ApiObject) =>
    put<unknown>(`/teachers/me/modules/${idPath(moduleId)}`, body),
  deleteModule: (moduleId: string | number) =>
    del<void>(`/teachers/me/modules/${idPath(moduleId)}`),
  reorderModules: (courseId: string | number, body: ApiObject) =>
    put<void>(`/teachers/me/courses/${idPath(courseId)}/modules/reorder`, body),
  createLesson: (moduleId: string | number, body: ApiObject) =>
    post<unknown>(`/teachers/me/modules/${idPath(moduleId)}/lessons`, body),
  updateLesson: (lessonId: string | number, body: ApiObject) =>
    put<unknown>(`/teachers/me/lessons/${idPath(lessonId)}`, body),
  deleteLesson: (lessonId: string | number) =>
    del<void>(`/teachers/me/lessons/${idPath(lessonId)}`),
  reorderLessons: (moduleId: string | number, body: ApiObject) =>
    put<void>(`/teachers/me/modules/${idPath(moduleId)}/lessons/reorder`, body),
  uploadLessonVideo: (lessonId: string | number, file: File) =>
    upload<unknown>(`/teachers/me/lessons/${idPath(lessonId)}/video`, file),
  setLessonYoutubeVideo: (lessonId: string | number, body: ApiObject) =>
    put<unknown>(`/teachers/me/lessons/${idPath(lessonId)}/video`, body),
  deleteLessonVideo: (lessonId: string | number) =>
    del<void>(`/teachers/me/lessons/${idPath(lessonId)}/video`),
  uploadLessonResource: (
    lessonId: string | number,
    file: File,
    name?: string,
  ) =>
    upload<unknown>(
      `/teachers/me/lessons/${idPath(lessonId)}/resources`,
      file,
      name ? { name } : {},
    ),
  addExternalLessonResource: (
    lessonId: string | number,
    name: string,
    externalUrl: string,
  ) => {
    const form = new FormData();
    form.set("name", name);
    form.set("externalUrl", externalUrl);
    return apiRequest<unknown>(
      `/teachers/me/lessons/${idPath(lessonId)}/resources`,
      { method: "POST", body: form },
    );
  },
  deleteResource: (resourceId: string | number) =>
    del<void>(`/teachers/me/resources/${idPath(resourceId)}`),
};

export const coursesApi = {
  list: (query: PageQuery = {}) =>
    get<unknown>(`/courses${queryString(query)}`),
  detail: (courseId: string | number) =>
    get<unknown>(`/courses/${idPath(courseId)}`),
  enroll: (courseId: string | number) =>
    post<unknown>(`/courses/${idPath(courseId)}/enroll`),
};

export const enrollmentsApi = {
  adminList: (query: PageQuery = {}) =>
    get<unknown>(`/admin/enrollments${queryString(query)}`),
  adminApprove: (id: string | number) =>
    put<unknown>(`/admin/enrollments/${idPath(id)}/approve`),
  adminReject: (id: string | number) =>
    put<unknown>(`/admin/enrollments/${idPath(id)}/reject`),
};

export const notificationsApi = {
  list: () => get<unknown>("/notifications"),
  markRead: (id: string | number) =>
    put<void>(`/notifications/${idPath(id)}/read`),
  markAllRead: () => put<void>("/notifications/read-all"),
};

export const quizzesApi = {
  createForLesson: (lessonId: string | number, body: ApiObject) =>
    post<unknown>(`/teachers/me/lessons/${idPath(lessonId)}/quiz`, body),
  forLesson: (lessonId: string | number) =>
    get<unknown>(`/lessons/${idPath(lessonId)}/quiz`),
  update: (quizId: string | number, body: ApiObject) =>
    put<unknown>(`/teachers/me/quizzes/${idPath(quizId)}`, body),
  delete: (quizId: string | number) =>
    del<void>(`/teachers/me/quizzes/${idPath(quizId)}`),
  publish: (quizId: string | number) =>
    put<unknown>(`/teachers/me/quizzes/${idPath(quizId)}/publish`),
  unpublish: (quizId: string | number) =>
    put<unknown>(`/teachers/me/quizzes/${idPath(quizId)}/unpublish`),
  addQuestion: (quizId: string | number, body: ApiObject) =>
    post<unknown>(`/teachers/me/quizzes/${idPath(quizId)}/questions`, body),
  updateQuestion: (questionId: string | number, body: ApiObject) =>
    put<unknown>(`/teachers/me/questions/${idPath(questionId)}`, body),
  deleteQuestion: (questionId: string | number) =>
    del<void>(`/teachers/me/questions/${idPath(questionId)}`),
  reorderQuestions: (quizId: string | number, body: ApiObject) =>
    put<void>(`/teachers/me/quizzes/${idPath(quizId)}/questions/reorder`, body),
  addOption: (questionId: string | number, body: ApiObject) =>
    post<unknown>(`/teachers/me/questions/${idPath(questionId)}/options`, body),
  updateOption: (optionId: string | number, body: ApiObject) =>
    put<unknown>(`/teachers/me/options/${idPath(optionId)}`, body),
  deleteOption: (optionId: string | number) =>
    del<void>(`/teachers/me/options/${idPath(optionId)}`),
  submitAttempt: (quizId: string | number, body: ApiObject) =>
    post<unknown>(`/quizzes/${idPath(quizId)}/attempts`, body),
  attempts: (quizId: string | number) =>
    get<unknown>(`/quizzes/${idPath(quizId)}/attempts`),
};

export const subjectsApi = {
  list: (academicYear?: string | number) =>
    get<unknown>(`/subjects${queryString({ academicYear })}`),
};

export const academicYearsApi = { list: () => get<unknown>("/academic-years") };
