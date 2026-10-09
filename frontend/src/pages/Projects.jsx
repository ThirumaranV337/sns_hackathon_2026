import React, { useEffect, useState } from "react";
import {
  Plus,
  FolderKanban,
  GraduationCap,
  CheckCircle2,
  FileText,
  Sparkles,
  Upload,
} from "lucide-react";
import { useCampus } from "../App";
import { students, faculty, dateIn, today } from "../data/seed";
import { uid } from "../logic";
import {
  analyzeIncomingProjectReport,
  getProjectReports,
  submitProjectReport,
  uploadProjectReport,
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
  Avatar,
  Progress,
  Metric,
} from "../components/ui";

function ReportAnalysis({ analysis, title }) {
  if (!analysis) return null;
  const lists = [
    ["Strengths", analysis.strengths],
    ["Risk factors to discuss", analysis.risk_factors],
    ["Sections that may be missing", analysis.missing_sections],
    ["Suggestions to add", analysis.suggestions_to_add],
    ["Suggestions to remove or shorten", analysis.suggestions_to_remove],
  ];
  return (
    <div className="project-report-analysis">
      <div className="split">
        <h4>{title}</h4>
        <span
          className={`project-risk-badge risk-${analysis.rejection_risk || "medium"}`}
        >
          {analysis.rejection_risk || "medium"} estimated rejection risk
        </span>
      </div>
      <div className="project-readiness">
        <div className="split">
          <b>Readiness score</b>
          <b>{analysis.readiness_score}/100</b>
        </div>
        <Progress value={analysis.readiness_score || 0} />
        <small>
          {analysis.risk_score_meaning ||
            "An AI-assisted readiness estimate, not a rejection probability."}
        </small>
      </div>
      <p>{analysis.executive_summary}</p>
      <p>
        <b>Why this score:</b> {analysis.score_rationale}
      </p>
      {Array.isArray(analysis.rubric) && (
        <details className="project-report-rubric">
          <summary>How the readiness score is estimated</summary>
          <p>
            A general project rubric is used because no campus-specific
            assessment rubric is configured:
          </p>
          <ul>
            {analysis.rubric.map((criterion) => (
              <li key={criterion}>{criterion}</li>
            ))}
          </ul>
        </details>
      )}
      {lists.map(
        ([label, items]) =>
          Array.isArray(items) &&
          items.length > 0 && (
            <div className="project-report-feedback" key={label}>
              <b>{label}</b>
              <ul>
                {items.map((item, index) => (
                  <li key={`${label}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          ),
      )}
    </div>
  );
}

export default function Projects({ mentors = false }) {
  const { db, setDb, role, user, toast, notify } = useCampus();
  const [create, setCreate] = useState(false),
    [selected, setSelected] = useState(null),
    [mentor, setMentor] = useState(null),
    [q, setQ] = useState("");
  const [tab, setTab] = useState("Overview");
  const [projectReports, setProjectReports] = useState([]);
  const [reportFile, setReportFile] = useState(null);
  const [reportBusy, setReportBusy] = useState("");
  const [reportsLoading, setReportsLoading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const project = db.projects.find((p) => p.id === selected);
  useEffect(() => {
    setReportFile(null);
    setFileInputKey((key) => key + 1);
    if (!project || (role !== "Student" && role !== "Faculty")) {
      setProjectReports([]);
      setReportsLoading(false);
      return undefined;
    }
    let active = true;
    setProjectReports([]);
    setReportsLoading(true);
    getProjectReports(project.id, role, user.id)
      .then((reports) => {
        if (active) setProjectReports(reports);
      })
      .catch((error) => {
        if (active) toast(`Project reports could not be loaded: ${error.message}`);
      })
      .finally(() => {
        if (active) setReportsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [project?.id, role, user.id, toast]);

  const handleReportUpload = async () => {
    if (!project || !reportFile || reportBusy) return;
    setReportBusy("upload");
    try {
      const report = await uploadProjectReport(project, user.id, reportFile);
      setProjectReports((current) => [report, ...current]);
      setReportFile(null);
      setFileInputKey((key) => key + 1);
      toast("Report analyzed. Review the readiness score before submitting it.");
    } catch (error) {
      toast(`Project report analysis failed: ${error.message}`);
    } finally {
      setReportBusy("");
    }
  };

  const handleReportSubmit = async (report) => {
    if (!project || reportBusy) return;
    if (!project.mentor) {
      toast("Choose a faculty mentor before submitting this report.");
      return;
    }
    setReportBusy(`submit-${report.id}`);
    try {
      const updated = await submitProjectReport(
        report.id,
        user.id,
        project.mentor,
      );
      setProjectReports((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      notify(
        "Project report submitted for mentor review",
        `${project.name}: ${report.filename}`,
        "Faculty",
        "/projects",
      );
      toast("Your report was submitted to the assigned mentor.");
    } catch (error) {
      toast(`Project report could not be submitted: ${error.message}`);
    } finally {
      setReportBusy("");
    }
  };

  const handleMentorReportAnalysis = async (report) => {
    setReportBusy(`review-${report.id}`);
    try {
      const updated = await analyzeIncomingProjectReport(report.id, user.id);
      setProjectReports((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      toast("AI report review is ready. Check it against your mentor judgement.");
    } catch (error) {
      toast(`Incoming report analysis failed: ${error.message}`);
    } finally {
      setReportBusy("");
    }
  };
  const visible = db.projects.filter(
    (p) =>
      (role === "Admin" ||
        (role === "Student"
          ? p.team.includes(user.id)
          : p.mentor === user.id)) &&
      p.name.toLowerCase().includes(q.toLowerCase()),
  );
  const update = (id, patch, event) => {
    setDb((d) => ({
      ...d,
      projects: d.projects.map((p) =>
        p.id === id
          ? {
              ...p,
              ...patch,
              timeline: [...p.timeline, { status: event, at: Date.now() }],
            }
          : p,
      ),
    }));
    toast(event);
  };
  return (
    <>
      <Heading
        eyebrow="PROJECTHUB / IDEAS INTO IMPACT"
        title={
          mentors
            ? "Find your guide"
            : role === "Admin"
              ? "Project monitoring"
              : "A workspace for your next big idea"
        }
        description={
          mentors
            ? "Find the right expertise, get useful feedback, and build something that matters."
            : "Plan together. Build together. Move forward with a mentor."
        }
      >
        {role === "Student" && !mentors && (
          <button className="primary" onClick={() => setCreate(true)}>
            <Plus size={17} />
            Create project
          </button>
        )}
      </Heading>
      {role === "Admin" && (
        <>
          <div className="metrics">
            {[
              ["Total projects", db.projects.length],
              [
                "Completed",
                db.projects.filter((p) => p.status === "Completed").length,
              ],
              [
                "Without mentor",
                db.projects.filter((p) => p.mentorStatus !== "Accepted").length,
              ],
              [
                "Delayed",
                db.projects.filter(
                  (p) => p.due < today && p.status !== "Completed",
                ).length,
              ],
            ].map(([label, value]) => (
              <Metric
                key={label}
                label={label}
                value={value}
                icon={FolderKanban}
              />
            ))}
          </div>
          <div className="notice">
            {
              db.projects.filter(
                (p) =>
                  Date.now() - (p.reviews?.at(-1)?.at || p.timeline[0]?.at) >
                    7 * 86400000 && p.status !== "Completed",
              ).length
            }{" "}
            projects without a faculty review in 7+ days.
          </div>
        </>
      )}
      {mentors ? (
        <div className="card-grid">
          {faculty.map((f) => (
            <Panel key={f.id} title={f.name} subtitle={f.dept}>
              <Avatar name={f.name} />
              <h3 className="spacer">{f.specialization}</h3>
              <p className="spacer">{f.tech}</p>
              <p>
                {db.projects.filter((p) => p.mentor === f.id).length} active
                mentoring relationships
              </p>
              <div className="split spacer">
                <Badge>{f.available ? "Available" : "Busy"}</Badge>
                <button disabled={!f.available} onClick={() => setMentor(f.id)}>
                  Request mentor
                </button>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <>
          <div className="toolbar">
            <input
              className="filter-input"
              aria-label="Search projects"
              value={q}
              placeholder="Search your projects..."
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="card-grid">
            {visible.map((p) => (
              <Panel
                key={p.id}
                title={p.name}
                subtitle={p.domain}
                action={
                  <span className="icon-chip purple">
                    <FolderKanban size={19} />
                  </span>
                }
              >
                <Badge>{p.status}</Badge>
                <p className="spacer">{p.description}</p>
                <div className="split spacer">
                  <small>Progress</small>
                  <b>{p.progress}%</b>
                </div>
                <Progress value={p.progress} />
                <div className="detail-grid">
                  <div>
                    <small>Team</small>
                    <b>{p.team.length} students</b>
                  </div>
                  <div>
                    <small>Target</small>
                    <b>{p.due}</b>
                  </div>
                  <div>
                    <small>Mentor</small>
                    <b>
                      {faculty.find((f) => f.id === p.mentor)?.name ||
                        "Not assigned"}
                    </b>
                  </div>
                  <div>
                    <small>Mentorship</small>
                    <Badge>{p.mentorStatus || "Not requested"}</Badge>
                  </div>
                </div>
                <button
                  className="primary"
                  onClick={() => {
                    setSelected(p.id);
                    setTab("Overview");
                  }}
                >
                  Open workspace
                </button>
              </Panel>
            ))}
          </div>
          {!visible.length && (
            <Empty
              text="Your next great idea starts here"
              detail="Create a project, or ask your student team to request a mentor."
            />
          )}
        </>
      )}
      {create && (
        <Modal title="Create a project" onClose={() => setCreate(false)}>
          <Form
            submit="Create workspace"
            onSubmit={(f) => {
              const id = uid("PRJ");
              const team = [
                ...new Set([
                  user.id,
                  ...f.team
                    .split(",")
                    .map((s) => s.trim())
                    .filter((id) => students.some((s) => s.id === id)),
                ]),
              ];
              const p = {
                ...f,
                id,
                team,
                progress: 0,
                status: "Planning",
                mentor: "",
                mentorStatus: "Not requested",
                milestones: [],
                reviews: [],
                timeline: [
                  {
                    status: "Project created",
                    comment:
                      "Next: choose a mentor and define your first milestone.",
                    at: Date.now(),
                  },
                ],
              };
              setDb((d) => ({ ...d, projects: [p, ...d.projects] }));
              setCreate(false);
              setSelected(id);
              toast("Your project workspace is ready.");
            }}
          >
            <Field label="Project name" name="name" />
            <Field label="Domain" name="domain" />
            <Field label="Description" name="description" type="textarea" />
            <div className="form-grid">
              <Field
                label="Department"
                name="dept"
                options={["CSE", "ECE", "MECH"]}
              />
              <Field
                label="Year"
                name="year"
                options={["1", "2", "3", "4"]}
                defaultValue="3"
              />
            </div>
            <Field
              label="Team student IDs, separated by commas (S1–S12)"
              name="team"
              defaultValue="S1,S2"
            />
            <Field
              label="Project type"
              name="type"
              options={["Mini", "Major", "Research", "Hackathon", "Capstone"]}
            />
            <Field label="Technologies" name="tech" />
            <Field
              label="Expected completion"
              name="due"
              type="date"
              min={today}
              defaultValue={dateIn(30)}
            />
          </Form>
        </Modal>
      )}
      {mentor && (
        <Modal title="Request a faculty mentor" onClose={() => setMentor(null)}>
          <Form
            submit="Send mentorship request"
            onSubmit={(f) => {
              update(
                f.project,
                { mentor, mentorStatus: "Requested" },
                "Mentorship requested",
              );
              notify(
                "New mentorship request",
                db.projects.find((p) => p.id === f.project)?.name,
                "Faculty",
                "/projects",
              );
              setMentor(null);
            }}
          >
            <Field
              label="Choose your project"
              name="project"
              options={db.projects
                .filter((p) => p.team.includes(user.id))
                .map((p) => ({ value: p.id, label: p.name }))}
            />
            <p>Your selected faculty member will review this request.</p>
          </Form>
        </Modal>
      )}
      {project && (
        <Modal title={project.name} onClose={() => setSelected(null)}>
          <div className="tabs">
            {["Overview", "Milestones", "Reports & AI review"].map((t) => (
              <button
                className={tab === t ? "active" : ""}
                key={t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "Overview" ? (
            <>
              <div className="split">
                <Badge>{project.status}</Badge>
                <b>{project.progress}% complete</b>
              </div>
              <Progress value={project.progress} />
              <p>{project.description}</p>
              <div className="detail-grid">
                <div>
                  <small>Team members</small>
                  <b>
                    {project.team
                      .map((id) => students.find((s) => s.id === id)?.name)
                      .join(", ")}
                  </b>
                </div>
                <div>
                  <small>Technologies</small>
                  <b>{project.tech}</b>
                </div>
                <div>
                  <small>Mentor</small>
                  <b>
                    {faculty.find((f) => f.id === project.mentor)?.name ||
                      "Choose a faculty mentor"}
                  </b>
                </div>
                <div>
                  <small>Next milestone</small>
                  <b>
                    {project.milestones.find((m) => !m.done)?.name ||
                      "Define your next milestone"}
                  </b>
                </div>
              </div>
              <Badge>{project.mentorStatus}</Badge>
              {role === "Student" && (
                <div className="spacer">
                  <Form
                    submit="Request mentor"
                    onSubmit={(f) => {
                      update(
                        project.id,
                        { mentor: f.mentor, mentorStatus: "Requested" },
                        "Mentorship requested",
                      );
                      notify(
                        "Mentorship request",
                        project.name,
                        "Faculty",
                        "/projects",
                      );
                    }}
                  >
                    <Field
                      name="mentor"
                      label="Faculty mentor"
                      options={faculty
                        .filter((f) => f.available)
                        .map((f) => ({
                          value: f.id,
                          label: f.name + " · " + f.specialization,
                        }))}
                    />
                  </Form>
                </div>
              )}
              {role === "Faculty" && project.mentorStatus === "Requested" && (
                <div className="inline-actions spacer">
                  <button
                    className="primary"
                    onClick={() =>
                      update(
                        project.id,
                        { mentorStatus: "Accepted" },
                        "Mentorship accepted",
                      )
                    }
                  >
                    Accept mentorship
                  </button>
                  <button
                    onClick={() =>
                      update(
                        project.id,
                        { mentorStatus: "Rejected", mentor: "" },
                        "Mentorship declined",
                      )
                    }
                  >
                    Reject
                  </button>
                  <button
                    onClick={() =>
                      update(
                        project.id,
                        { mentor: "F2", mentorStatus: "Suggested" },
                        "Suggested Dr. Vikram Iyer. Team may request this mentor.",
                      )
                    }
                  >
                    Suggest another faculty
                  </button>
                </div>
              )}
            </>
          ) : tab === "Milestones" ? (
            <>
              <div>
                {project.milestones.map((m, i) => (
                  <div className="list-row" key={i}>
                    <input
                      aria-label={"Complete " + m.name}
                      type="checkbox"
                      checked={m.done}
                      disabled={role !== "Student"}
                      onChange={(e) =>
                        update(
                          project.id,
                          {
                            milestones: project.milestones.map((x, j) =>
                              j === i ? { ...x, done: e.target.checked } : x,
                            ),
                          },
                          e.target.checked
                            ? "Milestone completed: " + m.name
                            : "Milestone reopened: " + m.name,
                        )
                      }
                    />
                    <div>
                      <h3>{m.name}</h3>
                      <small>
                        {m.due} ·{" "}
                        {students.find((s) => s.id === m.assignee)?.name}
                      </small>
                    </div>
                    <Badge>{m.done ? "Completed" : "Pending"}</Badge>
                  </div>
                ))}
              </div>
              {role === "Student" && (
                <Form
                  submit="Add milestone"
                  onSubmit={(f, form) => {
                    update(
                      project.id,
                      {
                        milestones: [
                          ...project.milestones,
                          { ...f, done: false },
                        ],
                      },
                      "Milestone added",
                    );
                    form.reset();
                  }}
                >
                  <Field label="Milestone" name="name" />
                  <div className="form-grid">
                    <Field label="Due date" name="due" type="date" />
                    <Field
                      label="Assignee"
                      name="assignee"
                      options={project.team.map((id) => ({
                        value: id,
                        label: students.find((s) => s.id === id)?.name || id,
                      }))}
                    />
                  </div>
                </Form>
              )}
            </>
          ) : (
            <>
              <Panel
                title={
                  role === "Faculty"
                    ? "Reports submitted for mentor review"
                    : "Project report readiness check"
                }
                subtitle={
                  role === "Faculty"
                    ? "Review incoming documents and use AI feedback as decision support."
                    : "Upload a draft to get an AI-assisted readiness score before submitting it."
                }
              >
                {role === "Student" && (
                  <>
                    <label className="project-report-upload">
                      <FileText size={18} />
                      <span>
                        {reportFile
                          ? reportFile.name
                          : "Choose a PDF, DOCX, or TXT report (max 10 MB)"}
                      </span>
                      <input
                        key={fileInputKey}
                        type="file"
                        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                        onChange={(event) =>
                          setReportFile(event.target.files?.[0] || null)
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="primary spacer"
                      disabled={!reportFile || Boolean(reportBusy)}
                      onClick={handleReportUpload}
                    >
                      <Sparkles size={16} />
                      {reportBusy === "upload"
                        ? "Analyzing report…"
                        : "Analyze and generate readiness score"}
                    </button>
                    <p className="project-report-privacy">
                      The backend extracts report text and sends it to Sarvam
                      for analysis, then stores the extracted text so your
                      mentor can review it. The original file is not retained.
                      The score is advisory—not a rejection probability or
                      submission decision. This prototype uses demo role
                      information, not secure account authorization.
                    </p>
                  </>
                )}
                {reportsLoading ? (
                  <p>Loading project reports…</p>
                ) : projectReports.length ? (
                  <div className="project-report-list">
                    {projectReports.map((report) => (
                      <article className="project-report-card" key={report.id}>
                        <div className="split project-report-heading">
                          <div>
                            <h3>
                              <FileText size={16} /> {report.filename}
                            </h3>
                            <small>
                              {report.status === "submitted"
                                ? `Submitted ${new Date(report.submitted_at).toLocaleString()}`
                                : `Draft · uploaded ${new Date(report.uploaded_at).toLocaleString()}`}
                              {role === "Faculty" &&
                                ` · From ${report.student_id}`}
                            </small>
                          </div>
                          <Badge>{report.status}</Badge>
                        </div>
                        {report.text_was_truncated && (
                          <p className="project-report-privacy">
                            The report was long; the AI review used only the
                            first 30,000 extracted characters.
                          </p>
                        )}
                        <ReportAnalysis
                          analysis={report.analysis}
                          title="Student pre-submission analysis"
                        />
                        {report.mentor_analysis && (
                          <ReportAnalysis
                            analysis={report.mentor_analysis}
                            title="Mentor AI analysis"
                          />
                        )}
                        <details className="project-report-text">
                          <summary>View extracted report text</summary>
                          <pre>{report.extracted_text}</pre>
                        </details>
                        {role === "Student" && report.status === "draft" && (
                          <button
                            type="button"
                            className="primary spacer"
                            disabled={Boolean(reportBusy)}
                            onClick={() => handleReportSubmit(report)}
                          >
                            <Upload size={16} />
                            {reportBusy === `submit-${report.id}`
                              ? "Submitting…"
                              : "Submit to mentor"}
                          </button>
                        )}
                        {role === "Faculty" && report.status === "submitted" && (
                          <button
                            type="button"
                            className="primary spacer"
                            disabled={Boolean(reportBusy)}
                            onClick={() => handleMentorReportAnalysis(report)}
                          >
                            <Sparkles size={16} />
                            {reportBusy === `review-${report.id}`
                              ? "Analyzing…"
                              : report.mentor_analysis
                                ? "Analyze again"
                                : "Analyze incoming report"}
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                ) : (
                  <Empty
                    text={
                      role === "Faculty"
                        ? "No reports submitted yet"
                        : "No report has been analyzed yet"
                    }
                    detail={
                      role === "Faculty"
                        ? "Student submissions for this project will appear here."
                        : "Upload your report to review suggested improvements before submission."
                    }
                  />
                )}
              </Panel>
              {role === "Student" && (
                <Form
                  submit="Submit progress update"
                  onSubmit={(f) => {
                    const event = {
                      status: "Progress update · " + f.progress + "%",
                      comment:
                        "Completed: " +
                        f.completed +
                        " | Problems: " +
                        f.problems +
                        " | Help: " +
                        f.help +
                        " | Document: " +
                        (f.document?.name || "None"),
                      at: Date.now(),
                    };
                    setDb((d) => ({
                      ...d,
                      projects: d.projects.map((p) =>
                        p.id === project.id
                          ? {
                              ...p,
                              progress: +f.progress,
                              status: f.status,
                              github: f.github,
                              demo: f.demo,
                              timeline: [...p.timeline, event],
                            }
                          : p,
                      ),
                    }));
                    notify(
                      "Project ready for review",
                      project.name,
                      "Faculty",
                      "/projects",
                    );
                    toast("Progress shared with your mentor.");
                  }}
                >
                  <div className="form-grid">
                    <Field
                      label="Progress (%)"
                      name="progress"
                      type="number"
                      min="0"
                      max="100"
                      defaultValue={project.progress}
                    />
                    <Field
                      label="Status"
                      name="status"
                      options={[
                        "Planning",
                        "Research",
                        "Development",
                        "Testing",
                        "Documentation",
                        "Completed",
                      ]}
                      defaultValue={project.status}
                    />
                  </div>
                  <Field
                    label="Completed work"
                    name="completed"
                    type="textarea"
                  />
                  <Field
                    label="Problems / corrections addressed"
                    name="problems"
                    type="textarea"
                  />
                  <Field label="Help needed" name="help" required={false} />
                  <div className="form-grid">
                    <Field
                      label="GitHub URL"
                      name="github"
                      type="url"
                      required={false}
                      defaultValue={project.github}
                    />
                    <Field
                      label="Demo URL"
                      name="demo"
                      type="url"
                      required={false}
                      defaultValue={project.demo}
                    />
                  </div>
                  <Field
                    label="Screenshot / document (filename only)"
                    name="document"
                    type="file"
                    required={false}
                  />
                </Form>
              )}
              {role === "Faculty" && project.mentorStatus === "Accepted" && (
                <Form
                  submit="Publish review"
                  onSubmit={(f) => {
                    const review = { ...f, at: Date.now(), by: user.name };
                    setDb((d) => ({
                      ...d,
                      projects: d.projects.map((p) =>
                        p.id === project.id
                          ? {
                              ...p,
                              reviews: [...p.reviews, review],
                              timeline: [
                                ...p.timeline,
                                {
                                  status: "Faculty review · " + f.category,
                                  comment:
                                    "Strengths: " +
                                    f.strengths +
                                    " | Corrections: " +
                                    f.corrections +
                                    " | Recommendations: " +
                                    f.recommendations +
                                    " | Next steps: " +
                                    f.next +
                                    " | Review on " +
                                    f.date,
                                  at: Date.now(),
                                },
                              ],
                            }
                          : p,
                      ),
                    }));
                    notify(
                      "New project feedback",
                      project.name,
                      "Student",
                      "/projects",
                    );
                    toast("Review published to the team.");
                  }}
                >
                  <Field
                    label="Review category"
                    name="category"
                    options={[
                      "Architecture",
                      "Code Quality",
                      "UI/UX",
                      "Research",
                      "Documentation",
                      "Testing",
                      "Presentation",
                      "Overall",
                    ]}
                  />
                  {[
                    ["Strengths", "strengths"],
                    ["Corrections", "corrections"],
                    ["Recommendations", "recommendations"],
                    ["Next steps", "next"],
                  ].map(([l, n]) => (
                    <Field key={n} label={l} name={n} type="textarea" />
                  ))}
                  <Field label="Next review date" name="date" type="date" />
                </Form>
              )}
              <div className="inline-actions spacer">
                {project.github && (
                  <a href={project.github} target="_blank" rel="noreferrer">
                    GitHub ↗
                  </a>
                )}
                {project.demo && (
                  <a href={project.demo} target="_blank" rel="noreferrer">
                    Live demo ↗
                  </a>
                )}
              </div>
              <Timeline items={[...project.timeline].reverse()} />
            </>
          )}
        </Modal>
      )}
    </>
  );
}
