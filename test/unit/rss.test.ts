import { describe, expect, it } from "vitest";
import { parseRssFeed } from "../../src/rss.js";

describe("parseRssFeed", () => {
  it("extracts normalized RSS items with model ids and image urls", () => {
    const xml = `<?xml version="1.0" encoding="windows-1255"?>
      <rss version="2.0"><channel>
        <title><![CDATA[חשמל ואלקטרוניקה]]></title>
        <item>
          <title><![CDATA[סטרימר Wiim Mini]]></title>
          <description>&lt;img src=&quot;https://img.zap.co.il/pics/7/7/0/6/96856077b.gif&quot;/&gt;&lt;br&gt;<![CDATA[מותג: Wiim]]></description>
          <pubDate>Thu, 14 May 2026 12:02:00 GMT</pubDate>
          <link>https://www.zap.co.il/model.aspx?modelid=1264897</link>
          <guid>https://www.zap.co.il/model.aspx?modelid=1264897</guid>
          <image>
            <url>https://img.zap.co.il/pics/7/7/0/6/96856077c</url>
          </image>
        </item>
      </channel></rss>`;

    expect(parseRssFeed(xml, "electric")).toEqual([
      {
        id: "1264897",
        title: "סטרימר Wiim Mini",
        descriptionText: "מותג: Wiim",
        category: "electric",
        publishedAt: "2026-05-14T12:02:00.000Z",
        modelId: "1264897",
        productUrl: "https://www.zap.co.il/model.aspx?modelid=1264897",
        imageUrl: "https://img.zap.co.il/pics/7/7/0/6/96856077c"
      }
    ]);
  });

  it("returns an empty list when a feed has no items", () => {
    expect(parseRssFeed("<rss><channel></channel></rss>", "electric")).toEqual([]);
  });
});
