/// <reference types="react/canary" />
import { ViewTransition } from "react";
import BottomNav from "@/components/navigation/BottomNav";
import FetchProgress from "@/components/navigation/FetchProgress";

export default function MainLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="min-h-dvh bg-sp-bg pb-nav text-sp-text">
            <FetchProgress />

            <ViewTransition>{children}</ViewTransition>

            <BottomNav />
        </div>
    );
}
