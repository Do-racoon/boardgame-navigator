# 이미지 기반 PDF OCR 처리

텍스트 추출이 안 되는 스캔 PDF는 OCR이 필요합니다.

## 방법 1: Azure Document Intelligence (권장)

```ts
import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer'

const client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key))
const poller = await client.beginAnalyzeDocumentFromUrl('prebuilt-read', fileUrl)
const result = await poller.pollUntilDone()

const pages = result.pages?.map((p) => ({
  page: p.pageNumber,
  text: p.lines?.map((l) => l.content).join(' ') ?? '',
})) ?? []
```

환경변수 추가:
```
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=
AZURE_DOCUMENT_INTELLIGENCE_KEY=
```

## 방법 2: 무료 로컬 OCR (Tesseract)

```bash
# 설치
brew install tesseract tesseract-lang

# PDF → 이미지 변환 후 OCR
pdftoppm -r 300 rulebook.pdf pages
tesseract pages-01.ppm output -l kor+eng
```

## MVP 권장

텍스트 기반 PDF (출판사 공식 배포본)는 OCR 없이 바로 추출 가능합니다.
대부분의 보드게임 공식 룰북은 텍스트 기반입니다.
