import puppeteer from "puppeteer";

export type Product = {
  name: string;
  description: string;
  revenue: string;
  link: string;
  thumbnail: string;
  firstFeedPost?: string; // 상세 페이지의 첫 번째 피드 글
};

export async function scrapeIndieHackers(): Promise<Product[]> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  console.log("🌐 Indie Hackers 페이지 로딩 중...");
  await page.goto("https://www.indiehackers.com/products", {
    waitUntil: "networkidle2",
    timeout: 30000,
  });

  // 페이지가 완전히 로드될 때까지 대기
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("🔍 제품 요소 검색 중...");

  // 요소가 로드될 때까지 대기
  try {
    await page.waitForSelector("a[href^='/product/']", { timeout: 10000 });
  } catch (error) {
    console.log("⚠️ 제품 링크를 찾을 수 없습니다. 페이지 구조를 확인합니다...");
  }

  // 먼저 기본 제품 정보 수집
  const productLinks = await page.$$eval("a[href^='/product/']", (els) => {
    return els.map((el) => {
      // 제품 이름 추출 - strong 태그 또는 첫 번째 span
      let name = "";
      const strongEl = el.querySelector("strong");
      if (strongEl) {
        name = strongEl.textContent?.trim() || "";
      }
      if (!name) {
        // Products Database 섹션의 경우 첫 번째 span이 이름
        const spans = el.querySelectorAll("span");
        if (spans.length > 0) {
          name = spans[0].textContent?.trim() || "";
        }
      }

      // 설명 추출 - 제품 이름 다음의 span 또는 text
      let description = "";
      const strongElForDesc = el.querySelector("strong");
      if (strongElForDesc) {
        // strong 다음의 span이 설명
        const nextSpan = strongElForDesc.nextElementSibling?.querySelector("span");
        if (nextSpan) {
          description = nextSpan.textContent?.trim() || "";
        }
      }
      if (!description) {
        // Products Database의 경우 두 번째 span이 설명
        const spans = el.querySelectorAll("span");
        if (spans.length > 1) {
          description = spans[1].textContent?.trim() || "";
        }
      }

      // Revenue 추출 및 파싱 - 숫자만 추출
      let revenueNumber = 0;
      const revenueText = el.textContent?.match(/\$([\d,]+)/)?.[1] || "";
      if (revenueText) {
        revenueNumber = parseFloat(revenueText.replace(/,/g, "")) || 0;
      }

      const href = (el as Element & { href: string }).href;

      return {
        name: name || "Unknown",
        description: description || "",
        revenue: revenueNumber.toString(),
        link: href,
      };
    });
  });

  console.log(`📦 기본 정보 수집 완료: ${productLinks.length}개`);
  console.log("🖼️ 실제 썸네일 이미지 URL 수집 중...");

  // 각 제품의 실제 썸네일 이미지 URL, Revenue, 첫 번째 피드 글 가져오기
  const products = await Promise.all(
    productLinks.slice(0, 30).map(async (product) => {
      let thumbnail = "";
      let actualRevenue = product.revenue;
      let firstFeedPost = "";

      try {
        // 제품 상세 페이지로 이동
        const productPage = await browser.newPage();
        await productPage.goto(product.link, {
          waitUntil: "networkidle2",
          timeout: 20000,
        });

        // 페이지 로드 대기
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // 상세 페이지에서 정보 추출
        const detailInfo = await productPage.evaluate(() => {
          const result: {
            thumbnail: string;
            revenue: string;
            firstFeedPost: string;
          } = {
            thumbnail: "",
            revenue: "",
            firstFeedPost: "",
          };

          // 1. 실제 이미지 URL 찾기
          const images = Array.from(document.querySelectorAll("img"));
          for (const img of images) {
            const src = (img as HTMLImageElement).src;
            if (src && src.includes("storage.googleapis.com")) {
              result.thumbnail = src;
              break;
            }
            const currentSrc = (img as HTMLImageElement).currentSrc;
            if (currentSrc && currentSrc.includes("storage.googleapis.com")) {
              result.thumbnail = currentSrc;
              break;
            }
          }

          // 2. Revenue 추출 - REVENUE 섹션에서 정확한 값 찾기
          const revenueElements = Array.from(document.querySelectorAll("*")).filter((el) => {
            const text = el.textContent || "";
            return text.includes("REVENUE") || text.includes("Revenue") || text.includes("$");
          });

          for (const el of revenueElements) {
            const text = el.textContent || "";
            // $9/mo, $9/month 등의 패턴 찾기
            const revenueMatch = text.match(/\$([\d,]+)\s*\/?\s*(?:mo|month)/i);
            if (revenueMatch) {
              result.revenue = revenueMatch[1].replace(/,/g, "");
              break;
            }
            // 또는 단순히 $숫자 패턴
            const simpleMatch = text.match(/\$([\d,]+)/);
            if (simpleMatch && !result.revenue) {
              result.revenue = simpleMatch[1].replace(/,/g, "");
            }
          }

          // 3. 첫 번째 피드 글 추출
          // 피드/타임라인에서 첫 번째 포스트 찾기
          const feedSelectors = [
            "article",
            '[class*="post"]',
            '[class*="feed"]',
            '[class*="update"]',
            '[class*="timeline"]',
            'div[class*="Post"]',
          ];

          for (const selector of feedSelectors) {
            const posts = Array.from(document.querySelectorAll(selector));
            if (posts.length > 0) {
              const firstPost = posts[0];
              // 제목과 본문 추출
              const titleEl = firstPost.querySelector("h1, h2, h3, h4, [class*='title'], [class*='headline']");
              const contentEl = firstPost.querySelector("p, [class*='content'], [class*='body'], [class*='text']");

              const title = titleEl?.textContent?.trim() || "";
              const content = contentEl?.textContent?.trim() || "";

              if (title || content) {
                result.firstFeedPost = [title, content].filter(Boolean).join("\n\n");
                break;
              }
            }
          }

          // 대안: 모든 텍스트에서 날짜와 함께 나오는 첫 번째 긴 텍스트 찾기
          if (!result.firstFeedPost) {
            const allText = document.body.textContent || "";
            // 날짜 패턴 다음에 나오는 긴 문단 찾기
            const datePattern =
              /(?:NOVEMBER|DECEMBER|JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER)\s+\d{1,2},\s+\d{4}/i;
            const dateMatch = allText.match(datePattern);
            if (dateMatch) {
              const dateIndex = allText.indexOf(dateMatch[0]);
              const afterDate = allText.substring(dateIndex + dateMatch[0].length, dateIndex + 500);
              const sentences = afterDate.split(/[.!?]\s+/).filter((s) => s.trim().length > 20);
              if (sentences.length > 0) {
                result.firstFeedPost = sentences.slice(0, 3).join(". ");
              }
            }
          }

          return result;
        });

        thumbnail = detailInfo.thumbnail;
        if (detailInfo.revenue) {
          actualRevenue = detailInfo.revenue;
        }
        firstFeedPost = detailInfo.firstFeedPost;

        await productPage.close();

        // 실제 이미지 URL을 찾지 못한 경우, 제품 이름 기반으로 URL 생성 시도
        if (!thumbnail) {
          const productSlug = product.link.split("/product/")[1]?.split("/")[0] || "";
          if (productSlug) {
            thumbnail = `https://storage.googleapis.com/indie-hackers.appspot.com/product-avatars/${productSlug}/128x128_${productSlug}.webp`;
          }
        }
      } catch (error) {
        console.log(`⚠️ ${product.name} 상세 정보 수집 실패: ${error}`);
      }

      return {
        ...product,
        revenue: actualRevenue,
        thumbnail: thumbnail || "",
        firstFeedPost: firstFeedPost || "",
      };
    })
  );

  console.log(`📊 스크래핑 결과: ${products.length}개 제품 발견`);

  await browser.close();
  return products.slice(0, 30);
}
