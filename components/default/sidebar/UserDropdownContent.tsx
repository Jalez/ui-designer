import { BarChart3, Bot, HelpCircle, LogOut, User } from "lucide-react";
import Link from "next/link";
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ThemeSwitcher } from "./ThemeSwitcher";

interface UserDropdownContentProps {
    getUserName: () => string;
    handleSignOut: () => void;
}

export const UserDropdownContent: React.FC<UserDropdownContentProps> = ({ getUserName, handleSignOut }) => {
    return (
        <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col">
                    <span className="font-medium text-sm">{getUserName()}</span>
                </div>{" "}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
                <Link href="/account" className="flex items-center cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Account</span>
                </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
                <Link href="/statistics" className="flex items-center cursor-pointer">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    <span>Statistics</span>
                </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
                <Link href="/help" className="flex items-center cursor-pointer">
                    <HelpCircle className="mr-2 h-4 w-4" />
                    <span>Help & Support</span>
                </Link>
            </DropdownMenuItem>

            <ThemeSwitcher />

            <DropdownMenuItem asChild>
                <Link href="/account#ai-settings" className="flex items-center cursor-pointer">
                    <Bot className="mr-2 h-4 w-4" />
                    <span>AI Settings</span>
                </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-red-600 dark:text-red-400">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
            </DropdownMenuItem>
        </DropdownMenuContent>
    );
};
