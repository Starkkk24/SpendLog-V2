"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Copy, MessageCircle, RotateCw, Share2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import Segmented from "@/components/ui/Segmented";
import Sheet from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { getStatement, type StatementStatus } from "@/services/balance";
import { buildStatementMessage, statementBounds, type StatementRow } from "@/lib/statement";
import { renderStatementImage } from "@/lib/statementImage";

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

    // Rendered ahead of the tap: browsers only allow navigator.share right
    // after a user gesture, so there's no time to draw the image on click.
    const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
    const [imageFailed, setImageFailed] = useState(false);

    useEffect(() => {
        if (!data) return;
        let cancelled = false;

        renderStatementImage({ contactName, status, from, to, ...data })
            .then((blob) => {
                if (cancelled) return;
                setImage({ blob, url: URL.createObjectURL(blob) });
                setImageFailed(false);
            })
            .catch(() => {
                if (cancelled) return;
                setImage(null);
                setImageFailed(true);
            });

        return () => {
            cancelled = true;
        };
    }, [data, contactName, status, from, to]);

    // Freed only once the next image replaces it, so the preview never flashes blank.
    useEffect(() => () => {
        if (image) URL.revokeObjectURL(image.url);
    }, [image]);

    async function handleShareImage() {
        if (!image) return;

        const fileName = `SpendLog-${contactName.trim().replace(/[^\w-]+/g, "-") || "statement"}.png`;
        const file = new File([image.blob], fileName, { type: "image/png" });

        // Phones open the system share sheet (WhatsApp included); desktops,
        // and plain-HTTP LAN testing, download the image instead.
        if (navigator.canShare?.({ files: [file] })) {
            try {
                await navigator.share({ files: [file] });
            } catch (error) {
                if ((error as DOMException).name !== "AbortError") {
                    toast.error("Couldn't share the image");
                }
            }
            return;
        }

        const link = document.createElement("a");
        link.href = image.url;
        link.download = fileName;
        link.click();
        toast.success("Image downloaded");
    }

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
        <Sheet open={open} onClose={onClose} title="Share statement">
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

                <div className="max-h-80 overflow-y-auto rounded-sp-md ring-1 ring-sp-border">
                    {isError ? (
                        <div className="flex items-center justify-between gap-3 bg-sp-card p-4 text-sm">
                            <p className="text-sp-danger">Couldn&apos;t load transactions.</p>
                            <Button size="sm" variant="secondary" onClick={() => void refetch()}>
                                <RotateCw size={14} />
                                Retry
                            </Button>
                        </div>
                    ) : imageFailed ? (
                        <p className="bg-sp-card p-4 text-sm text-sp-danger">
                            Couldn&apos;t create the image. You can still share as text.
                        </p>
                    ) : isPending || !image ? (
                        <div className="space-y-2 bg-sp-card p-4">
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-5/6" />
                        </div>
                    ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- local blob URL
                        <img
                            src={image.url}
                            alt={`Statement of expenses with ${contactName}`}
                            className="block w-full"
                        />
                    )}
                </div>

                <div className="mt-5 grid grid-cols-[auto_auto_1fr] gap-2">
                    <Button
                        size="lg"
                        variant="secondary"
                        onClick={handleCopy}
                        disabled={!message || rangeInvalid}
                        aria-label="Copy as text"
                        title="Copy as text"
                    >
                        <Copy size={18} />
                    </Button>

                    <Button
                        size="lg"
                        variant="secondary"
                        onClick={handleWhatsApp}
                        disabled={!message || rangeInvalid}
                        aria-label="Send as text on WhatsApp"
                        title="Send as text on WhatsApp"
                    >
                        <MessageCircle size={18} />
                    </Button>

                    <Button
                        size="lg"
                        onClick={handleShareImage}
                        disabled={!image || rangeInvalid}
                    >
                        <Share2 size={18} />
                        Share image
                    </Button>
                </div>
            </div>
        </Sheet>
    );
}
