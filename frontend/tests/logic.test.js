import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { arrange, validateRoster, copilotAnswer, risk } from "../src/logic.js";
import { examStudents, students } from "../src/data/seed.js";
import Papa from "papaparse";
const rooms = [
  { name: "A", building: "Main", rows: 5, cols: 4, seats: 2 },
  { name: "B", building: "Main", rows: 5, cols: 4, seats: 2 },
  { name: "C", building: "Main", rows: 5, cols: 4, seats: 2 },
];
test("120 students occupy unique seats with no lost or duplicated records", () => {
  const r = arrange(examStudents, rooms);
  assert.equal(r.seats.length, 120);
  assert.equal(new Set(r.seats.map((s) => s.seat)).size, 120);
  assert.equal(new Set(r.seats.map((s) => s["Register Number"])).size, 120);
  assert.equal(r.conflicts, 0);
});
test("insufficient capacity rejects generation without changing inputs", () => {
  const before = JSON.stringify(examStudents);
  assert.throws(
    () => arrange(examStudents, rooms.slice(0, 1)),
    /Not enough seats/,
  );
  assert.equal(JSON.stringify(examStudents), before);
});
test("single-department roster reports unavoidable adjacency", () => {
  const r = arrange(
    examStudents.slice(0, 10).map((s) => ({ ...s, Department: "CSE" })),
    rooms,
  );
  assert.ok(r.conflicts > 0);
});
test("CSV accepts BOM and quoted comma fields", () => {
  const csv =
    "\uFEFF" +
    Papa.unparse(
      examStudents
        .slice(0, 2)
        .map((s) => ({ ...s, "Student Name": "Sharma, Aarav" })),
    );
  const r = validateRoster(csv);
  assert.deepEqual(r.errors, []);
  assert.equal(r.rows[0]["Student Name"], "Sharma, Aarav");
});
test("downloadable demo CSV validates and generates a complete seating plan", () => {
  const csv = readFileSync(
    new URL("../public/demo-exam-roster.csv", import.meta.url),
    "utf8",
  );
  const parsed = validateRoster(csv);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.rows.length, 120);
  assert.equal(
    new Set(parsed.rows.map((student) => student["Register Number"])).size,
    120,
  );

  const result = arrange(parsed.rows, rooms);
  assert.equal(result.seats.length, 120);
  assert.equal(result.conflicts, 0);
});
test("CSV catches duplicate IDs and missing fields", () => {
  const r = validateRoster(
    Papa.unparse([examStudents[0], { ...examStudents[0], Department: "" }]),
  );
  assert.ok(r.errors.some((e) => e.includes("Duplicate")));
  assert.ok(r.errors.some((e) => e.includes("Department")));
  assert.ok(validateRoster("").errors.length);
});
test("room validation rejects zero dimensions and duplicate names", () => {
  assert.throws(
    () => arrange(examStudents, [{ ...rooms[0], rows: 0 }]),
    /valid positive/,
  );
  assert.throws(() => arrange(examStudents, [rooms[0], rooms[0]]), /unique/);
});
test("copilot cites real attendance values and risk threshold", () => {
  assert.equal(risk(students[1]), "At Risk");
  const answer = copilotAnswer("attendance risk", students);
  assert.ok(answer.includes("Diya Nair (72%"));
  assert.ok(!answer.includes("Aarav Sharma"));
});
