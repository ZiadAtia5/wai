export const mockTeacherEnrollmentRequests = [
  {
    courseId: "physics-101",
    courseTitle: "الفيزياء العامة - المستوى الأول",
    category: "الفيزياء",
    thumbnail: "",
    requests: [
      {
        requestId: "request-101",
        studentName: "أحمد حسن",
        studentEmail: "ahmed@example.com",
        studentPhone: "+201000000001",
        requestedAt: "2026-10-15T14:30:00Z",
        status: "pending",
        note: "أتطلع إلى بدء هذه الدورة.",
      },
      {
        requestId: "request-102",
        studentName: "مريم علي",
        studentEmail: "mariam@example.com",
        requestedAt: "2026-10-15T16:05:00Z",
        status: "pending",
        note: "أرغب في الانضمام إلى أقرب مجموعة متاحة.",
      },
      {
        requestId: "request-103",
        studentName: "سلمى محمود",
        studentEmail: "salma@example.com",
        requestedAt: "2026-10-16T08:45:00Z",
        status: "pending",
        note: "",
      },
    ],
  },
  {
    courseId: "web-development",
    courseTitle: "أساسيات تطوير الويب",
    category: "علوم الحاسب",
    thumbnail: "",
    requests: [
      {
        requestId: "request-201",
        studentName: "عمر إبراهيم",
        studentEmail: "omar@example.com",
        requestedAt: "2026-10-14T10:15:00Z",
        status: "approved",
        note: "",
      },
    ],
  },
  {
    courseId: "chemistry-basics",
    courseTitle: "أساسيات الكيمياء",
    category: "الكيمياء",
    thumbnail: "",
    requests: [],
  },
] as const
