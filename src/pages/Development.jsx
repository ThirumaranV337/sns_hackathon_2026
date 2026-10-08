import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Sparkles, Send, Plus, Users, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useCampus } from "../App";
import { students, faculty } from "../data/seed";
import { risk, copilotAnswer } from "../logic";
import {
  Heading,
  Panel,
  Badge,
  Avatar,
  Progress,
  Empty,
  Metric,
} from "../components/ui";
export default function Development({
  directory = false,
  attendance = false,
  facultyPage = false,
}) {
  const { user, role, navigate } = useCampus();
  const { id } = useParams();
  const [q, setQ] = useState(""),
    [dept, setDept] = useState("All"),
    [riskFilter, setRisk] = useState("All"),
    [tab, setTab] = useState("Academics"),
    [messages, setMessages] = useState([]),
    [typing, setTyping] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  const s = students.find((s) => s.id === (attendance ? user.id : id));
  const dataset = role === "Student" ? [user] : students;
  const ask = (text) => {
    if (!text.trim() || typing) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setQ("");
    setTyping(true);
    timer.current = setTimeout(() => {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: copilotAnswer(text, dataset) },
      ]);
      setTyping(false);
    }, 650);
  };
  if (facultyPage)
    return (
      <>
        <Heading
          title="Faculty directory"
          description="The people helping campus ideas grow."
        />
        <div className="card-grid">
          {faculty.map((f) => (
            <Panel key={f.id} title={f.name} subtitle={f.dept}>
              <Avatar name={f.name} />
              <h3 className="spacer">{f.specialization}</h3>
              <p>{f.tech}</p>
              <Badge>{f.available ? "Available" : "Busy"}</Badge>
            </Panel>
          ))}
        </div>
      </>
    );
  if (s)
    return (
      <>
        <Heading
          eyebrow="STUDENT DEVELOPMENT / 360° PROFILE"
          title={s.name}
          description={s.roll + " · " + s.dept + " · Year " + s.year}
        />
        <div className="metrics">
          <Metric label="CGPA" value={s.cgpa} icon={TrendingUp} />
          <Metric label="Attendance" value={s.attendance + "%"} icon={Users} />
          <Metric
            label="Skills tracked"
            value={s.skills.length}
            icon={Sparkles}
          />
          <Metric label="Student status" value={risk(s)} icon={Users} />
        </div>
        <div className="two-col">
          <Panel title="Learning journey">
            <div className="tabs">
              {["Academics", "Attendance", "Skills", "Achievements"].map(
                (t) => (
                  <button
                    key={t}
                    className={
                      (attendance ? "Attendance" : tab) === t ? "active" : ""
                    }
                    onClick={() => {
                      if (attendance) navigate("/students/" + s.id);
                      setTab(t);
                    }}
                  >
                    {t}
                  </button>
                ),
              )}
            </div>
            {(attendance ? "Attendance" : tab) === "Academics" ? (
              <>
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={s.semesters.map((v, i) => ({
                        semester: "Sem " + (i + 1),
                        cgpa: i === 5 ? s.cgpa : v,
                      }))}
                    >
                      <CartesianGrid stroke="#eef1f6" />
                      <XAxis dataKey="semester" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 10]} />
                      <Tooltip />
                      <Line dataKey="cgpa" stroke="#6380e5" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>SUBJECT</th>
                      <th>MARKS</th>
                      <th>GRADE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      "Algorithms",
                      "Database Systems",
                      "Networks",
                      "Engineering Mathematics",
                    ].map((n, i) => (
                      <tr key={n}>
                        <td>{n}</td>
                        <td>{Math.round(s.cgpa * 10) - i * 2}/100</td>
                        <td>{s.cgpa > 8 ? "A" : "B"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (attendance ? "Attendance" : tab) === "Attendance" ? (
              <div className="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={["Jul", "Aug", "Sep", "Oct"].map((month, i) => ({
                      month,
                      attendance: Math.min(100, s.attendance - 3 + i),
                    }))}
                  >
                    <XAxis dataKey="month" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar
                      dataKey="attendance"
                      fill="#718aeb"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : tab === "Skills" ? (
              s.skills.map((skill, i) => (
                <div key={skill}>
                  <div className="split">
                    <b>{skill}</b>
                    <small>{80 - i * 10}% · illustrative level</small>
                  </div>
                  <Progress value={80 - i * 10} />
                </div>
              ))
            ) : (
              <>
                <div className="list-row">
                  <div>
                    <h3>Campus innovation challenge</h3>
                    <p>Presented a student project · September 2026</p>
                  </div>
                  <Badge>Participation</Badge>
                </div>
                <div className="list-row">
                  <div>
                    <h3>Peer learning circle</h3>
                    <p>Supported first-year coding workshops</p>
                  </div>
                  <Badge>Community</Badge>
                </div>
              </>
            )}
          </Panel>
          <Panel
            title="Copilot insights"
            subtitle="Evidence first. Helpful next steps."
          >
            <div className="insight">
              <Sparkles size={22} />
              <h3>
                {s.attendance < 75
                  ? "A check-in could make a difference"
                  : "Keep the momentum going"}
              </h3>
              <p>
                Attendance is {s.attendance}%{" "}
                {s.attendance < 75
                  ? "— below the 75% threshold. Schedule an advisor conversation and identify missed classes."
                  : "— above the 75% threshold. Maintain your current routine."}
              </p>
              <small>Source: attendance record · {s.roll}</small>
            </div>
            <div className="insight">
              <TrendingUp size={22} />
              <h3>
                {s.cgpa >= 9
                  ? "Ready for a bigger challenge"
                  : "Build on your academic foundation"}
              </h3>
              <p>
                With a {s.cgpa} CGPA,{" "}
                {s.cgpa >= 9
                  ? "consider a research project or faculty-led internship."
                  : "set a weekly practice goal and review difficult topics with your mentor."}
              </p>
              <small>Source: current academic record</small>
            </div>
          </Panel>
        </div>
      </>
    );
  if (directory)
    return (
      <>
        <Heading
          title="Student directory"
          description="See the person behind the numbers."
        />
        <Panel title="Your students">
          <div className="toolbar">
            <input
              className="filter-input"
              aria-label="Search students"
              placeholder="Search name or roll number..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              aria-label="Department filter"
              value={dept}
              onChange={(e) => setDept(e.target.value)}
            >
              {["All", "CSE", "ECE", "MECH"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select
              aria-label="Risk filter"
              value={riskFilter}
              onChange={(e) => setRisk(e.target.value)}
            >
              {["All", "On Track", "Watch", "At Risk"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>STUDENT</th>
                  <th>DEPARTMENT / YEAR</th>
                  <th>CGPA</th>
                  <th>ATTENDANCE</th>
                  <th>STATUS</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {students
                  .filter(
                    (s) =>
                      (s.name + s.roll)
                        .toLowerCase()
                        .includes(q.toLowerCase()) &&
                      (dept === "All" || dept === s.dept) &&
                      (riskFilter === "All" || risk(s) === riskFilter),
                  )
                  .map((s) => (
                    <tr key={s.id}>
                      <td>
                        <b>{s.name}</b>
                        <small>{s.roll}</small>
                      </td>
                      <td>
                        {s.dept} · {s.year}
                      </td>
                      <td>{s.cgpa}</td>
                      <td>{s.attendance}%</td>
                      <td>
                        <Badge>{risk(s)}</Badge>
                      </td>
                      <td>
                        <button onClick={() => navigate("/students/" + s.id)}>
                          View profile
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </>
    );
  return (
    <>
      <Heading
        eyebrow="STUDENT DEVELOPMENT / COPILOT"
        title="A little insight. A meaningful next step."
        description="Explore academic patterns and turn your data into a plan."
      >
        <button
          onClick={() => {
            clearTimeout(timer.current);
            setMessages([]);
            setTyping(false);
          }}
        >
          <Plus size={16} />
          New chat
        </button>
      </Heading>
      <div className="two-col">
        <Panel
          title="Development copilot"
          subtitle="Local rule-based insights · no external AI service"
        >
          <div className="chat-messages" aria-live="polite">
            {!messages.length && (
              <div className="chat-welcome">
                <span className="icon-chip purple">
                  <Sparkles size={28} />
                </span>
                <h3>What would you like to understand?</h3>
                <p>Ask about attendance, academic performance, or skills.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={"chat-message " + m.role}>
                <small>
                  {m.role === "user" ? "You" : "CampusFlow Copilot"}
                </small>
                <p>{m.text}</p>
              </div>
            ))}
            {typing && <p role="status">Checking student records…</p>}
          </div>
          <div className="prompt-chips">
            {[
              "Who is at risk?",
              "Top academic performers",
              "Where are the skill gaps?",
            ].map((t) => (
              <button key={t} disabled={typing} onClick={() => ask(t)}>
                {t}
              </button>
            ))}
          </div>
          <form
            className="chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              ask(q);
            }}
          >
            <input
              className="filter-input"
              aria-label="Ask the copilot"
              placeholder="Ask about your student data..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              className="primary"
              disabled={typing || !q.trim()}
              aria-label="Send message"
            >
              <Send size={17} />
            </button>
          </form>
        </Panel>
        <div className="stack">
          <Panel
            title="Students who need a check-in"
            subtitle="Attendance below 75%"
          >
            {dataset
              .filter((s) => s.attendance < 75)
              .map((s) => (
                <div className="list-row" key={s.id}>
                  <Avatar name={s.name} />
                  <div>
                    <b>{s.name}</b>
                    <small>
                      {s.dept} · CGPA {s.cgpa}
                    </small>
                  </div>
                  <Badge>{s.attendance + "% attendance"}</Badge>
                </div>
              ))}
            {!dataset.some((s) => s.attendance < 75) && (
              <p>No attendance flags in your records.</p>
            )}
          </Panel>
          <Panel title="Top performers">
            {[...dataset]
              .sort((a, b) => b.cgpa - a.cgpa)
              .slice(0, 3)
              .map((s) => (
                <div className="list-row" key={s.id}>
                  <Avatar name={s.name} />
                  <div>
                    <b>{s.name}</b>
                    <small>{s.dept}</small>
                  </div>
                  <Badge>{s.cgpa + " CGPA"}</Badge>
                </div>
              ))}
          </Panel>
          <div className="notice">
            Insights use sample data and fixed rules. They support a
            conversation; they are not automated decisions.
          </div>
        </div>
      </div>
    </>
  );
}
