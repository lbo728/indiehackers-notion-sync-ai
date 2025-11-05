import { Client } from "@notionhq/client";
import { Product } from "./scrape.js";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DB_ID = process.env.NOTION_DB_ID!;

/**
 * Notion 데이터베이스의 설명을 업데이트합니다.
 */
export async function updateDatabaseDescription(newCount: number): Promise<void> {
  if (!process.env.NOTION_API_KEY) {
    throw new Error("NOTION_API_KEY 환경 변수가 설정되지 않았습니다.");
  }
  if (!DB_ID) {
    throw new Error("NOTION_DB_ID 환경 변수가 설정되지 않았습니다.");
  }

  try {
    const today = new Date();
    const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;
    const description = `업데이트 일시: ${dateString}, ${newCount}개 데이터 새로 등록`;

    await notion.databases.update({
      database_id: DB_ID,
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
  } catch (error: any) {
    console.error("데이터베이스 설명 업데이트 오류:", error.message);
    if (error.body) {
      console.error("상세 오류:", JSON.stringify(error.body, null, 2));
    }
    // 설명 업데이트 실패는 치명적이지 않으므로 에러를 throw하지 않음
  }
}

/**
 * Notion 데이터베이스에서 기존 제품의 URL 목록을 가져옵니다.
 */
export async function getExistingProductUrls(): Promise<Set<string>> {
  if (!process.env.NOTION_API_KEY) {
    throw new Error("NOTION_API_KEY 환경 변수가 설정되지 않았습니다.");
  }
  if (!DB_ID) {
    throw new Error("NOTION_DB_ID 환경 변수가 설정되지 않았습니다.");
  }

  const existingUrls = new Set<string>();
  let hasMore = true;
  let startCursor: string | undefined = undefined;

  try {
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: DB_ID,
        start_cursor: startCursor,
        page_size: 100, // Notion API 최대 페이지 크기
      });

      // 각 페이지의 URL 속성을 추출
      for (const page of response.results) {
        if ("properties" in page && page.properties.URL) {
          const urlProperty = page.properties.URL;
          if (urlProperty.type === "url" && urlProperty.url) {
            existingUrls.add(urlProperty.url);
          }
        }
      }

      hasMore = response.has_more;
      startCursor = response.next_cursor || undefined;
    }

    console.log(`📋 Notion 데이터베이스에서 ${existingUrls.size}개의 기존 제품을 확인했습니다.`);
    return existingUrls;
  } catch (error: any) {
    console.error("Notion 데이터베이스 조회 오류:", error.message);
    if (error.body) {
      console.error("상세 오류:", JSON.stringify(error.body, null, 2));
    }
    throw error;
  }
}

export async function syncToNotion(product: Product, analysis: string, translatedDescription: string): Promise<void> {
  if (!process.env.NOTION_API_KEY) {
    throw new Error("NOTION_API_KEY 환경 변수가 설정되지 않았습니다.");
  }
  if (!DB_ID) {
    throw new Error("NOTION_DB_ID 환경 변수가 설정되지 않았습니다.");
  }

  try {
    const revenueNumber = parseFloat(product.revenue) || 0;

    const properties: any = {
      Name: { title: [{ text: { content: product.name || "Untitled" } }] },
      Description: { rich_text: [{ text: { content: translatedDescription || "" } }] },
      Revenue: { number: revenueNumber },
      URL: { url: product.link },
    };

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

    // Rich text 파싱 (볼드, 이탤릭 등)
    const parseRichText = (text: string): any[] => {
      const parts: any[] = [];
      let currentIndex = 0;

      // **text** 또는 __text__ 패턴 찾기
      const boldRegex = /(\*\*|__)(.+?)\1/g;
      let match;

      while ((match = boldRegex.exec(text)) !== null) {
        // 볼드 앞의 일반 텍스트
        if (match.index > currentIndex) {
          const beforeText = text.substring(currentIndex, match.index);
          if (beforeText) {
            parts.push({ type: "text", text: { content: beforeText } });
          }
        }

        // 볼드 텍스트
        parts.push({
          type: "text",
          text: { content: match[2] },
          annotations: { bold: true },
        });

        currentIndex = match.index + match[0].length;
      }

      // 남은 텍스트
      if (currentIndex < text.length) {
        const remainingText = text.substring(currentIndex);
        if (remainingText) {
          parts.push({ type: "text", text: { content: remainingText } });
        }
      }

      // 볼드가 없는 경우 전체 텍스트 반환
      return parts.length > 0 ? parts : [{ type: "text", text: { content: text } }];
    };

    // Analysis를 페이지 본문(children)에 추가
    // 마크다운을 Notion 블록 형식으로 변환
    const parseMarkdownToBlocks = (text: string): any[] => {
      const lines = text.split("\n");
      const blocks: any[] = [];
      let currentBulletList: any[] = [];
      let currentNumberedList: any[] = [];
      let numberedCounter = 1;

      const flushLists = () => {
        if (currentBulletList.length > 0) {
          blocks.push(...currentBulletList);
          currentBulletList = [];
        }
        if (currentNumberedList.length > 0) {
          blocks.push(...currentNumberedList);
          currentNumberedList = [];
          numberedCounter = 1;
        }
      };

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          flushLists();
          continue;
        }

        // 마크다운 헤딩 처리 (볼드 포함)
        if (trimmed.startsWith("####")) {
          flushLists();
          const headingText = trimmed.replace(/^####\s*/, "");
          blocks.push({
            object: "block",
            type: "heading_3",
            heading_3: {
              rich_text: parseRichText(headingText),
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
              rich_text: parseRichText(headingText),
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
              rich_text: parseRichText(headingText),
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
              rich_text: parseRichText(headingText),
            },
          });
          continue;
        }

        // 이모지로 시작하는 제목 처리 (1️⃣, ✅, ❌ 등)
        if (/^[0-9]️⃣|^[✅❌]/.test(trimmed) && !trimmed.match(/^[-•*]\s/)) {
          flushLists();
          blocks.push({
            object: "block",
            type: "heading_2",
            heading_2: {
              rich_text: parseRichText(trimmed),
            },
          });
          continue;
        }

        // 구분선 처리 (---, ***, ___)
        if (/^[-*_]{3,}$/.test(trimmed)) {
          flushLists();
          blocks.push({
            object: "block",
            type: "divider",
            divider: {},
          });
          continue;
        }

        // 숫자 리스트 처리 (1. 2. 등)
        const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
        if (numberedMatch) {
          flushLists();
          currentNumberedList.push({
            object: "block",
            type: "numbered_list_item",
            numbered_list_item: {
              rich_text: parseRichText(numberedMatch[2]),
            },
          });
          continue;
        }

        // 불릿 리스트 처리 (-, •, * 등)
        // 단, 불릿 + 볼드만 있고 내용이 짧은 경우는 제목으로 처리
        if (/^[-•*]\s+/.test(trimmed)) {
          const content = trimmed.replace(/^[-•*]\s+/, "");
          // 볼드 텍스트만 있고 물음표나 짧은 문장인 경우 제목으로 처리
          const isHeading =
            /^\*\*.*\*\*$/.test(content.trim()) ||
            (content.includes("?") && content.length < 100) ||
            /^[-•*]\s+\*\*.*\*\*$/.test(trimmed);

          if (isHeading) {
            flushLists();
            // 볼드 마크다운 제거하고 제목으로 처리
            const headingText = content.replace(/\*\*/g, "").trim();
            blocks.push({
              object: "block",
              type: "heading_3",
              heading_3: {
                rich_text: parseRichText(headingText),
              },
            });
            continue;
          }

          // 일반 불릿 리스트
          flushLists();
          currentBulletList.push({
            object: "block",
            type: "bulleted_list_item",
            bulleted_list_item: {
              rich_text: parseRichText(content),
            },
          });
          continue;
        }

        // 들여쓰기된 리스트 (하위 항목) - 2칸 이상 들여쓰기
        const indentMatch = trimmed.match(/^(\s{2,})[-•*]\s+(.+)$/);
        if (indentMatch) {
          const content = indentMatch[2];
          const indentLevel = indentMatch[1].length;

          if (currentBulletList.length > 0) {
            // 마지막 항목에 자식 추가 (Notion은 중첩 리스트 지원)
            const lastItem = currentBulletList[currentBulletList.length - 1];
            if (!lastItem.bulleted_list_item.children) {
              lastItem.bulleted_list_item.children = [];
            }
            lastItem.bulleted_list_item.children.push({
              object: "block",
              type: "bulleted_list_item",
              bulleted_list_item: {
                rich_text: parseRichText(content),
              },
            });
          } else {
            // 부모 항목이 없으면 일반 불릿으로 처리
            flushLists();
            currentBulletList.push({
              object: "block",
              type: "bulleted_list_item",
              bulleted_list_item: {
                rich_text: parseRichText(content),
              },
            });
          }
          continue;
        }

        // 일반 텍스트 (볼드 처리 포함)
        flushLists();
        const richText = parseRichText(trimmed);
        blocks.push({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: richText,
          },
        });
      }

      flushLists();
      return blocks;
    };

    const analysisBlocks = parseMarkdownToBlocks(analysis);

    await notion.pages.create({
      parent: { database_id: DB_ID },
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
  } catch (error: any) {
    console.error("Notion API 오류:", error.message);
    if (error.body) {
      console.error("상세 오류:", JSON.stringify(error.body, null, 2));
    }
    throw error;
  }
}
