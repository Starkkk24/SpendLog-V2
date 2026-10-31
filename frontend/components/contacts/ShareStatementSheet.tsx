"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Copy, MessageCircle, RotateCw } from "lucide-react";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import Segmented from "@/components/ui/Segmented";
import Sheet from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { getStatement, type StatementStatus } from "@/services/balance";
import { buildStatementMessage, statementBounds, type StatementRow } from "@/lib/statement";

type ShareStatementSheetProps = {
    open: boolean;
    onClose: () => void;
    contactId: number;
    contactName: string;
};

async function copyText(text: string) {
    // The Clipboard API only exists on HTTPS, so LAN testing over plain
    // HTTP falls back to the legacy copy command.
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();

    if (!copied) throw new Error("Copy failed");
}

export default function ShareStatementSheet({
    open,
    onClose,
    contactId,
    contactName,
}: ShareStatementSheetProps) {
    const [status, setStatus] = useState<StatementStatus>("unsettled");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");

    const rangeInvalid = Boolean(from && to && from > to);

    const {
        data,
        isPending,
        isError,
        refetch,
    } = useQuery({
        // Under "contactBalance" so settling or adding a transaction refreshes it.
        queryKey: ["contactBalance", contactId, "statement", status, from, to],
        queryFn: async () => {
            const response = await getStatement(contactId, {
                status,
                ...statementBounds(from, to),
            });

            return {
                balance: Number(response.balance),
                rows: response.transactions.map((row: StatementRow) => ({
                    ...row,
                    amount: Number(row.amount),
                    settled_amount: Number(row.settled_amount),
                    remaining_amount: Number(row.remaining_amount),
                })) as StatementRow[],
            };
        },
        enabled: open && !rangeInvalid,
        // Keep the old preview on screen while a new filter loads.
        placeholderData: keepPreviousData,
    });

    const message = data
        ? buildStatementMessage({ contactName, status, from, to, ...data })
        : "";

    async function handleCopy() {
        try {
            await copyText(message);
            toast.success("Message copied");
        } catch {
            toast.error("Couldn't copy the message");
        }
    }

    function handleWhatsApp() {
        window.open(
            `https://wa.me/?text=${encodeURIComponent(message)}`,
            "_blank",
            "noopener,noreferrer"
        );
    }

    return (
        <Sheet open={open} onClose={onClose} title="Share on WhatsApp">
            <div className="px-5 pb-5">
                <Segmented
                    value={status}
                    options={[
                        ["unsettled", "Unsettled"],
                        ["settled", "Settled"],
                        ["all", "All"],
                    ] as const}
                    onChange={setStatus}
                />

                <div className="mt-4 grid grid-cols-2 gap-3">
                    <Field label="From">
                        {(id) => (
                            <Input
                                id={id}
                                type="date"
                                value={from}
                                max={to || undefined}
                                onChange={(event) => setFrom(event.target.value)}
                                invalid={rangeInvalid}
                            />
                        )}
                    </Field>

                    <Field label="To">
                        {(id) => (
                            <Input
                                id={id}
                                type="date"
                                value={to}
                                min={from || undefined}
                                onChange={(event) => setTo(event.target.value)}
                                invalid={rangeInvalid}
                            />
                        )}
                    </Field>
                </div>

                <div className="mt-1.5 flex min-h-6 items-center justify-between text-sm">
                    {rangeInvalid ? (
                        <p className="text-sp-danger">From must be on or before To.</p>
                    ) : (
                        <p className="text-sp-muted">Leave dates empty for all time.</p>
                    )}

                    {(from || to) && (
                        <button
                            type="button"
                            onClick={() => {
                                setFrom("");
                                setTo("");
                            }}
                            className="font-medium text-sp-primary"
                        >
                            Clear
                        </button>
                    )}
                </div>

                <p className="mt-4 mb-1.5 text-sm font-medium text-sp-muted">Preview</p>

                <div className="max-h-64 overflow-y-auto rounded-sp-md bg-sp-card p-4 ring-1 ring-sp-border">
                    {isError ? (
                        <div className="flex items-center justify-between gap-3 text-sm">
                            <p className="text-sp-danger">Couldn&apos;t load transactions.</p>
                            <Button size="sm" variant="secondary" onClick={() => void refetch()}>
                                <RotateCw size={14} />
                                Retry
                            </Button>
                        </div>
                    ) : isPending ? (
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-5/6" />
                        </div>
                    ) : (
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-sp-text">
                            {message}
                        </p>
                    )}
                </div>

                <div className="mt-5 grid grid-cols-[auto_1fr] gap-2">
                    <Button
                        size="lg"
                        variant="secondary"
                        onClick={handleCopy}
                        disabled={!message || rangeInvalid}
                        aria-label="Copy message"
                    >
                        <Copy size={18} />
                    </Button>

                    <Button
                        size="lg"
                        onClick={handleWhatsApp}
                        disabled={!message || rangeInvalid}
                    >
                        <MessageCircle size={18} />
                        Send on WhatsApp
                    </Button>
                </div>
            </div>
        </Sheet>
    );
}
