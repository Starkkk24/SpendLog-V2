"use client";

import FAB from "@/components/ui/FAB";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import Sheet from "@/components/ui/Sheet";
import { ListSkeleton } from "@/components/ui/Skeleton";
import PageHeader from "@/components/navigation/PageHeader";
import { cn } from "@/lib/cn";
import { ArrowUpDown, Check, Pencil, RotateCw, Search, Trash2, UserPlus, Users, WifiOff, X } from "lucide-react";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    getContacts,
    createContact,
    deleteContact,
    updateContact,
} from "@/services/contacts";

interface Contact {
    id: number;
    name: string;
    owner: number;
    created_at: string;
}

export default function ContactsPage() {
    const queryClient = useQueryClient();

    const {
        data: contacts = [],
        isPending: loading,
        isError,
        error,
    } = useQuery<Contact[]>({
        queryKey: ["contacts"],
        queryFn: getContacts,
    });
    const [name, setName] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState("");
    const [showCreateModal, setShowCreateModal] = useState(false);

    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"az" | "za">("az");
    const [showSort, setShowSort] = useState(false);

    const [deleteContactId, setDeleteContactId] = useState<number | null>(null);
    const [deleteContactName, setDeleteContactName] = useState("");
    const [deleteError, setDeleteError] = useState<string | null>(null);


    async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!name.trim()) {
            return;
        }

        setSubmitting(true);

        try {
            await createContact(name.trim());

            await queryClient.invalidateQueries({
                queryKey: ["contacts"],
            });

            setName("");
        } catch (error) {
            console.error("Failed to create contact:", error);
        } finally {
            setSubmitting(false);
        }
    }

    async function handleUpdate(id: number) {
        if (!editingName.trim()) {
            return;
        }

        setSubmitting(true);

        try {
            await updateContact(id, editingName.trim());

            await queryClient.invalidateQueries({
                queryKey: ["contacts"],
            });

            setEditingId(null);
            setEditingName("");
        } catch (error) {
            console.error("Failed to update contact:", error);
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDelete(id: number) {
        try {
            await deleteContact(id);

            await queryClient.invalidateQueries({
                queryKey: ["contacts"],
            });
        } catch (error: any) {
            const message =
                error?.response?.data?.error ||
                "Unable to delete this contact.";

            setDeleteError(message);
        }
    }

    const displayedContacts = contacts
        .filter((contact) =>
            contact.name
                .toLowerCase()
                .includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
            const comparison = a.name.localeCompare(b.name);

            return sortBy === "az"
                ? comparison
                : -comparison;
        });

    if (isError) {
        console.error("Failed to load contacts:", error);

        return (
            <main className="page">
                <PageHeader title="Contacts" />
                <EmptyState
                    icon={WifiOff}
                    title="Failed to load contacts."
                    description="Please check your connection and try again."
                    action={
                        <Button
                            variant="secondary"
                            onClick={() => queryClient.invalidateQueries({
                                queryKey: ["contacts"],
                            })}
                        >
                            <RotateCw size={16} />
                            Retry
                        </Button>
                    }
                />
            </main>
        );
    }

    return (
        <main className="page">
            <PageHeader title="Contacts" subtitle="Your people and balances" />

            {/* Create Contact */}
            <Sheet
                open={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="Create Contact"
            >
                <form
                    onSubmit={async (e) => {
                        await handleCreate(e);
                        setShowCreateModal(false);
                    }}
                    className="space-y-4 px-5 pb-5"
                >
                    <Input
                        type="text"
                        placeholder="Contact name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoFocus
                    />

                    <Button type="submit" size="lg" block loading={submitting}>
                        Add Contact
                    </Button>
                </form>
            </Sheet>

            {/* Contact List */}
            {loading ? (
                <ListSkeleton rows={7} />
            ) : contacts.length === 0 ? (
                <EmptyState
                    icon={Users}
                    title="No contacts yet."
                    description="Add the people you split bills with."
                    action={
                        <Button onClick={() => setShowCreateModal(true)}>
                            <UserPlus size={16} />
                            Create contact
                        </Button>
                    }
                />
            ) : (
                <div>
                    {/* Search + Sort */}
                    <div className="sticky-under-header -mx-4 flex items-center gap-2 bg-sp-bg/95 px-4 pb-3 backdrop-blur">
                        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-sp-md border border-sp-border bg-sp-card px-3.5 transition focus-within:border-sp-primary focus-within:ring-4 focus-within:ring-sp-primary/20">
                            <Search size={18} className="shrink-0 text-sp-muted" />

                            <input
                                type="search"
                                placeholder="Search contacts..."
                                value={searchQuery}
                                onChange={(e) =>
                                    setSearchQuery(e.target.value)
                                }
                                className="min-w-0 flex-1 bg-transparent text-base text-sp-text outline-none placeholder:text-sp-muted"
                            />
                        </label>

                        <button
                            type="button"
                            onClick={() => setShowSort(true)}
                            aria-label="Sort contacts"
                            className="grid size-11 shrink-0 place-items-center rounded-sp-md border border-sp-border bg-sp-card text-sp-muted transition hover:text-sp-text active:scale-95"
                        >
                            <ArrowUpDown size={18} />
                        </button>
                    </div>

                    {/* Contact label */}
                    <p className="mb-2 mt-3 px-1 text-xs font-semibold uppercase tracking-wider text-sp-muted">
                        Contacts · {displayedContacts.length}
                    </p>

                    {displayedContacts.length === 0 ? (
                        <EmptyState icon={Search} title="No contacts found." description={`Nothing matches "${searchQuery}".`} />
                    ) : (
                        <div className="divide-y divide-sp-border overflow-hidden rounded-sp-lg border border-sp-border bg-sp-card">
                            {displayedContacts.map((contact, index) => (
                                <div
                                    key={contact.id}
                                    style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
                                    className="animate-rise-in"
                                >
                                    {editingId === contact.id ? (
                                        <div className="flex animate-fade-in items-center gap-2 p-3">
                                            <Input
                                                type="text"
                                                value={editingName}
                                                onChange={(e) =>
                                                    setEditingName(e.target.value)
                                                }
                                                autoFocus
                                                className="h-11 min-w-0 flex-1"
                                            />

                                            <button
                                                onClick={() =>
                                                    handleUpdate(contact.id)
                                                }
                                                disabled={submitting}
                                                aria-label="Save"
                                                className="grid size-11 shrink-0 place-items-center rounded-sp-md bg-sp-success text-sp-bg transition active:scale-95 disabled:opacity-50"
                                            >
                                                <Check size={20} />
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setEditingId(null);
                                                    setEditingName("");
                                                }}
                                                aria-label="Cancel"
                                                className="grid size-11 shrink-0 place-items-center rounded-sp-md bg-sp-surface text-sp-muted transition hover:text-sp-text active:scale-95"
                                            >
                                                <X size={20} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center pr-2 transition-colors hover:bg-white/[0.03]">
                                            <Link
                                                href={`/contacts/${contact.id}`}
                                                className="flex min-w-0 flex-1 items-center gap-3 py-3.5 pl-4 active:opacity-70"
                                            >
                                                <Avatar name={contact.name} />

                                                <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-sp-text">
                                                    {contact.name}
                                                </p>
                                            </Link>

                                            <div className="flex shrink-0 items-center">
                                                <button
                                                    onClick={() => {
                                                        setEditingId(contact.id);
                                                        setEditingName(contact.name);
                                                    }}
                                                    aria-label={`Edit ${contact.name}`}
                                                    className="grid size-10 place-items-center rounded-full text-sp-muted transition hover:bg-white/5 hover:text-sp-text active:scale-90"
                                                >
                                                    <Pencil size={17} />
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        setDeleteContactId(contact.id);
                                                        setDeleteContactName(contact.name);
                                                    }}
                                                    aria-label={`Delete ${contact.name}`}
                                                    className="grid size-10 place-items-center rounded-full text-sp-muted transition hover:bg-sp-danger/10 hover:text-sp-danger active:scale-90"
                                                >
                                                    <Trash2 size={17} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <Sheet open={showSort} onClose={() => setShowSort(false)} title="Sort contacts">
                <div className="space-y-1 px-3 pb-4">
                    {([
                        ["az", "Name: A → Z"],
                        ["za", "Name: Z → A"],
                    ] as const).map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => {
                                setSortBy(value);
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

            <FAB
                label="Create contact"
                onClick={() => setShowCreateModal(true)}
            />

            <Dialog
                open={deleteContactId !== null}
                onClose={() => {
                    setDeleteContactId(null);
                    setDeleteContactName("");
                }}
                title="Delete Contact?"
                description={
                    <>
                        Are you sure you want to delete{" "}
                        <span className="font-medium text-sp-text">
                            {deleteContactName}
                        </span>
                        ?
                    </>
                }
                actions={
                    <>
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setDeleteContactId(null);
                                setDeleteContactName("");
                            }}
                        >
                            Cancel
                        </Button>

                        <Button
                            variant="danger"
                            onClick={async () => {
                                if (deleteContactId === null) return;

                                const id = deleteContactId;

                                setDeleteContactId(null);
                                setDeleteContactName("");

                                await handleDelete(id);
                            }}
                        >
                            Delete
                        </Button>
                    </>
                }
            />

            <Dialog
                open={!!deleteError}
                onClose={() => setDeleteError(null)}
                title="Cannot Delete Contact"
                description={deleteError}
                actions={<Button onClick={() => setDeleteError(null)}>OK</Button>}
            />
        </main>
    );
}
