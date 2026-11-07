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
import { cn } from '@/lib/utils'
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
  // Phones show one group at a time; from `md` both groups sit side by side.
  const [step, setStep] = useState<1 | 2>(1)
  const navigate = useNavigate()
  const create = useCreateCase()
  const {
    register,
    handleSubmit,
    reset,
    control,
    trigger,
    formState: { errors },
  } = useForm<CaseFormValues>({ resolver: zodResolver(caseFormSchema), defaultValues: emptyCaseForm })
  const [amount, currency, historicalAverage] = useWatch({ control, name: ['amount', 'currency', 'historicalAverage'] })

  const close = () => {
    setOpen(false)
    reset(emptyCaseForm)
    setScenario(null)
    setStep(1)
  }

  const onSubmit = handleSubmit(
    async (values) => {
      try {
        const created = await create.mutateAsync(toCreateCaseRequest(values))
        toast.success('Case created', { description: created.title })
        close()
        void navigate({ to: '/operator/cases/$caseId', params: { caseId: String(created.id) } })
      } catch (err) {
        toast.error('Unable to create the case', { description: errorMessage(err) })
      }
    },
    // An error in the first group while the phone shows the second: go back to it.
    (errs) => {
      if (STEP_ONE.some((k) => errs[k])) setStep(1)
    },
  )

  const field = (name: keyof CaseFormValues) => ({
    id: `case-${name}`,
    'aria-invalid': !!errors[name],
    'aria-describedby': errors[name] ? `case-${name}-error` : undefined,
    'data-testid': `case-${name}`,
    ...register(name),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button variant={variant} data-testid={testId}>
          <Plus strokeWidth={2} /> New case
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-6 md:max-w-4xl">
        <DialogHeader>
          <p className="text-13 text-text-tertiary md:hidden" aria-live="polite">
            Step {step} of 2 · {step === 1 ? 'The invoice' : 'Details'}
          </p>
          <DialogTitle>New case</DialogTitle>
          <DialogDescription>One invoice for the agent to check. Pick a scenario to fill everything in.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-6" data-testid="new-case-form">
          <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
            {/* Group 1: what was billed */}
            <div className={cn('space-y-4', step !== 1 && 'max-md:hidden')}>
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
                    className="-me-2 text-accent-text"
                    onClick={() => {
                      setScenario(null)
                      reset(nextSample())
                    }}
                    data-testid="prefill-sample"
                  >
                    Random sample
                  </Button>
                }
              />
              <FormField id="case-vendor" label="Vendor" error={errors.vendor?.message}>
                <Input placeholder="Northwind Consulting SARL" autoComplete="organization" {...field('vendor')} />
              </FormField>
              <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-3">
                <FormField id="case-amount" label="Amount" error={errors.amount?.message ?? errors.currency?.message}>
                  <div className="flex">
                    <Input inputMode="decimal" placeholder="48250.00" className="relative rounded-e-none tabular-nums focus-visible:z-10" {...field('amount')} />
                    <Controller
                      control={control}
                      name="currency"
                      render={({ field: f }) => (
                        <Select value={f.value} onValueChange={f.onChange}>
                          <SelectTrigger
                            id="case-currency"
                            data-testid="case-currency"
                            aria-label="Currency"
                            aria-invalid={!!errors.currency}
                            className="relative -ms-px w-[5.25rem] shrink-0 rounded-s-none focus-visible:z-10"
                            onBlur={f.onBlur}
                          >
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
                  </div>
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
              </div>
            </div>

            {/* Group 2: how we file it, and what the agent will likely say */}
            <div className={cn('space-y-4', step !== 2 && 'max-md:hidden')}>
              <FormField id="case-title" label="Case title" error={errors.title?.message}>
                <Input placeholder="Unusual consulting invoice — Q3" {...field('title')} />
              </FormField>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                <FormField id="case-invoiceNumber" label="Invoice number" error={errors.invoiceNumber?.message}>
                  <Input placeholder="INV-2026-0142" className="tabular-nums" {...field('invoiceNumber')} />
                </FormField>
                <FormField id="case-historicalAverage" label="Typical amount" error={errors.historicalAverage?.message}>
                  <Input inputMode="decimal" placeholder="Optional" className="tabular-nums" {...field('historicalAverage')} />
                </FormField>
              </div>
              <FormField id="case-description" label="Description" error={errors.description?.message}>
                <Textarea rows={2} placeholder="Strategy workshop, 12 days" className="min-h-0" {...field('description')} />
              </FormField>
              <CasePreview amount={amount} currency={currency} historicalAverage={historicalAverage} />
            </div>
          </div>

          <DialogFooter>
            {step === 2 ? (
              <Button type="button" className="md:hidden" onClick={() => setStep(1)}>
                Back
              </Button>
            ) : null}
            <Button type="button" className={cn(step === 2 && 'max-md:hidden')} onClick={close}>
              Cancel
            </Button>
            {step === 1 && (
              <Button
                type="button"
                variant="primary"
                className="md:hidden"
                onClick={async () => {
                  if (await trigger(STEP_ONE)) setStep(2)
                }}
              >
                Continue
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              disabled={create.isPending}
              className={cn(step === 1 && 'max-md:hidden')}
              data-testid="create-case-submit"
            >
              {create.isPending && <CircularLoader size="sm" className="text-current" />}
              Create case
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const STEP_ONE = ['vendor', 'amount', 'currency', 'issueDate'] as const
