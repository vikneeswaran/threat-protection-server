import type { ReactNode } from "react"; 
import { Toaster } from "react-hot-toast"; 
import AccountDropdown from "./components/AccountDropdown"; 
import { requireSessionUser } from "@/lib/auth/session"; 
import SessionSecurityGuard from "./components/SessionSecurityGuard";

const navItems = [ 
  { label: "Dashboard", href: "/securityAgent/dashboard" }, 
  { label: "Threats", href: "/securityAgent/threats" }, 
  { label: "Endpoints", href: "/securityAgent/endpoints" }, 
  { label: "Installers", href: "/securityAgent/installers" }, 
  { label: "Policy Management", href: "/securityAgent/policies" },
  ]; 
  export default async function SecurityAgentConsoleLayout(
    { children, }: 
    { 
      children: ReactNode; 

    }) 
    { 
      const user = await requireSessionUser(); 
      return ( 
      <div className="min-h-screen bg-slate-950 text-slate-100"> 
      <SessionSecurityGuard />
      <Toaster 
      position="top-right" 
      toastOptions={
        { 
        duration: 3000, 
        style: { background: "#0f172a", color: "#ffffff", border: "1px solid #334155", }, 
      }
      } /> 
      {/* Header */} 
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900"> 
  <div className="mx-auto flex max-w-[1600px] items-center justify-between px-3 py-4 sm:px-6 lg:px-8 lg:py-6"> 
    {/* Left */} 
    <h1 className="min-w-0 truncate text-xl font-bold sm:text-2xl lg:text-4xl"> 
      Kuamini Security Console 
    </h1> 
    {/* Right */} 
    {user && ( 
      <div className="ml-3 flex shrink-0 items-center gap-2 sm:gap-4"> 
      {/* Account Dropdown */} 
      <AccountDropdown /> 
      {/* Welcome Message */} 
      <div className="text-right sm:text-left"> 
        <p className="text-xs text-slate-400 sm:text-sm"> Welcome back, </p> 
        <p className="max-w-[90px] truncate text-sm font-semibold text-white sm:max-w-none"> 
          {user.full_name ?? "User"} 
        </p> 
        </div> 
        </div> 
        )} 
        </div> 
        </header> 
        {/* ================= MOBILE NAVIGATION ================= */} 
        <div className="border-b border-slate-800 bg-slate-900 lg:hidden"> 
          <nav className="grid grid-cols-2 gap-2 p-3"> 
            {navItems.map((item) => ( 
              <a key={item.href} href={item.href} 
              className="rounded-lg border border-slate-700 px-3 py-3 text-center text-sm font-medium transition-colors hover:bg-slate-800" 
              > 
              {item.label} 
              </a> 
              ))} 
              </nav> 
              </div> 
              {/* ================= DESKTOP + MAIN CONTENT ================= */} 
              <div className="mx-auto flex max-w-[1600px]"> 
                {/* Sidebar - Desktop only */} 
                <aside 
                className="hidden w-64 shrink-0 border-r border-slate-800 bg-slate-900 min-h-[calc(100vh-96px)] lg:block"> 
                <div className="p-5"> 
                  <nav className="flex flex-col gap-3"> 
                    {navItems.map((item) => ( 
                      <a key={item.href} href={item.href} 
                      className="rounded-lg border border-slate-700 px-5 py-4 text-sm font-medium transition-colors hover:bg-slate-800" > 
                      {item.label} 
                      </a>
                       ))} 
                       </nav> 
                       </div> 
                       </aside> 
                       {/* Main Content */} 
                       <main className="min-w-0 flex-1 px-3 py-5 sm:px-6 lg:px-8 lg:py-8"> 
                        {children} 
                        </main> 
                        </div> 
                        </div> 
                        ); 
                      }