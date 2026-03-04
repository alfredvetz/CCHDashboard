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
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.15em] text-sidebar-foreground/50 px-3 py-2">
                {title}
            </SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
                {items.map((item) => {
                    const Icon = iconMap[item.icon] || LucideIcons.Circle;
                    const isActive = isActiveRoute(item.url);

                    return (
                        <SidebarMenuItem key={item.name}>
                            <SidebarMenuButton
                                className="rounded-lg h-10 px-3 font-medium transition-colors hover:bg-royal-blue/90 hover:text-white data-[active=true]:bg-royal-blue data-[active=true]:text-white"
                                asChild
                                isActive={isActive}
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
