import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
    invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
    { invalid, className, ...props },
    ref
) {
    return (
        <input
            ref={ref}
            aria-invalid={invalid || undefined}
            className={cn(
                "h-12 w-full rounded-sp-md border bg-sp-card px-4 text-base text-sp-text placeholder:text-sp-muted",
                "outline-none transition-[border-color,box-shadow] duration-(--dur-fast)",
                "focus:border-sp-primary focus:ring-4 focus:ring-sp-primary/20",
                invalid ? "border-sp-danger/70" : "border-sp-border",
                className
            )}
            {...props}
        />
    );
});

type FieldProps = {
    label?: string;
    error?: string;
    hint?: string;
    className?: string;
    children: (id: string) => React.ReactNode;
};

export function Field({ label, error, hint, className, children }: FieldProps) {
    const id = useId();

    return (
        <div className={cn("space-y-1.5", className)}>
            {label && (
                <label htmlFor={id} className="block text-sm font-medium text-sp-muted">
                    {label}
                </label>
            )}
            {children(id)}
            {error ? (
                <p className="animate-fade-in text-sm text-sp-danger">{error}</p>
            ) : hint ? (
                <p className="text-sm text-sp-muted">{hint}</p>
            ) : null}
        </div>
    );
}
