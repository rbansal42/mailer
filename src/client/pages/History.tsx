import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Campaign, CampaignAnalytics } from '../lib/api'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { ChevronLeft, Download, RefreshCw, Trash2, CheckCircle2, XCircle, Clock, Loader2, Eye, MousePointer, Mail, Search, Copy, CalendarClock } from 'lucide-react'
import { Input } from '../components/ui/input'
import { toast } from 'sonner'
import { getTimezoneAbbreviation } from '../lib/utils'


export default function History() {
  const [selectedCampaign, setSelectedCampaign] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: api.getCampaigns,
  })

  const filteredCampaigns = campaigns?.filter(
    (campaign) =>
      campaign.name?.toLowerCase().includes(search.toLowerCase()) ||
      campaign.subject?.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  if (selectedCampaign !== null) {
    return <CampaignDetails id={selectedCampaign} onBack={() => setSelectedCampaign(null)} />
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Campaign History</h1>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-1" />
          Export CSV
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search campaigns..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredCampaigns.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Sent</th>
                <th className="text-left p-3 font-medium">Recipients</th>
                <th className="text-left p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredCampaigns.map((campaign) => (
                <tr
                  key={campaign.id}
                  className="border-t hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setSelectedCampaign(campaign.id)}
                >
                  <td className="p-3 font-medium">{campaign.name || 'Untitled'}</td>
                  <td className="p-3 text-muted-foreground">
                    {campaign.startedAt ? (
                      <>{new Date(campaign.startedAt).toLocaleString()} <span className="text-xs">{getTimezoneAbbreviation()}</span></>
                    ) : '-'}
                  </td>
                  <td className="p-3">
                    <span className="text-green-600">{campaign.successful}</span>
                    {campaign.failed > 0 && (
                      <span className="text-destructive">/{campaign.failed}</span>
                    )}
                    <span className="text-muted-foreground">/{campaign.totalRecipients}</span>
                  </td>
                  <td className="p-3">
                    <StatusBadge campaign={campaign} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            {campaigns?.length ? 'No campaigns match your search' : 'No campaigns sent yet'}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatusBadge({ campaign }: { campaign: Campaign }) {
  if (campaign.status === 'scheduled') {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
          <CalendarClock className="h-3 w-3" />
          Scheduled
        </span>
        {campaign.scheduledFor && (
          <span className="text-xs text-muted-foreground pl-2">
            {new Date(campaign.scheduledFor).toLocaleString()} {getTimezoneAbbreviation()}
          </span>
        )}
      </div>
    )
  }
  if (campaign.queued > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
        <Clock className="h-3 w-3" />
        {campaign.queued} queued
      </span>
    )
  }
  if (campaign.failed > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
        <XCircle className="h-3 w-3" />
        {campaign.failed} failed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
      <CheckCircle2 className="h-3 w-3" />
      Completed
    </span>
  )
}

function CampaignDetails({ id, onBack }: { id: number; onBack: () => void }) {
  const queryClient = useQueryClient()

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api.getCampaign(id),
  })

  const { data: analytics } = useQuery({
    queryKey: ['campaign-analytics', id],
    queryFn: () => api.getCampaignAnalytics(id),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      onBack()
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: () => api.duplicateCampaign(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] })
      toast.success(`Duplicated as "${data.name}" - check Campaigns page`)
    },
    onError: () => {
      toast.error('Failed to duplicate campaign')
    },
  })

  if (isLoading || !campaign) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const failedLogs = campaign.logs?.filter((l) => l.status === 'failed') || []
  const successLogs = campaign.logs?.filter((l) => l.status === 'success') || []

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold">{campaign.name || 'Untitled'}</h1>
        </div>
        <div className="flex items-center gap-2">
          {failedLogs.length > 0 && (
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry Failed
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => duplicateMutation.mutate()}
            disabled={duplicateMutation.isPending}
          >
            <Copy className="h-4 w-4 mr-1" />
            Duplicate to Draft
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => deleteMutation.mutate()}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary */}
      <Card className="mb-4">
        <CardContent className="p-4 grid grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Sent</p>
            <p className="font-medium">
              {campaign.startedAt ? (
                <>{new Date(campaign.startedAt).toLocaleString()} <span className="text-xs text-muted-foreground font-normal">{getTimezoneAbbreviation()}</span></>
              ) : '-'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Subject</p>
            <p className="font-medium truncate">{campaign.subject}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total</p>
            <p className="font-medium">{campaign.totalRecipients} recipients</p>
          </div>
          <div>
            <p className="text-muted-foreground">Results</p>
            <p className="font-medium">
              <span className="text-green-600">{campaign.successful} sent</span>
              {campaign.failed > 0 && (
                <span className="text-destructive ml-2">{campaign.failed} failed</span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Engagement Stats */}
      {analytics && (
        <Card className="mb-4">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">Engagement</CardTitle>
          </CardHeader>
          <CardContent className={`p-4 pt-0 grid gap-4 text-sm ${analytics.engagement.actionClicks !== undefined ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-blue-100">
                <Mail className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Delivered</p>
                <p className="font-semibold">{analytics.delivery.sent}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-green-100">
                <Eye className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Opens</p>
                <p className="font-semibold">{analytics.engagement.uniqueOpens} <span className="text-muted-foreground font-normal">({analytics.engagement.openRate}%)</span></p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-purple-100">
                <MousePointer className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Clicks</p>
                <p className="font-semibold">{analytics.engagement.uniqueClicks} <span className="text-muted-foreground font-normal">({analytics.engagement.clickRate}%)</span></p>
              </div>
            </div>
            {analytics.engagement.actionClicks !== undefined && (
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-orange-100">
                  <MousePointer className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Action Taken</p>
                  <p className="font-semibold">{analytics.engagement.actionClicks} <span className="text-muted-foreground font-normal">({analytics.engagement.actionRate || 0}%)</span></p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Failed Recipients */}
      {failedLogs.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm text-destructive">Failed Recipients</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">Email</th>
                  <th className="text-left p-2 font-medium">Error</th>
                  <th className="text-right p-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {failedLogs.map((log) => (
                  <tr key={log.id} className="border-t">
                    <td className="p-2">{log.recipientEmail}</td>
                    <td className="p-2 text-muted-foreground">{log.errorMessage || 'Unknown error'}</td>
                    <td className="p-2 text-right">
                      <Button variant="ghost" size="sm">
                        Retry
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Recipients with Tracking */}
      <Card>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm">
            Recipients ({successLogs.length + failedLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium">Email</th>
                <th className="text-left p-2 font-medium">Status</th>
                <th className="text-center p-2 font-medium">Opens</th>
                <th className="text-center p-2 font-medium">Clicks</th>
              </tr>
            </thead>
            <tbody>
              {analytics?.recipients?.map((r) => (
                <tr key={r.email} className="border-t">
                  <td className="p-2 font-mono text-xs">{r.email}</td>
                  <td className="p-2">
                    {r.status === 'success' ? (
                      <span className="text-green-600 text-xs">Sent</span>
                    ) : (
                      <span className="text-destructive text-xs">Failed</span>
                    )}
                  </td>
                  <td className="p-2 text-center">
                    {r.opens > 0 ? (
                      <span className="inline-flex items-center gap-1 text-green-600">
                        <Eye className="h-3 w-3" />
                        {r.opens}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="p-2 text-center">
                    {r.clicks.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-purple-600">
                        <MousePointer className="h-3 w-3" />
                        {r.clicks.length}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              )) || successLogs.map((log) => (
                <tr key={log.id} className="border-t">
                  <td className="p-2 font-mono text-xs">{log.recipientEmail}</td>
                  <td className="p-2">
                    <span className="text-green-600 text-xs">Sent</span>
                  </td>
                  <td className="p-2 text-center text-muted-foreground">-</td>
                  <td className="p-2 text-center text-muted-foreground">-</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
