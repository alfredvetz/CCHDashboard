import DashboardContent from "./_component/dashboard-content";
import { Separator } from "@/components/ui/separator";

export default function DashboardPage() {
    return (
        <div className="w-full space-y-8 text-slate-800">
            <div className="flex flex-col gap-1">
                <span className="micro-label">Analytics</span>
                <h1>Dashboard</h1>
                <p className="text-slate-500 font-medium mt-1">
                    Revenue breakdown by month, revenue by area, new vs lost
                    clients, and existing client changes.
                </p>
            </div>
            <Separator className="mt-6 bg-slate-100" />
            <DashboardContent />
        </div>
    );
}
