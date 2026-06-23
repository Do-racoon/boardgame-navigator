import * as fs from 'fs'
import { PDFParse } from 'pdf-parse'

export interface PageText {
  page: number
  text: string
}

export async function extractPdf(filePath: string): Promise<PageText[]> {
  const buffer = fs.readFileSync(filePath)
  const uint8 = new Uint8Array(buffer)
  const parser = new PDFParse(uint8)
  const result = await parser.getText()

  return (result.pages as { num: number; text: string }[])
    .map((p) => ({
      page: p.num,
      text: p.text.replace(/\s+/g, ' ').trim(),
    }))
    .filter((p) => p.text.length > 20)
}
