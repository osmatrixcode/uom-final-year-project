import axios from "axios";
import { API_URL } from "../config";

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 60000, // LLM calls can take up to 60 seconds
  headers: {
    "Content-Type": "application/json",
  },
});

// // Interceptors: The "Secret Sauce" of Axios
// apiClient.interceptors.request.use((config) => {
//   const token = localStorage.getItem("token");
//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }
//   return config;
// });

export default apiClient;
