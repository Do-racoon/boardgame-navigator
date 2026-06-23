# MVP 월 예상 비용

| 리소스 | 용도 | 월 비용 | 비고 |
|---|---|---|---|
| OpenAI API | 임베딩 (text-embedding-3-large) | ~$2 | 룰북 20개 + 질문 1만건 |
| Anthropic API | 답변 생성 (claude-haiku-4-5) | ~$3 | 질문 1만건 기준 |
| Supabase | DB + pgvector | **$0** | 무료 티어 (500MB) |
| Azure Blob Storage | PDF 파일 저장 | ~$1 | PDF 20개 기준 |
| **합계** | | **~$6 (₩8,000)** | |

## 이전 대비 절감

| 제거한 리소스 | 절감액 |
|---|---|
| Azure AI Search | -$73 |
| Azure PostgreSQL | -$13 |
| Azure OpenAI | -$8 |
| **총 절감** | **-$94/월** |

## AI 키 구성

| 키 | 용도 |
|---|---|
| `OPENAI_API_KEY` | 임베딩 전용 |
| `ANTHROPIC_API_KEY` | 답변 생성 전용 |

## Supabase 무료 티어 한계

- DB 500MB → 룰북 100개 청크 기준 약 50MB 사용 (여유 충분)
- 프로젝트 1주일 미접속 시 일시 정지 (무료 티어)
- 월 200만 row 읽기 제한 (MVP에서 초과 불가)
