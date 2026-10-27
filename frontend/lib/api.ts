
import axios from "axios";

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
});

// Shared across concurrent requests in this module.
let refreshPromise: Promise<string> | null = null;

api.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        const token = localStorage.getItem("access");

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,

    async (error) => {
        const originalRequest = error.config;

        if (
            error.response?.status !== 401 ||
            !originalRequest ||
            originalRequest._retry ||
            originalRequest.url?.includes("/refresh/")
        ) {
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        const refresh = localStorage.getItem("refresh");

        if (!refresh) {
            localStorage.removeItem("access");
            localStorage.removeItem("refresh");
            window.location.href = "/login";
            return Promise.reject(error);
        }

        try {
            if (!refreshPromise) {
                refreshPromise = axios
                    .post(
                        `${process.env.NEXT_PUBLIC_API_URL}/refresh/`,
                        { refresh }
                    )
                    .then((response) => {
                        const newAccess = response.data.access;

                        localStorage.setItem("access", newAccess);

                        if (response.data.refresh) {
                            localStorage.setItem(
                                "refresh",
                                response.data.refresh
                            );
                        }

                        return newAccess;
                    })
                    .finally(() => {
                        refreshPromise = null;
                    });
            }

            const newAccess = await refreshPromise;

            originalRequest.headers.Authorization =
                `Bearer ${newAccess}`;

            return api(originalRequest);
        } catch (refreshError) {
            localStorage.removeItem("access");
            localStorage.removeItem("refresh");

            window.location.href = "/login";

            return Promise.reject(refreshError);
        }
    }
);

export default api;
