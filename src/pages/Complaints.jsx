import React, { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  Bot,
  Send,
  RotateCcw,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ChevronRight,
  Paperclip,
  MapPin,
  Calendar,
  Layers,
  Search,
  ExternalLink,
  MessageSquare,
  HelpCircle,
  Table as TableIcon,
  MessageCircle,
  Lock,
  ArrowRight,
} from "lucide-react";
import { useCampus } from "../App";
import { categories, cells, complaintSteps, today, dateIn } from "../data/seed";
import { uid } from "../logic";
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

const SUGGESTED_TITLES = {
  Infrastructure: [
    "Projector flickering in classroom",
    "Air conditioner not cooling in lab",
    "Restroom tap leakage",
    "Whiteboard damaged in seminar hall",
  ],
  Hostel: [
    "Hostel Wi-Fi intermittent on upper floors",
    "Hot water geyser not functioning",
    "Mess food hygiene feedback",
    "Room door latch repair needed",
  ],
  Academic: [
    "Course material missing on portal",
    "Timetable scheduling conflict",
    "Elective course allocation query",
    "Lab manual distribution delay",
  ],
  Examination: [
    "Hall ticket name correction",
    "Exam schedule clash with hackathon",
    "Internal marks discrepancy",
  ],
  Transport: [
    "Bus Route 4 arrival delay",
    "Campus shuttle frequency during rush hours",
    "Bus pass renewal kiosk issue",
  ],
  Laboratory: [
    "Oscilloscope calibration error in ECE Lab",
    "Software license expired on PC-14",
    "3D printer nozzle clogged in MakerSpace",
  ],
  "Harassment/Safety": [
    "Poor lighting near North Gate pathway",
    "Ragging / misconduct prevention alert",
    "Emergency call box unresponsive",
  ],
  "IT/ERP": [
    "Student ERP login timeout",
    "Campus Wi-Fi portal certificate error",
    "Email alias redirection not working",
  ],
  Library: [
    "RFID book return scanner offline",
    "Study room AC maintenance",
    "Request for latest edition textbooks",
  ],
  "Fee/Finance": [
    "Scholarship receipt verification delay",
    "Online fee payment duplicate debit",
  ],
  Other: [
    "Cafeteria digital payment issue",
    "Lost and found inquiry",
    "Campus sports field lighting",
  ],
};

const QUICK_LOCATIONS = [
  "Classroom Block C",
  "Main Academic Block",
  "Computer Science Labs",
  "Central Library - 2nd Floor",
  "Boys Hostel Block B",
  "Girls Hostel Block A",
  "Campus Cafeteria",
  "MakerSpace & Innovation Hub",
  "Sports Complex / Ground",
  "Transport Bay / Bus Stop",
];

const SEVERITY_OPTIONS = [
  {
    level: "Low",
    hours: 120,
    desc: "Routine issue · 5 days SLA",
    badge: "Low (120h)",
  },
  {
    level: "Medium",
    hours: 72,
    desc: "Standard issue · 3 days SLA",
    badge: "Medium (72h)",
  },
  {
    level: "High",
    hours: 24,
    desc: "Urgent issue · 24h SLA",
    badge: "High (24h)",
  },
  {
    level: "Critical",
    hours: 4,
    desc: "Emergency safety/infra · 4h SLA",
    badge: "Critical (4h)",
  },
];

export default function Complaints() {
  const { db, setDb, role, user, notify, toast } = useCampus();
  const [selected, setSelected] = useState(null);
  const [adminTab, setAdminTab] = useState("chat"); // 'chat' | 'table'
  const [searchHistory, setSearchHistory] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");

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

  // Chatbot State
  const [chatStep, setChatStep] = useState("CATEGORY"); 
  // Stages: CATEGORY -> TITLE -> DESCRIPTION -> LOCATION -> DATE -> SEVERITY -> ATTACHMENT -> REVIEW -> SUBMITTED
  const [draft, setDraft] = useState({
    category: "",
    title: "",
    description: "",
    location: "",
    date: today,
    severity: "Medium",
    attachment: "",
  });

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
      text: "Your identity remains **100% anonymous** and protected. What type of grievance or concern would you like to report today?",
      time: "Just now",
      step: "CATEGORY",
    },
  ]);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, chatStep]);

  const botReply = (text, nextStep, delay = 400, extra = {}) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: uid("msg"),
          sender: "bot",
          text,
          time: "Just now",
          step: nextStep,
          ...extra,
        },
      ]);
      if (nextStep) {
        setChatStep(nextStep);
      }
    }, delay);
  };

  const restartChat = () => {
    setDraft({
      category: "",
      title: "",
      description: "",
      location: "",
      date: today,
      severity: "Medium",
      attachment: "",
    });
    setChatStep("CATEGORY");
    setInputVal("");
    setIsTyping(false);
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
        text: "Your submission will remain strictly confidential. Please select or type the category of your concern:",
        time: "Just now",
        step: "CATEGORY",
      },
    ]);
  };

  const handleUserSend = (text) => {
    const clean = text?.trim();
    if (!clean) return;

    // Add user message
    const userMsg = {
      id: uid("msg"),
      sender: "user",
      text: clean,
      time: "Just now",
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputVal("");

    // General FAQ or help checks
    const lower = clean.toLowerCase();
    if (lower.includes("anonymous") || lower.includes("privacy") || lower.includes("identity")) {
      botReply(
        "🔒 **Anonymity Guarantee:** Your student identity is never shared with the grievance handling officer or staff cells. Only a cryptographically masked tracking reference (`CMP-AN-XXXXX`) is generated.",
        chatStep,
        500
      );
      return;
    }

    if (lower === "restart" || lower === "reset" || lower === "new") {
      restartChat();
      return;
    }

    // Step-by-step logic
    if (chatStep === "CATEGORY") {
      const match = categories.find((c) => c.toLowerCase() === lower);
      const chosenCategory = match || clean;
      const targetCell = cells[chosenCategory] || "Student Welfare";
      setDraft((d) => ({ ...d, category: chosenCategory }));
      botReply(
        `Understood! You selected **${chosenCategory}** (routed to **${targetCell}**).\n\nWhat is a brief title or headline for this issue?`,
        "TITLE",
        500
      );
    } else if (chatStep === "TITLE") {
      setDraft((d) => ({ ...d, title: clean }));
      botReply(
        `Got it: **"${clean}"**.\n\nPlease describe what happened in detail. What specific issues or assistance do you need?`,
        "DESCRIPTION",
        500
      );
    } else if (chatStep === "DESCRIPTION") {
      setDraft((d) => ({ ...d, description: clean }));
      botReply(
        `Thank you for providing the details.\n\nWhere on campus did this occur? (e.g. Block, Room number, Lab, Hostel, etc.)`,
        "LOCATION",
        500
      );
    } else if (chatStep === "LOCATION") {
      setDraft((d) => ({ ...d, location: clean }));
      botReply(
        `Location noted as **${clean}**.\n\nWhen did this incident or problem occur?`,
        "DATE",
        500
      );
    } else if (chatStep === "DATE") {
      const chosenDate = lower === "today" ? today : clean;
      setDraft((d) => ({ ...d, date: chosenDate }));
      botReply(
        `Incident date set to **${chosenDate}**.\n\nWhat is the urgency or severity level of this concern?`,
        "SEVERITY",
        500
      );
    } else if (chatStep === "SEVERITY") {
      const sevMatch = SEVERITY_OPTIONS.find(
        (s) => s.level.toLowerCase() === lower || clean.toLowerCase().includes(s.level.toLowerCase())
      );
      const chosenSev = sevMatch ? sevMatch.level : "Medium";
      setDraft((d) => ({ ...d, severity: chosenSev }));
      botReply(
        `Priority marked as **${chosenSev}** (${
          sevMatch?.hours || 72
        }h SLA window).\n\nDo you have any proof or attachment file name to include? (Optional - type the filename or click Skip)`,
        "ATTACHMENT",
        500
      );
    } else if (chatStep === "ATTACHMENT") {
      const attachVal = lower === "skip" || lower === "none" || lower === "no" ? "" : clean;
      const updatedDraft = { ...draft, attachment: attachVal };
      setDraft(updatedDraft);
      botReply(
        `I've compiled your anonymous concern. Please review the summary below and confirm to submit:`,
        "REVIEW",
        600
      );
    } else if (chatStep === "REVIEW") {
      if (lower.includes("submit") || lower.includes("yes") || lower.includes("confirm")) {
        finalizeSubmission(draft);
      } else if (lower.includes("cancel") || lower.includes("edit") || lower.includes("no")) {
        restartChat();
      } else {
        botReply("Please click **Submit Concern Anonymously** below or select **Edit / Restart**.", "REVIEW", 300);
      }
    } else if (chatStep === "SUBMITTED") {
      botReply(
        "Your previous complaint is registered! If you want to submit another concern, click **File Another Concern** below or type your new issue category.",
        "CATEGORY",
        400
      );
    }
  };

  const finalizeSubmission = (finalDraft) => {
    const id = uid("CMP-AN");
    const hours = { Low: 120, Medium: 72, High: 24, Critical: 4 }[finalDraft.severity] || 72;
    const targetCell = cells[finalDraft.category] || "Student Welfare";

    const newComplaint = {
      id,
      title: finalDraft.title,
      description: finalDraft.description,
      category: finalDraft.category,
      location: finalDraft.location,
      date: finalDraft.date || today,
      severity: finalDraft.severity,
      attachment: finalDraft.attachment || "",
      cell: targetCell,
      officer: "Cell Coordinator",
      sla: hours,
      created: Date.now(),
      status: "Submitted",
      notes: [],
      timeline: [
        {
          status: "Submitted",
          comment: `Concern submitted anonymously. Routed to ${targetCell}. Target response SLA is ${hours} hours.`,
          at: Date.now(),
        },
      ],
    };

    setDb((d) => ({
      ...d,
      complaints: [newComplaint, ...d.complaints],
      complaintOwners: { ...d.complaintOwners, [id]: user.id },
    }));

    notify(
      "New anonymous complaint",
      `${id} · ${finalDraft.category} (${targetCell})`,
      "Admin",
      "/complaints"
    );

    toast(`Anonymous complaint submitted · ${id}`);

    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setChatStep("SUBMITTED");
      setMessages((prev) => [
        ...prev,
        {
          id: uid("msg"),
          sender: "bot",
          text: `🎉 **Concern Submitted Successfully!**\n\nYour private tracking ID is **${id}**.\nIt has been encrypted and routed to the **${targetCell}** with a **${hours}-hour SLA** resolution commitment.`,
          time: "Just now",
          step: "SUBMITTED",
          complaintId: id,
          complaintData: newComplaint,
        },
      ]);
    }, 600);
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

                      {/* EMBEDDED REVIEW CARD IN CHAT */}
                      {m.step === "REVIEW" && chatStep === "REVIEW" && (
                        <div className="chat-embed-card review-card">
                          <div className="embed-card-header">
                            <Sparkles size={16} className="text-primary" />
                            <b>Review Concern Summary</b>
                            <Badge>{draft.severity} Priority</Badge>
                          </div>
                          <div className="embed-card-body">
                            <div className="review-row">
                              <span className="review-label">Category & Cell:</span>
                              <span className="review-value">
                                <strong>{draft.category}</strong> → {cells[draft.category] || "Student Welfare"}
                              </span>
                            </div>
                            <div className="review-row">
                              <span className="review-label">Title:</span>
                              <span className="review-value"><strong>{draft.title}</strong></span>
                            </div>
                            <div className="review-row">
                              <span className="review-label">Description:</span>
                              <span className="review-value">{draft.description}</span>
                            </div>
                            <div className="review-row">
                              <span className="review-label">Location:</span>
                              <span className="review-value"><MapPin size={13} /> {draft.location}</span>
                            </div>
                            <div className="review-row">
                              <span className="review-label">Incident Date:</span>
                              <span className="review-value"><Calendar size={13} /> {draft.date}</span>
                            </div>
                            <div className="review-row">
                              <span className="review-label">SLA Commitment:</span>
                              <span className="review-value">
                                <Clock size={13} /> {
                                  SEVERITY_OPTIONS.find((s) => s.level === draft.severity)?.desc || "72h SLA"
                                }
                              </span>
                            </div>
                            {draft.attachment && (
                              <div className="review-row">
                                <span className="review-label">Attachment:</span>
                                <span className="review-value"><Paperclip size={13} /> {draft.attachment}</span>
                              </div>
                            )}
                            <div className="privacy-badge-note">
                              <Lock size={12} /> Student ID masked. Routed with anonymous token.
                            </div>
                          </div>
                          <div className="embed-card-actions">
                            <button
                              className="primary"
                              onClick={() => finalizeSubmission(draft)}
                            >
                              <CheckCircle2 size={16} /> Submit Concern Anonymously
                            </button>
                            <button onClick={restartChat}>
                              <RotateCcw size={15} /> Edit / Restart
                            </button>
                          </div>
                        </div>
                      )}

                      {/* EMBEDDED SUBMITTED CARD IN CHAT */}
                      {m.step === "SUBMITTED" && m.complaintData && (
                        <div className="chat-embed-card success-card">
                          <div className="embed-card-header success">
                            <CheckCircle2 size={18} />
                            <b>Concern Registered · #{m.complaintId}</b>
                          </div>
                          <p style={{ margin: "6px 0 12px", fontSize: "13px" }}>
                            Your concern is recorded with cell <strong>{m.complaintData.cell}</strong>. 
                            You can view real-time updates directly on the right panel or click below.
                          </p>
                          <div className="embed-card-actions">
                            <button
                              className="primary"
                              onClick={() => setSelected(m.complaintId)}
                            >
                              <ExternalLink size={15} /> Track Concern Details
                            </button>
                            <button onClick={restartChat}>
                              <MessageSquare size={15} /> Report Another Issue
                            </button>
                          </div>
                        </div>
                      )}
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

              {/* DYNAMIC INTERACTIVE CHIPS AREA */}
              <div className="chat-interactive-area">
                {chatStep === "CATEGORY" && !isTyping && (
                  <div className="quick-chips-wrapper">
                    <span className="chips-label">Select Issue Category:</span>
                    <div className="prompt-chips">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => handleUserSend(cat)}
                          className="chip-btn"
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chatStep === "TITLE" && !isTyping && (
                  <div className="quick-chips-wrapper">
                    <span className="chips-label">Common headlines for {draft.category}:</span>
                    <div className="prompt-chips">
                      {(SUGGESTED_TITLES[draft.category] || SUGGESTED_TITLES["Other"]).map((st) => (
                        <button
                          key={st}
                          onClick={() => handleUserSend(st)}
                          className="chip-btn"
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chatStep === "LOCATION" && !isTyping && (
                  <div className="quick-chips-wrapper">
                    <span className="chips-label">Suggested Campus Locations:</span>
                    <div className="prompt-chips">
                      {QUICK_LOCATIONS.map((loc) => (
                        <button
                          key={loc}
                          onClick={() => handleUserSend(loc)}
                          className="chip-btn"
                        >
                          <MapPin size={12} /> {loc}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chatStep === "DATE" && !isTyping && (
                  <div className="quick-chips-wrapper">
                    <span className="chips-label">Select Date:</span>
                    <div className="prompt-chips">
                      <button onClick={() => handleUserSend(today)} className="chip-btn">
                        Today ({today})
                      </button>
                      <button onClick={() => handleUserSend(dateIn(-1))} className="chip-btn">
                        Yesterday ({dateIn(-1)})
                      </button>
                      <button onClick={() => handleUserSend(dateIn(-2))} className="chip-btn">
                        2 Days Ago ({dateIn(-2)})
                      </button>
                    </div>
                  </div>
                )}

                {chatStep === "SEVERITY" && !isTyping && (
                  <div className="quick-chips-wrapper">
                    <span className="chips-label">Select Priority / SLA Response Target:</span>
                    <div className="severity-chips-grid">
                      {SEVERITY_OPTIONS.map((sev) => (
                        <button
                          key={sev.level}
                          onClick={() => handleUserSend(sev.level)}
                          className={`severity-chip-card sev-${sev.level.toLowerCase()}`}
                        >
                          <div className="sev-card-top">
                            <strong>{sev.level}</strong>
                            <Badge>{sev.hours}h SLA</Badge>
                          </div>
                          <small>{sev.desc}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chatStep === "ATTACHMENT" && !isTyping && (
                  <div className="quick-chips-wrapper">
                    <span className="chips-label">Evidence / File Name (Optional):</span>
                    <div className="prompt-chips">
                      <button onClick={() => handleUserSend("Skip")} className="chip-btn primary-chip">
                        Skip Attachment
                      </button>
                      <button onClick={() => handleUserSend("incident-photo.jpg")} className="chip-btn">
                        <Paperclip size={12} /> incident-photo.jpg
                      </button>
                      <button onClick={() => handleUserSend("screenshot.png")} className="chip-btn">
                        <Paperclip size={12} /> screenshot.png
                      </button>
                    </div>
                  </div>
                )}
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
                  placeholder={
                    chatStep === "TITLE"
                      ? "Type your issue title..."
                      : chatStep === "DESCRIPTION"
                        ? "Type what happened in detail..."
                        : chatStep === "LOCATION"
                          ? "Type location or choose above..."
                          : chatStep === "ATTACHMENT"
                            ? "Type filename (e.g. proof.pdf) or 'skip'..."
                            : "Type your response or question to SafeVoice..."
                  }
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
                  {["All", "Active", "Resolved"].map((st) => (
                    <button
                      key={st}
                      className={`tab-pill ${statusFilter === st ? "active" : ""}`}
                      onClick={() => setStatusFilter(st)}
                    >
                      {st}
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
                          <span className="complaint-id-badge">{c.id}</span>
                          <span className="history-item-date">{c.date}</span>
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
            {["Resolved", "Closed"].includes(current.status)
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
                  setDb((d) => ({
                    ...d,
                    complaints: d.complaints.map((c) =>
                      c.id === selected
                        ? {
                            ...c,
                            status: f.status,
                            severity: f.severity,
                            officer: f.officer,
                            notes: f.note
                              ? [...c.notes, { text: f.note, at: Date.now() }]
                              : c.notes,
                            timeline: [
                              ...c.timeline,
                              {
                                status: f.status,
                                comment: f.publicUpdate || `Status updated to ${f.status} by ${f.officer}.`,
                                at: Date.now(),
                              },
                            ],
                          }
                        : c
                    ),
                  }));
                  notify(
                    "Complaint updated",
                    `${current.id} · ${f.status}`,
                    "Student",
                    "/complaints"
                  );
                  toast("Concern updated successfully.");
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
