import { useEffect, useState } from "react";

import { teachersApi } from "../api/endpoints";

import { resolveApiImageUrl } from "../api/client";

type RecordValue = Record<string, unknown>;

const teacherAvatarRequests = new Map<string, Promise<string>>();

function asRecord(value: unknown): RecordValue | null {
  return typeof value === "object" && value !== null
    ? (value as RecordValue)
    : null;
}

function unwrap(value: unknown): unknown {
  let current = value;

  for (let depth = 0; depth < 5; depth += 1) {
    const response = asRecord(current);

    if (!response || !("data" in response)) break;

    current = response.data;
  }

  return current;
}

function relatedRecords(record: RecordValue): RecordValue[] {
  const queue = [record];

  const visited = new Set<RecordValue>();

  const result: RecordValue[] = [];

  while (queue.length && visited.size < 12) {
    const current = queue.shift();

    if (!current || visited.has(current)) continue;

    visited.add(current);

    result.push(current);

    for (const key of [
      "teacher",

      "instructor",

      "teacherProfile",

      "instructorProfile",

      "profile",

      "user",

      "owner",
    ]) {
      const related = asRecord(current[key]);

      if (related) queue.push(related);
    }
  }

  return result;
}

function imageFromRecord(record: RecordValue): string {
  for (const candidate of relatedRecords(record)) {
    for (const key of [
      "teacherAvatarUrl",

      "instructorAvatarUrl",

      "avatarUrl",

      "profileImageUrl",

      "profile_image_url",

      "profileImage",

      "imageUrl",

      "photoUrl",

      "image",

      "avatar",
    ]) {
      const value = candidate[key];

      if (typeof value === "string" && value.trim()) return value.trim();

      const nested = asRecord(value);

      const nestedUrl = nested?.url ?? nested?.src;

      if (typeof nestedUrl === "string" && nestedUrl.trim()) {
        return nestedUrl.trim();
      }
    }
  }

  return "";
}

function teacherIdFromRecord(record: RecordValue): string {
  for (const candidate of relatedRecords(record)) {
    const id =
      candidate.teacherId ??
      candidate.instructorId ??
      (candidate !== record ? (candidate.id ?? candidate.userId) : undefined);

    if (typeof id === "string" || typeof id === "number") {
      return String(id);
    }
  }

  return "";
}

function loadTeacherAvatar(teacherId: string): Promise<string> {
  const cachedRequest = teacherAvatarRequests.get(teacherId);

  if (cachedRequest) return cachedRequest;

  const request = teachersApi

    .publicById(teacherId)

    .then((response) => {
      const teacher = asRecord(unwrap(response));

      return teacher ? imageFromRecord(teacher) : "";
    })

    .catch((error: unknown) => {
      teacherAvatarRequests.delete(teacherId);

      return Promise.reject(error);
    });

  teacherAvatarRequests.set(teacherId, request);

  return request;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  return parts.length > 1
    ? `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`
    : (parts[0]?.slice(0, 2) ?? "?");
}

export default function CourseTeacherAvatar({
  course,

  name,
}: {
  course: RecordValue;

  name: string;
}) {
  const directImage = imageFromRecord(course);

  const teacherId = teacherIdFromRecord(course);

  const [loadedImage, setLoadedImage] = useState("");

  const [failedImage, setFailedImage] = useState("");

  const imageUrl = directImage || loadedImage;

  useEffect(() => {
    setLoadedImage("");

    if (directImage || !teacherId) return;

    let active = true;

    loadTeacherAvatar(teacherId)
      .then((image) => {
        if (active) setLoadedImage(image);
      })

      .catch(() => {
        if (active) setLoadedImage("");
      });

    return () => {
      active = false;
    };
  }, [directImage, teacherId]);

  const resolvedImage = imageUrl ? resolveApiImageUrl(imageUrl, 128) : "";

  return (
    <span className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-emerald-100/80 text-[11px] font-bold text-emerald-900 shadow-sm ring-2 ring-emerald-500/20">
      {resolvedImage && failedImage !== imageUrl ? (
        <img
          src={resolvedImage}
          alt=""
          className="size-full object-cover"
          loading="lazy"
          decoding="async"
          width={64}
          height={64}
          onError={() => setFailedImage(imageUrl)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
