'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Activity,
  Brain,
  Cpu,
  Database,
  HardDrive,
  MessageSquare,
  Settings,
  Shield,
  Zap,
  Play,
  Pause,
  Square,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Target,
  BookOpen,
  RefreshCw,
  Power,
  Wifi,
  WifiOff,
  Clock,
  MemoryStick,
  Sparkles,
  Gauge,
  Heart,
  Wrench,
  Bug,
  Lightbulb,
  Trash2,
  Plus
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

interface AgentStatus {
  state: 'idle' | 'starting' | 'running' | 'paused' | 'stopping' | 'error' | 'recovering'
  isRunning: boolean
  isPaused: boolean
  isRecovering: boolean
  currentCycle: number
  totalCycles: number
  uptime: number
  startTime: Date | null
  lastActivity: Date | null
  lastError: string | null
  consecutiveErrors: number
  healthScore: number
  activeGoals: string[]
  pendingActions: number
  learningProgress: number
}

interface AgentConfig {
  id: string
  name: string
  mode: 'autonomous' | 'supervised' | 'manual'
  autoStart: boolean
  autoRecover: boolean
  autoImprove: boolean
  learningEnabled: boolean
  maxRetries: number
  loopIntervalMs: number
  cooldownMs: number
  maxCyclesPerSession: number
  priority: 'low' | 'normal' | 'high' | 'critical'
  primaryProvider: 'zai' | 'groq' | 'auto'
  goals: AgentGoal[]
}

interface AgentGoal {
  id: string
  type: string
  description: string
  priority: number
  enabled: boolean
  successCount: number
  failureCount: number
}

interface LearningEntry {
  id: string
  type: string
  category: string
  insight: string
  confidence: number
  createdAt: string
}

interface Performance {
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  overallScore: number
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AgentControlPanel() {
  // State
  const [status, setStatus] = useState<AgentStatus>({
    state: 'idle',
    isRunning: false,
    isPaused: false,
    isRecovering: false,
    currentCycle: 0,
    totalCycles: 0,
    uptime: 0,
    startTime: null,
    lastActivity: null,
    lastError: null,
    consecutiveErrors: 0,
    healthScore: 100,
    activeGoals: [],
    pendingActions: 0,
    learningProgress: 0
  })

  const [config, setConfig] = useState<AgentConfig | null>(null)
  const [learnings, setLearnings] = useState<LearningEntry[]>([])
  const [performance, setPerformance] = useState<Performance | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Password for sensitive operations
  const [authPassword, setAuthPassword] = useState('Clawdev2024!')

  // New goal form
  const [newGoal, setNewGoal] = useState({ type: 'custom', description: '', priority: 5 })

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/control?action=status')
      const data = await res.json()
      if (data.success) {
        setStatus(data.status)
      }
    } catch (e) {
      console.error('Failed to fetch status:', e)
    }
  }, [])

  // Fetch config
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/control?action=config')
      const data = await res.json()
      if (data.success) {
        setConfig(data.config)
      }
    } catch (e) {
      console.error('Failed to fetch config:', e)
    }
  }, [])

  // Fetch learnings
  const fetchLearnings = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/control?action=learning')
      const data = await res.json()
      if (data.success) {
        setLearnings(data.learnings)
      }
    } catch (e) {
      console.error('Failed to fetch learnings:', e)
    }
  }, [])

  // Fetch performance
  const fetchPerformance = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/control?action=performance')
      const data = await res.json()
      if (data.success) {
        setPerformance(data.performance)
      }
    } catch (e) {
      console.error('Failed to fetch performance:', e)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchStatus()
    fetchConfig()
    fetchLearnings()
    fetchPerformance()

    // Refresh every 5 seconds
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [fetchStatus, fetchConfig, fetchLearnings, fetchPerformance])

  // Control actions
  const sendAction = async (action: string, body: Record<string, unknown> = {}) => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/agent/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, auth: authPassword, ...body })
      })

      const data = await res.json()

      if (data.success) {
        setSuccess(`Action "${action}" completed successfully`)
        // Refresh status
        await fetchStatus()
        await fetchConfig()
      } else {
        setError(data.error || 'Action failed')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Helper functions
  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const getStateColor = (state: string) => {
    switch (state) {
      case 'running': return 'text-green-400 border-green-400'
      case 'paused': return 'text-yellow-400 border-yellow-400'
      case 'error': return 'text-red-400 border-red-400'
      case 'recovering': return 'text-purple-400 border-purple-400'
      case 'starting':
      case 'stopping': return 'text-blue-400 border-blue-400'
      default: return 'text-gray-400 border-gray-400'
    }
  }

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    if (score >= 40) return 'text-orange-400'
    return 'text-red-400'
  }

  const getHealthIcon = (score: number) => {
    if (score >= 80) return <Heart className="w-5 h-5 text-green-400" />
    if (score >= 60) return <Activity className="w-5 h-5 text-yellow-400" />
    return <AlertTriangle className="w-5 h-5 text-red-400" />
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {error && (
        <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-500/10 border-green-500/30 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <AlertTitle className="text-green-400">Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Agent State */}
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <Power className="w-5 h-5 text-primary" />
              <Badge variant="outline" className={getStateColor(status.state)}>
                {status.state.toUpperCase()}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Agent State</p>
            <p className="text-xs text-muted-foreground mt-1">
              {status.isRunning ? (
                <span className="flex items-center gap-1">
                  <Wifi className="w-3 h-3 text-green-400" /> Connected
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <WifiOff className="w-3 h-3 text-gray-400" /> Disconnected
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Health Score */}
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              {getHealthIcon(status.healthScore)}
              <span className={`text-lg font-bold ${getHealthColor(status.healthScore)}`}>
                {status.healthScore}%
              </span>
            </div>
            <Progress value={status.healthScore} className="h-2 mb-2" />
            <p className="text-sm text-muted-foreground">Health Score</p>
          </CardContent>
        </Card>

        {/* Cycles */}
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <RefreshCw className={`w-5 h-5 ${status.isRunning && !status.isPaused ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
              <span className="text-2xl font-bold">{status.totalCycles}</span>
            </div>
            <p className="text-sm text-muted-foreground">Total Cycles</p>
            <p className="text-xs text-muted-foreground mt-1">Current: {status.currentCycle}</p>
          </CardContent>
        </Card>

        {/* Uptime */}
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 text-primary" />
              <span className="text-lg font-mono">{formatUptime(status.uptime)}</span>
            </div>
            <p className="text-sm text-muted-foreground">Uptime</p>
            <p className="text-xs text-muted-foreground mt-1">
              {status.lastActivity ? `Last activity: ${new Date(status.lastActivity).toLocaleTimeString()}` : 'No activity yet'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Control Panel */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Agent Control
          </CardTitle>
          <CardDescription>Full control over the autonomous agent</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Controls */}
          <div className="flex flex-wrap gap-3">
            {!status.isRunning ? (
              <Button
                onClick={() => sendAction('start')}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Agent
              </Button>
            ) : status.isPaused ? (
              <Button
                onClick={() => sendAction('resume')}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Resume Agent
              </Button>
            ) : (
              <Button
                onClick={() => sendAction('pause')}
                disabled={loading}
                variant="secondary"
              >
                <Pause className="w-4 h-4 mr-2" />
                Pause Agent
              </Button>
            )}

            {status.isRunning && (
              <Button
                onClick={() => sendAction('stop')}
                disabled={loading}
                variant="destructive"
              >
                <Square className="w-4 h-4 mr-2" />
                Stop Agent
              </Button>
            )}

            <Button
              onClick={() => sendAction('restart')}
              disabled={loading || !status.isRunning}
              variant="outline"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restart
            </Button>
          </div>

          <Separator />

          {/* Quick Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Mode */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Operation Mode</Label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={config?.mode === 'autonomous' ? 'default' : 'outline'}
                  onClick={() => sendAction('set_mode', { mode: 'autonomous' })}
                  disabled={loading}
                >
                  Auto
                </Button>
                <Button
                  size="sm"
                  variant={config?.mode === 'supervised' ? 'default' : 'outline'}
                  onClick={() => sendAction('set_mode', { mode: 'supervised' })}
                  disabled={loading}
                >
                  Supervised
                </Button>
                <Button
                  size="sm"
                  variant={config?.mode === 'manual' ? 'default' : 'outline'}
                  onClick={() => sendAction('set_mode', { mode: 'manual' })}
                  disabled={loading}
                >
                  Manual
                </Button>
              </div>
            </div>

            {/* Loop Interval */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Loop Interval: {((config?.loopIntervalMs || 10000) / 1000).toFixed(0)}s
              </Label>
              <Slider
                value={[(config?.loopIntervalMs || 10000) / 1000]}
                min={1}
                max={60}
                step={1}
                onValueChange={([value]) => {
                  sendAction('set_interval', { interval: value * 1000 })
                }}
              />
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Auto-Recover</Label>
                <Switch
                  checked={config?.autoRecover ?? true}
                  onCheckedChange={(checked) => sendAction('toggle_auto_recover', { enabled: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Auto-Improve</Label>
                <Switch
                  checked={config?.autoImprove ?? true}
                  onCheckedChange={(checked) => sendAction('toggle_auto_improve', { enabled: checked })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Learning</Label>
                <Switch
                  checked={config?.learningEnabled ?? true}
                  onCheckedChange={(checked) => sendAction('toggle_learning', { enabled: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Auto-Start</Label>
                <Switch
                  checked={config?.autoStart ?? true}
                  disabled // This requires restart to take effect
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Goals and Learning Tabs */}
      <Tabs defaultValue="goals" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="goals">
            <Target className="w-4 h-4 mr-2" />
            Goals
          </TabsTrigger>
          <TabsTrigger value="learning">
            <BookOpen className="w-4 h-4 mr-2" />
            Learning
          </TabsTrigger>
          <TabsTrigger value="performance">
            <TrendingUp className="w-4 h-4 mr-2" />
            Performance
          </TabsTrigger>
        </TabsList>

        {/* Goals Tab */}
        <TabsContent value="goals" className="mt-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Agent Goals</CardTitle>
              <CardDescription>Configure what the agent should focus on</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add New Goal */}
              <div className="flex gap-2 p-3 rounded-lg bg-muted/30">
                <Input
                  placeholder="Goal description..."
                  value={newGoal.description}
                  onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                  className="flex-1"
                />
                <Input
                  placeholder="Type"
                  value={newGoal.type}
                  onChange={(e) => setNewGoal({ ...newGoal, type: e.target.value })}
                  className="w-24"
                />
                <Input
                  type="number"
                  placeholder="Priority"
                  value={newGoal.priority}
                  onChange={(e) => setNewGoal({ ...newGoal, priority: parseInt(e.target.value) || 5 })}
                  className="w-20"
                />
                <Button
                  onClick={() => {
                    sendAction('add_goal', newGoal)
                    setNewGoal({ type: 'custom', description: '', priority: 5 })
                  }}
                  disabled={loading || !newGoal.description}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Goals List */}
              <ScrollArea className="h-64">
                {config?.goals.map((goal) => (
                  <div
                    key={goal.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors mb-2"
                  >
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={goal.enabled}
                        onCheckedChange={(checked) => sendAction('toggle_goal', { goalId: goal.id, enabled: checked })}
                      />
                      <div>
                        <p className="font-medium">{goal.description || goal.type}</p>
                        <p className="text-xs text-muted-foreground">
                          Type: {goal.type} | Priority: {goal.priority} |
                          Success: {goal.successCount} | Failures: {goal.failureCount}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => sendAction('remove_goal', { goalId: goal.id })}
                      disabled={loading}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Learning Tab */}
        <TabsContent value="learning" className="mt-4">
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Learning Memory</CardTitle>
                  <CardDescription>Agent's learned knowledge and patterns</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendAction('detect_patterns')}
                    disabled={loading}
                  >
                    <Lightbulb className="w-4 h-4 mr-1" />
                    Detect Patterns
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendAction('cleanup_learnings')}
                    disabled={loading}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Cleanup
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Learning Progress */}
              <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-muted/20">
                <MemoryStick className="w-8 h-8 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Learning Progress</p>
                  <Progress value={status.learningProgress} className="h-2 mt-1" />
                </div>
                <span className="text-lg font-bold">{status.learningProgress}%</span>
              </div>

              {/* Recent Learnings */}
              <ScrollArea className="h-64">
                {learnings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No learnings yet. Start the agent to begin learning.</p>
                  </div>
                ) : (
                  learnings.map((learning) => (
                    <div
                      key={learning.id}
                      className="p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors mb-2"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-xs">
                          {learning.type}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {learning.confidence}% confidence
                          </span>
                          <Progress value={learning.confidence} className="w-16 h-1" />
                        </div>
                      </div>
                      <p className="text-sm">{learning.insight}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(learning.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Overall Score */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="w-5 h-5" />
                  Overall Score
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="relative inline-flex items-center justify-center w-32 h-32">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-muted/20"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${(performance?.overallScore || 0) * 3.52} 352`}
                      className={getHealthColor(performance?.overallScore || 0)}
                    />
                  </svg>
                  <span className="text-3xl font-bold">
                    {performance?.overallScore || 0}%
                  </span>
                </div>
                <p className="text-muted-foreground mt-4">Success Rate</p>
              </CardContent>
            </Card>

            {/* Strengths & Weaknesses */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-green-400 flex items-center gap-1 mb-2">
                    <TrendingUp className="w-4 h-4" />
                    Strengths
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {performance?.strengths.map((s, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-green-400" />
                        {s}
                      </li>
                    ))}
                    {(!performance?.strengths.length) && (
                      <li className="text-gray-500">Gathering data...</li>
                    )}
                  </ul>
                </div>
                <Separator />
                <div>
                  <p className="text-sm font-medium text-red-400 flex items-center gap-1 mb-2">
                    <TrendingDown className="w-4 h-4" />
                    Weaknesses
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {performance?.weaknesses.map((w, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                        {w}
                      </li>
                    ))}
                    {(!performance?.weaknesses.length) && (
                      <li className="text-gray-500">No weaknesses detected</li>
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Suggestions */}
            <Card className="glass-card md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Improvement Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {performance?.suggestions.map((s, i) => (
                    <Badge key={i} variant="secondary" className="px-3 py-1">
                      {s}
                    </Badge>
                  ))}
                  {(!performance?.suggestions.length) && (
                    <p className="text-muted-foreground text-sm">No suggestions at this time.</p>
                  )}
                </div>

                <Button
                  className="w-full mt-4"
                  onClick={() => {
                    fetchPerformance()
                    fetchLearnings()
                  }}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh Analysis
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Errors Section */}
      {status.lastError && (
        <Card className="glass-card border-red-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <Bug className="w-5 h-5" />
              Last Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{status.lastError}</AlertDescription>
            </Alert>
            {status.consecutiveErrors > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                Consecutive errors: {status.consecutiveErrors}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
