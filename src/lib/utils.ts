import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(date: string | Date, formatStr = 'HH:mm') {
  const d = new Date(date)
  return d.toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit', second: formatStr.includes('ss') ? '2-digit' : undefined, hour12: false })
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('ar-SY')
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'present':
    case 'active':
    case 'approved':
    case 'success':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    case 'late':
    case 'pending':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    case 'absent':
    case 'rejected':
    case 'suspended':
      return 'bg-red-500/15 text-red-400 border-red-500/30'
    case 'on_leave':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30'
    default:
      return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
  }
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    present: 'حاضر', late: 'متأخر', absent: 'غائب', on_leave: 'إجازة',
    incomplete: 'غير مكتمل', active: 'نشط', suspended: 'موقوف', resigned: 'مستقيل',
    pending: 'قيد الانتظار', approved: 'موافق عليها', rejected: 'مرفوضة',
    monthly: 'شهري', daily: 'يومي', hourly: 'بالساعة',
    check_in: 'حضور', check_out: 'انصراف',
    fingerprint: 'بصمة', face: 'وجه', qr: 'QR', pin: 'رقم سري', manual: 'يدوي',
  }
  return labels[status] || status
}

export const ROLES = [
  { value: 'owner', label: 'المالك' },
  { value: 'manager', label: 'مدير' },
  { value: 'accountant', label: 'محاسب' },
  { value: 'supervisor', label: 'مشرف' },
  { value: 'employee', label: 'موظف' },
]
