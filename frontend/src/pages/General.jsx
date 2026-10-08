import React, { useState } from "react";
import {
  Bell,
  CheckCheck,
  CalendarDays,
  Download,
  Printer,
  Users,
  ClipboardCheck,
  ShieldCheck,
  FolderKanban,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useCampus } from "../App";
import { students, faculty, events, seed } from "../data/seed";
import { csvDownload } from "../logic";
import {
  Heading,
  Panel,
  Badge,
  Form,
  Field,
  Modal,
  Empty,
  Metric,
  Avatar,
  Progress,
} from "../components/ui";
export default function General({ page }) {
  const { db, setDb, user, role, toast, navigate, switchRole } = useCampus();
  const [reset, setReset] = useState(false);
  if (page === "notifications") {
    const items = db.notifications.filter((n) => n.role === role);
    return (
      <>
        <Heading
          title="Your campus inbox"
          description="All the updates that keep your day moving."
        >
          <button
            onClick={() =>
              setDb((d) => ({
                ...d,
                notifications: d.notifications.map((n) =>
                  n.role === role ? { ...n, read: true } : n,
                ),
              }))
            }
          >
            <CheckCheck size={16} />
            Mark all read
          </button>
        </Heading>
        <Panel title="Notifications">
          {items.map((n) => (
            <div className={"list-row " + (!n.read ? "unread" : "")} key={n.id}>
              <span className="icon-chip blue">
                <Bell size={18} />
              </span>
              <div>
                <h3>{n.title}</h3>
                <p>{n.detail}</p>
                <small>{new Date(n.at).toLocaleString()}</small>
              </div>
              {!n.read && <Badge>New</Badge>}
              <button
                onClick={() => {
                  setDb((d) => ({
                    ...d,
                    notifications: d.notifications.map((x) =>
                      x.id === n.id ? { ...x, read: true } : x,
                    ),
                  }));
                  navigate(n.path);
                }}
              >
                View
              </button>
            </div>
          ))}
          {!items.length && <Empty text="You’re all caught up" />}
        </Panel>
      </>
    );
  }
  if (page === "events")
    return (
      <>
        <Heading
          title="Make the most of campus"
          description="Discover the next opportunity to learn, connect, and create."
        />
        <div className="card-grid">
          {events.map((e, i) => (
            <Panel title={e.name} subtitle={e.type} key={e.id}>
              <div className={"event-visual event-" + i}>
                <CalendarDays size={64} />
              </div>
              <p className="spacer">{e.desc}</p>
              <div className="detail-grid">
                <div>
                  <small>When</small>
                  <b>{e.date}</b>
                </div>
                <div>
                  <small>Where</small>
                  <b>{e.location}</b>
                </div>
              </div>
              <button
                className="primary"
                disabled={db.registrations.some(
                  (r) => r.student === user.id && r.event === e.id,
                )}
                onClick={() => {
                  setDb((d) => ({
                    ...d,
                    registrations: [
                      ...d.registrations,
                      { student: user.id, event: e.id },
                    ],
                  }));
                  toast("You’re registered for " + e.name + ".");
                }}
              >
                {db.registrations.some(
                  (r) => r.student === user.id && r.event === e.id,
                )
                  ? "Registered"
                  : "Register interest"}
              </button>
            </Panel>
          ))}
        </div>
      </>
    );
  if (page === "settings")
    return (
      <>
        <Heading
          title="Make this workspace yours"
          description="Profile, workspace preferences, and demo data."
        />
        <div className="two-col">
          <Panel title="Your profile">
            <div className="list-row">
              <Avatar name={user.name} />
              <div>
                <h3>{user.name}</h3>
                <p>
                  {role} · {user.dept}
                </p>
              </div>
            </div>
            <div className="notice spacer">
              This is a demo account. Use the top-bar role selector to explore
              each workflow.
            </div>
            <Field
              label="Switch demo account"
              options={(role === "Student"
                ? students
                : role === "Faculty"
                  ? faculty
                  : [user]
              ).map((s) => ({ value: s.id, label: s.name }))}
              value={user.id}
              onChange={(e) => switchRole(role, e.target.value)}
            />
            <Form
              onSubmit={(f) => {
                setDb((d) => ({
                  ...d,
                  profiles: { ...d.profiles, [user.id]: f },
                }));
                toast("Profile preferences saved.");
              }}
            >
              <Field
                label="Display bio"
                name="bio"
                type="textarea"
                required={false}
                defaultValue={db.profiles?.[user.id]?.bio}
              />
              <Field
                label="Interests"
                name="interests"
                required={false}
                defaultValue={db.profiles?.[user.id]?.interests}
              />
            </Form>
          </Panel>
          <Panel title="Workspace settings">
            <Form
              onSubmit={(f) => {
                setDb((d) => ({ ...d, settings: f }));
                toast("Workspace settings saved.");
              }}
            >
              <Field
                label="College name"
                name="college"
                defaultValue={db.settings.college}
              />
              <Field
                label="Semester"
                name="semester"
                defaultValue={db.settings.semester}
              />
            </Form>
            <div className="notice spacer">
              Data is stored in this browser. Uploaded documents retain
              filenames only. No backend, database, real authentication, or
              payment service is connected.
            </div>
            <button className="danger" onClick={() => setReset(true)}>
              Reset demo data
            </button>
          </Panel>
        </div>
        {reset && (
          <Modal title="Reset demo data?" onClose={() => setReset(false)}>
            <p>
              This removes all requests, listings, projects, and other changes
              saved in this browser and restores the original sample records.
            </p>
            <div className="inline-actions spacer">
              <button onClick={() => setReset(false)}>Keep my data</button>
              <button
                className="danger"
                onClick={() => {
                  setDb(seed());
                  setReset(false);
                  toast("Sample data restored.");
                }}
              >
                Reset all demo data
              </button>
            </div>
          </Modal>
        )}
      </>
    );
  if (page === "sla") {
    const open = db.complaints.filter(
      (c) => !["Resolved", "Closed"].includes(c.status),
    );
    return (
      <>
        <Heading
          title="SLA & escalation"
          description="Make sure every concern gets the attention it deserves."
        />
        <Panel title="Response commitments">
          {open.map((c) => {
            const hours = Math.ceil(
              (c.created + c.sla * 3600000 - Date.now()) / 3600000,
            );
            return (
              <div className="list-row" key={c.id}>
                <span className="icon-chip orange">
                  <ShieldCheck />
                </span>
                <div>
                  <h3>{c.title}</h3>
                  <small>
                    {c.id} · {c.cell} · {c.officer}
                  </small>
                  <small>
                    {c.escalated
                      ? "Escalated to HOD"
                      : "Next: assigned officer reviews the concern"}
                  </small>
                </div>
                <Badge>
                  {hours < 0 ? "SLA breached" : hours + "h remaining"}
                </Badge>
                <button
                  disabled={c.escalated}
                  onClick={() => {
                    setDb((d) => ({
                      ...d,
                      complaints: d.complaints.map((x) =>
                        x.id === c.id
                          ? {
                              ...x,
                              escalated: true,
                              timeline: [
                                ...x.timeline,
                                { status: "Escalated to HOD", at: Date.now() },
                              ],
                            }
                          : x,
                      ),
                    }));
                    toast("Concern escalated to HOD.");
                  }}
                >
                  {c.escalated ? "Escalated" : "Escalate"}
                </button>
              </div>
            );
          })}
          {!open.length && <Empty text="All concerns are resolved" />}
        </Panel>
      </>
    );
  }
  const records = [
    {
      module: "OD approvals",
      total: db.requests.length,
      complete: db.requests.filter((r) => r.status === "Approved & Synced")
        .length,
    },
    {
      module: "Complaints",
      total: db.complaints.length,
      complete: db.complaints.filter((c) =>
        ["Resolved", "Closed"].includes(c.status),
      ).length,
    },
    {
      module: "Projects",
      total: db.projects.length,
      complete: db.projects.filter((p) => p.status === "Completed").length,
    },
    {
      module: "Rentals",
      total: db.rentals.length,
      complete: db.rentals.filter((r) => r.status === "Completed").length,
    },
  ];
  return (
    <>
      <Heading
        title="A healthier campus, in view"
        description="An operational snapshot based on your current demo records."
      >
        <button
          onClick={() => csvDownload("campusflow-operations-report", records)}
        >
          <Download size={16} />
          Download report
        </button>
        <button className="primary" onClick={() => window.print()}>
          <Printer size={16} />
          Print / PDF
        </button>
      </Heading>
      <div className="metrics">
        <Metric label="Students" value={students.length} icon={Users} />
        <Metric
          label="Requests"
          value={db.requests.length}
          icon={ClipboardCheck}
        />
        <Metric
          label="Concerns"
          value={db.complaints.length}
          icon={ShieldCheck}
        />
        <Metric
          label="Projects"
          value={db.projects.length}
          icon={FolderKanban}
        />
      </div>
      <div className="two-col">
        <Panel
          title="Operations overview"
          subtitle="Current volume and completed records"
        >
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={records}>
                <CartesianGrid vertical={false} stroke="#eef1f6" />
                <XAxis dataKey="module" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="#7a91e8" radius={[5, 5, 0, 0]} />
                <Bar dataKey="complete" fill="#a9dfc8" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Workflow completion">
          {records.map((r) => (
            <div key={r.module}>
              <div className="split">
                <b>{r.module}</b>
                <small>
                  {r.complete} / {r.total} complete
                </small>
              </div>
              <Progress value={r.total ? (r.complete / r.total) * 100 : 0} />
            </div>
          ))}
        </Panel>
        <Panel title="Project distribution">
          <table>
            <thead>
              <tr>
                <th>DEPARTMENT</th>
                <th>PROJECTS</th>
                <th>AVERAGE PROGRESS</th>
              </tr>
            </thead>
            <tbody>
              {["CSE", "ECE", "MECH"].map((dept) => {
                const ps = db.projects.filter((p) => p.dept === dept);
                return (
                  <tr key={dept}>
                    <td>{dept}</td>
                    <td>{ps.length}</td>
                    <td>
                      {ps.length
                        ? Math.round(
                            ps.reduce((a, p) => a + p.progress, 0) / ps.length,
                          )
                        : 0}
                      %
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
        <Panel title="Campus readiness">
          <div className="list-row">
            <div>
              <h3>Exam plans generated</h3>
            </div>
            <Badge>{String(db.exams.length)}</Badge>
          </div>
          <div className="list-row">
            <div>
              <h3>Available marketplace listings</h3>
            </div>
            <Badge>
              {String(db.products.filter((p) => p.available).length)}
            </Badge>
          </div>
          <div className="list-row">
            <div>
              <h3>Unresolved hardware issues</h3>
            </div>
            <Badge>
              {String(db.issues.filter((i) => i.status !== "Resolved").length)}
            </Badge>
          </div>
        </Panel>
      </div>
    </>
  );
}
