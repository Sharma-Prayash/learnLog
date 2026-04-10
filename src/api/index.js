import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('learnlog_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Auth ──

export async function registerUser(username, email, password) {
  const { data } = await api.post('/auth/register', { username, email, password });
  return data;
}

export async function loginUser(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
}

export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data;
}

// ── Classrooms ──

export async function getClassrooms() {
  const { data } = await api.get('/classrooms');
  return data;
}

export async function getClassroom(id) {
  const { data } = await api.get(`/classrooms/${id}`);
  return data;
}

export async function createClassroom(name, description) {
  const { data } = await api.post('/classrooms', { name, description });
  return data;
}

export async function deleteClassroom(id) {
  const { data } = await api.delete(`/classrooms/${id}`);
  return data;
}

export async function getClassroomStudents(id) {
  const { data } = await api.get(`/classrooms/${id}/students`);
  return data;
}

export async function getClassroomPending(id) {
  const { data } = await api.get(`/classrooms/${id}/pending`);
  return data;
}

export async function resetStudentProgress(classroomId, userId) {
  const { data } = await api.post(`/classrooms/${classroomId}/students/${userId}/reset`);
  return data;
}

// ── Memberships ──

export async function joinClassroom(invite_code) {
  const { data } = await api.post('/memberships/join', { invite_code });
  return data;
}

export async function approveRequest(membershipId) {
  const { data } = await api.put(`/memberships/${membershipId}/approve`);
  return data;
}

export async function rejectRequest(membershipId) {
  const { data } = await api.put(`/memberships/${membershipId}/reject`);
  return data;
}

// ── Nodes ──

export async function getNodes(classroomId) {
  const { data } = await api.get('/nodes', { params: { classroomId } });
  return data;
}

export async function updateProgress(nodeId, completed) {
  const { data } = await api.put(`/nodes/${nodeId}/progress`, { completed });
  return data;
}

export async function deleteNode(id) {
  const { data } = await api.delete(`/nodes/${id}`);
  return data;
}

export async function renameNode(id, name) {
  const { data } = await api.put(`/nodes/${id}/rename`, { name });
  return data;
}

export async function createLinkNode(classroomId, parentId, name, url) {
  const { data } = await api.post('/nodes/link', { classroomId, parentId, name, url });
  return data;
}

// ── Upload ──

export async function uploadFolder(classroomId, files, paths, parentId = null) {
  const formData = new FormData();
  formData.append('classroomId', classroomId);
  formData.append('paths', JSON.stringify(paths));
  if (parentId) formData.append('parentId', parentId);
  files.forEach((file) => formData.append('files', file));

  const { data } = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

// ── Announcements ──

export async function getAnnouncements(classroomId) {
  const { data } = await api.get('/announcements', { params: { classroomId } });
  return data;
}

export async function createAnnouncement(classroomId, title, body) {
  const { data } = await api.post('/announcements', { classroomId, title, body });
  return data;
}

export async function deleteAnnouncement(id) {
  const { data } = await api.delete(`/announcements/${id}`);
  return data;
}

// ── Comments ──

export async function getComments(nodeId) {
  const { data } = await api.get('/comments', { params: { nodeId } });
  return data;
}

export async function createComment(nodeId, body) {
  const { data } = await api.post('/comments', { nodeId, body });
  return data;
}

export async function deleteComment(id) {
  const { data } = await api.delete(`/comments/${id}`);
  return data;
}

// ── Doubts ──

export async function getDoubts(classroomId) {
  const { data } = await api.get(`/doubts/${classroomId}`);
  return data;
}

export async function getDoubtDetail(doubtId) {
  const { data } = await api.get(`/doubts/single/${doubtId}`);
  return data;
}

export async function createDoubt(classroomId, title, body) {
  const { data } = await api.post(`/doubts/${classroomId}`, { title, body });
  return data;
}

export async function createDoubtReply(doubtId, body) {
  const { data } = await api.post(`/doubts/${doubtId}/reply`, { body });
  return data;
}

export async function deleteDoubt(id) {
  const { data } = await api.delete(`/doubts/${id}`);
  return data;
}

export async function updateDoubtStatus(id, status) {
  const { data } = await api.patch(`/doubts/${id}/status`, { status });
  return data;
}

export default api;
