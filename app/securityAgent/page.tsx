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
    <div className="min-h-screen flex flex-col bg-[#0B1024] text-white overflow-x-hidden">
      <Header />

      {/* =========================================================
          HERO
          Purple / Charcoal background with lighting
          ========================================================= */}
      <section className="relative overflow-hidden text-white py-20 bg-gradient-to-br from-[#382052] via-[#302A45] to-[#202027]">

        {/* Purple ambient glow */}
        <div
          className="pointer-events-none absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full opacity-50 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(145,45,255,0.55) 0%, rgba(145,45,255,0.18) 35%, transparent 70%)",
          }}
        />

        {/* Pink ambient glow */}
        <div
          className="pointer-events-none absolute -top-32 -right-40 h-[520px] w-[520px] rounded-full opacity-45 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(255,55,170,0.45) 0%, rgba(255,55,170,0.12) 40%, transparent 72%)",
          }}
        />

        {/* Orange ambient glow */}
        <div
          className="pointer-events-none absolute -bottom-48 -right-20 h-[500px] w-[500px] rounded-full opacity-30 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(255,135,45,0.4) 0%, transparent 68%)",
          }}
        />

        {/* Large curved purple/pink lighting */}
        <div
          className="pointer-events-none absolute -top-[360px] -right-[220px] h-[650px] w-[650px] rounded-full border-[2px] border-pink-400/50"
          style={{
            boxShadow:
              "0 0 18px rgba(255,70,190,0.55), 0 0 55px rgba(155,60,255,0.28)",
          }}
        />

        {/* Inner curved light */}
        <div
          className="pointer-events-none absolute -top-[330px] -right-[190px] h-[590px] w-[590px] rounded-full border border-purple-400/30"
        />

        {/* Bottom left curved lighting */}
        <div
          className="pointer-events-none absolute -bottom-[430px] -left-[300px] h-[650px] w-[650px] rounded-full border border-purple-400/35"
          style={{
            boxShadow:
              "0 0 35px rgba(150,80,255,0.25)",
          }}
        />

        {/* Fine diagonal light streak */}
        <div
          className="pointer-events-none absolute top-20 right-0 h-px w-[500px] rotate-[-22deg] opacity-60"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,80,200,0.7), rgba(255,150,60,0.9), transparent)",
            boxShadow: "0 0 14px rgba(255,80,200,0.6)",
          }}
        />

        <div className="container mx-auto px-6 relative z-10">
          <div className="relative z-10 text-center max-w-4xl mx-auto">

            <div className="mb-4 text-5xl">
              🛡️
            </div>

            <h1 className="text-4xl md:text-5xl font-semibold mb-4 text-white">
              Kuamini Security Agent
            </h1>

            <p className="text-slate-200 max-w-2xl mx-auto text-lg leading-relaxed mb-8">
              AI-powered endpoint threat protection for Windows, macOS, and Linux.
              Lightweight. Always-on. Built for organisations that take security seriously.
            </p>

            <a
              href="/securityAgent/auth/login"
              className="inline-block bg-white text-[#351545] font-semibold px-8 py-3 rounded-lg shadow-lg hover:bg-slate-100 transition-colors"
            >
              Get Access →
            </a>

          </div>
        </div>
      </section>

      {/* =========================================================
          ACCESS YOUR CONSOLE
          Navy / Blue background with cyan and purple lighting
          ========================================================= */}
      <section className="relative overflow-hidden text-white py-12 border-t border-white/10 bg-gradient-to-br from-[#0B1733] via-[#152B4B] to-[#111827]">

        {/* Cyan glow - left */}
        <div
          className="pointer-events-none absolute -left-40 top-10 h-[500px] w-[500px] rounded-full opacity-45 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(0,220,255,0.35) 0%, rgba(0,150,255,0.14) 40%, transparent 72%)",
          }}
        />

        {/* Blue glow - center */}
        <div
          className="pointer-events-none absolute left-1/3 -top-40 h-[600px] w-[600px] rounded-full opacity-30 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(45,130,255,0.42) 0%, transparent 70%)",
          }}
        />

        {/* Purple glow - right */}
        <div
          className="pointer-events-none absolute -right-48 -top-20 h-[600px] w-[600px] rounded-full opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(165,70,255,0.38) 0%, rgba(165,70,255,0.12) 40%, transparent 72%)",
          }}
        />

        {/* Pink glow behind console */}
        <div
          className="pointer-events-none absolute right-10 bottom-[-250px] h-[500px] w-[500px] rounded-full opacity-25 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(255,60,190,0.4) 0%, transparent 70%)",
          }}
        />

        {/* Large cyan curved lighting */}
        <div
          className="pointer-events-none absolute -left-[360px] -bottom-[380px] h-[650px] w-[650px] rounded-full border-[2px] border-cyan-400/40"
          style={{
            boxShadow:
              "0 0 25px rgba(0,220,255,0.35), 0 0 70px rgba(0,130,255,0.18)",
          }}
        />

        {/* Large purple curved lighting */}
        <div
          className="pointer-events-none absolute -right-[380px] -top-[360px] h-[700px] w-[700px] rounded-full border-[2px] border-purple-400/40"
          style={{
            boxShadow:
              "0 0 25px rgba(170,70,255,0.4), 0 0 70px rgba(170,70,255,0.2)",
          }}
        />

        {/* Pink diagonal streak */}
        <div
          className="pointer-events-none absolute right-0 top-32 h-px w-[520px] rotate-[-20deg] opacity-60"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(0,220,255,0.4), rgba(170,70,255,0.8), rgba(255,70,190,0.7), transparent)",
            boxShadow:
              "0 0 16px rgba(150,80,255,0.65)",
          }}
        />

        <div className="container mx-auto px-6 relative z-10">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-5xl mx-auto items-center">

            {/* LEFT SIDE */}
            <div className="text-center md:text-left relative z-10">

              <div className="mb-4 text-5xl">
                🛡️
              </div>

              <h2 className="text-4xl md:text-5xl font-semibold mb-4 text-white">
                Kuamini Security Agent
              </h2>

              <p className="text-slate-200 max-w-xl text-lg leading-relaxed">
                AI-powered endpoint threat protection for Windows, macOS, and Linux.
                Lightweight. Always-on. Built for organisations that take security seriously.
              </p>

            </div>

            {/* RIGHT SIDE */}
            <div className="relative z-10">

              <div className="bg-[#151827]/95 rounded-xl p-6 border border-white/15 shadow-xl backdrop-blur-sm">

                <h2 className="text-2xl font-semibold mb-5 text-center text-white">
                  Access Your Console
                </h2>

                {/* LOGIN */}
                <a
                  href="/securityAgent/auth/login"
                  className="block w-full text-center text-xl bg-white text-[#351545] font-semibold px-6 py-3 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Login to Console
                </a>

                {/* CREATE ACCOUNT */}
                <a
                  href="/securityAgent/auth/register"
                  className="block w-full text-center border border-purple-300/60 text-white font-semibold px-6 py-3 mt-3 rounded-lg hover:bg-white/10 hover:border-pink-300 transition-colors"
                >
                  Create Account
                </a>

                {/* CONSOLE FEATURES */}
                <div className="space-y-3 text-base text-slate-200 mt-6">

                  <p className="flex items-center gap-3">
                    <span className="text-lg shrink-0">
                      📊
                    </span>
                    <span>
                      Dashboard — Real-time threat monitoring
                    </span>
                  </p>

                  <p className="flex items-center gap-3">
                    <span className="text-lg shrink-0">
                      🖥️
                    </span>
                    <span>
                      Endpoints — Manage all protected devices
                    </span>
                  </p>

                  <p className="flex items-center gap-3">
                    <span className="text-lg shrink-0">
                      ⚠️
                    </span>
                    <span>
                      Threats — View and respond to incidents
                    </span>
                  </p>

                  <p className="flex items-center gap-3">
                    <span className="text-lg shrink-0">
                      📦
                    </span>
                    <span>
                      Installers — Download agent software
                    </span>
                  </p>

                </div>

                {/* SUPPORT */}
                <div className="border-t border-white/15 pt-4 mt-6">

                  <p className="text-sm text-slate-400 text-center mb-1">
                    Need Help?
                  </p>

                  <a
                    href="/contact"
                    className="block text-center text-[#67DDEB] hover:text-white font-medium transition-colors"
                  >
                    Contact Support →
                  </a>

                </div>

              </div>

            </div>

          </div>
        </div>
      </section>

      {/* =========================================================
          WHAT THE AGENT DOES
          ========================================================= */}
      <section className="kuamini-dark-section py-16">

        <div className="container mx-auto px-6">

          <h2 className="text-3xl font-semibold text-white mb-12 text-center">
            What the Agent Does
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">

            {features.map((feature, index) => (
              <div
                key={index}
                className="p-6 bg-[#18141F] border border-white/10 rounded-xl shadow-lg transition-all hover:bg-[#1D1826] hover:border-purple-400/30"
              >

                <div className="text-3xl mb-3">
                  {feature.icon}
                </div>

                <h3 className="text-base font-semibold text-white mb-2">
                  {feature.title}
                </h3>

                <p className="text-slate-400 text-sm leading-relaxed">
                  {feature.description}
                </p>

              </div>
            ))}

          </div>
        </div>
      </section>

      {/* =========================================================
          INSTALLATION
          ========================================================= */}
      <section className="kuamini-installation-bg py-16 border-y border-white/5">

        <div className="container mx-auto px-6">

          <h2 className="text-3xl font-semibold text-white mb-4 text-center">
            Installation
          </h2>

          <p className="text-center text-slate-300 text-sm mb-12">
            Contact your IT administrator or{" "}
            <a
              href="/contact"
              className="text-purple-300 hover:text-pink-300 underline underline-offset-4 transition-colors"
            >
              reach out to us
            </a>{" "}
            to obtain your organisation token before installing.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">

            {platforms.map((platform, index) => (
              <div
                key={index}
                className="bg-[#211B2B] p-6 rounded-xl shadow-lg border border-white/10 transition-all hover:border-purple-400/30 hover:bg-[#251F30]"
              >

                <h3 className="text-xl font-semibold text-white mb-1">
                  {platform.name}
                </h3>

                <p className="text-xs text-slate-400 mb-4">
                  {platform.version}
                </p>

                <ol className="space-y-2 mb-6">

                  {platform.steps.map((step, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-sm text-slate-300"
                    >
                      <span className="font-semibold text-purple-400 shrink-0">
                        {i + 1}.
                      </span>

                      <span>
                        {step}
                      </span>
                    </li>
                  ))}

                </ol>

                <a
                  href="/contact"
                  className="block text-center text-sm font-medium bg-gradient-to-r from-[#8B3FD1] to-[#D43C9A] text-white py-2.5 px-4 rounded-lg hover:from-[#9B4CE2] hover:to-[#E34AAA] transition-all"
                >
                  Request {platform.name} Installer
                </a>

              </div>
            ))}

          </div>
        </div>
      </section>

      {/* =========================================================
          FAQ
          ========================================================= */}
      <section className="kuamini-dark-section py-16">

        <div className="container mx-auto px-6">

          <h2 className="text-3xl font-semibold text-white mb-12 text-center">
            Frequently Asked Questions
          </h2>

          <div className="max-w-3xl mx-auto space-y-6">

            {faqs.map((faq, index) => (
              <div
                key={index}
                className="border-b border-white/10 pb-6"
              >

                <h3 className="text-base font-semibold text-white mb-2">
                  {faq.question}
                </h3>

                <p className="text-slate-400 text-sm leading-relaxed">
                  {faq.answer}
                </p>

              </div>
            ))}

          </div>
        </div>
      </section>

      {/* =========================================================
          CTA
          ========================================================= */}
      <section className="kuamini-cta-bg py-16 text-white border-t border-white/10">

        <div className="container mx-auto px-6 text-center relative z-10">

          <h2 className="text-2xl font-semibold mb-4">
            Ready to protect your endpoints?
          </h2>

          <p className="text-slate-300 mb-8">
            Get in touch with our team to set up the Kuamini Security Agent for your organisation.
          </p>

          <a
            href="/contact"
            className="inline-block bg-white text-[#351545] font-semibold px-8 py-3 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Contact Us
          </a>

        </div>
      </section>

      <Footer />
    </div>
  )
}