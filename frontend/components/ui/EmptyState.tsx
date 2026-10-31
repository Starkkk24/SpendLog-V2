import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: React.ReactNode;
};

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="flex animate-rise-in flex-col items-center px-6 py-14 text-center">
            <div className="mb-4 grid size-14 place-items-center rounded-full bg-sp-card text-sp-muted">
                <Icon size={26} />
            </div>
            <p className="font-semibold text-sp-text">{title}</p>
            {description && <p className="mt-1 max-w-xs text-sm text-sp-muted">{description}</p>}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}
