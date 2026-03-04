import AppSidebar from "@/components/app-sidebar";
import FilterDashboard from "@/components/filter-dashboard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { User } from "lucide-react";
import React from "react";

const getUserInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center px-6 bg-white border-b border-slate-100">
                    <div className="w-full flex flex-col md:flex-row justify-between gap-2">
                        <div className="flex items-center gap-2 px-2">
                            <SidebarTrigger className="-ml-1" />
                            <Separator
                                orientation="vertical"
                                className="hidden md:block h-4"
                            />
                        </div>
                        <div className="px-2 md:px-4 py-1 w-full flex justify-between items-center md:py-0">
                            <div className="">
                                <FilterDashboard />
                            </div>
                            <div className="flex justify-end">
                                <div className="flex items-center gap-6 ml-auto">
                                    <div className="flex flex-col items-end text-right">
                                        <span className="text-sm font-medium">
                                            User
                                        </span>
                                        <span className="text-xs font-bold text-muted-foreground">
                                            User@test.com
                                        </span>
                                    </div>
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src="" alt={"User"} />
                                        <AvatarFallback className="bg-[#d6e7f3] text-primary-foreground text-xs">
                                            <User color="#121144" />
                                        </AvatarFallback>
                                    </Avatar>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>
                <div className="flex flex-1 flex-col bg-[#FDFDFF] p-8 max-w-7xl mx-auto w-full space-y-8">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
