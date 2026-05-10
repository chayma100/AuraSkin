import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import {
  Users, ScanLine, MessageCircle, TrendingUp, Shield,
  Trash2, Ban, Eye, Loader2, AlertCircle,
  RefreshCw, ChevronRight, Terminal, Database, Cpu,
  Radio, CheckCircle, XCircle,
  Search, ArrowUpRight, ArrowDownRight, Crown, LogOut
} from "lucide-react";
import useAuth from "@/auth/store";
import { useNavigate } from "react-router";

const ADMIN_EMAIL = "onlyhawa2023@gmail.com";
const API_BASE = "http://localhost:8083";

interface Stats {
  totalUsers: number;
  totalScans: number;
  totalDiscussions: number;
  avgToxicity: number;
}
interface VisitDay { day: string; visits: number; }
interface AdminUser {
  id: number;
  name: string;
  email: string;
  scans: number;
  status: "active" | "blocked";
  createdAt?: string;
  provider?: string;
}
interface Discussion {
  id: number;
  username: string;
  title: string;
  category: string;
  likes: number;
}
interface Product { name: string; scans: number; avg_score: number; }

function useAdminFetch<T>(endpoint: string, token: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [endpoint, token]);

  useEffect(() => { run(); }, [run]);
  return { data, loading, error, refetch: run };
}

type Tab = "overview" | "users" | "discussions" | "products";

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="relative flex h-2 w-2">
      {active && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${active ? "bg-cyan-400" : "bg-red-500"}`} />
    </span>
  );
}

function ToxicityBar({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score <= 3 ? "#22d3ee" : score <= 6 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ backgroundColor: color }}
          className="h-full rounded-full"
        />
      </div>
      <span className="text-xs font-mono w-8 text-right" style={{ color }}>{score}/10</span>
    </div>
  );
}

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();
}

export default function AdminDashboard() {
  // Reactive hook values (update on re-render)
  const userFromHook = useAuth((s) => s.user) as any;
  const token        = useAuth((s) => s.accessToken);
  const logout       = useAuth((s) => s.logout);
  const navigate     = useNavigate();

  const [tab,      setTab]      = useState<Tab>("overview");
  const [search,   setSearch]   = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [clock,    setClock]    = useState(new Date());

  // Always read BOTH from the reactive hook AND directly from the store.
  // Whichever has the email wins — this handles the rehydration race condition.
  const storeUser  = useAuth.getState().user as any;
  const user       = userFromHook ?? storeUser;
  const adminEmail = ADMIN_EMAIL.trim().toLowerCase();
  const userEmail  = (user?.email ?? "").trim().toLowerCase();
  const isAdmin    = userEmail === adminEmail;

  useEffect(() => {
    const timer = setTimeout(() => {
      // Re-read from store after persist has had time to rehydrate
      const latestUser = useAuth.getState().user as any;
      console.log("[AdminDashboard] hook user    :", userFromHook);
      console.log("[AdminDashboard] store user   :", latestUser);
      console.log("[AdminDashboard] resolved user:", user);
      console.log("[AdminDashboard] userEmail    :", userEmail);
      console.log("[AdminDashboard] isAdmin      :", isAdmin);
      setHydrated(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const stats     = useAdminFetch<Stats>("/api/admin/stats",             token);
  const visits    = useAdminFetch<VisitDay[]>("/api/admin/visits",       token);
  const usersHook = useAdminFetch<AdminUser[]>("/api/admin/users",       token);
  const postsHook = useAdminFetch<Discussion[]>("/api/admin/discussions",token);
  const productsH = useAdminFetch<Product[]>("/api/admin/top-products",  token);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [posts, setPosts] = useState<Discussion[]>([]);

  useEffect(() => { if (usersHook.data) setUsers(usersHook.data); }, [usersHook.data]);
  useEffect(() => { if (postsHook.data) setPosts(postsHook.data); }, [postsHook.data]);

  // Show spinner while waiting for store to rehydrate
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#080b0f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  // After hydration, check admin — show what was detected to help debugging
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#080b0f] flex items-center justify-center font-mono">
        <div className="text-center space-y-4 border border-red-500/30 p-10 rounded-xl bg-red-500/5">
          <Shield className="w-12 h-12 text-red-500 mx-auto" />
          <p className="text-red-400 text-xl font-bold tracking-widest">ACCESS DENIED</p>
          <p className="text-gray-500 text-sm">Unauthorized access attempt logged.</p>
          {/* Debug info — remove after fixing */}
          <div className="text-left text-xs font-mono bg-black/40 p-4 rounded-lg space-y-1">
            <p className="text-gray-500">detected email: <span className="text-yellow-400">{userEmail || "(empty)"}</span></p>
            <p className="text-gray-500">expected email: <span className="text-cyan-400">{adminEmail}</span></p>
            <p className="text-gray-500">hook user: <span className="text-gray-400">{JSON.stringify(userFromHook)}</span></p>
            <p className="text-gray-500">store user: <span className="text-gray-400">{JSON.stringify(storeUser)}</span></p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="mt-4 px-6 py-2 border border-red-500/40 text-red-400 text-sm rounded hover:bg-red-500/10 transition"
          >
            ← RETURN
          </button>
        </div>
      </div>
    );
  }

  const toggleBlock = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${id}/block`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const updated: AdminUser = await res.json();
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: updated.status } : u));
    } catch { alert("Could not update user status."); }
  };

  const deletePost = async (id: number) => {
    if (!confirm("Delete this discussion?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/discussions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch { alert("Could not delete discussion."); }
  };

  const statData  = stats.data;
  const visitData = visits.data ?? [];
  const products  = productsH.data ?? [];
  const maxVisits = Math.max(...visitData.map((d) => d.visits), 1);

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const TABS: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "overview",    label: "OVERVIEW",    icon: <Cpu className="w-3.5 h-3.5" /> },
    { key: "users",       label: "USERS",       icon: <Users className="w-3.5 h-3.5" />,         count: users.length   },
    { key: "discussions", label: "DISCUSSIONS", icon: <MessageCircle className="w-3.5 h-3.5" />,  count: posts.length   },
    { key: "products",    label: "PRODUCTS",    icon: <Database className="w-3.5 h-3.5" />,       count: products.length},
  ];

  return (
    <div className="min-h-screen bg-[#080b0f] text-gray-100 font-mono">
      {/* Scanline overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)" }}
      />

      {/* ── TOP BAR ── */}
      <div className="sticky top-0 z-40 border-b border-cyan-500/10 bg-[#080b0f]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span className="text-cyan-400 text-sm tracking-widest font-bold">
              COSMO<span className="text-white">ADMIN</span>
            </span>
            <span className="text-gray-700 text-xs ml-2">v2.0.1</span>
          </div>

          <div className="flex items-center gap-6 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <StatusDot active={true} />
              <span>SYSTEM ONLINE</span>
            </div>
            <span className="text-gray-700">|</span>
            <span className="text-cyan-400/70 tabular-nums">
              {clock.toLocaleTimeString("en-GB")}
            </span>
            <span className="text-gray-700">|</span>
            <div className="flex items-center gap-2">
              <Crown className="w-3 h-3 text-amber-400" />
              <span className="text-amber-400">{user?.name || user?.email}</span>
            </div>
            <button
              onClick={() => { logout(); navigate("/login"); }}
              className="flex items-center gap-1 text-gray-500 hover:text-red-400 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>LOGOUT</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── STAT CARDS ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {[
            { label: "TOTAL USERS",  value: statData?.totalUsers,       icon: <Users className="w-5 h-5" />,        color: "cyan",    trend: "+12%", up: true  },
            { label: "TOTAL SCANS",  value: statData?.totalScans,       icon: <ScanLine className="w-5 h-5" />,     color: "violet",  trend: "+8%",  up: true  },
            { label: "DISCUSSIONS",  value: statData?.totalDiscussions, icon: <MessageCircle className="w-5 h-5" />,color: "emerald", trend: "+3%",  up: true  },
            { label: "AVG TOXICITY", value: statData ? `${statData.avgToxicity}/10` : undefined, icon: <TrendingUp className="w-5 h-5" />, color: "red", trend: "-2%", up: false },
          ].map((s, i) => {
            const borderText: Record<string, string> = {
              cyan:    "border-cyan-500/20 text-cyan-400",
              violet:  "border-violet-500/20 text-violet-400",
              emerald: "border-emerald-500/20 text-emerald-400",
              red:     "border-red-500/20 text-red-400",
            };
            const bg: Record<string, string> = {
              cyan: "bg-cyan-500/5", violet: "bg-violet-500/5",
              emerald: "bg-emerald-500/5", red: "bg-red-500/5",
            };
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className={`border ${borderText[s.color]} ${bg[s.color]} rounded-xl p-5 relative overflow-hidden hover:border-opacity-60 transition`}
              >
                <div className={`absolute top-0 right-0 w-8 h-8 border-b border-l ${borderText[s.color]} opacity-30 rounded-bl-xl`} />
                <div className={`${borderText[s.color]} mb-3 opacity-80`}>{s.icon}</div>
                {stats.loading
                  ? <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
                  : <p className="text-2xl font-bold text-white tabular-nums">
                      {s.value !== undefined ? (typeof s.value === "number" ? s.value.toLocaleString() : s.value) : "—"}
                    </p>
                }
                <div className="flex items-center justify-between mt-2">
                  <p className={`text-xs tracking-widest ${borderText[s.color]} opacity-60`}>{s.label}</p>
                  <span className={`text-xs flex items-center gap-0.5 ${s.up ? "text-emerald-400" : "text-red-400"}`}>
                    {s.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {s.trend}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* ── TABS ── */}
        <div className="flex gap-0 border border-white/5 rounded-xl overflow-hidden w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-2.5 text-xs tracking-widest transition border-r border-white/5 last:border-r-0 ${
                tab === t.key
                  ? "bg-cyan-500/10 text-cyan-400 border-b-2 border-b-cyan-400"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
              }`}
            >
              {t.icon}
              {t.label}
              {t.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  tab === t.key ? "bg-cyan-500/20 text-cyan-300" : "bg-white/5 text-gray-600"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── OVERVIEW ── */}
          {tab === "overview" && (
            <motion.div key="overview"
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              <div className="lg:col-span-2 border border-white/5 rounded-xl p-6 bg-white/[0.02]">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                    <span className="text-xs tracking-widest text-gray-400">WEEKLY TRAFFIC</span>
                  </div>
                  <span className="text-xs text-gray-600">last 7 days</span>
                </div>
                {visits.loading ? (
                  <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
                ) : visitData.length === 0 ? (
                  <p className="text-center text-gray-600 py-10 text-xs tracking-widest">NO DATA</p>
                ) : (
                  <div className="flex items-end gap-2 h-36">
                    {visitData.map((d, i) => (
                      <div key={i} className="flex flex-col items-center gap-2 flex-1 group">
                        <span className="text-[10px] text-gray-600 group-hover:text-cyan-400 transition tabular-nums">{d.visits}</span>
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${(d.visits / maxVisits) * 110}px` }}
                          transition={{ delay: i * 0.06, duration: 0.6, ease: "easeOut" }}
                          className="w-full rounded-t bg-cyan-500/20 border-t-2 border-cyan-500/60 group-hover:bg-cyan-500/30 transition min-h-[3px]"
                        />
                        <span className="text-[10px] text-gray-600">{d.day}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="border border-white/5 rounded-xl p-5 bg-white/[0.02]">
                  <p className="text-[10px] tracking-widest text-gray-500 mb-3">SYSTEM STATUS</p>
                  {[
                    { label: "API Server",   ok: true  },
                    { label: "Database",     ok: true  },
                    { label: "Auth Service", ok: true  },
                    { label: "ML Pipeline",  ok: false },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <span className="text-xs text-gray-400">{s.label}</span>
                      <div className="flex items-center gap-1.5">
                        {s.ok
                          ? <><CheckCircle className="w-3 h-3 text-emerald-400" /><span className="text-[10px] text-emerald-400">ONLINE</span></>
                          : <><XCircle    className="w-3 h-3 text-red-400"     /><span className="text-[10px] text-red-400">OFFLINE</span></>
                        }
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border border-white/5 rounded-xl p-5 bg-white/[0.02]">
                  <p className="text-[10px] tracking-widest text-gray-500 mb-3">USER BREAKDOWN</p>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Active</span>
                        <span className="text-cyan-400">{users.filter(u => u.status === "active").length}</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full">
                        <div
                          className="h-full bg-cyan-500/60 rounded-full transition-all duration-700"
                          style={{ width: `${users.length ? (users.filter(u => u.status === "active").length / users.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Blocked</span>
                        <span className="text-red-400">{users.filter(u => u.status === "blocked").length}</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full">
                        <div
                          className="h-full bg-red-500/60 rounded-full transition-all duration-700"
                          style={{ width: `${users.length ? (users.filter(u => u.status === "blocked").length / users.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── USERS ── */}
          {tab === "users" && (
            <motion.div key="users"
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="SEARCH USERS..."
                    className="w-full bg-white/3 border border-white/8 rounded-lg pl-9 pr-4 py-2 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 tracking-wider bg-transparent border-white/10"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span>{filteredUsers.length} RECORDS</span>
                  <button onClick={usersHook.refetch} className="hover:text-cyan-400 transition">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-12 text-[10px] tracking-widest text-gray-600 px-4 pb-2 border-b border-white/5">
                <span className="col-span-1">#</span>
                <span className="col-span-3">NAME</span>
                <span className="col-span-4">EMAIL</span>
                <span className="col-span-1 text-center">SCANS</span>
                <span className="col-span-2 text-center">STATUS</span>
                <span className="col-span-1 text-center">ACT</span>
              </div>

              {usersHook.loading && (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
              )}
              {usersHook.error && (
                <div className="flex items-center gap-3 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs bg-red-500/5">
                  <AlertCircle className="w-4 h-4" /><span>{usersHook.error}</span>
                  <button onClick={usersHook.refetch} className="ml-auto"><RefreshCw className="w-3.5 h-3.5" /></button>
                </div>
              )}

              <div className="space-y-1">
                {filteredUsers.map((u, i) => (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="grid grid-cols-12 items-center px-4 py-3 rounded-lg border border-transparent hover:border-white/8 hover:bg-white/[0.02] group transition"
                  >
                    <span className="col-span-1 text-[10px] text-gray-700 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    <div className="col-span-3 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center text-xs font-bold text-cyan-300 shrink-0">
                        {(u.name || u.email)[0].toUpperCase()}
                      </div>
                      <span className="text-sm text-gray-200 truncate">{u.name || "—"}</span>
                    </div>
                    <span className="col-span-4 text-xs text-gray-500 truncate pr-2">{u.email}</span>
                    <span className="col-span-1 text-center text-xs font-bold text-cyan-400 tabular-nums">{u.scans}</span>
                    <div className="col-span-2 flex justify-center">
                      <span className={`text-[10px] tracking-widest px-2 py-0.5 rounded border font-bold ${
                        u.status === "active"
                          ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
                          : "border-red-500/30 text-red-400 bg-red-500/5"
                      }`}>
                        {u.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="col-span-1 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => toggleBlock(u.id)}
                        title={u.status === "blocked" ? "Unblock" : "Block"}
                        className={`p-1.5 rounded transition ${
                          u.status === "blocked"
                            ? "text-emerald-400 hover:bg-emerald-500/10"
                            : "text-amber-400 hover:bg-amber-500/10"
                        }`}
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 rounded text-cyan-400 hover:bg-cyan-500/10 transition">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
                {!usersHook.loading && filteredUsers.length === 0 && !usersHook.error && (
                  <p className="text-center text-gray-600 py-10 text-xs tracking-widest">NO RECORDS FOUND</p>
                )}
              </div>
            </motion.div>
          )}

          {/* ── DISCUSSIONS ── */}
          {tab === "discussions" && (
            <motion.div key="discussions"
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs tracking-widest text-gray-500">{posts.length} DISCUSSIONS</span>
                <button onClick={postsHook.refetch} className="text-gray-600 hover:text-cyan-400 transition">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-12 text-[10px] tracking-widest text-gray-600 px-4 pb-2 border-b border-white/5">
                <span className="col-span-4">TITLE</span>
                <span className="col-span-3">AUTHOR</span>
                <span className="col-span-2">CATEGORY</span>
                <span className="col-span-2 text-center">LIKES</span>
                <span className="col-span-1 text-center">DEL</span>
              </div>

              {postsHook.loading && (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
              )}

              <div className="space-y-1">
                {posts.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="grid grid-cols-12 items-center px-4 py-3 rounded-lg border border-transparent hover:border-white/8 hover:bg-white/[0.02] group transition"
                  >
                    <div className="col-span-4 flex items-center gap-2">
                      <ChevronRight className="w-3 h-3 text-gray-700 shrink-0" />
                      <span className="text-sm text-gray-200 truncate">{p.title}</span>
                    </div>
                    <div className="col-span-3 flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-violet-500/20 border border-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-300 shrink-0">
                        {p.username[0].toUpperCase()}
                      </div>
                      <span className="text-xs text-gray-500 truncate">{p.username}</span>
                    </div>
                    <span className="col-span-2">
                      <span className="text-[10px] px-2 py-0.5 rounded border border-violet-500/20 text-violet-400 bg-violet-500/5 tracking-wider">
                        {p.category}
                      </span>
                    </span>
                    <span className="col-span-2 text-center text-xs font-bold text-pink-400 tabular-nums">{p.likes}</span>
                    <div className="col-span-1 flex justify-center opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => deletePost(p.id)}
                        className="p-1.5 rounded text-red-400 hover:bg-red-500/10 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
                {!postsHook.loading && posts.length === 0 && !postsHook.error && (
                  <p className="text-center text-gray-600 py-10 text-xs tracking-widest">NO DISCUSSIONS FOUND</p>
                )}
              </div>
            </motion.div>
          )}

          {/* ── PRODUCTS ── */}
          {tab === "products" && (
            <motion.div key="products"
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs tracking-widest text-gray-500">TOP SCANNED PRODUCTS</span>
                <button onClick={productsH.refetch} className="text-gray-600 hover:text-cyan-400 transition">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {productsH.loading && (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {products.map((p, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="border border-white/5 rounded-xl p-5 bg-white/[0.02] hover:border-cyan-500/20 transition"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black border ${
                          i === 0 ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                          : i === 1 ? "border-gray-400/30 bg-gray-400/10 text-gray-300"
                          : i === 2 ? "border-orange-700/40 bg-orange-700/10 text-orange-400"
                          : "border-white/10 bg-white/5 text-gray-500"
                        }`}>
                          #{i + 1}
                        </div>
                        <p className="text-sm text-gray-200 font-medium truncate max-w-[160px]">{p.name}</p>
                      </div>
                      <span className="text-xs text-cyan-400 font-bold tabular-nums">{p.scans} scans</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-gray-600 mb-1">
                        <span>TOXICITY SCORE</span>
                      </div>
                      <ToxicityBar score={Number(p.avg_score)} />
                    </div>
                    <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(Number(p.scans) / Math.max(...products.map(x => Number(x.scans)), 1)) * 100}%` }}
                        transition={{ delay: i * 0.08, duration: 0.7 }}
                        className="h-full bg-cyan-500/40 rounded-full"
                      />
                    </div>
                  </motion.div>
                ))}
                {!productsH.loading && products.length === 0 && !productsH.error && (
                  <p className="text-center text-gray-600 py-10 text-xs tracking-widest col-span-2">NO PRODUCTS SCANNED YET</p>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
