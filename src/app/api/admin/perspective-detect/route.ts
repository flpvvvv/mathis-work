import { NextResponse } from "next/server";

/**
 * Read image dimensions from JPEG or PNG buffer headers.
 * Returns null for unsupported formats.
 */
function getImageDimensions(
  buffer: Buffer,
): { width: number; height: number } | null {
  // JPEG: scan for SOF0/SOF2 marker (0xFF 0xC0 or 0xFF 0xC2)
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 10) {
      if (buffer[offset] !== 0xff) return null;
      const marker = buffer[offset + 1];
      // SOF0 (baseline) or SOF2 (progressive)
      if (marker === 0xc0 || marker === 0xc2) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
      const segmentLength = buffer.readUInt16BE(offset + 2);
      offset += 2 + segmentLength;
    }
    return null;
  }

  // PNG: IHDR chunk follows 8-byte signature
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    if (buffer.length < 24) return null;
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  return null;
}

function clampNormalized(value: number): number {
  return Math.max(0, Math.min(1, value));
}

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-flash";

const DETECTION_PROMPT =
  "You are detecting corners for perspective correction of artwork photos.\n\n" +
  "Typical photo: a rectangular drawing or painting on white/off-white paper " +
  "(often A4) that fills most of the frame. The paper is usually much brighter " +
  "than the surrounding background (desk, floor, wall, hands, shadows).\n\n" +
  "Task: find the 4 outer corners of the PAPER SHEET itself — where the white " +
  "paper meets the darker background. Place each corner exactly on the paper " +
  "edge, not on the drawing inside, not on the image border, and not on shadows " +
  "cast on the paper.\n\n" +
  "Ignore hands, clips, tape, pencils, or other objects unless they cover the " +
  "paper edge. If multiple rectangles exist, choose the largest bright paper " +
  "sheet that contains the artwork.\n\n" +
  "Return corners in this order: top-left, top-right, bottom-right, bottom-left.\n\n" +
  "CRITICAL — use NORMALIZED coordinates from 0.0 to 1.0 (NOT pixel coordinates). " +
  "0.0 = left/top edge, 1.0 = right/bottom edge of the full image. " +
  "For example, if the paper is centered and fills 80% of the image, " +
  "corners would be around 0.1–0.9, never values like 200 or 1080.\n\n" +
  "Reply with JSON only, no prose, in exactly this shape: " +
  '{"points":[{"x":0.1,"y":0.05},{"x":0.9,"y":0.05},{"x":0.9,"y":0.95},{"x":0.1,"y":0.95}]}';

export async function POST(request: Request) {
  if (!DEEPSEEK_API_KEY) {
    return NextResponse.json(
      { error: "Perspective detection is not configured." },
      { status: 501 },
    );
  }

  let buffer: Buffer;
  let mimeType: string;
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "No image provided." },
        { status: 400 },
      );
    }
    buffer = Buffer.from(await file.arrayBuffer());
    mimeType = file.type || "image/jpeg";
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 },
    );
  }

  const base64 = buffer.toString("base64");

  try {
    const deepseekResponse = await fetch(
      "https://api.deepseek.com/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: DETECTION_PROMPT },
                {
                  type: "image_url",
                  image_url: { url: `data:${mimeType};base64,${base64}` },
                },
              ],
            },
          ],
          // Non-thinking mode: this request is awaited by an interactive UI,
          // and temperature only takes effect when thinking is disabled.
          thinking: { type: "disabled" },
          temperature: 0,
          max_tokens: 1024,
          response_format: { type: "json_object" },
        }),
      },
    );

    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text();
      console.error(
        `DeepSeek API error (${deepseekResponse.status}): ${errorText.slice(0, 200)}`,
      );
      return NextResponse.json(
        { error: "AI detection failed. Adjust corners manually." },
        { status: 502 },
      );
    }

    const data = (await deepseekResponse.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) {
      return NextResponse.json(
        { error: "AI returned no result. Adjust corners manually." },
        { status: 502 },
      );
    }

    let parsed: { points?: Array<{ x: number; y: number }> };
    try {
      parsed = JSON.parse(rawText) as typeof parsed;
    } catch {
      return NextResponse.json(
        { error: "AI returned invalid data. Adjust corners manually." },
        { status: 502 },
      );
    }

    if (!parsed.points || parsed.points.length !== 4) {
      return NextResponse.json(
        { error: "AI returned incomplete result. Adjust corners manually." },
        { status: 502 },
      );
    }
    // Normalize coordinates to 0–1 range.
    // The model sometimes returns pixel coordinates despite the prompt;
    // detect this and scale down using actual image dimensions.
    const dims = getImageDimensions(buffer);

    let points: Array<{ x: number; y: number }>;
    if (dims) {
      const anyPixelCoords = parsed.points.some((p) => p.x > 1.5 || p.y > 1.5);
      if (anyPixelCoords) {
        points = parsed.points.map((p) => ({
          x: clampNormalized(p.x / dims.width),
          y: clampNormalized(p.y / dims.height),
        }));
      } else {
        points = parsed.points.map((p) => ({
          x: clampNormalized(p.x),
          y: clampNormalized(p.y),
        }));
      }
    } else {
      // Unknown format — clamp blindly
      points = parsed.points.map((p) => ({
        x: clampNormalized(p.x),
        y: clampNormalized(p.y),
      }));
    }

    return NextResponse.json({ points });
  } catch (err) {
    console.error(
      "Perspective detection error:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: "AI detection failed. Adjust corners manually." },
      { status: 502 },
    );
  }
}
