"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    getTransaction,
    settleSplit,
    settleSplitCompletely,
    unsettleSplit,
} from "@/services/transactions";
import { deleteTransaction } from "@/services/transactions";
import EditTransactionModal from "@/components/transactions/EditTransactionModel";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Input";
import Sheet from "@/components/ui/Sheet";
import { CardSkeleton, ListSkeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import PageHeader from "@/components/navigation/PageHeader";
import { useRetained } from "@/hooks/useOverlay";
import { cn } from "@/lib/cn";
import {
    CalendarDays,
    Check,
    CheckCheck,
    ChevronLeft,
    Pencil,
    RotateCw,
    SearchX,
    Trash2,
    Undo2,
} from "lucide-react";

type Split = {
    id: number;
    user: number | null;
    user_name: string | null;
    contact: number | null;
    contact_name: string | null;
    amount: string;
    settled_amount: string;
    remaining_amount: number;
    settled: boolean;
};

type Transaction = {
    id: number;
    payer_user: number | null;
    payer_user_name: string | null;
    payer_contact: number | null;
    payer_contact_name: string | null;
    total_amount: string;
    remaining_amount: string;
    note: string;
    transaction_datetime: string;
    splits: Split[];
};

export default function TransactionDetailPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();

    async function invalidateFinancialData() {
        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: ["transactions"],
            }),
            queryClient.invalidateQueries({
                queryKey: ["profileBalance"],
            }),
            queryClient.invalidateQueries({
                queryKey: ["contactBalance"],
            }),
        ]);
    }

    async function invalidateTransactionAndFinancialData() {
        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: ["transaction", transactionId],
            }),
            invalidateFinancialData(),
        ]);
    }

    const transactionId = Number(params.id);

    const {
        data: transaction,
        isPending: loading,
        isError,
        refetch: refreshTransaction,
    } = useQuery<Transaction>({
        queryKey: ["transaction", transactionId],
        queryFn: () => getTransaction(transactionId),
        enabled:
            Number.isInteger(transactionId) &&
            transactionId > 0,
    });
    const [settleSplitId, setSettleSplitId] = useState<number | null>(null);
    const [settleAmount, setSettleAmount] = useState("");
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const retainedSettleSplitId = useRetained(settleSplitId);


    function canSettle(split: Split) {
        // Current user paid, contact owes them
        if (
            transaction?.payer_user !== null &&
            split.contact !== null
        ) {
            return true;
        }

        // Contact paid, current user owes them
        if (
            transaction?.payer_contact !== null &&
            split.user !== null
        ) {
            return true;
        }

        return false;
    }

    function openSettleModal(splitId: number) {
        setSettleSplitId(splitId);
        setSettleAmount("");
    }

    function closeSettleModal() {
        setSettleSplitId(null);
        setSettleAmount("");
    }

    async function handleSettleAmount() {
        if (settleSplitId === null) return;

        try {
            await settleSplit(
                settleSplitId,
                Number(settleAmount)
            );

            await invalidateTransactionAndFinancialData();

            closeSettleModal();
        } catch (error) {
            console.error("Failed to settle split:", error);
        }

    }
    function handleDelete() {
        if (!transaction) return;

        toast.action("Delete this transaction and all its splits?", {
            label: "Delete",
            destructive: true,
            onClick: () => void confirmDelete(transaction.id),
        });
    }

    async function confirmDelete(id: number) {
        try {
            await deleteTransaction(id);
            await invalidateFinancialData();
            toast.success("Transaction deleted");
            router.push("/transactions");
        } catch (error) {
            console.error("Failed to delete transaction:", error);
            toast.error("Couldn't delete the transaction");
        }
    }

    async function handleSettleCompletely() {
        if (settleSplitId === null) return;

        try {
            await settleSplitCompletely(settleSplitId);

            await invalidateTransactionAndFinancialData();

            closeSettleModal();
        } catch (error) {
            console.error("Failed to settle split:", error);
        }
    }

    async function handleUnsettle(splitId: number) {
        try {
            await unsettleSplit(splitId);

            await invalidateTransactionAndFinancialData();
        } catch (error) {
            console.error("Failed to unsettle split:", error);
        }
    }



    if (loading) {
        return (
            <main className="page">
                <PageHeader title="Transaction" onBack={() => router.push("/transactions")} />
                <div className="space-y-6">
                    <CardSkeleton />
                    <ListSkeleton rows={3} />
                </div>
            </main>
        );
    }

    if (isError || !transaction) {
        return (
            <main className="page">
                <PageHeader title="Transaction" onBack={() => router.push("/transactions")} />
                <EmptyState
                    icon={SearchX}
                    title="Transaction not found"
                    action={
                        <div className="flex flex-col items-center gap-2">
                            <Button variant="secondary" onClick={() => router.push("/transactions")}>
                                <ChevronLeft size={16} />
                                Back to transactions
                            </Button>

                            {isError && (
                                <Button variant="ghost" onClick={() => void refreshTransaction()}>
                                    <RotateCw size={16} />
                                    Try again
                                </Button>
                            )}
                        </div>
                    }
                />
            </main>
        );
    }
    const settledTotal = transaction.splits.reduce(
        (sum, split) => sum + Number(split.settled_amount),
        0
    );

    const remainingTotal = transaction.splits.reduce(
        (sum, split) => sum + Number(split.remaining_amount),
        0
    );

    const formatINR = (value: number) =>
        value.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
        });

    const settledPercent =
        settledTotal + remainingTotal > 0
            ? (settledTotal / (settledTotal + remainingTotal)) * 100
            : 0;

    return (
        <main className="page">
            <PageHeader
                title="Transaction"
                onBack={() => router.push("/transactions")}
                actions={
                    <>
                        <button
                            type="button"
                            onClick={() => setIsEditModalOpen(true)}
                            aria-label="Edit transaction"
                            className="grid size-10 place-items-center rounded-full text-sp-text transition hover:bg-white/5 active:scale-90"
                        >
                            <Pencil size={19} />
                        </button>

                        <button
                            type="button"
                            onClick={handleDelete}
                            aria-label="Delete transaction"
                            className="grid size-10 place-items-center rounded-full text-sp-danger transition hover:bg-sp-danger/10 active:scale-90"
                        >
                            <Trash2 size={19} />
                        </button>
                    </>
                }
            />

            {/* Transaction Summary */}
            <Card className="relative animate-rise-in overflow-hidden p-5">
                <div
                    aria-hidden
                    className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-sp-primary/15 blur-3xl"
                />

                <div className="relative">
                    <h1 className="text-lg font-semibold leading-snug text-sp-text">
                        {transaction.note || "Untitled transaction"}
                    </h1>

                    <p className="mt-1 flex items-center gap-1.5 text-sm text-sp-muted">
                        <CalendarDays size={14} />
                        {new Date(
                            transaction.transaction_datetime
                        ).toLocaleString("en-IN")}
                    </p>

                    <p className="tabular mt-5 text-4xl font-bold tracking-tight text-sp-text">
                        ₹
                        {formatINR(Number(transaction.total_amount))}
                    </p>

                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div
                            className="h-full rounded-full bg-sp-success/70 transition-[width] duration-(--dur-slow)"
                            style={{ width: `${settledPercent}%` }}
                        />
                    </div>

                    <div className="tabular mt-2 flex justify-between text-sm">
                        <span className="text-sp-success">
                            ₹
                            {formatINR(settledTotal)}{" "}
                            settled
                        </span>

                        <span className="text-sp-muted">
                            ₹
                            {formatINR(remainingTotal)}{" "}
                            remaining
                        </span>
                    </div>
                </div>

                {/* Paid By */}
                <div className="relative mt-5 flex items-center gap-3 border-t border-sp-border pt-4">
                    <Avatar
                        name={transaction.payer_user_name ||
                            transaction.payer_contact_name || "?"}
                        className="size-9 text-xs"
                    />
                    <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wider text-sp-muted">
                            Paid by
                        </p>

                        <p className="truncate text-[15px] font-medium text-sp-text">
                            {transaction.payer_user_name ||
                                transaction.payer_contact_name}
                        </p>
                    </div>
                </div>
            </Card>

            {/* Splits */}
            <section className="mt-6">
                <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-sp-muted">
                    Splits · {transaction.splits.length}
                </h2>

                <div className="divide-y divide-sp-border overflow-hidden rounded-sp-lg border border-sp-border bg-sp-card">
                    {transaction.splits.map((split, index) => (
                        <div
                            key={`${split.user ?? "u"}-${split.contact ?? "c"}`}
                            style={{ animationDelay: `${Math.min(index, 10) * 30 + 60}ms` }}
                            className="flex animate-rise-in items-center gap-3 px-4 py-3.5"
                        >
                            {/* Participant */}
                            <Avatar name={split.contact_name ||
                                split.user_name ||
                                "?"} />

                            <div className="min-w-0 flex-1">
                                {split.contact ? (
                                    <Link
                                        href={`/contacts/${split.contact}`}
                                        className="block truncate text-[15px] font-medium text-sp-text transition hover:text-sp-primary"
                                    >
                                        {split.contact_name}
                                    </Link>
                                ) : (
                                    <p className="truncate text-[15px] font-medium text-sp-text">
                                        {split.user_name}
                                    </p>
                                )}

                                <p className="tabular mt-0.5 truncate text-xs text-sp-muted">
                                    <span
                                        className={cn(
                                            "mr-1 inline-flex items-center gap-1 font-medium",
                                            split.settled ? "text-sp-success" : "text-sp-warning"
                                        )}
                                    >
                                        <span className="size-1.5 rounded-full bg-current" />
                                        {split.settled
                                            ? "Settled"
                                            : "Unsettled"}
                                    </span>
                                    · ₹{formatINR(Number(split.settled_amount))} settled · ₹{formatINR(Number(split.remaining_amount))} remaining
                                </p>
                            </div>

                            {/* Amount + Action */}
                            <div className="flex shrink-0 flex-col items-end gap-1.5">
                                <p className="tabular text-[15px] font-semibold text-sp-text">
                                    ₹
                                    {formatINR(Number(split.amount))}
                                </p>

                                {canSettle(split) && (
                                    <Button
                                        size="sm"
                                        variant={split.settled ? "secondary" : "primary"}
                                        className="h-8 px-2.5 text-xs"
                                        onClick={() =>
                                            split.settled
                                                ? handleUnsettle(split.id)
                                                : openSettleModal(split.id)
                                        }
                                    >
                                        {split.settled ? <Undo2 size={13} /> : <Check size={13} />}
                                        {split.settled ? "Unsettle" : "Settle"}
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <Sheet open={settleSplitId !== null} onClose={closeSettleModal} title="Settle">
                <div className="px-5 pb-5">
                    <div className="rounded-sp-md bg-sp-card p-4 ring-1 ring-sp-border">
                        <p className="text-xs font-medium uppercase tracking-wider text-sp-muted">
                            Remaining
                        </p>

                        <p className="tabular mt-1 text-3xl font-bold tracking-tight text-sp-text">
                            ₹
                            {Number(
                                transaction.splits.find(
                                    (split) => split.id === retainedSettleSplitId
                                )?.remaining_amount ?? 0
                            ).toFixed(2)}
                        </p>
                    </div>

                    <Field label="Amount" className="mt-5">
                        {(id) => (
                            <Input
                                id={id}
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.01"
                                value={settleAmount}
                                onChange={(e) =>
                                    setSettleAmount(e.target.value)
                                }
                                placeholder="Enter amount"
                                className="tabular"
                            />
                        )}
                    </Field>

                    <div className="mt-5 grid gap-2">
                        <Button size="lg" onClick={handleSettleAmount}>
                            Settle Amount
                        </Button>

                        <Button size="lg" variant="secondary" onClick={handleSettleCompletely}>
                            <CheckCheck size={18} />
                            Settle Completely
                        </Button>
                    </div>
                </div>
            </Sheet>

            {isEditModalOpen && (
                <EditTransactionModal
                    transactionId={transaction.id}
                    onClose={() => setIsEditModalOpen(false)}
                    onUpdated={async (updatedTransaction) => {
                        // The PATCH response is the same serialized transaction
                        // the GET returns, so cache it instead of refetching.
                        queryClient.setQueryData(
                            ["transaction", transactionId],
                            updatedTransaction
                        );
                        await invalidateFinancialData();
                    }}
                />
            )}
        </main>
    );
}
