import { ArrowLeft, ClipboardCheck, GraduationCap } from "lucide-react"
import type { NavigateFn } from "../../../types"

export default function AudienceSection({ navigate }: { navigate: NavigateFn }) {
  return (
    <section className="relative isolate overflow-hidden bg-[radial-gradient(ellipse_at_90%_15%,rgba(66,168,121,.1),transparent_30%)] py-16 sm:py-20">
      <div aria-hidden className="pointer-events-none absolute -right-20 bottom-0 -z-10 size-72 rounded-full bg-[#e8f4eb]/70 blur-3xl" />
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="inline-flex items-center gap-2 rounded-full border border-[#d8e9dc] bg-white/80 px-3.5 py-1.5 text-sm font-semibold text-nuwa-base"><span className="size-1.5 rounded-full bg-emerald-500" /> مساحة لكل طرف</p><h2 className="mt-3 text-2xl font-bold tracking-tight text-[#143a2c] sm:text-3xl">الطالب والمعلم في رحلة تعلم واحدة</h2></div>
        <p className="max-w-lg text-sm leading-7 text-[#687a70]">أدوات واضحة تساعد الطالب على متابعة دراسته، وتساعد المعلم على تنظيم دوراته ومتابعة طلباته.</p>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="group relative overflow-hidden rounded-[1.5rem] border border-[#dfece2] bg-[linear-gradient(135deg,#fff_55%,#f1f8f2)] p-7 shadow-[0_10px_34px_rgba(18,67,42,.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_44px_rgba(18,67,42,.12)]"><div aria-hidden className="absolute -left-12 -top-16 size-48 rounded-full border border-[#dceee0] transition duration-500 group-hover:scale-110" /><span className="relative grid size-12 place-items-center rounded-2xl bg-[#e6f3e9] text-nuwa-base shadow-sm"><GraduationCap size={24} /></span><h3 className="relative mt-5 text-lg font-bold text-[#17392c]">مساحة الطالب</h3><p className="relative mt-2 max-w-lg text-sm leading-7 text-[#687a70]">تابع الدورات المسجل بها، وارجع إلى الدروس والموارد والاختبارات، وراجع تقدمك في مكان واحد.</p><button type="button" onClick={() => navigate("register")} className="relative mt-5 inline-flex items-center gap-2 rounded-xl bg-nuwa-base px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-nuwa-deep">إنشاء حساب طالب <ArrowLeft size={16} /></button></article>
        <article className="group relative overflow-hidden rounded-[1.5rem] border border-[#dfece2] bg-[linear-gradient(135deg,#fff_55%,#f5f4fa)] p-7 shadow-[0_10px_34px_rgba(18,67,42,.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_44px_rgba(18,67,42,.12)]"><div aria-hidden className="absolute -left-12 -top-16 size-48 rounded-full border border-[#e5e1f0] transition duration-500 group-hover:scale-110" /><span className="relative grid size-12 place-items-center rounded-2xl bg-[#efedf7] text-[#71639c] shadow-sm"><ClipboardCheck size={23} /></span><h3 className="relative mt-5 text-lg font-bold text-[#17392c]">مساحة المعلم</h3><p className="relative mt-2 max-w-lg text-sm leading-7 text-[#687a70]">نظّم الدورات والمحتوى التعليمي، وراجع طلبات التحاق الطلاب، وتابع ما يخص العملية التعليمية.</p><button type="button" onClick={() => navigate("public:teachers")} className="relative mt-5 inline-flex items-center gap-2 rounded-xl border border-[#d9e7dc] bg-white px-4 py-2.5 text-sm font-semibold text-nuwa-base transition hover:border-[#a9cfb3] hover:bg-[#f3f8f4]">تعرّف على المعلمين <ArrowLeft size={16} /></button></article>
      </div>
      </div>
    </section>
  )
}
