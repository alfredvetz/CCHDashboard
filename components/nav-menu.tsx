"use client";
import * as LucideIcons from "lucide-react";
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    //   useSidebar,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";

const iconMap: Record<string, LucideIcons.LucideIcon> = {
    LayoutDashboard: LucideIcons.LayoutDashboard,
    Home: LucideIcons.Home,
    Users: LucideIcons.Users,
    UserCog: LucideIcons.UserCog,
    BookUser: LucideIcons.BookUser,
    Newspaper: LucideIcons.Newspaper,
    Images: LucideIcons.Images,
    BarChart3: LucideIcons.BarChart3,
    TrendingUp: LucideIcons.TrendingUp,
    FileText: LucideIcons.FileText,
    Calendar: LucideIcons.Calendar,
    MapPin: LucideIcons.MapPin,
    Wallet: LucideIcons.Wallet,
    Settings: LucideIcons.Settings,
};
export function NavMenu({
    items,
    title,
}: {
    items: {
        name: string;
        url: string;
        value: string;
        icon: string;
    }[];
    title: string;
}) {
    const pathname = usePathname();

    const isActiveRoute = (itemUrl: string) => {
        if (pathname === itemUrl) return true;

        if (itemUrl !== "/" && pathname.startsWith(itemUrl + "/")) return true;

        return false;
    };

    return (
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>{title}</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => {
                    const Icon = iconMap[item.icon] || LucideIcons.Circle;

                    return (
                        <SidebarMenuItem key={item.name}>
                            <SidebarMenuButton
                                className="hover:bg-royal-blue"
                                asChild
                            >
                                <Link
                                    href={item.url}
                                    className={`${
                                        isActiveRoute(item.url)
                                            ? "bg-royal-blue"
                                            : ""
                                    } py-5`}
                                >
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
