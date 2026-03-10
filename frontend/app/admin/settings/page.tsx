"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RouteGuard } from "@/components/guards/route-guard";
import { Button, TextField } from "@/components/ui/form-controls";
import { ApiError } from "@/lib/api/client";
import {
  createAdminDepartment,
  createAdminOperator,
  createAdminProblemCategory,
  createAdminVehicleIssueCategory,
  listAdminDepartments,
  listAdminOperators,
  listAdminProblemCategories,
  listAdminVehicleIssueCategories,
  updateAdminDepartment,
  updateAdminOperator,
  updateAdminProblemCategory,
  updateAdminVehicleIssueCategory,
  type AdminDepartment,
  type AdminOperator,
  type AdminProblemCategory,
  type AdminVehicleIssueCategory,
} from "@/lib/api/admin-settings";

type SettingsTab = "departments" | "problemCategories" | "vehicleIssueCategories" | "operators";

const tabOptions: Array<{ value: SettingsTab; label: string }> = [
  { value: "departments", label: "Departments" },
  { value: "problemCategories", label: "Problem Categories" },
  { value: "vehicleIssueCategories", label: "Vehicle Issue Categories" },
  { value: "operators", label: "Operators" },
];

function containsText(value: string, query: string) {
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

export default function Page() {
  return (
    <RouteGuard tokenType="admin" redirectTo="/admin/login">
      <AdminSettingsContent />
    </RouteGuard>
  );
}

function AdminSettingsContent() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("departments");

  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [problemCategories, setProblemCategories] = useState<AdminProblemCategory[]>([]);
  const [vehicleIssueCategories, setVehicleIssueCategories] = useState<AdminVehicleIssueCategory[]>([]);
  const [operators, setOperators] = useState<AdminOperator[]>([]);

  const [searchDepartment, setSearchDepartment] = useState("");
  const [searchProblemCategory, setSearchProblemCategory] = useState("");
  const [searchVehicleIssueCategory, setSearchVehicleIssueCategory] = useState("");
  const [searchOperator, setSearchOperator] = useState("");

  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newProblemCategoryName, setNewProblemCategoryName] = useState("");
  const [newProblemCategoryHelperText, setNewProblemCategoryHelperText] = useState("");
  const [newVehicleIssueCategoryName, setNewVehicleIssueCategoryName] = useState("");
  const [newOperatorName, setNewOperatorName] = useState("");

  const [departmentDrafts, setDepartmentDrafts] = useState<Record<string, string>>({});
  const [problemCategoryNameDrafts, setProblemCategoryNameDrafts] = useState<Record<string, string>>({});
  const [problemCategoryHelperDrafts, setProblemCategoryHelperDrafts] = useState<Record<string, string>>({});
  const [vehicleIssueCategoryDrafts, setVehicleIssueCategoryDrafts] = useState<Record<string, string>>({});
  const [operatorDrafts, setOperatorDrafts] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const initializeDrafts = useCallback(
    (
      deps: AdminDepartment[],
      probs: AdminProblemCategory[],
      vehicleIssues: AdminVehicleIssueCategory[],
      ops: AdminOperator[],
    ) => {
      setDepartmentDrafts(
        Object.fromEntries(deps.map((item) => [item.id, item.name])),
      );
      setProblemCategoryNameDrafts(
        Object.fromEntries(probs.map((item) => [item.id, item.name])),
      );
      setProblemCategoryHelperDrafts(
        Object.fromEntries(probs.map((item) => [item.id, item.helperText ?? ""])),
      );
      setVehicleIssueCategoryDrafts(
        Object.fromEntries(vehicleIssues.map((item) => [item.id, item.name])),
      );
      setOperatorDrafts(
        Object.fromEntries(ops.map((item) => [item.id, item.displayName])),
      );
    },
    [],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const [depRes, probRes, vehicleRes, opRes] = await Promise.all([
        listAdminDepartments(),
        listAdminProblemCategories(),
        listAdminVehicleIssueCategories(),
        listAdminOperators(),
      ]);

      setDepartments(depRes.items);
      setProblemCategories(probRes.items);
      setVehicleIssueCategories(vehicleRes.items);
      setOperators(opRes.items);

      initializeDrafts(depRes.items, probRes.items, vehicleRes.items, opRes.items);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to load settings");
      }
    } finally {
      setLoading(false);
    }
  }, [initializeDrafts]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const filteredDepartments = useMemo(
    () => departments.filter((item) => containsText(item.name, searchDepartment)),
    [departments, searchDepartment],
  );

  const filteredProblemCategories = useMemo(
    () =>
      problemCategories.filter(
        (item) =>
          containsText(item.name, searchProblemCategory) ||
          containsText(item.helperText ?? "", searchProblemCategory),
      ),
    [problemCategories, searchProblemCategory],
  );

  const filteredVehicleIssueCategories = useMemo(
    () => vehicleIssueCategories.filter((item) => containsText(item.name, searchVehicleIssueCategory)),
    [vehicleIssueCategories, searchVehicleIssueCategory],
  );

  const filteredOperators = useMemo(
    () => operators.filter((item) => containsText(item.displayName, searchOperator)),
    [operators, searchOperator],
  );

  const runMutation = async (action: () => Promise<void>, success: string) => {
    setMutating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await action();
      await loadAll();
      setSuccessMessage(success);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Operation failed");
      }
    } finally {
      setMutating(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-10 md:px-10">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Phase 6 - Admin Settings and Audit</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Admin Settings</h1>
        <p className="mt-2 text-slate-700">Manage master data used by request forms and admin workflows.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {tabOptions.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.value
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}

          <Button
            type="button"
            className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
            onClick={() => void loadAll()}
            disabled={loading || mutating}
          >
            Refresh
          </Button>
        </div>
      </header>

      {loading ? <p className="text-sm text-slate-700">Loading settings...</p> : null}

      {!loading && activeTab === "departments" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Departments</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextField
              id="newDepartment"
              label="Create department"
              value={newDepartmentName}
              onChange={(event) => setNewDepartmentName(event.target.value)}
              placeholder="New department name"
            />
            <div className="flex items-end">
              <Button
                type="button"
                disabled={mutating || !newDepartmentName.trim()}
                onClick={() =>
                  void runMutation(async () => {
                    await createAdminDepartment({ name: newDepartmentName.trim() });
                    setNewDepartmentName("");
                  }, "Department created")
                }
              >
                Create
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <TextField
              id="searchDepartment"
              label="Search"
              value={searchDepartment}
              onChange={(event) => setSearchDepartment(event.target.value)}
              placeholder="Search department"
            />
          </div>

          <ul className="mt-4 space-y-2">
            {filteredDepartments.map((item) => (
              <li key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <input
                    className="min-w-56 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    value={departmentDrafts[item.id] ?? item.name}
                    onChange={(event) =>
                      setDepartmentDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))
                    }
                  />

                  <Button
                    type="button"
                    className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
                    disabled={mutating || !(departmentDrafts[item.id] ?? item.name).trim()}
                    onClick={() =>
                      void runMutation(async () => {
                        await updateAdminDepartment(item.id, {
                          name: (departmentDrafts[item.id] ?? item.name).trim(),
                        });
                      }, "Department updated")
                    }
                  >
                    Save name
                  </Button>

                  <Button
                    type="button"
                    className={item.isActive ? "bg-emerald-700 hover:bg-emerald-600" : "bg-slate-700 hover:bg-slate-600"}
                    disabled={mutating}
                    onClick={() =>
                      void runMutation(async () => {
                        await updateAdminDepartment(item.id, { isActive: !item.isActive });
                      }, "Department status updated")
                    }
                  >
                    {item.isActive ? "Active" : "Inactive"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!loading && activeTab === "problemCategories" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Problem Categories</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextField
              id="newProblemCategory"
              label="Create category"
              value={newProblemCategoryName}
              onChange={(event) => setNewProblemCategoryName(event.target.value)}
              placeholder="Category name"
            />
            <TextField
              id="newProblemCategoryHelper"
              label="Helper text"
              value={newProblemCategoryHelperText}
              onChange={(event) => setNewProblemCategoryHelperText(event.target.value)}
              placeholder="Optional helper text"
            />
          </div>

          <div className="mt-3">
            <Button
              type="button"
              disabled={mutating || !newProblemCategoryName.trim()}
              onClick={() =>
                void runMutation(async () => {
                  await createAdminProblemCategory({
                    name: newProblemCategoryName.trim(),
                    helperText: newProblemCategoryHelperText.trim() || undefined,
                  });
                  setNewProblemCategoryName("");
                  setNewProblemCategoryHelperText("");
                }, "Problem category created")
              }
            >
              Create
            </Button>
          </div>

          <div className="mt-4">
            <TextField
              id="searchProblemCategory"
              label="Search"
              value={searchProblemCategory}
              onChange={(event) => setSearchProblemCategory(event.target.value)}
              placeholder="Search category or helper text"
            />
          </div>

          <ul className="mt-4 space-y-2">
            {filteredProblemCategories.map((item) => (
              <li key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    value={problemCategoryNameDrafts[item.id] ?? item.name}
                    onChange={(event) =>
                      setProblemCategoryNameDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))
                    }
                  />
                  <input
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    value={problemCategoryHelperDrafts[item.id] ?? item.helperText ?? ""}
                    onChange={(event) =>
                      setProblemCategoryHelperDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))
                    }
                    placeholder="Helper text"
                  />
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
                    disabled={mutating || !(problemCategoryNameDrafts[item.id] ?? item.name).trim()}
                    onClick={() =>
                      void runMutation(async () => {
                        await updateAdminProblemCategory(item.id, {
                          name: (problemCategoryNameDrafts[item.id] ?? item.name).trim(),
                          helperText: (problemCategoryHelperDrafts[item.id] ?? item.helperText ?? "").trim() || "",
                        });
                      }, "Problem category updated")
                    }
                  >
                    Save
                  </Button>

                  <Button
                    type="button"
                    className={item.isActive ? "bg-emerald-700 hover:bg-emerald-600" : "bg-slate-700 hover:bg-slate-600"}
                    disabled={mutating}
                    onClick={() =>
                      void runMutation(async () => {
                        await updateAdminProblemCategory(item.id, { isActive: !item.isActive });
                      }, "Problem category status updated")
                    }
                  >
                    {item.isActive ? "Active" : "Inactive"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!loading && activeTab === "vehicleIssueCategories" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Vehicle Issue Categories</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextField
              id="newVehicleIssueCategory"
              label="Create category"
              value={newVehicleIssueCategoryName}
              onChange={(event) => setNewVehicleIssueCategoryName(event.target.value)}
              placeholder="Vehicle issue category name"
            />
            <div className="flex items-end">
              <Button
                type="button"
                disabled={mutating || !newVehicleIssueCategoryName.trim()}
                onClick={() =>
                  void runMutation(async () => {
                    await createAdminVehicleIssueCategory({ name: newVehicleIssueCategoryName.trim() });
                    setNewVehicleIssueCategoryName("");
                  }, "Vehicle issue category created")
                }
              >
                Create
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <TextField
              id="searchVehicleIssueCategory"
              label="Search"
              value={searchVehicleIssueCategory}
              onChange={(event) => setSearchVehicleIssueCategory(event.target.value)}
              placeholder="Search category"
            />
          </div>

          <ul className="mt-4 space-y-2">
            {filteredVehicleIssueCategories.map((item) => (
              <li key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <input
                    className="min-w-56 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    value={vehicleIssueCategoryDrafts[item.id] ?? item.name}
                    onChange={(event) =>
                      setVehicleIssueCategoryDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))
                    }
                  />

                  <Button
                    type="button"
                    className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
                    disabled={mutating || !(vehicleIssueCategoryDrafts[item.id] ?? item.name).trim()}
                    onClick={() =>
                      void runMutation(async () => {
                        await updateAdminVehicleIssueCategory(item.id, {
                          name: (vehicleIssueCategoryDrafts[item.id] ?? item.name).trim(),
                        });
                      }, "Vehicle issue category updated")
                    }
                  >
                    Save name
                  </Button>

                  <Button
                    type="button"
                    className={item.isActive ? "bg-emerald-700 hover:bg-emerald-600" : "bg-slate-700 hover:bg-slate-600"}
                    disabled={mutating}
                    onClick={() =>
                      void runMutation(async () => {
                        await updateAdminVehicleIssueCategory(item.id, { isActive: !item.isActive });
                      }, "Vehicle issue category status updated")
                    }
                  >
                    {item.isActive ? "Active" : "Inactive"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!loading && activeTab === "operators" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Operators</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextField
              id="newOperator"
              label="Create operator"
              value={newOperatorName}
              onChange={(event) => setNewOperatorName(event.target.value)}
              placeholder="Display name"
            />
            <div className="flex items-end">
              <Button
                type="button"
                disabled={mutating || !newOperatorName.trim()}
                onClick={() =>
                  void runMutation(async () => {
                    await createAdminOperator({ displayName: newOperatorName.trim() });
                    setNewOperatorName("");
                  }, "Operator created")
                }
              >
                Create
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <TextField
              id="searchOperator"
              label="Search"
              value={searchOperator}
              onChange={(event) => setSearchOperator(event.target.value)}
              placeholder="Search operator"
            />
          </div>

          <ul className="mt-4 space-y-2">
            {filteredOperators.map((item) => (
              <li key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <input
                    className="min-w-56 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    value={operatorDrafts[item.id] ?? item.displayName}
                    onChange={(event) =>
                      setOperatorDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))
                    }
                  />

                  <Button
                    type="button"
                    className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
                    disabled={mutating || !(operatorDrafts[item.id] ?? item.displayName).trim()}
                    onClick={() =>
                      void runMutation(async () => {
                        await updateAdminOperator(item.id, {
                          displayName: (operatorDrafts[item.id] ?? item.displayName).trim(),
                        });
                      }, "Operator updated")
                    }
                  >
                    Save name
                  </Button>

                  <Button
                    type="button"
                    className={item.isActive ? "bg-emerald-700 hover:bg-emerald-600" : "bg-slate-700 hover:bg-slate-600"}
                    disabled={mutating}
                    onClick={() =>
                      void runMutation(async () => {
                        await updateAdminOperator(item.id, { isActive: !item.isActive });
                      }, "Operator status updated")
                    }
                  >
                    {item.isActive ? "Active" : "Inactive"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {successMessage ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {successMessage}
        </section>
      ) : null}

      {errorMessage ? (
        <section className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {errorMessage}
        </section>
      ) : null}
    </main>
  );
}

