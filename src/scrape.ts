import puppeteer from "puppeteer";

export type Product = {
  name: string;
  description: string;
  revenue: string;
  link: string;
  thumbnail: string;
  firstFeedPost?: string;
  websiteUrl?: string;
  isStripeVerified?: boolean;
};

export async function scrapeIndieHackers(): Promise<Product[]> {
  const browser = await puppeteer.launch({
    headless: false, // Cloudflare 우회를 위해 실제 브라우저 창 표시
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
      "--window-size=1920,1080",
    ],
  });
  const page = await browser.newPage();

  // User-Agent 설정 (실제 브라우저처럼 보이게)
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  // 추가 헤더 설정
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  });

  // webdriver 플래그와 다른 봇 감지 요소 제거
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    });

    // Chrome 객체 추가
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).chrome = {
      runtime: {},
    };

    // Permissions 추가
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalQuery = (window.navigator as any).permissions.query;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).permissions.query = (parameters: any) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
        : originalQuery(parameters);
  });

  console.log("🌐 Indie Hackers 페이지 로딩 중...");

  // Cloudflare 우회를 위해 더 긴 대기 시간과 다른 waitUntil 옵션 시도
  try {
    await page.goto("https://www.indiehackers.com/products", {
      waitUntil: "networkidle2",
      timeout: 120000,
    });

    // Cloudflare 체크가 완료될 때까지 더 긴 시간 대기
    console.log("⏳ Cloudflare 체크 완료 대기 중... (최대 15초)");
    await new Promise((resolve) => setTimeout(resolve, 15000));

    // 페이지가 완전히 로드될 때까지 추가 대기
    await new Promise((resolve) => setTimeout(resolve, 5000));
  } catch {
    console.log("⚠️ 첫 번째 로드 시도 실패, 재시도합니다...");
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await page.goto("https://www.indiehackers.com/products", {
      waitUntil: "networkidle2",
      timeout: 120000,
    });
    await new Promise((resolve) => setTimeout(resolve, 15000));
  }

  console.log("🔍 제품 요소 검색 중...");

  // 먼저 전체 페이지에서 verified revenue 요소들의 위치를 찾고, 각 제품과 매칭
  // waitForSelector 대신 직접 evaluate 실행 (페이지가 이미 로드되었을 수 있음)

  // 디버그: 페이지 상태 확인
  const pageInfo = await page.evaluate(() => {
    const allLinks = Array.from(document.querySelectorAll("a"));
    const productLinks = allLinks.filter((link) => {
      const href = (link as HTMLAnchorElement).href;
      return href && href.includes("/product/");
    });
    return {
      title: document.title,
      totalLinks: allLinks.length,
      productLinks: productLinks.length,
      firstProductLink: productLinks[0] ? (productLinks[0] as HTMLAnchorElement).href : null,
      bodyText: document.body.textContent?.substring(0, 200) || "",
    };
  });

  console.log(`📄 페이지 정보: ${pageInfo.title}`);
  console.log(`🔗 총 링크: ${pageInfo.totalLinks}개, 제품 링크: ${pageInfo.productLinks}개`);
  if (pageInfo.firstProductLink) {
    console.log(`📌 첫 번째 제품 링크: ${pageInfo.firstProductLink}`);
  }

  // 만약 제품 링크가 없다면 스크롤해서 더 많은 콘텐츠 로드
  if (pageInfo.productLinks === 0) {
    console.log("⚠️ 제품 링크를 찾지 못했습니다. 페이지를 스크롤하여 더 많은 콘텐츠를 로드합니다...");
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 스크롤 후 다시 확인
    const pageInfoAfterScroll = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll("a"));
      const productLinks = allLinks.filter((link) => {
        const href = (link as HTMLAnchorElement).href;
        return href && href.includes("/product/");
      });
      return {
        productLinks: productLinks.length,
      };
    });
    console.log(`📌 스크롤 후 제품 링크: ${pageInfoAfterScroll.productLinks}개`);
  }

  const productData = await page.evaluate(() => {
    const products: Array<{
      name: string;
      description: string;
      revenue: string;
      link: string;
      isStripeVerified: boolean;
    }> = [];

    // 모든 제품 링크 찾기 (여러 방법 시도)
    let productLinks = Array.from(document.querySelectorAll("a[href^='/product/']"));

    // 만약 제품 링크를 찾지 못했다면 다른 선택자 시도
    if (productLinks.length === 0) {
      // Ember.js나 다른 프레임워크에서 사용할 수 있는 다른 선택자들
      productLinks = Array.from(document.querySelectorAll("a[href*='/product/']"));
    }

    if (productLinks.length === 0) {
      // 더 넓은 범위로 검색
      const allLinks = Array.from(document.querySelectorAll("a"));
      productLinks = allLinks.filter((link) => {
        const href = (link as HTMLAnchorElement).href;
        return href && href.includes("/product/");
      });
    }

    // 모든 verified revenue 요소 찾기
    const verifiedRevenueElements = Array.from(document.querySelectorAll(".product-card__revenue-explanation")).filter(
      (el) => {
        const text = (el.textContent || "").toLowerCase().replace(/\s+/g, " ");
        return text.includes("verified revenue") || text.includes("-verified revenue");
      }
    );

    productLinks.forEach((link) => {
      let name = "";
      const strongEl = link.querySelector("strong");
      if (strongEl) {
        name = strongEl.textContent?.trim() || "";
      }
      if (!name) {
        const spans = link.querySelectorAll("span");
        if (spans.length > 0) {
          name = spans[0].textContent?.trim() || "";
        }
      }

      let description = "";
      const strongElForDesc = link.querySelector("strong");
      if (strongElForDesc) {
        const nextSpan = strongElForDesc.nextElementSibling?.querySelector("span");
        if (nextSpan) {
          description = nextSpan.textContent?.trim() || "";
        }
      }
      if (!description) {
        const spans = link.querySelectorAll("span");
        if (spans.length > 1) {
          description = spans[1].textContent?.trim() || "";
        }
      }

      let revenueNumber = 0;
      const revenueText = link.textContent?.match(/\$([\d,]+)/)?.[1] || "";
      if (revenueText) {
        revenueNumber = parseFloat(revenueText.replace(/,/g, "")) || 0;
      }

      // Stripe 인증 여부 확인: 제품 링크 근처에 verified revenue 요소가 있는지 확인
      let isStripeVerified = false;

      // 제품 카드 컨테이너 찾기 (여러 레벨의 부모 요소 확인)
      let container = link.parentElement;
      let depth = 0;
      while (container && depth < 5) {
        const verifiedEl = container.querySelector(".product-card__revenue-explanation");
        if (verifiedEl) {
          const text = (verifiedEl.textContent || "").toLowerCase().replace(/\s+/g, " ");
          if (text.includes("verified revenue") || text.includes("-verified revenue")) {
            isStripeVerified = true;
            break;
          }
        }
        container = container.parentElement;
        depth++;
      }

      // verified revenue 요소 리스트와 거리 기반으로 매칭 시도
      if (!isStripeVerified && verifiedRevenueElements.length > 0) {
        const linkRect = link.getBoundingClientRect();
        for (const verifiedEl of verifiedRevenueElements) {
          const verifiedRect = verifiedEl.getBoundingClientRect();
          // 같은 행에 있는지 확인 (y 좌표가 비슷하고 x 좌표가 가까움)
          const sameRow = Math.abs(linkRect.top - verifiedRect.top) < 100;
          const nearby = Math.abs(linkRect.left - verifiedRect.left) < 600;
          if (sameRow && nearby) {
            isStripeVerified = true;
            break;
          }
        }
      }

      const href = (link as HTMLAnchorElement).href;

      products.push({
        name: name || "Unknown",
        description: description || "",
        revenue: revenueNumber.toString(),
        link: href,
        isStripeVerified,
      });
    });

    return products;
  });

  const productLinks = productData;

  console.log(`📦 기본 정보 수집 완료: ${productLinks.length}개`);
  console.log("🖼️ 실제 썸네일 이미지 URL 수집 중...");

  const products = await Promise.all(
    productLinks.slice(0, 30).map(async (product) => {
      let thumbnail = "";
      let actualRevenue = product.revenue;
      let firstFeedPost = "";
      let websiteUrl = "";
      let isStripeVerified = product.isStripeVerified || false;

      try {
        const productPage = await browser.newPage();
        await productPage.goto(product.link, {
          waitUntil: "networkidle2",
          timeout: 20000,
        });

        await new Promise((resolve) => setTimeout(resolve, 3000));

        const detailInfo = await productPage.evaluate(() => {
          const result: {
            thumbnail: string;
            revenue: string;
            firstFeedPost: string;
            websiteUrl: string;
            isStripeVerified: boolean;
          } = {
            thumbnail: "",
            revenue: "",
            firstFeedPost: "",
            websiteUrl: "",
            isStripeVerified: false,
          };

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

          const revenueElements = Array.from(document.querySelectorAll("*")).filter((el) => {
            const text = el.textContent || "";
            return text.includes("REVENUE") || text.includes("Revenue") || text.includes("$");
          });

          for (const el of revenueElements) {
            const text = el.textContent || "";
            const revenueMatch = text.match(/\$([\d,]+)\s*\/?\s*(?:mo|month)/i);
            if (revenueMatch) {
              result.revenue = revenueMatch[1].replace(/,/g, "");
              break;
            }
            const simpleMatch = text.match(/\$([\d,]+)/);
            if (simpleMatch && !result.revenue) {
              result.revenue = simpleMatch[1].replace(/,/g, "");
            }
          }

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

          if (!result.firstFeedPost) {
            const allText = document.body.textContent || "";
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

          // 웹사이트 URL 추출
          const websiteLinkSelectors = [
            'a[href^="http"]',
            'a[target="_blank"]',
            '[class*="website"] a',
            '[class*="link"] a',
            'a[href*="www"]',
          ];

          for (const selector of websiteLinkSelectors) {
            const links = Array.from(document.querySelectorAll(selector));
            for (const link of links) {
              const href = (link as HTMLAnchorElement).href;
              if (
                href &&
                href.startsWith("http") &&
                !href.includes("indiehackers.com") &&
                !href.includes("twitter.com") &&
                !href.includes("linkedin.com") &&
                !href.includes("github.com")
              ) {
                result.websiteUrl = href;
                break;
              }
            }
            if (result.websiteUrl) break;
          }

          // Stripe 인증 여부 확인 (상세 페이지에서)
          // "verified revenue" 클래스를 가진 요소가 있으면 Stripe 인증된 매출
          const verifiedRevenueEl = document.querySelector(".product-card__revenue-explanation");
          if (verifiedRevenueEl) {
            // 줄바꿈과 공백을 정규화해서 비교
            const text = (verifiedRevenueEl.textContent || "").toLowerCase().replace(/\s+/g, " ");
            if (text.includes("verified revenue") || text.includes("-verified revenue")) {
              result.isStripeVerified = true;
            }
          }

          // 다른 가능한 클래스명도 확인
          if (!result.isStripeVerified) {
            const allVerifiedRevenueEls = document.querySelectorAll('[class*="revenue-explanation"]');
            for (const el of Array.from(allVerifiedRevenueEls)) {
              const text = (el.textContent || "").toLowerCase().replace(/\s+/g, " ");
              if (text.includes("verified revenue") || text.includes("-verified revenue")) {
                result.isStripeVerified = true;
                break;
              }
            }
          }

          // 페이지 전체 텍스트에서도 확인 (백업)
          if (!result.isStripeVerified) {
            const pageText = (document.body.textContent || "").toLowerCase().replace(/\s+/g, " ");
            if (pageText.includes("-verified revenue") || pageText.includes("verified revenue")) {
              result.isStripeVerified = true;
            }
          }

          return result;
        });

        thumbnail = detailInfo.thumbnail;
        if (detailInfo.revenue) {
          actualRevenue = detailInfo.revenue;
        }
        firstFeedPost = detailInfo.firstFeedPost;
        websiteUrl = detailInfo.websiteUrl || "";
        // 상세 페이지에서 확인한 결과를 우선 사용, 없으면 리스트 페이지 결과 사용
        isStripeVerified = detailInfo.isStripeVerified || product.isStripeVerified || false;

        await productPage.close();

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
        websiteUrl: websiteUrl || "",
        isStripeVerified: isStripeVerified || false,
      };
    })
  );

  console.log(`📊 스크래핑 결과: ${products.length}개 제품 발견`);

  await browser.close();
  return products;
}

/**
 * 최신 제품을 스크래핑합니다.
 * @param maxCount 최대 가져올 제품 개수 (기본값: 20)
 */
export async function scrapeLatestProducts(maxCount: number = 20): Promise<Product[]> {
  const allProducts = await scrapeIndieHackers();
  console.log(`📦 최신 제품 ${allProducts.length}개 중 ${maxCount}개를 가져옵니다.`);
  return allProducts.slice(0, maxCount);
}

/**
 * 제품 웹사이트의 주요 내용을 스크래핑합니다.
 * PO의 시선으로 분석할 수 있도록 핵심 정보를 추출합니다.
 */
export async function scrapeWebsiteContent(websiteUrl: string): Promise<string> {
  if (!websiteUrl || !websiteUrl.startsWith("http")) {
    return "";
  }

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log(`🌐 웹사이트 방문 중: ${websiteUrl}`);
    await page.goto(websiteUrl, {
      waitUntil: "networkidle2",
      timeout: 15000,
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const websiteContent = await page.evaluate(() => {
      const content: {
        title: string;
        hero: string;
        features: string[];
        description: string;
        pricing: string;
      } = {
        title: "",
        hero: "",
        features: [],
        description: "",
        pricing: "",
      };

      // 페이지 제목
      const titleEl = document.querySelector("h1, [class*='hero'] h1, [class*='headline']");
      if (titleEl) {
        content.title = titleEl.textContent?.trim() || "";
      }

      // 히어로 섹션 (메인 설명)
      const heroSelectors = [
        "[class*='hero'] p",
        "[class*='hero'] [class*='description']",
        "[class*='hero'] [class*='subtitle']",
        "section[class*='hero'] p",
        "main > section:first-child p",
      ];

      for (const selector of heroSelectors) {
        const heroEl = document.querySelector(selector);
        if (heroEl) {
          const text = heroEl.textContent?.trim() || "";
          if (text.length > 20 && text.length < 500) {
            content.hero = text;
            break;
          }
        }
      }

      // 주요 기능/특징
      const featureSelectors = [
        "[class*='feature']",
        "[class*='benefit']",
        "[class*='advantage']",
        "li[class*='feature']",
        "[class*='features'] li",
      ];

      for (const selector of featureSelectors) {
        const features = Array.from(document.querySelectorAll(selector));
        if (features.length > 0) {
          content.features = features
            .slice(0, 6)
            .map((el) => el.textContent?.trim() || "")
            .filter((text) => text.length > 10 && text.length < 200);
          break;
        }
      }

      // 설명 텍스트
      const descSelectors = ["[class*='description']", "[class*='about']", "[class*='intro']", "main p", "section p"];

      for (const selector of descSelectors) {
        const descEl = document.querySelector(selector);
        if (descEl) {
          const text = descEl.textContent?.trim() || "";
          if (text.length > 50 && text.length < 1000) {
            content.description = text;
            break;
          }
        }
      }

      // 가격 정보
      const pricingSelectors = ["[class*='pricing']", "[class*='price']", "[class*='plan']", "[class*='subscription']"];

      for (const selector of pricingSelectors) {
        const pricingEl = document.querySelector(selector);
        if (pricingEl) {
          content.pricing = pricingEl.textContent?.trim() || "";
          break;
        }
      }

      return content;
    });

    await browser.close();

    // 구조화된 정보를 문자열로 변환
    const parts: string[] = [];
    if (websiteContent.title) parts.push(`제목: ${websiteContent.title}`);
    if (websiteContent.hero) parts.push(`메인 설명: ${websiteContent.hero}`);
    if (websiteContent.description) parts.push(`설명: ${websiteContent.description}`);
    if (websiteContent.features.length > 0) {
      parts.push(`주요 기능: ${websiteContent.features.join(", ")}`);
    }
    if (websiteContent.pricing) parts.push(`가격 정보: ${websiteContent.pricing}`);

    return parts.join("\n");
  } catch (error) {
    await browser.close();
    console.log(`⚠️ 웹사이트 스크래핑 실패: ${error}`);
    return "";
  }
}
