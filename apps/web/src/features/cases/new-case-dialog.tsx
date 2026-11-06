import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/api'
import { useCreateCase } from './hooks'
import { caseFormSchema, type CaseFormValues, emptyCaseForm, nextSample, toCreateCaseRequest } from './schema'

export function NewCaseDialog() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const create = useCreateCase()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CaseFormValues>({ resolver: zodResolver(caseFormSchema), defaultValues: emptyCaseForm })

  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await create.mutateAsync(toCreateCaseRequest(values))
      toast.success('Investigation created', { description: created.title })
      setOpen(false)
      reset(emptyCaseForm)
      void navigate({ to: '/operator/cases/$caseId', params: { caseId: String(created.id) } })
    } catch (err) {
      toast.error('Could not create investigation', { description: errorMessage(err) })
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
        if (!o) reset(emptyCaseForm)
      }}
    >
      <DialogTrigger asChild>
        <Button data-testid="new-case-button">
          <Plus /> New investigation
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New investigation</DialogTitle>
          <DialogDescription>Describe the invoice to analyse. The AI agent will assess its risk.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="new-case-form">
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => reset(nextSample())} data-testid="prefill-sample">
              <Sparkles /> Prefill sample
            </Button>
          </div>
          <FormField id="case-title" label="Title" error={errors.title?.message}>
            <Input placeholder="e.g. Suspicious consulting invoice" {...field('title')} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="case-invoiceNumber" label="Invoice number" error={errors.invoiceNumber?.message}>
              <Input {...field('invoiceNumber')} />
            </FormField>
            <FormField id="case-vendor" label="Vendor" error={errors.vendor?.message}>
              <Input {...field('vendor')} />
            </FormField>
            <FormField id="case-amount" label="Amount" error={errors.amount?.message}>
              <Input inputMode="decimal" placeholder="0.00" {...field('amount')} />
            </FormField>
            <FormField id="case-currency" label="Currency" error={errors.currency?.message}>
              <Input maxLength={3} className="uppercase" {...field('currency')} />
            </FormField>
            <FormField id="case-issueDate" label="Issue date" error={errors.issueDate?.message}>
              <Input type="date" {...field('issueDate')} />
            </FormField>
            <FormField
              id="case-historicalAverage"
              label="Historical average (optional)"
              error={errors.historicalAverage?.message}
              hint="Typical amount for this vendor"
            >
              <Input inputMode="decimal" placeholder="0.00" {...field('historicalAverage')} />
            </FormField>
          </div>
          <FormField id="case-description" label="Description" error={errors.description?.message}>
            <Textarea rows={3} {...field('description')} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending} data-testid="create-case-submit">
              {create.isPending && <Loader2 className="animate-spin" />}
              Create investigation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
