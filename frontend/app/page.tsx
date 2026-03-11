import Link from "next/link";

type RequestType = {
  path: string;
  title: string;
  description: string;
  icon: string;
};

const requestTypes: RequestType[] = [
  {
    path: "/requests/new/building",
    title: "คำขอซ่อมแซมอาคาร",
    description: "ส่งคำขอซ่อมแซมหรือปรับปรุงอาคารสำนักงาน",
    icon: "🏢",
  },
  {
    path: "/requests/new/vehicle",
    title: "คำขอซ่อมรถยนต์",
    description: "ส่งคำขอซ่อมแซมหรือบริการรถยนต์บริษัท",
    icon: "🚗",
  },
  {
    path: "/requests/new/messenger",
    title: "คำขอใช้บริการส่งเอกสาร",
    description: "ขอใช้บริการส่งเอกสารหรือพัสดุภายในบริษัท",
    icon: "📬",
  },
  {
    path: "/requests/new/document",
    title: "คำขอเอกสาร",
    description: "ขอเอกสารต่างๆ เช่น ใบรับรอง ใบลา เป็นต้น",
    icon: "📄",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-slate-900">ยินดีต้อนรับสู่ HR Buddy</h1>
          <p className="mx-auto max-w-2xl text-xl text-slate-600">
            ระบบจัดการคำขอและบริการสำหรับพนักงานบริษัท Construction Lines
            ส่งคำขอของคุณได้อย่างง่ายดายและติดตามสถานะได้แบบเรียลไทม์
          </p>
        </div>

        <div className="mb-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {requestTypes.map((request) => (
            <Link
              key={request.path}
              href={request.path}
              className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-lg"
            >
              <div className="mb-4 text-3xl">{request.icon}</div>
              <h3 className="mb-2 text-lg font-semibold text-slate-900 transition group-hover:text-blue-600">
                {request.title}
              </h3>
              <p className="text-sm text-slate-600">{request.description}</p>
            </Link>
          ))}
        </div>

        <div className="flex justify-center">
          <Link
            href="/my-requests"
            className="inline-flex items-center rounded-xl bg-[#0e2d4c] px-7 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-px hover:bg-[#123d66]"
          >
            คำขอของฉันทั้งหมด
          </Link>
        </div>
      </div>
    </main>
  );
}
