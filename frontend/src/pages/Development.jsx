import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Sparkles,
  Send,
  Plus,
  Users,
  TrendingUp,
  MessageCircle,
  Bot,
} from "lucide-react";
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
    [studyScreen, setStudyScreen] = useState("query"),
    [queryMessages, setQueryMessages] = useState([]),
    [doubtMessages, setDoubtMessages] = useState([]),
    [latestAnswer, setLatestAnswer] = useState(""),
    [doubt, setDoubt] = useState(""),
    [showDirectoryChat, setShowDirectoryChat] = useState(false),
    [directoryChatInput, setDirectoryChatInput] = useState(""),
    [directoryChatMessages, setDirectoryChatMessages] = useState([]),
    [directoryChatTyping, setDirectoryChatTyping] = useState(false),
    [typing, setTyping] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  const s = students.find((s) => s.id === (attendance ? user.id : id));
  const dataset = role === "Student" ? [user] : students;
  const directoryStudents = students.filter(
    (student) =>
      (student.name + student.roll)
        .toLowerCase()
        .includes(q.toLowerCase()) &&
      (dept === "All" || dept === student.dept) &&
      (riskFilter === "All" || risk(student) === riskFilter),
  );
  const ask = (text) => {
    if (!text.trim() || typing) return;
    setQueryMessages((m) => [...m, { role: "user", text }]);
    setDoubtMessages([]);
    setLatestAnswer("");
    setQ("");
    setTyping(true);
    timer.current = setTimeout(() => {
      const answer = copilotAnswer(text, dataset);
      setLatestAnswer(answer);
      setQueryMessages((m) => [
        ...m,
        { role: "assistant", text: answer },
      ]);
      setTyping(false);
    }, 650);
  };
  const askAboutAnswer = (text) => {
    if (!text.trim() || typing || !latestAnswer) return;
    setDoubtMessages((m) => [...m, { role: "user", text }]);
    setDoubt("");
    setTyping(true);
    timer.current = setTimeout(() => {
      const answer = copilotAnswer(`${text} ${latestAnswer}`, dataset);
      setDoubtMessages((m) => [...m, { role: "assistant", text: answer }]);
      setTyping(false);
    }, 650);
  };
  const askDirectoryAnalytics = (text) => {
    if (!text.trim() || directoryChatTyping) return;
    setDirectoryChatMessages((messages) => [
      ...messages,
      { role: "user", text },
    ]);
    setDirectoryChatInput("");
    setDirectoryChatTyping(true);
    timer.current = setTimeout(() => {
      setDirectoryChatMessages((messages) => [
        ...messages,
        {
          role: "assistant",
          text: copilotAnswer(text, directoryStudents),
        },
      ]);
      setDirectoryChatTyping(false);
    }, 500);
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
        <Panel
          title="Your students"
          subtitle={`${directoryStudents.length} students · analytics chat uses this filtered list`}
          action={
            <button
              type="button"
              onClick={() => setShowDirectoryChat((visible) => !visible)}
            >
              <MessageCircle size={16} />
              {showDirectoryChat ? "Hide analytics chat" : "Analyze with chat"}
            </button>
          }
        >
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
                {directoryStudents.map((s) => (
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
        {showDirectoryChat && (
          <Panel
            title={
              <span className="directory-chat-heading">
                <Bot size={18} />
                Student analytics chat
              </span>
            }
            subtitle="Ask about the students currently shown by your search and filters."
          >
            <div className="directory-chat-prompts">
              {[
                "Who is at risk?",
                "Show top academic performers",
                "Summarize attendance concerns",
              ].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={directoryChatTyping || !directoryStudents.length}
                  onClick={() => askDirectoryAnalytics(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
            <div className="chat-messages directory-analytics-messages" aria-live="polite">
              {!directoryChatMessages.length && (
                <div className="chat-welcome">
                  <span className="icon-chip purple">
                    <Sparkles size={24} />
                  </span>
                  <h3>Explore student analytics</h3>
                  <p>Ask about attendance, academic performance, skills, or a student's name.</p>
                </div>
              )}
              {directoryChatMessages.map((message, index) => (
                <div
                  key={`${index}-${message.role}`}
                  className={"chat-message " + message.role}
                >
                  <small>
                    {message.role === "user" ? "You" : "Student Analytics"}
                  </small>
                  <p>{message.text}</p>
                </div>
              ))}
              {directoryChatTyping && (
                <p role="status">Analyzing filtered student records…</p>
              )}
              {!directoryStudents.length && (
                <p>No students match the current directory filters.</p>
              )}
            </div>
            <form
              className="chat-form"
              onSubmit={(event) => {
                event.preventDefault();
                askDirectoryAnalytics(directoryChatInput);
              }}
            >
              <input
                className="filter-input"
                aria-label="Ask about student analytics"
                placeholder="Ask about these students..."
                value={directoryChatInput}
                onChange={(event) => setDirectoryChatInput(event.target.value)}
              />
              <button
                className="primary"
                disabled={
                  directoryChatTyping ||
                  !directoryChatInput.trim() ||
                  !directoryStudents.length
                }
                aria-label="Ask about student analytics"
              >
                <Send size={17} />
              </button>
            </form>
          </Panel>
        )}
      </>
    );
  return (
    <>
      <Heading
        eyebrow="STUDENT LEARNING / STUDY ASSISTANT"
        title="AI Study Assistant"
        description="Ask a question, review the answer, then ask a follow-up doubt in a separate chat."
      >
        <button
          onClick={() => {
            clearTimeout(timer.current);
            setQueryMessages([]);
            setDoubtMessages([]);
            setLatestAnswer("");
            setQ("");
            setDoubt("");
            setTyping(false);
            setStudyScreen("query");
          }}
        >
          <Plus size={16} />
          New chat
        </button>
      </Heading>
      <div className="two-col">
        <Panel
          title="Study assistant"
          subtitle="Frontend-only preview · responses use the existing local demo logic"
        >
          <div className="study-assistant-tabs" role="tablist" aria-label="Study assistant screens">
            <button
              type="button"
              role="tab"
              aria-selected={studyScreen === "query"}
              className={studyScreen === "query" ? "active" : ""}
              onClick={() => setStudyScreen("query")}
            >
              1. Ask a question
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={studyScreen === "doubt"}
              className={studyScreen === "doubt" ? "active" : ""}
              disabled={!latestAnswer}
              onClick={() => setStudyScreen("doubt")}
            >
              2. Ask about the answer
            </button>
          </div>
          {studyScreen === "query" ? (
            <>
              <div className="chat-messages study-chat-messages" aria-live="polite">
                {!queryMessages.length && (
                  <div className="chat-welcome">
                    <span className="icon-chip purple">
                      <Sparkles size={28} />
                    </span>
                    <h3>What would you like to learn?</h3>
                    <p>Ask your first question to get an answer, then continue on the follow-up screen.</p>
                  </div>
                )}
                {queryMessages.map((m, i) => (
                  <div key={i} className={"chat-message " + m.role}>
                    <small>{m.role === "user" ? "You" : "Study Assistant"}</small>
                    <p>{m.text}</p>
                  </div>
                ))}
                {typing && <p role="status">Preparing an answer…</p>}
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
                  aria-label="Ask a study question"
                  placeholder="Type your question..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <button
                  className="primary"
                  disabled={typing || !q.trim()}
                  aria-label="Send study question"
                >
                  <Send size={17} />
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="study-answer-context">
                <b><Sparkles size={15} /> Answer to discuss</b>
                <p>{latestAnswer}</p>
              </div>
              <div className="chat-messages study-chat-messages" aria-live="polite">
                {!doubtMessages.length && (
                  <div className="chat-welcome">
                    <h3>What part would you like clarified?</h3>
                    <p>Ask a follow-up question about the answer above.</p>
                  </div>
                )}
                {doubtMessages.map((m, i) => (
                  <div key={i} className={"chat-message " + m.role}>
                    <small>{m.role === "user" ? "You" : "Study Assistant"}</small>
                    <p>{m.text}</p>
                  </div>
                ))}
                {typing && <p role="status">Preparing a clarification…</p>}
              </div>
              <form
                className="chat-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  askAboutAnswer(doubt);
                }}
              >
                <input
                  className="filter-input"
                  aria-label="Ask a doubt about the answer"
                  placeholder="Ask a doubt about this answer..."
                  value={doubt}
                  onChange={(e) => setDoubt(e.target.value)}
                />
                <button
                  className="primary"
                  disabled={typing || !doubt.trim()}
                  aria-label="Send follow-up question"
                >
                  <Send size={17} />
                </button>
              </form>
            </>
          )}
        </Panel>
        <div className="stack">
          <Panel title="Two-step study chat">
            <div className="study-step">
              <span>1</span>
              <div>
                <b>Ask your question</b>
                <p>Start with the topic or concept you want to understand.</p>
              </div>
            </div>
            <div className="study-step">
              <span>2</span>
              <div>
                <b>Ask a doubt</b>
                <p>Open the second screen to follow up on the latest answer.</p>
              </div>
            </div>
          </Panel>
          <div className="notice">
            This frontend-only version uses local demo responses. It is not
            connected to an AI service.
          </div>
        </div>
      </div>
    </>
  );
}
