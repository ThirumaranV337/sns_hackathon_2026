import React, { useState } from "react";
import { Plus, Download, Clock, FileText, Sparkles } from "lucide-react";
import { useCampus } from "../App";
import { students, today } from "../data/seed";
import { uid, csvDownload } from "../logic";
import { rewriteRequestDescription } from "../api";
import {
  Heading,
  Panel,
  Badge,
  Modal,
  Field,
  Form,
  Timeline,
  Empty,
  Avatar,
} from "../components/ui";
export default function Requests({ erp = false }) {
  const { db, setDb, role, user, toast, notify } = useCampus();
  const [form, setForm] = useState(false),
    [selected, setSelected] = useState(null),
    [action, setAction] = useState(null),
    [q, setQ] = useState(""),
    [filter, setFilter] = useState("All"),
    [description, setDescription] = useState(""),
    [isRewritingDescription, setIsRewritingDescription] = useState(false);
  const visible = db.requests.filter(
    (r) =>
      (erp
        ? r.status === "Approved & Synced"
        : role === "Student"
          ? r.student === user.id
          : role === "Admin"
            ? ["HOD Review", "Approved & Synced", "Rejected"].includes(r.status)
            : true) &&
      (filter === "All" || r.status === filter) &&
      (r.title + " " + r.id + " " + r.name)
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const current = db.requests.find((r) => r.id === selected);
  const rewriteDescription = async () => {
    const currentDescription = description.trim();
    if (!currentDescription || isRewritingDescription) return;

    setIsRewritingDescription(true);
    try {
      const result = await rewriteRequestDescription(currentDescription);
      setDescription(result.description);
      toast("Description improved. Review it before submitting.");
    } catch (error) {
      toast(`Could not improve description: ${error.message}`);
    } finally {
      setIsRewritingDescription(false);
    }
  };
  const create = (f) => {
    if (f.to < f.from)
      return toast("End date must be on or after the start date.");
    const id = uid("OD-2026");
    const r = {
      ...f,
      proof: f.proof?.name || "",
      id,
      student: user.id,
      name: user.name,
      roll: user.roll,
      dept: user.dept,
      status: "Advisor Review",
      created: Date.now(),
      timeline: [
        {
          status: "Submitted",
          comment: "Sent to your class advisor for review.",
          at: Date.now(),
        },
      ],
    };
    setDb((d) => ({ ...d, requests: [r, ...d.requests] }));
    notify(
      "New OD request",
      user.name + " · " + f.title,
      "Faculty",
      "/requests",
    );
    setForm(false);
    setSelected(id);
    toast("Request submitted · " + id);
  };
  const decide = (f) => {
    const status =
      action === "Approve"
        ? role === "Faculty"
          ? "HOD Review"
          : "Approved & Synced"
        : action === "Reject"
          ? "Rejected"
          : "Revision Requested";
    setDb((d) => ({
      ...d,
      requests: d.requests.map((r) =>
        r.id === selected
          ? {
              ...r,
              status,
              timeline: [
                ...r.timeline,
                {
                  status,
                  comment: f.comment + " — " + user.name,
                  at: Date.now(),
                },
              ],
            }
          : r,
      ),
    }));
    notify(
      current.id + " · " + status,
      f.comment,
      status === "HOD Review" ? "Admin" : "Student",
      "/requests",
    );
    toast(
      "Decision saved. " +
        (status === "HOD Review"
          ? "Sent to HOD for final sign-off."
          : status === "Approved & Synced"
            ? "Added to the simulated ERP export."
            : "Student has been notified."),
    );
    setAction(null);
  };
  const exportRows = () =>
    csvDownload(
      "campusflow-erp",
      visible.map((r) => ({
        RollNo: r.roll,
        Name: r.name,
        Dept: r.dept,
        FromDate: r.from,
        ToDate: r.to,
        Type: r.category,
        Status: r.status,
      })),
    );
  return (
    <>
      <Heading
        eyebrow={erp ? "OPERATIONS / EXPORTS" : "ACADEMICS / APPROVALS"}
        title={
          erp
            ? "ERP sync & export"
            : role === "Student"
              ? "OD & leave requests"
              : "Approval management"
        }
        description={
          erp
            ? "Final approvals, ready for your college records. Sync is simulated."
            : "A clear path from your next opportunity to a confirmed approval."
        }
      >
        {erp ? (
          <button
            className="primary"
            disabled={!visible.length}
            onClick={exportRows}
          >
            <Download size={17} />
            Download CSV
          </button>
        ) : (
          role === "Student" && (
              <button
                className="primary"
                onClick={() => {
                  setDescription("");
                  setForm(true);
                }}
              >
              <Plus size={17} />
              Apply OD / leave
            </button>
          )
        )}
      </Heading>
      <div className="notice">
        {role === "Student"
          ? "Your request goes to your class advisor, then your HOD. Follow each decision and comment here."
          : role === "Faculty"
            ? "Review student context and supporting evidence. Approved requests move to the HOD queue."
            : "Only advisor-approved requests reach final sign-off. Final approvals are added to the ERP export."}
      </div>
      <Panel
        title={erp ? "Approved records" : "Request queue"}
        subtitle={visible.length + " records"}
      >
        <div className="toolbar">
          <input
            className="filter-input"
            aria-label="Search requests"
            placeholder="Search name, event or tracking ID..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            aria-label="Filter request status"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {[
              "All",
              "Advisor Review",
              "HOD Review",
              "Approved & Synced",
              "Rejected",
              "Revision Requested",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>REQUEST / STUDENT</th>
                <th>EVENT</th>
                <th>DATES</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td>
                    <b>{r.id}</b>
                    <small>
                      {r.name} · {r.dept}
                    </small>
                  </td>
                  <td>
                    <b>{r.title}</b>
                    <small>{r.category}</small>
                    {new Date(r.from) - Date.now() < 172800000 &&
                      new Date(r.to) >= new Date(today) && (
                        <Badge>Urgent · within 48h</Badge>
                      )}
                  </td>
                  <td>
                    {r.from}
                    <small>to {r.to}</small>
                  </td>
                  <td>
                    <Badge>{r.status}</Badge>
                  </td>
                  <td>
                    <button onClick={() => setSelected(r.id)}>
                      View details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && (
          <Empty
            text="No requests to show"
            detail="Try another filter, or create your first request."
          />
        )}
      </Panel>
      {form && (
        <Modal title="Apply OD / leave" onClose={() => setForm(false)}>
          <Form onSubmit={create} submit="Submit request">
            <Field label="Event / reason" name="title" />
            <Field
              label="Category"
              name="category"
              options={[
                "Symposium",
                "Hackathon",
                "Placement Drive",
                "Sports",
                "Medical",
                "Personal",
              ]}
            />
            <div className="form-grid">
              <Field label="From date" name="from" type="date" min={today} />
              <Field label="To date" name="to" type="date" min={today} />
            </div>
            <Field
              label="Description"
              name="description"
              type="textarea"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <button
              type="button"
              className="ai-description-button"
              disabled={!description.trim() || isRewritingDescription}
              onClick={rewriteDescription}
            >
              <Sparkles size={15} />
              {isRewritingDescription
                ? "Improving description..."
                : "Improve description with AI"}
            </button>
            <Field
              label="Supporting proof (filename saved only)"
              name="proof"
              type="file"
              required={false}
            />
          </Form>
        </Modal>
      )}
      {current && (
        <Modal
          title={current.id}
          onClose={() => {
            setSelected(null);
            setAction(null);
          }}
        >
          <div className="split">
            <h3>{current.title}</h3>
            <Badge>{current.status}</Badge>
          </div>
          <div className="list-row">
            <Avatar name={current.name} />
            <div>
              <b>{current.name}</b>
              <small>
                {current.roll} · {current.dept}
              </small>
            </div>
            <div>
              <b>
                {students.find((s) => s.id === current.student)?.attendance}%
                attendance
              </b>
              <small>
                CGPA {students.find((s) => s.id === current.student)?.cgpa}
              </small>
            </div>
          </div>
          <div className="detail-grid">
            <div>
              <small>Dates</small>
              <b>
                {current.from} — {current.to}
              </b>
            </div>
            <div>
              <small>Supporting document</small>
              <b>{current.proof || "No file attached"}</b>
            </div>
          </div>
          <p>{current.description}</p>
          <div className="notice spacer">
            Next:{" "}
            {current.status === "Advisor Review"
              ? "Your class advisor will review this request."
              : current.status === "HOD Review"
                ? "HOD final sign-off."
                : current.status === "Revision Requested"
                  ? "Student adds a correction and resubmits."
                  : current.status === "Approved & Synced"
                    ? "Complete — included in the simulated ERP records."
                    : "The request is closed."}
          </div>
          <Timeline items={current.timeline} />
          {((role === "Faculty" && current.status === "Advisor Review") ||
            (role === "Admin" && current.status === "HOD Review")) && (
            <div className="inline-actions spacer">
              {["Approve", "Reject", "Request Revision"].map((a) => (
                <button
                  className={a === "Approve" ? "primary" : ""}
                  key={a}
                  onClick={() => setAction(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          )}
          {action && (
            <div className="spacer">
              <Form onSubmit={decide} submit={action}>
                <Field
                  name="comment"
                  label={action + " · comment / reason"}
                  type="textarea"
                />
              </Form>
            </div>
          )}
          {role === "Student" && current.status === "Revision Requested" && (
            <Form
              submit="Resubmit to advisor"
              onSubmit={(f) => {
                setDb((d) => ({
                  ...d,
                  requests: d.requests.map((r) =>
                    r.id === selected
                      ? {
                          ...r,
                          description: f.description,
                          status: "Advisor Review",
                          timeline: [
                            ...r.timeline,
                            {
                              status: "Resubmitted",
                              comment: f.description,
                              at: Date.now(),
                            },
                          ],
                        }
                      : r,
                  ),
                }));
                toast("Revision sent to advisor.");
              }}
            >
              <Field
                label="Updated description / response"
                name="description"
                type="textarea"
                defaultValue={current.description}
              />
            </Form>
          )}
        </Modal>
      )}
    </>
  );
}
