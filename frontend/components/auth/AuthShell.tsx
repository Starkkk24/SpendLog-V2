import Logo from "@/components/ui/Logo";

type AuthShellProps = {
    title: string;
    subtitle: string;
    footer: React.ReactNode;
    children: React.ReactNode;
};

export default function AuthShell({ title, subtitle, footer, children }: AuthShellProps) {
    return (
        <div className="relative flex min-h-dvh flex-col justify-center overflow-hidden bg-sp-bg px-5 pt-safe pb-safe">
            {/* Soft brand glow */}
            <div
                aria-hidden
                className="pointer-events-none absolute -top-40 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-sp-primary/20 blur-3xl"
            />

            <div className="relative mx-auto w-full max-w-sm animate-rise-in py-10">
                <div className="mb-8 text-center">
                    <Logo className="mx-auto mb-5 h-16 w-auto drop-shadow-[0_8px_24px_rgb(103_125_183/0.35)]" />
                    <h1 className="text-[28px] font-bold tracking-tight text-sp-text">{title}</h1>
                    <p className="mt-1.5 text-sp-muted">{subtitle}</p>
                </div>

                {children}

                <p className="mt-6 text-center text-sm text-sp-muted">{footer}</p>
            </div>
        </div>
    );
}
