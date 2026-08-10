import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/apiKeyAuth";
import { connectDB } from "@/lib/db/db";
import Message from "@/models/message/Message";
import Conversation from "@/models/conversation/Conversation";
import { Types } from "mongoose";

export async function POST(req: NextRequest) {
  try {
    const authResult = await validateApiKey(req, "sendMessage");
    if ("error" in authResult) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status },
      );
    }

    await connectDB();

    const body = await req.json();
    const {
      fromUserId,
      toUserId,
      type = "text",
      text,
      mediaUrl,
      fileName,
      fileSize,
    } = body;

    if (!fromUserId || !toUserId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields (fromUserId, toUserId)",
        },
        { status: 400 },
      );
    }

    if (type === "text" && !text) {
      return NextResponse.json(
        { success: false, error: "Text is required for text messages" },
        { status: 400 },
      );
    }

    const message = await Message.create({
      from: new Types.ObjectId(fromUserId),
      to: new Types.ObjectId(toUserId),
      type,
      text,
      mediaUrl,
      fileName,
      fileSize,
      status: "sent",
    });

    const a =
      fromUserId < toUserId
        ? new Types.ObjectId(fromUserId)
        : new Types.ObjectId(toUserId);
    const b =
      fromUserId < toUserId
        ? new Types.ObjectId(toUserId)
        : new Types.ObjectId(fromUserId);

    await Conversation.findOneAndUpdate(
      { userA: a, userB: b },
      { userA: a, userB: b, lastMessageAt: new Date() },
      { upsert: true, new: true },
    );

    return NextResponse.json({
      success: true,
      message: {
        id: message._id,
        from: fromUserId,
        to: toUserId,
        type,
        text,
        mediaUrl,
        fileName,
        fileSize,
        status: message.status,
        createdAt: message.createdAt,
      },
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 },
    );
  }
}
