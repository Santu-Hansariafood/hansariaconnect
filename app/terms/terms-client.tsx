"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { fadeIn } from "@/utils/animations/animations";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";

export default function TermsClient() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center p-4">
      <motion.div {...fadeIn} className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-emerald-600 font-semibold mb-6 hover:underline"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
          >
            <Image
              src="/logo/logo.png"
              alt="HansariaConnect Logo"
              width={80}
              height={80}
              className="rounded-full"
              priority
            />
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Terms and Conditions</h1>
          <p className="text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-3">1. Introduction</h2>
            <p>
              Welcome to HansariaConnect. These Terms and Conditions ("Terms") govern your access to and use of our platform,
              including our website and mobile applications (collectively, the "Service"). By using our Service, you agree to
              these Terms and our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-3">2. Eligibility</h2>
            <p>
              You must be at least 13 years old to use this Service. By using the Service, you represent and warrant that
              you meet this age requirement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-3">3. User Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account and password, and for all activities
              that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-3">4. User Conduct</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Use the Service for any illegal purpose or in violation of any local, state, national, or international law.</li>
              <li>Harass, threaten, or intimidate other users.</li>
              <li>Upload, post, or transmit any defamatory, obscene, or offensive content.</li>
              <li>Impersonate any person or entity.</li>
              <li>Interfere with or disrupt the Service or servers or networks connected to the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-3">5. Intellectual Property</h2>
            <p>
              All content on the Service, including text, graphics, logos, and software, is the property of HansariaConnect
              or its content suppliers and is protected by copyright laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-3">6. Termination</h2>
            <p>
              We reserve the right to terminate or suspend your account at our sole discretion, without notice, for conduct
              that we believe violates these Terms or is harmful to other users of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-3">7. Disclaimer of Warranties</h2>
            <p>
              The Service is provided on an "as is" and "as available" basis without any warranties of any kind, either express
              or implied.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-3">8. Limitation of Liability</h2>
            <p>
              In no event shall HansariaConnect be liable for any indirect, incidental, special, consequential, or punitive
              damages arising out of or related to your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-3">9. Changes to Terms</h2>
            <p>
              We may revise these Terms from time to time. The most current version will be posted on our website. By
              continuing to use the Service after revisions become effective, you agree to be bound by the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-3">10. Contact Us</h2>
            <p>If you have any questions about these Terms, please contact us.</p>
          </section>
        </div>
      </motion.div>
    </div>
  );
}
