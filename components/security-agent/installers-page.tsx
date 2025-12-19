"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Download, Monitor, Apple, Terminal, Copy, CheckCircle, Info, Server, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Profile, Account } from "@/lib/types/database"

interface InstallersPageProps {
  profile: Profile
  account: Account
}

export function InstallersPage({ profile, account }: InstallersPageProps) {
  const router = useRouter()
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)
  const [baseUrl, setBaseUrl] = useState("")
  const [downloadingInstaller, setDownloadingInstaller] = useState<string | null>(null)

  useEffect(() => {
    setBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || "https://kuaminisystems.com")
  }, [])

  const registrationToken = Buffer.from(
    JSON.stringify({
      accountId: account.id,
      accountName: account.name,
      timestamp: Date.now(),
    }),
  ).toString("base64")

  const copyToClipboard = async (text: string, commandType: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedCommand(commandType)
    toast.success("Copied to clipboard!")
    setTimeout(() => setCopiedCommand(null), 2000)
  }

  const openScriptPage = (os: string) => {
    router.push(`/securityAgent/installers/script/${os}?token=${registrationToken}`)
  }

  const downloadInstaller = async (platform: string) => {
    try {
      setDownloadingInstaller(platform)
      toast.info(`Generating ${platform} installer...`)

      const response = await fetch(
        `/api/agent/installers/download?platform=${platform}&accountId=${account.id}`,
        {
          method: "GET",
        },
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to download installer")
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition")
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const filename = filenameMatch ? filenameMatch[1] : `kuamini-agent-${platform}`

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success(`Installer downloaded successfully!`)
    } catch (error) {
      console.error("Download error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to download installer")
    } finally {
      setDownloadingInstaller(null)
    }
  }

  const downloadUninstaller = (platform: string) => {
    const uninstallerUrl = `/securityAgent/api/agent/uninstall/download/${platform}`
    const a = document.createElement("a")
    a.href = uninstallerUrl
    a.download = `uninstall-kuamini-agent-${platform}${platform === "windows" ? ".ps1" : ".sh"}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success("Uninstaller downloaded!")
  }

  const availableLicenses = account.total_licenses - account.used_licenses

  const installers = [
    {
      id: "windows",
      name: "Windows",
      icon: Monitor,
      version: "1.0.0",
      size: "~12 MB",
      fileType: "PowerShell Script (.ps1)",
      requirements: "Windows 10/11, Server 2016+, PowerShell 5.1+",
      filename: "Install-KuaminiAgent.ps1",
      description:
        "PowerShell installer script that automatically downloads and installs the agent as a Windows Scheduled Task with automatic startup. Pre-configured for your account.",
    },
    {
      id: "macos",
      name: "macOS",
      icon: Apple,
      version: "1.0.0",
      size: "~15 MB",
      fileType: "PKG Installer (.pkg)",
      requirements: "macOS 11 (Big Sur) or later",
      filename: "KuaminiAgentTray.pkg",
      description: "macOS installer package that automatically installs and configures the agent as a LaunchAgent with your account credentials embedded.",
    },
    {
      id: "linux",
      name: "Linux",
      icon: Terminal,
      version: "1.0.0",
      size: "~8 MB",
      fileType: "Shell Script (.sh)",
      requirements: "Ubuntu 20.04+, RHEL 8+, Debian 10+, systemd",
      filename: "install-kuamini-agent.sh",
      description: "Shell script that installs the agent as a systemd service for continuous monitoring. Pre-configured for automatic registration.",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">SecurityAgent Installers</h1>
        <p className="text-muted-foreground mt-1">Download and install KuaminiThreatProtectAgent on your endpoints</p>
      </div>

      <Alert variant={availableLicenses > 0 ? "default" : "destructive"}>
        <Info className="h-4 w-4" />
        <AlertTitle>License Status</AlertTitle>
        <AlertDescription>
          {availableLicenses > 0 ? (
            <>
              You have <strong>{availableLicenses}</strong> available license(s) out of{" "}
              <strong>{account.total_licenses}</strong> total. Each new endpoint installation will consume one license.
            </>
          ) : (
            <>
              You have no available licenses. Please upgrade your plan or allocate more licenses to install agents on
              new endpoints.
            </>
          )}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Installation Details
          </CardTitle>
          <CardDescription>
            Agents installed using these links will be automatically associated with your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Account</p>
              <p className="font-medium">{account.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Account ID</p>
              <p className="font-mono text-sm">{account.id.slice(0, 8)}...</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">License Tier</p>
              <Badge variant="secondary">{account.license_tier?.name || "Free"}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="macos" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          {installers.map((installer) => (
            <TabsTrigger key={installer.id} value={installer.id} className="flex items-center gap-2">
              <installer.icon className="h-4 w-4" />
              {installer.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {installers.map((installer) => (
          <TabsContent key={installer.id} value={installer.id}>
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <installer.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        KuaminiThreatProtectAgent for {installer.name}
                        <Badge variant="outline">v{installer.version}</Badge>
                      </CardTitle>
                      <CardDescription>{installer.description}</CardDescription>
                    </div>
                  </div>
                  <Button 
                    size="lg" 
                    disabled={availableLicenses <= 0 || downloadingInstaller === installer.id} 
                    onClick={() => downloadInstaller(installer.id)}
                  >
                    {downloadingInstaller === installer.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download Installer
                      </>
                    )}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => downloadUninstaller(installer.id)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Uninstaller
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">File Type</p>
                    <p className="font-medium">{installer.fileType}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">File Size</p>
                    <p className="font-medium">{installer.size}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Requirements</p>
                    <p className="font-medium text-xs">{installer.requirements}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Filename</p>
                    <p className="font-mono text-xs break-all">{installer.filename}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Quick Installation Steps</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Click "Download Installer" button above</li>
                    <li>The installer will be customized with your account credentials</li>
                    <li>
                      Run the installer with administrator/root privileges on your endpoint
                      {installer.id === "macos" && " (double-click the PKG file)"}
                      {installer.id === "windows" && " (right-click → Run as Administrator)"}
                      {installer.id === "linux" && " (sudo bash install-kuamini-agent.sh)"}
                    </li>
                    <li>The agent will automatically register with your account</li>
                    <li>Check the endpoints list to verify registration</li>
                  </ol>
                </div>

                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Pre-configured Installer</AlertTitle>
                  <AlertDescription>
                    This installer is customized for <strong>{account.name}</strong>. The agent will automatically
                    register to your account when installed. No manual configuration required!
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Alternative: Manual Installation</CardTitle>
          <CardDescription>
            For advanced users who want to customize the installation or deploy via configuration management tools
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            If you prefer to deploy using scripts or configuration management tools, you can use the registration token below:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted p-3 rounded-lg text-sm font-mono break-all">{registrationToken}</code>
            <Button variant="outline" size="icon" onClick={() => copyToClipboard(registrationToken, "token")}>
              {copiedCommand === "token" ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure the agent with this token in the config.json file or pass it as an environment variable: REGISTRATION_TOKEN
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
