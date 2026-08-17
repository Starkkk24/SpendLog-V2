import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000/",
});

// Runs before every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("access");

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

api.interceptors.response.use(
    (response) => {
        return response;
    },

    async (error) => {
        const originalRequest = error.config;

        if (
            error.response?.status === 401 &&
            !originalRequest._retry
        ) {
            originalRequest._retry = true;

            const refresh = localStorage.getItem("refresh");

            if (!refresh) {
                localStorage.removeItem("access");
                localStorage.removeItem("refresh");
                return Promise.reject(error);
            }

            try {
                // Use plain axios here, NOT api
                const response = await axios.post(
                    "http://127.0.0.1:8000/refresh/",
                    {
                        refresh,
                    }
                );

                const newAccess = response.data.access;

                localStorage.setItem("access", newAccess);

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

        return Promise.reject(error);
    }
);

export default api