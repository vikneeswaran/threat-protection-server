import { Header } from "@/components/kuamini/header"
import { Footer } from "@/components/kuamini/footer"

export const metadata = {
  title: "Innovative Software Solutions for Business | Kuamini Systems",
  description:
    "Welcome to Kuamini Systems Private Limited, your trusted partner in delivering innovative business solutions. We specialize in enhancing operational efficiency and driving growth for businesses of all sizes.",
}

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#2f1c6a] via-[#36344d] to-[#1d1e20] text-white py-16">
        <div className="container mx-auto px-6 text-center">
          <h1 className="text-3xl md:text-4xl font-semibold italic mb-8 text-balance">
            Built On Trust. Inspired by
            <br />
            Technology. Powered by AI
          </h1>

          {/* Service Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto mt-8">
            <div className="relative rounded-lg overflow-hidden group">
              <img
                src="/web-mobile-application-development-coding.jpg"
                alt="Web & Mobile Application Development"
                className="w-full h-48 object-cover"
              />
              <div className="absolute inset-0 bg-black/50 flex items-end p-4">
                <p className="text-white text-sm font-medium">Web & Mobile Application Development</p>
              </div>
            </div>
            <div className="relative rounded-lg overflow-hidden group">
              <img src="/ai-testing-automation-software.jpg" alt="Testing and Automation" className="w-full h-48 object-cover" />
              <div className="absolute inset-0 bg-black/50 flex items-end p-4">
                <p className="text-white text-sm font-medium">Testing and Automation</p>
              </div>
            </div>
            <div className="relative rounded-lg overflow-hidden group">
              <img
                src="/devops-cloud-integration-servers.jpg"
                alt="DevOps and Cloud Integration"
                className="w-full h-48 object-cover"
              />
              <div className="absolute inset-0 bg-black/50 flex items-end p-4">
                <p className="text-white text-sm font-medium">DevOps and Cloud Integration</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-semibold text-gray-800 mb-8 text-center">About Kuamini Systems</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Our Mission</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                At Kuamini Systems Private Limited, we specialize in providing AI powered innovative solutions tailored
                to meet the unique needs of Web and Mobile Application Development, Testing and Cloud Integration.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Our Vision</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Our mission is to empower businesses with cutting-edge technology and exceptional service, while our
                vision is to be a leader in delivering transformative solutions that drive success and sustainability.
              </p>
            </div>
          </div>

          {/* Image */}
          <div className="mt-12 max-w-4xl mx-auto">
            <img
              src="/laptop-with-code-charts-analytics-dark-theme.jpg"
              alt="Kuamini Systems workspace"
              className="w-full rounded-lg shadow-lg"
            />
          </div>
        </div>
      </section>

      {/* Partners Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-2xl font-semibold text-gray-800 mb-8">Partners Who Trust Us</h2>
          <div className="flex justify-center">
            <div className="rounded-lg px-4 py-2">
              <img
                src="/cintelligence-logo.png"
                alt="cIntelligence Partner"
                className="h-20 w-auto object-contain"
                onError={(e) => {
                  e.currentTarget.onerror = null
                  e.currentTarget.src = "/cintelligence-logo-white-text.jpg"
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
