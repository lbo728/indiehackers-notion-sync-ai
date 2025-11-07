import "dotenv/config";
import { Client } from "@notionhq/client";
import { scrapeProductsForReport } from "./scrape.js";
import OpenAI from "openai";
import type { Product } from "./scrape.js";
import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 보고서를 저장할 Notion 페이지 ID 또는 데이터베이스 ID (환경 변수로 설정)
const REPORT_PAGE_ID = process.env.NOTION_REPORT_PAGE_ID;
const REPORT_DB_ID = process.env.NOTION_REPORT_DB_ID;

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
 * 제품들을 카테고리별로 분류합니다.
 */
function categorizeProducts(products: Product[]): {
  aiTools: Product[];
  utilities: Product[];
  productivity: Product[];
  others: Product[];
} {
  const aiTools: Product[] = [];
  const utilities: Product[] = [];
  const productivity: Product[] = [];
  const others: Product[] = [];

  products.forEach((product) => {
    const nameLower = product.name.toLowerCase();
    const descLower = product.description.toLowerCase();

    if (
      nameLower.includes("ai") ||
      descLower.includes("ai") ||
      descLower.includes("artificial intelligence") ||
      descLower.includes("machine learning") ||
      nameLower.includes("gpt") ||
      descLower.includes("chatgpt")
    ) {
      aiTools.push(product);
    } else if (
      descLower.includes("automation") ||
      descLower.includes("workflow") ||
      descLower.includes("productivity") ||
      descLower.includes("task")
    ) {
      productivity.push(product);
    } else if (
      descLower.includes("tool") ||
      descLower.includes("utility") ||
      descLower.includes("generator") ||
      descLower.includes("calculator") ||
      descLower.includes("converter")
    ) {
      utilities.push(product);
    } else {
      others.push(product);
    }
  });

  return { aiTools, utilities, productivity, others };
}

/**
 * GPT를 활용해 트렌드 분석 및 아이디어를 생성합니다.
 */
async function generateTrendAnalysis(products: Product[]): Promise<string> {
  const productList = products
    .slice(0, 30)
    .map(
      (p, idx) =>
        `${idx + 1}. ${p.name} - ${p.description} (MRR: $${p.revenue}, Stripe 인증: ${p.isStripeVerified ? "✅" : "❌"})`
    )
    .join("\n");

  const prompt = `
다음은 IndieHackers에서 수집한 최신 SaaS 제품 목록입니다:

${productList}

이 제품들을 분석하여 다음 형식으로 트렌드 요약을 작성해주세요:

## 💡 오늘 페이지에서 보이는 SaaS 트렌드 요약

### 카테고리별 관찰 내용

각 카테고리별로 관찰된 내용을 정리해주세요:
- AI 생산성 툴
- 단일 유틸리티형 SaaS
- 수익 검증 부족
- 커뮤니티 기반 마케팅
- AI 편집/자동화

각 카테고리마다:
- **관찰 내용**: 구체적인 패턴이나 특징
- **병스커 관점 아이디어**: 2년차 프론트엔드 개발자 관점에서 벤치마킹할 만한 아이디어나 인사이트

형식은 다음과 같이 작성해주세요:

카테고리 | 관찰 내용 | 병스커 관점 아이디어
--- | --- | ---
AI 생산성 툴 | [관찰 내용] | ✨ [아이디어]
단일 유틸리티형 SaaS | [관찰 내용] | 🔧 [아이디어]
수익 검증 부족 | [관찰 내용] | 💰 [아이디어]
커뮤니티 기반 마케팅 | [관찰 내용] | 📢 [아이디어]
AI 편집/자동화 | [관찰 내용] | 🪄 [아이디어]

한국어로 작성하고, 구체적이고 실용적인 인사이트를 제공해주세요.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    return response.choices[0].message.content?.trim() || "";
  } catch (error) {
    console.error("트렌드 분석 생성 실패:", error);
    return "트렌드 분석을 생성하는 중 오류가 발생했습니다.";
  }
}

/**
 * The Build Board 섹션을 생성합니다 (상위 5개 제품).
 */
function generateBuildBoardSection(products: Product[]): string {
  const topProducts = products
    .filter((p) => parseFloat(p.revenue) > 0 || p.isStripeVerified)
    .slice(0, 5);

  if (topProducts.length === 0) {
    return "";
  }

  let section = "🧩 1. The Build Board (실시간 인기 투표 중인 SaaS)\n\n";
  section += '"오늘의 빌드 보드" — 사용자 투표로 순위가 매겨지는 신규 SaaS들\n\n';
  section += "| 순위 | 제품명 | 설명 | MRR | 인증 여부 |\n";
  section += "|------|--------|------|-----|----------|\n";

  topProducts.forEach((product, index) => {
    const rank = `${index + 1}️⃣`;
    const revenue = `$${parseFloat(product.revenue).toLocaleString()}`;
    const verified = product.isStripeVerified ? "✅ Stripe Verified" : "Self-reported";
    section += `| ${rank} | ${product.name} | ${product.description.substring(0, 50)}... | ${revenue} | ${verified} |\n`;
  });

  section += "\n**관찰 포인트**\n\n";
  section += "- 모두 \"AI + 자동화\" 중심\n";
  section += "- 특히 생산성 도구(자동화, 이미지 생성, 콘텐츠 보조)\n";
  section += "- B2C보단 Indie-maker 툴 느낌\n";
  section += '- "Launch + Giveaway + 업데이트 로그"로 사용자와 피드백 루프 유지\n\n';

  return section;
}

/**
 * Products Database 섹션을 생성합니다.
 */
function generateProductsDatabaseSection(products: Product[]): string {
  let section = "📦 2. Products Database (전체 SaaS 등록 DB)\n\n";
  section += "전 세계 인디 개발자들이 등록한 실시간 SaaS 목록\n";
  section += "대부분 MRR(월 매출) 기준 자가보고(Self-reported)\n\n";
  section += "| 제품명 | 핵심 기능 | MRR | 인증 여부 |\n";
  section += "|--------|----------|-----|----------|\n";

  products.slice(0, 20).forEach((product) => {
    const revenue = product.revenue === "0" ? "$0" : `$${parseFloat(product.revenue).toLocaleString()}`;
    const verified = product.isStripeVerified ? "✅ Stripe Verified" : "Self-reported";
    const description = product.description.substring(0, 40) + (product.description.length > 40 ? "..." : "");
    section += `| ${product.name} | ${description} | ${revenue} | ${verified} |\n`;
  });

  return section;
}

/**
 * 마크다운을 Notion 블록으로 변환합니다.
 */
function parseMarkdownToBlocks(text: string): BlockObjectRequest[] {
  const lines = text.split("\n");
  const blocks: BlockObjectRequest[] = [];
  let currentBulletList: BlockObjectRequest[] = [];
  let currentNumberedList: BlockObjectRequest[] = [];
  let inTable = false;
  let tableRows: string[] = [];

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

  const processTable = () => {
    if (tableRows.length < 2) {
      tableRows = [];
      return;
    }

    // 헤더와 구분선 제거
    const dataRows = tableRows.filter((row) => !row.match(/^[\s|:-\|]+$/));
    if (dataRows.length < 1) {
      tableRows = [];
      return;
    }

    // 테이블을 코드 블록으로 변환 (Notion 테이블 API가 복잡하므로)
    const tableText = tableRows.join("\n");
    blocks.push({
      object: "block",
      type: "code",
      code: {
        rich_text: [{ type: "text", text: { content: tableText } }],
        language: "plain text",
      },
    });
    tableRows = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (inTable) {
        processTable();
        inTable = false;
      }
      flushLists();
      continue;
    }

    // 테이블 감지
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      if (!inTable) {
        flushLists();
        inTable = true;
      }
      tableRows.push(trimmed);
      continue;
    }

    if (inTable) {
      // 테이블이 끝남
      processTable();
      inTable = false;
    }

    if (trimmed.startsWith("####")) {
      flushLists();
      const headingText = trimmed.replace(/^####\s*/, "");
      blocks.push({
        object: "block",
        type: "heading_3",
        heading_3: {
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
          rich_text: parseRichText(headingText) as unknown as any,
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
          rich_text: parseRichText(numberedMatch[2]) as unknown as any,
        },
      });
      continue;
    }

    if (/^[-•*]\s+/.test(trimmed)) {
      const content = trimmed.replace(/^[-•*]\s+/, "");
      flushLists();
      currentBulletList.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: parseRichText(content) as unknown as any,
        },
      });
      continue;
    }

    flushLists();
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: parseRichText(trimmed) as unknown as any,
      },
    });
  }

  flushLists();
  return blocks;
}

/**
 * 보고서를 생성하고 Notion에 저장합니다.
 */
export async function generateAndSaveReport(): Promise<void> {
  try {
    console.log("📊 IndieHackers 보고서 생성 시작\n");
    console.log("=".repeat(80));

    // 1. IndieHackers /products 페이지 분석
    console.log("🔍 IndieHackers /products 페이지 분석 중...");
    const products = await scrapeProductsForReport(50);
    console.log(`✅ ${products.length}개 제품 수집 완료\n`);

    if (products.length === 0) {
      throw new Error("수집된 제품이 없습니다.");
    }

    // 2. 오늘 날짜
    const today = new Date();
    const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;
    const koreanDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

    // 3. 보고서 생성
    console.log("📝 보고서 생성 중...");

    let report = `# IndieHackers 일일 보고서\n\n`;
    report += `**생성 일시**: ${koreanDate}\n\n`;
    report += `---\n\n`;

    // The Build Board 섹션
    const buildBoardSection = generateBuildBoardSection(products);
    if (buildBoardSection) {
      report += buildBoardSection;
      report += `---\n\n`;
    }

    // Products Database 섹션
    const productsSection = generateProductsDatabaseSection(products);
    report += productsSection;
    report += `---\n\n`;

    // 트렌드 분석 섹션
    console.log("🤖 GPT를 활용한 트렌드 분석 중...");
    const trendAnalysis = await generateTrendAnalysis(products);
    report += trendAnalysis;

    console.log("✅ 보고서 생성 완료\n");

    // 4. Notion에 저장
    const blocks = parseMarkdownToBlocks(report);

    if (REPORT_DB_ID) {
      // 데이터베이스에 새 페이지로 저장
      console.log("💾 Notion 데이터베이스에 보고서 저장 중...");
      
      await notion.pages.create({
        parent: { database_id: REPORT_DB_ID },
        properties: {
          Name: {
            title: [
              {
                text: {
                  content: `IndieHackers 보고서 - ${koreanDate}`,
                },
              },
            ],
          },
        },
        children: blocks,
      });

      console.log("✅ Notion 데이터베이스에 보고서 저장 완료!");
      console.log(`📌 데이터베이스 ID: ${REPORT_DB_ID}`);
    } else if (REPORT_PAGE_ID) {
      // 기존 페이지에 저장
      console.log("💾 Notion 페이지에 보고서 저장 중...");

      // 페이지 타입 확인
      try {
        const page = await notion.pages.retrieve({ page_id: REPORT_PAGE_ID });
        console.log(`📄 페이지 타입 확인: ${page.object}`);

        // 기존 페이지의 내용을 모두 삭제
        try {
          let hasMore = true;
          let startCursor: string | undefined = undefined;
          const blockIds: string[] = [];

          while (hasMore) {
            const response = await notion.blocks.children.list({
              block_id: REPORT_PAGE_ID,
              start_cursor: startCursor,
            });

            for (const block of response.results) {
              blockIds.push(block.id);
            }

            hasMore = response.has_more;
            startCursor = response.next_cursor || undefined;
          }

          // 기존 블록 삭제
          for (const blockId of blockIds) {
            try {
              await notion.blocks.delete({ block_id: blockId });
            } catch (error) {
              // 삭제 실패해도 계속 진행
            }
          }
        } catch (error) {
          console.log("⚠️ 기존 블록 삭제 중 오류 발생 (계속 진행):", error);
        }

        // 새 보고서 추가 (배치로 나눠서 추가)
        const batchSize = 100; // Notion API 최대 제한
        for (let i = 0; i < blocks.length; i += batchSize) {
          const batch = blocks.slice(i, i + batchSize);
          try {
            await notion.blocks.children.append({
              block_id: REPORT_PAGE_ID,
              children: batch,
            });
            console.log(`✅ 블록 ${i + 1}-${Math.min(i + batchSize, blocks.length)}/${blocks.length} 추가 완료`);
          } catch (error) {
            console.error(`⚠️ 블록 배치 추가 실패:`, error);
            throw error;
          }
        }

        console.log("✅ Notion 페이지에 보고서 저장 완료!");
        console.log(`📌 페이지 ID: ${REPORT_PAGE_ID}`);
      } catch (error) {
        console.error("❌ 페이지 저장 실패:", error);
        throw error;
      }
    } else {
      console.log("⚠️ NOTION_REPORT_PAGE_ID 또는 NOTION_REPORT_DB_ID가 설정되지 않았습니다.");
      console.log("📄 보고서 내용:\n");
      console.log(report);
      return;
    }
  } catch (error) {
    console.error("❌ 보고서 생성 중 오류 발생:", error);
    throw error;
  }
}

// 직접 실행 시
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes("generateReport")) {
  generateAndSaveReport()
    .then(() => {
      console.log("\n🎉 보고서 생성 완료!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ 오류:", error);
      process.exit(1);
    });
}

