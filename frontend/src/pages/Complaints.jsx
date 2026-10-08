import React, { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  Bot,
  Send,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Layers,
  Search,
  MessageSquare,
  Table as TableIcon,
  MessageCircle,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";
import { useCampus } from "../App";
import { categories, cells, complaintSteps } from "../data/seed";
import { uid } from "../logic";
import {
  escalateComplaint,
  getComplaints,
  markComplaintSolved,
  sendComplaintChat,
} from "../api";
import {
  Heading,
  Panel,
  Badge,
  Modal,
  Form,
  Field,
  Timeline,
  Empty,
  Metric,
} from "../components/ui";

export default function Complaints() {
  const { db, setDb, role, user, toast } = useCampus();
  const [selected, setSelected] = useState(null);
  const [adminTab, setAdminTab] = useState("chat"); // 'chat' | 'table'
  const [searchHistory, setSearchHistory] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [escalatingId, setEscalatingId] = useState(null);
  const [solvingId, setSolvingId] = useState(null);

  // Admin table filters
  const [adminQ, setAdminQ] = useState("");
  const [adminCat, setAdminCat] = useState("All");
  const [adminSev, setAdminSev] = useState("All");
  const [adminStat, setAdminStat] = useState("All");
  const [adminSla, setAdminSla] = useState("All");
  const [adminCell, setAdminCell] = useState("All");
  const [adminDate, setAdminDate] = useState("");

  const admin = role !== "Student";

  // Complaints belonging to the active user (or all if admin)
  const myComplaints = db.complaints.filter(
    (c) => db.complaintOwners?.[c.id] === user.id || (!admin && !db.complaintOwners?.[c.id] && c.id === "CMP-AN-48291"),
  );

  const allComplaints = db.complaints;
  const historyList = admin && adminTab === "table" ? allComplaints : myComplaints;

  const breached = (c) =>
    !["Resolved", "Closed"].includes(c.status) &&
    Date.now() > c.created + c.sla * 3600000;

  const isUnresolved = (complaint) =>
    !["resolved", "closed", "escalated", "escalating"].includes(
      String(complaint.status).toLowerCase(),
    );

  const filteredHistory = myComplaints.filter((c) => {
    const matchQuery =
      (c.id + " " + c.title + " " + c.category + " " + c.location)
        .toLowerCase()
        .includes(searchHistory.toLowerCase());
    const matchCategory =
      categoryFilter === "All" || c.category === categoryFilter;
    const matchStatus =
      statusFilter === "All"
        ? true
        : statusFilter === "Eligible"
          ? Boolean(c.escalationEligible) && isUnresolved(c)
          : statusFilter === "Active"
            ? !["Resolved", "Closed"].includes(c.status)
            : ["Resolved", "Closed"].includes(c.status);
    return matchQuery && matchCategory && matchStatus;
  });

  const visibleAdmin = allComplaints.filter(
    (c) =>
      (c.id + " " + c.title).toLowerCase().includes(adminQ.toLowerCase()) &&
      (adminCat === "All" || c.category === adminCat) &&
      (adminSev === "All" || c.severity === adminSev) &&
      (adminStat === "All" || c.status === adminStat) &&
      (adminCell === "All" || c.cell === adminCell) &&
      (!adminDate || c.date === adminDate) &&
      (adminSla === "All" || (adminSla === "Breached" ? breached(c) : !breached(c))),
  );

  const current = db.complaints.find((c) => c.id === selected);

  const [inputVal, setInputVal] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "m1",
      sender: "bot",
      text: "👋 Hello! I am **SafeVoice**, your confidential campus grievance assistant.",
      time: "Just now",
    },
    {
      id: "m2",
      sender: "bot",
      text: "Your identity is protected. Tell me what happened, ask a question, or describe the concern you would like to report.",
      time: "Just now",
    },
  ]);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    let active = true;
    getComplaints()
      .then((serverComplaints) => {
        if (!active) return;
        setDb((currentDb) => {
          const serverIds = new Set(serverComplaints.map((complaint) => complaint.id));
          const localComplaints = currentDb.complaints.filter(
            (complaint) => !serverIds.has(complaint.id),
          );
          return {
            ...currentDb,
            complaints: [...serverComplaints, ...localComplaints],
            complaintOwners: {
              ...currentDb.complaintOwners,
              ...Object.fromEntries(
                serverComplaints.map((complaint) => [complaint.id, user.id]),
              ),
            },
          };
        });
      })
      .catch((error) => {
        if (active) toast(`Could not load saved complaints: ${error.message}`);
      });

    return () => {
      active = false;
    };
  }, [setDb, toast, user.id]);

  const restartChat = () => {
    setInputVal("");
    setMessages([
      {
        id: uid("msg"),
        sender: "bot",
        text: "🔄 Chat reset. SafeVoice is ready.",
        time: "Just now",
      },
      {
        id: uid("msg"),
        sender: "bot",
        text: "Your identity is protected. Tell me what happened, ask a question, or describe the concern you would like to report.",
        time: "Just now",
      },
    ]);
  };

  const refreshComplaints = async () => {
    const serverComplaints = await getComplaints();
    setDb((currentDb) => {
      const serverIds = new Set(serverComplaints.map((complaint) => complaint.id));
      const localComplaints = currentDb.complaints.filter(
        (complaint) => !serverIds.has(complaint.id),
      );
      return {
        ...currentDb,
        complaints: [...serverComplaints, ...localComplaints],
        complaintOwners: {
          ...currentDb.complaintOwners,
          ...Object.fromEntries(
            serverComplaints.map((complaint) => [complaint.id, user.id]),
          ),
        },
      };
    });
  };

  const handleEscalate = async (complaint) => {
    setEscalatingId(complaint.id);
    try {
      const updatedComplaint = await escalateComplaint(complaint.id);
      setDb((currentDb) => ({
        ...currentDb,
        complaints: currentDb.complaints.map((item) =>
          item.id === updatedComplaint.id ? updatedComplaint : item,
        ),
      }));
      toast(`${complaint.id} escalated to higher authorities.`);
    } catch (error) {
      toast(`Could not escalate complaint: ${error.message}`);
    } finally {
      setEscalatingId(null);
    }
  };

  const handleMarkSolved = async (complaint) => {
    if (
      !window.confirm(
        `Mark "${complaint.title}" as solved? This permanently removes it from the complaint database.`,
      )
    ) {
      return;
    }

    setSolvingId(complaint.id);
    try {
      await markComplaintSolved(complaint.id);
      setDb((currentDb) => {
        const complaintOwners = { ...currentDb.complaintOwners };
        delete complaintOwners[complaint.id];
        return {
          ...currentDb,
          complaints: currentDb.complaints.filter(
            (item) => item.id !== complaint.id,
          ),
          complaintOwners,
        };
      });
      if (selected === complaint.id) setSelected(null);
      toast(`${complaint.id} marked solved and removed.`);
    } catch (error) {
      toast(`Could not mark complaint solved: ${error.message}`);
    } finally {
      setSolvingId(null);
    }
  };

  const handleUserSend = async (text) => {
    const clean = text?.trim();
    if (!clean || isTyping) return;

    const history = messages.map((message) => ({
      role: message.sender === "bot" ? "assistant" : "user",
      content: message.text,
    }));
    setMessages((prev) => [
      ...prev,
      { id: uid("msg"), sender: "user", text: clean, time: "Just now" },
    ]);
    setInputVal("");

    setIsTyping(true);
    try {
      const { reply } = await sendComplaintChat(clean, history);
      setMessages((prev) => [
        ...prev,
        { id: uid("msg"), sender: "bot", text: reply, time: "Just now" },
      ]);
      try {
        await refreshComplaints();
      } catch (error) {
        toast(`Could not refresh saved complaints: ${error.message}`);
      }
    } catch (error) {
      toast(`SafeVoice could not respond: ${error.message}`);
      setMessages((prev) => [
        ...prev,
        {
          id: uid("msg"),
          sender: "bot",
          text: "I could not reach the complaint assistant. Please try your message again.",
          time: "Just now",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <Heading
        eyebrow="STUDENT WELFARE / SAFE CAMPUS VOICE"
        title={admin ? "Grievance & Complaint Center" : "Your Voice Matters"}
        description="A secure, confidential AI-powered channel to report concerns and track resolution."
      >
        {admin && (
          <div className="segmented-control" style={{ display: "flex", gap: "6px" }}>
            <button
              className={adminTab === "chat" ? "primary" : ""}
              onClick={() => setAdminTab("chat")}
            >
              <Bot size={16} /> Grievance Chatbot
            </button>
            <button
              className={adminTab === "table" ? "primary" : ""}
              onClick={() => setAdminTab("table")}
            >
              <TableIcon size={16} /> Staff Desk & SLA ({allComplaints.length})
            </button>
          </div>
        )}
      </Heading>

      <div className="notice" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <ShieldCheck size={20} style={{ color: "#3964ec", flexShrink: 0 }} />
        <div>
          <b>Confidential & Encrypted:</b> Your student identity is shielded from the complaint handler. 
          {admin
            ? " Staff members see only the masked tracking ID and concern details."
            : " Track updates in real-time in the sidebar with your private reference."}
        </div>
      </div>

      {admin && adminTab === "table" ? (
        // ADMIN TABLE VIEW
        <>
          <div className="metrics">
            {[
              ["Total complaints", allComplaints.length, ShieldCheck, "blue"],
              ["New / Unassigned", allComplaints.filter((c) => c.status === "Submitted").length, MessageSquare, "amber"],
              ["Critical Priority", allComplaints.filter((c) => c.severity === "Critical").length, AlertTriangle, "red"],
              ["SLA Breached", allComplaints.filter(breached).length, Clock, "red"],
            ].map(([label, value, Icon, color]) => (
              <Metric
                key={label}
                label={label}
                value={value}
                icon={Icon}
                color={color}
              />
            ))}
          </div>

          <Panel title="All Campus Concerns & Grievance Desk">
            <div className="toolbar">
              <input
                className="filter-input"
                aria-label="Search complaints"
                placeholder="Search tracking ID, title, or cell..."
                value={adminQ}
                onChange={(e) => setAdminQ(e.target.value)}
              />
              <select
                aria-label="Category filter"
                value={adminCat}
                onChange={(e) => setAdminCat(e.target.value)}
              >
                {["All", ...categories].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                aria-label="Severity filter"
                value={adminSev}
                onChange={(e) => setAdminSev(e.target.value)}
              >
                {["All", "Low", "Medium", "High", "Critical"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                aria-label="Status filter"
                value={adminStat}
                onChange={(e) => setAdminStat(e.target.value)}
              >
                {["All", ...complaintSteps].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                aria-label="Responsible cell"
                value={adminCell}
                onChange={(e) => setAdminCell(e.target.value)}
              >
                {["All", ...new Set(Object.values(cells))].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                aria-label="SLA filter"
                value={adminSla}
                onChange={(e) => setAdminSla(e.target.value)}
              >
                <option>All</option>
                <option>Breached</option>
                <option>Within SLA</option>
              </select>
              <input
                className="filter-input"
                aria-label="Complaint date"
                type="date"
                value={adminDate}
                onChange={(e) => setAdminDate(e.target.value)}
              />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>CONCERN</th>
                    <th>CATEGORY / CELL</th>
                    <th>PRIORITY</th>
                    <th>STATUS / SLA</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAdmin.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <b>{c.title}</b>
                        <small>
                          {c.id} · {c.date} · {c.location}
                        </small>
                      </td>
                      <td>
                        {c.category}
                        <small>
                          {c.cell} · {c.officer}
                        </small>
                      </td>
                      <td>
                        <Badge>{c.severity}</Badge>
                      </td>
                      <td>
                        <Badge>{c.status}</Badge>
                        <small>
                          {breached(c)
                            ? "⚠️ SLA breached"
                            : Math.max(
                                0,
                                Math.ceil(
                                  (c.created + c.sla * 3600000 - Date.now()) /
                                    3600000
                                )
                              ) + "h until SLA"}
                        </small>
                      </td>
                      <td>
                        <button onClick={() => setSelected(c.id)}>
                          Manage / Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!visibleAdmin.length && (
              <Empty
                text="No concerns match filters"
                detail="All complaints in this view have been processed or filtered out."
              />
            )}
          </Panel>
        </>
      ) : (
        // CHATBOT + PREVIOUS COMPLAINTS SIDE-BY-SIDE VIEW
        <div className="complaints-layout">
          {/* LEFT: INTERACTIVE CHATBOT */}
          <div className="complaint-chat-container">
            <Panel
              title={
                <div className="chat-header-title">
                  <div className="chat-avatar-icon">
                    <Bot size={20} />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>SafeVoice AI Grievance Assistant</span>
                      <span className="live-indicator">
                        <span className="live-dot" /> Active
                      </span>
                    </div>
                    <small style={{ color: "var(--muted)", fontWeight: "normal" }}>
                      Confidential · Guided intake · Instant SLA routing
                    </small>
                  </div>
                </div>
              }
              action={
                <button
                  className="text-button"
                  onClick={restartChat}
                  disabled={isTyping}
                  title="Restart conversational intake"
                  style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "5px" }}
                >
                  <RotateCcw size={14} /> New Report
                </button>
              }
              className="chat-card-panel"
            >
              {/* CHAT MESSAGES SCROLL AREA */}
              <div className="chat-messages-box">
                {messages.map((m) => (
                  <div key={m.id} className={`chat-row ${m.sender}`}>
                    {m.sender === "bot" && (
                      <div className="chat-msg-avatar">
                        <Bot size={16} />
                      </div>
                    )}
                    <div className="chat-msg-content">
                      <div className="chat-sender-name">
                        {m.sender === "bot" ? "SafeVoice AI" : "You (Anonymous)"} · <small>{m.time}</small>
                      </div>
                      <div className="chat-bubble">
                        {m.text.split("\n").map((line, idx) => (
                          <p key={idx} style={{ margin: line ? "4px 0" : "8px 0" }}>
                            {line.startsWith("**") || line.includes("**") ? (
                              <span
                                dangerouslySetInnerHTML={{
                                  __html: line
                                    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                                    .replace(/`(.*?)`/g, "<code>$1</code>"),
                                }}
                              />
                            ) : (
                              line
                            )}
                          </p>
                        ))}
                      </div>

                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="chat-row bot">
                    <div className="chat-msg-avatar">
                      <Bot size={16} />
                    </div>
                    <div className="chat-msg-content">
                      <div className="typing-bubble">
                        <span className="dot" />
                        <span className="dot" />
                        <span className="dot" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* CHAT INPUT BAR */}
              <form
                className="complaint-chat-input-bar"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleUserSend(inputVal);
                }}
              >
                <input
                  className="filter-input"
                  placeholder="Describe your concern or ask SafeVoice a question..."
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  disabled={isTyping}
                />
                <button
                  type="submit"
                  className="primary"
                  disabled={isTyping || !inputVal.trim()}
                  aria-label="Send message"
                >
                  <Send size={16} />
                </button>
              </form>
            </Panel>
          </div>

          {/* RIGHT: PREVIOUSLY RAISED COMPLAINTS LIST */}
          <div className="complaint-history-container">
            <Panel
              title={
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <MessageCircle size={19} className="text-primary" />
                  <span>My Previously Raised Complaints</span>
                </div>
              }
              subtitle="All grievances submitted by your session with live status tracking"
              action={
                <Badge>{filteredHistory.length} {filteredHistory.length === 1 ? "Record" : "Records"}</Badge>
              }
              className="history-card-panel"
            >
              {/* HISTORY TOOLBAR */}
              <div className="history-filters-bar">
                <div className="search-wrap-mini">
                  <Search size={14} className="search-icon-mini" />
                  <input
                    className="filter-input mini"
                    placeholder="Search tracking ID or title..."
                    value={searchHistory}
                    onChange={(e) => setSearchHistory(e.target.value)}
                  />
                </div>
                <div className="history-status-tabs">
                  {[
                    ["All", "All"],
                    ["Active", "Active"],
                    ["Resolved", "Resolved"],
                    ["Eligible", "Eligible"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={`tab-pill ${statusFilter === value ? "active" : ""}`}
                      onClick={() => setStatusFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* COMPLAINT CARDS LIST */}
              <div className="history-cards-scroll">
                {filteredHistory.length > 0 ? (
                  filteredHistory.map((c) => {
                    const isBreached = breached(c);
                    const isResolved = ["Resolved", "Closed"].includes(c.status);
                    const hoursLeft = Math.max(
                      0,
                      Math.ceil((c.created + c.sla * 3600000 - Date.now()) / 3600000)
                    );

                    return (
                      <div
                        key={c.id}
                        className={`complaint-history-item ${selected === c.id ? "active-item" : ""}`}
                        onClick={() => setSelected(c.id)}
                      >
                        <div className="history-item-top">
                          <div className="history-item-identifiers">
                            <span className="complaint-id-badge">{c.id}</span>
                            {c.anonymous && (
                              <span className="anonymous-complaint-badge">
                                <ShieldCheck size={12} />
                                Anonymous
                              </span>
                            )}
                          </div>
                          <span className="history-item-date">{c.complaintDate || c.date}</span>
                        </div>

                        <h4 className="history-item-title">{c.title}</h4>
                        <p className="history-item-desc">{c.description}</p>

                        <div className="history-item-meta">
                          <span className="meta-tag">
                            <Layers size={12} /> {c.category}
                          </span>
                          <span className="meta-tag">
                            <MapPin size={12} /> {c.location}
                          </span>
                        </div>

                        <div className="history-item-footer">
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <Badge>{c.severity}</Badge>
                            <Badge>{c.status}</Badge>
                          </div>

                          <div className="sla-badge-indicator">
                            {isResolved ? (
                              <span className="sla-tag resolved">
                                <CheckCircle2 size={12} /> Resolved
                              </span>
                            ) : isBreached ? (
                              <span className="sla-tag breached">
                                <AlertTriangle size={12} /> SLA Breached
                              </span>
                            ) : (
                              <span className="sla-tag active">
                                <Clock size={12} /> {hoursLeft}h SLA
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="history-item-action">
                          <span>View Full Timeline & Tracking</span>
                          <ArrowRight size={13} />
                        </div>
                        {!admin &&
                          !["resolved", "closed", "escalating"].includes(
                            String(c.status).toLowerCase(),
                          ) && (
                          <div className="history-item-actions">
                            {isUnresolved(c) && c.complaintDate && (
                              <button
                                className="escalate-complaint-button"
                                disabled={
                                  !c.escalationEligible ||
                                  escalatingId === c.id ||
                                  solvingId === c.id
                                }
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleEscalate(c);
                                }}
                                title={
                                  c.escalationEligible
                                    ? "Send this unanswered complaint to higher authorities"
                                    : `Available after three days from submission${
                                        c.daysUntilEscalation
                                          ? ` (${c.daysUntilEscalation} day${
                                              c.daysUntilEscalation === 1 ? "" : "s"
                                            } remaining)`
                                          : ""
                                      }`
                                }
                              >
                                <ArrowUpRight size={14} />
                                {escalatingId === c.id
                                  ? "Escalating..."
                                  : c.escalationEligible
                                    ? "Escalate to higher authority"
                                    : `Escalate in ${c.daysUntilEscalation} day${
                                        c.daysUntilEscalation === 1 ? "" : "s"
                                      }`}
                              </button>
                            )}
                            <button
                              className="mark-solved-button"
                              disabled={
                                solvingId === c.id || escalatingId === c.id
                              }
                              onClick={(event) => {
                                event.stopPropagation();
                                handleMarkSolved(c);
                              }}
                              title="Remove this complaint permanently because the problem is solved"
                            >
                              <CheckCircle2 size={14} />
                              {solvingId === c.id ? "Removing..." : "Mark solved"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <Empty
                    text="No previous complaints"
                    detail={
                      searchHistory || statusFilter !== "All"
                        ? "No grievances match your filter criteria."
                        : "You haven't submitted any complaints yet. Use the SafeVoice chatbot to register one."
                    }
                  />
                )}
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* TRACKING & TIMELINE MODAL */}
      {current && (
        <Modal title={`Concern Tracking · ${current.id}`} onClose={() => setSelected(null)}>
          <div className="split">
            <h3>{current.title}</h3>
            <div style={{ display: "flex", gap: "8px" }}>
              {current.anonymous && (
                <span className="anonymous-complaint-badge">
                  <ShieldCheck size={12} />
                  Anonymous
                </span>
              )}
              <Badge>{current.severity} Priority</Badge>
              <Badge>{current.status}</Badge>
            </div>
          </div>

          <p className="spacer" style={{ fontSize: "14px", color: "#374151" }}>
            {current.description}
          </p>

          <div className="detail-grid">
            <div>
              <small>Location</small>
              <b>{current.location}</b>
            </div>
            <div>
              <small>Incident Date</small>
              <b>{current.date}</b>
            </div>
            <div>
              <small>Complaint Submitted</small>
              <b>{current.complaintDate || "Not available"}</b>
            </div>
            <div>
              <small>Responsible Cell</small>
              <b>{current.cell}</b>
            </div>
            <div>
              <small>Attachment</small>
              <b>{current.attachment || "None attached"}</b>
            </div>
          </div>

          <div className="routing spacer">
            {[
              current.category,
              current.cell,
              ...(admin ? [current.officer] : ["Assigned Officer"]),
              current.sla + "h SLA",
              current.status,
            ].map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span>↓</span>}
                <Badge>{s}</Badge>
              </React.Fragment>
            ))}
          </div>

          <div className="notice spacer">
            {current.status === "Escalated"
              ? "⚠️ Escalated for senior review — this matter has been forwarded to the Dean / higher authority for urgent action."
              : ["Resolved", "Closed"].includes(current.status)
                ? "✅ Resolution recorded and verified by cell coordinator."
                : breached(current)
                  ? "⚠️ SLA breached — this concern is escalated to Dean of Student Welfare."
                  : `Active tracking: Routed to ${current.cell}. Target response within ${current.sla} hours.`}
          </div>

          <h3 className="spacer" style={{ fontSize: "15px", marginBottom: "10px" }}>
            Official Progress Timeline
          </h3>
          <Timeline items={current.timeline} />

          {/* ADMIN MANAGEMENT FORM */}
          {admin && (
            <div className="spacer" style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--border)" }}>
              <h3>Admin & Staff Actions</h3>
              <p style={{ marginBottom: "16px" }}>Update concern status, assign officers, or post resolution messages.</p>

              <Form
                submit="Update & Publish Progress"
                onSubmit={(f) => {
                  const resolvedStatus = f.status === "Escalated" ? "Escalated" : f.status;
                  setDb((d) => ({
                    ...d,
                    complaints: d.complaints.map((c) =>
                      c.id === selected
                        ? {
                            ...c,
                            status: resolvedStatus,
                            severity: f.severity,
                            officer: f.officer,
                            escalated: resolvedStatus === "Escalated" || c.escalated,
                            notes: f.note
                              ? [...c.notes, { text: f.note, at: Date.now() }]
                              : c.notes,
                            timeline: [
                              ...c.timeline,
                              {
                                status: resolvedStatus,
                                comment: f.publicUpdate || `Status updated to ${resolvedStatus} by ${f.officer}.`,
                                at: Date.now(),
                              },
                            ],
                          }
                        : c
                    ),
                  }));
                  notify(
                    "Complaint updated",
                    `${current.id} · ${resolvedStatus}`,
                    "Student",
                    "/complaints"
                  );
                  toast(
                    resolvedStatus === "Escalated"
                      ? "Concern escalated for senior review."
                      : "Concern updated successfully."
                  );
                }}
              >
                <Field
                  label="Assigned Officer / Handler"
                  name="officer"
                  defaultValue={current.officer}
                />
                <div className="form-grid">
                  <Field
                    label="Status"
                    name="status"
                    options={complaintSteps}
                    defaultValue={current.status}
                  />
                  <Field
                    label="Priority / Severity"
                    name="severity"
                    options={["Low", "Medium", "High", "Critical"]}
                    defaultValue={current.severity}
                  />
                </div>
                <Field
                  label="Public Progress / Resolution Message (Visible to student)"
                  name="publicUpdate"
                  type="textarea"
                  defaultValue={`Update regarding ${current.title}`}
                />
                <Field
                  label="Internal Staff Note (Staff only)"
                  name="note"
                  type="textarea"
                  required={false}
                />
              </Form>

              {current.notes && current.notes.length > 0 && (
                <div style={{ marginTop: "16px" }}>
                  <h4 style={{ fontSize: "13px", margin: "10px 0" }}>Internal Notes (Staff Only)</h4>
                  {current.notes.map((n, i) => (
                    <div
                      key={i}
                      style={{
                        background: "#f9fafb",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        marginBottom: "6px",
                      }}
                    >
                      {n.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
