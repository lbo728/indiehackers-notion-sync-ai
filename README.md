# IndieHackers → Notion Sync (AI Analysis)

Indie Hackers에서 제품 정보를 수집하고, GPT로 분석한 후 Notion에 자동으로 동기화하는 프로젝트입니다.

## 🚀 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example` 파일을 참고하여 `.env` 파일을 생성하고 다음 값들을 설정하세요:

- `NOTION_API_KEY`: Notion API 토큰
- `NOTION_DB_ID`: Notion 데이터베이스 ID
- `OPENAI_API_KEY`: OpenAI API 키

#### Notion API 토큰 얻기

1. [Notion Integrations](https://www.notion.so/my-integrations) 페이지로 이동
2. "New integration" 클릭
3. 이름을 입력하고 "Submit" 클릭
4. 생성된 Integration의 "Internal Integration Token"을 복사하여 `NOTION_API_KEY`에 설정

#### Notion 데이터베이스 ID 얻기

1. Notion에서 데이터베이스를 생성하거나 기존 데이터베이스를 엽니다
2. 데이터베이스 페이지의 URL을 확인합니다
   - URL 형식: `https://www.notion.so/workspace/DATABASE_ID?v=...`
   - 또는: `https://www.notion.so/DATABASE_ID`
3. URL에서 `DATABASE_ID` 부분을 복사합니다 (32자리 문자열, 하이픈 포함)
   - 예: `https://www.notion.so/1234567890abcdef1234567890abcdef` → `1234567890abcdef1234567890abcdef`
4. 복사한 ID를 `NOTION_DB_ID`에 설정합니다

**참고**: 데이터베이스 ID에서 하이픈을 제거해야 할 수도 있습니다. 32자리 문자열 형태로 사용하세요.

### 3. Notion 데이터베이스 설정

Notion에서 다음 속성을 가진 데이터베이스를 생성하세요:

| 이름        | 타입          | 설명               |
| ----------- | ------------- | ------------------ |
| Name        | Title         | 제품 이름          |
| Description | Rich text     | 제품 설명          |
| Revenue     | Number        | 월 매출            |
| URL         | URL           | Indie Hackers 링크 |
| Thumbnail   | Files & media | 제품 썸네일        |
| Analysis    | Rich text     | GPT 분석 결과      |
| CreatedAt   | Date          | 동기화 시점        |

### 4. 실행

```bash
npm start
```

## 🤖 GitHub Actions

이 프로젝트는 GitHub Actions를 통해 매일 자동으로 실행됩니다.

워크플로우를 사용하려면 GitHub 저장소의 Secrets에 다음 값들을 설정하세요:

- `NOTION_TOKEN`
- `NOTION_DB_ID`
- `OPENAI_API_KEY`

## 📁 프로젝트 구조

```
indiehackers-notion-sync-ai/
├── src/
│   ├── scrape.ts          # IndieHackers 스크래핑
│   ├── analyze.ts         # GPT 분석
│   ├── syncToNotion.ts    # Notion 데이터 동기화
│   └── index.ts           # 전체 실행 엔트리
├── .github/
│   └── workflows/
│       └── sync.yml       # GitHub Actions 자동 실행
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 🧠 분석 항목

GPT는 각 제품에 대해 다음을 분석합니다:

1. 핵심 가치 제안 (1줄)
2. 병스커(2년차 프론트엔드 개발자)가 벤치마킹할 가치가 있는지 (YES/NO)
3. 벤치마킹 가치가 있는 경우 그 이유 (1줄)
4. 기술적으로 참고할만한 스택/패턴 예측

## ✨ 주요 기능

- ✅ 완전 자동화: 매일 GitHub Actions가 실행되어 Indie Hackers → Notion으로 자동 수집
- ✅ 병스커 맞춤 분석: GPT가 "병스커가 벤치마킹할 가치가 있는지" 기준으로 필터링
- ✅ Notion 기반 트래킹: Notion에서 필터뷰로 "YES만 보기" 만들면 벤치마킹 리스트 완성
