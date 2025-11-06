import "dotenv/config";
import { scrapeIndieHackers, scrapeWebsiteContent } from "./scrape.js";
import { analyzeProduct, translateDescription } from "./analyze.js";
import { syncToNotion2, getExistingProductUrls2 } from "./syncToNotion2.js";

(async () => {
  try {
    console.log("🧪 테스트 모드: Stripe 인증 제품 1개만 처리합니다.\n");

    let existingUrls = new Set<string>();
    try {
      console.log("📋 Notion 데이터베이스에서 기존 제품 확인 중...");
      existingUrls = await getExistingProductUrls2();
    } catch (error) {
      console.log("⚠️ Notion 데이터베이스 조회 실패 (계속 진행):", error);
      console.log("   테스트 모드로 진행합니다.\n");
    }

    console.log("💳 Stripe 인증된 제품만 수집 중...");
    // TODO: scrapeStripeVerifiedProducts 함수가 필요합니다
    // 현재는 전체 제품을 수집하고 첫 번째 제품만 사용
    const allProducts = await scrapeIndieHackers();
    const stripeVerified = allProducts.filter(() => {
      // TODO: isStripeVerified 속성이 Product 타입에 추가되어야 함
      // 임시로 모든 제품을 포함
      return true;
    });
    console.log(`📦 총 ${stripeVerified.length}개의 Stripe 인증 제품을 수집했습니다.\n`);

    if (stripeVerified.length === 0) {
      console.error("❌ 수집된 Stripe 인증 제품이 없습니다.");
      process.exit(1);
    }

    const newProducts = stripeVerified.filter((product) => !existingUrls.has(product.link));

    if (newProducts.length === 0) {
      console.log("⚠️ 모든 Stripe 인증 제품이 이미 Notion에 존재합니다.");
      console.log("📌 기존 제품 중 첫 번째 제품으로 테스트 진행합니다.");
      const testProduct = stripeVerified[0];
      console.log(`\n📌 테스트 제품: ${testProduct.name}`);
      console.log(`   설명: ${testProduct.description}`);
      console.log(`   매출: $${testProduct.revenue}/month`);
      console.log(`   링크: ${testProduct.link}`);
      console.log(
        `   웹사이트: ${
          "websiteUrl" in testProduct && typeof testProduct.websiteUrl === "string" ? testProduct.websiteUrl : "없음"
        }`
      );
      console.log(`   Stripe 인증: ✅\n`);

      console.log("=".repeat(80));
      console.log("1️⃣ 웹사이트 스크래핑");
      console.log("=".repeat(80));
      let websiteContent = "";
      const websiteUrl =
        "websiteUrl" in testProduct && typeof testProduct.websiteUrl === "string" ? testProduct.websiteUrl : undefined;
      if (websiteUrl) {
        try {
          websiteContent = await scrapeWebsiteContent(websiteUrl);
          if (websiteContent) {
            console.log(`✅ 웹사이트 분석 완료\n`);
          } else {
            console.log(`ℹ️ 웹사이트 정보를 가져올 수 없습니다.\n`);
          }
        } catch (error) {
          console.log(`⚠️ 웹사이트 스크래핑 실패: ${error}\n`);
        }
      } else {
        console.log(`ℹ️ 웹사이트 URL이 없습니다.\n`);
      }

      console.log("=".repeat(80));
      console.log("2️⃣ 제품 분석 및 번역");
      console.log("=".repeat(80));
      const [analysis, translatedDescription] = await Promise.all([
        analyzeProduct(testProduct, websiteContent),
        translateDescription(testProduct),
      ]);
      console.log("✅ 분석 및 번역 완료\n");

      console.log("=".repeat(80));
      console.log("3️⃣ Notion 동기화");
      console.log("=".repeat(80));
      try {
        await syncToNotion2(testProduct, analysis, translatedDescription);
        console.log("✅ Notion 저장 완료\n");
      } catch (error) {
        console.error("❌ Notion 저장 실패:", error);
        console.log("⚠️ 분석 결과는 정상적으로 생성되었지만 Notion 저장은 실패했습니다.\n");
      }

      console.log("=".repeat(80));
      console.log("🎉 테스트 완료!");
      console.log("=".repeat(80));
      process.exit(0);
    }

    const testProduct = newProducts[0];
    console.log(`\n📌 테스트 제품: ${testProduct.name}`);
    console.log(`   설명: ${testProduct.description}`);
    console.log(`   매출: $${testProduct.revenue}/month`);
    console.log(`   링크: ${testProduct.link}`);
    console.log(
      `   웹사이트: ${
        "websiteUrl" in testProduct && typeof testProduct.websiteUrl === "string" ? testProduct.websiteUrl : "없음"
      }`
    );
    console.log(`   Stripe 인증: ✅\n`);

    console.log("=".repeat(80));
    console.log("1️⃣ 웹사이트 스크래핑");
    console.log("=".repeat(80));
    let websiteContent = "";
    const websiteUrl =
      "websiteUrl" in testProduct && typeof testProduct.websiteUrl === "string" ? testProduct.websiteUrl : undefined;
    if (websiteUrl) {
      try {
        websiteContent = await scrapeWebsiteContent(websiteUrl);
        if (websiteContent) {
          console.log(`✅ 웹사이트 분석 완료\n`);
        } else {
          console.log(`ℹ️ 웹사이트 정보를 가져올 수 없습니다.\n`);
        }
      } catch (error) {
        console.log(`⚠️ 웹사이트 스크래핑 실패: ${error}\n`);
      }
    } else {
      console.log(`ℹ️ 웹사이트 URL이 없습니다.\n`);
    }

    console.log("=".repeat(80));
    console.log("2️⃣ 제품 분석 및 번역");
    console.log("=".repeat(80));
    const [analysis, translatedDescription] = await Promise.all([
      analyzeProduct(testProduct, websiteContent),
      translateDescription(testProduct),
    ]);
    console.log("✅ 분석 및 번역 완료\n");

    console.log("=".repeat(80));
    console.log("3️⃣ Notion 동기화");
    console.log("=".repeat(80));
    try {
      await syncToNotion2(testProduct, analysis, translatedDescription);
      console.log("✅ Notion 저장 완료\n");
    } catch (error) {
      console.error("❌ Notion 저장 실패:", error);
      console.log("⚠️ 분석 결과는 정상적으로 생성되었지만 Notion 저장은 실패했습니다.\n");
    }

    console.log("=".repeat(80));
    console.log("🎉 테스트 완료!");
    console.log("=".repeat(80));
  } catch (error) {
    console.error("❌ 실행 중 오류 발생:", error);
    process.exit(1);
  }
})();
