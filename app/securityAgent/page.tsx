import { Header } from "@/components/kuamini/header"
import { Footer } from "@/components/kuamini/footer"

export const metadata = {
  title: "Kuamini Security Agent | Kuamini Systems",
  description:
    "Download and install the Kuamini Threat Protection Agent — an AI-powered endpoint security solution for Windows, macOS, and Linux. Real-time threat detection and monitoring for your devices.",
}

export default function SecurityAgentPage() {
  const features = [
    {
      title: "Real-Time Threat Detection",
      description:
        "Continuously monitors your system for malicious activity, suspicious processes, and zero-day threats using AI-driven analysis.",
      icon: "🛡️",
    },
    {
      title: "Multi-Platform Support",
      description:
        "Available for Windows, macOS, and Linux. One unified agent for all your endpoints.",
      icon: "💻",
    },
    {
      title: "Lightweight & Low Overhead",
      description:
        "Designed to run silently in the background with minimal CPU and memory usage, keeping your system fast.",
      icon: "⚡",
    },
    {
      title: "Cloud-Connected Intelligence",
      description:
        "Syncs threat intelligence with the Kuamini cloud backend for up-to-date protection against emerging threats.",
      icon: "☁️",
    },
    {
      title: "System Tray Integration",
      description:
        "Accessible from your system tray with at-a-glance status indicators and quick access to agent controls.",
      icon: "🔔",
    },
    {
      title: "Secure Configuration",
      description:
        "Token-based authentication ensures only authorised devices connect to your organisation's protection network.",
      icon: "🔑",
    },
  ]

  const platforms = [
    {
      name: "Windows",
      version: "Windows 10 / 11",
      installer: "KuaminiSecurityClient-win.exe",
      steps: [
        "Download the Windows installer",
        "Run the installer as Administrator",
        "Follow the setup wizard",
        "The agent starts automatically on login",
      ],
    },
    {
      name: "macOS",
      version: "macOS 12+",
      installer: "KuaminiSecurityClient-mac.dmg",
      steps: [
        "Download the macOS installer",
        "Open the .dmg file and drag to Applications",
        "Launch from Applications and grant permissions",
        "The agent runs in the menu bar",
      ],
    },
    {
      name: "Linux",
      version: "Ubuntu 20.04+ / Debian",
      installer: "KuaminiSecurityClient-linux.AppImage",
      steps: [
        "Download the Linux AppImage",
        "Make it executable: chmod +x KuaminiSecurityClient-linux.AppImage",
        "Run the AppImage or add it to startup",
        "Configure via /etc/kuamini/config.json",
      ],
    },
  ]

  const faqs = [
    {
      question: "What is the Kuamini Security Agent?",
      answer:
        "The Kuamini Security Agent is a lightweight endpoint protection client that runs on your device and connects to the Kuamini threat protection platform. It monitors for threats in real time and reports status to your organisation's security dashboard.",
    },
    {
      question: "Do I need an account to use the agent?",
      answer:
        "Yes. You need a Kuamini organisation token provided by your IT administrator. This token links your device to your organisation's protection network.",
    },
    {
      question: "Is the agent always running?",
      answer:
        "The agent is designed to start automatically when your device boots and run silently in the background. It is accessible from the system tray (Windows/Linux) or menu bar (macOS).",
    },
    {
      question: "How do I update the agent?",
      answer:
        "The agent checks for updates automatically. You can also download the latest installer from this page and run it over the existing installation.",
    },
    {
      question: "What data does the agent collect?",
      answer:
        "The agent collects security-relevant telemetry such as process activity, network connections, and file system events. No personal files or private data are transmitted.",
    },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#2f1c6a] via-[#36344d] to-[#1d1e20] text-white py-20">
        <div className="container mx-auto px-6 text-center">
          <div className="mb-4 text-5xl">🛡️</div>
          <h1 className="text-4xl md:text-5xl font-semibold mb-4">
            Kuamini Security Agent
          </h1>
          <p className="text-gray-300 max-w-2xl mx-auto text-lg mb-8">
            AI-powered endpoint threat protection for Windows, macOS, and Linux.
            Lightweight. Always-on. Built for organisations that take security seriously.
          </p>
          <a
            href="/securityAgent/auth/login"
            className="inline-block bg-white text-[#2f1c6a] font-semibold px-8 py-3 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Get Access →
          </a>
        </div>
      </section>
      <section className="bg-gradient-to-br from-[#2f1c6a] via-[#36344d] to-[#1d1e20] text-white py-8">
  <div className="container mx-auto px-6 text-center">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-5xl mx-auto items-center">
      {/* Left: Info & Call-to-Action */}
      <div>
        <div className="mb-4 text-5xl">🛡️</div>
        <h1 className="text-4xl md:text-5xl font-semibold mb-3">
          Kuamini Security Agent
        </h1>
        <p className="text-gray-300 max-w-2xl text-lg mb-8">
          AI-powered endpoint threat protection for Windows, macOS, and Linux.
          Lightweight. Always-on. Built for organisations that take security seriously.
        </p>
      </div>

      {/* Right: Login/Registration & Access Section */}
      <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-lg p-4 border border-white border-opacity-20">
        <h2 className="text-2xl font-semibold mb-0 mt-0 text-center text-gray-500">
          Access Your Console
        </h2>

        <div className="space-y-2 mb-3">
          {/* Login Button */}
          <a
            href="/securityAgent/auth/login"
            className="block w-full text-center text-xl bg-white text-[#2f1c6a] font-semibold px-6 py-3 mt-4 rounded-lg hover:bg-gray-200  transition-colors"
          >
            Login to Console
          </a>

          {/* Register Button */}
          <a
            href="/securityAgent/auth/register"
            className="block w-full text-center border-2 border-white text-white font-semibold px-6 py-3 rounded-lg hover:bg-white hover:bg-opacity-10 transition-colors"
          >
            Create Account
          </a>
        </div>

          <div className="space-y-1 text-lg text-gray-500 mb-3 pl-8 -mt-8">
          <p className="flex items-center gap-2">
            <span className="text-lg">📊</span> Dashboard — Real-time threat monitoring
          </p>
          <p className="flex items-center gap-2">
            <span className="text-lg">🖥️</span> Endpoints — Manage all protected devices
          </p>
          <p className="flex items-center gap-2">
            <span className="text-lg">⚠️</span> Threats — View and respond to incidents
          </p>
          <p className="flex items-center gap-2">
            <span className="text-lg">📦</span> Installers — Download agent software
          </p>
        </div>

        <div className="border-t border-white border-opacity-20 pt-3">
          <p className="text-sm text-gray-500 text-center mb-1">
            Need Help?
          </p>
          <a
            href="/contact"
            className="block text-center text-[#5fd9e6] hover:text-white font-medium transition-colors"
          >
            Contact Support →
          </a>
        </div>
      </div>
    </div>
  </div>
</section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-semibold text-gray-800 mb-12 text-center">
            What the Agent Does
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <div key={index} className="p-6 border border-gray-200 rounded-lg">
                <div className="text-3xl mb-3">{feature.icon}</div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Download / Installation Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-semibold text-gray-800 mb-4 text-center">
            Installation
          </h2>
          <p className="text-center text-gray-500 text-sm mb-12">
            Contact your IT administrator or{" "}
            <a href="/contact" className="text-[#2f1c6a] underline">
              reach out to us
            </a>{" "}
            to obtain your organisation token before installing.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {platforms.map((platform, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-xl font-semibold text-gray-800 mb-1">{platform.name}</h3>
                <p className="text-xs text-gray-400 mb-4">{platform.version}</p>
                <ol className="space-y-2 mb-6">
                  {platform.steps.map((step, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-600">
                      <span className="font-semibold text-[#2f1c6a] shrink-0">{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                <a
                  href="/contact"
                  className="block text-center text-sm font-medium bg-[#2f1c6a] text-white py-2 px-4 rounded-lg hover:bg-[#3d2585] transition-colors"
                >
                  Request {platform.name} Installer
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-semibold text-gray-800 mb-12 text-center">
            Frequently Asked Questions
          </h2>
          <div className="max-w-3xl mx-auto space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="border-b border-gray-200 pb-6">
                <h3 className="text-base font-semibold text-gray-800 mb-2">{faq.question}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-[#2f1c6a] to-[#36344d] text-white">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-2xl font-semibold mb-4">Ready to protect your endpoints?</h2>
          <p className="text-gray-300 mb-8">
            Get in touch with our team to set up the Kuamini Security Agent for your organisation.
          </p>
          <a
            href="/contact"
            className="inline-block bg-white text-[#2f1c6a] font-semibold px-8 py-3 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Contact Us
          </a>
        </div>
      </section>

      <Footer />
    </div>
  )
}
