import api from "./api";

type RegisterPayload = {
  fullName: string;
  companyName: string;
  phoneNumber: string;
  email: string;
  password: string;
  licenceType: string;
};

export const register = async (data: RegisterPayload) => {
  const response = await api.post(
    "/api/securityagent/auth/register",
    data
  );

  return response.data;
};

export const login = async (data: {
  email: string;
  password: string;
}) => {
  const response = await api.post(
    "/api/securityagent/auth/login",
    data
  );

  return response.data;
};


export const verifyEmail = (token: string) => {
  return api.get(`/auth/verify?token=${token}`);
};


export const forgotPassword = (data: { email: string }) => {
  return api.post("/auth/forgot-password", data);
};


export const resetPassword = (data: {
  token: string;
  password: string;
}) => {
  return api.post("/auth/reset-password", data);
};