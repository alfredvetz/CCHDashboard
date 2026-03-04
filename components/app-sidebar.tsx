import React from "react";
import Link from "next/link";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarSeparator,
} from "./ui/sidebar";
import Image from "next/image";
import { NavMenu } from "./nav-menu";
import { dashboardMenu, footerMenu } from "@/static/sidebar.static";
import { NavFooter } from "./nav-footer";

export default function AppSidebar({
    ...props
}: {
    props?: React.ComponentProps<typeof Sidebar>;
}) {
    return (
        <Sidebar variant="sidebar" {...props}>
            <SidebarHeader className="px-4 pt-5 pb-4">
                <SidebarMenu>
                    <Link
                        href="/"
                        className="w-full flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--logo-primary)/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121144] rounded-lg -m-1 p-1 transition-opacity hover:opacity-95"
                    >
                        <div className="relative flex aspect-square size-11 shrink-0 items-center justify-center rounded-lg overflow-hidden bg-white/5 text-sidebar-primary-foreground">
                            <Image
                                src="/logo/choicefavicon.ico"
                                alt="Choice CRM"
                                fill
                                unoptimized
                                className="object-contain p-1"
                            />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-yellow-logo text-2xl font-semibold tracking-tight leading-none">
                                Choice
                            </span>
                            <span className="text-yellow-logo/90 text-[11px] font-medium uppercase tracking-widest mt-0.5">
                                Community Health
                            </span>
                        </div>
                    </Link>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent className="px-2">
                <NavMenu items={dashboardMenu} title="Menu" />
            </SidebarContent>
            <SidebarSeparator className="bg-white/10" />
            <SidebarFooter className="px-2 pb-4">
                <NavFooter items={footerMenu} />
            </SidebarFooter>
        </Sidebar>
    );
}
