import useAuth from "@/auth/store";
import { refreshToken } from "@/services/AuthService";
import axios from "axios";
import toast from "react-hot-toast";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",  // ✅ chemin relatif
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: false,  // ✅ false car on utilise le proxy Vite
  timeout: 10000,
});

// Intercepteur avant chaque requête
apiClient.interceptors.request.use(
  (config) => {
    const accessToken = useAuth.getState().accessToken;
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let pendingRequests: any[] = [];

const resolveQueue = (newToken: string | null) => {
  pendingRequests.forEach((callback) => callback(newToken));
  pendingRequests = [];
};

// Intercepteur de réponse
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Erreur de connexion réseau ou CORS
    if (!error.response) {
      toast.error("Impossible de contacter le serveur (Network Error).");
      return Promise.reject(error);
    }

    // Gestion du rafraîchissement (401)
    if (error.response.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push((newToken: string | null) => {
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(apiClient(originalRequest));
            } else {
              reject(error);
            }
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const data = await refreshToken();
        const newToken = data.accessToken;
        if (!newToken) throw new Error();

        useAuth.getState().changeLocalLoginData(newToken, data.user, true);
        resolveQueue(newToken);
        
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        resolveQueue(null);
        useAuth.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Extraction du message d'erreur pour les notifications
    const errorMessage = error.response.data?.error || error.response.data?.message || "Une erreur est survenue";
    
    // On n'affiche pas de toast pour le login car c'est géré visuellement dans la page
    if (!originalRequest.url?.includes("/auth/login")) {
      toast.error(errorMessage);
    }

    return Promise.reject(error);
  }
);

export default apiClient;