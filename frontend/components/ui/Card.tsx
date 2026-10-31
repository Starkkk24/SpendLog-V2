import { cn } from "@/lib/cn";

export default function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("rounded-sp-lg border border-sp-border bg-sp-card shadow-sp-card", className)}
            {...props}
        />
    );
}
