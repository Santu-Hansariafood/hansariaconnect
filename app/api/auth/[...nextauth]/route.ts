import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";
import Otp from "@/models/otp/Otp";

declare module "next-auth" {
  interface User {
    mobile: string;
  }
  interface Session {
    user: User;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    mobile?: string;
    id?: string;
  }
}

const auth = NextAuth({
  session: {
    strategy: "jwt",
  },

  providers: [
    CredentialsProvider({
      name: "otp-login",
      credentials: {
        mobile: { label: "Mobile", type: "text" },
        otp: { label: "OTP", type: "text" },
      },

      async authorize(credentials) {
        const { mobile, otp } = credentials!;

        await connectDB();

        const validOtp = await Otp.findOne({
          mobile,
          otp,
          expiresAt: { $gt: new Date() },
        });

        if (!validOtp) return null;

        const user = await User.findOne({ mobile });

        return { id: user._id.toString(), mobile: user.mobile };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.mobile = user.mobile;
        token.id = user.id;
      }
      return token;
    },

    async session({ session, token }) {
      if (token.mobile) {
        session.user.mobile = token.mobile;
      }
      if (token.id) {
        session.user.id = token.id;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
});

export { auth as GET, auth as POST };
