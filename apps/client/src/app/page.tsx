"use client";

import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, Boxes, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, HardDrive, LayoutDashboard, LogOut, MapPin, PackagePlus, Search, ShieldCheck, UserRound, UsersRound, Wallet } from "lucide-react";
import { api, getApiBaseUrl, type Asset, type Category, type Dashboard, type InventoryItem, type Location, type Role, type Session, type UserOption } from "@/lib/api";

type Catalog = { categories: Category[]; locations: Location[] };
type ListResult<T> = { items: T[]; total: number; page: number; limit: number };

const roleCanManage = (role: Role) => role === "ADMIN" || role === "MANAGER";
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<"assets" | "inventory">("assets");
  const [view, setView] = useState<"overview" | "employees">("overview");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [revision, setRevision] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [showUserCreate, setShowUserCreate] = useState(false);
  const [assigningAsset, setAssigningAsset] = useState<Asset | null>(null);
  const [assignmentUserId, setAssignmentUserId] = useState("");
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ name: "", sku: "", serialNumber: "", categoryId: "", locationId: "", purchasePrice: "", assignedUserId: "", quantity: "0", minThreshold: "5", unitPrice: "0" });
  const [newUser, setNewUser] = useState({ firstName: "", lastName: "", email: "", password: "", role: "STAFF" });
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [catalog, setCatalog] = useState<Catalog>({ categories: [], locations: [] });
  const [users, setUsers] = useState<UserOption[]>([]);
  const [assets, setAssets] = useState<ListResult<Asset> | null>(null);
  const [inventory, setInventory] = useState<ListResult<InventoryItem> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("assetpulse-session");
    if (saved) {
      try { setSession(JSON.parse(saved) as Session); } catch { sessionStorage.removeItem("assetpulse-session"); }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: "8", sort, order });
    if (query) params.set("q", query);
    if (categoryId) params.set("categoryId", categoryId);
    if (locationId) params.set("locationId", locationId);
    Promise.all([
      api<Dashboard>("/api/dashboard", session.token),
      api<Catalog>("/api/catalog", session.token),
      api<{ users: UserOption[] }>("/api/users", session.token),
      api<ListResult<Asset>>(`/api/assets?${params}`, session.token),
      api<ListResult<InventoryItem>>(`/api/inventory?${params}`, session.token),
    ]).then(([kpis, options, userOptions, assetRows, inventoryRows]) => {
      setDashboard(kpis); setCatalog(options); setUsers(userOptions.users); setAssets(assetRows); setInventory(inventoryRows);
    }).catch((cause: Error) => setError(cause.message)).finally(() => setLoading(false));
  }, [session, query, categoryId, locationId, page, sort, order, revision]);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoginError("");
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to sign in");
      const next = result as Session;
      sessionStorage.setItem("assetpulse-session", JSON.stringify(next)); setSession(next);
    } catch (cause) { setLoginError(cause instanceof Error ? cause.message : "Unable to sign in"); }
  }

  function signOut() { sessionStorage.removeItem("assetpulse-session"); setSession(null); setDashboard(null); }
  function changeFilters(update: () => void) { update(); setPage(1); }

  async function createRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFormError("");
    const payload = tab === "assets"
      ? { name: form.name, sku: form.sku, serialNumber: form.serialNumber, categoryId: form.categoryId, locationId: form.locationId, ...(form.purchasePrice ? { purchasePrice: Number(form.purchasePrice) } : {}), ...(form.assignedUserId ? { userId: form.assignedUserId } : {}) }
      : { name: form.name, sku: form.sku, categoryId: form.categoryId, locationId: form.locationId, quantity: Number(form.quantity), minThreshold: Number(form.minThreshold), unitPrice: Number(form.unitPrice) };
    try {
      await api(tab === "assets" ? "/api/assets" : "/api/inventory", session!.token, { method: "POST", body: JSON.stringify(payload) });
      setShowCreate(false); setForm({ name: "", sku: "", serialNumber: "", categoryId: "", locationId: "", purchasePrice: "", assignedUserId: "", quantity: "0", minThreshold: "5", unitPrice: "0" }); setRevision((value) => value + 1);
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : "Unable to create record"); }
  }

  async function adjustStock(id: string, delta: number) {
    try {
      await api(`/api/inventory/${id}/adjust`, session!.token, { method: "POST", body: JSON.stringify({ delta }) });
      setRevision((value) => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update stock"); }
  }

  async function assignAsset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assigningAsset) return;
    setFormError("");
    try {
      await api(`/api/assets/${assigningAsset.id}/checkout`, session!.token, { method: "POST", body: JSON.stringify({ userId: assignmentUserId }) });
      setAssigningAsset(null); setAssignmentUserId(""); setRevision((value) => value + 1);
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : "Unable to assign asset"); }
  }

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFormError("");
    try {
      await api("/api/users", session!.token, { method: "POST", body: JSON.stringify(newUser) });
      setShowUserCreate(false); setNewUser({ firstName: "", lastName: "", email: "", password: "", role: "STAFF" }); setRevision((value) => value + 1);
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : "Unable to create user"); }
  }

  if (!ready) return <div className="min-h-screen bg-[#101515]" />;
  if (!session) return <main className="grid-noise flex min-h-screen items-center justify-center px-5 py-12">
    <form onSubmit={signIn} className="fade-in w-full max-w-[410px] border border-[#2a3532] bg-[#171e1d] p-8 shadow-2xl shadow-black/30">
      <div className="mb-10 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center bg-[#c6ef73] text-[#172017]"><Boxes size={21} /></div><div><div className="text-[15px] font-extrabold tracking-[0]">AssetPulse</div><div className="mono mt-1 text-[10px] uppercase tracking-[0] text-[#8d9a95]">Inventory operations</div></div></div>
      <p className="mono mb-3 text-[10px] uppercase tracking-[0] text-[#6ac9b3]">Secure workspace</p><h1 className="text-[25px] font-semibold">Sign in to AssetPulse</h1><p className="mt-2 text-sm text-[#8d9a95]">Use your organization account to continue.</p>
      <label className="mt-8 block text-xs font-semibold text-[#c5cec8]">Work email<input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-11 w-full border border-[#35413e] bg-[#101515] px-3 text-sm outline-none focus:border-[#c6ef73]" /></label>
      <label className="mt-5 block text-xs font-semibold text-[#c5cec8]">Password<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-11 w-full border border-[#35413e] bg-[#101515] px-3 text-sm outline-none focus:border-[#c6ef73]" /></label>
      {loginError && <p role="alert" className="mt-4 text-sm text-rose-300">{loginError}</p>}
      <button className="mt-7 flex h-11 w-full items-center justify-center gap-2 bg-[#c6ef73] text-sm font-bold text-[#172017] hover:bg-[#d5f693]">Continue <ArrowUpRight size={16} /></button>
    </form>
  </main>;

  const rows = tab === "assets" ? assets : inventory;
  const totalPages = Math.max(1, Math.ceil((rows?.total ?? 0) / 8));
  const userOptions = users.map((user) => ({ id: user.id, name: `${user.firstName} ${user.lastName} · ${user.email}` }));
  const filteredEmployees = users.filter((user) => `${user.firstName} ${user.lastName} ${user.email} ${user.role}`.toLowerCase().includes(employeeQuery.toLowerCase()));
  return <div className="min-h-screen bg-[#101515]">
    <header className="sticky top-0 z-10 flex h-[68px] items-center justify-between border-b border-[#28322f] bg-[#121918]/95 px-5 backdrop-blur md:px-9">
      <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center bg-[#c6ef73] text-[#172017]"><Boxes size={19} /></div><span className="text-sm font-extrabold">AssetPulse</span><span className="ml-2 hidden h-5 w-px bg-[#34403c] sm:block"/><span className="mono hidden text-[10px] uppercase text-[#85928d] sm:block">Operations console</span></div>
      <div className="flex items-center gap-4"><div className="hidden items-center gap-2 text-xs text-[#9aa7a1] sm:flex"><span className="h-2 w-2 rounded-full bg-[#6ac9b3]"/>All systems operational</div><button title="Sign out" onClick={signOut} className="grid h-9 w-9 place-items-center border border-[#34403c] text-[#9aa7a1] hover:text-white"><LogOut size={16}/></button></div>
    </header>
    <div className="mx-auto grid max-w-[1600px] md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden min-h-[calc(100vh-68px)] border-r border-[#28322f] p-5 md:block"><div className="mono mb-3 px-3 text-[9px] uppercase text-[#687771]">Workspace</div><nav aria-label="Primary navigation" className="space-y-1"><button onClick={() => setView("overview")} className={`flex w-full items-center gap-3 border-l-2 px-3 py-3 text-sm font-semibold ${view === "overview" ? "border-[#c6ef73] bg-[#1a2420] text-white" : "border-transparent text-[#899790] hover:bg-[#17201d]"}`}><LayoutDashboard size={16} className={view === "overview" ? "text-[#c6ef73]" : ""}/> Overview</button><button onClick={() => setView("employees")} className={`flex w-full items-center gap-3 border-l-2 px-3 py-3 text-sm font-semibold ${view === "employees" ? "border-[#c6ef73] bg-[#1a2420] text-white" : "border-transparent text-[#899790] hover:bg-[#17201d]"}`}><UsersRound size={16} className={view === "employees" ? "text-[#c6ef73]" : ""}/> Employees <span className="mono ml-auto text-[10px] text-[#718078]">{users.length}</span></button></nav><div className="mt-8 flex items-center justify-between px-3"><span className="mono text-[9px] uppercase text-[#687771]">Access level</span><ShieldCheck size={14} className="text-[#6ac9b3]"/></div><div className="mx-3 mt-2 text-xs text-[#c6ef73]">{session.user.role}</div><div className="mt-8 border-t border-[#28322f] pt-5"><div className="flex items-center gap-3 px-3"><div className="grid h-8 w-8 place-items-center border border-[#394742] text-[#9dad9f]"><UserRound size={15}/></div><div className="min-w-0"><div className="truncate text-xs font-semibold">{session.user.firstName} {session.user.lastName}</div><div className="mt-1 truncate text-[10px] text-[#788680]">{session.user.email}</div></div></div></div></aside>
      <main className={`min-w-0 px-5 py-7 md:px-9 md:py-9 ${view === "employees" ? "employee-mode" : ""}`}>
        <nav aria-label="Primary navigation" className="mb-6 flex border-b border-[#28322f] md:hidden"><button onClick={() => setView("overview")} className={`flex items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold ${view === "overview" ? "border-[#c6ef73] text-white" : "border-transparent text-[#829089]"}`}><LayoutDashboard size={15}/> Overview</button><button onClick={() => setView("employees")} className={`flex items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold ${view === "employees" ? "border-[#c6ef73] text-white" : "border-transparent text-[#829089]"}`}><UsersRound size={15}/> Employees <span className="mono text-[10px] text-[#718078]">{users.length}</span></button></nav>
        {view === "employees" && <div className="fade-in"><div className="flex flex-wrap items-end justify-between gap-4"><div><div className="mono mb-2 flex items-center gap-2 text-[10px] uppercase text-[#81a096]"><UsersRound size={13}/> People directory</div><h1 className="text-[26px] font-semibold">Employees</h1><p className="mt-1 text-xs text-[#829089]">{users.length} active {users.length === 1 ? "employee" : "employees"}</p></div>{session.user.role === "ADMIN" && <button onClick={() => { setFormError(""); setShowUserCreate(true); }} className="flex h-9 items-center gap-2 bg-[#c6ef73] px-3 text-xs font-bold text-[#172017]"><UserRound size={15}/> Add employee</button>}</div><div className="mt-6 flex max-w-[420px] items-center gap-2 border border-[#35413e] px-3"><Search size={14} className="text-[#829089]"/><input value={employeeQuery} onChange={(event) => setEmployeeQuery(event.target.value)} placeholder="Search employees" className="h-9 w-full bg-transparent text-xs outline-none placeholder:text-[#687771]"/></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] border-collapse text-left"><thead><tr className="mono border-y border-[#2a3532] text-[9px] uppercase text-[#77857e]"><th className="px-3 py-3 font-normal">Employee</th><th className="px-3 py-3 font-normal">Email</th><th className="px-3 py-3 font-normal">Role</th><th className="px-3 py-3 text-right font-normal">Status</th></tr></thead><tbody>{filteredEmployees.map((employee) => <tr key={employee.id} className="border-b border-[#232d2a] hover:bg-[#151d1b]"><td className="px-3 py-4 text-xs font-semibold">{employee.firstName} {employee.lastName}</td><td className="px-3 py-4 text-xs text-[#aeb9b1]">{employee.email}</td><td className="px-3 py-4"><span className="mono text-[10px] text-[#c6ef73]">{employee.role}</span></td><td className="px-3 py-4 text-right"><span className="inline-flex items-center gap-2 text-[10px] text-[#8be0a4]"><span className="h-1.5 w-1.5 rounded-full bg-[#6ac9b3]"/>Active</span></td></tr>)}{filteredEmployees.length === 0 && <tr><td colSpan={4} className="px-3 py-10 text-center text-xs text-[#829089]">{users.length ? "No employees match your search." : "No employees have been added yet."}</td></tr>}</tbody></table></div></div>}
        {assigningAsset && <div className="fixed inset-0 z-30 grid place-items-center bg-black/70 p-4"><form onSubmit={assignAsset} className="w-full max-w-[420px] border border-[#35413e] bg-[#171e1d] p-6"><div className="mono text-[10px] uppercase text-[#6ac9b3]">Asset assignment</div><h2 className="mt-2 text-lg font-semibold">Assign {assigningAsset.name}</h2><p className="mono mt-1 text-[10px] text-[#829089]">{assigningAsset.sku}</p><div className="mt-5"><SelectField label="Assign to user" value={assignmentUserId} options={userOptions} onChange={setAssignmentUserId}/></div>{formError && <p role="alert" className="mt-3 text-xs text-rose-300">{formError}</p>}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setAssigningAsset(null)} className="h-9 border border-[#35413e] px-3 text-xs text-[#aeb9b1]">Cancel</button><button className="h-9 bg-[#c6ef73] px-4 text-xs font-bold text-[#172017]">Assign asset</button></div></form></div>}
        <div className="overview-heading fade-in flex flex-wrap items-end justify-between gap-5"><div><div className="mono mb-2 flex items-center gap-2 text-[10px] uppercase text-[#81a096]"><Activity size={13}/> Inventory intelligence <span className="text-[#56635e]">/</span> Today</div><h1 className="text-[26px] font-semibold">Operations overview</h1><p className="mt-1 text-xs text-[#829089]">Current position across your tracked assets and stock.</p></div><div className="mono text-[10px] text-[#788680]">LIVE SNAPSHOT <span className="ml-1 text-[#6ac9b3]">●</span></div></div>
        <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Total valuation" value={dashboard ? currency.format(dashboard.totalValuation) : "—"} note="Recorded purchase + stock value" icon={<Wallet size={17}/>} tint="lime"/>
          <Kpi label="Active units" value={dashboard?.activeUnits.toLocaleString() ?? "—"} note={`${dashboard?.assignedUnits ?? 0} currently assigned`} icon={<HardDrive size={17}/>} tint="teal"/>
          <Kpi label="Low stock alerts" value={dashboard?.lowStockAlerts.toLocaleString() ?? "—"} note="Items at or below threshold" icon={<CircleAlert size={17}/>} tint="amber"/>
          <Kpi label="Tracked assets" value={dashboard?.trackedAssets.toLocaleString() ?? "—"} note="Serialized equipment records" icon={<Boxes size={17}/>} tint="blue"/>
        </section>
        <section className="mt-8 border-t border-[#2a3532] pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-base font-semibold">Inventory register</h2><p className="mt-1 text-xs text-[#829089]">Serialized assets and consumable stock.</p></div>{roleCanManage(session.user.role) && <button onClick={() => { setFormError(""); setShowCreate(true); }} className="flex h-9 items-center gap-2 bg-[#c6ef73] px-3 text-xs font-bold text-[#172017] hover:bg-[#d5f693]"><PackagePlus size={15}/> New {tab === "assets" ? "asset" : "stock item"}</button>}</div>
          {session.user.role === "ADMIN" && <div className="mt-4 flex justify-end"><button onClick={() => { setFormError(""); setShowUserCreate(true); }} className="h-8 border border-[#35413e] px-3 text-xs font-semibold text-[#c5cec8] hover:border-[#6ac9b3]">Add user</button></div>}
          <div className="mt-6 flex flex-col gap-3 border-b border-[#2a3532] pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-5"><button onClick={() => {setTab("assets");setPage(1);setSort("createdAt");setOrder("desc")}} className={`border-b-2 pb-3 text-xs font-semibold ${tab === "assets" ? "border-[#c6ef73] text-white" : "border-transparent text-[#829089]"}`}>Assets <span className="mono ml-1 text-[10px] text-[#718078]">{assets?.total ?? "—"}</span></button><button onClick={() => {setTab("inventory");setPage(1);setSort("createdAt");setOrder("desc")}} className={`border-b-2 pb-3 text-xs font-semibold ${tab === "inventory" ? "border-[#c6ef73] text-white" : "border-transparent text-[#829089]"}`}>Bulk inventory <span className="mono ml-1 text-[10px] text-[#718078]">{inventory?.total ?? "—"}</span></button></div>
            <div className="flex flex-wrap gap-2"><label className="flex h-9 min-w-[190px] flex-1 items-center gap-2 border border-[#35413e] px-3 lg:flex-none"><Search size={14} className="text-[#829089]"/><input value={query} onChange={(event) => changeFilters(() => setQuery(event.target.value))} placeholder="Search name or SKU" className="w-full bg-transparent text-xs outline-none placeholder:text-[#687771]"/></label><select aria-label="Filter by category" value={categoryId} onChange={(event) => changeFilters(() => setCategoryId(event.target.value))} className="h-9 border border-[#35413e] bg-[#171e1d] px-2 text-xs text-[#b3bdb7]"><option value="">All categories</option>{catalog.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Filter by location" value={locationId} onChange={(event) => changeFilters(() => setLocationId(event.target.value))} className="h-9 border border-[#35413e] bg-[#171e1d] px-2 text-xs text-[#b3bdb7]"><option value="">All locations</option>{catalog.locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Sort records" value={`${sort}:${order}`} onChange={(event) => { const [nextSort, nextOrder] = event.target.value.split(":"); setSort(nextSort!); setOrder(nextOrder!); setPage(1); }} className="h-9 border border-[#35413e] bg-[#171e1d] px-2 text-xs text-[#b3bdb7]"><option value="createdAt:desc">Newest first</option><option value="name:asc">Name A–Z</option><option value="name:desc">Name Z–A</option><option value="sku:asc">SKU A–Z</option>{tab === "assets" ? <option value="status:asc">Status</option> : <option value="quantity:asc">Quantity</option>}</select></div>
          </div>
          {error && <div role="alert" className="mt-4 border border-rose-900/70 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">{error}</div>}
          {tab === "assets" && !!assets?.items.some((item) => item.status === "AVAILABLE") && <div className="flex flex-wrap items-center gap-2 border-b border-[#232d2a] py-3"><span className="mono mr-2 text-[9px] uppercase text-[#77857e]">Available to assign</span>{assets.items.filter((item) => item.status === "AVAILABLE").map((item) => <button key={item.id} onClick={() => { setFormError(""); setAssignmentUserId(""); setAssigningAsset(item); }} className="border border-[#35413e] px-2 py-1 text-[10px] text-[#c5cec8] hover:border-[#6ac9b3]">{item.name} · Assign</button>)}</div>}
          <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left"><thead><tr className="mono border-b border-[#2a3532] text-[9px] uppercase text-[#77857e]"><th className="px-3 py-3 font-normal">Item</th><th className="px-3 py-3 font-normal">SKU / serial</th><th className="px-3 py-3 font-normal">Category</th><th className="px-3 py-3 font-normal">Location</th><th className="px-3 py-3 font-normal">{tab === "assets" ? "Status" : "On hand"}</th><th className="px-3 py-3 text-right font-normal">{tab === "assets" ? "Assigned to" : "Unit value"}</th></tr></thead><tbody>
            {loading && !rows?.items.length ? <tr><td colSpan={6} className="px-3 py-10 text-center text-xs text-[#829089]">Loading register…</td></tr> : tab === "assets" ? (assets?.items ?? []).map((item) => <tr key={item.id} className="border-b border-[#232d2a] hover:bg-[#151d1b]"><td className="px-3 py-4"><div className="text-xs font-semibold">{item.name}</div><div className="mono mt-1 text-[9px] text-[#718078]">{item.id.slice(0,8).toUpperCase()}</div></td><td className="mono px-3 py-4 text-[10px] text-[#aeb9b1]">{item.sku}<div className="mt-1 text-[9px] text-[#687771]">{item.serialNumber}</div></td><td className="px-3 py-4 text-xs text-[#aeb9b1]">{item.category.name}</td><td className="px-3 py-4 text-xs text-[#aeb9b1]"><span className="flex items-center gap-1.5"><MapPin size={12} className="text-[#74827b]"/>{item.location.name}</span></td><td className="px-3 py-4"><Status value={item.status}/></td><td className="px-3 py-4 text-right text-xs text-[#aeb9b1]">{item.assignments[0] ? `${item.assignments[0].user.firstName} ${item.assignments[0].user.lastName}` : "—"}</td></tr>) : (inventory?.items ?? []).map((item) => <tr key={item.id} className="border-b border-[#232d2a] hover:bg-[#151d1b]"><td className="px-3 py-4"><div className="text-xs font-semibold">{item.name}</div><div className="mono mt-1 text-[9px] text-[#718078]">{item.id.slice(0,8).toUpperCase()}</div></td><td className="mono px-3 py-4 text-[10px] text-[#aeb9b1]">{item.sku}</td><td className="px-3 py-4 text-xs text-[#aeb9b1]">{item.category.name}</td><td className="px-3 py-4 text-xs text-[#aeb9b1]"><span className="flex items-center gap-1.5"><MapPin size={12} className="text-[#74827b]"/>{item.location.name}</span></td><td className="px-3 py-4"><span className={`mono text-xs ${item.quantity <= item.minThreshold ? "text-amber-300" : "text-[#d5ded7]"}`}>{item.quantity}<span className="ml-2 text-[9px] text-[#76837c]">min {item.minThreshold}</span></span></td><td className="px-3 py-4 text-right text-xs text-[#aeb9b1]">{currency.format(Number(item.unitPrice))}</td></tr>)}
            {!loading && rows?.items.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-xs text-[#829089]">No matching records.</td></tr>}
          </tbody></table></div>
          {tab === "inventory" && roleCanManage(session.user.role) && !!inventory?.items.length && <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{inventory.items.map((item) => <div key={item.id} className="flex items-center justify-between border border-[#2a3532] px-3 py-2"><div className="min-w-0"><div className="truncate text-xs font-semibold">{item.name}</div><div className="mono mt-1 text-[9px] text-[#788680]">ON HAND {item.quantity}</div></div><div className="ml-3 flex gap-1"><button title={`Remove one ${item.name}`} onClick={() => void adjustStock(item.id, -1)} disabled={item.quantity === 0} className="grid h-7 w-7 place-items-center border border-[#35413e] text-[#aeb9b1] disabled:opacity-30">−</button><button title={`Add one ${item.name}`} onClick={() => void adjustStock(item.id, 1)} className="grid h-7 w-7 place-items-center border border-[#35413e] text-[#aeb9b1]">+</button></div></div>)}</div>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#2a3532] py-4"><span className="mono text-[10px] text-[#718078]">SHOWING {rows?.items.length ?? 0} OF {rows?.total ?? 0}</span><div className="flex items-center gap-3"><span className="mono text-[10px] text-[#829089]">PAGE {page} / {totalPages}</span><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="grid h-8 w-8 place-items-center border border-[#35413e] text-[#aeb9b1] disabled:opacity-30"><ChevronLeft size={15}/></button><button aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="grid h-8 w-8 place-items-center border border-[#35413e] text-[#aeb9b1] disabled:opacity-30"><ChevronRight size={15}/></button></div></div>
        </section>
        {showCreate && <div className="fixed inset-0 z-30 grid place-items-center overflow-y-auto bg-black/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreate(false); }}><form onSubmit={createRecord} className="my-auto w-full max-w-[500px] border border-[#35413e] bg-[#171e1d] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><div className="mono text-[10px] uppercase text-[#6ac9b3]">Register item</div><h2 className="mt-2 text-lg font-semibold">New {tab === "assets" ? "serialized asset" : "bulk stock item"}</h2></div><button type="button" title="Close" onClick={() => setShowCreate(false)} className="text-xl leading-none text-[#829089]">×</button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })}/><Field label="SKU" value={form.sku} onChange={(value) => setForm({ ...form, sku: value })}/>{tab === "assets" && <Field label="Serial number" value={form.serialNumber} onChange={(value) => setForm({ ...form, serialNumber: value })}/>}<SelectField label="Category" value={form.categoryId} options={catalog.categories} onChange={(value) => setForm({ ...form, categoryId: value })}/><SelectField label="Location" value={form.locationId} options={catalog.locations} onChange={(value) => setForm({ ...form, locationId: value })}/>{tab === "assets" ? <><Field label="Purchase price" type="number" min="0" step="0.01" required={false} value={form.purchasePrice} onChange={(value) => setForm({ ...form, purchasePrice: value })}/><SelectField label="Assign to user (optional)" value={form.assignedUserId} options={userOptions} onChange={(value) => setForm({ ...form, assignedUserId: value })} optional/></> : <><Field label="Quantity" type="number" min="0" value={form.quantity} onChange={(value) => setForm({ ...form, quantity: value })}/><Field label="Minimum threshold" type="number" min="0" value={form.minThreshold} onChange={(value) => setForm({ ...form, minThreshold: value })}/><Field label="Unit price" type="number" min="0" step="0.01" value={form.unitPrice} onChange={(value) => setForm({ ...form, unitPrice: value })}/></>}</div>{formError && <p role="alert" className="mt-4 text-xs text-rose-300">{formError}</p>}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} className="h-9 border border-[#35413e] px-3 text-xs text-[#aeb9b1]">Cancel</button><button className="h-9 bg-[#c6ef73] px-4 text-xs font-bold text-[#172017]">Create record</button></div></form></div>}
        {showUserCreate && <div className="fixed inset-0 z-30 grid place-items-center overflow-y-auto bg-black/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowUserCreate(false); }}><form onSubmit={createUser} className="my-auto w-full max-w-[460px] border border-[#35413e] bg-[#171e1d] p-6 shadow-2xl"><div className="mono text-[10px] uppercase text-[#6ac9b3]">Administration</div><h2 className="mt-2 text-lg font-semibold">Create user account</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="First name" value={newUser.firstName} onChange={(value) => setNewUser({ ...newUser, firstName: value })}/><Field label="Last name" value={newUser.lastName} onChange={(value) => setNewUser({ ...newUser, lastName: value })}/><Field label="Email" type="email" value={newUser.email} onChange={(value) => setNewUser({ ...newUser, email: value })}/><Field label="Temporary password (12+ characters)" type="password" minLength={12} maxLength={128} value={newUser.password} onChange={(value) => setNewUser({ ...newUser, password: value })}/><label className="block text-xs text-[#aeb9b1]">Role<select value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value })} className="mt-2 h-10 w-full border border-[#35413e] bg-[#101515] px-3 text-sm text-white"><option>STAFF</option><option>MANAGER</option><option>EXECUTIVE</option><option>ADMIN</option></select></label></div>{formError && <p role="alert" className="mt-4 text-xs text-rose-300">{formError}</p>}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setShowUserCreate(false)} className="h-9 border border-[#35413e] px-3 text-xs text-[#aeb9b1]">Cancel</button><button className="h-9 bg-[#c6ef73] px-4 text-xs font-bold text-[#172017]">Create user</button></div></form></div>}
        <footer className="mono mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#28322f] pt-4 text-[9px] uppercase text-[#56635e]"><span>AssetPulse · Enterprise inventory control</span><span className="flex items-center gap-2"><ShieldCheck size={12}/> Role-based access enabled <ChevronDown size={12}/></span></footer>
      </main>
    </div>
  </div>;
}

function Kpi({ label, value, note, icon, tint }: { label: string; value: string; note: string; icon: React.ReactNode; tint: "lime" | "teal" | "amber" | "blue" }) {
  const colors = { lime: "text-[#c6ef73]", teal: "text-[#6ac9b3]", amber: "text-amber-300", blue: "text-sky-300" };
  return <div className="border border-[#2a3532] bg-[#171e1d] p-4"><div className="flex items-center justify-between"><span className="text-xs text-[#9aa7a1]">{label}</span><span className={colors[tint]}>{icon}</span></div><div className="mt-5 text-[25px] font-semibold tracking-[0]">{value}</div><div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#788680]"><ArrowUpRight size={12} className="text-[#6ac9b3]"/>{note}</div></div>;
}

function Status({ value }: { value: string }) {
  const style = value === "AVAILABLE" ? "border-[#47705a] bg-[#173126] text-[#8be0a4]" : value === "ASSIGNED" ? "border-[#36586a] bg-[#172a35] text-[#91c9e6]" : value === "MAINTENANCE" ? "border-[#705a31] bg-[#312815] text-[#e5bf74]" : "border-[#53464a] bg-[#292225] text-[#b7a4aa]";
  return <span className={`inline-flex border px-2 py-1 text-[9px] font-semibold tracking-[0] ${style}`}><span className="mr-1.5">●</span>{value}</span>;
}

function Field({ label, value, onChange, type = "text", min, step, minLength, maxLength, required = true }: { label: string; value: string; onChange: (value: string) => void; type?: string; min?: string; step?: string; minLength?: number; maxLength?: number; required?: boolean }) {
  return <label className="block text-xs text-[#aeb9b1]">{label}<input required={required} type={type} min={min} step={step} minLength={minLength} maxLength={maxLength} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-10 w-full border border-[#35413e] bg-[#101515] px-3 text-sm text-white outline-none focus:border-[#c6ef73]"/></label>;
}

function SelectField({ label, value, options, onChange, optional = false }: { label: string; value: string; options: { id: string; name: string }[]; onChange: (value: string) => void; optional?: boolean }) {
  return <label className="block text-xs text-[#aeb9b1]">{label}<select required={!optional} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-10 w-full border border-[#35413e] bg-[#101515] px-3 text-sm text-white outline-none focus:border-[#c6ef73]"><option value="">{optional ? "Leave unassigned" : `Select ${label.toLowerCase()}`}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>;
}