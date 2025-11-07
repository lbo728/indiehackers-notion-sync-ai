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
    console.log("🧪 테스트: 1개 제품만 분석 및 저장\n");
    console.log("=".repeat(80));

    // 기존 제품 확인
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

    // 1개 제품만 수집
    console.log("🔍 Indie Hackers에서 최신 제품 1개 수집 중...");
    const latestProducts = await scrapeLatestProducts(1);
    console.log(`\n📦 총 ${latestProducts.length}개의 제품을 찾았습니다.\n`);

    if (latestProducts.length === 0) {
      console.error("❌ 제품을 찾을 수 없습니다.");
      process.exit(1);
    }

    const product = latestProducts[0];
    console.log("📌 분석할 제품:");
    console.log(`   이름: ${product.name}`);
    console.log(`   매출: $${product.revenue}/month`);
    console.log(`   링크: ${product.link}`);
    console.log(`   Stripe 인증: ${product.isStripeVerified ? "✅" : "❌"}`);
    console.log("");

    // 기존 제품인지 확인 (테스트 모드에서는 강제로 새로 저장)
    const FORCE_NEW = process.env.FORCE_NEW === "true";
    
    if (!FORCE_NEW && existingUrls.has(product.link)) {
      console.log("ℹ️ 이미 Notion에 존재하는 제품입니다.");
      const pageId = existingProducts.get(product.link);
      if (pageId) {
        console.log("🔄 Stripe 인증 여부만 업데이트합니다...");
        await updateStripeVerification(pageId, product.isStripeVerified || false);
        console.log(`✅ ${product.name} - Stripe 인증 업데이트 완료`);
      }
      console.log("\n💡 새로 저장하려면 FORCE_NEW=true 환경 변수를 설정하세요.");
      process.exit(0);
    }

    if (FORCE_NEW) {
      console.log("🔄 강제 모드: 기존 제품이어도 새로 저장합니다.\n");
    } else {
      console.log("🆕 새로운 제품입니다. 분석 및 저장을 시작합니다.\n");
    }

    console.log(`${"=".repeat(80)}`);
    console.log(`🔄 ${product.name} 처리 시작...`);
    console.log("=".repeat(80));

    try {
      // 1. 웹사이트 스크래핑 (스킵 가능)
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

      console.log(`\n${"=".repeat(80)}`);
      console.log(`🎉 테스트 완료! ${product.name}이(가) Notion에 저장되었습니다.`);
      console.log("=".repeat(80));
    } catch (error) {
      console.error(`❌ ${product.name} 처리 실패:`, error);
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ 실행 중 오류 발생:", error);
    process.exit(1);
  }
})();

