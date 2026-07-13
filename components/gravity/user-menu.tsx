"use client";

/**
 * Logged-in user menu (avatar + dropdown). Links to profile, my tournaments,
 * dashboard (organizers), admin (superadmins), and sign out.
 */
import Link from "next/link";
import Image from "next/image";
import { User, Trophy, LayoutDashboard, Shield, LogOut } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  name,
  avatarUrl,
  isOrganizer,
  isSuperadmin,
}: {
  name: string;
  avatarUrl: string | null;
  isOrganizer: boolean;
  isSuperadmin: boolean;
}) {
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="size-9 overflow-hidden rounded-full border border-line transition-colors hover:border-crimson-500">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={name} width={36} height={36} className="size-full object-cover" unoptimized />
          ) : (
            <span className="grid size-full place-items-center bg-surface-2 font-display text-sm text-crimson-300">
              {initials || "GG"}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 border-line bg-surface-2">
        <div className="px-2 py-1.5 text-sm font-medium">{name}</div>
        <DropdownMenuSeparator className="bg-line" />
        <DropdownMenuItem asChild>
          <Link href={"/profile" as never}>
            <User className="size-4" /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={"/my-tournaments" as never}>
            <Trophy className="size-4" /> My tournaments
          </Link>
        </DropdownMenuItem>
        {isOrganizer || isSuperadmin ? (
          <DropdownMenuItem asChild>
            <Link href={"/dashboard" as never}>
              <LayoutDashboard className="size-4" /> Organizer dashboard
            </Link>
          </DropdownMenuItem>
        ) : null}
        {isSuperadmin ? (
          <DropdownMenuItem asChild>
            <Link href={"/admin" as never}>
              <Shield className="size-4" /> Admin console
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator className="bg-line" />
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
