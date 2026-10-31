import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import Spinner from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    block?: boolean;
};

const variants: Record<Variant, string> = {
    primary: "bg-sp-primary text-white shadow-sp-card hover:brightness-110",
    secondary: "bg-sp-surface text-sp-text hover:bg-white/15",
    ghost: "bg-transparent text-sp-text hover:bg-white/5",
    danger: "bg-sp-danger/15 text-sp-danger hover:bg-sp-danger/25",
};

const sizes: Record<Size, string> = {
    sm: "h-9 px-3 text-sm rounded-sp-sm",
    md: "h-11 px-4 text-[15px] rounded-sp-md",
    lg: "h-13 px-5 text-base rounded-sp-md",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = "primary", size = "md", loading, block, disabled, className, children, ...props },
    ref
) {
    return (
        <button
            ref={ref}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            className={cn(
                "relative inline-flex select-none items-center justify-center gap-2 font-medium",
                "transition-[transform,filter,background-color] duration-(--dur-fast) ease-(--ease-out)",
                "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
                variants[variant],
                sizes[size],
                block && "w-full",
                className
            )}
            {...props}
        >
            {/* Content stays in the layout while loading so the width never jumps. */}
            <span className={cn("inline-flex items-center gap-2", loading && "invisible")}>
                {children}
            </span>
            {loading && (
                <span className="absolute inset-0 grid place-items-center">
                    <Spinner />
                </span>
            )}
        </button>
    );
});

export default Button;
