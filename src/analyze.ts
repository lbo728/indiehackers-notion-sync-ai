import OpenAI from "openai";
import type { Product } from "./scrape.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function analyzeProduct(product: Product) {
  const feedPostContext = product.firstFeedPost ? `\n\n[첫 번째 피드 글]\n${product.firstFeedPost}` : "";

  const prompt = `
너는 시니어 프론트엔드 개발자이자 제품 기획 CPO야.
다음은 Indie Hackers의 제품 정보야:

이름: ${product.name}
설명: ${product.description}
월 매출: $${product.revenue}/month${feedPostContext}

위 정보를 종합하여 다음 항목들을 상세하게 분석해줘:

1️⃣ 핵심 가치 제안 (Core Value Proposition)
   - 이 제품이 해결하는 핵심 문제는 무엇인가?
   - 타겟 고객은 누구인가?
   - 제품의 독특한 포지셔닝은 무엇인가?

2️⃣ 병스커(2년차 프론트엔드 개발자) 벤치마킹 가치 평가
   - 벤치마킹 가치: ✅/❌
   - ✅인 경우, 구체적인 이유 (학습 포인트, 기술적 도전과제, 비즈니스 모델 참고 가치 등)
   - ❌인 경우, 왜 벤치마킹할 필요가 없는지

3️⃣ 기술 스택 및 아키텍처 예측
   - 예상 프론트엔드 스택 (Next.js, React, Vue 등)
   - 예상 백엔드/인프라 (Supabase, AWS, Vercel 등)
   - 예상 데이터베이스 및 저장소
   - 예상 결제 시스템 (Stripe, Paddle 등)
   - 예상 주요 라이브러리/도구

4️⃣ 개발 시간 및 난이도 추정
   - 병스커가 비슷한 서비스를 만드는데 예상 소요 시간 (주 단위)
   - 기술적 난이도 (초급/중급/고급)
   - 주요 개발 단계별 시간 배분 (프로토타입, MVP, 완성 버전)
   - 예상 장애물 및 해결 방법

5️⃣ 비즈니스 모델 분석
   - 수익 모델 (구독, 일회성 결제, 프리미엄 등)
   - 예상 가격 정책
   - 마케팅 전략 힌트

각 항목을 명확하게 구분하고, 구체적이고 실용적인 정보를 제공해줘.
한국어로 작성하고, 개발자가 실제로 활용할 수 있는 수준의 상세함을 유지해줘.
`;

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });

  return res.choices[0].message.content?.trim() || "";
}

export async function translateDescription(product: Product): Promise<string> {
  const prompt = `
다음 영어 제품 설명을 자연스러운 한국어로 번역해줘:

${product.description}

번역 시 주의사항:
- 전문 용어는 적절히 한국어로 번역하되, 널리 알려진 경우 영어 그대로 사용 가능
- 자연스럽고 읽기 쉬운 한국어로 번역
- 제품의 의미를 정확히 전달
`;

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  });

  return res.choices[0].message.content?.trim() || product.description;
}
