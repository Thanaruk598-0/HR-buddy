"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { getDepartments, getVehicleIssueCategories, type ReferenceListItem } from "@/lib/api/reference";
import {
  createVehicleRequest,
  type CreateVehicleRequestPayload,
  type Urgency,
} from "@/lib/api/requests";
import { Button, SelectField, TextField, TextareaField } from "@/components/ui/form-controls";

const urgencyOptions: Array<{ value: Urgency; label: string }> = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

type FormState = {
  employeeName: string;
  departmentId: string;
  departmentOther: string;
  phone: string;
  urgency: Urgency;
  vehiclePlate: string;
  issueCategoryId: string;
  issueCategoryOther: string;
  symptom: string;
  additionalDetails: string;
};

const initialState: FormState = {
  employeeName: "",
  departmentId: "",
  departmentOther: "",
  phone: "",
  urgency: "NORMAL",
  vehiclePlate: "",
  issueCategoryId: "",
  issueCategoryOther: "",
  symptom: "",
  additionalDetails: "",
};

export default function Page() {
  const router = useRouter();
  const [departments, setDepartments] = useState<ReferenceListItem[]>([]);
  const [vehicleIssueCategories, setVehicleIssueCategories] = useState<ReferenceListItem[]>([]);
  const [form, setForm] = useState<FormState>(initialState);
  const [loadingReferences, setLoadingReferences] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadReferences() {
      setLoadingReferences(true);
      setErrorMessage(null);

      try {
        const [departmentResult, categoriesResult] = await Promise.all([
          getDepartments(),
          getVehicleIssueCategories(),
        ]);

        if (!active) {
          return;
        }

        setDepartments(departmentResult.items);
        setVehicleIssueCategories(categoriesResult.items);
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

  const isOtherCategory = useMemo(() => form.issueCategoryId === "vic_other", [form.issueCategoryId]);
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

    if (!form.vehiclePlate.trim()) {
      return "Vehicle plate is required";
    }

    if (!form.issueCategoryId) {
      return "Vehicle issue category is required";
    }

    if (isOtherCategory && !form.issueCategoryOther.trim()) {
      return "Please fill the other vehicle issue category";
    }

    if (!form.symptom.trim()) {
      return "Symptom is required";
    }

    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const validationError = validateBeforeSubmit();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const payload: CreateVehicleRequestPayload = {
      employeeName: form.employeeName.trim(),
      departmentId: form.departmentId,
      phone: form.phone.trim(),
      urgency: form.urgency,
      vehiclePlate: form.vehiclePlate.trim(),
      issueCategoryId: form.issueCategoryId,
      symptom: form.symptom.trim(),
    };

    if (isOtherDepartment) {
      payload.departmentOther = form.departmentOther.trim();
    }

    if (isOtherCategory) {
      payload.issueCategoryOther = form.issueCategoryOther.trim();
    }

    if (form.additionalDetails.trim()) {
      payload.additionalDetails = form.additionalDetails.trim();
    }

    setSubmitting(true);

    try {
      const result = await createVehicleRequest(payload);
      router.push(`/requests/success/${encodeURIComponent(result.requestNo)}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to submit vehicle request");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10 md:px-10">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Phase 2 - Employee Core</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Vehicle Repair Request</h1>
        <p className="mt-3 text-slate-700">
          Submit a vehicle issue request. This page is already wired to backend reference APIs and the create request endpoint.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {loadingReferences ? (
          <p className="text-sm text-slate-600">Loading departments and vehicle issue categories...</p>
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

              <TextField
                id="vehiclePlate"
                label="Vehicle Plate"
                required
                value={form.vehiclePlate}
                onChange={(event) => onChange("vehiclePlate", event.target.value)}
                placeholder="1??1234"
                maxLength={20}
              />

              <SelectField
                id="issueCategoryId"
                label="Issue Category"
                required
                value={form.issueCategoryId}
                onChange={(event) => onChange("issueCategoryId", event.target.value)}
              >
                <option value="">Select category</option>
                {vehicleIssueCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
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

            {isOtherCategory ? (
              <TextField
                id="issueCategoryOther"
                label="Other Issue Category"
                required
                value={form.issueCategoryOther}
                onChange={(event) => onChange("issueCategoryOther", event.target.value)}
                placeholder="Please describe"
                maxLength={120}
              />
            ) : null}

            <TextareaField
              id="symptom"
              label="Symptom"
              required
              value={form.symptom}
              onChange={(event) => onChange("symptom", event.target.value)}
              placeholder="Describe the vehicle issue"
              rows={4}
              maxLength={2000}
            />

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
                onClick={() => setForm(initialState)}
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
