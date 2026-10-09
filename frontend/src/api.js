const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

async function request(path, options = {}) {
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message = body.detail || message;
    } catch {
      // Keep the HTTP status message when the response is not JSON.
    }
    throw new Error(message);
  }

  return response.json();
}

export function getComplaints() {
  return request("/api/complaints");
}

export function submitComplaint(complaint) {
  return request("/api/complaints", {
    method: "POST",
    body: JSON.stringify(complaint),
  });
}

export function sendComplaintChat(message, history) {
  return request("/api/complaints/chat", {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
}

export function escalateComplaint(complaintId) {
  return request(`/api/complaints/${encodeURIComponent(complaintId)}/escalate`, {
    method: "POST",
  });
}

export function markComplaintSolved(complaintId) {
  return request(`/api/complaints/${encodeURIComponent(complaintId)}`, {
    method: "DELETE",
  });
}

export function rewriteRequestDescription(description) {
  return request("/api/requests/rewrite-description", {
    method: "POST",
    body: JSON.stringify({ description }),
  });
}

export function reviewOdLeaveRequest(leaveRequest, facultyId) {
  return request("/api/requests/ai-review", {
    method: "POST",
    body: JSON.stringify({
      request_id: leaveRequest.id,
      student_id: leaveRequest.student,
      faculty_id: facultyId,
      title: leaveRequest.title,
      category: leaveRequest.category,
      from_date: leaveRequest.from,
      to_date: leaveRequest.to,
      description: leaveRequest.description?.trim() || leaveRequest.title,
      supporting_document: leaveRequest.proof || "",
    }),
  });
}

export function askStudyAssistant(question, history = []) {
  return request("/api/study-assistant/chat", {
    method: "POST",
    body: JSON.stringify({ question, history }),
  });
}

export function getMarketplaceProducts() {
  return request("/api/marketplace/products");
}

export function askMarketplaceAssistant(message, history = []) {
  return request("/api/marketplace/chat", {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
}

export function askStudentAnalytics(question, history, role, studentId) {
  return request("/api/students/analytics", {
    method: "POST",
    body: JSON.stringify({
      question,
      history,
      role,
      student_id: studentId,
    }),
  });
}

export function getProjectReports(projectId, role, userId) {
  const params = new URLSearchParams({
    project_id: projectId,
    role,
    user_id: userId,
  });
  return request(`/api/projects/reports?${params}`);
}

export function uploadProjectReport(project, studentId, file) {
  const body = new FormData();
  body.set("project_id", project.id);
  body.set("project_name", project.name);
  body.set("student_id", studentId);
  body.set("mentor_id", project.mentor || "");
  body.set("file", file);
  return request("/api/projects/reports/analyze", {
    method: "POST",
    body,
  });
}

export function submitProjectReport(reportId, studentId, mentorId) {
  return request(`/api/projects/reports/${reportId}/submit`, {
    method: "POST",
    body: JSON.stringify({ student_id: studentId, mentor_id: mentorId }),
  });
}

export function analyzeIncomingProjectReport(reportId, mentorId) {
  return request(`/api/projects/reports/${reportId}/mentor-analysis`, {
    method: "POST",
    body: JSON.stringify({ mentor_id: mentorId }),
  });
}
