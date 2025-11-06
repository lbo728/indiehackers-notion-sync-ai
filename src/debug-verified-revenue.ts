import "dotenv/config";
import puppeteer from "puppeteer";

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  console.log("🌐 Indie Hackers 제품 리스트 페이지 로딩 중...");
  await page.goto("https://www.indiehackers.com/products", {
    waitUntil: "networkidle2",
    timeout: 30000,
  });

  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("🔍 제품 카드와 verified revenue 요소 찾기...\n");

  const debugInfo = await page.evaluate(() => {
    const info: {
      productCards: Array<{
        name: string;
        hasVerifiedRevenueClass: boolean;
        verifiedRevenueText: string;
        html: string;
      }>;
      allVerifiedRevenueElements: Array<{
        className: string;
        text: string;
        html: string;
      }>;
    } = {
      productCards: [],
      allVerifiedRevenueElements: [],
    };

    // 모든 제품 카드 링크 찾기
    const productLinks = Array.from(document.querySelectorAll("a[href^='/product/']"));

    productLinks.slice(0, 5).forEach((link) => {
      const name = link.querySelector("strong")?.textContent?.trim() || "Unknown";
      const verifiedRevenueEl = link.querySelector(".product-card__revenue-explanation");
      const hasVerifiedRevenueClass = verifiedRevenueEl !== null;
      const verifiedRevenueText = verifiedRevenueEl?.textContent?.trim() || "";

      info.productCards.push({
        name,
        hasVerifiedRevenueClass,
        verifiedRevenueText,
        html: link.innerHTML.substring(0, 500),
      });
    });

    // 모든 revenue-explanation 클래스 요소 찾기
    const allRevenueExplanationEls = Array.from(
      document.querySelectorAll('[class*="revenue-explanation"]')
    );

    allRevenueExplanationEls.forEach((el) => {
      info.allVerifiedRevenueElements.push({
        className: el.className,
        text: el.textContent?.trim() || "",
        html: el.outerHTML,
      });
    });

    return info;
  });

  console.log("📊 디버그 정보:\n");
  console.log("제품 카드 (최대 5개):");
  debugInfo.productCards.forEach((card, i) => {
    console.log(`\n${i + 1}. ${card.name}`);
    console.log(`   verified revenue 클래스 존재: ${card.hasVerifiedRevenueClass ? "✅" : "❌"}`);
    console.log(`   verified revenue 텍스트: "${card.verifiedRevenueText}"`);
    console.log(`   HTML 스니펫: ${card.html.substring(0, 200)}...`);
  });

  console.log("\n\n모든 revenue-explanation 클래스 요소:");
  debugInfo.allVerifiedRevenueElements.forEach((el, i) => {
    console.log(`\n${i + 1}.`);
    console.log(`   클래스: ${el.className}`);
    console.log(`   텍스트: "${el.text}"`);
    console.log(`   HTML: ${el.html}`);
  });

  console.log("\n⏸️ 브라우저를 열어 두었습니다. 수동으로 확인해보세요.");
  console.log("10초 후 브라우저가 닫힙니다...\n");

  await new Promise((resolve) => setTimeout(resolve, 10000));

  await browser.close();
})();

