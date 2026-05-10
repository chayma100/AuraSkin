import type RegisterData from "@/models/RegisterData";
import apiClient from "@/config/ApiClient";
import type LoginData from "@/models/LoginData";
import type LoginResponseData from "@/models/LoginResponseData";
import type User from "@/models/User";

// Register function
export const registerUser = async (signupData: RegisterData) => {
  try {
    const response = await apiClient.post(`/auth/register`, signupData);
    return response.data;
  } catch (error: any) {
    const message = error.response?.data?.error || "Registration failed";
    throw new Error(message);
  }
};

// Login
export const loginUser = async (loginData: LoginData) => {
  try {
    const response = await apiClient.post<LoginResponseData>(
      "/auth/login",
      loginData
    );
    return response.data;
  } catch (error: any) {
    const message = error.response?.data?.error || "Login failed";
    throw new Error(message);
  }
};

/**
 * Logout - Version finale sans erreur 404
 */
export const logoutUser = async () => {
  // On ne fait plus d'appel API car la route /auth/logout n'existe pas (404)
  // On nettoie simplement le stockage local
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  return { message: "Logged out locally" };
};

// Get current login user
export const getCurrentUser = async (emailId: string | undefined) => {
  if (!emailId) return null;
  try {
    const response = await apiClient.get<User>(`/users/email/${emailId}`);
    return response.data;
  } catch (error) {
    return null;
  }
};

// Refresh token
export const refreshToken = async () => {
  try {
    const response = await apiClient.post<LoginResponseData>(`/auth/refresh`);
    return response.data;
  } catch (error) {
    throw new Error("Session expired");
  }
};