"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { getGeoDistricts, getGeoPostalCode, getGeoProvinces, getGeoSubdistricts } from "@/lib/api/geo";
import { getDepartments, type ReferenceListItem } from "@/lib/api/reference";
import {
  createDocumentRequest,
  type AddressPayload,
  type CreateDocumentRequestPayload,
  type DeliveryMethod,
  type Urgency,
} from "@/lib/api/requests";
import { Button, SelectField, TextField, TextareaField } from "@/components/ui/form-controls";

const urgencyOptions: Array<{ value: Urgency; label: string }> = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

const deliveryMethodOptions: Array<{ value: DeliveryMethod; label: string }> = [
  { value: "DIGITAL", label: "Digital" },
  { value: "POSTAL", label: "Postal" },
  { value: "PICKUP", label: "Pickup" },
];

type AddressState = Omit<AddressPayload, "soi" | "road" | "extra"> & { soi: string; road: string; extra: string };

type AddressGeoState = {
  districts: string[];
  subdistricts: string[];
};

type FormState = {
  employeeName: string;
  departmentId: string;
  departmentOther: string;
  phone: string;
  urgency: Urgency;
  siteNameRaw: string;
  documentDescription: string;
  purpose: string;
  neededDate: string;
  deliveryMethod: DeliveryMethod;
  note: string;
};

const createInitialAddressState = (): AddressState => ({
  name: "",
  phone: "",
  province: "",
  district: "",
  subdistrict: "",
  postalCode: "",
  houseNo: "",
  soi: "",
  road: "",
  extra: "",
});

const initialFormState: FormState = {
  employeeName: "",
  departmentId: "",
  departmentOther: "",
  phone: "",
  urgency: "NORMAL",
  siteNameRaw: "",
  documentDescription: "",
  purpose: "",
  neededDate: "",
  deliveryMethod: "DIGITAL",
  note: "",
};

const emptyGeoState: AddressGeoState = {
  districts: [],
  subdistricts: [],
};

function isValidPhone(value: string) {
  return /^\+?\d{9,15}$/.test(value.trim());
}

function normalizeAddress(address: AddressState): AddressPayload {
  return {
    name: address.name.trim(),
    phone: address.phone.trim(),
    province: address.province.trim(),
    district: address.district.trim(),
    subdistrict: address.subdistrict.trim(),
    postalCode: address.postalCode.trim(),
    houseNo: address.houseNo.trim(),
    ...(address.soi.trim() ? { soi: address.soi.trim() } : {}),
    ...(address.road.trim() ? { road: address.road.trim() } : {}),
    ...(address.extra.trim() ? { extra: address.extra.trim() } : {}),
  };
}

function validateAddress(address: AddressState) {
  if (!address.name.trim()) {
    return "Receiver name is required";
  }

  if (!isValidPhone(address.phone)) {
    return "Receiver phone must be 9-15 digits and may start with +";
  }

  if (!address.province.trim()) {
    return "Receiver province is required";
  }

  if (!address.district.trim()) {
    return "Receiver district is required";
  }

  if (!address.subdistrict.trim()) {
    return "Receiver subdistrict is required";
  }

  if (!address.postalCode.trim()) {
    return "Receiver postal code is required";
  }

  if (!address.houseNo.trim()) {
    return "Receiver house number is required";
  }

  return null;
}

export default function Page() {
  const router = useRouter();

  const [departments, setDepartments] = useState<ReferenceListItem[]>([]);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [addressGeo, setAddressGeo] = useState<AddressGeoState>(emptyGeoState);

  const [form, setForm] = useState<FormState>(initialFormState);
  const [address, setAddress] = useState<AddressState>(createInitialAddressState());

  const [loadingReferences, setLoadingReferences] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isPostal = useMemo(() => form.deliveryMethod === "POSTAL", [form.deliveryMethod]);
  const isOtherDepartment = useMemo(() => form.departmentId === "dept_other", [form.departmentId]);

  useEffect(() => {
    let active = true;

    async function loadReferences() {
      setLoadingReferences(true);
      setErrorMessage(null);

      try {
        const [departmentsResult, provincesResult] = await Promise.all([
          getDepartments(),
          getGeoProvinces(),
        ]);

        if (!active) {
          return;
        }

        setDepartments(departmentsResult.items);
        setProvinces(provincesResult);
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

  useEffect(() => {
    if (isPostal) {
      return;
    }

    setAddress(createInitialAddressState());
    setAddressGeo(emptyGeoState);
  }, [isPostal]);

  useEffect(() => {
    let active = true;

    async function loadDistricts() {
      if (!isPostal || !address.province) {
        setAddressGeo(emptyGeoState);
        return;
      }

      setAddressGeo(emptyGeoState);
      setAddress((prev) => ({ ...prev, district: "", subdistrict: "", postalCode: "" }));

      try {
        const districts = await getGeoDistricts(address.province);

        if (!active) {
          return;
        }

        setAddressGeo({ districts, subdistricts: [] });
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Failed to load districts");
        }
      }
    }

    void loadDistricts();

    return () => {
      active = false;
    };
  }, [address.province, isPostal]);

  useEffect(() => {
    let active = true;

    async function loadSubdistricts() {
      if (!isPostal || !address.province || !address.district) {
        setAddressGeo((prev) => ({ ...prev, subdistricts: [] }));
        setAddress((prev) => ({ ...prev, subdistrict: "", postalCode: "" }));
        return;
      }

      setAddressGeo((prev) => ({ ...prev, subdistricts: [] }));
      setAddress((prev) => ({ ...prev, subdistrict: "", postalCode: "" }));

      try {
        const subdistricts = await getGeoSubdistricts(address.province, address.district);

        if (!active) {
          return;
        }

        setAddressGeo((prev) => ({ ...prev, subdistricts }));
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Failed to load subdistricts");
        }
      }
    }

    void loadSubdistricts();

    return () => {
      active = false;
    };
  }, [address.province, address.district, isPostal]);

  useEffect(() => {
    let active = true;

    async function loadPostalCode() {
      if (!isPostal || !address.province || !address.district || !address.subdistrict) {
        setAddress((prev) => ({ ...prev, postalCode: "" }));
        return;
      }

      try {
        const result = await getGeoPostalCode(address.province, address.district, address.subdistrict);

        if (!active) {
          return;
        }

        setAddress((prev) => ({ ...prev, postalCode: result.postalCode ?? "" }));
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Failed to load postal code");
        }
      }
    }

    void loadPostalCode();

    return () => {
      active = false;
    };
  }, [address.province, address.district, address.subdistrict, isPostal]);

  const onChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onAddressChange = <K extends keyof AddressState>(key: K, value: AddressState[K]) => {
    setAddress((prev) => ({ ...prev, [key]: value }));
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

    if (!isValidPhone(form.phone)) {
      return "Phone must be 9-15 digits and may start with +";
    }

    if (!form.siteNameRaw.trim()) {
      return "Site / Unit name is required";
    }

    if (!form.documentDescription.trim()) {
      return "Document description is required";
    }

    if (!form.purpose.trim()) {
      return "Purpose is required";
    }

    if (!form.neededDate.trim()) {
      return "Needed date is required";
    }

    if (Number.isNaN(new Date(form.neededDate).getTime())) {
      return "Needed date is invalid";
    }

    if (isPostal) {
      return validateAddress(address);
    }

    return null;
  };

  const handleReset = () => {
    setForm(initialFormState);
    setAddress(createInitialAddressState());
    setAddressGeo(emptyGeoState);
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

    const payload: CreateDocumentRequestPayload = {
      employeeName: form.employeeName.trim(),
      departmentId: form.departmentId,
      phone: form.phone.trim(),
      urgency: form.urgency,
      siteNameRaw: form.siteNameRaw.trim(),
      documentDescription: form.documentDescription.trim(),
      purpose: form.purpose.trim(),
      neededDate: new Date(form.neededDate).toISOString(),
      deliveryMethod: form.deliveryMethod,
      ...(form.note.trim() ? { note: form.note.trim() } : {}),
    };

    if (isOtherDepartment) {
      payload.departmentOther = form.departmentOther.trim();
    }

    if (isPostal) {
      payload.deliveryAddress = normalizeAddress(address);
    }

    setSubmitting(true);

    try {
      const result = await createDocumentRequest(payload);
      router.push(`/requests/success/${encodeURIComponent(result.requestNo)}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to submit document request");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10 md:px-10">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Phase 2 - Employee Core</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Document Request</h1>
        <p className="mt-3 text-slate-700">
          Request official documents with a clear delivery method. Postal flow is fully wired with geo dependent dropdown.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {loadingReferences ? (
          <p className="text-sm text-slate-600">Loading departments and geo data...</p>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
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
                maxLength={20}
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
                id="siteNameRaw"
                label="Site / Unit Name"
                required
                value={form.siteNameRaw}
                onChange={(event) => onChange("siteNameRaw", event.target.value)}
                placeholder="CL-HQ / Site ABC"
                maxLength={200}
              />

              <TextField
                id="neededDate"
                label="Needed Date"
                required
                type="date"
                value={form.neededDate}
                onChange={(event) => onChange("neededDate", event.target.value)}
              />
            </div>

            <TextareaField
              id="documentDescription"
              label="Document Description"
              required
              value={form.documentDescription}
              onChange={(event) => onChange("documentDescription", event.target.value)}
              placeholder="Describe the document request"
              rows={4}
              maxLength={2000}
            />

            <TextareaField
              id="purpose"
              label="Purpose"
              required
              value={form.purpose}
              onChange={(event) => onChange("purpose", event.target.value)}
              placeholder="Why this document is needed"
              rows={3}
              maxLength={500}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                id="deliveryMethod"
                label="Delivery Method"
                required
                value={form.deliveryMethod}
                onChange={(event) => onChange("deliveryMethod", event.target.value as DeliveryMethod)}
              >
                {deliveryMethodOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </SelectField>
            </div>

            <TextareaField
              id="note"
              label="Note"
              value={form.note}
              onChange={(event) => onChange("note", event.target.value)}
              placeholder="Optional note"
              rows={3}
              maxLength={2000}
            />

            {isPostal ? (
              <div className="rounded-xl border border-slate-200 p-4">
                <h2 className="text-lg font-semibold text-slate-900">Postal Delivery Address</h2>
                <p className="mt-1 text-sm text-slate-600">Required when delivery method is Postal.</p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <TextField
                    id="addressName"
                    label="Receiver Name"
                    required
                    value={address.name}
                    onChange={(event) => onAddressChange("name", event.target.value)}
                    maxLength={120}
                  />

                  <TextField
                    id="addressPhone"
                    label="Receiver Phone"
                    required
                    value={address.phone}
                    onChange={(event) => onAddressChange("phone", event.target.value)}
                    maxLength={20}
                  />

                  <SelectField
                    id="addressProvince"
                    label="Province"
                    required
                    value={address.province}
                    onChange={(event) => onAddressChange("province", event.target.value)}
                  >
                    <option value="">Select province</option>
                    {provinces.map((province) => (
                      <option key={province} value={province}>
                        {province}
                      </option>
                    ))}
                  </SelectField>

                  <SelectField
                    id="addressDistrict"
                    label="District"
                    required
                    value={address.district}
                    onChange={(event) => onAddressChange("district", event.target.value)}
                    disabled={!address.province}
                  >
                    <option value="">Select district</option>
                    {addressGeo.districts.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </SelectField>

                  <SelectField
                    id="addressSubdistrict"
                    label="Subdistrict"
                    required
                    value={address.subdistrict}
                    onChange={(event) => onAddressChange("subdistrict", event.target.value)}
                    disabled={!address.district}
                  >
                    <option value="">Select subdistrict</option>
                    {addressGeo.subdistricts.map((subdistrict) => (
                      <option key={subdistrict} value={subdistrict}>
                        {subdistrict}
                      </option>
                    ))}
                  </SelectField>

                  <TextField
                    id="addressPostalCode"
                    label="Postal Code"
                    required
                    value={address.postalCode}
                    onChange={(event) => onAddressChange("postalCode", event.target.value)}
                    maxLength={10}
                  />

                  <TextField
                    id="addressHouseNo"
                    label="House No."
                    required
                    value={address.houseNo}
                    onChange={(event) => onAddressChange("houseNo", event.target.value)}
                    maxLength={120}
                  />

                  <TextField
                    id="addressSoi"
                    label="Soi"
                    value={address.soi ?? ""}
                    onChange={(event) => onAddressChange("soi", event.target.value)}
                    maxLength={120}
                  />

                  <TextField
                    id="addressRoad"
                    label="Road"
                    value={address.road ?? ""}
                    onChange={(event) => onAddressChange("road", event.target.value)}
                    maxLength={120}
                  />
                </div>

                <div className="mt-4">
                  <TextareaField
                    id="addressExtra"
                    label="Extra"
                    value={address.extra ?? ""}
                    onChange={(event) => onAddressChange("extra", event.target.value)}
                    rows={2}
                    maxLength={200}
                  />
                </div>
              </div>
            ) : null}

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
