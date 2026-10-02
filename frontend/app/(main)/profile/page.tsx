"use client";

import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { logout } from "@/services/auth";

export default function ProfilePage() {
    const router = useRouter();

    async function handleLogout() {
        try {
            await logout();
        } catch (error) {
            console.error("Logout failed:", error);
        } finally {
            router.push("/login");
        }
    }

    return (
        <main className="min-h-screen bg-sp-bg px-4 pb-24 pt-6 text-white sm:px-6">
            <div className="mx-auto max-w-2xl">

                <div className="mb-6">
                    <h1 className="text-2xl font-semibold">
                        Profile
                    </h1>

                    <p className="mt-1 text-sm text-sp-muted">
                        Account settings
                    </p>
                </div>

                <div className="rounded-2xl bg-sp-surface p-5">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sp-primary-deep">
                            <User size={24} />
                        </div>

                        <div>
                            <p className="font-medium">
                                Your Account
                            </p>

                            <p className="text-sm text-sp-muted">
                                SpendLog
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleLogout}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-sp-surface px-4 py-4 text-sm font-medium text-red-400 transition hover:bg-white/10"
                >
                    <LogOut size={18} />
                    Logout
                </button>

            </div>
        </main>
    );
}