"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { getGeoDistricts, getGeoPostalCode, getGeoProvinces, getGeoSubdistricts } from "@/lib/api/geo";
import { getDepartments, type ReferenceListItem } from "@/lib/api/reference";
import {
  createMessengerRequest,
  type AddressPayload,
  type CreateMessengerRequestPayload,
  type DeliveryService,
  type ItemType,
  type Urgency,
} from "@/lib/api/requests";
import { Button, SelectField, TextField, TextareaField } from "@/components/ui/form-controls";

const urgencyOptions: Array<{ value: Urgency; label: string }> = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

const itemTypeOptions: Array<{ value: ItemType; label: string }> = [
  { value: "DOCUMENT", label: "Document" },
  { value: "PACKAGE", label: "Package" },
];

const deliveryServiceOptions: Array<{ value: DeliveryService; label: string }> = [
  { value: "POST", label: "Post" },
  { value: "NAKHONCHAI_AIR", label: "Nakhonchai Air" },
  { value: "OTHER", label: "Other" },
];

type AddressSection = "sender" | "receiver";

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
  pickupDatetime: string;
  itemType: ItemType;
  itemDescription: string;
  outsideBkkMetro: boolean;
  deliveryService: DeliveryService;
  deliveryServiceOther: string;
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
  pickupDatetime: "",
  itemType: "DOCUMENT",
  itemDescription: "",
  outsideBkkMetro: false,
  deliveryService: "POST",
  deliveryServiceOther: "",
};

const emptyGeoState: AddressGeoState = {
  districts: [],
  subdistricts: [],
};

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

function isValidPhone(value: string) {
  return /^\+?\d{9,15}$/.test(value.trim());
}

function validateAddress(sectionName: string, address: AddressState) {
  if (!address.name.trim()) {
    return `${sectionName} name is required`;
  }

  if (!isValidPhone(address.phone)) {
    return `${sectionName} phone must be 9-15 digits and may start with +`;
  }

  if (!address.province.trim()) {
    return `${sectionName} province is required`;
  }

  if (!address.district.trim()) {
    return `${sectionName} district is required`;
  }

  if (!address.subdistrict.trim()) {
    return `${sectionName} subdistrict is required`;
  }

  if (!address.postalCode.trim()) {
    return `${sectionName} postal code is required`;
  }

  if (!address.houseNo.trim()) {
    return `${sectionName} house number is required`;
  }

  return null;
}

export default function Page() {
  const router = useRouter();

  const [departments, setDepartments] = useState<ReferenceListItem[]>([]);
  const [provinces, setProvinces] = useState<string[]>([]);

  const [form, setForm] = useState<FormState>(initialFormState);
  const [sender, setSender] = useState<AddressState>(createInitialAddressState());
  const [receiver, setReceiver] = useState<AddressState>(createInitialAddressState());

  const [senderGeo, setSenderGeo] = useState<AddressGeoState>(emptyGeoState);
  const [receiverGeo, setReceiverGeo] = useState<AddressGeoState>(emptyGeoState);

  const [loadingReferences, setLoadingReferences] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const onChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateAddress = <K extends keyof AddressState>(
    section: AddressSection,
    key: K,
    value: AddressState[K],
  ) => {
    if (section === "sender") {
      setSender((prev) => ({ ...prev, [key]: value }));
      return;
    }

    setReceiver((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    let active = true;

    async function loadDistricts() {
      if (!sender.province) {
        setSenderGeo(emptyGeoState);
        return;
      }

      setSenderGeo(emptyGeoState);
      setSender((prev) => ({ ...prev, district: "", subdistrict: "", postalCode: "" }));

      try {
        const districts = await getGeoDistricts(sender.province);

        if (!active) {
          return;
        }

        setSenderGeo({ districts, subdistricts: [] });
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Failed to load sender districts");
        }
      }
    }

    void loadDistricts();

    return () => {
      active = false;
    };
  }, [sender.province]);

  useEffect(() => {
    let active = true;

    async function loadSubdistricts() {
      if (!sender.province || !sender.district) {
        setSenderGeo((prev) => ({ ...prev, subdistricts: [] }));
        setSender((prev) => ({ ...prev, subdistrict: "", postalCode: "" }));
        return;
      }

      setSenderGeo((prev) => ({ ...prev, subdistricts: [] }));
      setSender((prev) => ({ ...prev, subdistrict: "", postalCode: "" }));

      try {
        const subdistricts = await getGeoSubdistricts(sender.province, sender.district);

        if (!active) {
          return;
        }

        setSenderGeo((prev) => ({ ...prev, subdistricts }));
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Failed to load sender subdistricts");
        }
      }
    }

    void loadSubdistricts();

    return () => {
      active = false;
    };
  }, [sender.province, sender.district]);

  useEffect(() => {
    let active = true;

    async function loadPostalCode() {
      if (!sender.province || !sender.district || !sender.subdistrict) {
        setSender((prev) => ({ ...prev, postalCode: "" }));
        return;
      }

      try {
        const result = await getGeoPostalCode(sender.province, sender.district, sender.subdistrict);

        if (!active) {
          return;
        }

        setSender((prev) => ({ ...prev, postalCode: result.postalCode ?? "" }));
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Failed to load sender postal code");
        }
      }
    }

    void loadPostalCode();

    return () => {
      active = false;
    };
  }, [sender.province, sender.district, sender.subdistrict]);

  useEffect(() => {
    let active = true;

    async function loadDistricts() {
      if (!receiver.province) {
        setReceiverGeo(emptyGeoState);
        return;
      }

      setReceiverGeo(emptyGeoState);
      setReceiver((prev) => ({ ...prev, district: "", subdistrict: "", postalCode: "" }));

      try {
        const districts = await getGeoDistricts(receiver.province);

        if (!active) {
          return;
        }

        setReceiverGeo({ districts, subdistricts: [] });
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Failed to load receiver districts");
        }
      }
    }

    void loadDistricts();

    return () => {
      active = false;
    };
  }, [receiver.province]);

  useEffect(() => {
    let active = true;

    async function loadSubdistricts() {
      if (!receiver.province || !receiver.district) {
        setReceiverGeo((prev) => ({ ...prev, subdistricts: [] }));
        setReceiver((prev) => ({ ...prev, subdistrict: "", postalCode: "" }));
        return;
      }

      setReceiverGeo((prev) => ({ ...prev, subdistricts: [] }));
      setReceiver((prev) => ({ ...prev, subdistrict: "", postalCode: "" }));

      try {
        const subdistricts = await getGeoSubdistricts(receiver.province, receiver.district);

        if (!active) {
          return;
        }

        setReceiverGeo((prev) => ({ ...prev, subdistricts }));
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Failed to load receiver subdistricts");
        }
      }
    }

    void loadSubdistricts();

    return () => {
      active = false;
    };
  }, [receiver.province, receiver.district]);

  useEffect(() => {
    let active = true;

    async function loadPostalCode() {
      if (!receiver.province || !receiver.district || !receiver.subdistrict) {
        setReceiver((prev) => ({ ...prev, postalCode: "" }));
        return;
      }

      try {
        const result = await getGeoPostalCode(receiver.province, receiver.district, receiver.subdistrict);

        if (!active) {
          return;
        }

        setReceiver((prev) => ({ ...prev, postalCode: result.postalCode ?? "" }));
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Failed to load receiver postal code");
        }
      }
    }

    void loadPostalCode();

    return () => {
      active = false;
    };
  }, [receiver.province, receiver.district, receiver.subdistrict]);

  const isOtherDepartment = useMemo(() => form.departmentId === "dept_other", [form.departmentId]);
  const requiresDeliveryService = useMemo(() => form.outsideBkkMetro, [form.outsideBkkMetro]);
  const requiresDeliveryServiceOther = useMemo(
    () => requiresDeliveryService && form.deliveryService === "OTHER",
    [requiresDeliveryService, form.deliveryService],
  );

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

    if (!form.pickupDatetime) {
      return "Pickup date and time is required";
    }

    if (Number.isNaN(new Date(form.pickupDatetime).getTime())) {
      return "Pickup date and time is invalid";
    }

    if (!form.itemDescription.trim()) {
      return "Item description is required";
    }

    if (requiresDeliveryServiceOther && !form.deliveryServiceOther.trim()) {
      return "Please fill other delivery service";
    }

    const senderError = validateAddress("Sender", sender);
    if (senderError) {
      return senderError;
    }

    const receiverError = validateAddress("Receiver", receiver);
    if (receiverError) {
      return receiverError;
    }

    return null;
  };

  const handleReset = () => {
    setForm(initialFormState);
    setSender(createInitialAddressState());
    setReceiver(createInitialAddressState());
    setSenderGeo(emptyGeoState);
    setReceiverGeo(emptyGeoState);
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

    const payload: CreateMessengerRequestPayload = {
      employeeName: form.employeeName.trim(),
      departmentId: form.departmentId,
      phone: form.phone.trim(),
      urgency: form.urgency,
      pickupDatetime: new Date(form.pickupDatetime).toISOString(),
      itemType: form.itemType,
      itemDescription: form.itemDescription.trim(),
      outsideBkkMetro: form.outsideBkkMetro,
      sender: normalizeAddress(sender),
      receiver: normalizeAddress(receiver),
    };

    if (isOtherDepartment) {
      payload.departmentOther = form.departmentOther.trim();
    }

    if (form.outsideBkkMetro) {
      payload.deliveryService = form.deliveryService;

      if (form.deliveryService === "OTHER") {
        payload.deliveryServiceOther = form.deliveryServiceOther.trim();
      }
    }

    setSubmitting(true);

    try {
      const result = await createMessengerRequest(payload);
      router.push(`/requests/success/${encodeURIComponent(result.requestNo)}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to submit messenger request");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10 md:px-10">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Phase 2 - Employee Core</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Messenger Booking Request</h1>
        <p className="mt-3 text-slate-700">
          Create a messenger job with sender and receiver details. This page is wired to department, geo, and create request APIs.
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
                id="pickupDatetime"
                label="Pickup Date and Time"
                required
                type="datetime-local"
                value={form.pickupDatetime}
                onChange={(event) => onChange("pickupDatetime", event.target.value)}
              />

              <SelectField
                id="itemType"
                label="Item Type"
                required
                value={form.itemType}
                onChange={(event) => onChange("itemType", event.target.value as ItemType)}
              >
                {itemTypeOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </SelectField>
            </div>

            <TextareaField
              id="itemDescription"
              label="Item Description"
              required
              value={form.itemDescription}
              onChange={(event) => onChange("itemDescription", event.target.value)}
              placeholder="Describe what should be delivered"
              rows={4}
              maxLength={2000}
            />

            <div className="rounded-xl border border-slate-200 p-4">
              <h2 className="text-lg font-semibold text-slate-900">Delivery Scope</h2>
              <p className="mt-1 text-sm text-slate-600">Choose whether this job is outside Bangkok and nearby metro area.</p>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <SelectField
                  id="outsideBkkMetro"
                  label="Outside BKK Metro"
                  required
                  value={form.outsideBkkMetro ? "true" : "false"}
                  onChange={(event) => onChange("outsideBkkMetro", event.target.value === "true")}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </SelectField>

                {requiresDeliveryService ? (
                  <SelectField
                    id="deliveryService"
                    label="Delivery Service"
                    required
                    value={form.deliveryService}
                    onChange={(event) => onChange("deliveryService", event.target.value as DeliveryService)}
                  >
                    {deliveryServiceOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </SelectField>
                ) : null}
              </div>

              {requiresDeliveryServiceOther ? (
                <div className="mt-4">
                  <TextField
                    id="deliveryServiceOther"
                    label="Other Delivery Service"
                    required
                    value={form.deliveryServiceOther}
                    onChange={(event) => onChange("deliveryServiceOther", event.target.value)}
                    placeholder="Please specify delivery service"
                    maxLength={120}
                  />
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <h2 className="text-lg font-semibold text-slate-900">Sender Information</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <TextField
                  id="senderName"
                  label="Sender Name"
                  required
                  value={sender.name}
                  onChange={(event) => updateAddress("sender", "name", event.target.value)}
                  maxLength={120}
                />

                <TextField
                  id="senderPhone"
                  label="Sender Phone"
                  required
                  value={sender.phone}
                  onChange={(event) => updateAddress("sender", "phone", event.target.value)}
                  maxLength={20}
                />

                <SelectField
                  id="senderProvince"
                  label="Province"
                  required
                  value={sender.province}
                  onChange={(event) => updateAddress("sender", "province", event.target.value)}
                >
                  <option value="">Select province</option>
                  {provinces.map((province) => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </SelectField>

                <SelectField
                  id="senderDistrict"
                  label="District"
                  required
                  value={sender.district}
                  onChange={(event) => updateAddress("sender", "district", event.target.value)}
                  disabled={!sender.province}
                >
                  <option value="">Select district</option>
                  {senderGeo.districts.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </SelectField>

                <SelectField
                  id="senderSubdistrict"
                  label="Subdistrict"
                  required
                  value={sender.subdistrict}
                  onChange={(event) => updateAddress("sender", "subdistrict", event.target.value)}
                  disabled={!sender.district}
                >
                  <option value="">Select subdistrict</option>
                  {senderGeo.subdistricts.map((subdistrict) => (
                    <option key={subdistrict} value={subdistrict}>
                      {subdistrict}
                    </option>
                  ))}
                </SelectField>

                <TextField
                  id="senderPostalCode"
                  label="Postal Code"
                  required
                  value={sender.postalCode}
                  onChange={(event) => updateAddress("sender", "postalCode", event.target.value)}
                  maxLength={10}
                />

                <TextField
                  id="senderHouseNo"
                  label="House No."
                  required
                  value={sender.houseNo}
                  onChange={(event) => updateAddress("sender", "houseNo", event.target.value)}
                  maxLength={120}
                />

                <TextField
                  id="senderSoi"
                  label="Soi"
                  value={sender.soi ?? ""}
                  onChange={(event) => updateAddress("sender", "soi", event.target.value)}
                  maxLength={120}
                />

                <TextField
                  id="senderRoad"
                  label="Road"
                  value={sender.road ?? ""}
                  onChange={(event) => updateAddress("sender", "road", event.target.value)}
                  maxLength={120}
                />
              </div>

              <div className="mt-4">
                <TextareaField
                  id="senderExtra"
                  label="Extra"
                  value={sender.extra ?? ""}
                  onChange={(event) => updateAddress("sender", "extra", event.target.value)}
                  rows={2}
                  maxLength={200}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <h2 className="text-lg font-semibold text-slate-900">Receiver Information</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <TextField
                  id="receiverName"
                  label="Receiver Name"
                  required
                  value={receiver.name}
                  onChange={(event) => updateAddress("receiver", "name", event.target.value)}
                  maxLength={120}
                />

                <TextField
                  id="receiverPhone"
                  label="Receiver Phone"
                  required
                  value={receiver.phone}
                  onChange={(event) => updateAddress("receiver", "phone", event.target.value)}
                  maxLength={20}
                />

                <SelectField
                  id="receiverProvince"
                  label="Province"
                  required
                  value={receiver.province}
                  onChange={(event) => updateAddress("receiver", "province", event.target.value)}
                >
                  <option value="">Select province</option>
                  {provinces.map((province) => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </SelectField>

                <SelectField
                  id="receiverDistrict"
                  label="District"
                  required
                  value={receiver.district}
                  onChange={(event) => updateAddress("receiver", "district", event.target.value)}
                  disabled={!receiver.province}
                >
                  <option value="">Select district</option>
                  {receiverGeo.districts.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </SelectField>

                <SelectField
                  id="receiverSubdistrict"
                  label="Subdistrict"
                  required
                  value={receiver.subdistrict}
                  onChange={(event) => updateAddress("receiver", "subdistrict", event.target.value)}
                  disabled={!receiver.district}
                >
                  <option value="">Select subdistrict</option>
                  {receiverGeo.subdistricts.map((subdistrict) => (
                    <option key={subdistrict} value={subdistrict}>
                      {subdistrict}
                    </option>
                  ))}
                </SelectField>

                <TextField
                  id="receiverPostalCode"
                  label="Postal Code"
                  required
                  value={receiver.postalCode}
                  onChange={(event) => updateAddress("receiver", "postalCode", event.target.value)}
                  maxLength={10}
                />

                <TextField
                  id="receiverHouseNo"
                  label="House No."
                  required
                  value={receiver.houseNo}
                  onChange={(event) => updateAddress("receiver", "houseNo", event.target.value)}
                  maxLength={120}
                />

                <TextField
                  id="receiverSoi"
                  label="Soi"
                  value={receiver.soi ?? ""}
                  onChange={(event) => updateAddress("receiver", "soi", event.target.value)}
                  maxLength={120}
                />

                <TextField
                  id="receiverRoad"
                  label="Road"
                  value={receiver.road ?? ""}
                  onChange={(event) => updateAddress("receiver", "road", event.target.value)}
                  maxLength={120}
                />
              </div>

              <div className="mt-4">
                <TextareaField
                  id="receiverExtra"
                  label="Extra"
                  value={receiver.extra ?? ""}
                  onChange={(event) => updateAddress("receiver", "extra", event.target.value)}
                  rows={2}
                  maxLength={200}
                />
              </div>
            </div>

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






