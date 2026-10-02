"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
    const router = useRouter();

    useEffect(() => {
        const access = localStorage.getItem("access");

        if (access) {
            router.replace("/transactions");
        }
    }, [router]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-sp-bg px-4 text-white">
            <main className="w-full max-w-md">

                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-semibold">
                        SpendLog
                    </h1>

                    <p className="mt-2 text-sm text-sp-muted">
                        Track your expenses. Keep your balances clear.
                    </p>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={() => router.push("/login")}
                        className="w-full rounded-xl bg-sp-primary px-5 py-3 text-sm font-medium transition hover:bg-sp-primary-deep"
                    >
                        Login
                    </button>

                    <button
                        onClick={() => router.push("/signup")}
                        className="w-full rounded-xl bg-sp-surface px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                    >
                        Create account
                    </button>
                </div>

            </main>
        </div>
    );
}