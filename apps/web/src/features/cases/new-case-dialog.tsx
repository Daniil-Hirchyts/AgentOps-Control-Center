import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { CircularLoader } from '@/components/prompt-kit/loader'
import { FormField } from '@/features/auth/form-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/api'
import { useCreateCase } from './hooks'
import { CasePreview, ScenarioPicker } from './scenario-picker'
import { caseFormSchema, type CaseFormValues, CURRENCIES, emptyCaseForm, nextSample, type ScenarioId, toCreateCaseRequest } from './schema'

/**
 * `variant="primary"` is the page's one filled action; secondary placements (empty states) pass
 * their own `testId` so E2E ids stay unique on a page.
 */
export function NewCaseDialog({
  variant = 'primary',
  testId = 'new-case-button',
}: {
  variant?: 'primary' | 'secondary'
  testId?: string
} = {}) {
  const [open, setOpen] = useState(false)
  const [scenario, setScenario] = useState<ScenarioId | null>(null)
  const navigate = useNavigate()
  const create = useCreateCase()
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CaseFormValues>({ resolver: zodResolver(caseFormSchema), defaultValues: emptyCaseForm })
  const [amount, currency, historicalAverage] = useWatch({ control, name: ['amount', 'currency', 'historicalAverage'] })

  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await create.mutateAsync(toCreateCaseRequest(values))
      toast.success('Case created', { description: created.title })
      setOpen(false)
      reset(emptyCaseForm)
      setScenario(null)
      void navigate({ to: '/operator/cases/$caseId', params: { caseId: String(created.id) } })
    } catch (err) {
      toast.error('Could not create case', { description: errorMessage(err) })
    }
  })

  const field = (name: keyof CaseFormValues) => ({
    id: `case-${name}`,
    'aria-invalid': !!errors[name],
    'data-testid': `case-${name}`,
    ...register(name),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) {
          reset(emptyCaseForm)
          setScenario(null)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant={variant} data-testid={testId}>
          <Plus strokeWidth={2} /> New case
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New case</DialogTitle>
          <DialogDescription>Start from a scenario or enter an invoice. The agent assesses its risk when you run an analysis.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="new-case-form">
          <ScenarioPicker
            value={scenario}
            onPick={(sc) => {
              setScenario(sc.id)
              reset({ ...sc.values })
            }}
            aside={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-me-1.5 text-accent-text"
                onClick={() => {
                  setScenario(null)
                  reset(nextSample())
                }}
                data-testid="prefill-sample"
              >
                Fill with sample data
              </Button>
            }
          />
          <FormField id="case-title" label="Title" error={errors.title?.message}>
            <Input placeholder="Unusual consulting invoice" {...field('title')} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="case-invoiceNumber" label="Invoice number" error={errors.invoiceNumber?.message}>
              <Input {...field('invoiceNumber')} />
            </FormField>
            <FormField id="case-vendor" label="Vendor" error={errors.vendor?.message}>
              <Input {...field('vendor')} />
            </FormField>
            <FormField id="case-amount" label="Amount" error={errors.amount?.message}>
              <Input inputMode="decimal" placeholder="0.00" className="tabular-nums" {...field('amount')} />
            </FormField>
            <FormField id="case-currency" label="Currency" error={errors.currency?.message}>
              <Controller
                control={control}
                name="currency"
                render={({ field: f }) => (
                  <Select value={f.value} onValueChange={f.onChange}>
                    <SelectTrigger id="case-currency" data-testid="case-currency" aria-invalid={!!errors.currency} className="w-full" onBlur={f.onBlur}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField id="case-issueDate" label="Issue date" error={errors.issueDate?.message}>
              <Controller
                control={control}
                name="issueDate"
                render={({ field: f }) => (
                  <DatePicker
                    id="case-issueDate"
                    testId="case-issueDate"
                    value={f.value}
                    onChange={f.onChange}
                    onBlur={f.onBlur}
                    invalid={!!errors.issueDate}
                    disableFuture
                    className="w-full"
                  />
                )}
              />
            </FormField>
            <FormField
              id="case-historicalAverage"
              label="Historical average (optional)"
              error={errors.historicalAverage?.message}
              hint="Typical amount for this vendor"
            >
              <Input inputMode="decimal" placeholder="0.00" className="tabular-nums" {...field('historicalAverage')} />
            </FormField>
          </div>
          <FormField id="case-description" label="Description" error={errors.description?.message}>
            <Textarea rows={3} {...field('description')} />
          </FormField>
          <CasePreview amount={amount} currency={currency} historicalAverage={historicalAverage} />
          <DialogFooter>
            <Button type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={create.isPending} data-testid="create-case-submit">
              {create.isPending && <CircularLoader size="sm" className="text-current" />}
              Create case
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
