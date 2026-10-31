'use client';

// import { useEffect, useState } from "react";
// // import { fetchWithAuth } from "@/lib/api";
// import { useRouter } from "next/navigation";
// import { logout, getProtectedData } from "@/services/auth";

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { logout, getProtectedData } from "@/services/auth";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import PageHeader from "@/components/navigation/PageHeader";

export default function DashboardPage() {

    const router = useRouter();
    const queryClient = useQueryClient();

    const {
        data,
        isPending,
        isError,
        error,
    } = useQuery({
        queryKey: ["protectedData"],
        queryFn: getProtectedData,
    });

    if (isPending) {
        return <main className="page grid min-h-[60dvh] place-items-center"><Spinner className="size-6 text-sp-muted" /></main>;
    }

    if (isError) {
        console.error(error);
        router.push("/login");
        return <main className="page py-10 text-center text-sp-muted">Redirecting to login...</main>;
    }



    async function handleLogout() {
        await logout();
        // Don't leak the cached user, contacts or balances to the next login.
        queryClient.clear();
        router.push("/login");
    }

    return (
        <main className="page">
            <PageHeader title="Dashboard" />
            <div className="grid gap-3">
                <Button size="lg" variant="danger" onClick={handleLogout}>
                    Logout
                </Button>
                <Button size="lg" onClick={() => router.push("/contacts")}>
                    Contact
                </Button>
                <Button size="lg" variant="secondary" onClick={() => router.push("/transactions")}>
                    Transactions
                </Button>
            </div>
        </main>
    );
}
