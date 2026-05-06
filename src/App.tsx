import React, { useEffect, useState } from "react";

type Tab = "optimize" | "requests" | "ships" | "rules";

interface ScheduleEntry {
  request_id: number;
  port: string;
  call_date: string;
}

interface KPIs {
  kotor_share: number | null;
  max_daily_pax: number | null;
  violations: number;
}

interface OptimizeResponse {
  schedule: ScheduleEntry[];
  kpis: KPIs;
}

interface Ship {
  id: number;
  name: string;
  length_m: number;
  draft_m: number;
  pax_capacity: number;
}

interface CruiseRequest {
  id: number;
  ship_id: number;
  pax_expected: number;
  eta_earliest: string;
  eta_latest: string;
  preferred_port: string | null;
  priority: number;
}

interface Ruleset {
  id: number;
  kotor_target_share: number;
  big_ship_length_threshold: number;
  big_ship_pax_threshold: number;
  bar_big_ship_mandatory: boolean;
  max_calls_per_day_per_port: number | null;
}

const API_BASE = "https://h673zybi22.execute-api.eu-central-1.amazonaws.com/prod";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("optimize");

  // OPTIMIZE
  const [fromDate, setFromDate] = useState("2025-05-01");
  const [toDate, setToDate] = useState("2025-05-31");
  const [optResult, setOptResult] = useState<OptimizeResponse | null>(null);
  const [optLoading, setOptLoading] = useState(false);
  const [optError, setOptError] = useState<string | null>(null);

  // SHIPS
  const [ships, setShips] = useState<Ship[]>([]);
  const [shipsLoaded, setShipsLoaded] = useState(false);
  const [shipForm, setShipForm] = useState<Partial<Ship>>({});
  const [editingShipId, setEditingShipId] = useState<number | null>(null);
  const [shipMsg, setShipMsg] = useState<string | null>(null);

  // REQUESTS
  const [requests, setRequests] = useState<CruiseRequest[]>([]);
  const [requestsLoaded, setRequestsLoaded] = useState(false);
  const [requestForm, setRequestForm] = useState<Partial<CruiseRequest>>({});
  const [editingRequestId, setEditingRequestId] = useState<number | null>(null);
  const [requestMsg, setRequestMsg] = useState<string | null>(null);

  // RULES
  const [rules, setRules] = useState<Ruleset | null>(null);
  const [rulesLoaded, setRulesLoaded] = useState(false);
  const [rulesMsg, setRulesMsg] = useState<string | null>(null);

  // helper za fetch
  const fetchJSON = async (url: string, init?: RequestInit) => {
    const resp = await fetch(url, init);
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${text}`);
    }
    return resp.json();
  };

  // lazy učitavanje po tabu
  useEffect(() => {
    if (activeTab === "ships" && !shipsLoaded) {
      loadShips();
    } else if (activeTab === "requests" && !requestsLoaded) {
      loadShips(); // potreban ship_id za dropdown
      loadRequests();
    } else if (activeTab === "rules" && !rulesLoaded) {
      loadRules();
    }
  }, [activeTab]);

  // LOADERS
  const loadShips = async () => {
    try {
      const data: Ship[] = await fetchJSON(`${API_BASE}/ships`);
      setShips(data);
      setShipsLoaded(true);
    } catch (e) {
      console.error(e);
      setShipMsg("Failed to load ships.");
    }
  };

  const loadRequests = async () => {
    try {
      const data: CruiseRequest[] = await fetchJSON(`${API_BASE}/requests`);
      setRequests(data);
      setRequestsLoaded(true);
    } catch (e) {
      console.error(e);
      setRequestMsg("Failed to load requests.");
    }
  };

  const loadRules = async () => {
    try {
      const data: Ruleset | Ruleset[] = await fetchJSON(`${API_BASE}/rules`);
      const ruleset = Array.isArray(data) ? data[0] : data;
      setRules(ruleset);
      setRulesLoaded(true);
    } catch (e) {
      console.error(e);
      setRulesMsg("Failed to load rules.");
    }
  };

  // OPTIMIZE
  const handleOptimize = async () => {
    setOptError(null);
    setOptLoading(true);
    try {
      const payload = {
        date_range: { start: fromDate, end: toDate },
        ruleset_id: 1,
      };
      const data: OptimizeResponse = await fetchJSON(
        `${API_BASE}/optimize-ilp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      setOptResult(data);
    } catch (e: any) {
      console.error(e);
      setOptError(e.message || "Optimization failed.");
    } finally {
      setOptLoading(false);
    }
  };

  // SHIPS – helpers
  const resetShipForm = () => {
    setShipForm({});
    setEditingShipId(null);
  };

  const handleShipEdit = (ship: Ship) => {
    setEditingShipId(ship.id);
    setShipForm({
      id: ship.id,
      name: ship.name,
      length_m: ship.length_m,
      draft_m: ship.draft_m,
      pax_capacity: ship.pax_capacity,
    });
  };

  const handleShipDelete = async (id: number) => {
    setShipMsg(null);
    try {
      await fetchJSON(`${API_BASE}/ships/${id}`, { method: "DELETE" });
      setShips(ships.filter((s) => s.id !== id));
      if (editingShipId === id) resetShipForm();
      setShipMsg("Ship deleted.");
    } catch (e: any) {
      console.error(e);
      setShipMsg("Delete failed: " + e.message);
    }
  };

  const handleShipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShipMsg(null);

    if (!shipForm.name) {
      setShipMsg("Name is required.");
      return;
    }

    const length_m = Number(shipForm.length_m || 0);
    const draft_m = Number(shipForm.draft_m || 0);
    const pax_capacity = Number(shipForm.pax_capacity || 0);

    if (length_m <= 0 || draft_m <= 0 || pax_capacity <= 0) {
      setShipMsg("Length, draft and pax capacity must be > 0.");
      return;
    }

    const payload = {
      name: shipForm.name,
      length_m,
      draft_m,
      pax_capacity,
    };

    try {
      if (editingShipId == null) {
        const created: Ship = await fetchJSON(`${API_BASE}/ships`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setShips([...ships, created]);
        setShipMsg("Ship created.");
      } else {
        const updated: Ship = await fetchJSON(
          `${API_BASE}/ships/${editingShipId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        setShips(
          ships.map((s) => (s.id === editingShipId ? updated : s))
        );
        setShipMsg("Ship updated.");
      }
      resetShipForm();
    } catch (e: any) {
      console.error(e);
      setShipMsg("Save failed: " + e.message);
    }
  };

  // REQUESTS – helpers
  const resetRequestForm = () => {
    setRequestForm({});
    setEditingRequestId(null);
  };

  const handleRequestEdit = (req: CruiseRequest) => {
    setEditingRequestId(req.id);
    setRequestForm({ ...req });
  };

  const handleRequestDelete = async (id: number) => {
    setRequestMsg(null);
    try {
      await fetchJSON(`${API_BASE}/requests/${id}`, { method: "DELETE" });
      setRequests(requests.filter((r) => r.id !== id));
      if (editingRequestId === id) resetRequestForm();
      setRequestMsg("Request deleted.");
    } catch (e: any) {
      console.error(e);
      setRequestMsg("Delete failed: " + e.message);
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestMsg(null);

    if (!requestForm.ship_id || !requestForm.eta_earliest || !requestForm.eta_latest) {
      setRequestMsg("Ship, earliest and latest date are required.");
      return;
    }

    const pax_expected = Number(requestForm.pax_expected || 0);
    const priority = Number(
      requestForm.priority === undefined ? 0 : requestForm.priority
    );

    if (pax_expected <= 0) {
      setRequestMsg("Expected pax must be > 0.");
      return;
    }
    if (requestForm.eta_earliest! > requestForm.eta_latest!) {
      setRequestMsg("Earliest date must be <= latest date.");
      return;
    }

    const payload = {
      ship_id: Number(requestForm.ship_id),
      pax_expected,
      eta_earliest: requestForm.eta_earliest,
      eta_latest: requestForm.eta_latest,
      preferred_port: requestForm.preferred_port || null,
      priority,
    };

    try {
      if (editingRequestId == null) {
        const created: CruiseRequest = await fetchJSON(
          `${API_BASE}/requests`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        setRequests([...requests, created]);
        setRequestMsg("Request created.");
      } else {
        const updated: CruiseRequest = await fetchJSON(
          `${API_BASE}/requests/${editingRequestId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        setRequests(
          requests.map((r) => (r.id === editingRequestId ? updated : r))
        );
        setRequestMsg("Request updated.");
      }
      resetRequestForm();
    } catch (e: any) {
      console.error(e);
      setRequestMsg("Save failed: " + e.message);
    }
  };

  // RULES
  const handleRulesChange = (field: keyof Ruleset, value: any) => {
    if (!rules) return;
    setRules({ ...rules, [field]: value });
  };

  const handleRulesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rules) return;
    setRulesMsg(null);

    const payload = {
      kotor_target_share: Number(rules.kotor_target_share),
      big_ship_length_threshold: Number(rules.big_ship_length_threshold),
      big_ship_pax_threshold: Number(rules.big_ship_pax_threshold),
      bar_big_ship_mandatory: Boolean(rules.bar_big_ship_mandatory),
      max_calls_per_day_per_port:
        rules.max_calls_per_day_per_port === null ||
        rules.max_calls_per_day_per_port === undefined ||
        rules.max_calls_per_day_per_port === ("" as any)
          ? null
          : Number(rules.max_calls_per_day_per_port),
    };

    try {
      const updated: Ruleset = await fetchJSON(`${API_BASE}/rules`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setRules(updated);
      setRulesMsg("Rules saved.");
    } catch (e: any) {
      console.error(e);
      setRulesMsg("Failed to save rules: " + e.message);
    }
  };

  // RENDER TABOVI

  const renderOptimizeTab = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={handleOptimize}
          disabled={optLoading}
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-60"
        >
          {optLoading ? "Optimizing..." : "Run optimisation"}
        </button>
        {optError && (
          <span className="text-sm text-red-600">{optError}</span>
        )}
      </div>

      {optResult && (
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold mb-2 text-sm">KPIs</h2>
            <div className="flex gap-6 text-sm">
              <div>
                <span className="font-medium">Kotor share:</span>{" "}
                {optResult.kpis.kotor_share === null
                  ? "n/a"
                  : Math.round(optResult.kpis.kotor_share * 100) + "%"}
              </div>
              <div>
                <span className="font-medium">Max daily pax:</span>{" "}
                {optResult.kpis.max_daily_pax ?? "n/a"}
              </div>
              <div>
                <span className="font-medium">Violations:</span>{" "}
                {optResult.kpis.violations}
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-semibold mb-2 text-sm">Schedule</h2>
            {optResult.schedule.length === 0 ? (
              <div className="text-sm text-gray-500">
                No schedule entries.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border px-2 py-1 text-left">Req ID</th>
                      <th className="border px-2 py-1 text-left">Port</th>
                      <th className="border px-2 py-1 text-left">Call date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {optResult.schedule.map((s) => (
                      <tr key={s.request_id + "_" + s.call_date}>
                        <td className="border px-2 py-1">{s.request_id}</td>
                        <td className="border px-2 py-1">{s.port}</td>
                        <td className="border px-2 py-1">{s.call_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderShipsTab = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <h2 className="font-semibold mb-2 text-sm">Ships</h2>
        {ships.length === 0 ? (
          <div className="text-sm text-gray-500">No ships in database.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-2 py-1 text-left">ID</th>
                  <th className="border px-2 py-1 text-left">Name</th>
                  <th className="border px-2 py-1 text-left">Length (m)</th>
                  <th className="border px-2 py-1 text-left">Draft (m)</th>
                  <th className="border px-2 py-1 text-left">Pax</th>
                  <th className="border px-2 py-1 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ships.map((ship) => (
                  <tr key={ship.id}>
                    <td className="border px-2 py-1">{ship.id}</td>
                    <td className="border px-2 py-1">{ship.name}</td>
                    <td className="border px-2 py-1">{ship.length_m}</td>
                    <td className="border px-2 py-1">{ship.draft_m}</td>
                    <td className="border px-2 py-1">{ship.pax_capacity}</td>
                    <td className="border px-2 py-1 space-x-2">
                      <button
                        className="text-xs text-blue-600 underline"
                        onClick={() => handleShipEdit(ship)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-xs text-red-600 underline"
                        onClick={() => handleShipDelete(ship.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="font-semibold mb-2 text-sm">
          {editingShipId == null ? "New ship" : `Edit ship #${editingShipId}`}
        </h2>
        <form className="space-y-2 text-sm" onSubmit={handleShipSubmit}>
          <div>
            <label className="block mb-1">Name</label>
            <input
              className="border rounded px-2 py-1 w-full"
              value={shipForm.name || ""}
              onChange={(e) =>
                setShipForm({ ...shipForm, name: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block mb-1">Length (m)</label>
              <input
                type="number"
                className="border rounded px-2 py-1 w-full"
                value={shipForm.length_m ?? ""}
                onChange={(e) =>
                  setShipForm({
                    ...shipForm,
                    length_m:
                      e.target.value === ""
                        ? ("" as any)
                        : Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label className="block mb-1">Draft (m)</label>
              <input
                type="number"
                className="border rounded px-2 py-1 w-full"
                value={shipForm.draft_m ?? ""}
                onChange={(e) =>
                  setShipForm({
                    ...shipForm,
                    draft_m:
                      e.target.value === ""
                        ? ("" as any)
                        : Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label className="block mb-1">Pax</label>
              <input
                type="number"
                className="border rounded px-2 py-1 w-full"
                value={shipForm.pax_capacity ?? ""}
                onChange={(e) =>
                  setShipForm({
                    ...shipForm,
                    pax_capacity:
                      e.target.value === ""
                        ? ("" as any)
                        : Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              type="submit"
              className="px-3 py-1 rounded bg-blue-600 text-white text-xs"
            >
              Save
            </button>
            <button
              type="button"
              onClick={resetShipForm}
              className="px-3 py-1 rounded border text-xs"
            >
              Clear
            </button>
          </div>
          {shipMsg && <div className="text-xs mt-2">{shipMsg}</div>}
        </form>
      </div>
    </div>
  );

  const renderRequestsTab = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <h2 className="font-semibold mb-2 text-sm">Cruise Requests</h2>
        {requests.length === 0 ? (
          <div className="text-sm text-gray-500">No requests in database.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-2 py-1 text-left">ID</th>
                  <th className="border px-2 py-1 text-left">Ship</th>
                  <th className="border px-2 py-1 text-left">Pax</th>
                  <th className="border px-2 py-1 text-left">Earliest</th>
                  <th className="border px-2 py-1 text-left">Latest</th>
                  <th className="border px-2 py-1 text-left">Pref. port</th>
                  <th className="border px-2 py-1 text-left">Priority</th>
                  <th className="border px-2 py-1 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id}>
                    <td className="border px-2 py-1">{req.id}</td>
                    <td className="border px-2 py-1">
                      {req.ship_id}
                    </td>
                    <td className="border px-2 py-1">
                      {req.pax_expected}
                    </td>
                    <td className="border px-2 py-1">
                      {req.eta_earliest}
                    </td>
                    <td className="border px-2 py-1">
                      {req.eta_latest}
                    </td>
                    <td className="border px-2 py-1">
                      {req.preferred_port || "-"}
                    </td>
                    <td className="border px-2 py-1">
                      {req.priority}
                    </td>
                    <td className="border px-2 py-1 space-x-2">
                      <button
                        className="text-xs text-blue-600 underline"
                        onClick={() => handleRequestEdit(req)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-xs text-red-600 underline"
                        onClick={() => handleRequestDelete(req.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="font-semibold mb-2 text-sm">
          {editingRequestId == null
            ? "New request"
            : `Edit request #${editingRequestId}`}
        </h2>
        <form className="space-y-2 text-sm" onSubmit={handleRequestSubmit}>
          <div>
            <label className="block mb-1">Ship</label>
            <select
              className="border rounded px-2 py-1 w-full"
              value={requestForm.ship_id ?? ""}
              onChange={(e) =>
                setRequestForm({
                  ...requestForm,
                  ship_id:
                    e.target.value === ""
                      ? ("" as any)
                      : Number(e.target.value),
                })
              }
            >
              <option value="">Select ship</option>
              {ships.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} - {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1">Expected pax</label>
            <input
              type="number"
              className="border rounded px-2 py-1 w-full"
              value={requestForm.pax_expected ?? ""}
              onChange={(e) =>
                setRequestForm({
                  ...requestForm,
                  pax_expected:
                    e.target.value === ""
                      ? ("" as any)
                      : Number(e.target.value),
                })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block mb-1">Earliest ETA</label>
              <input
                type="date"
                className="border rounded px-2 py-1 w-full"
                value={requestForm.eta_earliest ?? ""}
                onChange={(e) =>
                  setRequestForm({
                    ...requestForm,
                    eta_earliest: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="block mb-1">Latest ETA</label>
              <input
                type="date"
                className="border rounded px-2 py-1 w-full"
                value={requestForm.eta_latest ?? ""}
                onChange={(e) =>
                  setRequestForm({
                    ...requestForm,
                    eta_latest: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <div>
            <label className="block mb-1">Preferred port (optional)</label>
            <input
              className="border rounded px-2 py-1 w-full"
              value={requestForm.preferred_port ?? ""}
              onChange={(e) =>
                setRequestForm({
                  ...requestForm,
                  preferred_port:
                    e.target.value === "" ? null : e.target.value,
                })
              }
            />
          </div>
          <div>
            <label className="block mb-1">Priority (0 = normal)</label>
            <input
              type="number"
              className="border rounded px-2 py-1 w-full"
              value={requestForm.priority ?? 0}
              onChange={(e) =>
                setRequestForm({
                  ...requestForm,
                  priority:
                    e.target.value === ""
                      ? ("" as any)
                      : Number(e.target.value),
                })
              }
            />
          </div>
          <div className="flex gap-2 mt-2">
            <button
              type="submit"
              className="px-3 py-1 rounded bg-blue-600 text-white text-xs"
            >
              Save
            </button>
            <button
              type="button"
              onClick={resetRequestForm}
              className="px-3 py-1 rounded border text-xs"
            >
              Clear
            </button>
          </div>
          {requestMsg && <div className="text-xs mt-2">{requestMsg}</div>}
        </form>
      </div>
    </div>
  );

  const renderRulesTab = () => {
    if (!rulesLoaded) {
      return <div className="text-sm text-gray-500">Loading rules…</div>;
    }
    if (!rules) {
      return (
        <div className="text-sm text-red-600">
          Ruleset not found. Check backend /rules endpoint.
        </div>
      );
    }

    return (
      <div className="max-w-xl space-y-4">
        <h2 className="font-semibold text-sm">Rules configuration</h2>
        <form className="space-y-3 text-sm" onSubmit={handleRulesSubmit}>
          <div>
            <label className="block mb-1">
              Kotor target share (0–1)
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              max={1}
              className="border rounded px-2 py-1 w-full"
              value={rules.kotor_target_share}
              onChange={(e) =>
                handleRulesChange(
                  "kotor_target_share",
                  e.target.value === "" ? 0 : Number(e.target.value)
                )
              }
            />
            <p className="text-xs text-gray-500">
              Desired fraction of calls that should go to Kotor over the
              planning horizon.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1">
                Big ship length threshold (m)
              </label>
              <input
                type="number"
                className="border rounded px-2 py-1 w-full"
                value={rules.big_ship_length_threshold}
                onChange={(e) =>
                  handleRulesChange(
                    "big_ship_length_threshold",
                    e.target.value === "" ? 0 : Number(e.target.value)
                  )
                }
              />
            </div>
            <div>
              <label className="block mb-1">
                Big ship pax threshold
              </label>
              <input
                type="number"
                className="border rounded px-2 py-1 w-full"
                value={rules.big_ship_pax_threshold}
                onChange={(e) =>
                  handleRulesChange(
                    "big_ship_pax_threshold",
                    e.target.value === "" ? 0 : Number(e.target.value)
                  )
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="bar_mandatory"
              type="checkbox"
              checked={rules.bar_big_ship_mandatory}
              onChange={(e) =>
                handleRulesChange(
                  "bar_big_ship_mandatory",
                  e.target.checked
                )
              }
            />
            <label htmlFor="bar_mandatory">
              Big ships must go to Bar
            </label>
          </div>
          <p className="text-xs text-gray-500">
            If enabled, ships above both thresholds are forced to Bar in ILP
            model (hard/soft constraint depending on backend settings).
          </p>

          <div>
            <label className="block mb-1">
              Max calls per day per port (optional)
            </label>
            <input
              type="number"
              className="border rounded px-2 py-1 w-full"
              value={rules.max_calls_per_day_per_port ?? ""}
              onChange={(e) =>
                handleRulesChange(
                  "max_calls_per_day_per_port",
                  e.target.value === "" ? ("" as any) : Number(e.target.value)
                )
              }
            />
            <p className="text-xs text-gray-500">
              Leave empty for no explicit per-day call limit. This is in
              addition to pax and berthing capacity constraints.
            </p>
          </div>

          <div className="flex gap-2 mt-2">
            <button
              type="submit"
              className="px-3 py-1 rounded bg-blue-600 text-white text-xs"
            >
              Save rules
            </button>
          </div>
          {rulesMsg && <div className="text-xs mt-2">{rulesMsg}</div>}
        </form>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-lg font-semibold">
              Smart Cruise Port Scheduler
            </h1>
            <p className="text-xs text-gray-500">
              Kotor &amp; Bar · AI-assisted cruise scheduling
            </p>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm">
            <button
              onClick={() => setActiveTab("optimize")}
              className={`px-3 py-1 rounded border ${
                activeTab === "optimize"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white"
              }`}
            >
              Optimize
            </button>
            <button
              onClick={() => setActiveTab("requests")}
              className={`px-3 py-1 rounded border ${
                activeTab === "requests"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white"
              }`}
            >
              Requests
            </button>
            <button
              onClick={() => setActiveTab("ships")}
              className={`px-3 py-1 rounded border ${
                activeTab === "ships"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white"
              }`}
            >
              Ships
            </button>
            <button
              onClick={() => setActiveTab("rules")}
              className={`px-3 py-1 rounded border ${
                activeTab === "rules"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white"
              }`}
            >
              Rules
            </button>
          </nav>
        </header>

        <main className="bg-white rounded-lg shadow p-4">
          {activeTab === "optimize" && renderOptimizeTab()}
          {activeTab === "ships" && renderShipsTab()}
          {activeTab === "requests" && renderRequestsTab()}
          {activeTab === "rules" && renderRulesTab()}
        </main>
      </div>
    </div>
  );
};

export default App;
