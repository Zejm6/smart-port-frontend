import React, { useEffect, useState } from "react";

type Tab = "optimize" | "requests" | "ships" | "ports" | "rules";

// ------- TYPES FROM BACKEND --------

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

interface Port {
  id: number;
  name: string;
  max_berths: number;
  daily_pax_capacity: number;
  max_ship_length_m: number;
  max_draft_m: number;
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

// -----------------------------------

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

  // PORTS
  const [ports, setPorts] = useState<Port[]>([]);
  const [portsLoaded, setPortsLoaded] = useState(false);
  const [portForm, setPortForm] = useState<Partial<Port>>({});
  const [editingPortId, setEditingPortId] = useState<number | null>(null);
  const [portMsg, setPortMsg] = useState<string | null>(null);

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
    } else if (activeTab === "ports" && !portsLoaded) {
      loadPorts();
    } else if (activeTab === "requests" && !requestsLoaded) {
      if (!shipsLoaded) {
        loadShips();
      }
      loadRequests();
    } else if (activeTab === "rules" && !rulesLoaded) {
      loadRules();
    }
  }, [activeTab]); // namerno samo activeTab

  // ---------- LOADERS ----------

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

  const loadPorts = async () => {
    try {
      const data: Port[] = await fetchJSON(`${API_BASE}/ports`);
      setPorts(data);
      setPortsLoaded(true);
    } catch (e) {
      console.error(e);
      setPortMsg("Failed to load ports.");
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

  // ---------- OPTIMIZE ----------

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

  // ---------- SHIPS – helpers ----------

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

  // ---------- PORTS – helpers ----------

  const resetPortForm = () => {
    setPortForm({});
    setEditingPortId(null);
  };

  const handlePortEdit = (port: Port) => {
    setEditingPortId(port.id);
    setPortForm({ ...port });
  };

  const handlePortDelete = async (id: number) => {
    setPortMsg(null);
    try {
      await fetchJSON(`${API_BASE}/ports/${id}`, { method: "DELETE" });
      setPorts(ports.filter((p) => p.id !== id));
      if (editingPortId === id) resetPortForm();
      setPortMsg("Port deleted.");
    } catch (e: any) {
      console.error(e);
      setPortMsg("Delete failed: " + e.message);
    }
  };

  const handlePortSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPortMsg(null);

    if (!portForm.name) {
      setPortMsg("Name is required.");
      return;
    }

    const max_berths = Number(portForm.max_berths || 0);
    const daily_pax_capacity = Number(portForm.daily_pax_capacity || 0);
    const max_ship_length_m = Number(portForm.max_ship_length_m || 0);
    const max_draft_m = Number(portForm.max_draft_m || 0);

    if (
      max_berths <= 0 ||
      daily_pax_capacity <= 0 ||
      max_ship_length_m <= 0 ||
      max_draft_m <= 0
    ) {
      setPortMsg("All numeric fields must be > 0.");
      return;
    }

    const payload = {
      name: portForm.name,
      max_berths,
      daily_pax_capacity,
      max_ship_length_m,
      max_draft_m,
    };

    try {
      if (editingPortId == null) {
        const created: Port = await fetchJSON(`${API_BASE}/ports`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setPorts([...ports, created]);
        setPortMsg("Port created.");
      } else {
        const updated: Port = await fetchJSON(
          `${API_BASE}/ports/${editingPortId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        setPorts(
          ports.map((p) => (p.id === editingPortId ? updated : p))
        );
        setPortMsg("Port updated.");
      }
      resetPortForm();
    } catch (e: any) {
      console.error(e);
      setPortMsg("Save failed: " + e.message);
    }
  };

  // ---------- REQUESTS – helpers ----------

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

  // ---------- RULES ----------

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
        (rules.max_calls_per_day_per_port as any) === ""
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

  // ---------- RENDER TABS ----------

  const renderOptimizeTab = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-200">
            From
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-slate-700 bg-slate-900 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-200">
            To
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-slate-700 bg-slate-900 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />
        </div>
        <button
          onClick={handleOptimize}
          disabled={optLoading}
          className="px-5 py-2.5 rounded-md bg-cyan-500 text-slate-900 text-sm font-semibold shadow hover:bg-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {optLoading ? "Optimizing..." : "Run optimization"}
        </button>
        {optError && (
          <span className="text-sm text-red-400 max-w-md break-words">
            {optError}
          </span>
        )}
      </div>

      {optResult && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Kotor share
              </div>
              <div className="mt-2 text-2xl font-semibold text-cyan-300">
                {optResult.kpis.kotor_share === null
                  ? "n/a"
                  : Math.round(optResult.kpis.kotor_share * 100) + "%"}
              </div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Max daily pax
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-100">
                {optResult.kpis.max_daily_pax ?? "n/a"}
              </div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Constraint violations
              </div>
              <div className="mt-2 text-2xl font-semibold text-red-300">
                {optResult.kpis.violations}
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-semibold mb-3 text-base text-slate-100">
              Schedule
            </h2>
            {optResult.schedule.length === 0 ? (
              <div className="text-sm text-slate-400">
                No schedule entries.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-900/80">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-300 border-b border-slate-800">
                        Request ID
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-300 border-b border-slate-800">
                        Port
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-300 border-b border-slate-800">
                        Call date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {optResult.schedule.map((s, idx) => (
                      <tr
                        key={s.request_id + "_" + s.call_date + "_" + idx}
                        className="hover:bg-slate-900/60"
                      >
                        <td className="px-3 py-2 border-b border-slate-800">
                          {s.request_id}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-800">
                          {s.port}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-800">
                          {s.call_date}
                        </td>
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
    <div className="grid grid-cols-1 xl:grid-cols-[2fr,1fr] gap-6">
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-base text-slate-100">Ships</h2>
          <span className="text-xs text-slate-400">
            Total: {ships.length}
          </span>
        </div>
        {ships.length === 0 ? (
          <div className="text-sm text-slate-400">No ships in database.</div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-slate-800 bg-slate-950/60">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/80">
                <tr>
                  <th className="border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-300">
                    ID
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-300">
                    Name
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-300">
                    Length (m)
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-300">
                    Draft (m)
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-300">
                    Pax
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {ships.map((ship) => (
                  <tr
                    key={ship.id}
                    className="hover:bg-slate-900/60 transition"
                  >
                    <td className="border-b border-slate-800 px-3 py-2">
                      {ship.id}
                    </td>
                    <td className="border-b border-slate-800 px-3 py-2">
                      {ship.name}
                    </td>
                    <td className="border-b border-slate-800 px-3 py-2">
                      {ship.length_m}
                    </td>
                    <td className="border-b border-slate-800 px-3 py-2">
                      {ship.draft_m}
                    </td>
                    <td className="border-b border-slate-800 px-3 py-2">
                      {ship.pax_capacity}
                    </td>
                    <td className="border-b border-slate-800 px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          className="text-xs font-medium text-cyan-300 hover:text-cyan-200 underline"
                          onClick={() => handleShipEdit(ship)}
                        >
                          Edit
                        </button>
                        <button
                          className="text-xs font-medium text-rose-300 hover:text-rose-200 underline"
                          onClick={() => handleShipDelete(ship.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <h2 className="font-semibold mb-3 text-base text-slate-100">
          {editingShipId == null ? "New ship" : `Edit ship #${editingShipId}`}
        </h2>
        <form className="space-y-3 text-sm" onSubmit={handleShipSubmit}>
          <div>
            <label className="block mb-1 text-slate-200">Name</label>
            <input
              className="border border-slate-700 bg-slate-900 rounded px-3 py-2 w-full text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              value={shipForm.name || ""}
              onChange={(e) =>
                setShipForm({ ...shipForm, name: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block mb-1 text-slate-200">Length (m)</label>
              <input
                type="number"
                className="border border-slate-700 bg-slate-900 rounded px-3 py-2 w-full text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
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
              <label className="block mb-1 text-slate-200">Draft (m)</label>
              <input
                type="number"
                className="border border-slate-700 bg-slate-900 rounded px-3 py-2 w-full text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
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
              <label className="block mb-1 text-slate-200">Pax</label>
              <input
                type="number"
                className="border border-slate-700 bg-slate-900 rounded px-3 py-2 w-full text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
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
          <div className="flex gap-3 mt-3">
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-cyan-500 text-slate-900 text-sm font-semibold shadow hover:bg-cyan-400 transition"
            >
              Save
            </button>
            <button
              type="button"
              onClick={resetShipForm}
              className="px-4 py-2 rounded-md border border-slate-600 text-sm text-slate-200 hover:bg-slate-800 transition"
            >
              Clear
            </button>
          </div>
          {shipMsg && (
            <div className="text-xs mt-2 text-slate-300 break-words">
              {shipMsg}
            </div>
          )}
        </form>
      </div>
    </div>
  );

  const renderPortsTab = () => (
    <div className="grid grid-cols-1 xl:grid-cols-[2fr,1fr] gap-6">
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-base text-slate-100">Ports</h2>
          <span className="text-xs text-slate-400">
            Total: {ports.length}
          </span>
        </div>
        {ports.length === 0 ? (
          <div className="text-sm text-slate-400">No ports in database.</div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-slate-800 bg-slate-950/60">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/80">
                <tr>
                  <th className="border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-300">
                    ID
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-300">
                    Name
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-300">
                    Max berths
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-300">
                    Daily pax
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-300">
                    Max ship length (m)
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-300">
                    Max draft (m)
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {ports.map((port) => (
                  <tr
                    key={port.id}
                    className="hover:bg-slate-900/60 transition"
                  >
                    <td className="border-b border-slate-800 px-3 py-2">
                      {port.id}
                    </td>
                    <td className="border-b border-slate-800 px-3 py-2">
                      {port.name}
                    </td>
                    <td className="border-b border-slate-800 px-3 py-2">
                      {port.max_berths}
                    </td>
                    <td className="border-b border-slate-800 px-3 py-2">
                      {port.daily_pax_capacity}
                    </td>
                    <td className="border-b border-slate-800 px-3 py-2">
                      {port.max_ship_length_m}
                    </td>
                    <td className="border-b border-slate-800 px-3 py-2">
                      {port.max_draft_m}
                    </td>
                    <td className="border-b border-slate-800 px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          className="text-xs font-medium text-cyan-300 hover:text-cyan-200 underline"
                          onClick={() => handlePortEdit(port)}
                        >
                          Edit
                        </button>
                        <button
                          className="text-xs font-medium text-rose-300 hover:text-rose-200 underline"
                          onClick={() => handlePortDelete(port.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <h2 className="font-semibold mb-3 text-base text-slate-100">
          {editingPortId == null ? "New port" : `Edit port #${editingPortId}`}
        </h2>
        <form className="space-y-3 text-sm" onSubmit={handlePortSubmit}>
          <div>
            <label className="block mb-1 text-slate-200">Name</label>
            <input
              className="border border-slate-700 bg-slate-900 rounded px-3 py-2 w-full text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              value={portForm.name || ""}
              onChange={(e) =>
                setPortForm({ ...portForm, name: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 text-slate-200">Max berths</label>
              <input
                type="number"
                className="border border-slate-700 bg-slate-900 rounded px-3 py-2 w-full text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                value={portForm.max_berths ?? ""}
                onChange={(e) =>
                  setPortForm({
                    ...portForm,
                    max_berths:
                      e.target.value === ""
                        ? ("" as any)
                        : Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label className="block mb-1 text-slate-200">
                Daily pax capacity
              </label>
              <input
                type="number"
                className="border border-slate-700 bg-slate-900 rounded px-3 py-2 w-full text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                value={portForm.daily_pax_capacity ?? ""}
                onChange={(e) =>
                  setPortForm({
                    ...portForm,
                    daily_pax_capacity:
                      e.target.value === ""
                        ? ("" as any)
                        : Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 text-slate-200">
                Max ship length (m)
              </label>
              <input
                type="number"
                className="border border-slate-700 bg-slate-900 rounded px-3 py-2 w-full text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                value={portForm.max_ship_length_m ?? ""}
                onChange={(e) =>
                  setPortForm({
                    ...portForm,
                    max_ship_length_m:
                      e.target.value === ""
                        ? ("" as any)
                        : Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label className="block mb-1 text-slate-200">Max draft (m)</label>
              <input
                type="number"
                className="border border-slate-700 bg-slate-900 rounded px-3 py-2 w-full text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                value={portForm.max_draft_m ?? ""}
                onChange={(e) =>
                  setPortForm({
                    ...portForm,
                    max_draft_m:
                      e.target.value === ""
                        ? ("" as any)
                        : Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
          <div className="flex gap-3 mt-3">
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-cyan-500 text-slate-900 text-sm font-semibold shadow hover:bg-cyan-400 transition"
            >
              Save
            </button>
            <button
              type="button"
              onClick={resetPortForm}
              className="px-4 py-2 rounded-md border border-slate-600 text-sm text-slate-200 hover:bg-slate-800 transition"
            >
              Clear
            </button>
          </div>
          {portMsg && (
            <div className="text-xs mt-2 text-slate-300 break-words">
              {portMsg}
            </div>
          )}
        </form>
      </div>
    </div>
  );

  const renderRequestsTab = () => (
    <div className="grid grid-cols-1 xl:grid-cols-[2fr,1fr] gap-6">
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-base text-slate-100">
            Cruise requests
          </h2>
          <span className="text-xs text-slate-400">
            Total: {requests.length}
          </span>
        </div>
        {requests.length === 0 ? (
          <div className="text-sm text-slate-400">No requests in database.</div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-slate-800 bg-slate-950/60">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/80">
                <tr>
                  <th className="border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-300">
                    ID
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-300">
                    Ship
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-300">
                    Pax
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-300">
                    Earliest
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-300">
                    Latest
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-300">
                    Pref. port
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-300">
                    Priority
                  </th>
                  <th className="border-b border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-slate-900/60 transition"
                  >
                    <td className="border-b border-slate-800 px-3 py-2">
                      {req.id}
                    </td>
                    <td className="border-b border-slate-800 px-3 py-2">
                      {req.ship_id}
                    </td>
                    <td className="border-b border-slate-800 px-3 py-2">
                      {req.pax_expected}
                    </td>
                    <td className="border-b border-slate-800 px-3 py-2">
                      {req.eta_earliest}
                    </td>
                    <td className="border-b border-slate-800 px-3 py-2">
                      {req.eta_latest}
                    </td>
                    <td className="border-b border-slate-800 px-3 py-2">
                      {req.preferred_port || "-"}
                    </td>
                    <td className="border-b border-slate-800 px-3 py-2">
                      {req.priority}
                    </td>
                    <td className="border-b border-slate-800 px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          className="text-xs font-medium text-cyan-300 hover:text-cyan-200 underline"
                          onClick={() => handleRequestEdit(req)}
                        >
                          Edit
                        </button>
                        <button
                          className="text-xs font-medium text-rose-300 hover:text-rose-200 underline"
                          onClick={() => handleRequestDelete(req.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <h2 className="font-semibold mb-3 text-base text-slate-100">
          {editingRequestId == null
            ? "New request"
            : `Edit request #${editingRequestId}`}
        </h2>
        <form className="space-y-3 text-sm" onSubmit={handleRequestSubmit}>
          <div>
            <label className="block mb-1 text-slate-200">Ship</label>
            <select
              className="border border-slate-700 bg-slate-900 rounded px-3 py-2 w-full text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
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
            <label className="block mb-1 text-slate-200">Expected pax</label>
            <input
              type="number"
              className="border border-slate-700 bg-slate-900 rounded px-3 py-2 w-full text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 text-slate-200">Earliest ETA</label>
              <input
                type="date"
                className="border border-slate-700 bg-slate-900 rounded px-3 py-2 w-full text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
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
              <label className="block mb-1 text-slate-200">Latest ETA</label>
              <input
                type="date"
                className="border border-slate-700 bg-slate-900 rounded px-3 py-2 w-full text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
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
            <label className="block mb-1 text-slate-200">
              Preferred port (optional)
            </label>
            <input
              className="border border-slate-700 bg-slate-900 rounded px-3 py-2 w-full text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
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
            <label className="block mb-1 text-slate-200">
              Priority (0 = normal)
            </label>
            <input
              type="number"
              className="border border-slate-700 bg-slate-900 rounded px-3 py-2 w-full text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
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
          <div className="flex gap-3 mt-3">
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-cyan-500 text-slate-900 text-sm font-semibold shadow hover:bg-cyan-400 transition"
            >
              Save
            </button>
            <button
              type="button"
              onClick={resetRequestForm}
              className="px-4 py-2 rounded-md border border-slate-600 text-sm text-slate-200 hover:bg-slate-800 transition"
            >
              Clear
            </button>
          </div>
          {requestMsg && (
            <div className="text-xs mt-2 text-slate-300 break-words">
              {requestMsg}
            </div>
          )}
        </form>
      </div>
    </div>
  );

  const renderRulesTab = () => {
    if (!rulesLoaded) {
      return (
        <div className="text-sm text-slate-400">
          Loading rules…
        </div>
      );
    }
    if (!rules) {
      return (
        <div className="text-sm text-red-400">
          Ruleset not found. Check backend /rules endpoint.
        </div>
      );
    }

    return (
      <div className="max-w-xl rounded-lg border border-slate-800 bg-slate-950/60 p-5 space-y-4">
        <h2 className="font-semibold text-base text-slate-100">
          Rules configuration
        </h2>
        <form className="space-y-4 text-sm" onSubmit={handleRulesSubmit}>
          <div>
            <label className="block mb-1 text-slate-200">
              Kotor target share (0–1)
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              max={1}
              className="border border-slate-700 bg-slate-900 rounded px-3 py-2 w-full text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              value={rules.kotor_target_share}
              onChange={(e) =>
                handleRulesChange(
                  "kotor_target_share",
                  e.target.value === "" ? 0 : Number(e.target.value)
                )
              }
            />
            <p className="text-xs text-slate-400 mt-1">
              Desired fraction of calls that should go to Kotor over the planning horizon.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 text-slate-200">
                Big ship length threshold (m)
              </label>
              <input
                type="number"
                className="border border-slate-700 bg-slate-900 rounded px-3 py-2 w-full text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
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
              <label className="block mb-1 text-slate-200">
                Big ship pax threshold
              </label>
              <input
                type="number"
                className="border border-slate-700 bg-slate-900 rounded px-3 py-2 w-full text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
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
              className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-400"
            />
            <label htmlFor="bar_mandatory" className="text-slate-200">
              Big ships must go to Bar
            </label>
          </div>
          <p className="text-xs text-slate-400">
            If enabled, ships above both thresholds are forced to Bar in the ILP model
            (hard/soft constraint depending on backend settings).
          </p>

          <div>
            <label className="block mb-1 text-slate-200">
              Max calls per day per port (optional)
            </label>
            <input
              type="number"
              className="border border-slate-700 bg-slate-900 rounded px-3 py-2 w-full text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              value={rules.max_calls_per_day_per_port ?? ""}
              onChange={(e) =>
                handleRulesChange(
                  "max_calls_per_day_per_port",
                  e.target.value === "" ? ("" as any) : Number(e.target.value)
                )
              }
            />
            <p className="text-xs text-slate-400 mt-1">
              Leave empty for no explicit per-day call limit. This is in addition
              to pax and berthing capacity constraints.
            </p>
          </div>

          <div className="flex gap-3 mt-1">
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-cyan-500 text-slate-900 text-sm font-semibold shadow hover:bg-cyan-400 transition"
            >
              Save rules
            </button>
          </div>
          {rulesMsg && (
            <div className="text-xs mt-2 text-slate-300 break-words">
              {rulesMsg}
            </div>
          )}
        </form>
      </div>
    );
  };

  // ---------- MAIN LAYOUT ----------

  const tabTitleMap: Record<Tab, string> = {
    optimize: "Optimizer",
    requests: "Cruise requests",
    ships: "Ships",
    ports: "Ports",
    rules: "Rules",
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100">
      <div className="flex h-screen">
        {/* SIDEBAR */}
        <aside className="w-64 bg-[#0A192F] border-r border-slate-800 flex flex-col">
          <div className="px-5 py-4 border-b border-slate-800">
            <div className="text-xs uppercase tracking-[0.22em] text-cyan-300">
              Smart Port
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-50">
              Cruise Scheduler
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Kotor &amp; Bar · ILP engine
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
            <button
              onClick={() => setActiveTab("optimize")}
              className={`w-full text-left px-3 py-2 rounded-md font-medium transition ${
                activeTab === "optimize"
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/60 shadow-sm"
                  : "text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              Optimize
            </button>
            <button
              onClick={() => setActiveTab("requests")}
              className={`w-full text-left px-3 py-2 rounded-md font-medium transition ${
                activeTab === "requests"
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/60 shadow-sm"
                  : "text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              Requests
            </button>
            <button
              onClick={() => setActiveTab("ships")}
              className={`w-full text-left px-3 py-2 rounded-md font-medium transition ${
                activeTab === "ships"
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/60 shadow-sm"
                  : "text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              Ships
            </button>
            <button
              onClick={() => setActiveTab("ports")}
              className={`w-full text-left px-3 py-2 rounded-md font-medium transition ${
                activeTab === "ports"
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/60 shadow-sm"
                  : "text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              Ports
            </button>
            <button
              onClick={() => setActiveTab("rules")}
              className={`w-full text-left px-3 py-2 rounded-md font-medium transition ${
                activeTab === "rules"
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/60 shadow-sm"
                  : "text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              Rules
            </button>
          </nav>

          <div className="px-4 py-3 border-t border-slate-800 text-[11px] text-slate-500">
            <div>ILP Backend: localhost:8000</div>
            <div className="mt-1">UI: Vite + React + Tailwind</div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            <header className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-slate-50">
                  {tabTitleMap[activeTab]}
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Configure data, run optimisation and tune rules for Kotor &amp; Bar.
                </p>
              </div>
            </header>

            <section>
              {activeTab === "optimize" && renderOptimizeTab()}
              {activeTab === "ships" && renderShipsTab()}
              {activeTab === "ports" && renderPortsTab()}
              {activeTab === "requests" && renderRequestsTab()}
              {activeTab === "rules" && renderRulesTab()}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
