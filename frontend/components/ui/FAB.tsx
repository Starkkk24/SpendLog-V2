"use client";

import { Plus } from "lucide-react";

type FABProps = {
    label: string;
    onClick: () => void;
};

export default function FAB({ label, onClick }: FABProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="fixed bottom-24 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-2xl bg-sp-primary text-white shadow-xl transition hover:scale-105 hover:bg-sp-primary-deep active:scale-95 sm:right-8"
        >
            <Plus size={28} strokeWidth={2.5} />
        </button>
    );
}