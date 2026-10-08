import Papa from "papaparse";
export const uid = (prefix) =>
  prefix +
  "-" +
  Date.now().toString(36).toUpperCase() +
  "-" +
  Math.random().toString(36).slice(2, 5).toUpperCase();
export const risk = (s) =>
  s.attendance < 75 ? "At Risk" : s.cgpa < 7.5 ? "Watch" : "On Track";
export function csvDownload(name, rows) {
  const text = Papa.unparse(
    rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k,
          typeof v === "string" && /^[=+@\-\t\r]/.test(v) ? "'" + v : v,
        ]),
      ),
    ),
  );
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name + ".csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function validateRoster(text) {
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
  });
  const required = [
    "Register Number",
    "Student Name",
    "Department",
    "Year",
    "Section",
    "Subject Code",
    "Subject Name",
  ];
  const missing = required.filter((k) => !parsed.meta.fields?.includes(k));
  const seen = new Set();
  const errors = [
    ...parsed.errors.map((e) => e.message),
    ...missing.map((k) => "Missing column: " + k),
  ];
  parsed.data.forEach((s, i) => {
    required.forEach((k) => {
      if (!String(s[k] || "").trim())
        errors.push("Row " + (i + 2) + ": missing " + k);
    });
    if (seen.has(s["Register Number"]))
      errors.push("Duplicate register number: " + s["Register Number"]);
    seen.add(s["Register Number"]);
  });
  if (!parsed.data.length) errors.push("The roster is empty.");
  return { rows: parsed.data, errors };
}
export function arrange(students, rooms, rotation = 0) {
  if (!students.length) throw Error("Upload or load a student roster first.");
  if (
    !rooms.length ||
    rooms.some(
      (r) =>
        !r.name.trim() ||
        ![r.rows, r.cols, r.seats].every(
          (x) => Number.isInteger(+x) && +x > 0 && +x <= 50,
        ),
    )
  )
    throw Error(
      "Enter a room name and valid positive dimensions (maximum 50 each).",
    );
  if (new Set(rooms.map((r) => r.name)).size !== rooms.length)
    throw Error("Room names must be unique.");
  if (
    rooms.reduce((n, r) => n + r.rows * r.cols * r.seats, 0) < students.length
  )
    throw Error("Not enough seats. Add rooms or increase room capacity.");
  const groups = {};
  students.forEach((s) => (groups[s.Department] ??= []).push({ ...s }));
  let depts = Object.keys(groups);
  depts = depts
    .slice(rotation % depts.length)
    .concat(depts.slice(0, rotation % depts.length));
  const result = [];
  let conflicts = 0;
  rooms.forEach((room) => {
    let previous = "";
    for (let row = 1; row <= room.rows; row++) {
      previous = "";
      for (let col = 1; col <= room.cols * room.seats; col++) {
        const above = result.find(
          (s) => s.room === room.name && s.row === row - 1 && s.col === col,
        );
        const available = depts.filter((d) => groups[d].length);
        const best =
          available
            .filter((d) => d !== previous && d !== above?.Department)
            .sort((a, b) => groups[b].length - groups[a].length)[0] ||
          available.filter((d) => d !== previous)[0] ||
          available[0];
        if (!best) continue;
        const student = groups[best].shift();
        if (best === previous || best === above?.Department) conflicts++;
        result.push({
          ...student,
          room: room.name,
          building: room.building,
          row,
          col,
          seat: room.name + "-" + row + "-" + col,
        });
        previous = best;
      }
    }
  });
  return { seats: result, conflicts };
}
export function copilotAnswer(prompt, students) {
  const p = prompt.toLowerCase();
  let list;
  if (/risk|attendance|absen/.test(p)) {
    list = students.filter((s) => s.attendance < 75);
    return (
      list.length +
      " students have attendance below 75%: " +
      list
        .map((s) => s.name + " (" + s.attendance + "%, CGPA " + s.cgpa + ")")
        .join("; ") +
      ". Schedule an advisor check-in and review missed classes. Source: student attendance records."
    );
  }
  if (/top|perform|cgpa|academic/.test(p)) {
    list = [...students].sort((a, b) => b.cgpa - a.cgpa).slice(0, 3);
    return (
      "Top academic performers: " +
      list
        .map(
          (s) =>
            s.name + " — " + s.cgpa + " CGPA, " + s.attendance + "% attendance",
        )
        .join("; ") +
      ". Source: semester academic records."
    );
  }
  if (/skill|python|react/.test(p))
    return (
      "All " +
      students.length +
      " demo students list React, Python and Communication. Skill levels are illustrative; arrange a practical assessment before assigning training. Source: student skills profiles."
    );
  list = students.filter((s) =>
    (s.name + " " + s.dept).toLowerCase().includes(p),
  );
  return list.length
    ? list
        .map(
          (s) =>
            s.name +
            ": " +
            s.dept +
            ", CGPA " +
            s.cgpa +
            ", attendance " +
            s.attendance +
            "%.",
        )
        .join(" ")
    : "I can check attendance risk, top academic performers, skills, or a student name/department. This is a local, rule-based demo using " +
        students.length +
        " student records.";
}
