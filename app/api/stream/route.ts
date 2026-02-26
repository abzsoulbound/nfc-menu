import { createRuntimeEventStream } from "@/lib/realtime"

export const dynamic = "force-dynamic"

export async function GET() {
  const stream = createRuntimeEventStream()
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}

