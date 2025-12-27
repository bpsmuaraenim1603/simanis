import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  try {
    // fetch akan follow redirect otomatis di server (nggak kena CORS)
    const res = await fetch(url, {
      redirect: "follow",
      // header minimal, biar tidak dicurigai
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    // setelah redirect, res.url biasanya sudah URL final
    return NextResponse.json({ finalUrl: res.url });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to expand link" },
      { status: 500 }
    );
  }
}
