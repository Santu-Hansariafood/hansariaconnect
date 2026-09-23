import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserSession, type UserSession } from "@/lib/sessionAuth";

export const requireUser = async (
  req: NextRequest,
): Promise<UserSession | null> => {
  const nextAuthSession = await getServerSession(authOptions);
  const nextAuthUser = nextAuthSession?.user;

  if (nextAuthUser?.id) {
    return {
      id: String(nextAuthUser.id),
      sessionId: "next-auth",
      mobile: nextAuthUser.mobile,
    };
  }

  return getUserSession(req);
};

export const parseJson = async <T extends z.ZodTypeAny>(
  req: NextRequest,
  schema: T,
): Promise<
  | { success: true; data: z.infer<T> }
  | { success: false; response: NextResponse }
> => {
  try {
    const body: unknown = await req.json();
    const result = schema.safeParse(body);

    if (result.success) return { success: true, data: result.data };

    return {
      success: false,
      response: NextResponse.json(
        {
          error: "Invalid request",
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 },
      ),
    };
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 },
      ),
    };
  }
};

export const apiError = (error: unknown, context: string): NextResponse => {
  console.error(`[api] ${context}`, error);
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 },
  );
};
