import React, { useState, useEffect } from "react";
import { Monitor, Plus, Wrench, Clock } from "lucide-react";
import { useCampus } from "../App";
import { today } from "../data/seed";
import { uid } from "../logic";
import {
  Heading,
  Panel,
  Badge,
  Modal,
  Form,
  Field,
  Empty,
  Metric,
} from "../components/ui";
export default function Labs({ issuesPage = false }) {
  const { db, setDb, user, role, toast, notify } = useCampus();
  const [seat, setSeat] = useState(null),
    [issue, setIssue] = useState(false),
    [date, setDate] = useState(today),
    [slot, setSlot] = useState("09:00–11:00"),
    [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setDb((d) => {
      if (
        !d.bookings.some(
          (b) => b.status === "Reserved" && clock >= b.created + 600000,
        )
      )
        return d;
      return {
        ...d,
        bookings: d.bookings.map((b) =>
          b.status === "Reserved" && clock >= b.created + 600000
            ? {
                ...b,
                status: "Cancelled",
                reason: "No check-in within 10 minutes",
              }
            : b,
        ),
      };
    });
  }, [clock, setDb]);
  const active = (s) =>
    db.bookings.find(
      (b) =>
        b.seat === s &&
        b.date === date &&
        b.slot === slot &&
        ["Reserved", "In Use"].includes(b.status),
    );
  const damaged = (s) =>
    db.issues.some((i) => i.seat === s && i.status !== "Resolved");
  const own = db.bookings.filter(
    (b) => role === "Admin" || b.student === user.id,
  );
  const book = (f) => {
    if (
      damaged(seat) ||
      db.bookings.some(
        (b) =>
          b.seat === seat &&
          b.date === f.date &&
          b.slot === f.slot &&
          ["Reserved", "In Use"].includes(b.status),
      )
    )
      return toast("That seat is unavailable. Try another workstation.");
    if (
      db.bookings.some(
        (b) =>
          b.student === user.id &&
          b.date === f.date &&
          b.slot === f.slot &&
          ["Reserved", "In Use"].includes(b.status),
      )
    )
      return toast("You already have a booking in this time slot.");
    const b = {
      ...f,
      id: uid("LAB"),
      seat,
      student: user.id,
      status: "Reserved",
      created: Date.now(),
    };
    setDb((d) => ({ ...d, bookings: [b, ...d.bookings] }));
    setSeat(null);
    toast("Workstation reserved. Check in within 10 minutes (demo timer).");
  };
  return (
    <>
      <Heading
        eyebrow="CAMPUS SPACES / CREATE & EXPERIMENT"
        title={issuesPage ? "Hardware support" : "Find your space to build"}
        description={
          issuesPage
            ? "Report, track, and resolve workstation issues."
            : "Computer Lab 01 · Academic Block · 24 workstations"
        }
      >
        <button
          onClick={() => {
            setSeat(null);
            setIssue(true);
          }}
        >
          <Wrench size={16} />
          Report hardware issue
        </button>
      </Heading>
      {!issuesPage && (
        <>
          <div className="metrics">
            <Metric
              label="Available"
              value={
                24 -
                Array.from({ length: 24 }, (_, i) => i + 1).filter(
                  (s) => damaged(s) || active(s),
                ).length
              }
              icon={Monitor}
            />
            <Metric
              label="Your reservations"
              value={own.filter((b) => b.status === "Reserved").length}
              icon={Clock}
            />
            <Metric
              label="In use"
              value={db.bookings.filter((b) => b.status === "In Use").length}
              icon={Monitor}
            />
            <Metric
              label="Under maintenance"
              value={
                new Set(
                  db.issues
                    .filter((i) => i.status !== "Resolved")
                    .map((i) => i.seat),
                ).size
              }
              icon={Wrench}
            />
          </div>
          <Panel
            title="Choose a workstation"
            subtitle="Select a seat to book a two-hour session"
          >
            <div className="toolbar">
              <Field
                label="Date"
                type="date"
                value={date}
                min={today}
                onChange={(e) => setDate(e.target.value)}
              />
              <Field
                label="Time slot"
                options={[
                  "09:00–11:00",
                  "11:00–13:00",
                  "14:00–16:00",
                  "16:00–18:00",
                ]}
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
              />
            </div>
            <div className="seat-legend">
              <span>● Available</span>
              <span>● Reserved</span>
              <span>● In use</span>
              <span>● Maintenance</span>
            </div>
            <div className="exam-front">TEACHING DESK / DISPLAY</div>
            <div className="lab-grid">
              {Array.from({ length: 24 }, (_, i) => {
                const n = i + 1;
                const status = damaged(n)
                  ? "Maintenance"
                  : active(n)?.status || "Available";
                return (
                  <button
                    key={n}
                    className={
                      "workstation " + status.replace(" ", "-").toLowerCase()
                    }
                    aria-label={"Workstation " + n + " " + status}
                    onClick={() => setSeat(n)}
                  >
                    <Monitor size={29} />
                    <b>WS-{String(n).padStart(2, "0")}</b>
                    <small>{status}</small>
                  </button>
                );
              })}
            </div>
          </Panel>
          <Panel title="Your bookings" className="spacer">
            {own.map((b) => (
              <div className="list-row" key={b.id}>
                <span className="icon-chip blue">
                  <Monitor />
                </span>
                <div>
                  <h3>Workstation {b.seat}</h3>
                  <small>
                    {b.date} · {b.slot} · {b.id}
                  </small>
                  <small>{b.reason}</small>
                </div>
                <Badge>{b.status}</Badge>
                <div className="inline-actions">
                  {b.status === "Reserved" && (
                    <>
                      <button
                        className="primary"
                        onClick={() => {
                          if (Date.now() > b.created + 600000)
                            return setClock(Date.now());
                          setDb((d) => ({
                            ...d,
                            bookings: d.bookings.map((x) =>
                              x.id === b.id ? { ...x, status: "In Use" } : x,
                            ),
                          }));
                          toast("Simulated QR check-in complete.");
                        }}
                      >
                        QR check-in
                      </button>
                      <button
                        onClick={() =>
                          setDb((d) => ({
                            ...d,
                            bookings: d.bookings.map((x) =>
                              x.id === b.id
                                ? {
                                    ...x,
                                    status: "Cancelled",
                                    reason: "Cancelled by student",
                                  }
                                : x,
                            ),
                          }))
                        }
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          setDb((d) => ({
                            ...d,
                            bookings: d.bookings.map((x) =>
                              x.id === b.id
                                ? { ...x, created: Date.now() - 610000 }
                                : x,
                            ),
                          }));
                          setClock(Date.now());
                        }}
                      >
                        Simulate 10m timeout
                      </button>
                    </>
                  )}
                  {b.status === "In Use" && (
                    <button
                      onClick={() => {
                        setDb((d) => ({
                          ...d,
                          bookings: d.bookings.map((x) =>
                            x.id === b.id ? { ...x, status: "Completed" } : x,
                          ),
                        }));
                        toast("Session ended. Workstation is now available.");
                      }}
                    >
                      End session
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!own.length && (
              <Empty
                text="Make room for your next idea"
                detail="Pick a green workstation to reserve your spot."
              />
            )}
          </Panel>
        </>
      )}
      <Panel
        title="Technician alert list"
        subtitle="Reported workstations are unavailable until resolved."
        className="spacer"
      >
        {db.issues.map((i) => (
          <div className="list-row" key={i.id}>
            <span className="icon-chip orange">
              <Wrench />
            </span>
            <div>
              <h3>
                WS-{i.seat} · {i.category}
              </h3>
              <p>{i.description}</p>
              <small>
                {i.id} · {i.photo || "No photo"}
              </small>
            </div>
            <Badge>{i.status}</Badge>
            {role === "Admin" && i.status !== "Resolved" && (
              <button
                onClick={() => {
                  setDb((d) => ({
                    ...d,
                    issues: d.issues.map((x) =>
                      x.id === i.id ? { ...x, status: "Resolved" } : x,
                    ),
                  }));
                  toast("Issue resolved. Workstation is available again.");
                }}
              >
                Resolve
              </button>
            )}
          </div>
        ))}
      </Panel>
      {seat && !issue && (
        <Modal title={"Workstation " + seat} onClose={() => setSeat(null)}>
          {damaged(seat) || active(seat) ? (
            <div className="notice">
              {damaged(seat)
                ? "This workstation is under maintenance."
                : `This workstation is ${active(seat).status.toLowerCase()} for the selected date and slot.`}
            </div>
          ) : (
            <Form onSubmit={book} submit="Reserve workstation">
              <Field
                name="date"
                label="Date"
                type="date"
                min={today}
                defaultValue={date}
              />
              <Field
                name="slot"
                label="Two-hour slot"
                options={[
                  "09:00–11:00",
                  "11:00–13:00",
                  "14:00–16:00",
                  "16:00–18:00",
                ]}
                defaultValue={slot}
              />
              <p>
                For this demo, your 10-minute check-in timer starts immediately
                after reserving.
              </p>
            </Form>
          )}
          <button className="spacer" onClick={() => setIssue(true)}>
            Report an issue with this seat
          </button>
        </Modal>
      )}
      {issue && (
        <Modal
          title="Report hardware issue"
          onClose={() => {
            setIssue(false);
            setSeat(null);
          }}
        >
          <Form
            submit="Submit issue"
            onSubmit={(f) => {
              const id = uid("HW");
              setDb((d) => ({
                ...d,
                issues: [
                  {
                    ...f,
                    seat: +f.seat,
                    photo: f.photo?.name || "",
                    id,
                    status: "Open",
                    created: Date.now(),
                  },
                  ...d.issues,
                ],
                bookings: d.bookings.map((b) =>
                  b.seat === +f.seat &&
                  ["Reserved", "In Use"].includes(b.status)
                    ? {
                        ...b,
                        status: "Cancelled",
                        reason: "Hardware issue reported",
                      }
                    : b,
                ),
              }));
              notify(
                "Hardware support needed",
                "Workstation " + f.seat,
                "Admin",
                "/issues",
              );
              setIssue(false);
              setSeat(null);
              toast(
                "Technician notified. Workstation marked under maintenance.",
              );
            }}
          >
            <Field
              label="Workstation number"
              name="seat"
              type="number"
              min="1"
              max="24"
              defaultValue={seat || 1}
            />
            <Field
              label="Issue category"
              name="category"
              options={[
                "Mouse/Keyboard",
                "Display",
                "Boot Failure",
                "Component Damage",
                "Network",
              ]}
            />
            <Field
              label="Describe the issue"
              name="description"
              type="textarea"
            />
            <Field
              label="Photo (filename only)"
              name="photo"
              type="file"
              accept="image/*"
              required={false}
            />
          </Form>
        </Modal>
      )}
    </>
  );
}
