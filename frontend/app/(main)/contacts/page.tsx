"use client";

import FAB from "@/components/ui/FAB";

import Link from "next/link";
import { useEffect, useState } from "react";
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
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState("");
    const [showCreateModal, setShowCreateModal] = useState(false);

    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"az" | "za">("az");
    const [showSort, setShowSort] = useState(false);

    async function loadContacts() {
        try {
            const data = await getContacts();
            setContacts(data);
        } catch (error) {
            console.error("Failed to load contacts:", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadContacts();
    }, []);

    async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!name.trim()) {
            return;
        }

        setSubmitting(true);

        try {
            const newContact = await createContact(name.trim());

            setContacts((currentContacts) => [
                ...currentContacts,
                newContact,
            ]);

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
            const updatedContact = await updateContact(
                id,
                editingName.trim()
            );

            setContacts((currentContacts) =>
                currentContacts.map((contact) =>
                    contact.id === id
                        ? updatedContact
                        : contact
                )
            );

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

            setContacts((currentContacts) =>
                currentContacts.filter((contact) => contact.id !== id)
            );
        } catch (error) {
            console.error("Failed to delete contact:", error);
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



    return (
        <main className="min-h-screen bg-sp-bg px-4 pb-24 pt-6 text-white sm:px-6">
            <div className="max-w-2xl mx-auto">

                <div className="mb-6">
                    <h1 className="text-2xl font-semibold">Contacts</h1>
                    <p className="mt-1 text-sm text-sp-muted">
                        Your people and balances
                    </p>
                </div>

                {/* Create Contact */}
                {showCreateModal && (
                    <div
                        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
                        onClick={() => setShowCreateModal(false)}
                    >
                        <div
                            className="w-full max-w-sm rounded-2xl bg-sp-surface p-5 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-white">
                                    Create Contact
                                </h2>

                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex h-9 w-9 items-center justify-center rounded-full text-sp-muted transition hover:bg-white/10 hover:text-white"
                                    aria-label="Close"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Form */}
                            <form
                                onSubmit={async (e) => {
                                    await handleCreate(e);
                                    setShowCreateModal(false);
                                }}
                                className="mt-5 space-y-4"
                            >
                                <input
                                    type="text"
                                    placeholder="Contact name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    autoFocus
                                    className="w-full rounded-xl bg-sp-bg px-4 py-3 text-white outline-none placeholder:text-sp-muted focus:ring-2 focus:ring-sp-primary"
                                />

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full rounded-xl bg-sp-primary px-4 py-3 text-sm font-medium text-white transition hover:bg-sp-primary-deep disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {submitting ? "Adding..." : "Add Contact"}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Contact List */}
                {loading ? (
                    <p>Loading contacts...</p>
                ) : contacts.length === 0 ? (
                    <p className="text-gray-400">
                        No contacts yet.
                    </p>
                ) : (
                    <div className="mt-8">

                        {/* Search + Sort */}
                        <div className="flex items-center gap-2">
                            <div className="flex min-w-0 flex-1 items-center rounded-xl bg-sp-surface px-4">
                                <span className="mr-2 text-sp-muted">
                                    🔍
                                </span>

                                <input
                                    type="text"
                                    placeholder="Search contacts..."
                                    value={searchQuery}
                                    onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                    }
                                    className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-sp-muted"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowSort(true)}
                                className="shrink-0 rounded-xl bg-sp-surface px-4 py-3 text-sm font-medium text-sp-muted transition hover:text-white"
                            >
                                Sort
                            </button>
                        </div>

                        {/* Contact label */}
                        <p className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wider text-sp-muted">
                            Contacts
                        </p>

                        {displayedContacts.length === 0 ? (
                            <p className="py-6 text-sm text-sp-muted">
                                No contacts found.
                            </p>
                        ) : (
                            <div>
                                {displayedContacts.map((contact) => (
                                    <div
                                        key={contact.id}
                                        className="border-b border-white/5"
                                    >
                                        {editingId === contact.id ? (
                                            <div className="flex gap-3 py-4">
                                                <input
                                                    type="text"
                                                    value={editingName}
                                                    onChange={(e) =>
                                                        setEditingName(e.target.value)
                                                    }
                                                    className="min-w-0 flex-1 rounded-xl bg-sp-surface px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-sp-primary"
                                                />

                                                <button
                                                    onClick={() =>
                                                        handleUpdate(contact.id)
                                                    }
                                                    disabled={submitting}
                                                    className="rounded-xl bg-sp-success px-4 py-2.5 text-sm font-medium text-sp-bg disabled:opacity-50"
                                                >
                                                    Save
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        setEditingId(null);
                                                        setEditingName("");
                                                    }}
                                                    className="rounded-xl bg-sp-surface px-4 py-2.5 text-sm text-sp-muted hover:text-white"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3 py-4">
                                                <Link
                                                    href={`/contacts/${contact.id}`}
                                                    className="flex min-w-0 flex-1 items-center gap-4"
                                                >
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sp-primary-deep text-sm font-semibold text-white">
                                                        {contact.name
                                                            .charAt(0)
                                                            .toUpperCase()}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-medium text-white">
                                                            {contact.name}
                                                        </p>
                                                    </div>

                                                    <span className="text-lg text-sp-muted">
                                                        →
                                                    </span>
                                                </Link>

                                                <div className="flex shrink-0 items-center gap-3">
                                                    <button
                                                        onClick={() => {
                                                            setEditingId(contact.id);
                                                            setEditingName(contact.name);
                                                        }}
                                                        className="text-xs text-sp-primary hover:text-white"
                                                    >
                                                        Edit
                                                    </button>

                                                    <button
                                                        onClick={() =>
                                                            handleDelete(contact.id)
                                                        }
                                                        className="text-xs text-red-400 hover:text-red-300"
                                                    >
                                                        Delete
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
                {showSort && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
                        <div className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-sp-bg p-5 shadow-2xl">
                            <div className="mb-5 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-white">
                                    Sort contacts
                                </h2>

                                <button
                                    type="button"
                                    onClick={() => setShowSort(false)}
                                    className="text-sp-muted transition hover:text-white"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSortBy("az");
                                        setShowSort(false);
                                    }}
                                    className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm transition ${sortBy === "az"
                                        ? "bg-sp-primary text-white"
                                        : "bg-sp-surface text-sp-muted hover:text-white"
                                        }`}
                                >
                                    <span>Name: A → Z</span>
                                    {sortBy === "az" && <span>✓</span>}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setSortBy("za");
                                        setShowSort(false);
                                    }}
                                    className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm transition ${sortBy === "za"
                                        ? "bg-sp-primary text-white"
                                        : "bg-sp-surface text-sp-muted hover:text-white"
                                        }`}
                                >
                                    <span>Name: Z → A</span>
                                    {sortBy === "za" && <span>✓</span>}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <FAB
                label="Create contact"
                onClick={() => setShowCreateModal(true)}
            />
        </main>
    );
}