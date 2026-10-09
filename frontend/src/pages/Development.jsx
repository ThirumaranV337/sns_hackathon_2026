import React, { useState } from "react";
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
import { risk } from "../logic";
import { askStudentAnalytics, askStudyAssistant } from "../api";
import {
  Heading,
  Panel,
  Badge,
  Avatar,
  Progress,
  Empty,
  Metric,
} from "../components/ui";

function StudyMarkdown({ content }) {
  const lines = content.split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let list = null;
  let code = null;

  const renderInline = (text, keyPrefix) =>
    text
      .split(/(\*\*.+?\*\*|__.+?__|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`)/g)
      .filter(Boolean)
      .map((part, index) => {
        const key = `${keyPrefix}-${index}`;
        if (
          (part.startsWith("**") && part.endsWith("**")) ||
          (part.startsWith("__") && part.endsWith("__"))
        ) {
          return <strong key={key}>{part.slice(2, -2)}</strong>;
        }
        if (
          (part.startsWith("*") && part.endsWith("*")) ||
          (part.startsWith("_") && part.endsWith("_"))
        ) {
          return <em key={key}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code key={key}>{part.slice(1, -1)}</code>;
        }
        return part;
      });

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(
      <p key={`p-${blocks.length}`}>
        {renderInline(paragraph.join(" "), `p-${blocks.length}`)}
      </p>,
    );
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    const List = list.type === "ordered" ? "ol" : "ul";
    blocks.push(
      <List key={`list-${blocks.length}`}>
        {list.items.map((item, index) => (
          <li key={index}>
            {renderInline(item, `list-${blocks.length}-${index}`)}
          </li>
        ))}
      </List>,
    );
    list = null;
  };

  lines.forEach((line, index) => {
    const fence = line.match(/^\s*```([\w+-]*)\s*$/);
    if (fence) {
      flushParagraph();
      flushList();
      if (code === null) code = [];
      else {
        blocks.push(
          <pre key={`code-${blocks.length}`}>
            <code>{code.join("\n")}</code>
          </pre>,
        );
        code = null;
      }
      return;
    }
    if (code !== null) {
      code.push(line);
      return;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    const quote = line.match(/^\s*>\s?(.*)$/);
    const separator = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);

    if (!line.trim() || heading || unordered || ordered || quote || separator) {
      flushParagraph();
    }
    if (unordered || ordered) {
      const type = ordered ? "ordered" : "unordered";
      if (list?.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push((ordered || unordered)[1]);
      return;
    }
    flushList();
    if (!line.trim()) return;
    if (heading) {
      const HeadingTag = `h${heading[1].length}`;
      blocks.push(
        <HeadingTag key={`h-${index}`}>
          {renderInline(heading[2], `h-${index}`)}
        </HeadingTag>,
      );
      return;
    }
    if (quote) {
      blocks.push(
        <blockquote key={`q-${index}`}>
          {renderInline(quote[1], `q-${index}`)}
        </blockquote>,
      );
      return;
    }
    if (separator) {
      blocks.push(<hr key={`hr-${index}`} />);
      return;
    }
    paragraph.push(line.trim());
  });

  flushParagraph();
  flushList();
  if (code !== null) {
    blocks.push(
      <pre key={`code-${blocks.length}`}>
        <code>{code.join("\n")}</code>
      </pre>,
    );
  }
  return <div className="study-markdown">{blocks}</div>;
}

function StudentAnalyticsChat({ role, studentId }) {
  const { toast } = useCampus();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const prompts =
    role === "Student"
      ? [
          "Summarize my subject scores and strongest subject",
          "Which subjects should I focus on?",
          "Summarize my achievements and activities",
        ]
      : [
          "Compare average subject scores by department",
          "Which subjects have the lowest average scores?",
          "Summarize student achievements and activities",
        ];

  const ask = async (question) => {
    if (!question.trim() || typing) return;
    const userMessage = { role: "user", text: question.trim() };
    const history = messages.slice(-8).map((message) => ({
      role: message.role,
      content: message.text.slice(0, 2000),
    }));
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setTyping(true);
    try {
      const {
        answer,
        recordsAnalyzed,
        interpretationAvailable,
        visualizations = [],
      } =
        await askStudentAnalytics(
        question.trim(),
        history,
        role,
        studentId,
      );
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: answer,
          recordsAnalyzed,
          interpretationAvailable,
          visualizations,
        },
      ]);
    } catch (error) {
      setMessages((current) =>
        current.filter((message) => message !== userMessage),
      );
      toast(`Student analytics could not answer: ${error.message}`);
    } finally {
      setTyping(false);
    }
  };

  return (
    <Panel
      title={
        <span className="directory-chat-heading">
          <Bot size={18} />
          {role === "Student"
            ? "My student analytics"
            : role === "Admin"
              ? "Management analytics chat"
              : "Student analytics chat"}
        </span>
      }
      subtitle={
        role === "Student"
          ? "Ask about your own synthetic student record."
          : "Answers are based on the full synthetic student database."
      }
    >
      <div className="directory-chat-prompts">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={typing}
            onClick={() => ask(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
      <div
        className="chat-messages directory-analytics-messages"
        aria-live="polite"
      >
        {!messages.length && (
          <div className="chat-welcome">
            <span className="icon-chip purple">
              <Sparkles size={24} />
            </span>
            <h3>
              {role === "Student"
                ? "Explore your academic record"
                : "Explore student analytics"}
            </h3>
            <p>
              {role === "Student"
                ? "Ask about your subject scores, achievements, or activities."
                : "Ask questions about academic performance, departments, achievements, or activities."}
            </p>
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={`${index}-${message.role}`}
            className={"chat-message " + message.role}
          >
            <small>
              {message.role === "user"
                ? "You"
                : `${message.interpretationAvailable ? "Educational analyst" : "Verified database analysis"} · ${message.recordsAnalyzed} record${message.recordsAnalyzed === 1 ? "" : "s"}`}
            </small>
            {message.role === "assistant" ? (
              <StudyMarkdown content={message.text} />
            ) : (
              <p>{message.text}</p>
            )}
            {message.role === "assistant" &&
              message.visualizations?.map((visualization) => (
                <section
                  className="analytics-visualization"
                  key={visualization.title}
                  aria-label={visualization.title}
                >
                  <h4>{visualization.title}</h4>
                  <p>{visualization.description}</p>
                  <div className="analytics-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={visualization.data}
                        layout="vertical"
                        margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
                      >
                        <CartesianGrid
                          stroke="#eef1f6"
                          strokeDasharray="3 3"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          domain={
                            visualization.unit.includes("out of 100")
                              ? [0, 100]
                              : [0, "auto"]
                          }
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis
                          type="category"
                          dataKey="label"
                          width={130}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip
                          formatter={(value) => [
                            Number(value).toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            }),
                            visualization.unit,
                          ]}
                        />
                        <Bar
                          dataKey="value"
                          fill="#718aeb"
                          radius={[0, 5, 5, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              ))}
            {message.role === "assistant" &&
              !message.interpretationAvailable && (
                <p className="analytics-warning" role="status">
                  Sarvam did not return an educational interpretation this
                  time. The verified findings above were calculated from the
                  database and are still available.
                </p>
              )}
          </div>
        ))}
        {typing && <p role="status">Analyzing database records…</p>}
      </div>
      <form
        className="chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          ask(input);
        }}
      >
        <input
          className="filter-input"
          aria-label="Ask about student analytics"
          placeholder={
            role === "Student"
              ? "Ask about your student record..."
              : "Ask a student or management analytics question..."
          }
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <button
          className="primary"
          disabled={typing || !input.trim()}
          aria-label="Ask about student analytics"
        >
          <Send size={17} />
        </button>
      </form>
    </Panel>
  );
}

export default function Development({
  directory = false,
  attendance = false,
  facultyPage = false,
}) {
  const { user, role, navigate, toast } = useCampus();
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
    [typing, setTyping] = useState(false);
  const s = students.find((s) => s.id === (attendance ? user.id : id));
  const directoryStudents = students.filter(
    (student) =>
      (student.name + student.roll)
        .toLowerCase()
        .includes(q.toLowerCase()) &&
      (dept === "All" || dept === student.dept) &&
      (riskFilter === "All" || risk(student) === riskFilter),
  );
  const ask = async (text) => {
    if (!text.trim() || typing) return;
    setQueryMessages((m) => [...m, { role: "user", text }]);
    setDoubtMessages([]);
    setLatestAnswer("");
    setQ("");
    setTyping(true);
    try {
      const history = queryMessages.map((message) => ({
        role: message.role,
        content: message.text,
      }));
      const { answer } = await askStudyAssistant(text.trim(), history);
      setLatestAnswer(answer);
      setQueryMessages((m) => [
        ...m,
        { role: "assistant", text: answer },
      ]);
    } catch (error) {
      toast(`Study assistant could not answer: ${error.message}`);
    } finally {
      setTyping(false);
    }
  };
  const askAboutAnswer = async (text) => {
    if (!text.trim() || typing || !latestAnswer) return;
    setDoubtMessages((m) => [...m, { role: "user", text }]);
    setDoubt("");
    setTyping(true);
    try {
      const history = [
        ...queryMessages,
        ...doubtMessages,
      ].map((message) => ({
        role: message.role,
        content: message.text,
      }));
      const { answer } = await askStudyAssistant(text.trim(), history);
      setDoubtMessages((m) => [...m, { role: "assistant", text: answer }]);
    } catch (error) {
      toast(`Study assistant could not answer: ${error.message}`);
    } finally {
      setTyping(false);
    }
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
        <div className="analytics-disclaimer">
          This analytics demo uses synthetic records. Use its recommendations
          as decision support, not as a substitute for faculty review.
        </div>
        <StudentAnalyticsChat role={role} studentId={user.id} />
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
          subtitle={`${directoryStudents.length} students shown · analytics chat uses the full student database`}
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
          <StudentAnalyticsChat role={role} studentId={user.id} />
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
      <div className="study-assistant-layout">
        <Panel
          className="study-assistant-panel"
          title="Study assistant"
          subtitle="Powered by the Sarvam-105B study assistant"
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
                    {m.role === "assistant" ? (
                      <StudyMarkdown content={m.text} />
                    ) : (
                      <p>{m.text}</p>
                    )}
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
                <StudyMarkdown content={latestAnswer} />
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
                    {m.role === "assistant" ? (
                      <StudyMarkdown content={m.text} />
                    ) : (
                      <p>{m.text}</p>
                    )}
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
      </div>
    </>
  );
}
