import NextAuth, { AuthOptions, DefaultSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";
import Otp from "@/models/otp/Otp";

declare module "next-auth" {
  interface User {
    id: string;
    mobile: string;
  }

  interface Session extends DefaultSession {
    user: DefaultSession["user"] & {
      id: string;
      mobile: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    mobile?: string;
  }
}

const normalizeMobile = (input: unknown): string =>
  String(input ?? "").replace(/\D/g, "");

const isValidMobile = (mobile: string): boolean => /^\d{10}$/.test(mobile);
const isValidOtp = (otp: string): boolean => /^\d{6}$/.test(otp);

const authOptions: AuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },

  providers: [
    CredentialsProvider({
      name: "OTP Login",
      credentials: {
        mobile: { label: "Mobile", type: "text", placeholder: "9876543210" },
        otp: { label: "OTP", type: "text", placeholder: "123456" },
      },

      async authorize(credentials) {
        const mobile = normalizeMobile(credentials?.mobile);
        const otp = String(credentials?.otp ?? "").trim();

        if (!isValidMobile(mobile) || !isValidOtp(otp)) {
          return null;
        }

        await connectDB();

        const validOtp = await Otp.findOne({
          mobile,
          otp,
          expiresAt: { $gt: new Date() },
        });

        if (!validOtp) {
          return null;
        }

        await Otp.deleteMany({ mobile });

        const user = await User.findOneAndUpdate(
          { mobile },
          { $setOnInsert: { mobile } },
          { new: true, upsert: true },
        );

        return {
          id: user._id.toString(),
          mobile: user.mobile,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.mobile = user.mobile;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.mobile = token.mobile as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
