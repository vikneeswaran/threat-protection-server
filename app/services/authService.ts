import api from "./api";

// export const register = (data: any) => {
//   return api.post("/auth/register", data);
// };


export const register = async (data: any) => {
  const response = await api.post(
    "/api/securityagent/auth/register",
    data
  );

  return response.data;
};

// export const verifyEmail = (token: string) => {
//   return api.get(`/auth/verify?token=${token}`);
// };



export const login = async (data: {
  email: string;
  password: string;
}) => {
  const response = await api.post(
    "/securityagent/auth/login",
    data
  );

  return response.data;
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

