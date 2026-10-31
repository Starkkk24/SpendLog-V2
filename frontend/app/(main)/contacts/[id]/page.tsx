"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dialog from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Input";
import Segmented from "@/components/ui/Segmented";
import Sheet from "@/components/ui/Sheet";
import { CardSkeleton, ListSkeleton } from "@/components/ui/Skeleton";
import PageHeader from "@/components/navigation/PageHeader";
import ShareStatementSheet from "@/components/contacts/ShareStatementSheet";
import { useRetained } from "@/hooks/useOverlay";
import { cn } from "@/lib/cn";
import {
    ArrowUpDown,
    Check,
    CheckCheck,
    ChevronRight,
    Plus,
    ReceiptText,
    RotateCw,
    Share2,
    Trash2,
    Undo2,
    WifiOff,
} from "lucide-react";
import { getBalance } from "@/services/balance";
import {
    settleSplit,
    settleSplitCompletely,
    unsettleSplit,
    createIndividualTransaction,
    settleIndividualTransaction,
    settleIndividualTransactionCompletely,
    unsettleIndividualTransaction,
    deleteIndividualTransaction
} from "@/services/transactions";
import { toApiDateTime } from "@/lib/datetime";

interface Transaction {
    id: number;
    split_id?: number;
    individual_transaction_id?: number;
    type: "expense" | "individual";
    direction?: "lend" | "borrow";
    amount: number;
    settled_amount: number;
    remaining_amount: number;
    settled: boolean;
    date: string;
    paid_by: string;
    note: string;
}
interface BalanceData {
    contact_id: number;
    contact_name: string;
    balance: number;
    transactions: Transaction[];
}

export default function ContactProfilePage() {
    const params = useParams();
    const router = useRouter();

    const contactId = Number(params.id);

    const [showSettled, setShowSettled] = useState(false);

    const queryClient = useQueryClient();
    async function invalidateFinancialData() {
        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: ["contactBalance", contactId],
            }),
            queryClient.invalidateQueries({
                queryKey: ["profileBalance"],
            }),
            queryClient.invalidateQueries({
                queryKey: ["transactions"],
            }),
            // Settling a split changes that transaction's detail view.
            queryClient.invalidateQueries({
                queryKey: ["transaction"],
            }),
        ]);
    }
    const {
        data,
        isPending: loading,
        refetch: loadBalance,
        isError,
    } = useQuery<BalanceData>({
        queryKey: ["contactBalance", contactId, showSettled],
        queryFn: async () => {
            const response = await getBalance(contactId, showSettled);

            return {
                ...response,
                balance: Number(response.balance),
                transactions: response.transactions.map(
                    (transaction: Transaction) => ({
                        ...transaction,
                        amount: Number(transaction.amount),
                        remaining_amount: Number(transaction.remaining_amount),
                        settled_amount: Number(transaction.settled_amount),
                    })
                ),
            };
        },
        enabled: Number.isFinite(contactId) && contactId > 0,
    });
    const [settleTransaction, setSettleTransaction] =
        useState<Transaction | null>(null);
    const [settleAmount, setSettleAmount] = useState("");

    const [sortBy, setSortBy] = useState<
        "newest" | "oldest" | "high" | "low"
    >("newest");

    const [showSort, setShowSort] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [showIndividualForm, setShowIndividualForm] = useState(false);
    const [individualDirection, setIndividualDirection] =
        useState<"lend" | "borrow">("lend");
    const [individualAmount, setIndividualAmount] = useState("");
    const [individualNote, setIndividualNote] = useState("");
    const [individualDateTime, setIndividualDateTime] = useState("");
    const [savingIndividual, setSavingIndividual] = useState(false);
    const [individualError, setIndividualError] = useState<string | null>(null);

    const [deleteIndividualId, setDeleteIndividualId] =
        useState<number | null>(null);
    const [deletingIndividual, setDeletingIndividual] =
        useState(false);





    const retainedSettleTransaction = useRetained(settleTransaction);

    function openSettleModal(transaction: Transaction) {
        setSettleTransaction(transaction);
        setSettleAmount("");
    }

    function closeSettleModal() {
        setSettleTransaction(null);
        setSettleAmount("");
    }

    async function handleSettleAmount() {
        if (!settleTransaction) return;

        try {
            if (settleTransaction.type === "individual") {
                await settleIndividualTransaction(
                    settleTransaction.individual_transaction_id!,
                    Number(settleAmount)
                );
            } else {
                await settleSplit(
                    settleTransaction.split_id!,
                    Number(settleAmount)
                );
            }

            await invalidateFinancialData();
            closeSettleModal();
        } catch (error) {
            console.error("Failed to settle transaction:", error);
        }
    }
    async function handleSettleCompletely() {
        if (!settleTransaction) return;

        try {
            if (settleTransaction.type === "individual") {
                await settleIndividualTransactionCompletely(
                    settleTransaction.individual_transaction_id!
                );
            } else {
                await settleSplitCompletely(
                    settleTransaction.split_id!
                );
            }

            await invalidateFinancialData();
            closeSettleModal();
        } catch (error) {
            console.error("Failed to settle transaction:", error);
        }
    }
    async function handleUnsettle(transaction: Transaction) {
        try {
            if (transaction.type === "individual") {
                await unsettleIndividualTransaction(
                    transaction.individual_transaction_id!
                );
            } else {
                await unsettleSplit(
                    transaction.split_id!
                );
            }

            await invalidateFinancialData();
        } catch (error) {
            console.error("Failed to unsettle transaction:", error);
        }
    }

    async function handleDeleteIndividualTransaction() {
        if (deleteIndividualId === null || deletingIndividual) {
            return;
        }

        try {
            setDeletingIndividual(true);

            await deleteIndividualTransaction(
                deleteIndividualId
            );

            setDeleteIndividualId(null);
            await invalidateFinancialData();
        } catch (error) {
            console.error(
                "Failed to delete individual transaction:",
                error
            );
        } finally {
            setDeletingIndividual(false);
        }
    }

    async function handleCreateIndividualTransaction() {
        if (savingIndividual) return;

        const amount = Number(individualAmount);

        if (!individualAmount || amount <= 0) {
            setIndividualError("Enter a valid amount.");
            return;
        }

        if (!individualDateTime) {
            setIndividualError("Select a date and time.");
            return;
        }

        try {
            setSavingIndividual(true);
            setIndividualError(null);

            await createIndividualTransaction(contactId, {
                direction: individualDirection,
                amount: individualAmount,
                note: individualNote,
                transaction_datetime: toApiDateTime(individualDateTime),
            });

            setShowIndividualForm(false);
            setIndividualAmount("");
            setIndividualNote("");
            setIndividualDateTime("");
            setIndividualDirection("lend");

            await invalidateFinancialData();
        } catch (error: any) {
            setIndividualError(
                error?.response?.data?.error ||
                "Failed to create transaction."
            );
        } finally {
            setSavingIndividual(false);
        }
    }

    const sortedTransactions = [...(data?.transactions ?? [])].sort(
        (a, b) => {
            if (sortBy === "newest") {
                return (
                    new Date(b.date).getTime() -
                    new Date(a.date).getTime()
                );
            }

            if (sortBy === "oldest") {
                return (
                    new Date(a.date).getTime() -
                    new Date(b.date).getTime()
                );
            }

            if (sortBy === "high") {
                return Number(b.amount) - Number(a.amount);
            }

            return Number(a.amount) - Number(b.amount);
        }
    );

    const formatINR = (value: number) =>
        value.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
        });

    // Consecutive transactions that share a day label render as one card.
    const groups: { day: string; items: { transaction: Transaction; time: string }[] }[] = [];

    sortedTransactions.forEach((transaction, index) => {
        const currentDate =
            new Date(
                transaction.date
            );

        const previousDate =
            index > 0
                ? new Date(
                    sortedTransactions[
                        index - 1
                    ].date
                )
                : null;

        const currentDay =
            currentDate.toLocaleDateString(
                "en-IN",
                {
                    day: "2-digit",
                    month: "short",
                }
            );

        const previousDay =
            previousDate
                ? previousDate.toLocaleDateString(
                    "en-IN",
                    {
                        day: "2-digit",
                        month: "short",
                    }
                )
                : null;

        const showDate =
            index === 0 ||
            currentDay !==
            previousDay;

        const time =
            currentDate.toLocaleTimeString(
                "en-IN",
                {
                    hour: "numeric",
                    minute: "2-digit",
                }
            );

        if (showDate) groups.push({ day: currentDay, items: [] });
        groups[groups.length - 1].items.push({ transaction, time });
    });

    let rowIndex = 0;

    return (
        <main className="page">
            <PageHeader
                title={data?.contact_name ?? "Contact"}
                onBack={() => router.back()}
                actions={
                    data && (
                        <button
                            type="button"
                            onClick={() => setShowShare(true)}
                            aria-label="Share on WhatsApp"
                            className="grid size-10 place-items-center rounded-full text-sp-text transition hover:bg-white/5 active:scale-90"
                        >
                            <Share2 size={19} />
                        </button>
                    )
                }
            />

            {loading ? (
                <div className="space-y-6">
                    <CardSkeleton />
                    <ListSkeleton rows={5} />
                </div>
            ) : isError || !data ? (
                <EmptyState
                    icon={WifiOff}
                    title="Failed to load contact."
                    action={
                        <Button variant="secondary" onClick={() => loadBalance()}>
                            <RotateCw size={16} />
                            Retry
                        </Button>
                    }
                />
            ) : (
                <>
                    {/* Balance Summary */}
                    <Card className="relative animate-rise-in overflow-hidden p-5">
                        <div
                            aria-hidden
                            className={cn(
                                "pointer-events-none absolute -top-16 -right-16 size-48 rounded-full blur-3xl",
                                data.balance > 0
                                    ? "bg-sp-success/15"
                                    : data.balance < 0
                                        ? "bg-sp-danger/15"
                                        : "bg-sp-primary/10"
                            )}
                        />

                        <div className="relative flex items-center gap-3">
                            <Avatar name={data.contact_name} className="size-11 text-base" />
                            <div className="min-w-0">
                                <p className="truncate font-semibold text-sp-text">{data.contact_name}</p>
                                <p className="text-xs font-medium uppercase tracking-wider text-sp-muted">
                                    Net Balance
                                </p>
                            </div>
                        </div>

                        <div className="relative mt-5">
                            {data.balance > 0 ? (
                                <>
                                    <p className="tabular text-4xl font-bold tracking-tight text-sp-success">
                                        +₹
                                        {formatINR(data.balance)}
                                    </p>

                                    <p className="mt-1 text-sm text-sp-muted">
                                        {data.contact_name} owes you
                                    </p>
                                </>
                            ) : data.balance < 0 ? (
                                <>
                                    <p className="tabular text-4xl font-bold tracking-tight text-sp-danger">
                                        -₹
                                        {formatINR(Math.abs(
                                            data.balance
                                        ))}
                                    </p>

                                    <p className="mt-1 text-sm text-sp-muted">
                                        You owe {data.contact_name}
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="tabular text-4xl font-bold tracking-tight text-sp-text">
                                        ₹0.00
                                    </p>

                                    <p className="mt-1 text-sm text-sp-muted">
                                        Settled
                                    </p>
                                </>
                            )}
                        </div>

                        <Button
                            block
                            className="relative mt-5"
                            onClick={() => {
                                setIndividualError(null);
                                setShowIndividualForm(true);
                            }}
                        >
                            <Plus size={18} />
                            Add Transaction
                        </Button>
                    </Card>

                    {/* Transaction History */}
                    <div className="mt-7">

                        {/* Header + Toggle */}
                        <div className="flex items-center gap-2">
                            <Segmented
                                className="flex-1"
                                value={showSettled ? "settled" : "unsettled"}
                                options={[
                                    ["unsettled", "Unsettled"],
                                    ["settled", "Settled"],
                                ] as const}
                                onChange={(value) => setShowSettled(value === "settled")}
                            />

                            <button
                                type="button"
                                onClick={() => setShowSort(true)}
                                aria-label="Sort transactions"
                                className="grid size-11 shrink-0 place-items-center rounded-sp-md bg-sp-card text-sp-muted ring-1 ring-sp-border transition hover:text-sp-text active:scale-95"
                            >
                                <ArrowUpDown size={18} />
                            </button>
                        </div>

                        {data.transactions.length === 0 ? (
                            <EmptyState
                                icon={showSettled ? CheckCheck : ReceiptText}
                                title="No transactions with this contact."
                            />
                        ) : (
                            <div className="mt-2 space-y-4">
                                {groups.map((group) => (
                                    <section key={`${group.day}-${rowIndex}`}>
                                        <h2 className="sticky-under-header -mx-4 bg-sp-bg/95 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-sp-muted backdrop-blur">
                                            {group.day}
                                        </h2>

                                        <div className="divide-y divide-sp-border overflow-hidden rounded-sp-lg border border-sp-border bg-sp-card">
                                            {group.items.map(({ transaction, time }) => {
                                                const remainingAmount = Number(transaction.remaining_amount);
                                                const settledAmount = Number(transaction.settled_amount);

                                                const totalAmount =
                                                    Math.abs(remainingAmount) + settledAmount;
                                                const settledPercent =
                                                    totalAmount > 0 ? (settledAmount / totalAmount) * 100 : 0;

                                                const title = transaction.type === "expense"
                                                    ? transaction.note ||
                                                    "Untitled transaction"
                                                    : transaction.direction === "lend"
                                                        ? "You lent"
                                                        : "You borrowed";
                                                const subtitle = transaction.type === "expense"
                                                    ? `${time} · ${transaction.paid_by}`
                                                    : `${time} · ${transaction.note || "Individual transaction"}`;

                                                return (
                                                    <div
                                                        key={
                                                            transaction.type === "individual"
                                                                ? `individual-${transaction.individual_transaction_id}`
                                                                : `expense-${transaction.split_id}`
                                                        }
                                                        style={{ animationDelay: `${Math.min(rowIndex++, 10) * 30}ms` }}
                                                        className="animate-rise-in px-4 py-3.5"
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            {/* Transaction */}
                                                            {transaction.type === "expense" ? (
                                                                <Link
                                                                    href={`/transactions/${transaction.id}`}
                                                                    className="group min-w-0 flex-1 active:opacity-70"
                                                                >
                                                                    <p className="flex items-center gap-1 text-[15px] font-medium text-sp-text">
                                                                        <span className="truncate">{title}</span>
                                                                        <ChevronRight size={15} className="shrink-0 text-sp-muted/60 transition group-hover:translate-x-0.5" />
                                                                    </p>

                                                                    <p className="mt-0.5 truncate text-xs text-sp-muted">
                                                                        {subtitle}
                                                                    </p>
                                                                </Link>
                                                            ) : (
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="flex items-center gap-1.5 text-[15px] font-medium text-sp-text">
                                                                        <span className="truncate">{title}</span>
                                                                        <span className="shrink-0 rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sp-muted">
                                                                            Personal
                                                                        </span>
                                                                    </p>

                                                                    <p className="mt-0.5 truncate text-xs text-sp-muted">
                                                                        {subtitle}
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {/* Amount */}
                                                            <p
                                                                className={cn(
                                                                    "tabular shrink-0 text-[15px] font-semibold",
                                                                    transaction.amount > 0
                                                                        ? "text-sp-success"
                                                                        : transaction.amount < 0
                                                                            ? "text-sp-danger"
                                                                            : "text-sp-text"
                                                                )}
                                                            >
                                                                {transaction.amount > 0
                                                                    ? "+"
                                                                    : transaction.amount < 0
                                                                        ? "-"
                                                                        : ""}
                                                                ₹
                                                                {formatINR(Math.abs(
                                                                    showSettled
                                                                        ? Number(transaction.settled_amount)
                                                                        : Number(transaction.remaining_amount)
                                                                ))}
                                                            </p>
                                                        </div>

                                                        {/* Settlement progress */}
                                                        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/5">
                                                            <div
                                                                className="h-full rounded-full bg-sp-success/70 transition-[width] duration-(--dur-slow)"
                                                                style={{ width: `${settledPercent}%` }}
                                                            />
                                                        </div>

                                                        <div className="mt-2.5 flex items-center gap-2">
                                                            <p className="tabular min-w-0 flex-1 text-xs leading-relaxed text-sp-muted">
                                                                ₹{formatINR(settledAmount)} settled of ₹{formatINR(totalAmount)} total
                                                                <span className="mx-1 text-sp-muted/50">·</span>
                                                                ₹{formatINR(Math.abs(remainingAmount))} remaining
                                                            </p>

                                                            {transaction.type === "individual" &&
                                                                transaction.settled_amount === 0 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setDeleteIndividualId(
                                                                                transaction.individual_transaction_id!
                                                                            )
                                                                        }
                                                                        aria-label="Delete transaction"
                                                                        className="grid size-9 shrink-0 place-items-center rounded-full text-sp-muted transition hover:bg-sp-danger/10 hover:text-sp-danger active:scale-90"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                )}
                                                            <Button
                                                                size="sm"
                                                                variant={showSettled ? "secondary" : "primary"}
                                                                className="shrink-0"
                                                                onClick={() =>
                                                                    showSettled
                                                                        ? handleUnsettle(transaction)
                                                                        : openSettleModal(transaction)
                                                                }
                                                            >
                                                                {showSettled ? <Undo2 size={14} /> : <Check size={14} />}
                                                                {showSettled ? "Unsettle" : "Settle"}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            <Sheet open={showSort} onClose={() => setShowSort(false)} title="Sort">
                <div className="space-y-1 px-3 pb-4">
                    {[
                        ["newest", "Newest first"],
                        ["oldest", "Oldest first"],
                        ["high", "Amount: high → low"],
                        ["low", "Amount: low → high"],
                    ].map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => {
                                setSortBy(
                                    value as
                                    | "newest"
                                    | "oldest"
                                    | "high"
                                    | "low"
                                );
                                setShowSort(false);
                            }}
                            className={cn(
                                "flex h-12 w-full items-center justify-between rounded-sp-md px-4 text-[15px] transition-colors active:scale-[0.99]",
                                sortBy === value
                                    ? "bg-sp-primary/15 font-medium text-sp-text"
                                    : "text-sp-muted hover:bg-white/5 hover:text-sp-text"
                            )}
                        >
                            <span>{label}</span>

                            {sortBy === value && <Check size={18} className="text-sp-primary" />}
                        </button>
                    ))}
                </div>
            </Sheet>

            <Sheet open={settleTransaction !== null} onClose={closeSettleModal} title="Settle">
                <div className="px-5 pb-5">
                    <div className="rounded-sp-md bg-sp-card p-4 ring-1 ring-sp-border">
                        <p className="text-xs font-medium uppercase tracking-wider text-sp-muted">
                            Remaining
                        </p>

                        <p className="tabular mt-1 text-3xl font-bold tracking-tight text-sp-text">
                            ₹
                            {formatINR(Number(
                                retainedSettleTransaction?.remaining_amount ?? 0
                            ))}
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

            <Dialog
                open={deleteIndividualId !== null}
                onClose={() => {
                    if (!deletingIndividual) setDeleteIndividualId(null);
                }}
                title="Delete Transaction?"
                description="This will permanently delete this personal lend/borrow transaction."
                actions={
                    <>
                        <Button
                            variant="secondary"
                            onClick={() => setDeleteIndividualId(null)}
                            disabled={deletingIndividual}
                        >
                            Cancel
                        </Button>

                        <Button
                            variant="danger"
                            onClick={handleDeleteIndividualTransaction}
                            loading={deletingIndividual}
                        >
                            Delete
                        </Button>
                    </>
                }
            />

            <Sheet
                open={showIndividualForm}
                onClose={() => {
                    setShowIndividualForm(false);
                    setIndividualError(null);
                }}
                title="Add Transaction"
            >
                <div className="px-5 pb-5">
                    <p className="mb-2 text-sm font-medium text-sp-muted">
                        What happened?
                    </p>

                    <Segmented
                        value={individualDirection}
                        options={[
                            ["lend", "You lent"],
                            ["borrow", "You borrowed"],
                        ] as const}
                        onChange={setIndividualDirection}
                    />

                    <Field label="Amount" className="mt-5">
                        {(id) => (
                            <Input
                                id={id}
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.01"
                                value={individualAmount}
                                onChange={(event) =>
                                    setIndividualAmount(event.target.value)
                                }
                                placeholder="0.00"
                                className="tabular h-14 text-2xl font-semibold"
                            />
                        )}
                    </Field>

                    <Field label="Note" className="mt-4">
                        {(id) => (
                            <Input
                                id={id}
                                type="text"
                                value={individualNote}
                                onChange={(event) =>
                                    setIndividualNote(event.target.value)
                                }
                                placeholder="Optional"
                            />
                        )}
                    </Field>

                    <Field label="Date & Time" className="mt-4">
                        {(id) => (
                            <Input
                                id={id}
                                type="datetime-local"
                                value={individualDateTime}
                                onChange={(event) =>
                                    setIndividualDateTime(event.target.value)
                                }
                            />
                        )}
                    </Field>

                    {individualError && (
                        <p className="mt-4 animate-fade-in rounded-sp-md bg-sp-danger/10 px-4 py-3 text-sm text-sp-danger">
                            {individualError}
                        </p>
                    )}

                    <div className="mt-6 flex gap-3 [&>*]:flex-1">
                        <Button
                            size="lg"
                            variant="secondary"
                            onClick={() => {
                                setShowIndividualForm(false);
                                setIndividualError(null);
                            }}
                        >
                            Cancel
                        </Button>

                        <Button
                            size="lg"
                            loading={savingIndividual}
                            onClick={handleCreateIndividualTransaction}
                        >
                            Add Transaction
                        </Button>
                    </div>
                </div>
            </Sheet>

            {data && (
                <ShareStatementSheet
                    open={showShare}
                    onClose={() => setShowShare(false)}
                    contactId={contactId}
                    contactName={data.contact_name}
                />
            )}
        </main>
    );
}
