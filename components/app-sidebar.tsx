import React from "react";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarSeparator,
} from "./ui/sidebar";
import Link from "next/link";
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
            <SidebarHeader>
                <SidebarMenu>
                    <div className="w-full flex justify-center items-center gap-4">
                        <div className="relative flex aspect-square size-12 items-center justify-center rounded-lg  text-sidebar-primary-foreground">
                            <Image
                                src="/logo/choicefavicon.ico"
                                alt="Logo"
                                fill
                                unoptimized
                                className="object-contain"
                            />
                        </div>
                        <div className="flex flex-col">
                            <p className="text-[#fdde80] text-4xl font-normal">
                                Choice
                            </p>
                            <p className="text-[#fdde80] text-[12px] uppercase">
                                Community Health
                            </p>
                        </div>
                    </div>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <NavMenu items={dashboardMenu} title="MENU" />
            </SidebarContent>
            <SidebarSeparator />
            <SidebarFooter>
                <NavFooter items={footerMenu} />
            </SidebarFooter>
        </Sidebar>
    );
}
