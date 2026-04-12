"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Shield,
  LayoutDashboard,
  Monitor,
  FileText,
  AlertTriangle,
  Users,
  Building2,
  Key,
  Settings,
  LogOut,
  ChevronDown,
  ClipboardList,
  Download,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useRouter } from "next/navigation"
import type { Profile, Account } from "@/lib/types/database"

interface SecuritySidebarProps {
  profile: Profile
  account: Account
}

const mainNavItems = [
  {
    title: "Dashboard",
    href: "/securityAgent/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Endpoints",
    href: "/securityAgent/endpoints",
    icon: Monitor,
  },
  {
    title: "Threats",
    href: "/securityAgent/threats",
    icon: AlertTriangle,
  },
  {
    title: "Policies",
    href: "/securityAgent/policies",
    icon: FileText,
  },
  {
    title: "SecurityAgent Installers",
    href: "/securityAgent/installers",
    icon: Download,
  },
]

const managementNavItems = [
  {
    title: "Users",
    href: "/securityAgent/users",
    icon: Users,
    roles: ["super_admin", "admin"],
  },
  {
    title: "Sub-Accounts",
    href: "/securityAgent/accounts",
    icon: Building2,
    roles: ["super_admin"],
  },
  {
    title: "Licenses",
    href: "/securityAgent/licenses",
    icon: Key,
    roles: ["super_admin", "admin"],
  },
  {
    title: "Audit Logs",
    href: "/securityAgent/audit-logs",
    icon: ClipboardList,
    roles: ["super_admin", "admin"],
  },
]

export function SecuritySidebar({ profile, account }: SecuritySidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await fetch("/api/auth/local/logout", { method: "POST" })
    router.push("/securityAgent/auth/login")
  }

  const filteredManagementItems = managementNavItems.filter((item) => !item.roles || item.roles.includes(profile.role))

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <Shield className="h-8 w-8 text-sidebar-primary" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground">KuaminiThreatProtect</span>
            <span className="text-xs text-sidebar-foreground/60">Security Console</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {filteredManagementItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredManagementItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname === item.href}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/securityAgent/settings"}>
                  <Link href="/securityAgent/settings">
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <Collapsible>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-sm font-medium">
                    {profile.full_name?.charAt(0) || profile.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium">{profile.full_name || profile.email}</span>
                    <span className="text-xs text-sidebar-foreground/60 capitalize">
                      {profile.role.replace("_", " ")}
                    </span>
                  </div>
                  <ChevronDown className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild>
                      <Link href="/securityAgent/profile">Profile</Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton onClick={handleLogout} className="text-destructive cursor-pointer">
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign out
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        </SidebarMenu>
        <div className="px-2 py-2 text-xs text-sidebar-foreground/60">
          <div className="font-medium">{account.name}</div>
          <div>Level {account.level} Account</div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
