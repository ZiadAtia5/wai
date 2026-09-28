import { getPublicTeachers } from "../api/catalog";
import { teachersApi } from "../api/endpoints";

import PublicCatalogPage from "./PublicCatalogPage";

export default function PublicTeachersPage() {
  return (
    <PublicCatalogPage
      title="المعلمون"
      description="المعلمون المسجلون في منصة وَعي"
      emptyMessage="لا توجد ملفات معلمين متاحة حالياً."
      load={getPublicTeachers}
      loadDetail={teachersApi.byId}
      loadRelated={(id) => teachersApi.courses(id)}
    />
  );
}
