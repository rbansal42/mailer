import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, SenderAccount, GmailConfig, SmtpConfig } from '../lib/api'
import { useThemeStore, ThemeColor } from '../hooks/useThemeStore'
import { COLOR_PRESETS, THEME_COLORS } from '../lib/theme'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import {
  Plus, GripVertical, Trash2, Check, Eye, EyeOff,
  Loader2, AlertCircle, CheckCircle2, Sun, Moon
} from 'lucide-react'
import { cn } from '../lib/utils'

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'accounts' | 'general' | 'queue' | 'appearance'>('accounts')

  const tabLabels: Record<string, string> = {
    accounts: 'Sender Accounts',
    general: 'General',
    queue: 'Queue',
    appearance: 'Appearance',
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        {(['accounts', 'general', 'queue', 'appearance'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {activeTab === 'accounts' && <AccountsSettings />}
      {activeTab === 'general' && <GeneralSettings />}
      {activeTab === 'queue' && <QueueSettings />}
      {activeTab === 'appearance' && <AppearanceSettings />}
    </div>
  )
}

function AccountsSettings() {
  const queryClient = useQueryClient()
  const [editingAccount, setEditingAccount] = useState<SenderAccount | 'new' | null>(null)

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: api.getAccounts,
  })

  const reorderMutation = useMutation({
    mutationFn: api.reorderAccounts,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  })

  const moveAccount = (id: number, direction: 'up' | 'down') => {
    if (!accounts) return
    const index = accounts.findIndex((a) => a.id === id)
    if (direction === 'up' && index > 0) {
      const ids = accounts.map((a) => a.id)
      ;[ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]
      reorderMutation.mutate(ids)
    } else if (direction === 'down' && index < accounts.length - 1) {
      const ids = accounts.map((a) => a.id)
      ;[ids[index], ids[index + 1]] = [ids[index + 1], ids[index]]
      reorderMutation.mutate(ids)
    }
  }

  if (editingAccount) {
    return (
      <AccountEditor
        account={editingAccount === 'new' ? null : editingAccount}
        onClose={() => setEditingAccount(null)}
      />
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">
          Drag to reorder priority (top = used first)
        </p>
        <Button size="sm" onClick={() => setEditingAccount('new')}>
          <Plus className="h-4 w-4 mr-1" />
          Add Account
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : accounts && accounts.length > 0 ? (
        <div className="space-y-2">
          {accounts.map((account, index) => (
            <Card
              key={account.id}
              className={cn(
                'transition-opacity',
                !account.enabled && 'opacity-50'
              )}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveAccount(account.id, 'up')}
                    disabled={index === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <GripVertical className="h-3 w-3" />
                  </button>
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{account.name}</p>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted">
                      {account.providerType}
                    </span>
                    {!account.enabled && (
                      <span className="text-xs text-muted-foreground">Disabled</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {account.providerType === 'gmail'
                      ? (account.config as GmailConfig).email
                      : (account.config as SmtpConfig).fromEmail}
                  </p>
                </div>

                <div className="text-right text-xs">
                  <p>
                    Today: <span className="font-medium">{account.todayCount || 0}</span>/{account.dailyCap}
                  </p>
                  <p className="text-muted-foreground">
                    Per campaign: {account.campaignCap}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingAccount(account)}
                >
                  Edit
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">No sender accounts configured</p>
            <Button size="sm" onClick={() => setEditingAccount('new')}>
              <Plus className="h-4 w-4 mr-1" />
              Add Account
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function AccountEditor({ account, onClose }: { account: SenderAccount | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [providerType, setProviderType] = useState<'gmail' | 'smtp'>(account?.providerType || 'gmail')
  const [name, setName] = useState(account?.name || '')
  const [dailyCap, setDailyCap] = useState(account?.dailyCap || 100)
  const [campaignCap, setCampaignCap] = useState(account?.campaignCap || 50)
  const [enabled, setEnabled] = useState(account?.enabled ?? true)
  const [showPassword, setShowPassword] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)

  // Gmail config
  const [email, setEmail] = useState((account?.config as GmailConfig)?.email || '')
  const [appPassword, setAppPassword] = useState((account?.config as GmailConfig)?.appPassword || '')

  // SMTP config
  const [host, setHost] = useState((account?.config as SmtpConfig)?.host || '')
  const [port, setPort] = useState((account?.config as SmtpConfig)?.port || 587)
  const [secure, setSecure] = useState((account?.config as SmtpConfig)?.secure || false)
  const [user, setUser] = useState((account?.config as SmtpConfig)?.user || '')
  const [pass, setPass] = useState((account?.config as SmtpConfig)?.pass || '')
  const [fromEmail, setFromEmail] = useState((account?.config as SmtpConfig)?.fromEmail || '')
  const [fromName, setFromName] = useState((account?.config as SmtpConfig)?.fromName || '')

  const saveMutation = useMutation({
    mutationFn: account
      ? (data: Partial<SenderAccount>) => api.updateAccount(account.id, data)
      : (data: Omit<SenderAccount, 'id' | 'createdAt' | 'todayCount'>) => api.createAccount(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      onClose()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteAccount(account!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      onClose()
    },
  })

  const testMutation = useMutation({
    mutationFn: () => api.testAccount(account!.id),
    onSuccess: (result) => setTestResult(result),
  })

  const handleSave = () => {
    const config = providerType === 'gmail'
      ? { email, appPassword }
      : { host, port, secure, user, pass, fromEmail, fromName }

    saveMutation.mutate({
      name,
      providerType,
      config,
      dailyCap,
      campaignCap,
      enabled,
      priority: account?.priority || 0,
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">
          {account ? 'Edit Account' : 'Add Account'}
        </h2>
        <div className="flex items-center gap-2">
          {account && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => deleteMutation.mutate()}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
            Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Account Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Personal Gmail"
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Provider Type</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setProviderType('gmail')}
                className={cn(
                  'flex-1 py-2 text-sm rounded border transition-colors',
                  providerType === 'gmail'
                    ? 'border-primary bg-primary/5'
                    : 'border-input hover:bg-muted'
                )}
              >
                Gmail
              </button>
              <button
                onClick={() => setProviderType('smtp')}
                className={cn(
                  'flex-1 py-2 text-sm rounded border transition-colors',
                  providerType === 'smtp'
                    ? 'border-primary bg-primary/5'
                    : 'border-input hover:bg-muted'
                )}
              >
                SMTP
              </button>
            </div>
          </div>

          {providerType === 'gmail' ? (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Gmail Address</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">App Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="h-8 text-sm pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">SMTP Host</Label>
                  <Input
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="smtp.example.com"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Port</Label>
                  <Input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Username</Label>
                  <Input
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Password</Label>
                  <Input
                    type="password"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">From Name</Label>
                  <Input
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    placeholder="ACME Inc"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">From Email</Label>
                  <Input
                    type="email"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    placeholder="noreply@example.com"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={secure}
                  onChange={(e) => setSecure(e.target.checked)}
                />
                Use SSL/TLS
              </label>
            </>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm">Rate Limits</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Daily Cap</Label>
                <Input
                  type="number"
                  value={dailyCap}
                  onChange={(e) => setDailyCap(Number(e.target.value))}
                  className="h-8 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Max emails per day (resets at midnight)
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Per-Campaign Cap</Label>
                <Input
                  type="number"
                  value={campaignCap}
                  onChange={(e) => setCampaignCap(Number(e.target.value))}
                  className="h-8 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Max emails per single campaign
                </p>
              </div>
            </CardContent>
          </Card>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Account enabled
          </label>

          {account && (
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending}
              >
                {testMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Test Connection
              </Button>
              {testResult && (
                <p className={cn(
                  'text-xs mt-2 flex items-center gap-1',
                  testResult.success ? 'text-green-600' : 'text-destructive'
                )}>
                  {testResult.success ? (
                    <><CheckCircle2 className="h-3 w-3" /> Connected successfully</>
                  ) : (
                    <><AlertCircle className="h-3 w-3" /> {testResult.error}</>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function GeneralSettings() {
  const queryClient = useQueryClient()
  const [testEmail, setTestEmail] = useState('')

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  })

  const saveMutation = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  })

  return (
    <div className="max-w-md space-y-4">
      <div className="space-y-1">
        <Label className="text-xs">Test Email Address</Label>
        <Input
          type="email"
          value={testEmail || settings?.testEmail || ''}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="your@email.com"
          className="h-8 text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Used for "Send Test" before bulk sending
        </p>
      </div>
      <Button
        size="sm"
        onClick={() => saveMutation.mutate({ testEmail })}
        disabled={saveMutation.isPending}
      >
        Save Settings
      </Button>
    </div>
  )
}

function QueueSettings() {
  const queryClient = useQueryClient()

  const { data: queue, isLoading } = useQuery({
    queryKey: ['queue'],
    queryFn: api.getQueue,
  })

  const processMutation = useMutation({
    mutationFn: api.processQueue,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queue'] }),
  })

  const pendingCount = queue?.filter((q) => q.status === 'pending').length || 0

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-medium">{pendingCount} emails queued</p>
          <p className="text-sm text-muted-foreground">
            Auto-processes daily at midnight
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => processMutation.mutate()}
          disabled={processMutation.isPending || pendingCount === 0}
        >
          {processMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          Process Now
        </Button>
      </div>

      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : queue && queue.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">Email</th>
                  <th className="text-left p-2 font-medium">Scheduled</th>
                  <th className="text-left p-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {queue.slice(0, 20).map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-2">{item.recipientEmail}</td>
                    <td className="p-2 text-muted-foreground">{item.scheduledFor}</td>
                    <td className="p-2">
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded',
                        item.status === 'pending' && 'bg-yellow-100 text-yellow-700',
                        item.status === 'sent' && 'bg-green-100 text-green-700',
                        item.status === 'failed' && 'bg-red-100 text-red-700'
                      )}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {queue.length > 20 && (
              <p className="p-2 text-xs text-muted-foreground text-center border-t">
                And {queue.length - 20} more...
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            No emails in queue
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function AppearanceSettings() {
  const mode = useThemeStore((state) => state.mode)
  const primaryColor = useThemeStore((state) => state.primaryColor)
  const setMode = useThemeStore((state) => state.setMode)
  const setPrimaryColor = useThemeStore((state) => state.setPrimaryColor)

  return (
    <div className="max-w-lg space-y-6">
      {/* Theme Mode */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Theme Mode</Label>
        <div className="flex gap-2">
          <button
            onClick={() => setMode('light')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-all',
              mode === 'light'
                ? 'border-primary bg-primary/5'
                : 'border-input hover:border-muted-foreground/50'
            )}
          >
            <Sun className="h-5 w-5" />
            <span className="font-medium">Light</span>
            {mode === 'light' && <Check className="h-4 w-4 text-primary" />}
          </button>
          <button
            onClick={() => setMode('dark')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-all',
              mode === 'dark'
                ? 'border-primary bg-primary/5'
                : 'border-input hover:border-muted-foreground/50'
            )}
          >
            <Moon className="h-5 w-5" />
            <span className="font-medium">Dark</span>
            {mode === 'dark' && <Check className="h-4 w-4 text-primary" />}
          </button>
        </div>
      </div>

      {/* Accent Color */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Accent Color</Label>
        <div className="grid grid-cols-4 gap-3">
          {THEME_COLORS.map((color) => {
            const preset = COLOR_PRESETS[color]
            const isSelected = primaryColor === color
            return (
              <button
                key={color}
                onClick={() => setPrimaryColor(color)}
                className={cn(
                  'relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-input hover:border-muted-foreground/50'
                )}
              >
                <div
                  className="w-8 h-8 rounded-full shadow-sm"
                  style={{ backgroundColor: preset.swatch }}
                />
                <span className="text-xs font-medium">{preset.name}</span>
                {isSelected && (
                  <div className="absolute top-1 right-1">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Preview</Label>
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Button size="sm">Primary Button</Button>
              <Button size="sm" variant="outline">Outline</Button>
              <Button size="sm" variant="secondary">Secondary</Button>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-primary font-medium">Primary Text</span>
              <span className="text-muted-foreground">Muted Text</span>
              <span className="text-destructive">Destructive</span>
            </div>
            <div className="flex items-center gap-2">
              <Input placeholder="Input field" className="h-8 text-sm max-w-48" />
              <div className="w-4 h-4 rounded-full bg-primary" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
