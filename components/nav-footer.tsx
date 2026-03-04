"use client";
import * as LucideIcons from "lucide-react";
import {
    SidebarGroup,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { JustCallSidebarWidget } from "./just-call-sidebar-widget";

const iconMap: Record<string, LucideIcons.LucideIcon> = {
    LogOut: LucideIcons.LogOut,
};
export function NavFooter({
    items,
}: {
    items: {
        name: string;
        url: string;
        value: string;
        icon: string;
    }[];
}) {
    return (
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <JustCallSidebarWidget />
            <SidebarMenu>
                {items.map((item) => {
                    const Icon = iconMap[item.icon] || LucideIcons.Circle;

                    return (
                        <SidebarMenuItem key={item.name}>
                            <SidebarMenuButton
                                className="hover:bg-transparent"
                                asChild
                            >
                                <Link href={item.url} className={`py-5`}>
                                    <Icon />
                                    <span className="text-sm">{item.name}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    );
}
