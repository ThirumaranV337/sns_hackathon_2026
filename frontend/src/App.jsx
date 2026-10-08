import React, { useState, useEffect, createContext, useContext } from "react";
import {
  Routes,
  Route,
  NavLink,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import {
  GraduationCap,
  LayoutDashboard,
  ClipboardCheck,
  ShieldCheck,
  CalendarDays,
  ShoppingBag,
  FolderKanban,
  Monitor,
  Users,
  Sparkles,
  Bell,
  Settings,
  LogOut,
  Search,
  Menu,
  ArrowUpRight,
  Plus,
  ChevronDown,
  BookOpen,
  Download,
  Activity,
  Clock,
  CheckCircle2,
  ArrowRight,
  X,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { seed, students, faculty, events } from "./data/seed";
import { uid } from "./logic";
import {
  Heading,
  Panel,
  Metric,
  Badge,
  Avatar,
  Progress,
  Empty,
} from "./components/ui";
import Requests from "./pages/Requests";
import Complaints from "./pages/Complaints";
import Seating from "./pages/Seating";
import Marketplace from "./pages/Marketplace";
import Projects from "./pages/Projects";
import Labs from "./pages/Labs";
import Development from "./pages/Development";
import General from "./pages/General";
const Context = createContext();
export const useCampus = () => useContext(Context);
const nav = [
  ["/", "Overview", LayoutDashboard, "all"],
  ["/requests", "OD & leave", ClipboardCheck, "all"],
  ["/complaints", "Complaints", ShieldCheck, "all"],
  ["/seating", "Exam seating", CalendarDays, "Admin"],
  ["/students", "Students", Users, "Faculty Admin"],
  ["/marketplace", "CampusRent", ShoppingBag, "Student Admin"],
  ["/rentals", "My rentals", BookOpen, "Student"],
  ["/projects", "ProjectHub", FolderKanban, "all"],
  ["/mentors", "Find a mentor", GraduationCap, "Student"],
  ["/labs", "Lab & workstations", Monitor, "Student Admin"],
  ["/issues", "Hardware issues", Activity, "Student Admin"],
  ["/copilot", "AI Study Assistant", Sparkles, "all"],
  ["/events", "Campus events", CalendarDays, "Student"],
  ["/attendance", "My attendance", Activity, "Student"],
  ["/faculty", "Faculty directory", Users, "Admin"],
  ["/sla", "SLA & escalation", Clock, "Admin"],
  ["/erp", "ERP & exports", Download, "Admin"],
  ["/analytics", "Analytics & reports", Activity, "Admin"],
];
export default function App() {
  const [db, setDb] = useState(() => {
    try {
      const d = JSON.parse(localStorage.getItem("campusflow_v1"));
      if (d?.version === 1) {
        if (!d.complaintOwners) {
          d.complaintOwners = { "CMP-AN-48291": "S1", "CMP-AN-31048": "S1" };
        }
        return d;
      }
      return seed();
    } catch {
      return seed();
    }
  });
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("campusflow_session"));
    } catch {
      return null;
    }
  });
  const [toast, setToast] = useState("");
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const role = session?.role || "Student";
  const user =
    role === "Student"
      ? students.find((s) => s.id === session?.id) || students[0]
      : role === "Faculty"
        ? faculty.find((f) => f.id === session?.id) || faculty[0]
        : { id: "A1", name: "Dr. Suresh Kumar", dept: "Administration" };
  useEffect(() => {
    try {
      localStorage.setItem("campusflow_v1", JSON.stringify(db));
    } catch {
      setToast("Storage is full. Changes will last for this session only.");
    }
  }, [db]);
  useEffect(() => {
    localStorage.setItem("campusflow_session", JSON.stringify(session));
  }, [session]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    setMenu(false);
    setSearch("");
    window.scrollTo(0, 0);
  }, [location]);
  const notify = (
    title,
    detail = "",
    targetRole = role,
    path = "/notifications",
  ) =>
    setDb((d) => ({
      ...d,
      notifications: [
        {
          id: uid("N"),
          role: targetRole,
          title,
          detail,
          path,
          read: false,
          at: Date.now(),
        },
        ...d.notifications,
      ],
      activity: [{ title, detail, at: Date.now() }, ...d.activity].slice(0, 30),
    }));
  const switchRole = (r, id) => {
    setSession({ role: r, id: id || "S1" });
    navigate("/");
  };
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool || !session) return;
    const controller = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: "read_campus_summary",
            description:
              "Read the current demo role and counts visible on the campus dashboard.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: false },
            execute: (input) => {
              if (
                !input ||
                typeof input !== "object" ||
                Object.keys(input).length
              )
                throw Error("Expected an empty object.");
              return {
                role,
                requests: db.requests.length,
                projects: db.projects.length,
                complaints: db.complaints.length,
              };
            },
          },
          { signal: controller.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => controller.abort();
  }, [db, role, session]);
  const value = {
    db,
    setDb,
    role,
    user,
    toast: setToast,
    notify,
    navigate,
    switchRole,
  };
  const unread = db.notifications.filter(
    (n) => n.role === role && !n.read,
  ).length;
  const results = search.trim()
    ? [
        ...(role !== "Student"
          ? students.map((s) => ({
              title: s.name,
              sub: s.roll,
              kind: "Student",
              path: "/students/" + s.id,
            }))
          : []),
        ...db.requests
          .filter((r) => role !== "Student" || r.student === user.id)
          .map((r) => ({
            title: r.id,
            sub: r.title,
            kind: "Request",
            path: "/requests",
          })),
        ...db.complaints
          .filter(
            (c) => role !== "Student" || db.complaintOwners?.[c.id] === user.id,
          )
          .map((c) => ({
            title: c.id,
            sub: c.title,
            kind: "Complaint",
            path: "/complaints",
          })),
        ...db.projects.map((p) => ({
          title: p.name,
          kind: "Project",
          path: "/projects",
        })),
        ...db.products.map((p) => ({
          title: p.name,
          kind: "Product",
          path: "/marketplace",
        })),
        ...faculty.map((f) => ({
          title: f.name,
          kind: "Faculty",
          path: role === "Admin" ? "/faculty" : "/mentors",
        })),
        ...db.exams.map((e) => ({
          title: e.name,
          kind: "Exam",
          path: "/seating",
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          title: "Lab " + (i + 1),
          kind: "Room",
          path: "/labs",
        })),
      ]
        .filter((r) =>
          (r.title + " " + r.sub).toLowerCase().includes(search.toLowerCase()),
        )
        .slice(0, 9)
    : [];
  if (!session)
    return (
      <Context.Provider value={value}>
        <div className="login">
          <div className="login-story">
            <div className="brand">
              <span>
                <GraduationCap />
              </span>
              CampusFlow
            </div>
            <span className="eyebrow">LESS FRICTION. MORE POSSIBILITY.</span>
            <h1>
              A connected campus.
              <br />A better everyday.
            </h1>
            <p>
              One place for your ideas, opportunities, and everything in
              between.
            </p>
            <div className="login-art">
              <GraduationCap size={120} />
              <div>
                11 connected modules <span>One campus experience</span>
              </div>
            </div>
            <small>CampusFlow · Smart College Operations Platform</small>
          </div>
          <div className="login-card">
            <Badge>INTERACTIVE FRONTEND DEMO</Badge>
            <h1>Welcome to your campus</h1>
            <p>
              Choose a role to explore your workspace. You can switch roles
              anytime to try a complete workflow.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                switchRole(f.get("role"), f.get("id"));
              }}
            >
              <label className="field">
                <span>Your role</span>
                <select name="role">
                  <option>Student</option>
                  <option>Faculty</option>
                  <option>Admin</option>
                </select>
              </label>
              <label className="field">
                <span>Student demo account</span>
                <select name="id">
                  {students.slice(0, 4).map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.name} · {s.dept}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary">
                Enter workspace <ArrowRight size={18} />
              </button>
            </form>
            <p className="demo-note">
              No password needed. All records are sample data, saved only in
              this browser.
            </p>
          </div>
        </div>
      </Context.Provider>
    );
  return (
    <Context.Provider value={value}>
      <div className="app">
        <aside className={"sidebar " + (menu ? "open" : "")}>
          <div className="brand">
            <span>
              <GraduationCap size={25} />
            </span>
            CampusFlow
          </div>
          <div className="workspace">
            <span className="college-icon">C</span>
            <div>
              <b>Crescent Institute</b>
              <small>Smart campus workspace</small>
            </div>
            <ChevronDown size={15} />
          </div>
          <small className="nav-label">WORKSPACE</small>
          <nav>
            {nav
              .filter((n) => n[3] === "all" || n[3].includes(role))
              .map(([path, label, Icon]) => (
                <NavLink key={path} to={path} end={path === "/"}>
                  <Icon size={18} />
                  {label}
                  {path === "/requests" &&
                    db.requests.filter(
                      (r) =>
                        r.status ===
                        (role === "Admin" ? "HOD Review" : "Advisor Review"),
                    ).length > 0 && (
                      <span className="nav-count">
                        {
                          db.requests.filter(
                            (r) =>
                              r.status ===
                              (role === "Admin"
                                ? "HOD Review"
                                : "Advisor Review"),
                          ).length
                        }
                      </span>
                    )}
                </NavLink>
              ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="demo-card">
              <Sparkles size={17} />
              <b>A little smarter, every day.</b>
              <p>Your campus, working together.</p>
            </div>
            <NavLink to="/settings">
              <Settings size={18} />
              Settings & profile
            </NavLink>
            <button onClick={() => setSession(null)}>
              <LogOut size={18} />
              Sign out
            </button>
            <div className="user">
              <Avatar name={user.name} />
              <div>
                <b>{user.name}</b>
                <small>
                  {role} · {user.dept}
                </small>
              </div>
            </div>
          </div>
        </aside>
        {menu && (
          <button
            className="overlay"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          />
        )}
        <div className="main">
          <header className="topbar">
            <button
              className="icon-button mobile-toggle"
              aria-label="Open navigation"
              onClick={() => setMenu(!menu)}
            >
              <Menu />
            </button>
            <div className="global-search">
              <Search size={18} />
              <input
                aria-label="Search campus"
                placeholder="Search anything in your campus..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>⌕</kbd>
              {search && (
                <div className="search-results">
                  {results.length ? (
                    results.map((r, i) => (
                      <button key={i} onClick={() => navigate(r.path)}>
                        <span>
                          <b>{r.title}</b>
                          <small>{r.sub}</small>
                        </span>
                        <Badge>{r.kind}</Badge>
                      </button>
                    ))
                  ) : (
                    <p>No matching campus records.</p>
                  )}
                </div>
              )}
            </div>
            <div className="top-right">
              <span className="live">
                <i />
                Demo workspace
              </span>
              <select
                className="role-select"
                aria-label="Switch demo role"
                value={role}
                onChange={(e) => switchRole(e.target.value)}
              >
                <option>Student</option>
                <option>Faculty</option>
                <option>Admin</option>
              </select>
              {role === "Student" && (
                <select
                  className="account-select"
                  aria-label="Switch student account"
                  value={user.id}
                  onChange={(e) => switchRole("Student", e.target.value)}
                >
                  {students.slice(0, 4).map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                className="notification-button icon-button"
                aria-label="Notifications"
                onClick={() => navigate("/notifications")}
              >
                <Bell size={20} />
                {unread > 0 && <span>{unread}</span>}
              </button>
              <Avatar name={user.name} small />
            </div>
          </header>
          <main className="content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="*" element={<FeatureRoutes />} />
            </Routes>
          </main>
          <footer>
            CampusFlow <span>Connected people. Better possibilities.</span>
            <span>Frontend demo · {new Date().getFullYear()}</span>
          </footer>
        </div>
        {toast && (
          <div className="toast" role="status">
            <CheckCircle2 size={20} />
            {toast}
            <button
              className="icon-button"
              onClick={() => setToast("")}
              aria-label="Dismiss notification"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </Context.Provider>
  );
}
function Dashboard() {
  const { db, role, user, navigate } = useCampus();
  const own = db.requests.filter(
    (r) => role !== "Student" || r.student === user.id,
  );
  const cards =
    role === "Admin"
      ? [
          ["Total students", students.length, Users, "Across 3 departments"],
          [
            "Pending approvals",
            db.requests.filter((r) => r.status === "HOD Review").length,
            ClipboardCheck,
            "Ready for your decision",
          ],
          [
            "Open complaints",
            db.complaints.filter(
              (c) => !["Resolved", "Closed"].includes(c.status),
            ).length,
            ShieldCheck,
            "Tracked to resolution",
          ],
          [
            "Active projects",
            db.projects.filter((p) => p.status !== "Completed").length,
            FolderKanban,
            "Ideas becoming impact",
          ],
        ]
      : role === "Faculty"
        ? [
            [
              "Pending approvals",
              db.requests.filter((r) => r.status === "Advisor Review").length,
              ClipboardCheck,
              "Waiting for your review",
            ],
            [
              "Assigned students",
              students.length,
              Users,
              "3 departments connected",
            ],
            [
              "Active projects",
              db.projects.filter((p) => p.mentor === user.id).length,
              FolderKanban,
              "Your guidance matters",
            ],
            [
              "Avg. attendance",
              Math.round(
                students.reduce((a, s) => a + s.attendance, 0) /
                  students.length,
              ) + "%",
              Activity,
              "Across assigned students",
            ],
          ]
        : [
            [
              "Pending requests",
              own.filter((r) => /Review/.test(r.status)).length,
              ClipboardCheck,
              "Your approvals in progress",
            ],
            [
              "Active projects",
              db.projects.filter((p) => p.team.includes(user.id)).length,
              FolderKanban,
              "Keep your ideas moving",
            ],
            [
              "Upcoming events",
              events.length,
              CalendarDays,
              "Something to look forward to",
            ],
            [
              "Lab bookings",
              db.bookings.filter(
                (b) => b.student === user.id && b.status === "Reserved",
              ).length,
              Monitor,
              "Your next space to create",
            ],
          ];
  return (
    <>
      <Heading
        eyebrow="YOUR CAMPUS, AT A GLANCE"
        title={
          "Good morning, " + user.name.replace("Dr. ", "").split(" ")[0] + " ☀"
        }
        description="Here’s what’s happening across your campus today."
      >
        <span className="date-chip">
          <CalendarDays size={16} />
          {new Date().toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
        <button
          className="primary"
          onClick={() =>
            navigate(role === "Student" ? "/requests" : "/reports")
          }
        >
          <Plus size={17} />
          {role === "Student" ? "New request" : "View reports"}
        </button>
      </Heading>
      <section className="welcome-banner">
        <div>
          <span className="banner-label">
            <i /> YOUR NEXT CHAPTER STARTS HERE
          </span>
          <h2>
            Big ideas. Small steps.
            <br />
            Everything in one place.
          </h2>
          <p>Make room for what matters. We’ll help with the rest.</p>
          <button onClick={() => navigate("/projects")}>
            Explore your projects <ArrowUpRight size={17} />
          </button>
        </div>
        <div className="campus-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="art-tile art-book">
            <BookOpen size={38} />
          </div>
          <div className="art-tile art-cap">
            <GraduationCap size={70} />
          </div>
          <div className="art-tile art-spark">
            <Sparkles size={32} />
          </div>
          <span className="art-dot d1" />
          <span className="art-dot d2" />
          <span className="art-plus">+</span>
        </div>
      </section>
      <div className="metrics">
        {cards.map(([label, value, icon, detail], i) => (
          <Metric
            key={label}
            {...{ label, value, icon, detail }}
            color={["blue", "purple", "orange", "green"][i]}
          />
        ))}
      </div>
      <div className="dashboard-grid">
        <Panel
          title={
            role === "Admin"
              ? "College operations health"
              : "Your activity overview"
          }
          subtitle="A little progress, every day"
          action={<Badge>This semester</Badge>}
        >
          <div className="chart-legend">
            <span>
              <i />
              Attendance
            </span>
            <span>
              <i />
              Academic progress
            </span>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(
                  (month, i) => ({
                    month,
                    attendance: [78, 84, 81, 92, 88, 94][i],
                    progress: [65, 72, 70, 80, 79, 88][i],
                  }),
                )}
              >
                <defs>
                  <linearGradient id="chartFade" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5274f5" stopOpacity={0.16} />
                    <stop offset="100%" stopColor="#5274f5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#edf0f5" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8991a3", fontSize: 12 }}
                />
                <YAxis
                  domain={[40, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8991a3", fontSize: 11 }}
                  width={30}
                />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="attendance"
                  stroke="#4c70ed"
                  strokeWidth={3}
                  fill="url(#chartFade)"
                />
                <Area
                  type="monotone"
                  dataKey="progress"
                  stroke="#ae93ed"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <small className="chart-note">
            Illustrative semester trends · live workflow counts above
          </small>
        </Panel>
        <Panel title="Quick actions" subtitle="Less searching. More doing.">
          <div className="quick-grid">
            {(role === "Student"
              ? [
                  ["Apply OD / leave", ClipboardCheck, "/requests", "blue"],
                  ["Book a workstation", Monitor, "/labs", "green"],
                  ["Rent an item", ShoppingBag, "/marketplace", "orange"],
                  ["Raise a concern", ShieldCheck, "/complaints", "purple"],
                ]
              : [
                  ["Review requests", ClipboardCheck, "/requests", "blue"],
                  ["Review projects", FolderKanban, "/projects", "purple"],
                  ["Student insights", Sparkles, "/copilot", "orange"],
                  ["View complaints", ShieldCheck, "/complaints", "green"],
                ]
            ).map(([title, Icon, path, color]) => (
              <button key={path} onClick={() => navigate(path)}>
                <span className={"icon-chip " + color}>
                  <Icon size={21} />
                </span>
                <b>{title}</b>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
          <div className="tip">
            <Sparkles size={18} />
            <p>
              <b>A helpful nudge</b>
              <br />
              Your next great idea could start with a conversation. Find a
              faculty mentor.
            </p>
          </div>
        </Panel>
        <Panel
          title="Recent requests"
          subtitle="Every update, in one place"
          action={
            <button
              className="text-button"
              onClick={() => navigate("/requests")}
            >
              View all <ArrowRight size={15} />
            </button>
          }
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>REQUEST</th>
                  <th>DATE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {own.slice(0, 4).map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => navigate("/requests")}
                    className="clickable"
                  >
                    <td>
                      <b>{r.title}</b>
                      <small>
                        {r.id} · {r.category}
                      </small>
                    </td>
                    <td>
                      {new Date(r.from).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td>
                      <Badge>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!own.length && (
              <Empty
                text="A fresh start"
                detail="Your first request will appear here."
              />
            )}
          </div>
        </Panel>
        <Panel
          title="Around the campus"
          action={
            <button
              className="text-button"
              onClick={() =>
                navigate(role === "Student" ? "/events" : "/notifications")
              }
            >
              Explore <ArrowRight size={15} />
            </button>
          }
        >
          {events.slice(0, 2).map((e) => (
            <div className="event-row" key={e.id}>
              <div className="event-date">
                <small>
                  {new Date(e.date).toLocaleDateString("en-IN", {
                    month: "short",
                  })}
                </small>
                <b>{new Date(e.date).getDate()}</b>
              </div>
              <div>
                <b>{e.name}</b>
                <p>{e.location}</p>
                <Badge>{e.type}</Badge>
              </div>
              <ArrowUpRight size={17} />
            </div>
          ))}
        </Panel>
        <Panel title="Project spotlight" className="spotlight">
          {db.projects.slice(0, 1).map((p) => (
            <div key={p.id}>
              <div className="split">
                <span className="icon-chip purple">
                  <FolderKanban />
                </span>
                <Badge>{p.status}</Badge>
              </div>
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <div className="split">
                <small>Overall progress</small>
                <b>{p.progress}%</b>
              </div>
              <Progress value={p.progress} />
              <button
                className="text-button"
                onClick={() => navigate("/projects")}
              >
                Open workspace <ArrowRight size={16} />
              </button>
            </div>
          ))}
        </Panel>
        <Panel
          title="Recent activity"
          subtitle="You’re all caught up with your campus"
        >
          {db.activity.slice(0, 3).map((a, i) => (
            <div className="activity-row" key={i}>
              <span className="icon-chip green">
                <CheckCircle2 size={17} />
              </span>
              <div>
                <b>{a.title}</b>
                <p>{a.detail}</p>
                <small>{new Date(a.at).toLocaleDateString()}</small>
              </div>
            </div>
          ))}
        </Panel>
      </div>
    </>
  );
}
function FeatureRoutes() {
  const { role, user } = useCampus();
  const guard = (allowed, element) =>
    allowed.includes(role) ? element : <Navigate to="/" replace />;
  return (
    <Routes>
      <Route path="requests" element={<Requests />} />
      <Route path="apply" element={<Navigate to="/requests" replace />} />
      <Route path="complaints" element={<Complaints />} />
      <Route path="seating" element={guard(["Admin"], <Seating />)} />
      <Route path="erp" element={guard(["Admin"], <Requests erp />)} />
      <Route
        path="marketplace"
        element={guard(["Student", "Admin"], <Marketplace />)}
      />
      <Route
        path="rentals"
        element={guard(
          ["Student", "Admin"],
          <Marketplace key="rentals" rentalsPage />,
        )}
      />
      <Route path="projects" element={<Projects />} />
      <Route
        path="mentors"
        element={guard(["Student"], <Projects mentors />)}
      />
      <Route path="labs" element={guard(["Student", "Admin"], <Labs />)} />
      <Route
        path="issues"
        element={guard(["Student", "Admin"], <Labs issuesPage />)}
      />
      <Route
        path="students"
        element={guard(["Faculty", "Admin"], <Development directory />)}
      />
      <Route path="students/:id" element={<StudentRoute />} />
      <Route
        path="faculty"
        element={guard(["Admin"], <Development facultyPage />)}
      />
      <Route path="copilot" element={<Development />} />
      <Route path="insights" element={<Development />} />
      <Route
        path="attendance"
        element={guard(["Student"], <Development attendance />)}
      />
      {[
        "events",
        "notifications",
        "settings",
        "sla",
        "analytics",
        "reports",
      ].map((p) => (
        <Route
          key={p}
          path={p}
          element={guard(
            ["sla", "analytics", "reports"].includes(p)
              ? ["Admin", "Faculty"]
              : ["Student", "Faculty", "Admin"],
            <General page={p} />,
          )}
        />
      ))}
      <Route
        path="*"
        element={
          <Empty
            text="Page not found"
            detail="Choose a section from the sidebar to continue."
          />
        }
      />
    </Routes>
  );
}
function StudentRoute() {
  const { role, user } = useCampus();
  const path = useLocation().pathname;
  return role === "Student" && !path.endsWith("/" + user.id) ? (
    <Navigate to="/attendance" replace />
  ) : (
    <Development />
  );
}
