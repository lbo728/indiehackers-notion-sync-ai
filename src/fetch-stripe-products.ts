import "dotenv/config";
import { scrapeLatestProducts, scrapeWebsiteContent } from "./scrape.js";
import { analyzeProduct, translateDescription } from "./analyze.js";
import {
  syncToNotion2,
  getExistingProductUrls2,
  getExistingProducts2,
  updateStripeVerification,
} from "./syncToNotion2.js";

(async () => {
  try {
    console.log("📦 최신 제품 수집 및 분석 시작\n");
    console.log("=".repeat(80));

    let existingUrls = new Set<string>();
    let existingProducts = new Map<string, string>();
    try {
      console.log("📋 Notion 데이터베이스에서 기존 제품 확인 중...");
      existingUrls = await getExistingProductUrls2();
      existingProducts = await getExistingProducts2();
      console.log(`✅ 기존 제품 ${existingUrls.size}개 확인 완료\n`);
    } catch (error) {
      console.log("⚠️ Notion 데이터베이스 조회 실패 (계속 진행):", error);
      console.log("   새 제품으로 간주하고 진행합니다.\n");
    }

    console.log("🔍 Indie Hackers에서 최신 제품 수집 중...");
    const latestProducts = await scrapeLatestProducts(20);
    console.log(`\n📦 총 ${latestProducts.length}개의 최신 제품을 찾았습니다.\n`);

    if (latestProducts.length === 0) {
      console.error("❌ 제품을 찾을 수 없습니다.");
      process.exit(1);
    }

    // 각 제품 정보 출력
    latestProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   매출: $${product.revenue}/month`);
      console.log(`   링크: ${product.link}`);
      console.log(`   Stripe 인증: ${product.isStripeVerified ? "✅" : "❌"}`);
      console.log("");
    });

    const newProducts = latestProducts.filter((product) => !existingUrls.has(product.link));
    const existingProductsToUpdate = latestProducts.filter((product) => existingUrls.has(product.link));

    // 기존 제품들의 Stripe 인증 여부 업데이트
    if (existingProductsToUpdate.length > 0) {
      console.log(`🔄 기존 제품 ${existingProductsToUpdate.length}개의 Stripe 인증 여부 업데이트 중...\n`);

      const updateResults = await Promise.allSettled(
        existingProductsToUpdate.map(async (product) => {
          const pageId = existingProducts.get(product.link);
          if (!pageId) {
            return { product: product.name, status: "skipped", reason: "페이지 ID를 찾을 수 없음" };
          }

          try {
            await updateStripeVerification(pageId, product.isStripeVerified || false);
            console.log(`✅ ${product.name} - Stripe 인증: ${product.isStripeVerified ? "✅" : "❌"}`);
            return { product: product.name, status: "success" };
          } catch (error) {
            console.error(`❌ ${product.name} 업데이트 실패:`, error);
            return { product: product.name, status: "error", error };
          }
        })
      );

      const successCount = updateResults.filter((r) => r.status === "fulfilled" && r.value.status === "success").length;
      console.log(`\n✅ 기존 제품 업데이트 완료: ${successCount}/${existingProductsToUpdate.length}개\n`);
    }

    if (newProducts.length === 0) {
      console.log("✅ 모든 최신 제품이 이미 Notion에 존재합니다. (업데이트 완료)");
      process.exit(0);
    }

    console.log(`🆕 새로운 제품 ${newProducts.length}개를 처리합니다.\n`);

    const results = await Promise.allSettled(
      newProducts.map(async (product) => {
        console.log(`\n${"=".repeat(80)}`);
        console.log(`🔄 ${product.name} 처리 시작...`);
        console.log("=".repeat(80));

        try {
          // 1. 웹사이트 스크래핑
          let websiteContent = "";
          const websiteUrl = product.websiteUrl;
          if (websiteUrl) {
            try {
              console.log(`🌐 웹사이트 스크래핑 중: ${websiteUrl}`);
              websiteContent = await scrapeWebsiteContent(websiteUrl);
              if (websiteContent) {
                console.log(`✅ 웹사이트 분석 완료`);
              } else {
                console.log(`ℹ️ 웹사이트 정보를 가져올 수 없습니다.`);
              }
            } catch (error) {
              console.log(`⚠️ 웹사이트 스크래핑 실패: ${error}`);
            }
          } else {
            console.log(`ℹ️ 웹사이트 URL이 없습니다.`);
          }

          // 2. 제품 분석 및 번역
          console.log(`📝 제품 분석 및 번역 중...`);
          const [analysis, translatedDescription] = await Promise.all([
            analyzeProduct(product, websiteContent),
            translateDescription(product),
          ]);
          console.log(`✅ 분석 및 번역 완료`);

          // 3. Notion 동기화
          console.log(`💾 Notion에 저장 중... (Stripe 인증: ${product.isStripeVerified ? "✅" : "❌"})`);
          await syncToNotion2(product, analysis, translatedDescription);
          console.log(`✅ ${product.name} 저장 완료`);

          return { product: product.name, status: "success" };
        } catch (error) {
          console.error(`❌ ${product.name} 처리 실패:`, error);
          return { product: product.name, status: "error", error };
        }
      })
    );

    const successCount = results.filter((r) => r.status === "fulfilled" && r.value.status === "success").length;
    const errorCount = results.length - successCount;

    console.log(`\n${"=".repeat(80)}`);
    console.log(`🎉 처리 완료! 성공: ${successCount}개, 실패: ${errorCount}개`);
    console.log("=".repeat(80));
  } catch (error) {
    console.error("❌ 실행 중 오류 발생:", error);
    process.exit(1);
  }
})();
