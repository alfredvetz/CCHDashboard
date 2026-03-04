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
        <SidebarGroup className="group-data-[collapsible=icon]:hidden space-y-2">
            <div className="px-2 pt-2">
                <JustCallSidebarWidget />
            </div>
            <SidebarMenu className="gap-0.5">
                {items.map((item) => {
                    const Icon = iconMap[item.icon] || LucideIcons.Circle;

                    return (
                        <SidebarMenuItem key={item.name}>
                            <SidebarMenuButton
                                className="rounded-lg h-10 px-3 font-medium text-sidebar-foreground/90 hover:bg-white/10 hover:text-sidebar-foreground transition-colors"
                                asChild
                            >
                                <Link href={item.url}>
                                    <Icon className="size-4 shrink-0" />
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
