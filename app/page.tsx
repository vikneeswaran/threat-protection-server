import { Header } from "@/components/kuamini/header"
import { Footer } from "@/components/kuamini/footer"
import { PartnerLogo } from "@/components/partner-logo"


export const metadata = {
  title: "Innovative Software Solutions for Business | Kuamini Systems",
  description:
    "Welcome to Kuamini Systems Private Limited, your trusted partner in delivering innovative business solutions. We specialize in enhancing operational efficiency and driving growth for businesses of all sizes.",
}

export default async function HomePage() {

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0912] text-white">

      <Header />

      {/* =====================================================
          HERO SECTION
          ===================================================== */}

      <section className="kuamini-home-hero text-white py-16">

        <div className="container mx-auto px-6 text-center relative z-10">

          <h1 className="text-3xl md:text-4xl font-semibold italic mb-8 text-balance">
            Built On Trust. Inspired by
            <br />
            Technology. Powered by AI
          </h1>


          {/* =================================================
              SERVICE CARDS
              ================================================= */}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto mt-8">

            {/* Web & Mobile Application Development */}

            <div className="relative rounded-lg overflow-hidden group border border-white/10 bg-[#15121F] shadow-lg">

              <img
                src="/web-mobile-application-development-coding.jpg"
                alt="Web & Mobile Application Development"
                className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-black/50 flex items-end p-4">

                <p className="text-white text-sm font-medium">
                  Web & Mobile Application Development
                </p>

              </div>

            </div>


            {/* Testing and Automation */}

            <div className="relative rounded-lg overflow-hidden group border border-white/10 bg-[#15121F] shadow-lg">

              <img
                src="/ai-testing-automation-software.jpg"
                alt="Testing and Automation"
                className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-black/50 flex items-end p-4">

                <p className="text-white text-sm font-medium">
                  Testing and Automation
                </p>

              </div>

            </div>


            {/* DevOps and Cloud Integration */}

            <div className="relative rounded-lg overflow-hidden group border border-white/10 bg-[#15121F] shadow-lg">

              <img
                src="/devops-cloud-integration-servers.jpg"
                alt="DevOps and Cloud Integration"
                className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-black/50 flex items-end p-4">

                <p className="text-white text-sm font-medium">
                  DevOps and Cloud Integration
                </p>

              </div>

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          ABOUT SECTION
          WHITE BACKGROUND - PRODUCTION STYLE
          ===================================================== */}

      <section className="bg-white py-8 text-gray-800">

        <div className="container mx-auto px-6">

          <h2 className="text-3xl font-semibold text-gray-800 mb-6 text-center">
            About Kuamini Systems
          </h2>

          <div className="max-w-5xl mx-auto">

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">

              {/* =================================================
                  OUR MISSION
                  ================================================= */}

              <div className="flex-shrink-0">

                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Our Mission
                </h3>

                <p className="text-gray-600 text-sm leading-relaxed">
                  At Kuamini Systems Private Limited, we specialize in providing AI powered innovative solutions tailored
                  to meet the unique needs of Web and Mobile Application Development, Testing and Cloud Integration.
                </p>

              </div>


              {/* =================================================
                  IMAGE
                  ================================================= */}

              <div className="flex justify-center max-w-[260px] w-full mx-auto">

                <img
                  src="/laptop-with-code-charts-analytics-dark-theme.jpg"
                  alt="Kuamini Systems workspace"
                  className="w-full rounded-lg shadow-lg max-h-[507px] object-contain"
                />

              </div>


              {/* =================================================
                  OUR VISION
                  ================================================= */}

              <div className="flex-shrink-0">

                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Our Vision
                </h3>

                <p className="text-gray-600 text-sm leading-relaxed">
                  Our mission is to empower businesses with cutting-edge technology and exceptional service, while our
                  vision is to be a leader in delivering transformative solutions that drive success and sustainability.
                </p>

              </div>

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          PARTNERS SECTION
          LIGHT GRAY BACKGROUND - PRODUCTION STYLE
          ===================================================== */}

      <section className="bg-gray-50 py-8">

        <div className="container mx-auto px-6 text-center">

          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Partners Who Trust Us
          </h2>

          <div className="mx-auto flex max-w-[600px] justify-center">

            <PartnerLogo />

          </div>

        </div>

      </section>


      {/* =====================================================
          FOOTER
          ===================================================== */}

      <Footer />

    </div>
  )
}