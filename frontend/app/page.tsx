"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import Button from "@/components/ui/Button";

export default function Home() {
    const router = useRouter();

    useEffect(() => {
        const access = localStorage.getItem("access");

        if (access) {
            router.replace("/transactions");
        }
    }, [router]);

    return (
        <AuthShell
            title="SpendLog"
            subtitle="Track your expenses. Keep your balances clear."
            footer="Split bills, settle up, stay square."
        >
            <div className="space-y-3">
                <Button size="lg" block onClick={() => router.push("/login")}>
                    Login
                </Button>

                <Button size="lg" variant="secondary" block onClick={() => router.push("/signup")}>
                    Create account
                </Button>
            </div>
        </AuthShell>
    );
}
