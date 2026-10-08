const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
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
