'use client';

import { useEffect, useState } from "react";

function logout() {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    window.location.href = "/login"
}

export default function DashboardPage() {
    const [data, setData] = useState<any>(null);
    useEffect(() => {
        async function fetchData() {
            const token = localStorage.getItem("access");
            console.log("Token:", token);

            if (!token) {
                window.location.href = "/login";
                return;
            }
            const res = await fetch(
                "http://127.0.0.1:8000/protected/",
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (res.status === 401) {
                window.location.href = "/login";
                return;
            }

            const data = await res.json();
            setData(data);
            console.log("Dashboard data:", data);

        }
        fetchData();
    }, []);


    return (
        <div>
            <h1>Dashboard</h1>
            <pre>{JSON.stringify(data)}</pre>
            <button onClick={logout}>Logout</button>
        </div>
    );
}