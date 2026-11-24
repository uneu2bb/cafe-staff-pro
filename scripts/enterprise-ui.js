const fs = require('fs')
const path = require('path')
const file = path.join(__dirname, '../app/dashboard/HomeBoard.tsx')
let t = fs.readFileSync(file, 'utf8')

if (t.includes('nav-section-label')) {
  console.log('enterprise-ui: already applied')
  process.exit(0)
}

if (!t.includes('ENTERPRISE_UI_V2')) {
  t = t.replace("'use client'", "'use client'\n/* ENTERPRISE_UI_V2 */")
}

const newNav = [
  '<nav className="flex flex-col flex-1 mt-4 overflow-y-auto" style={{ gap: 2 }}>',
  '          <div className="nav-section-label">التشغيل</div>',
  "          {[ { id: 'home', icon: '◈', label: 'لوحة اليوم' }, { id: 'qr', icon: '▣', label: 'مسح QR' } ].map((item) => (",
  '            <button key={item.id} type="button" className={`side-nav-item ${activeNav === item.id ? \'active\' : \'\'}`} onClick={() => navGo(item.id)}>',
  '              <span className="text-[16px] w-5 text-center">{item.icon}</span>{item.label}',
  '            </button>',
  '          ))}',
  '          <div className="nav-section-label">الموظفون</div>',
  "          {[ { id: 'employees', icon: '◎', label: 'قائمة الموظفين' }, { id: 'add', icon: '＋', label: 'إضافة موظف' } ].map((item) => (",
  '            <button key={item.id} type="button" className={`side-nav-item ${activeNav === item.id ? \'active\' : \'\'}`} onClick={() => navGo(item.id)}>',
  '              <span className="text-[16px] w-5 text-center">{item.icon}</span>{item.label}',
  '            </button>',
  '          ))}',
  '          <div className="nav-section-label">المالية</div>',
  "          {[ { id: 'withdrawals', icon: '◈', label: 'السحوبات' } ].map((item) => (",
  '            <button key={item.id} type="button" className={`side-nav-item ${activeNav === item.id ? \'active\' : \'\'}`} onClick={() => navGo(item.id)}>',
  '              <span className="text-[16px] w-5 text-center">{item.icon}</span>{item.label}',
  '            </button>',
  '          ))}',
  '          <div className="nav-section-label">النظام</div>',
  "          {[ { id: 'panel', icon: '⚙', label: 'الإعدادات' } ].map((item) => (",
  '            <button key={item.id} type="button" className={`side-nav-item ${activeNav === item.id ? \'active\' : \'\'}`} onClick={() => navGo(item.id)}>',
  '              <span className="text-[16px] w-5 text-center">{item.icon}</span>{item.label}',
  '            </button>',
  '          ))}',
  '        </nav>',
].join('\n')

const markers = [
  '<nav className="grid gap-2 mt-6 flex-1">',
  '<nav className="grid gap-2 mt-6 flex-1" >',
]
let replaced = false
for (const m of markers) {
  const navStart = t.indexOf(m)
  if (navStart >= 0) {
    const navEnd = t.indexOf('</nav>', navStart)
    if (navEnd > navStart) {
      t = t.slice(0, navStart) + newNav + t.slice(navEnd + 6)
      replaced = true
      console.log('enterprise-ui: replaced nav')
      break
    }
  }
}
if (!replaced) console.log('enterprise-ui: nav marker not found')

t = t.replace(
  "style={{ width: 264, padding: '24px 16px', background: 'linear-gradient(180deg,#0d1115,#080b0e 78%)', borderLeft: '1px solid var(--line)' }}",
  "style={{ width: 260, padding: '20px 12px', background: 'var(--panel)', borderLeft: '1px solid var(--line)' }}"
)
t = t.replace('نظام إدارة الحضور والانصراف', 'منصة إدارة الموظفين')

fs.writeFileSync(file, t)
console.log('enterprise-ui: done', t.includes('nav-section-label'))
