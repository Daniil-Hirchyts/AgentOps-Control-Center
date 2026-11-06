import { z } from 'zod'
import type { CreateCaseRequest } from '@/lib/types'

const money = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, `${label} must be a positive number`)

export const caseFormSchema = z.object({
  title: z.string().trim().min(3, 'At least 3 characters').max(200, 'At most 200 characters'),
  invoiceNumber: z.string().trim().min(1, 'Invoice number is required').max(64),
  vendor: z.string().trim().min(1, 'Vendor is required').max(200),
  amount: money('Amount'),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, '3-letter ISO code, e.g. EUR'),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  description: z.string().trim().max(2000, 'At most 2000 characters'),
  historicalAverage: z
    .string()
    .trim()
    .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) > 0), 'Must be a positive number'),
})

export type CaseFormValues = z.infer<typeof caseFormSchema>

export const emptyCaseForm: CaseFormValues = {
  title: '',
  invoiceNumber: '',
  vendor: '',
  amount: '',
  currency: 'EUR',
  issueDate: new Date().toISOString().slice(0, 10),
  description: '',
  historicalAverage: '',
}

const SAMPLES: CaseFormValues[] = [
  {
    title: 'Unusual consulting invoice — Q3',
    invoiceNumber: 'INV-2026-0912',
    vendor: 'Northwind Consulting SARL',
    amount: '48250.00',
    currency: 'EUR',
    issueDate: '2026-09-12',
    description: 'Strategy consulting, 120 hours at premium rate. No matching purchase order found.',
    historicalAverage: '9800',
  },
  {
    title: 'Monthly cloud hosting',
    invoiceNumber: 'CLD-77341',
    vendor: 'Contoso Cloud Ltd',
    amount: '2140.50',
    currency: 'EUR',
    issueDate: '2026-10-01',
    description: 'Compute and storage, October. Matches contract #C-2210.',
    historicalAverage: '2075',
  },
  {
    title: 'Duplicate office supplies order?',
    invoiceNumber: 'OS-55102',
    vendor: 'Fabrikam Office Supply',
    amount: '1312.00',
    currency: 'USD',
    issueDate: '2026-10-18',
    description: 'Printer toner x40, paper x200 reams. Same items invoiced on 2026-10-11.',
    historicalAverage: '420',
  },
]

let sampleIdx = 0
/** Synthetic demo data — not real vendors. */
export function nextSample(): CaseFormValues {
  const s = SAMPLES[sampleIdx % SAMPLES.length]!
  sampleIdx += 1
  return { ...s }
}

export function toCreateCaseRequest(v: CaseFormValues): CreateCaseRequest {
  return {
    title: v.title.trim(),
    invoice: {
      invoiceNumber: v.invoiceNumber.trim(),
      vendor: v.vendor.trim(),
      amount: Number(v.amount),
      currency: v.currency.trim().toUpperCase(),
      issueDate: v.issueDate,
      description: v.description.trim(),
      ...(v.historicalAverage.trim() ? { historicalAverage: Number(v.historicalAverage) } : {}),
    },
  }
}
