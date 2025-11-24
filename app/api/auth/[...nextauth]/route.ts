import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";
import Otp from "@/models/otp/Otp";

declare module "next-auth" {
  interface User {
    id: string;
    mobile: string;
  }

  interface Session {
    user: {
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

const authOptions: AuthOptions = {
  session: {
    strategy: "jwt",
  },

  providers: [
    CredentialsProvider({
      name: "OTP Login",
      credentials: {
        mobile: { label: "Mobile", type: "text" },
        otp: { label: "OTP", type: "text" },
      },

      async authorize(credentials) {
        if (!credentials?.mobile || !credentials.otp) return null;

        await connectDB();

        const validOtp = await Otp.findOne({
          mobile: credentials.mobile,
          otp: credentials.otp,
          expiresAt: { $gt: new Date() },
        });

        if (!validOtp) return null;

        const user = await User.findOne({ mobile: credentials.mobile });

        if (!user) return null;

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

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
