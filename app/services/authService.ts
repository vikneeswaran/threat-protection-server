// Auth service functions to handle registration, login, email verification, and password management APIs.
import api from "./api";

// Send user registration details to registration API.
export const register = async (data: any) => {
  const response = await api.post(
    "/api/securityagent/auth/register",
    data
  );

  return response.data;
};

// Send user login credentials to authentication API.
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

// Verify user email using verification token.
export const verifyEmail = (token: string) => {
  return api.get(`/auth/verify?token=${token}`);
};

// Send email request for password reset link.
export const forgotPassword = (data: { email: string }) => {
  return api.post("/auth/forgot-password", data);
};

// Update user password using reset token.
export const resetPassword = (data: {
  token: string;
  password: string;
}) => {
  return api.post("/auth/reset-password", data);
};