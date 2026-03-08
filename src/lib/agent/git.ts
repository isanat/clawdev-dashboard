/**
 * CLAWDEV Git Integration - Git Operations REAL
 * 
 * Sistema completo de operações Git:
 * - Clone, Pull, Push
 * - Commit, Branch, Merge
 * - Status, Diff, Log
 * - Stash, Cherry-pick
 * 
 * TUDO REAL - Sem simulações!
 */

import { realExecutor, ExecutionResult } from './executor'
import { db } from '@/lib/db'

// ============================================================================
// TYPES
// ============================================================================

export interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  untracked: string[]
  conflicts: string[]
  clean: boolean
}

export interface GitCommit {
  hash: string
  shortHash: string
  author: string
  email: string
  date: Date
  message: string
}

export interface GitBranch {
  name: string
  current: boolean
  remote: boolean
  lastCommit: string
}

export interface GitDiff {
  file: string
  additions: number
  deletions: number
  changes: string
}

export interface GitLog {
  commits: GitCommit[]
  total: number
  hasMore: boolean
}

// ============================================================================
// GIT CLASS
// ============================================================================

class GitManager {
  private static instance: GitManager
  private repoPath: string = process.cwd()

  static getInstance(): GitManager {
    if (!GitManager.instance) {
      GitManager.instance = new GitManager()
    }
    return GitManager.instance
  }

  setRepoPath(path: string): void {
    this.repoPath = path
  }

  // ============================================================================
  // BASIC OPERATIONS
  // ============================================================================

  /**
   * Initialize a git repository
   */
  async init(): Promise<ExecutionResult> {
    const result = await realExecutor.executeCommand('git init', this.repoPath)
    await this.logGitOperation('init', result.success)
    return result
  }

  /**
   * Clone a repository
   */
  async clone(url: string, targetDir?: string): Promise<ExecutionResult> {
    const cmd = targetDir 
      ? `git clone ${url} ${targetDir}`
      : `git clone ${url}`
    const result = await realExecutor.executeCommand(cmd, this.repoPath)
    await this.logGitOperation('clone', result.success, { url })
    return result
  }

  /**
   * Pull latest changes
   */
  async pull(remote: string = 'origin', branch?: string): Promise<ExecutionResult> {
    const cmd = branch 
      ? `git pull ${remote} ${branch}`
      : `git pull ${remote}`
    const result = await realExecutor.executeCommand(cmd, this.repoPath)
    await this.logGitOperation('pull', result.success, { remote, branch })
    return result
  }

  /**
   * Push changes
   */
  async push(remote: string = 'origin', branch?: string, force: boolean = false): Promise<ExecutionResult> {
    const forceFlag = force ? '--force' : ''
    const cmd = branch 
      ? `git push ${forceFlag} ${remote} ${branch}`
      : `git push ${forceFlag} ${remote}`
    const result = await realExecutor.executeCommand(cmd, this.repoPath)
    await this.logGitOperation('push', result.success, { remote, branch, force })
    return result
  }

  /**
   * Fetch remote changes
   */
  async fetch(remote: string = 'origin'): Promise<ExecutionResult> {
    const result = await realExecutor.executeCommand(`git fetch ${remote}`, this.repoPath)
    await this.logGitOperation('fetch', result.success, { remote })
    return result
  }

  // ============================================================================
  // COMMIT OPERATIONS
  // ============================================================================

  /**
   * Add files to staging
   */
  async add(files: string | string[] = '.'): Promise<ExecutionResult> {
    const filesStr = Array.isArray(files) ? files.join(' ') : files
    const result = await realExecutor.executeCommand(`git add ${filesStr}`, this.repoPath)
    return result
  }

  /**
   * Add all changes
   */
  async addAll(): Promise<ExecutionResult> {
    return this.add('-A')
  }

  /**
   * Commit changes
   */
  async commit(message: string, author?: { name: string; email: string }): Promise<ExecutionResult> {
    let cmd = `git commit -m "${message.replace(/"/g, '\\"')}"`
    
    if (author) {
      cmd += ` --author="${author.name} <${author.email}>"`
    }
    
    const result = await realExecutor.executeCommand(cmd, this.repoPath)
    await this.logGitOperation('commit', result.success, { message })
    return result
  }

  /**
   * Stage and commit all changes in one operation
   */
  async addAndCommit(message: string): Promise<{ success: boolean; message: string; commitHash?: string }> {
    // Check if there are changes
    const status = await this.getStatus()
    
    if (status.clean) {
      return { success: true, message: 'No changes to commit' }
    }

    // Add all changes
    const addResult = await this.addAll()
    if (!addResult.success) {
      return { success: false, message: `Failed to stage changes: ${addResult.stderr}` }
    }

    // Commit
    const commitResult = await this.commit(message)
    if (!commitResult.success) {
      return { success: false, message: `Failed to commit: ${commitResult.stderr}` }
    }

    // Get commit hash
    const hashResult = await realExecutor.executeCommand('git rev-parse HEAD', this.repoPath)
    const commitHash = hashResult.success ? hashResult.stdout.trim() : undefined

    return { 
      success: true, 
      message: 'Changes committed successfully',
      commitHash: commitHash?.substring(0, 7)
    }
  }

  // ============================================================================
  // BRANCH OPERATIONS
  // ============================================================================

  /**
   * Create a new branch
   */
  async createBranch(name: string, checkout: boolean = true): Promise<ExecutionResult> {
    if (checkout) {
      return realExecutor.executeCommand(`git checkout -b ${name}`, this.repoPath)
    }
    return realExecutor.executeCommand(`git branch ${name}`, this.repoPath)
  }

  /**
   * Switch to a branch
   */
  async checkout(branch: string): Promise<ExecutionResult> {
    const result = await realExecutor.executeCommand(`git checkout ${branch}`, this.repoPath)
    await this.logGitOperation('checkout', result.success, { branch })
    return result
  }

  /**
   * Delete a branch
   */
  async deleteBranch(name: string, force: boolean = false): Promise<ExecutionResult> {
    const flag = force ? '-D' : '-d'
    return realExecutor.executeCommand(`git branch ${flag} ${name}`, this.repoPath)
  }

  /**
   * Merge a branch
   */
  async merge(branch: string, noFf: boolean = false): Promise<ExecutionResult> {
    const flag = noFf ? '--no-ff' : ''
    const result = await realExecutor.executeCommand(`git merge ${flag} ${branch}`, this.repoPath)
    await this.logGitOperation('merge', result.success, { branch })
    return result
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    const result = await realExecutor.executeCommand('git rev-parse --abbrev-ref HEAD', this.repoPath)
    return result.success ? result.stdout.trim() : 'unknown'
  }

  /**
   * List all branches
   */
  async listBranches(): Promise<GitBranch[]> {
    const result = await realExecutor.executeCommand('git branch -a', this.repoPath)
    
    if (!result.success) {
      return []
    }

    const branches: GitBranch[] = []
    const lines = result.stdout.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      const current = trimmed.startsWith('*')
      const name = trimmed.replace(/^\*?\s*/, '')
      const remote = name.startsWith('remotes/')

      // Get last commit for this branch
      const commitResult = await realExecutor.executeCommand(
        `git log -1 --format="%h" ${name}`,
        this.repoPath
      )

      branches.push({
        name: remote ? name.replace('remotes/', '') : name,
        current,
        remote,
        lastCommit: commitResult.success ? commitResult.stdout.trim() : ''
      })
    }

    return branches
  }

  // ============================================================================
  // STATUS & INFO
  // ============================================================================

  /**
   * Get repository status
   */
  async getStatus(): Promise<GitStatus> {
    const result = await realExecutor.executeCommand('git status --porcelain=v1', this.repoPath)
    
    const staged: string[] = []
    const modified: string[] = []
    const untracked: string[] = []
    const conflicts: string[] = []

    if (result.success) {
      const lines = result.stdout.split('\n').filter(l => l.trim())
      
      for (const line of lines) {
        const index = line[0]
        const workTree = line[1]
        const file = line.substring(3)

        // Check for conflicts
        if (index === 'U' || workTree === 'U' || (index === 'A' && workTree === 'A')) {
          conflicts.push(file)
          continue
        }

        // Staged changes
        if (index !== ' ' && index !== '?') {
          staged.push(file)
        }

        // Modified in working tree
        if (workTree !== ' ' && workTree !== '?') {
          modified.push(file)
        }

        // Untracked files
        if (index === '?' && workTree === '?') {
          untracked.push(file)
        }
      }
    }

    // Get branch info
    const branch = await this.getCurrentBranch()
    
    // Get ahead/behind counts
    let ahead = 0
    let behind = 0
    const countResult = await realExecutor.executeCommand(
      `git rev-list --left-right --count origin/${branch}...HEAD`,
      this.repoPath
    )
    if (countResult.success) {
      const [behindStr, aheadStr] = countResult.stdout.trim().split('\t')
      ahead = parseInt(aheadStr) || 0
      behind = parseInt(behindStr) || 0
    }

    const clean = staged.length === 0 && modified.length === 0 && untracked.length === 0 && conflicts.length === 0

    return { branch, ahead, behind, staged, modified, untracked, conflicts, clean }
  }

  /**
   * Get commit history
   */
  async getLog(limit: number = 20, branch?: string): Promise<GitLog> {
    const branchArg = branch || ''
    const result = await realExecutor.executeCommand(
      `git log --pretty=format:"%H|%h|%an|%ae|%at|%s" -n ${limit + 1} ${branchArg}`,
      this.repoPath
    )

    const commits: GitCommit[] = []
    
    if (result.success) {
      const lines = result.stdout.split('\n').filter(l => l.trim())
      
      for (const line of lines.slice(0, limit)) {
        const parts = line.split('|')
        if (parts.length >= 6) {
          commits.push({
            hash: parts[0],
            shortHash: parts[1],
            author: parts[2],
            email: parts[3],
            date: new Date(parseInt(parts[4]) * 1000),
            message: parts.slice(5).join('|')
          })
        }
      }
    }

    return {
      commits,
      total: commits.length,
      hasMore: result.success && result.stdout.split('\n').length > limit
    }
  }

  /**
   * Get diff
   */
  async getDiff(file?: string, staged: boolean = false): Promise<GitDiff[]> {
    const stagedFlag = staged ? '--staged' : ''
    const fileArg = file || ''
    const result = await realExecutor.executeCommand(
      `git diff ${stagedFlag} --numstat ${fileArg}`,
      this.repoPath
    )

    const diffs: GitDiff[] = []

    if (result.success) {
      const lines = result.stdout.split('\n').filter(l => l.trim())
      
      for (const line of lines) {
        const parts = line.split('\t')
        if (parts.length >= 3) {
          diffs.push({
            file: parts[2],
            additions: parseInt(parts[0]) || 0,
            deletions: parseInt(parts[1]) || 0,
            changes: '' // Would need another command to get actual diff
          })
        }
      }
    }

    return diffs
  }

  /**
   * Get last commit info
   */
  async getLastCommit(): Promise<GitCommit | null> {
    const result = await realExecutor.executeCommand(
      'git log -1 --pretty=format:"%H|%h|%an|%ae|%at|%s"',
      this.repoPath
    )

    if (!result.success) {
      return null
    }

    const parts = result.stdout.split('|')
    if (parts.length >= 6) {
      return {
        hash: parts[0],
        shortHash: parts[1],
        author: parts[2],
        email: parts[3],
        date: new Date(parseInt(parts[4]) * 1000),
        message: parts.slice(5).join('|')
      }
    }

    return null
  }

  // ============================================================================
  // ADVANCED OPERATIONS
  // ============================================================================

  /**
   * Stash changes
   */
  async stash(message?: string): Promise<ExecutionResult> {
    const msg = message ? `-m "${message}"` : ''
    return realExecutor.executeCommand(`git stash push ${msg}`, this.repoPath)
  }

  /**
   * Pop stashed changes
   */
  async stashPop(): Promise<ExecutionResult> {
    return realExecutor.executeCommand('git stash pop', this.repoPath)
  }

  /**
   * Cherry-pick a commit
   */
  async cherryPick(commitHash: string): Promise<ExecutionResult> {
    const result = await realExecutor.executeCommand(`git cherry-pick ${commitHash}`, this.repoPath)
    await this.logGitOperation('cherry-pick', result.success, { commitHash })
    return result
  }

  /**
   * Revert a commit
   */
  async revert(commitHash: string, noCommit: boolean = false): Promise<ExecutionResult> {
    const flag = noCommit ? '-n' : ''
    return realExecutor.executeCommand(`git revert ${flag} ${commitHash}`, this.repoPath)
  }

  /**
   * Reset to a commit
   */
  async reset(commitHash: string, hard: boolean = false): Promise<ExecutionResult> {
    const mode = hard ? '--hard' : '--soft'
    return realExecutor.executeCommand(`git reset ${mode} ${commitHash}`, this.repoPath)
  }

  /**
   * Check if repository is clean
   */
  async isClean(): Promise<boolean> {
    const status = await this.getStatus()
    return status.clean
  }

  /**
   * Check if there are uncommitted changes
   */
  async hasChanges(): Promise<boolean> {
    const status = await this.getStatus()
    return !status.clean
  }

  // ============================================================================
  // REMOTE OPERATIONS
  // ============================================================================

  /**
   * Add a remote
   */
  async addRemote(name: string, url: string): Promise<ExecutionResult> {
    return realExecutor.executeCommand(`git remote add ${name} ${url}`, this.repoPath)
  }

  /**
   * List remotes
   */
  async listRemotes(): Promise<{ name: string; url: string }[]> {
    const result = await realExecutor.executeCommand('git remote -v', this.repoPath)
    
    if (!result.success) {
      return []
    }

    const remotes: Map<string, string> = new Map()
    const lines = result.stdout.split('\n')

    for (const line of lines) {
      const match = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)$/)
      if (match) {
        remotes.set(match[1], match[2])
      }
    }

    return Array.from(remotes.entries()).map(([name, url]) => ({ name, url }))
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private async logGitOperation(operation: string, success: boolean, details?: Record<string, unknown>): Promise<void> {
    try {
      await db.log.create({
        data: {
          level: success ? 'INFO' : 'ERROR',
          message: `Git ${operation}: ${success ? 'success' : 'failed'}`,
          source: 'git',
          metadata: JSON.stringify(details || {})
        }
      })
    } catch {
      // Ignore logging errors
    }
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const gitManager = GitManager.getInstance()
export default GitManager
