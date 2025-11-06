import { Client } from "@notionhq/client";
import type { Product } from "./scrape.js";
import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const DB_ID_2 = process.env.NOTION_DB_ID_2!;

type NotionError = {
  message: string;
  body?: unknown;
};

type RichTextItem = {
  type: "text";
  text: {
    content: string;
  };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
};

/**
 * Notion 데이터베이스의 설명을 업데이트합니다.
 */
export async function updateDatabaseDescription2(newCount: number): Promise<void> {
  if (!process.env.NOTION_API_KEY) {
    throw new Error("NOTION_API_KEY 환경 변수가 설정되지 않았습니다.");
  }
  if (!DB_ID_2) {
    throw new Error("NOTION_DB_ID_2 환경 변수가 설정되지 않았습니다.");
  }

  try {
    const today = new Date();
    const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;
    const description = `업데이트 일시: ${dateString}, ${newCount}개 데이터 새로 등록`;

    await notion.databases.update({
      database_id: DB_ID_2,
      description: [
        {
          type: "text",
          text: {
            content: description,
          },
        },
      ],
    });

    console.log(`📝 데이터베이스 설명 업데이트: ${description}`);
  } catch (error) {
    const notionError = error as NotionError;
    console.error("데이터베이스 설명 업데이트 오류:", notionError.message);
    if (notionError.body) {
      console.error("상세 오류:", JSON.stringify(notionError.body, null, 2));
    }
  }
}

/**
 * Notion 데이터베이스에서 기존 제품의 URL과 페이지 ID를 가져옵니다.
 */
export async function getExistingProducts2(): Promise<Map<string, string>> {
  if (!process.env.NOTION_API_KEY) {
    throw new Error("NOTION_API_KEY 환경 변수가 설정되지 않았습니다.");
  }
  if (!DB_ID_2) {
    throw new Error("NOTION_DB_ID_2 환경 변수가 설정되지 않았습니다.");
  }

  const existingProducts = new Map<string, string>();
  let hasMore = true;
  let startCursor: string | undefined = undefined;

  try {
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: DB_ID_2,
        start_cursor: startCursor,
        page_size: 100,
      });

      for (const page of response.results) {
        if ("properties" in page && page.properties.URL) {
          const urlProperty = page.properties.URL;
          if (urlProperty.type === "url" && urlProperty.url && typeof urlProperty.url === "string") {
            existingProducts.set(urlProperty.url, page.id);
          }
        }
      }

      hasMore = response.has_more;
      startCursor = response.next_cursor || undefined;
    }

    console.log(`📋 Notion 데이터베이스에서 ${existingProducts.size}개의 기존 제품을 확인했습니다.`);
    return existingProducts;
  } catch (error) {
    const notionError = error as NotionError;
    console.error("Notion 데이터베이스 조회 오류:", notionError.message);
    if (notionError.body) {
      console.error("상세 오류:", JSON.stringify(notionError.body, null, 2));
    }
    throw error;
  }
}

/**
 * Notion 데이터베이스에서 기존 제품의 URL 목록을 가져옵니다.
 */
export async function getExistingProductUrls2(): Promise<Set<string>> {
  if (!process.env.NOTION_API_KEY) {
    throw new Error("NOTION_API_KEY 환경 변수가 설정되지 않았습니다.");
  }
  if (!DB_ID_2) {
    throw new Error("NOTION_DB_ID_2 환경 변수가 설정되지 않았습니다.");
  }

  const existingUrls = new Set<string>();
  let hasMore = true;
  let startCursor: string | undefined = undefined;

  try {
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: DB_ID_2,
        start_cursor: startCursor,
        page_size: 100,
      });

      for (const page of response.results) {
        if ("properties" in page && page.properties.URL) {
          const urlProperty = page.properties.URL;
          if (urlProperty.type === "url" && urlProperty.url && typeof urlProperty.url === "string") {
            existingUrls.add(urlProperty.url);
          }
        }
      }

      hasMore = response.has_more;
      startCursor = response.next_cursor || undefined;
    }

    console.log(`📋 Notion 데이터베이스에서 ${existingUrls.size}개의 기존 제품을 확인했습니다.`);
    return existingUrls;
  } catch (error) {
    const notionError = error as NotionError;
    console.error("Notion 데이터베이스 조회 오류:", notionError.message);
    if (notionError.body) {
      console.error("상세 오류:", JSON.stringify(notionError.body, null, 2));
    }
    throw error;
  }
}

/**
 * 오늘 추가된 제품 수를 확인합니다.
 */
export async function getTodayAddedCount(): Promise<number> {
  if (!process.env.NOTION_API_KEY) {
    throw new Error("NOTION_API_KEY 환경 변수가 설정되지 않았습니다.");
  }
  if (!DB_ID_2) {
    throw new Error("NOTION_DB_ID_2 환경 변수가 설정되지 않았습니다.");
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString().split("T")[0];

    const response = await notion.databases.query({
      database_id: DB_ID_2,
      filter: {
        property: "CreatedAt",
        date: {
          equals: todayISO,
        },
      },
    });

    return response.results.length;
  } catch {
    console.log("⚠️ 오늘 추가된 제품 수 확인 실패, 0으로 처리합니다.");
    return 0;
  }
}

export async function syncToNotion2(product: Product, analysis: string, translatedDescription: string): Promise<void> {
  if (!process.env.NOTION_API_KEY) {
    throw new Error("NOTION_API_KEY 환경 변수가 설정되지 않았습니다.");
  }
  if (!DB_ID_2) {
    throw new Error("NOTION_DB_ID_2 환경 변수가 설정되지 않았습니다.");
  }

  try {
    const revenueNumber = parseFloat(product.revenue) || 0;

    const properties = {
      Name: { title: [{ text: { content: product.name || "Untitled" } }] },
      Description: { rich_text: [{ text: { content: translatedDescription || "" } }] },
      Revenue: { number: revenueNumber },
      URL: { url: product.link },
      "Verified Stripe": { checkbox: product.isStripeVerified || false },
    } as unknown as Parameters<typeof notion.pages.create>[0]["properties"];

    if (product.thumbnail && product.thumbnail.trim() !== "" && product.thumbnail.startsWith("http")) {
      properties.Thumbnail = {
        files: [
          {
            name: product.name || "thumbnail",
            external: { url: product.thumbnail },
          },
        ],
      };
    }

    const parseRichText = (text: string): RichTextItem[] => {
      const parts: RichTextItem[] = [];
      let currentIndex = 0;

      const boldRegex = /(\*\*|__)(.+?)\1/g;
      let match;

      while ((match = boldRegex.exec(text)) !== null) {
        if (match.index > currentIndex) {
          const beforeText = text.substring(currentIndex, match.index);
          if (beforeText) {
            parts.push({ type: "text", text: { content: beforeText } });
          }
        }

        parts.push({
          type: "text",
          text: { content: match[2] },
          annotations: { bold: true },
        });

        currentIndex = match.index + match[0].length;
      }

      if (currentIndex < text.length) {
        const remainingText = text.substring(currentIndex);
        if (remainingText) {
          parts.push({ type: "text", text: { content: remainingText } });
        }
      }

      return parts.length > 0 ? parts : [{ type: "text", text: { content: text } }];
    };

    const parseMarkdownToBlocks = (text: string): BlockObjectRequest[] => {
      const lines = text.split("\n");
      const blocks: BlockObjectRequest[] = [];
      let currentBulletList: BlockObjectRequest[] = [];
      let currentNumberedList: BlockObjectRequest[] = [];

      const flushLists = () => {
        if (currentBulletList.length > 0) {
          blocks.push(...currentBulletList);
          currentBulletList = [];
        }
        if (currentNumberedList.length > 0) {
          blocks.push(...currentNumberedList);
          currentNumberedList = [];
        }
      };

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          flushLists();
          continue;
        }

        if (trimmed.startsWith("####")) {
          flushLists();
          const headingText = trimmed.replace(/^####\s*/, "");
          blocks.push({
            object: "block",
            type: "heading_3",
            heading_3: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              rich_text: parseRichText(headingText) as unknown as any,
            },
          });
          continue;
        }
        if (trimmed.startsWith("###")) {
          flushLists();
          const headingText = trimmed.replace(/^###\s*/, "");
          blocks.push({
            object: "block",
            type: "heading_3",
            heading_3: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              rich_text: parseRichText(headingText) as unknown as any,
            },
          });
          continue;
        }
        if (trimmed.startsWith("##")) {
          flushLists();
          const headingText = trimmed.replace(/^##\s*/, "");
          blocks.push({
            object: "block",
            type: "heading_2",
            heading_2: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              rich_text: parseRichText(headingText) as unknown as any,
            },
          });
          continue;
        }
        if (trimmed.startsWith("#")) {
          flushLists();
          const headingText = trimmed.replace(/^#\s*/, "");
          blocks.push({
            object: "block",
            type: "heading_1",
            heading_1: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              rich_text: parseRichText(headingText) as unknown as any,
            },
          });
          continue;
        }

        if (/^[0-9]️⃣|^[✅❌]/.test(trimmed) && !trimmed.match(/^[-•*]\s/)) {
          flushLists();
          blocks.push({
            object: "block",
            type: "heading_2",
            heading_2: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              rich_text: parseRichText(trimmed) as unknown as any,
            },
          });
          continue;
        }

        if (/^[-*_]{3,}$/.test(trimmed)) {
          flushLists();
          blocks.push({
            object: "block",
            type: "divider",
            divider: {},
          });
          continue;
        }

        const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
        if (numberedMatch) {
          flushLists();
          currentNumberedList.push({
            object: "block",
            type: "numbered_list_item",
            numbered_list_item: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              rich_text: parseRichText(numberedMatch[2]) as unknown as any,
            },
          });
          continue;
        }

        if (/^[-•*]\s+/.test(trimmed)) {
          const content = trimmed.replace(/^[-•*]\s+/, "");
          const isHeading =
            /^\*\*.*\*\*$/.test(content.trim()) ||
            (content.includes("?") && content.length < 100) ||
            /^[-•*]\s+\*\*.*\*\*$/.test(trimmed);

          if (isHeading) {
            flushLists();
            const headingText = content.replace(/\*\*/g, "").trim();
            blocks.push({
              object: "block",
              type: "heading_3",
              heading_3: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                rich_text: parseRichText(headingText) as unknown as any,
              },
            });
            continue;
          }

          flushLists();
          currentBulletList.push({
            object: "block",
            type: "bulleted_list_item",
            bulleted_list_item: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              rich_text: parseRichText(content) as unknown as any,
            },
          });
          continue;
        }

        const indentMatch = trimmed.match(/^(\s{2,})[-•*]\s+(.+)$/);
        if (indentMatch) {
          const content = indentMatch[2];

          if (currentBulletList.length > 0) {
            const lastItem = currentBulletList[currentBulletList.length - 1];
            if (lastItem.type === "bulleted_list_item" && "bulleted_list_item" in lastItem) {
              const bulletedItem = lastItem.bulleted_list_item as {
                rich_text: RichTextItem[];
                children?: BlockObjectRequest[];
              };
              if (!bulletedItem.children) {
                bulletedItem.children = [];
              }
              bulletedItem.children.push({
                object: "block",
                type: "bulleted_list_item",
                bulleted_list_item: {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  rich_text: parseRichText(content) as unknown as any,
                },
              } as BlockObjectRequest);
            }
          } else {
            flushLists();
            currentBulletList.push({
              object: "block",
              type: "bulleted_list_item",
              bulleted_list_item: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                rich_text: parseRichText(content) as unknown as any,
              },
            });
          }
          continue;
        }

        flushLists();
        const richText = parseRichText(trimmed);
        blocks.push({
          object: "block",
          type: "paragraph",
          paragraph: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rich_text: richText as unknown as any,
          },
        });
      }

      flushLists();
      return blocks;
    };

    const analysisBlocks = parseMarkdownToBlocks(analysis);

    await notion.pages.create({
      parent: { database_id: DB_ID_2 },
      properties,
      children:
        analysisBlocks.length > 0
          ? analysisBlocks
          : [
              {
                object: "block",
                type: "paragraph",
                paragraph: {
                  rich_text: [{ type: "text", text: { content: analysis } }],
                },
              },
            ],
    });
  } catch (error) {
    const notionError = error as NotionError;
    console.error("Notion API 오류:", notionError.message);
    if (notionError.body) {
      console.error("상세 오류:", JSON.stringify(notionError.body, null, 2));
    }
    throw error;
  }
}

/**
 * 기존 Notion 페이지의 Stripe 인증 여부를 업데이트합니다.
 */
export async function updateStripeVerification(pageId: string, isStripeVerified: boolean): Promise<void> {
  if (!process.env.NOTION_API_KEY) {
    throw new Error("NOTION_API_KEY 환경 변수가 설정되지 않았습니다.");
  }
  if (!DB_ID_2) {
    throw new Error("NOTION_DB_ID_2 환경 변수가 설정되지 않았습니다.");
  }

  try {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        "Verified Stripe": { checkbox: isStripeVerified },
      },
    });
  } catch (error) {
    const notionError = error as NotionError;
    console.error("Notion 페이지 업데이트 오류:", notionError.message);
    if (notionError.body) {
      console.error("상세 오류:", JSON.stringify(notionError.body, null, 2));
    }
    throw error;
  }
}
