import { cn } from "@/lib/cn";

export default function Spinner({ className }: { className?: string }) {
    return (
        <span
            role="status"
            aria-label="Loading"
            className={cn(
                "inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent",
                className
            )}
        />
    );
}
