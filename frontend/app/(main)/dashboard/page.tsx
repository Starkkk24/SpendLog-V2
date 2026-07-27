'use client';

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api";

async function logout() {
    const refresh = localStorage.getItem("refresh");
    try {
        await fetch(
            "http://127.0.0.1:8000/logout/",
            {
                method: "POST",
                headers: {
                    "Content-type": "application/json"
                },
                body: JSON.stringify({ refresh }),
            }
        );
    }
    catch (err) {
        console.log("Logout API failed", err);
    }

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
            const res = await fetchWithAuth(
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
        <>
            <div className="flex flex-col items-center justify-center w-full gap-4">
                <h1>Dashboard</h1>
                <pre>{JSON.stringify(data)}</pre>
                <button onClick={logout} className="inline-flex rounded-xl bg-green-600  hover:bg-green-500" >
                    <span className="flex items-center justify-center rounded-[10px] bg-neutral-primary-soft px-5 py-2.5 text-sm font-medium text-heading transition-all duration-300 group-hover:bg-transparent group-hover:text-white">
                        Logout
                    </span>
                </button>
            </div>
        </>
    );
}