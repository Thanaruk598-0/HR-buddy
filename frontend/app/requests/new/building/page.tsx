"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { getDepartments, getProblemCategories, type ReferenceListItem } from "@/lib/api/reference";
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
import { Button, SelectField, TextField, TextareaField } from "@/components/ui/form-controls";

const MAX_ATTACHMENTS = 10;

const urgencyOptions: Array<{ value: Urgency; label: string }> = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

const buildingOptions: Array<{ value: BuildingSide; label: string }> = [
  { value: "FRONT", label: "Front building" },
  { value: "BACK", label: "Back building" },
];

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

function prepareAttachmentCandidates(files: File[]) {
  const candidates: AttachmentCandidate[] = [];

  for (const file of files) {
    const resolvedMimeType = resolveUploadMimeType(file);
    if (!resolvedMimeType) {
      return {
        ok: false as const,
        message: `Unsupported file type for ${file.name}`,
      };
    }

    const inferredFileKind = inferFileKindFromMimeType(resolvedMimeType);
    if (!inferredFileKind) {
      return {
        ok: false as const,
        message: `Unsupported file type for ${file.name}`,
      };
    }

    const validation = validateAttachmentCandidate(file, inferredFileKind);
    if (!validation.ok) {
      return {
        ok: false as const,
        message: `${file.name}: ${validation.message}`,
      };
    }

    candidates.push({
      file,
      fileKind: inferredFileKind,
      mimeType: validation.mimeType,
    });
  }

  return {
    ok: true as const,
    candidates,
  };
}

export default function Page() {
  const router = useRouter();
  const [departments, setDepartments] = useState<ReferenceListItem[]>([]);
  const [problemCategories, setProblemCategories] = useState<ReferenceListItem[]>([]);
  const [form, setForm] = useState<FormState>(initialState);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [loadingReferences, setLoadingReferences] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

        if (!active) {
          return;
        }

        setDepartments(departmentResult.items);
        setProblemCategories(problemCategoryResult.items);
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Failed to load reference data");
        }
      } finally {
        if (active) {
          setLoadingReferences(false);
        }
      }
    }

    void loadReferences();

    return () => {
      active = false;
    };
  }, []);

  const isOtherCategory = useMemo(() => form.problemCategoryId === "pc_other", [form.problemCategoryId]);
  const isOtherDepartment = useMemo(() => form.departmentId === "dept_other", [form.departmentId]);

  const onChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validateBeforeSubmit = () => {
    if (!form.employeeName.trim()) {
      return "Employee name is required";
    }

    if (!form.departmentId) {
      return "Department is required";
    }

    if (isOtherDepartment && !form.departmentOther.trim()) {
      return "Please fill the other department name";
    }

    if (!/^\+?\d{9,15}$/.test(form.phone.trim())) {
      return "Phone must be 9-15 digits and may start with +";
    }

    if (!form.locationDetail.trim()) {
      return "Location detail is required";
    }

    if (!form.problemCategoryId) {
      return "Problem category is required";
    }

    if (isOtherCategory && !form.problemCategoryOther.trim()) {
      return "Please fill the other problem category";
    }

    if (!form.description.trim()) {
      return "Description is required";
    }

    if (attachmentFiles.length === 0) {
      return "Attachment is required";
    }

    if (attachmentFiles.length > MAX_ATTACHMENTS) {
      return `Maximum ${MAX_ATTACHMENTS} attachments per request`;
    }

    const attachmentValidation = prepareAttachmentCandidates(attachmentFiles);
    if (!attachmentValidation.ok) {
      return attachmentValidation.message;
    }

    return null;
  };

  const handleReset = () => {
    setForm(initialState);
    setAttachmentFiles([]);
    setErrorMessage(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const validationError = validateBeforeSubmit();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const attachmentCandidatesResult = prepareAttachmentCandidates(attachmentFiles);
    if (!attachmentCandidatesResult.ok) {
      setErrorMessage(attachmentCandidatesResult.message);
      return;
    }

    const payload: CreateBuildingRequestPayload = {
      employeeName: form.employeeName.trim(),
      departmentId: form.departmentId,
      phone: form.phone.trim(),
      urgency: form.urgency,
      building: form.building,
      floor: Number(form.floor),
      locationDetail: form.locationDetail.trim(),
      problemCategoryId: form.problemCategoryId,
      description: form.description.trim(),
    };

    if (isOtherDepartment) {
      payload.departmentOther = form.departmentOther.trim();
    }

    if (isOtherCategory) {
      payload.problemCategoryOther = form.problemCategoryOther.trim();
    }

    if (form.additionalDetails.trim()) {
      payload.additionalDetails = form.additionalDetails.trim();
    }

    setSubmitting(true);

    let createdRequestNo: string | null = null;

    try {
      const createResult = await createBuildingRequest(payload);
      createdRequestNo = createResult.requestNo;

      for (const candidate of attachmentCandidatesResult.candidates) {
        const ticket = await issueMyAttachmentUploadTicket(createResult.id, {
          fileKind: candidate.fileKind,
          fileName: candidate.file.name,
          mimeType: candidate.mimeType,
          fileSize: candidate.file.size,
        });

        await uploadFileToPresignedUrl(ticket, candidate.file);
        await completeMyAttachmentUpload(createResult.id, ticket.uploadToken);
      }

      router.push(`/requests/success/${encodeURIComponent(createResult.requestNo)}`);
    } catch (error) {
      if (createdRequestNo) {
        router.push(`/requests/success/${encodeURIComponent(createdRequestNo)}?attachments=partial`);
        return;
      }

      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to submit building request");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10 md:px-10">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Phase 2 - Employee Core</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Building Repair Request</h1>
        <p className="mt-3 text-slate-700">
          Submit a building issue request with complete details and attachments.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {loadingReferences ? (
          <p className="text-sm text-slate-600">Loading departments and problem categories...</p>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                id="employeeName"
                label="Employee Name"
                required
                value={form.employeeName}
                onChange={(event) => onChange("employeeName", event.target.value)}
                placeholder="Thanaruk T."
                maxLength={120}
              />

              <TextField
                id="phone"
                label="Phone"
                required
                value={form.phone}
                onChange={(event) => onChange("phone", event.target.value)}
                placeholder="+66812345678"
                maxLength={15}
              />

              <SelectField
                id="departmentId"
                label="Department"
                required
                value={form.departmentId}
                onChange={(event) => onChange("departmentId", event.target.value)}
              >
                <option value="">Select department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </SelectField>

              <SelectField
                id="urgency"
                label="Urgency"
                required
                value={form.urgency}
                onChange={(event) => onChange("urgency", event.target.value as Urgency)}
              >
                {urgencyOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </SelectField>

              <SelectField
                id="building"
                label="Building"
                required
                value={form.building}
                onChange={(event) => onChange("building", event.target.value as BuildingSide)}
              >
                {buildingOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </SelectField>

              <SelectField
                id="floor"
                label="Floor"
                required
                value={String(form.floor)}
                onChange={(event) => onChange("floor", Number(event.target.value))}
              >
                {[1, 2, 3, 4].map((floor) => (
                  <option key={floor} value={floor}>
                    Floor {floor}
                  </option>
                ))}
              </SelectField>
            </div>

            {isOtherDepartment ? (
              <TextField
                id="departmentOther"
                label="Other Department"
                required
                value={form.departmentOther}
                onChange={(event) => onChange("departmentOther", event.target.value)}
                placeholder="Please specify department name"
                maxLength={120}
              />
            ) : null}

            <TextField
              id="locationDetail"
              label="Location Detail"
              required
              value={form.locationDetail}
              onChange={(event) => onChange("locationDetail", event.target.value)}
              placeholder="Front lobby near elevator"
              maxLength={200}
            />

            <SelectField
              id="problemCategoryId"
              label="Problem Category"
              required
              value={form.problemCategoryId}
              onChange={(event) => onChange("problemCategoryId", event.target.value)}
            >
              <option value="">Select category</option>
              {problemCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </SelectField>

            {isOtherCategory ? (
              <TextField
                id="problemCategoryOther"
                label="Other Category"
                required
                value={form.problemCategoryOther}
                onChange={(event) => onChange("problemCategoryOther", event.target.value)}
                placeholder="Please describe"
                maxLength={120}
              />
            ) : null}

            <TextareaField
              id="description"
              label="Issue Description"
              required
              value={form.description}
              onChange={(event) => onChange("description", event.target.value)}
              placeholder="Describe what happened"
              rows={4}
              maxLength={2000}
            />

            <div className="space-y-2">
              <label htmlFor="attachments" className="block text-sm font-medium text-slate-800">
                Attachment Files <span className="ml-1 text-rose-600">*</span>
              </label>
              <input
                id="attachments"
                type="file"
                multiple
                accept={attachmentAccept}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                onChange={(event) => {
                  const selected = Array.from(event.target.files ?? []);
                  setAttachmentFiles(selected.slice(0, MAX_ATTACHMENTS));
                }}
              />
              <p className="text-xs text-slate-500">
                Supports image, video, and document files (Word/Excel/PDF). Maximum {MAX_ATTACHMENTS} files.
              </p>
              {attachmentFiles.length > 0 ? (
                <ul className="space-y-1 text-xs text-slate-700">
                  {attachmentFiles.map((file) => (
                    <li key={`${file.name}-${file.lastModified}`}>
                      {file.name} ({Math.max(file.size / 1024 / 1024, 0.01).toFixed(2)} MB)
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <TextareaField
              id="additionalDetails"
              label="Additional Details"
              value={form.additionalDetails}
              onChange={(event) => onChange("additionalDetails", event.target.value)}
              placeholder="Optional notes"
              rows={3}
              maxLength={2000}
            />

            {errorMessage ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {errorMessage}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={submitting || loadingReferences}>
                {submitting ? "Submitting..." : "Submit Request"}
              </Button>
              <Button
                type="button"
                className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
                onClick={handleReset}
                disabled={submitting}
              >
                Reset
              </Button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
