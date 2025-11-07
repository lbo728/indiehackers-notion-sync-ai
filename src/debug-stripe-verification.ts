import "dotenv/config";
import puppeteer from "puppeteer";

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  console.log("🌐 Indie Hackers 제품 페이지 로딩 중...");
  await page.goto("https://www.indiehackers.com/products", {
    waitUntil: "networkidle2",
    timeout: 30000,
  });

  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("🔍 첫 번째 제품 링크 찾기...");
  const firstProductLink = await page.evaluate(() => {
    const firstLink = document.querySelector("a[href^='/product/']");
    return firstLink ? (firstLink as HTMLAnchorElement).href : null;
  });

  if (!firstProductLink) {
    console.error("❌ 제품 링크를 찾을 수 없습니다.");
    await browser.close();
    process.exit(1);
  }

  console.log(`📄 제품 페이지 방문: ${firstProductLink}`);
  const productPage = await browser.newPage();
  await productPage.goto(firstProductLink, {
    waitUntil: "networkidle2",
    timeout: 20000,
  });

  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("\n🔍 Stripe 인증 배지 찾기...\n");

  const debugInfo = await productPage.evaluate(() => {
    const info: {
      pageTitle: string;
      pageText: string;
      hasStripeText: boolean;
      hasVerifiedText: boolean;
      stripeSelectors: { selector: string; found: boolean }[];
      allImages: string[];
      allSvgs: number;
      revenueElements: string[];
      htmlSnippet: string;
    } = {
      pageTitle: document.title,
      pageText: document.body.textContent || "",
      hasStripeText: false,
      hasVerifiedText: false,
      stripeSelectors: [],
      allImages: [],
      allSvgs: 0,
      revenueElements: [],
      htmlSnippet: "",
    };

    // 텍스트 확인
    info.hasStripeText = info.pageText.toLowerCase().includes("stripe");
    info.hasVerifiedText = info.pageText.toLowerCase().includes("verified");

    // 선택자 테스트
    const selectors = [
      "[data-stripe-verified]",
      '[data-verified="stripe"]',
      '[class*="stripe-verified"]',
      '[class*="verified-badge"]',
      '[class*="stripe-badge"]',
      '[title*="Stripe"]',
      '[alt*="Stripe"]',
      'svg[class*="stripe"]',
      'img[src*="stripe"]',
      'img[src*="verified"]',
      '[aria-label*="Stripe"]',
      '[aria-label*="Verified"]',
    ];

    selectors.forEach((selector) => {
      const found = !!document.querySelector(selector);
      info.stripeSelectors.push({ selector, found });
    });

    // 모든 이미지 src 수집
    const images = Array.from(document.querySelectorAll("img"));
    info.allImages = images.map((img) => (img as HTMLImageElement).src).slice(0, 20);

    // SVG 개수
    info.allSvgs = document.querySelectorAll("svg").length;

    // Revenue 관련 요소 찾기
    const revenueElements = Array.from(document.querySelectorAll("*")).filter((el) => {
      const text = el.textContent || "";
      return text.includes("REVENUE") || text.includes("Revenue") || text.includes("$");
    });

    info.revenueElements = revenueElements.slice(0, 5).map((el) => {
      const text = el.textContent?.substring(0, 100) || "";
      const html = el.innerHTML.substring(0, 200);
      return `Text: ${text} | HTML: ${html}`;
    });

    // Revenue 섹션의 HTML 스니펫
    if (revenueElements.length > 0) {
      const firstRevenue = revenueElements[0];
      const parent = firstRevenue.parentElement;
      if (parent) {
        info.htmlSnippet = parent.innerHTML.substring(0, 500);
      }
    }

    return info;
  });

  console.log("📊 디버그 정보:");
  console.log(`제목: ${debugInfo.pageTitle}`);
  console.log(`\n텍스트 검색:`);
  console.log(`  - "Stripe" 포함: ${debugInfo.hasStripeText}`);
  console.log(`  - "Verified" 포함: ${debugInfo.hasVerifiedText}`);

  console.log(`\n선택자 검색 결과:`);
  debugInfo.stripeSelectors.forEach(({ selector, found }) => {
    console.log(`  ${found ? "✅" : "❌"} ${selector}`);
  });

  console.log(`\n이미지 (최대 20개):`);
  debugInfo.allImages.forEach((src, i) => {
    console.log(`  ${i + 1}. ${src}`);
  });

  console.log(`\nSVG 개수: ${debugInfo.allSvgs}`);

  console.log(`\nRevenue 관련 요소 (최대 5개):`);
  debugInfo.revenueElements.forEach((el, i) => {
    console.log(`  ${i + 1}. ${el}`);
  });

  console.log(`\nRevenue 섹션 HTML 스니펫:`);
  console.log(debugInfo.htmlSnippet);

  console.log("\n⏸️ 브라우저를 열어 두었습니다. 수동으로 확인해보세요.");
  console.log("5초 후 브라우저가 닫힙니다...\n");

  await new Promise((resolve) => setTimeout(resolve, 5000));

  await browser.close();
})();
