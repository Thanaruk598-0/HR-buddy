"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import {
  getDepartments,
  getProblemCategories,
  type ReferenceListItem,
} from "@/lib/api/reference";
import {
  createBuildingRequest,
  type BuildingSide,
  type CreateBuildingRequestPayload,
  type Urgency,
} from "@/lib/api/requests";
import {
  completeMyAttachmentUpload,
  issueMyAttachmentUploadTicket,
  uploadFileToPresignedUrl,
  type FileKind,
} from "@/lib/api/my-requests";
import {
  getAcceptMimeTypes,
  inferFileKindFromMimeType,
  resolveUploadMimeType,
  validateAttachmentCandidate,
} from "@/lib/attachments/attachment-policy";
import {
  SelectField,
  TextField,
  TextareaField,
} from "@/components/ui/form-controls";
import { VideoPreviewModal } from "@/components/ui/video-preview-modal";
import { ImagePreviewModal } from "@/components/ui/image-preview-modal";
import { DocumentPreviewModal } from "@/components/ui/document-preview-modal";
import { getDocumentTypeLabel } from "@/lib/attachments/document-type-label";
import Link from "next/link";
import Image from "next/image";

const MAX_ATTACHMENTS = 5;

const urgencyOptions: Array<{
  value: Urgency;
  label: string;
  color: string;
  activeBg: string;
  activeBorder: string;
  icon: string;
}> = [
  {
    value: "LOW",
    label: "ต่ำ",
    color: "text-green-600",
    activeBg: "bg-green-600 text-white",
    activeBorder: "border-green-600",
    icon: "🟢",
  },
  {
    value: "NORMAL",
    label: "ปกติ",
    color: "text-blue-600",
    activeBg: "bg-blue-600 text-white",
    activeBorder: "border-blue-600",
    icon: "🔵",
  },
  {
    value: "HIGH",
    label: "สูง",
    color: "text-orange-600",
    activeBg: "bg-orange-600 text-white",
    activeBorder: "border-orange-600",
    icon: "🟠",
  },
  {
    value: "CRITICAL",
    label: "เร่งด่วน",
    color: "text-red-600",
    activeBg: "bg-red-600 text-white",
    activeBorder: "border-red-600",
    icon: "🔴",
  },
];

const buildingOptions: Array<{
  value: BuildingSide;
  label: string;
  icon: string;
}> = [
  { value: "FRONT", label: "อาคารหน้า", icon: "🏢" },
  { value: "BACK", label: "อาคารหลัง", icon: "🏗️" },
];

const PROBLEM_CATEGORY_ORDER = [
  "pc_air",
  "pc_electric",
  "pc_plumbing",
  "pc_network",
  "pc_door_lock",
  "pc_cleaning",
  "pc_other",
] as const;

const problemCategoryOrderIndex = new Map<string, number>(
  PROBLEM_CATEGORY_ORDER.map((id, index) => [id, index]),
);

function sortProblemCategoriesByBusinessOrder(items: ReferenceListItem[]) {
  return [...items].sort((a, b) => {
    const aIndex =
      problemCategoryOrderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bIndex =
      problemCategoryOrderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.name.localeCompare(b.name, "th");
  });
}

const attachmentAccept = [
  getAcceptMimeTypes("IMAGE"),
  getAcceptMimeTypes("VIDEO"),
  getAcceptMimeTypes("DOCUMENT"),
].join(",");

type FormState = {
  employeeName: string;
  departmentId: string;
  departmentOther: string;
  phone: string;
  urgency: Urgency;
  building: BuildingSide;
  floor: number;
  locationDetail: string;
  problemCategoryId: string;
  problemCategoryOther: string;
  description: string;
  additionalDetails: string;
};

type AttachmentCandidate = {
  file: File;
  fileKind: FileKind;
  mimeType: string;
};

type AttachmentPreview = {
  key: string;
  file: File;
  fileKind: FileKind;
  mimeType: string;
  previewUrl: string;
};

const initialState: FormState = {
  employeeName: "",
  departmentId: "",
  departmentOther: "",
  phone: "",
  urgency: "NORMAL",
  building: "FRONT",
  floor: 1,
  locationDetail: "",
  problemCategoryId: "",
  problemCategoryOther: "",
  description: "",
  additionalDetails: "",
};

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function extractPhoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

function formatPhoneDisplay(value: string) {
  const digits = extractPhoneDigits(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function prepareAttachmentCandidates(files: File[]) {
  const candidates: AttachmentCandidate[] = [];
  for (const file of files) {
    const resolvedMimeType = resolveUploadMimeType(file);
    if (!resolvedMimeType)
      return {
        ok: false as const,
        message: `รองรับเฉพาะไฟล์รูปภาพ วิดีโอ และเอกสาร เท่านั้น`,
      };
    const inferredFileKind = inferFileKindFromMimeType(resolvedMimeType);
    if (!inferredFileKind)
      return {
        ok: false as const,
        message: `รองรับเฉพาะไฟล์รูปภาพ วิดีโอ และเอกสาร เท่านั้น`,
      };
    const validation = validateAttachmentCandidate(file, inferredFileKind);
    if (!validation.ok)
      return {
        ok: false as const,
        message: `${file.name}: ${validation.message}`,
      };
    candidates.push({
      file,
      fileKind: inferredFileKind,
      mimeType: validation.mimeType,
    });
  }
  return { ok: true as const, candidates };
}

/* ─── Divider ─── */

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-slate-200" />
      <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
        {label}
      </span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

/* ─── Field helpers ─── */

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#b62026]">
      <svg
        className="h-3.5 w-3.5 shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      {message}
    </p>
  );
}

function RequiredMark() {
  return <span className="ml-0.5 text-[#b62026]">*</span>;
}

/* ─── Section Panel ─── */

function Panel({
  stepNumber,
  title,
  children,
}: {
  stepNumber: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      {/* Panel header */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5 sm:px-6">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0e2d4c] text-[11px] font-bold text-white">
          {stepNumber}
        </span>
        <h2 className="text-sm font-bold text-[#0e2d4c]">{title}</h2>
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </div>
  );
}

/* ─── Toggle Button Group ─── */

function ToggleButton({
  active,
  onClick,
  children,
  activeClass,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-all duration-150 ${
        active
          ? (activeClass ?? "border-[#0e2d4c] bg-[#0e2d4c] text-white")
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

/* ─── Main Page ─── */

export default function Page() {
  const router = useRouter();
  const [departments, setDepartments] = useState<ReferenceListItem[]>([]);
  const [problemCategories, setProblemCategories] = useState<
    ReferenceListItem[]
  >([]);
  const [form, setForm] = useState<FormState>(initialState);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentNotice, setAttachmentNotice] = useState<string | null>(null);
  const [loadingReferences, setLoadingReferences] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<AttachmentPreview | null>(
    null,
  );
  const [imagePreview, setImagePreview] = useState<AttachmentPreview | null>(
    null,
  );
  const [documentPreview, setDocumentPreview] = useState<AttachmentPreview | null>(
    null,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    async function loadReferences() {
      setLoadingReferences(true);
      setErrorMessage(null);
      try {
        const [departmentResult, problemCategoryResult] = await Promise.all([
          getDepartments(),
          getProblemCategories(),
        ]);
        if (!active) return;
        setDepartments(departmentResult.items);
        setProblemCategories(
          sortProblemCategoriesByBusinessOrder(problemCategoryResult.items),
        );
      } catch (error) {
        if (!active) return;
        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : "ไม่สามารถโหลดข้อมูลอ้างอิงได้",
        );
      } finally {
        if (active) setLoadingReferences(false);
      }
    }
    void loadReferences();
    return () => {
      active = false;
    };
  }, []);

  const isOtherCategory = useMemo(
    () => form.problemCategoryId === "pc_other",
    [form.problemCategoryId],
  );
  const isOtherDepartment = useMemo(
    () => form.departmentId === "dept_other",
    [form.departmentId],
  );
  const selectedProblemCategory = useMemo(
    () =>
      problemCategories.find((c) => c.id === form.problemCategoryId) ?? null,
    [problemCategories, form.problemCategoryId],
  );

  const attachmentPreviews = useMemo<AttachmentPreview[]>(() => {
    return attachmentFiles
      .map((file) => {
        const mimeType = resolveUploadMimeType(file);
        if (!mimeType) return null;
        const inferredFileKind = inferFileKindFromMimeType(mimeType);
        if (!inferredFileKind) return null;
        return {
          key: fileKey(file),
          file,
          fileKind: inferredFileKind,
          mimeType,
          previewUrl: URL.createObjectURL(file),
        } satisfies AttachmentPreview;
      })
      .filter((item): item is AttachmentPreview => item !== null);
  }, [attachmentFiles]);

  useEffect(() => {
    return () => {
      for (const p of attachmentPreviews) URL.revokeObjectURL(p.previewUrl);
    };
  }, [attachmentPreviews]);

  const onChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear field error when user starts typing/selecting
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const handlePhoneChange = (value: string) => {
    onChange("phone", formatPhoneDisplay(value));
    // Clear phone error when user starts typing
    if (fieldErrors.phone) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.phone;
        return newErrors;
      });
    }
  };

  const validateBeforeSubmit = () => {
    const errors: Record<string, string> = {};
    if (!form.employeeName.trim()) errors.employeeName = "กรุณากรอกชื่อพนักงาน";
    if (!form.departmentId) errors.departmentId = "กรุณาเลือกแผนก";
    if (isOtherDepartment && !form.departmentOther.trim())
      errors.departmentOther = "กรุณากรอกชื่อแผนกอื่น";
    if (extractPhoneDigits(form.phone).length !== 10)
      errors.phone = "หมายเลขโทรศัพท์ต้องมีตัวเลข 10 หลัก";
    if (!form.locationDetail.trim())
      errors.locationDetail = "กรุณากรอกรายละเอียดสถานที่";
    if (!form.problemCategoryId)
      errors.problemCategoryId = "กรุณาเลือกประเภทปัญหา";
    if (isOtherCategory && !form.problemCategoryOther.trim())
      errors.problemCategoryOther = "กรุณากรอกประเภทปัญหาอื่น";
    if (!form.description.trim()) errors.description = "กรุณากรอกคำอธิบายปัญหา";
    if (attachmentFiles.length === 0)
      errors.attachments = "ไฟล์แนบเป็นข้อมูลที่จำเป็น";
    if (attachmentFiles.length > MAX_ATTACHMENTS)
      errors.attachments = `สูงสุด ${MAX_ATTACHMENTS} ไฟล์ต่อคำขอ`;
    const av = prepareAttachmentCandidates(attachmentFiles);
    if (!av.ok) errors.attachments = av.message;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleReset = () => {
    setForm(initialState);
    setAttachmentFiles([]);
    setAttachmentNotice(null);
    setErrorMessage(null);
    setVideoPreview(null);
    setImagePreview(null);
    setDocumentPreview(null);
    setFieldErrors({});
  };

  const handleAttachmentPick = (files: File[]) => {
    if (files.length === 0) return;
    const merged = [...attachmentFiles];
    const warnings: string[] = [];
    for (const file of files) {
      const key = fileKey(file);
      if (merged.some((e) => fileKey(e) === key)) {
        warnings.push(`ข้ามไฟล์ซ้ำ: ${file.name}`);
        continue;
      }
      if (merged.length >= MAX_ATTACHMENTS) {
        warnings.push(`สูงสุด ${MAX_ATTACHMENTS} ไฟล์ ข้ามไฟล์ที่เหลือ`);
        break;
      }
      const mimeType = resolveUploadMimeType(file);
      if (!mimeType) {
        warnings.push(`รองรับเฉพาะไฟล์รูปภาพ วิดีโอ และเอกสาร เท่านั้น`);
        continue;
      }
      const fileKind = inferFileKindFromMimeType(mimeType);
      if (!fileKind) {
        warnings.push(`รองรับเฉพาะไฟล์รูปภาพ วิดีโอ และเอกสาร เท่านั้น`);
        continue;
      }
      const validation = validateAttachmentCandidate(file, fileKind);
      if (!validation.ok) {
        warnings.push(`${file.name}: ${validation.message}`);
        continue;
      }
      merged.push(file);
    }
    setAttachmentFiles(merged);
    setAttachmentNotice(warnings.length > 0 ? warnings.join(" | ") : null);
    // Clear attachments error when files are successfully added
    if (fieldErrors.attachments && merged.length > 0) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.attachments;
        return newErrors;
      });
    }
  };

  const handleRemoveAttachment = (targetKey: string) => {
    setAttachmentFiles((prev) => prev.filter((f) => fileKey(f) !== targetKey));
    setVideoPreview((prev) => (prev?.key === targetKey ? null : prev));
    setImagePreview((prev) => (prev?.key === targetKey ? null : prev));
    setDocumentPreview((prev) => (prev?.key === targetKey ? null : prev));
  };

  const handleOpenDocumentPreview = (preview: AttachmentPreview) => {
    setDocumentPreview(preview);
  };

  const handleDownloadDocumentFile = (preview: AttachmentPreview) => {
    const link = document.createElement("a");
    link.href = preview.previewUrl;
    link.download = preview.file.name;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDocumentAction = (preview: AttachmentPreview) => {
    if (preview.mimeType.toLowerCase() === "application/pdf") {
      handleOpenDocumentPreview(preview);
      return;
    }

    handleDownloadDocumentFile(preview);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    if (!validateBeforeSubmit()) return;

    const attachmentCandidatesResult =
      prepareAttachmentCandidates(attachmentFiles);
    const payload: CreateBuildingRequestPayload = {
      employeeName: form.employeeName.trim(),
      departmentId: form.departmentId,
      phone: extractPhoneDigits(form.phone),
      urgency: form.urgency,
      building: form.building,
      floor: Number(form.floor),
      locationDetail: form.locationDetail.trim(),
      problemCategoryId: form.problemCategoryId,
      description: form.description.trim(),
    };
    if (isOtherDepartment)
      payload.departmentOther = form.departmentOther.trim();
    if (isOtherCategory)
      payload.problemCategoryOther = form.problemCategoryOther.trim();
    if (form.additionalDetails.trim())
      payload.additionalDetails = form.additionalDetails.trim();

    setSubmitting(true);
    let createdRequestNo: string | null = null;
    try {
      const createResult = await createBuildingRequest(payload);
      createdRequestNo = createResult.requestNo;
      for (const candidate of attachmentCandidatesResult.candidates!) {
        const ticket = await issueMyAttachmentUploadTicket(createResult.id, {
          fileKind: candidate.fileKind,
          fileName: candidate.file.name,
          mimeType: candidate.mimeType,
          fileSize: candidate.file.size,
        });
        await uploadFileToPresignedUrl(ticket, candidate.file);
        await completeMyAttachmentUpload(createResult.id, ticket.uploadToken);
      }
      router.push(
        `/requests/success/${encodeURIComponent(createResult.requestNo)}`,
      );
    } catch (error) {
      if (createdRequestNo) {
        router.push(
          `/requests/success/${encodeURIComponent(createdRequestNo)}?attachments=partial`,
        );
        return;
      }
      setErrorMessage(
        error instanceof ApiError ? error.message : "ไม่สามารถส่งคำขอซ่อมได้",
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ══════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════ */
  return (
    <main className="min-h-screen bg-slate-50">
      {/* ── Page Header ── */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <nav className="mb-4 flex items-center gap-1.5 text-sm text-slate-400">
            <Link href="/" className="transition hover:text-slate-700">
              หน้าแรก
            </Link>
            <svg
              className="h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            <span className="text-slate-600">คำขอซ่อมแซมอาคาร</span>
          </nav>

          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#0e2d4c]">
              <span className="text-2xl">🏢</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#0e2d4c] sm:text-2xl">
                แบบฟอร์มแจ้งซ่อมอาคาร
              </h1>
              <p className="text-sm text-slate-500">
                กรอกข้อมูลให้ครบถ้วนและแนบไฟล์แสดงปัญหา
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Form Body ── */}
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {loadingReferences ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* ══ Panel 1: Reporter info ══ */}
            <Panel stepNumber={1} title="ข้อมูลผู้แจ้ง">
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-3">
                {/* Name */}
                <div className="sm:col-span-1">
                  <TextField
                    id="employeeName"
                    label="ชื่อ-นามสกุล"
                    required
                    value={form.employeeName}
                    onChange={(e) => onChange("employeeName", e.target.value)}
                    placeholder="นายสมชาย ใจดี"
                    maxLength={120}
                  />
                  <FieldError message={fieldErrors.employeeName} />
                </div>

                {/* Department */}
                <div className="sm:col-span-1">
                  <SelectField
                    id="departmentId"
                    label="แผนก"
                    required
                    value={form.departmentId}
                    onChange={(e) => onChange("departmentId", e.target.value)}
                  >
                    <option value="">เลือกแผนก</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </SelectField>
                  <FieldError message={fieldErrors.departmentId} />
                </div>

                {/* Phone — NO pattern attribute to avoid browser native validation message */}
                <div className="sm:col-span-1">
                  <TextField
                    id="phone"
                    label="เบอร์โทรศัพท์"
                    required
                    value={form.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="012-345-6789"
                    inputMode="numeric"
                    maxLength={12}
                  />
                  <FieldError message={fieldErrors.phone} />
                </div>

                {/* Department other — conditional */}
                {isOtherDepartment && (
                  <div className="sm:col-span-3">
                    <TextField
                      id="departmentOther"
                      label="ระบุชื่อแผนก"
                      required
                      value={form.departmentOther}
                      onChange={(e) =>
                        onChange("departmentOther", e.target.value)
                      }
                      placeholder="ชื่อแผนก"
                      maxLength={120}
                    />
                    <FieldError message={fieldErrors.departmentOther} />
                  </div>
                )}
              </div>
            </Panel>

            {/* ══ Panel 2: Location ══ */}
            <Panel stepNumber={2} title="สถานที่เกิดปัญหา">
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
                  {/* Building */}
                  <div className="space-y-3">
                    <p className="text-[13px] font-semibold text-slate-700">
                      อาคาร <RequiredMark />
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {buildingOptions.map((opt) => (
                        <ToggleButton
                          key={opt.value}
                          active={form.building === opt.value}
                          onClick={() => onChange("building", opt.value)}
                        >
                          <span>{opt.icon}</span>
                          {opt.label}
                        </ToggleButton>
                      ))}
                    </div>
                  </div>

                  {/* Floor */}
                  <div className="space-y-3">
                    <p className="text-[13px] font-semibold text-slate-700">
                      ชั้น <RequiredMark />
                    </p>
                    <div className="grid grid-cols-4 gap-3">
                      {[1, 2, 3, 4].map((floor) => (
                        <button
                          key={floor}
                          type="button"
                          onClick={() => onChange("floor", floor)}
                          className={`h-12 w-full rounded-xl border-2 text-sm font-bold transition-all duration-150 ${
                            form.floor === floor
                              ? "border-[#0e2d4c] bg-[#0e2d4c] text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {floor}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Location detail */}
                <div className="space-y-2">
                  <TextField
                    id="locationDetail"
                    label="รายละเอียดสถานที่"
                    required
                    value={form.locationDetail}
                    onChange={(e) => onChange("locationDetail", e.target.value)}
                    placeholder="เช่น ด้านหน้าลิฟต์ ห้องน้ำชาย ห้องประชุม"
                    maxLength={200}
                  />
                  <FieldError message={fieldErrors.locationDetail} />
                </div>
              </div>
            </Panel>

            {/* ══ Panel 3: Problem details ══ */}
            <Panel stepNumber={3} title="รายละเอียดปัญหา">
              <div className="space-y-5">
                {/* Urgency */}
                <div>
                  <p className="mb-2 text-[13px] font-semibold text-slate-700">
                    ระดับความเร่งด่วน <RequiredMark />
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {urgencyOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange("urgency", opt.value)}
                        className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-all duration-150 ${
                          form.urgency === opt.value
                            ? `${opt.activeBg} ${opt.activeBorder}`
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-base leading-none">
                          {opt.icon}
                        </span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Divider label="" />

                {/* Problem category */}
                <div>
                  <SelectField
                    id="problemCategoryId"
                    label="ประเภทปัญหา"
                    required
                    value={form.problemCategoryId}
                    onChange={(e) =>
                      onChange("problemCategoryId", e.target.value)
                    }
                  >
                    <option value="">เลือกประเภทปัญหา</option>
                    {problemCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </SelectField>
                  <FieldError message={fieldErrors.problemCategoryId} />
                  {selectedProblemCategory?.helperText && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-500">
                      <svg
                        className="mt-px h-3.5 w-3.5 shrink-0 text-[#0e2d4c]/50"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {selectedProblemCategory.helperText}
                    </p>
                  )}
                </div>

                {isOtherCategory && (
                  <div>
                    <TextField
                      id="problemCategoryOther"
                      label="ระบุประเภทปัญหาอื่น"
                      required
                      value={form.problemCategoryOther}
                      onChange={(e) =>
                        onChange("problemCategoryOther", e.target.value)
                      }
                      placeholder="กรุณาอธิบายประเภทปัญหา"
                      maxLength={120}
                    />
                    <FieldError message={fieldErrors.problemCategoryOther} />
                  </div>
                )}

                {/* Description */}
                <div>
                  <TextareaField
                    id="description"
                    label="คำอธิบายปัญหา"
                    required
                    value={form.description}
                    onChange={(e) => onChange("description", e.target.value)}
                    placeholder="อธิบายปัญหาที่เกิดขึ้น เริ่มต้นเมื่อไหร่ มีผลกระทบอย่างไร"
                    rows={4}
                    maxLength={2000}
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <FieldError message={fieldErrors.description} />
                    <span className="ml-auto text-[11px] text-slate-400">
                      {form.description.length}/2000
                    </span>
                  </div>
                </div>

                {/* Additional details */}
                <div>
                  <TextareaField
                    id="additionalDetails"
                    label="หมายเหตุเพิ่มเติม (ถ้ามี)"
                    value={form.additionalDetails}
                    onChange={(e) =>
                      onChange("additionalDetails", e.target.value)
                    }
                    placeholder="ข้อมูลเพิ่มเติมอื่นๆ ที่เกี่ยวข้อง"
                    rows={2}
                    maxLength={2000}
                  />
                </div>
              </div>
            </Panel>

            {/* ══ Panel 4: Attachments ══ */}
            <Panel stepNumber={4} title="ไฟล์แนบ">
              <div className="space-y-4">
                {/* Drop zone */}
                <label
                  htmlFor="attachments"
                  className={`flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border-2 border-dashed px-6 py-7 text-center transition-colors duration-150 ${
                    fieldErrors.attachments
                      ? "border-[#b62026]/40 bg-red-50/40"
                      : "border-slate-300 bg-white hover:border-[#0e2d4c]/30 hover:bg-slate-50/60"
                  }`}
                >
                  <svg
                    className="h-8 w-8 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-[#0e2d4c]">
                      แตะเพื่อเลือกไฟล์{" "}
                      <span className="text-[#b62026]">*</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      รูปภาพ · วิดีโอ · เอกสาร &nbsp;|&nbsp; สูงสุด{" "}
                      {MAX_ATTACHMENTS} ไฟล์ · ไม่เกิน 50 MB/ไฟล์
                    </p>
                  </div>
                  <input
                    id="attachments"
                    type="file"
                    multiple
                    accept={attachmentAccept}
                    className="sr-only"
                    onChange={(e) => {
                      const selected = Array.from(e.target.files ?? []);
                      e.currentTarget.value = "";
                      handleAttachmentPick(selected);
                    }}
                  />
                </label>

                <FieldError message={fieldErrors.attachments} />

                {/* Warning notice */}
                {attachmentNotice && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
                    <svg
                      className="mt-px h-3.5 w-3.5 shrink-0 text-amber-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {attachmentNotice}
                  </div>
                )}

                {/* File preview list */}
                {attachmentPreviews.length > 0 && (
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {attachmentPreviews.map((preview) => (
                      <li
                        key={preview.key}
                        className="flex min-h-[11rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                      >
                        {/* File header */}
                        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                          {/* Extension badge */}
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              preview.fileKind === "IMAGE"
                                ? "bg-blue-100 text-blue-700"
                                : preview.fileKind === "VIDEO"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {preview.file.name
                              .split(".")
                              .pop()
                              ?.toUpperCase() ?? preview.fileKind}
                          </span>
                          {/* Filename — truncated safely */}
                          <p
                            className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-700"
                            title={preview.file.name}
                          >
                            {preview.file.name}
                          </p>
                          {/* Remove */}
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(preview.key)}
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-100 hover:text-[#b62026]"
                            aria-label={`ลบ ${preview.file.name}`}
                          >
                            <svg
                              className="h-3 w-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>

                        {/* Preview body */}
                        <div className="p-2.5">
                          {preview.fileKind === "IMAGE" && (
                            <button
                              type="button"
                              onClick={() => setImagePreview(preview)}
                              aria-label={`ดูภาพ ${preview.file.name}`}
                              className="group relative block h-32 w-full overflow-hidden rounded-lg border border-slate-100 bg-slate-100"
                            >
                              <Image
                                src={preview.previewUrl}
                                alt={preview.file.name}
                                fill
                                className="object-cover transition duration-200 group-hover:scale-105"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
                                <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-slate-800 opacity-0 transition group-hover:opacity-100">
                                  ขยาย
                                </span>
                              </div>
                            </button>
                          )}

                          {preview.fileKind === "VIDEO" && (
                            <button
                              type="button"
                              onClick={() => setVideoPreview(preview)}
                              aria-label="เล่นวิดีโอ"
                              className="group relative block h-32 w-full overflow-hidden rounded-lg border border-slate-100 bg-black"
                            >
                              <video
                                className="h-full w-full object-cover opacity-60"
                                muted
                                playsInline
                                preload="metadata"
                              >
                                <source
                                  src={preview.previewUrl}
                                  type={preview.mimeType}
                                />
                              </video>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow transition-transform group-hover:scale-110">
                                  <svg
                                    viewBox="0 0 24 24"
                                    className="h-4 w-4 translate-x-0.5 fill-[#0e2d4c]"
                                  >
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                </span>
                              </div>
                            </button>
                          )}

                          {/* BUG FIX: use button + window.open instead of <a href={blob}> */}
                          {/* to avoid filename display issues and unreliable blob navigation */}
                          {preview.fileKind === "DOCUMENT" && (
                            <button
                              type="button"
                              onClick={() => handleDocumentAction(preview)}
                              className="flex w-full items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-left transition hover:border-[#0e2d4c]/20 hover:bg-[#0e2d4c]/5"
                            >
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0e2d4c]/10 text-[#0e2d4c]">
                                <svg
                                  viewBox="0 0 24 24"
                                  className="h-4 w-4 fill-current"
                                >
                                  <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
                                  <path
                                    d="M14 2v5h5"
                                    className="fill-white/60"
                                  />
                                </svg>
                              </span>
                              <div className="min-w-0 flex-1">
                                {/* Filename with word-break so long names don't overflow */}
                                <p
                                  className="truncate text-[11px] font-semibold leading-tight text-slate-800"
                                  title={preview.file.name}
                                >
                                  {preview.file.name}
                                </p>
                                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                                  {getDocumentTypeLabel(preview.mimeType, preview.file.name)}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-md bg-[#0e2d4c] px-2 py-0.5 text-[10px] font-bold text-white">
                                {preview.mimeType.toLowerCase() === "application/pdf" ? "Open" : "Download"}
                              </span>
                            </button>
                          )}
                        </div>

                        {/* File size */}
                        <div className="border-t border-slate-100 px-3 py-1.5 text-center text-[10px] text-slate-400">
                          {Math.max(
                            preview.file.size / 1024 / 1024,
                            0.01,
                          ).toFixed(2)}{" "}
                          MB
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Panel>

            {/* ══ Error Banner ══ */}
            {errorMessage && (
              <div className="flex items-start gap-3 rounded-xl border border-[#b62026]/20 bg-red-50 px-4 py-3.5">
                <svg
                  className="mt-px h-4 w-4 shrink-0 text-[#b62026]"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="text-sm font-bold text-[#b62026]">
                    เกิดข้อผิดพลาด
                  </p>
                  <p className="mt-0.5 text-xs text-[#b62026]/80">
                    {errorMessage}
                  </p>
                </div>
              </div>
            )}

            {/* ══ Action Bar ══ */}
            <div className="rounded-2xl border border-slate-200 bg-white">
              {/* Reminder strip */}
              <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50/60 px-5 py-2.5">
                <svg
                  className="h-3.5 w-3.5 shrink-0 text-amber-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-xs font-medium text-amber-800">
                  กรุณาตรวจสอบข้อมูลให้ถูกต้องก่อนกดส่งคำขอ
                </p>
              </div>

              <div className="flex flex-col-reverse gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                {/* Reset */}
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  รีเซ็ตฟอร์ม
                </button>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting || loadingReferences}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0e2d4c] px-8 py-2.5 text-sm font-bold text-white transition hover:bg-[#1a4a7a] disabled:opacity-60 sm:w-auto"
                >
                  {submitting ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      กำลังส่งคำขอ...
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                      ส่งคำขอซ่อมแซม
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* ── Modals ── */}
      <ImagePreviewModal
        open={Boolean(imagePreview)}
        title={
          imagePreview
            ? `Image preview: ${imagePreview.file.name}`
            : "Image preview"
        }
        src={imagePreview?.previewUrl ?? ""}
        onClose={() => setImagePreview(null)}
      />
      <DocumentPreviewModal
        open={Boolean(documentPreview)}
        title={
          documentPreview
            ? `Document preview: ${documentPreview.file.name}`
            : "Document preview"
        }
        src={documentPreview?.previewUrl ?? ""}
        mimeType={documentPreview?.mimeType}
        onClose={() => setDocumentPreview(null)}
      />
      <VideoPreviewModal
        open={Boolean(videoPreview)}
        title={
          videoPreview
            ? `Video preview: ${videoPreview.file.name}`
            : "Video preview"
        }
        src={videoPreview?.previewUrl ?? ""}
        onClose={() => setVideoPreview(null)}
      />
    </main>
  );
}


