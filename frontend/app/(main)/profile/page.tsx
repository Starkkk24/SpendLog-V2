"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { getCurrentUser, logout } from "@/services/auth";
import { getProfileBalance } from "@/services/balance";

export default function ProfilePage() {
    const router = useRouter();

    const [username, setUsername] = useState("");
    const [profileBalance, setProfileBalance] = useState(0);
    const [lend, setLend] = useState(0);
    const [borrow, setBorrow] = useState(0);

    useEffect(() => {
        async function loadProfile() {
            try {
                const [userData, balanceData] = await Promise.all([
                    getCurrentUser(),
                    getProfileBalance(),
                ]);

                setUsername(userData.user);
                setProfileBalance(Number(balanceData.profile_balance));
                setLend(Number(balanceData.lend));
                setBorrow(Number(balanceData.borrow));
            } catch (error) {
                console.error("Failed to load profile:", error);
            }
        }

        loadProfile();
    }, []);

    async function handleLogout() {
        try {
            await logout();
        } catch (error) {
            console.error("Logout failed:", error);
        } finally {
            router.push("/login");
        }
    }

    const balancePositive = profileBalance > 0;
    const balanceNegative = profileBalance < 0;

    return (
        <main className="min-h-screen bg-sp-bg px-4 pb-24 pt-6 text-white sm:px-6">
            <div className="mx-auto max-w-2xl">

                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold">
                        Profile
                    </h1>

                    <p className="mt-1 text-sm text-sp-muted">
                        Your account
                    </p>
                </div>

                {/* User */}
                <div className="rounded-2xl bg-sp-surface p-5">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sp-primary-deep">
                            <User size={26} />
                        </div>

                        <div>
                            <p className="text-lg font-semibold">
                                {username || "Your Account"}
                            </p>

                            <p className="text-sm text-sp-muted">
                                SpendLog
                            </p>
                        </div>
                    </div>
                </div>

                {/* Overall Balance */}
                <div className="mt-4 rounded-2xl bg-sp-surface p-5">
                    <p className="text-sm text-sp-muted">
                        Overall Balance
                    </p>

                    <p
                        className={`mt-2 text-3xl font-semibold ${
                            balancePositive
                                ? "text-green-400"
                                : balanceNegative
                                ? "text-red-400"
                                : "text-white"
                        }`}
                    >
                        {profileBalance >= 0 ? "+" : "-"}₹
                        {Math.abs(profileBalance).toFixed(2)}
                    </p>

                    <p className="mt-1 text-sm text-sp-muted">
                        {balancePositive
                            ? "People owe you"
                            : balanceNegative
                            ? "You owe people"
                            : "All accounts are balanced"}
                    </p>
                </div>

                {/* Financial Summary */}
                <div className="mt-4 rounded-2xl bg-sp-surface p-5">
                    <p className="mb-4 text-sm text-sp-muted">
                        Financial Summary
                    </p>

                    <div className="grid grid-cols-2 gap-4">

                        {/* Lent */}
                        <div className="rounded-xl bg-sp-bg p-4">
                            <p className="text-sm text-sp-muted">
                                Lent
                            </p>

                            <p className="mt-1 text-xl font-semibold text-green-400">
                                ₹{lend.toFixed(2)}
                            </p>

                            <p className="mt-1 text-xs text-sp-muted">
                                Others owe you
                            </p>
                        </div>

                        {/* Borrowed */}
                        <div className="rounded-xl bg-sp-bg p-4">
                            <p className="text-sm text-sp-muted">
                                Borrowed
                            </p>

                            <p className="mt-1 text-xl font-semibold text-red-400">
                                ₹{borrow.toFixed(2)}
                            </p>

                            <p className="mt-1 text-xs text-sp-muted">
                                You owe others
                            </p>
                        </div>

                    </div>
                </div>

                {/* Logout */}
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