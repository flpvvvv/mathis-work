import { NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GOOGLE_AI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

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
  "Return corners in this order: top-left, top-right, bottom-right, bottom-left. " +
  "Use normalized coordinates from 0.0 to 1.0 relative to the full image width " +
  "and height.";

export async function POST(request: Request) {
  if (!GEMINI_API_KEY) {
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

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent` +
    `?key=${GEMINI_API_KEY}`;

  try {
    const geminiResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType, data: base64 } },
              { text: DETECTION_PROMPT },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              points: {
                type: "ARRAY",
                minItems: 4,
                maxItems: 4,
                items: {
                  type: "OBJECT",
                  properties: {
                    x: { type: "NUMBER" },
                    y: { type: "NUMBER" },
                  },
                  required: ["x", "y"],
                },
              },
            },
            required: ["points"],
          },
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error(
        `Gemini API error (${geminiResponse.status}): ${errorText.slice(0, 200)}`,
      );
      return NextResponse.json(
        { error: "AI detection failed. Adjust corners manually." },
        { status: 502 },
      );
    }

    const data = (await geminiResponse.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
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

    // Clamp coordinates to 0–1 range
    const points = parsed.points.map((p) => ({
      x: Math.max(0, Math.min(1, p.x)),
      y: Math.max(0, Math.min(1, p.y)),
    }));

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
