'use client';

import { useEffect, useState } from "react";
// import { fetchWithAuth } from "@/lib/api";
import { useRouter } from "next/navigation";
import { logout, getProtectedData } from "@/services/auth";

export default function DashboardPage() {

    const router = useRouter();
    const [data, setData] = useState<any>(null);

    useEffect(() => {
    async function fetchData() {
        try {
            const data = await getProtectedData();
            setData(data);
            console.log(data);
        } catch (error) {
            console.error(error);
            router.push("/login");
        }
    }

    fetchData();
    }, [router]);



    async function handleLogout() {
        await logout();
        router.push("/login");
    }

    return (
        <>
            <div className="flex flex-col items-center justify-center w-full gap-4">
                <h1>Dashboard</h1>
                <button onClick={handleLogout} className="inline-flex rounded-xl bg-green-600  hover:bg-green-500" >
                    <span className="flex items-center justify-center rounded-[10px] bg-neutral-primary-soft px-5 py-2.5 text-sm font-medium text-heading transition-all duration-300 group-hover:bg-transparent group-hover:text-white">
                        Logout
                    </span>
                </button>
            </div>
        </>
    );
}