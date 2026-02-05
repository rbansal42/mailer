import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { api, SenderAccount, GmailConfig, SmtpConfig, googleSheetsApi, LLMProviderInfo, LLMProviderId } from '../lib/api'
import { useThemeStore } from '../hooks/useThemeStore'
import { COLOR_PRESETS, THEME_COLORS } from '../lib/theme'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import {
  Plus, GripVertical, Trash2, Check, Eye, EyeOff,
  Loader2, AlertCircle, CheckCircle2, Sun, Moon,
  ExternalLink, Link2Off, Sheet, Sparkles
} from 'lucide-react'
import { cn } from '../lib/utils'
import { toast } from 'sonner'

export default function Settings() {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<'accounts' | 'general' | 'queue' | 'integrations' | 'appearance'>('accounts')

  // Handle OAuth callback messages
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')

    if (success === 'google_sheets_connected') {
      toast.success('Google Sheets connected successfully')
      setActiveTab('integrations')
    } else if (error) {
      const errorMessages: Record<string, string> = {
        auth_denied: 'Authorization was denied',
        no_code: 'No authorization code received',
        token_exchange_failed: 'Failed to complete authorization',
        callback_error: 'Authorization callback error',
      }
      toast.error(errorMessages[error] || 'An error occurred')
      setActiveTab('integrations')
    }
  }, [searchParams])

  const tabLabels: Record<string, string> = {
    accounts: 'Sender Accounts',
    general: 'General',
    queue: 'Queue',
    integrations: 'Integrations',
    appearance: 'Appearance',
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        {(['accounts', 'general', 'queue', 'integrations', 'appearance'] as const).map((tab) => (
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
      {activeTab === 'integrations' && <IntegrationsSettings />}
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
    mutationFn: (data: Partial<SenderAccount>) => account
      ? api.updateAccount(account.id, data)
      : api.createAccount(data as Omit<SenderAccount, 'id' | 'createdAt' | 'todayCount'>),
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

function LLMProvidersSettings() {
  const queryClient = useQueryClient()
  const [editingProvider, setEditingProvider] = useState<LLMProviderId | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [selectedModel, setSelectedModel] = useState('')

  const { data: providersInfo } = useQuery({
    queryKey: ['llm-providers-info'],
    queryFn: api.getLLMProvidersInfo,
  })

  const { data: settings, isLoading } = useQuery({
    queryKey: ['llm-settings'],
    queryFn: api.getLLMSettings,
  })

  const updateProviderMutation = useMutation({
    mutationFn: api.updateLLMProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-settings'] })
      setEditingProvider(null)
      setApiKeyInput('')
      setShowApiKey(false)
      toast.success('Provider settings saved')
    },
    onError: () => {
      toast.error('Failed to save provider settings')
    },
  })

  const setActiveMutation = useMutation({
    mutationFn: api.setActiveLLMProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-settings'] })
      toast.success('Active provider updated')
    },
    onError: () => {
      toast.error('Failed to update active provider')
    },
  })

  const handleSaveProvider = (providerId: LLMProviderId) => {
    updateProviderMutation.mutate({
      id: providerId,
      apiKey: apiKeyInput || undefined,
      model: selectedModel || undefined,
      enabled: true,
    })
  }

  const handleSetActive = (providerId: LLMProviderId) => {
    setActiveMutation.mutate(providerId)
  }

  const startEditing = (providerId: LLMProviderId) => {
    const provider = settings?.providers.find(p => p.id === providerId)
    const providerInfo = providersInfo?.find(p => p.id === providerId)
    setEditingProvider(providerId)
    setApiKeyInput('')
    setSelectedModel(provider?.model || providerInfo?.models[0]?.id || '')
    setShowApiKey(false)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          AI Providers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Configure AI providers for sequence generation. Add your API keys and select which provider to use.
        </p>

        <div className="space-y-3">
          {providersInfo?.map((providerInfo) => {
            const configured = settings?.providers.find(p => p.id === providerInfo.id)
            const isActive = settings?.activeProvider === providerInfo.id
            const isEditing = editingProvider === providerInfo.id

            return (
              <div
                key={providerInfo.id}
                className={cn(
                  'p-4 rounded-lg border transition-colors',
                  isActive && 'border-primary bg-primary/5'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{providerInfo.name}</span>
                    {configured?.apiKeyMasked && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {configured.apiKeyMasked}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {configured?.enabled && configured.apiKeyMasked && (
                      <Button
                        size="sm"
                        variant={isActive ? 'default' : 'outline'}
                        onClick={() => handleSetActive(providerInfo.id)}
                        disabled={isActive || setActiveMutation.isPending}
                      >
                        {isActive ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Active
                          </>
                        ) : (
                          'Set Active'
                        )}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => isEditing ? setEditingProvider(null) : startEditing(providerInfo.id)}
                    >
                      {isEditing ? 'Cancel' : configured?.apiKeyMasked ? 'Edit' : 'Configure'}
                    </Button>
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-3 space-y-3 p-3 bg-muted/50 rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-xs">API Key</Label>
                      <div className="relative">
                        <Input
                          type={showApiKey ? 'text' : 'password'}
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                          placeholder={configured?.apiKeyMasked ? `Current: ${configured.apiKeyMasked}` : 'Enter API key'}
                          className="h-8 text-sm pr-8"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Model</Label>
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full h-8 text-sm px-2 rounded-md border border-input bg-background"
                      >
                        {providerInfo.models.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name} {model.description && `- ${model.description}`}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground">
                        Or enter a custom model ID in the field above (coming soon)
                      </p>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleSaveProvider(providerInfo.id)}
                      disabled={updateProviderMutation.isPending}
                    >
                      {updateProviderMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                      Save
                    </Button>
                  </div>
                )}

                {configured?.model && !isEditing && (
                  <p className="text-xs text-muted-foreground">
                    Model: {providerInfo.models.find(m => m.id === configured.model)?.name || configured.model}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {settings?.activeProvider && (
          <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg text-sm">
            <p className="font-medium text-purple-800 dark:text-purple-200">Ready for AI generation</p>
            <p className="text-purple-700 dark:text-purple-300 text-xs mt-1">
              Using {providersInfo?.find(p => p.id === settings.activeProvider)?.name} for sequence generation.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function IntegrationsSettings() {
  const queryClient = useQueryClient()
  const [showCredentialsForm, setShowCredentialsForm] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)

  const { data: status, isLoading } = useQuery({
    queryKey: ['google-sheets-status'],
    queryFn: googleSheetsApi.getStatus,
  })

  const saveCredentialsMutation = useMutation({
    mutationFn: googleSheetsApi.saveCredentials,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-sheets-status'] })
      setShowCredentialsForm(false)
      setClientId('')
      setClientSecret('')
      toast.success('Credentials saved')
    },
    onError: () => {
      toast.error('Failed to save credentials')
    },
  })

  const connectMutation = useMutation({
    mutationFn: googleSheetsApi.getAuthUrl,
    onSuccess: (data) => {
      window.location.href = data.authUrl
    },
    onError: () => {
      toast.error('Failed to get authorization URL')
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: googleSheetsApi.disconnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-sheets-status'] })
      toast.success('Google Sheets disconnected')
    },
    onError: () => {
      toast.error('Failed to disconnect')
    },
  })

  const handleSaveCredentials = () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error('Please fill in all fields')
      return
    }
    saveCredentialsMutation.mutate({ clientId: clientId.trim(), clientSecret: clientSecret.trim() })
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Google Sheets Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sheet className="h-5 w-5 text-green-600" />
            Google Sheets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Import contacts directly from Google Sheets. Sync your spreadsheets to contact lists with automatic column mapping.
          </p>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            {status?.connected ? (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Connected
              </span>
            ) : status?.configured ? (
              <span className="flex items-center gap-1 text-sm text-yellow-600">
                <AlertCircle className="h-4 w-4" />
                Credentials configured, not connected
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Link2Off className="h-4 w-4" />
                Not configured
              </span>
            )}
          </div>

          {/* Credentials Form */}
          {(showCredentialsForm || !status?.configured) && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium">OAuth 2.0 Credentials</p>
              <p className="text-xs text-muted-foreground">
                Create credentials in the{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Google Cloud Console
                  <ExternalLink className="h-3 w-3" />
                </a>
                . Enable the Google Sheets API and create OAuth 2.0 credentials (Web application type).
              </p>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Client ID</Label>
                  <Input
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="xxxxx.apps.googleusercontent.com"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Client Secret</Label>
                  <div className="relative">
                    <Input
                      type={showSecret ? 'text' : 'password'}
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder="GOCSPX-..."
                      className="h-8 text-sm pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add this redirect URI to your OAuth credentials:{' '}
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">
                    {window.location.origin}/api/integrations/google-sheets/callback
                  </code>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveCredentials}
                  disabled={saveCredentialsMutation.isPending}
                >
                  {saveCredentialsMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Save Credentials
                </Button>
                {status?.configured && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCredentialsForm(false)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Connect/Disconnect Buttons */}
          {status?.configured && !showCredentialsForm && (
            <div className="flex items-center gap-2">
              {status.connected ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  <Link2Off className="h-4 w-4 mr-1" />
                  Disconnect
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => connectMutation.mutate()}
                  disabled={connectMutation.isPending}
                >
                  {connectMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Connect Google Account
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowCredentialsForm(true)}
              >
                Update Credentials
              </Button>
            </div>
          )}

          {/* Usage Instructions */}
          {status?.connected && (
            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg text-sm">
              <p className="font-medium text-green-800 dark:text-green-200">Ready to sync</p>
              <p className="text-green-700 dark:text-green-300 text-xs mt-1">
                Go to any contact list and click &quot;Sync from Google Sheets&quot; to import contacts from your spreadsheets.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* LLM Providers */}
      <LLMProvidersSettings />
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
