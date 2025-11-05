import "dotenv/config";
import { scrapeIndieHackers } from "./scrape.js";
import { analyzeProduct, translateDescription } from "./analyze.js";
import { syncToNotion, getExistingProductUrls, updateDatabaseDescription } from "./syncToNotion.js";

(async () => {
  try {
    console.log("📋 Notion 데이터베이스에서 기존 제품 확인 중...");
    const existingUrls = await getExistingProductUrls();

    console.log("🔍 Indie Hackers에서 제품 수집 중...");
    const products = await scrapeIndieHackers();
    console.log(`📦 총 ${products.length}개의 제품을 수집했습니다.`);

    if (products.length === 0) {
      console.error("❌ 수집된 제품이 없습니다. 스크래핑 로직을 확인하세요.");
      process.exit(1);
    }

    const newProducts = products.filter((product) => !existingUrls.has(product.link));
    const duplicateCount = products.length - newProducts.length;

    if (duplicateCount > 0) {
      console.log(`⏭️  중복 제품 ${duplicateCount}개를 제외했습니다.`);
    }

    if (newProducts.length === 0) {
      console.log("✅ 새로운 제품이 없습니다. 모든 제품이 이미 Notion에 존재합니다.");
      process.exit(0);
    }

    console.log(`🆕 새로운 제품 ${newProducts.length}개를 처리합니다.`);

    const productsToProcess = newProducts;

    const results = await Promise.allSettled(
      productsToProcess.map(async (product) => {
        console.log(`🔄 ${product.name} 처리 시작...`);
        try {
          const [analysis, translatedDescription] = await Promise.all([
            analyzeProduct(product),
            translateDescription(product),
          ]);

          console.log(`📝 ${product.name} - 분석 완료`);
          console.log(`🌐 ${product.name} - 번역 완료`);

          await syncToNotion(product, analysis, translatedDescription);
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

    console.log(`\n🎉 처리 완료! 성공: ${successCount}개, 실패: ${errorCount}개`);

    if (successCount > 0) {
      await updateDatabaseDescription(successCount);
    }
  } catch (error) {
    console.error("❌ 실행 중 오류 발생:", error);
    process.exit(1);
  }
})();
