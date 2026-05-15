import { prisma } from "@/app/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
    const lastElement = await prisma.message.findFirst({
        orderBy: {
            createdAt: 'desc'
        }
    });

    if (!lastElement) {
        return new Response("No elements to delete", { status: 404 });
    }

    await prisma.message.delete({
        where: {
            id: lastElement.id
        }
    });

    return new Response("Deleted successfully", { status: 200 });
}
