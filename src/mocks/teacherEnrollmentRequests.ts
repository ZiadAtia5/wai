export const mockTeacherEnrollmentRequests = [
  {
    courseId: "physics-101",
    courseTitle: "General Physics - Level 1",
    category: "Physics",
    thumbnail: "",
    requests: [
      {
        requestId: "request-101",
        studentName: "Ahmed Hassan",
        studentEmail: "ahmed@example.com",
        studentPhone: "+201000000001",
        requestedAt: "2026-10-15T14:30:00Z",
        status: "pending",
        note: "Looking forward to starting this course!",
      },
      {
        requestId: "request-102",
        studentName: "Mariam Ali",
        studentEmail: "mariam@example.com",
        requestedAt: "2026-10-15T16:05:00Z",
        status: "pending",
        note: "I would like to join the next available group.",
      },
      {
        requestId: "request-103",
        studentName: "Salma Mahmoud",
        studentEmail: "salma@example.com",
        requestedAt: "2026-10-16T08:45:00Z",
        status: "pending",
        note: "",
      },
    ],
  },
  {
    courseId: "web-development",
    courseTitle: "Web Development Fundamentals",
    category: "Computer Science",
    thumbnail: "",
    requests: [
      {
        requestId: "request-201",
        studentName: "Omar Ibrahim",
        studentEmail: "omar@example.com",
        requestedAt: "2026-10-14T10:15:00Z",
        status: "approved",
        note: "",
      },
    ],
  },
  {
    courseId: "chemistry-basics",
    courseTitle: "Chemistry Basics",
    category: "Chemistry",
    thumbnail: "",
    requests: [],
  },
] as const
