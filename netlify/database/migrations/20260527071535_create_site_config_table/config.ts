import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { siteConfig } from "../../db/schema.js";

const DEFAULT_PERSON = {
  name: "Chotu",
  roastMessage:
    "Abe nalle, ek aur saal barbaad kar diya tune. Zindagi mein kuch dhang ka kaam kar le ab. Chal koi na, tu jaisa bhi hai mera bhai hai. Happy Birthday! 🎉 Party de chup chap.",
  birthDate: "March 14th",
};

const DEFAULT_SENDERS = [
  {
    id: "1",
    name: "Ashish",
    message: 'sudo make-wish --name=friend --force\nconsole.log("Happy Bday bhai");',
    special: "CS",
  },
  {
    id: "2",
    name: "Aditya",
    message: "Bhai tu sudhrega nahi na? Happy Birthday! Ghoomne chalte hain.",
    special: "None",
  },
  {
    id: "3",
    name: "Rohit",
    message: "Aaj toh naha leta gadhe! Chal khush reh, Happy bday.",
    special: "None",
  },
];

const DEFAULT_POLAROIDS = [
  {
    id: "p1",
    url: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=400&fit=crop",
    caption: "Birthday Fun",
  },
  {
    id: "p2",
    url: "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=400&h=400&fit=crop",
    caption: "Party Time",
  },
  {
    id: "p3",
    url: "https://images.unsplash.com/photo-1576607552471-f6cc9ef0d473?w=400&h=400&fit=crop",
    caption: "Happy Moments",
  },
];

export default async (req: Request) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method === "GET") {
    const rows = await db.select().from(siteConfig).limit(1);
    if (rows.length === 0) {
      return Response.json(
        {
          person: DEFAULT_PERSON,
          senders: DEFAULT_SENDERS,
          theme: "classic",
          polaroids: DEFAULT_POLAROIDS,
        },
        { headers }
      );
    }
    const row = rows[0];
    return Response.json(
      {
        person: JSON.parse(row.person),
        senders: JSON.parse(row.senders),
        theme: row.theme,
        polaroids: row.polaroids ? JSON.parse(row.polaroids) : DEFAULT_POLAROIDS,
      },
      { headers }
    );
  }

  if (req.method === "PUT") {
    const body = await req.json();
    const personJson = JSON.stringify(body.person);
    const sendersJson = JSON.stringify(body.senders);
    const polaroidsJson = JSON.stringify(body.polaroids || []);
    const theme = body.theme || "classic";

    const existing = await db.select().from(siteConfig).limit(1);
    if (existing.length === 0) {
      await db.insert(siteConfig).values({
        person: personJson,
        senders: sendersJson,
        theme,
        polaroids: polaroidsJson,
      });
    } else {
      const { eq } = await import("drizzle-orm");
      await db
        .update(siteConfig)
        .set({ person: personJson, senders: sendersJson, theme, polaroids: polaroidsJson, updatedAt: new Date() })
        .where(eq(siteConfig.id, existing[0].id));
    }

    return Response.json({ ok: true }, { headers });
  }

  return new Response("Method not allowed", { status: 405, headers });
};

export const config: Config = {
  path: "/api/config",
};
