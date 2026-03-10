const CONTACT_KEY = "hrbuddy.employee.contact";

export type EmployeeContact = {
  phone: string;
  email: string;
  name?: string;
  departmentId?: string;
};

function canUseStorage() {
  return typeof window !== "undefined";
}

export function getEmployeeContact(): EmployeeContact | null {
  if (!canUseStorage()) {
    return null;
  }

  const raw = window.localStorage.getItem(CONTACT_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as EmployeeContact;
  } catch {
    return null;
  }
}

export function setEmployeeContact(contact: EmployeeContact) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(CONTACT_KEY, JSON.stringify(contact));
}
