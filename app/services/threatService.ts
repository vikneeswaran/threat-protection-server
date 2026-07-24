import api from "./api";

export const getThreats = async () => {
  const response = await api.get("/api/securityagent/threats");
  return response.data;
};

export const getResponseQueue = async () => {
  const response = await api.get("/api/securityagent/responseQueue");
  return response.data.queue;
};

export const getThreatSummary = async () => {
  const response = await api.get("/api/securityagent/threatSummary");
  return response.data.summary;
};

export const getThreatById = async (id: string) => {
  const response = await api.get(`/api/securityagent/threats/${id}`);
  return response.data.threat;
};