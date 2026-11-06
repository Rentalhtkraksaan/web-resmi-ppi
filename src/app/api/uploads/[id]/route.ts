import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const img = await prisma.uploadedImage.findUnique({
      where: { id },
    });

    if (!img || !img.data) {
      return new NextResponse("Image Not Found", { status: 404 });
    }

    const buffer = Buffer.from(img.data, "base64");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": img.mimeType || "image/jpeg",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
