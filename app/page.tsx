import { Header } from "@/components/kuamini/header"
import { Footer } from "@/components/kuamini/footer"
import { PartnerLogo } from "@/components/partner-logo"
import Link from "next/link";
export const metadata = {
  title: "Innovative Software Solutions for Business | Kuamini Systems",
  description:
    "Welcome to Kuamini Systems Private Limited, your trusted partner in delivering innovative business solutions. We specialize in enhancing operational efficiency and driving growth for businesses of all sizes.",
}

export default async function HomePage() {
//   const response = await fetch("http://localhost:3001/api/server-info", {
//   cache: "no-store",
//   });

// const apiData = await response.json();
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

          {/* {api data} */}

<Link
  href="/server2"
  className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
>
  Server 2 (Port 3001)
</Link>

{/* serverinfo message from server 2 api */}
    {/* <section className="py-10">
  <div className="container mx-auto px-6">
    <div className="max-w-xl mx-auto bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-8 text-center">

      <h2 className="text-3xl font-bold text-white mb-6">
        Data from Server 2
      </h2>

      <div className="space-y-3 text-lg">
        <p>
          <span className="font-semibold text-white">Server:</span>{" "}
          <span className="text-gray-200">{apiData.server}</span>
        </p>

        <p>
          <span className="font-semibold text-white">Status:</span>{" "}
          <span className="text-green-400">{apiData.status}</span>
        </p>

        <p>
          <span className="font-semibold text-white">Message:</span>{" "}
          <span className="text-gray-200">{apiData.message}</span>
        </p>

        <p className="text-sm text-gray-400">
          {apiData.timestamp}
        </p>
      </div>

    </div>
  </div>
</section> */}

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
      <section className="py-8 bg-white">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-semibold text-gray-800 mb-6 text-center">About Kuamini Systems</h2>

          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-3 gap-6 items-start">
              {/* Our Mission - Left */}
              <div className="flex-shrink-0">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Our Mission</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  At Kuamini Systems Private Limited, we specialize in providing AI powered innovative solutions tailored
                  to meet the unique needs of Web and Mobile Application Development, Testing and Cloud Integration.
                </p>
              </div>

              {/* Image - Center (aligned with first line of text sections) */}
              <div className="flex justify-center max-w-[260px] w-full">
                <img
                  src="/laptop-with-code-charts-analytics-dark-theme.jpg"
                  alt="Kuamini Systems workspace"
                  className="w-full rounded-lg shadow-lg max-h-[507px] object-contain"
                />
              </div>

              {/* Our Vision - Right */}
              <div className="flex-shrink-0">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Our Vision</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Our mission is to empower businesses with cutting-edge technology and exceptional service, while our
                  vision is to be a leader in delivering transformative solutions that drive success and sustainability.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Partners Section */}
      <section className="py-8 bg-gray-50">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Partners Who Trust Us</h2>
          <div className="mx-auto flex max-w-[600px] justify-center">
            <PartnerLogo />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
