import BottomNav from "@/components/navigation/BottomNav";

export default function MainLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="min-h-screen bg-sp-bg pb-24 text-white">
            {children}

            <BottomNav />
        </div>
    );
}