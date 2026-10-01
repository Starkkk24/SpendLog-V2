"use client";
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

    return (
        <main className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-2xl mx-auto">

                <h1 className="text-3xl font-bold mb-8">
                    Contacts
                </h1>

                {/* Create Contact */}
                <form
                    onSubmit={handleCreate}
                    className="flex gap-3 mb-8"
                >
                    <input
                        type="text"
                        placeholder="Contact name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="flex-1 p-3 rounded-lg text-white"
                    />

                    <button
                        type="submit"
                        disabled={submitting}
                        className="px-5 py-3 bg-blue-600 rounded-lg disabled:bg-gray-500"
                    >
                        {submitting ? "Adding..." : "Add"}
                    </button>
                </form>

                {/* Contact List */}
                {loading ? (
                    <p>Loading contacts...</p>
                ) : contacts.length === 0 ? (
                    <p className="text-gray-400">
                        No contacts yet.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {contacts.map((contact) => (
                            <div
                                key={contact.id}
                                className="bg-gray-800 p-4 rounded-lg"
                            >
                                {editingId === contact.id ? (
                                    <div className="flex gap-3">
                                        <input
                                            type="text"
                                            value={editingName}
                                            onChange={(e) =>
                                                setEditingName(e.target.value)
                                            }
                                            className="flex-1 p-2 rounded-lg text-black"
                                        />

                                        <button
                                            onClick={() => handleUpdate(contact.id)}
                                            disabled={submitting}
                                            className="px-4 py-2 bg-green-600 rounded-lg disabled:bg-gray-500"
                                        >
                                            Save
                                        </button>

                                        <button
                                            onClick={() => {
                                                setEditingId(null);
                                                setEditingName("");
                                            }}
                                            className="px-4 py-2 bg-gray-600 rounded-lg"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <Link
                                            href={`/contacts/${contact.id}`}
                                            className="text-blue-400 hover:text-blue-300"
                                        >
                                            {contact.name}
                                        </Link>

                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => {
                                                    setEditingId(contact.id);
                                                    setEditingName(contact.name);
                                                }}
                                                className="text-blue-400 hover:text-blue-300"
                                            >
                                                Edit
                                            </button>

                                            <button
                                                onClick={() =>
                                                    handleDelete(contact.id)
                                                }
                                                className="text-red-400 hover:text-red-300"
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
        </main>
    );
}