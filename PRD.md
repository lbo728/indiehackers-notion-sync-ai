🧩 폴더 구조
indiehackers-notion-sync-ai/
├── src/
│ ├── scrape.ts # IndieHackers 스크래핑
│ ├── analyze.ts # GPT 분석
│ ├── syncToNotion.ts # Notion 데이터 동기화
│ └── index.ts # 전체 실행 엔트리
├── .github/
│ └── workflows/
│ └── sync.yml # GitHub Actions 자동 실행
├── package.json
├── tsconfig.json
├── .env.example
└── README.md

⚙️ package.json
{
"name": "indiehackers-notion-sync-ai",
"version": "1.0.0",
"type": "module",
"scripts": {
"start": "tsx src/index.ts"
},
"dependencies": {
"@notionhq/client": "^2.2.14",
"dotenv": "^16.4.5",
"puppeteer": "^22.7.0",
"openai": "^4.0.0",
"tsx": "^4.7.0"
}
}

🧾 .env.example
NOTION_TOKEN=secret_xxxxxxxxxxxxx
NOTION_DB_ID=xxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxx

🕸️ src/scrape.ts
import puppeteer from "puppeteer";

export type Product = {
name: string;
description: string;
revenue: string;
link: string;
};

export async function scrapeIndieHackers(): Promise<Product[]> {
const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
await page.goto("https://www.indiehackers.com/products", {
waitUntil: "domcontentloaded",
});

const products = await page.$$eval("a[href^='/product/']", (els) =>
els.map((el) => {
const name = el.querySelector("img + _")?.textContent?.trim() || "";
const desc = el.textContent?.split("\n")[2]?.trim() || "";
const revenue =
el.textContent?.match(/\$\d{1,3}(?:,\d{3})_(?:\/month)?/)?.[0] || "";
const href = (el as HTMLAnchorElement).href;
return { name, description: desc, revenue, link: href };
})
);

await browser.close();
return products.slice(0, 30);
}

🧠 src/analyze.ts (GPT 분석 로직)
import OpenAI from "openai";
import type { Product } from "./scrape.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function analyzeProduct(product: Product) {
const prompt = `
너는 시니어 프론트엔드 개발자이자 제품 기획 CPO야.
다음은 Indie Hackers의 제품 정보야:

이름: ${product.name}
설명: ${product.description}
월 매출: ${product.revenue}

분석 항목:
1️⃣ 이 제품의 핵심 가치 제안 (1줄)
2️⃣ 병스커(2년차 프론트엔드 개발자)가 벤치마킹할 가치가 있는지 (YES/NO)
3️⃣ 만약 YES라면 그 이유를 1줄로.
4️⃣ 기술적으로 참고할만한 스택/패턴 예측 (예: Next.js + Supabase + Stripe)

간결하고 구체적인 한국어로 작성해.
`;

const res = await client.chat.completions.create({
model: "gpt-4o-mini",
messages: [{ role: "user", content: prompt }],
});

return res.choices[0].message.content?.trim() || "";
}

🧩 src/syncToNotion.ts
import { Client } from "@notionhq/client";
import { Product } from "./scrape.js";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DB_ID!;

export async function syncToNotion(
product: Product,
analysis: string
): Promise<void> {
await notion.pages.create({
parent: { database_id: DB_ID },
properties: {
Name: { title: [{ text: { content: product.name || "Untitled" } }] },
Description: { rich_text: [{ text: { content: product.description } }] },
Revenue: {
number: parseFloat(product.revenue.replace(/[^\d.]/g, "")) || 0,
},
URL: { url: product.link },
Analysis: { rich_text: [{ text: { content: analysis } }] },
CreatedAt: { date: { start: new Date().toISOString() } },
},
});
}

🚀 src/index.ts
import "dotenv/config";
import { scrapeIndieHackers } from "./scrape.js";
import { analyzeProduct } from "./analyze.js";
import { syncToNotion } from "./syncToNotion.js";

(async () => {
console.log("🔍 Indie Hackers에서 제품 수집 중...");
const products = await scrapeIndieHackers();

for (const product of products.slice(0, 15)) {
console.log(`🧠 분석 중: ${product.name}`);
const analysis = await analyzeProduct(product);
await syncToNotion(product, analysis);
console.log(`✅ ${product.name} 저장 완료`);
}

console.log("🎉 모든 데이터가 Notion에 동기화되었습니다!");
})();

🕐 .github/workflows/sync.yml
name: IndieHackers → Notion Sync (AI Analysis)
on:
schedule: - cron: "0 1 \* \* \*" # 매일 오전 10시 (KST)
workflow_dispatch:

jobs:
sync:
runs-on: ubuntu-latest
steps: - uses: actions/checkout@v4 - uses: actions/setup-node@v4
with:
node-version: 20 - run: npm ci - run: npm start
env:
NOTION_TOKEN: ${{ secrets.NOTION_API_KEY }}
NOTION_DB_ID: ${{ secrets.NOTION_DB_ID }}
OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

🧾 Notion 데이터베이스 구조
이름 타입 설명
Name Title 제품 이름
Description Rich text 제품 설명
Revenue Number 월 매출
URL URL Indie Hackers 링크
Analysis Rich text GPT 분석 (핵심 가치, 벤치마킹 판단, 스택)
CreatedAt Date 동기화 시점
🧠 결과 예시 (Notion에서 자동 생성)
Name Revenue Analysis
LeadSynthAI 0 핵심 가치: 잠재 고객 발굴 자동화.
벤치마킹: YES, SaaS 구조 + 데이터 파이프라인 설계 참고.
스택: Next.js + Puppeteer + Firestore
pptsize 100 핵심 가치: 문서 압축 유틸리티.
벤치마킹: NO, 기능형 유틸로 확장성 낮음.
FreelanceOS 0 핵심 가치: 프리랜서 CRM.
벤치마킹: YES, B2B SaaS UI 구조 참고.
스택: Supabase + React + Stripe
🧭 이 시스템의 장점

✅ 완전 자동화
매일 GitHub Actions가 실행돼서 Indie Hackers → Notion으로 자동 수집.

✅ 병스커 맞춤 분석
GPT가 “병스커가 벤치마킹할 가치가 있는지” 기준으로 필터링.

✅ Notion 기반 트래킹
Notion에서 필터뷰로 “YES만 보기” 만들면 벤치마킹 리스트 완성.
