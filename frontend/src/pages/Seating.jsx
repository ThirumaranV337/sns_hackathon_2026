import React, { useState } from "react";
import {
  Plus,
  Upload,
  Download,
  Printer,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCampus } from "../App";
import { examStudents, dateIn } from "../data/seed";
import { arrange, validateRoster, csvDownload, uid } from "../logic";
import { Heading, Panel, Badge, Field, Modal, Empty } from "../components/ui";
export default function Seating() {
  const { db, setDb, toast, user } = useCampus();
  const [rooms, setRooms] = useState([
    { name: "A-101", building: "Academic Block", rows: 5, cols: 4, seats: 2 },
    { name: "A-102", building: "Academic Block", rows: 5, cols: 4, seats: 2 },
    { name: "B-201", building: "Science Block", rows: 5, cols: 4, seats: 2 },
  ]);
  const [roster, setRoster] = useState([]),
    [report, setReport] = useState(null),
    [result, setResult] = useState(null),
    [seat, setSeat] = useState(null),
    [rotation, setRotation] = useState(0),
    [meta, setMeta] = useState({
      name: "End Semester Examination",
      date: dateIn(14),
      session: "Forenoon",
      academicYear: "2026–27",
      year: "3",
      semester: "5",
      section: "All",
      departments: "CSE, ECE, MECH",
      mode: "Alternate departments",
    });
  const [selectedRoom, setSelectedRoom] = useState("A-101");
  async function upload(file) {
    if (!file) return;
    if (file.size > 5000000) return toast("Choose a CSV smaller than 5 MB.");
    const parsed = validateRoster(await file.text());
    setReport({ ...parsed, name: file.name, size: file.size });
    setRoster(parsed.errors.length ? [] : parsed.rows);
    setResult(null);
  }
  function generate() {
    if (!meta.name.trim() || !meta.date)
      return toast("Enter the exam name and date.");
    if (report?.errors.length)
      return toast("Resolve CSV validation errors before generating.");
    try {
      const generated = arrange(roster, rooms, rotation);
      const exam = {
        ...meta,
        id: uid("EXAM"),
        rooms: structuredClone(rooms),
        ...generated,
        students: roster.length,
        generatedBy: user.name,
        at: Date.now(),
        status: "Generated",
      };
      setResult(exam);
      setSelectedRoom(rooms[0].name);
      setRotation(rotation + 1);
      setDb((d) => ({ ...d, exams: [exam, ...d.exams].slice(0, 20) }));
      toast(
        generated.conflicts
          ? "Generated with " +
              generated.conflicts +
              " adjacency warnings. Review highlighted seats."
          : "Seating generated with no department adjacency conflicts.",
      );
    } catch (e) {
      toast(e.message);
    }
  }
  const displayedRoom = (result?.rooms || rooms).find(
    (r) => r.name === selectedRoom,
  );
  const updateRoom = (i, k, v) => {
    setRooms((rs) => rs.map((r, j) => (i === j ? { ...r, [k]: v } : r)));
    setResult(null);
  };
  return (
    <>
      <Heading
        eyebrow="EXAMINATION / PLANNING"
        title="Exam seating generator"
        description="From a student roster to a room-by-room plan, in minutes."
      >
        <button
          onClick={() =>
            csvDownload("exam-roster-template", examStudents.slice(0, 3))
          }
        >
          <Download size={16} />
          CSV template
        </button>
      </Heading>
      <div className="two-col">
        <Panel title="01 · Examination details">
          <div className="form-grid">
            {[
              ["Exam name", "name"],
              ["Exam date", "date"],
              ["Academic year", "academicYear"],
              ["Exam year", "year"],
              ["Semester", "semester"],
              ["Section", "section"],
              ["Departments", "departments"],
            ].map(([label, key]) => (
              <Field
                key={key}
                label={label}
                value={meta[key]}
                type={key === "date" ? "date" : "text"}
                onChange={(e) => setMeta({ ...meta, [key]: e.target.value })}
              />
            ))}
            <Field
              label="Session"
              options={["Forenoon", "Afternoon"]}
              value={meta.session}
              onChange={(e) => setMeta({ ...meta, session: e.target.value })}
            />
          </div>
          <p>
            Allocation mode: alternate departments. Rosters determine the actual
            students and departments.
          </p>
        </Panel>
        <Panel
          title="02 · Student roster"
          action={
            <button
              onClick={() => {
                setRoster(examStudents);
                setReport({
                  name: "Demo roster · 120 students",
                  size: 0,
                  errors: [],
                  rows: examStudents,
                });
                setResult(null);
              }}
            >
              Use demo roster
            </button>
          }
        >
          <label
            className="upload-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              upload(e.dataTransfer.files[0]);
            }}
          >
            <Upload size={32} />
            <b>Drop your CSV here</b>
            <span>or click to browse · up to 5 MB</span>
            <input
              type="file"
              accept=".csv,text/csv"
              aria-label="Upload student CSV"
              onChange={(e) => upload(e.target.files[0])}
            />
          </label>
          {report && (
            <>
              <div className="notice spacer">
                <b>{report.name}</b>
                <br />
                {report.rows.length} records · {(report.size / 1024).toFixed(1)}{" "}
                KB · {report.errors.length} validation errors
              </div>
              {report.errors.length ? (
                <div className="notice error">
                  {report.errors.slice(0, 12).map((e, i) => (
                    <div key={i}>{e}</div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="inline-actions">
                    {Object.entries(
                      roster.reduce(
                        (a, s) => (
                          (a[s.Department] = (a[s.Department] || 0) + 1),
                          a
                        ),
                        {},
                      ),
                    ).map(([d, n]) => (
                      <Badge key={d}>{d + " · " + n}</Badge>
                    ))}
                  </div>
                  <div className="table-wrap">
                    <table>
                      <tbody>
                        {roster.slice(0, 4).map((s) => (
                          <tr key={s["Register Number"]}>
                            <td>{s["Register Number"]}</td>
                            <td>{s["Student Name"]}</td>
                            <td>{s.Department}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </Panel>
        <Panel
          title="03 · Room builder"
          className="wide"
          action={
            <button
              onClick={() => {
                setRooms([
                  ...rooms,
                  {
                    name: "R-" + (rooms.length + 1),
                    building: "Academic Block",
                    rows: 5,
                    cols: 4,
                    seats: 2,
                  },
                ]);
                setResult(null);
              }}
            >
              <Plus size={15} />
              Add room
            </button>
          }
        >
          <div className="table-wrap">
            <table className="room-table">
              <thead>
                <tr>
                  <th>ROOM</th>
                  <th>BUILDING</th>
                  <th>ROWS</th>
                  <th>TABLES / ROW</th>
                  <th>SEATS / TABLE</th>
                  <th>CAPACITY</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rooms.map((r, i) => (
                  <tr key={i}>
                    {["name", "building", "rows", "cols", "seats"].map((k) => (
                      <td key={k}>
                        <input
                          aria-label={"Room " + (i + 1) + " " + k}
                          type={
                            ["rows", "cols", "seats"].includes(k)
                              ? "number"
                              : "text"
                          }
                          min="1"
                          max="50"
                          value={r[k]}
                          onChange={(e) =>
                            updateRoom(
                              i,
                              k,
                              ["rows", "cols", "seats"].includes(k)
                                ? Number(e.target.value)
                                : e.target.value,
                            )
                          }
                        />
                      </td>
                    ))}
                    <td>
                      <b>{r.rows * r.cols * r.seats}</b>
                      <small>{r.rows * r.cols} tables</small>
                    </td>
                    <td>
                      <button
                        aria-label={"Remove room " + r.name}
                        onClick={() => {
                          setRooms(rooms.filter((_, j) => i !== j));
                          setResult(null);
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="split spacer">
            <p>
              {roster.length} students ·{" "}
              {rooms.reduce((a, r) => a + r.rows * r.cols * r.seats, 0)} total
              seats
            </p>
            <div className="inline-actions">
              <button
                onClick={() => {
                  setResult(null);
                  setRoster([]);
                  setReport(null);
                }}
              >
                Clear
              </button>
              <button className="primary" onClick={generate}>
                <RefreshCw size={16} />
                {result ? "Regenerate" : "Generate seating"}
              </button>
            </div>
          </div>
        </Panel>
      </div>
      {result && (
        <Panel
          title={result.name + " · Seating plan"}
          subtitle={
            result.students +
            " students · " +
            result.rooms.length +
            " rooms · " +
            (result.rooms.reduce((a, r) => a + r.rows * r.cols * r.seats, 0) -
              result.students) +
            " empty seats · " +
            result.conflicts +
            " adjacency warnings"
          }
          className="spacer"
          action={
            <div className="inline-actions">
              <button onClick={() => csvDownload(result.name, result.seats)}>
                <Download size={15} />
                Export CSV
              </button>
              <button onClick={() => window.print()}>
                <Printer size={15} />
                Print / PDF
              </button>
            </div>
          }
        >
          <div className="tabs">
            {result.rooms.map((r) => (
              <button
                className={r.name === selectedRoom ? "active" : ""}
                onClick={() => setSelectedRoom(r.name)}
                key={r.name}
              >
                {r.name} ·{" "}
                {result.seats.filter((s) => s.room === r.name).length}/
                {r.rows * r.cols * r.seats}
              </button>
            ))}
          </div>
          <div className="exam-front">FRONT OF ROOM · INVIGILATOR</div>
          {displayedRoom && (
            <div className="seat-scroll">
              <div
                className="exam-grid"
                style={{
                  gridTemplateColumns: `repeat(${displayedRoom.cols * displayedRoom.seats}, minmax(70px, 1fr))`,
                }}
              >
                {Array.from(
                  {
                    length:
                      displayedRoom.rows *
                      displayedRoom.cols *
                      displayedRoom.seats,
                  },
                  (_, i) => {
                    const row =
                        Math.floor(
                          i / (displayedRoom.cols * displayedRoom.seats),
                        ) + 1,
                      col =
                        (i % (displayedRoom.cols * displayedRoom.seats)) + 1;
                    const s = result.seats.find(
                      (s) =>
                        s.room === selectedRoom &&
                        s.row === row &&
                        s.col === col,
                    );
                    return (
                      <button
                        key={i}
                        className={
                          "seat " +
                          (s
                            ? "dept-" +
                              (["CSE", "ECE", "MECH"].indexOf(s.Department) + 1)
                            : "empty-seat")
                        }
                        disabled={!s}
                        onClick={() => setSeat(s)}
                      >
                        <b>{s?.Department || "Empty"}</b>
                        <small>
                          {s ? s["Register Number"] : row + "-" + col}
                        </small>
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          )}
          <p className="spacer">
            Click an occupied seat to view its student. Regenerate rotates
            department priority; adjust room dimensions above to edit the plan.
          </p>
        </Panel>
      )}
      <Panel title="Seating history" className="spacer">
        {db.exams.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>EXAM</th>
                  <th>STUDENTS / ROOMS</th>
                  <th>GENERATED BY</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {db.exams.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <b>{e.name}</b>
                      <small>
                        {e.date} · {e.session}
                      </small>
                    </td>
                    <td>
                      {e.students} / {e.rooms.length}
                    </td>
                    <td>
                      {e.generatedBy}
                      <small>{new Date(e.at).toLocaleString()}</small>
                    </td>
                    <td>
                      <div className="inline-actions">
                        <button
                          onClick={() => {
                            setResult(e);
                            setSelectedRoom(e.rooms[0].name);
                          }}
                        >
                          View
                        </button>
                        <button onClick={() => csvDownload(e.name, e.seats)}>
                          Export
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="Ready for your first plan" />
        )}
      </Panel>
      {seat && (
        <Modal title={"Seat " + seat.seat} onClose={() => setSeat(null)}>
          <div className="detail-grid">
            {Object.entries(seat).map(([k, v]) => (
              <div key={k}>
                <small>{k}</small>
                <b>{v}</b>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
