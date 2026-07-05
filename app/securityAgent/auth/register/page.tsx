import { Header } from "@/components/kuamini/header"
import { Footer } from "@/components/kuamini/footer"

export const metadata = {
  title: "Register | Kuamini Security Agent",
  description: "Create your Kuamini Security Agent account",
}

export default function SecurityAgentRegisterPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <section className="bg-gradient-to-br from-[#2f1c6a] via-[#36344d] to-[#1d1e20] text-white py-16 flex-1">
        <div className="container mx-auto px-6">
          <div className="max-w-md mx-auto bg-white/10 border border-white/20 rounded-xl p-8 backdrop-blur-sm">
            <h1 className="text-3xl font-semibold mb-2 text-center">Create Account</h1>
            <p className="text-gray-300 text-sm text-center mb-8">Register for Kuamini Security Agent console access</p>

            <form className="space-y-4">
              <div>
                <label className="block text-sm text-gray-200 mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="Your name"
                  className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-white placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-white/40"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-200 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-white placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-white/40"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-200 mb-1">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-white placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-white/40"
                />
              </div>

              <button
                type="button"
                className="w-full bg-white text-[#2f1c6a] font-semibold px-4 py-2.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Create Account
              </button>
            </form>

            <p className="text-sm text-gray-300 mt-6 text-center">
              Already have an account?{" "}
              <a href="/securityAgent/auth/login" className="text-white underline">
                Login
              </a>
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
