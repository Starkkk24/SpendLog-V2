"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, LogOut, User, WifiOff } from "lucide-react";
import { getCurrentUser, logout } from "@/services/auth";
import { getProfileBalance } from "@/services/balance";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import PageHeader from "@/components/navigation/PageHeader";
import ContactBalanceList, {
    type BalanceFilter,
    type ContactBalance,
} from "@/components/profile/ContactBalanceList";
import { cn } from "@/lib/cn";

export default function ProfilePage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("all");
    const pendingRef = useRef<HTMLElement>(null);

    const {
        data: userData,
        isPending,
        isError,
    } = useQuery({
        queryKey: ["currentUser"],
        queryFn: getCurrentUser,
    });

    const {
        data: balanceData,
        isPending: balancePending,
        isError: balanceError,
    } = useQuery({
        queryKey: ["profileBalance"],
        queryFn: getProfileBalance,
    });

    const username = userData?.user ?? "";
    const profileBalance = Number(balanceData?.profile_balance ?? 0);
    const lend = Number(balanceData?.lend ?? 0);
    const borrow = Number(balanceData?.borrow ?? 0);
    const contactBalances: ContactBalance[] = (balanceData?.contacts ?? []).map(
        (contact: ContactBalance) => ({ ...contact, balance: Number(contact.balance) })
    );

    function showPending(filter: BalanceFilter) {
        setBalanceFilter(filter);
        pendingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (isPending || balancePending) {
        return (
            <main className="page">
                <PageHeader title="Profile" subtitle="Your account" />
                <div className="space-y-4">
                    <CardSkeleton />
                    <CardSkeleton />
                </div>
            </main>
        );
    }

    if (isError || balanceError) {
        return (
            <main className="page">
                <PageHeader title="Profile" />
                <EmptyState
                    icon={WifiOff}
                    title="Failed to load profile."
                    description="Please refresh the page."
                    action={
                        // Always offer a way out, even when the API is unreachable.
                        <Button variant="danger" onClick={handleLogout}>
                            <LogOut size={16} />
                            Logout
                        </Button>
                    }
                />
            </main>
        );
    }

    async function handleLogout() {
        try {
            await logout();
        } catch (error) {
            console.error("Logout failed:", error);
        } finally {
            queryClient.clear();
            router.push("/login");
        }
    }

    const balancePositive = profileBalance > 0;
    const balanceNegative = profileBalance < 0;

    return (
        <main className="page">
            <PageHeader title="Profile" subtitle="Your account" />

            <div className="space-y-4">
                {/* User + Overall Balance */}
                <Card className="relative animate-rise-in overflow-hidden p-5">
                    <div
                        aria-hidden
                        className={cn(
                            "pointer-events-none absolute -top-20 -right-16 size-56 rounded-full blur-3xl",
                            balancePositive
                                ? "bg-sp-success/15"
                                : balanceNegative
                                    ? "bg-sp-danger/15"
                                    : "bg-sp-primary/15"
                        )}
                    />

                    <div className="relative flex items-center gap-3">
                        <div className="grid size-12 place-items-center rounded-full bg-sp-primary/20 text-sp-primary-soft">
                            <User size={24} />
                        </div>

                        <div className="min-w-0">
                            <p className="truncate text-lg font-semibold text-sp-text">
                                {username || "Your Account"}
                            </p>

                            <p className="text-sm text-sp-muted">
                                SpendLog
                            </p>
                        </div>
                    </div>

                    <div className="relative mt-6">
                        <p className="text-xs font-medium uppercase tracking-wider text-sp-muted">
                            Overall Balance
                        </p>

                        <p
                            className={cn(
                                "tabular mt-1 text-4xl font-bold tracking-tight",
                                balancePositive
                                    ? "text-sp-success"
                                    : balanceNegative
                                        ? "text-sp-danger"
                                        : "text-sp-text"
                            )}
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
                </Card>

                {/* Financial Summary */}
                <section className="animate-rise-in [animation-delay:60ms]">
                    <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-sp-muted">
                        Financial Summary
                    </h2>

                    <div className="grid grid-cols-2 gap-3">

                        {/* Lent */}
                        <Card
                            role="button"
                            tabIndex={0}
                            onClick={() => showPending("lent")}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    showPending("lent");
                                }
                            }}
                            className="cursor-pointer p-4 transition active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-2 text-sm text-sp-muted">
                                <span className="grid size-7 place-items-center rounded-full bg-sp-success/15 text-sp-success">
                                    <ArrowUpRight size={15} />
                                </span>
                                Lent
                            </div>

                            <p className="tabular mt-3 text-xl font-semibold text-sp-success">
                                ₹{lend.toFixed(2)}
                            </p>

                            <p className="mt-0.5 text-xs text-sp-muted">
                                Others owe you
                            </p>
                        </Card>

                        {/* Borrowed */}
                        <Card
                            role="button"
                            tabIndex={0}
                            onClick={() => showPending("borrowed")}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    showPending("borrowed");
                                }
                            }}
                            className="cursor-pointer p-4 transition active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-2 text-sm text-sp-muted">
                                <span className="grid size-7 place-items-center rounded-full bg-sp-danger/15 text-sp-danger">
                                    <ArrowDownLeft size={15} />
                                </span>
                                Borrowed
                            </div>

                            <p className="tabular mt-3 text-xl font-semibold text-sp-danger">
                                ₹{borrow.toFixed(2)}
                            </p>

                            <p className="mt-0.5 text-xs text-sp-muted">
                                You owe others
                            </p>
                        </Card>

                    </div>
                </section>

                {/* Pending settlements */}
                <section
                    ref={pendingRef}
                    className="scroll-mt-4 animate-rise-in [animation-delay:90ms]"
                >
                    <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-sp-muted">
                        Pending Settlements
                    </h2>

                    <ContactBalanceList
                        contacts={contactBalances}
                        filter={balanceFilter}
                        onFilterChange={setBalanceFilter}
                    />
                </section>

                {/* Logout */}
                <section className="animate-rise-in [animation-delay:120ms]">
                    <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-sp-muted">
                        Account
                    </h2>

                    <Card className="overflow-hidden">
                        <button
                            onClick={handleLogout}
                            className="flex h-14 w-full items-center gap-3 px-4 text-[15px] font-medium text-sp-danger transition-colors hover:bg-sp-danger/5 active:bg-sp-danger/10"
                        >
                            <span className="grid size-8 place-items-center rounded-full bg-sp-danger/10">
                                <LogOut size={17} />
                            </span>
                            Logout
                        </button>
                    </Card>
                </section>
            </div>
        </main>
    );
}
