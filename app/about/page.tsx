import { Header } from "@/components/kuamini/header"
import { Footer } from "@/components/kuamini/footer"

export const metadata = {
  title: "Kuamini Systems - Innovative Business Solutions | Kuamini Systems",
  description:
    "Kuamini Systems Private Limited specializes in providing innovative business solutions tailored to meet the unique needs of our clients. We are dedicated to enhancing operational efficiency and driving growth through technology.",
}

export default function AboutPage() {
  const faqs = [
    {
      question: "What is Kuamini Systems?",
      answer:
        "At Kuamini Systems Private Limited, we specialize in providing AI powered innovative solutions tailored to meet the unique Software Solutions.",
    },
    {
      question: "What services do you offer?",
      answer:
        "We offer a range of technology solutions tailored to meet the needs of various clients for Web and Mobile Application Development, Testing and Cloud Integration.",
    },
    {
      question: "How can I contact you?",
      answer:
        "You can reach us through our website's contact form, email, or by calling our customer service number directly.",
    },
    {
      question: "What is your industry focus?",
      answer: "Software Solutions using cutting Edge Technologies in the Industry",
    },
    {
      question: "Where are your offices located?",
      answer: "Our main office is located in Bengaluru, India, but we serve clients both locally and internationally.",
    },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start max-w-6xl mx-auto">
            <div>
              <h1 className="text-4xl font-semibold text-gray-800 mb-4">
                About Kuamini
                <br />
                Systems
              </h1>
            </div>
            <div>
              <p className="text-gray-600 text-sm leading-relaxed">
                Kuamini Systems Private Limited is specialized in providing AI powered innovative solutions tailored to
                meet the unique needs of Web and Mobile Application Development, Testing and Cloud Integration.
              </p>
            </div>
          </div>

          {/* Image */}
          <div className="mt-12 max-w-4xl mx-auto">
            <img
              src="/multiple-monitors-showing-code-and-dashboard-profe.jpg"
              alt="Kuamini Systems workspace"

              className="w-full rounded-lg shadow-lg scale-90" // Reduced image size by 10%
            />
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-semibold text-gray-800 mb-12 text-center">Frequently Asked Questions</h2>

          <div className="max-w-3xl mx-auto space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="border-b border-gray-200 pb-6">
                <h3 className="text-base font-semibold text-gray-800 mb-2">{faq.question}</h3>
                <p className="text-gray-600 text-sm">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

