import {
  Checkpoint,
  CodeChange,
  RollbackResult,
  MergeConflict,
  FileSnapshot,
  Commit,
  Branch,
  MergeResult,
} from '../shared/types';

/**
 * Generates a simple hash for file content.
 * Uses a basic string hashing algorithm for snapshot identification.
 */
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `hash_${Math.abs(hash).toString(16)}`;
}

/**
 * Parses a unified diff string to extract affected line ranges.
 * Returns an array of { startLine, endLine } objects.
 */
function parseDiffLineRanges(diff: string): Array<{ startLine: number; endLine: number }> {
  const ranges: Array<{ startLine: number; endLine: number }> = [];
  const hunkHeaderRegex = /@@\s*-(\d+)(?:,(\d+))?\s*\+(\d+)(?:,(\d+))?\s*@@/g;

  let match: RegExpExecArray | null;
  while ((match = hunkHeaderRegex.exec(diff)) !== null) {
    const startLine = parseInt(match[3], 10);
    const lineCount = match[4] !== undefined ? parseInt(match[4], 10) : 1;
    const endLine = startLine + Math.max(lineCount - 1, 0);
    ranges.push({ startLine, endLine });
  }

  // If no hunk headers found, treat entire diff as a single change at line 1
  if (ranges.length === 0 && diff.trim().length > 0) {
    const lineCount = diff.split('\n').length;
    ranges.push({ startLine: 1, endLine: lineCount });
  }

  return ranges;
}

/**
 * Checks if two line ranges overlap.
 */
function rangesOverlap(
  a: { startLine: number; endLine: number },
  b: { startLine: number; endLine: number }
): boolean {
  return a.startLine <= b.endLine && b.startLine <= a.endLine;
}

/** Maximum number of checkpoints stored per project */
const MAX_CHECKPOINTS = 100;

/**
 * VersionController manages code versioning, checkpoints, branching,
 * and conflict detection for the autonomous coding agent system.
 *
 * It provides:
 * - Checkpoint creation before task modifications
 * - Commit creation with descriptive messages
 * - Rollback of specific tasks while preserving others
 * - Merge conflict detection across concurrent agent changes
 * - Branch isolation and merging
 */
export class VersionController {
  /** taskId -> checkpoint */
  private checkpoints: Map<string, Checkpoint> = new Map();

  /** commitId -> commit */
  private commits: Map<string, Commit> = new Map();

  /** branchName -> branch */
  private branches: Map<string, Branch> = new Map();

  /** filePath -> current content (simulated file system) */
  private fileSystem: Map<string, string> = new Map();

  /** Ordered list of checkpoint IDs for eviction (oldest first) */
  private checkpointOrder: string[] = [];

  /** Counter for generating unique IDs */
  private idCounter = 0;

  /** Per-branch file systems for branch isolation */
  private branchFileSystems: Map<string, Map<string, string>> = new Map();

  /** Per-branch commit histories */
  private branchCommits: Map<string, string[]> = new Map();

  constructor() {
    // Initialize with a default 'main' branch
    const mainBranch: Branch = {
      name: 'main',
      headCommitId: '',
      baseBranch: '',
      createdAt: Date.now(),
      status: 'active',
    };
    this.branches.set('main', mainBranch);
    this.branchFileSystems.set('main', this.fileSystem);
    this.branchCommits.set('main', []);
  }

  /**
   * Creates a checkpoint capturing the current state of affected files before modification.
   * Stores file content as snapshots for potential rollback.
   *
   * Enforces a max of 100 checkpoints; discards oldest when exceeded.
   */
  async createCheckpoint(taskId: string, affectedFiles: string[]): Promise<Checkpoint> {
    // Evict oldest checkpoint if at capacity
    if (this.checkpoints.size >= MAX_CHECKPOINTS) {
      const oldestTaskId = this.checkpointOrder.shift();
      if (oldestTaskId) {
        this.checkpoints.delete(oldestTaskId);
      }
    }

    const now = Date.now();
    const fileSnapshots: FileSnapshot[] = affectedFiles.map((filePath) => {
      const content = this.fileSystem.get(filePath) || '';
      return {
        filePath,
        content,
        hash: hashContent(content),
        timestamp: now,
      };
    });

    const checkpoint: Checkpoint = {
      id: this.generateId('chk'),
      taskId,
      timestamp: now,
      fileSnapshots,
      branchName: 'main',
    };

    this.checkpoints.set(taskId, checkpoint);
    this.checkpointOrder.push(taskId);

    return checkpoint;
  }

  /**
   * Creates a commit with a descriptive message including the task reference and reasoning.
   * Records all code changes and updates the branch head.
   */
  async commitChanges(taskId: string, changes: CodeChange[], message: string): Promise<Commit> {
    const commitId = this.generateId('commit');
    const branchName = 'main';
    const branch = this.branches.get(branchName)!;

    const commit: Commit = {
      id: commitId,
      message: `[${taskId}] ${message}`,
      changes,
      author: changes.length > 0 ? changes[0].agentId : 'system',
      timestamp: Date.now(),
      parentId: branch.headCommitId || null,
    };

    // Apply changes to the file system
    for (const change of changes) {
      switch (change.changeType) {
        case 'create':
        case 'modify':
          // For create/modify, we simulate by storing the diff as new content
          // In a real system, we'd apply the diff to existing content
          const existingContent = this.fileSystem.get(change.filePath) || '';
          const newContent = this.applyDiff(existingContent, change.diff);
          this.fileSystem.set(change.filePath, newContent);
          break;
        case 'delete':
          this.fileSystem.delete(change.filePath);
          break;
        case 'rename':
          // For rename, diff contains "oldPath -> newPath" format
          const content = this.fileSystem.get(change.filePath) || '';
          this.fileSystem.delete(change.filePath);
          // Store under new path extracted from diff
          const renameParts = change.diff.split(' -> ');
          if (renameParts.length === 2) {
            this.fileSystem.set(renameParts[1].trim(), content);
          }
          break;
      }
    }

    // Update branch head
    branch.headCommitId = commitId;
    this.commits.set(commitId, commit);

    // Track commit in branch history
    const branchHistory = this.branchCommits.get(branchName);
    if (branchHistory) {
      branchHistory.push(commitId);
    }

    return commit;
  }

  /**
   * Reverts changes from a specific task while preserving other tasks' changes.
   * Fails with conflictsEncountered if there are overlapping modifications from concurrent tasks.
   */
  async rollback(taskId: string): Promise<RollbackResult> {
    const checkpoint = this.checkpoints.get(taskId);

    if (!checkpoint) {
      return {
        success: false,
        revertedFiles: [],
        preservedFiles: [],
        conflictsEncountered: [],
      };
    }

    // Find changes made by this task
    const taskCommits = this.findCommitsForTask(taskId);
    const taskChangedFiles = new Set<string>();
    for (const commit of taskCommits) {
      for (const change of commit.changes) {
        taskChangedFiles.add(change.filePath);
      }
    }

    // Check for overlapping modifications from other tasks
    const conflicts: MergeConflict[] = [];
    const otherTaskCommits = this.findCommitsAfterCheckpoint(checkpoint.timestamp, taskId);

    for (const otherCommit of otherTaskCommits) {
      for (const otherChange of otherCommit.changes) {
        if (taskChangedFiles.has(otherChange.filePath)) {
          // Check if actual line ranges overlap
          const taskChangesForFile = this.getTaskChangesForFile(taskId, otherChange.filePath);
          for (const taskChange of taskChangesForFile) {
            const taskRanges = parseDiffLineRanges(taskChange.diff);
            const otherRanges = parseDiffLineRanges(otherChange.diff);

            for (const taskRange of taskRanges) {
              for (const otherRange of otherRanges) {
                if (rangesOverlap(taskRange, otherRange)) {
                  conflicts.push({
                    filePath: otherChange.filePath,
                    conflictRegion: {
                      startLine: Math.min(taskRange.startLine, otherRange.startLine),
                      endLine: Math.max(taskRange.endLine, otherRange.endLine),
                    },
                    ourChange: taskChange.diff,
                    theirChange: otherChange.diff,
                    agentIds: [taskChange.agentId, otherChange.agentId],
                  });
                }
              }
            }
          }
        }
      }
    }

    // If conflicts exist, abort the rollback
    if (conflicts.length > 0) {
      return {
        success: false,
        revertedFiles: [],
        preservedFiles: [...taskChangedFiles],
        conflictsEncountered: conflicts,
      };
    }

    // No conflicts — proceed with rollback
    const revertedFiles: string[] = [];
    const preservedFiles: string[] = [];

    for (const snapshot of checkpoint.fileSnapshots) {
      if (taskChangedFiles.has(snapshot.filePath)) {
        // Restore file to checkpoint state
        this.fileSystem.set(snapshot.filePath, snapshot.content);
        revertedFiles.push(snapshot.filePath);
      } else {
        preservedFiles.push(snapshot.filePath);
      }
    }

    // Remove the checkpoint after rollback
    this.checkpoints.delete(taskId);
    this.checkpointOrder = this.checkpointOrder.filter((id) => id !== taskId);

    return {
      success: true,
      revertedFiles,
      preservedFiles,
      conflictsEncountered: [],
    };
  }

  /**
   * Takes arrays of changes from different agents and detects overlapping
   * line ranges in the same files. Each element in the outer array represents
   * changes from a different agent.
   */
  detectConflicts(changes: CodeChange[][]): MergeConflict[] {
    const conflicts: MergeConflict[] = [];

    // Compare each pair of change sets
    for (let i = 0; i < changes.length; i++) {
      for (let j = i + 1; j < changes.length; j++) {
        const setA = changes[i];
        const setB = changes[j];

        // Group changes by file path
        const fileChangesA = this.groupChangesByFile(setA);
        const fileChangesB = this.groupChangesByFile(setB);

        // Find overlapping files
        for (const [filePath, changesA] of fileChangesA) {
          const changesB = fileChangesB.get(filePath);
          if (!changesB) continue;

          // Check for overlapping line ranges
          for (const changeA of changesA) {
            const rangesA = parseDiffLineRanges(changeA.diff);
            for (const changeB of changesB) {
              const rangesB = parseDiffLineRanges(changeB.diff);

              for (const rangeA of rangesA) {
                for (const rangeB of rangesB) {
                  if (rangesOverlap(rangeA, rangeB)) {
                    conflicts.push({
                      filePath,
                      conflictRegion: {
                        startLine: Math.min(rangeA.startLine, rangeB.startLine),
                        endLine: Math.max(rangeA.endLine, rangeB.endLine),
                      },
                      ourChange: changeA.diff,
                      theirChange: changeB.diff,
                      agentIds: [changeA.agentId, changeB.agentId],
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Creates a new branch from a base branch.
   * The new branch starts with the same file system state as the base branch.
   */
  async createBranch(name: string, baseBranch: string): Promise<Branch> {
    const base = this.branches.get(baseBranch);
    if (!base) {
      throw new Error(`Base branch '${baseBranch}' does not exist`);
    }

    const branch: Branch = {
      name,
      headCommitId: base.headCommitId,
      baseBranch,
      createdAt: Date.now(),
      status: 'active',
    };

    this.branches.set(name, branch);

    // Create isolated file system for the branch (copy from base)
    const baseFs = this.branchFileSystems.get(baseBranch) || this.fileSystem;
    const branchFs = new Map(baseFs);
    this.branchFileSystems.set(name, branchFs);

    // Initialize branch commit history
    const baseHistory = this.branchCommits.get(baseBranch) || [];
    this.branchCommits.set(name, [...baseHistory]);

    return branch;
  }

  /**
   * Merges source branch into target branch.
   * Detects conflicts if both branches modified the same file regions.
   */
  async mergeBranch(source: string, target: string): Promise<MergeResult> {
    const sourceBranch = this.branches.get(source);
    const targetBranch = this.branches.get(target);

    if (!sourceBranch) {
      throw new Error(`Source branch '${source}' does not exist`);
    }
    if (!targetBranch) {
      throw new Error(`Target branch '${target}' does not exist`);
    }

    // Find commits unique to source (not in target)
    const sourceHistory = this.branchCommits.get(source) || [];
    const targetHistory = this.branchCommits.get(target) || [];
    const targetCommitSet = new Set(targetHistory);

    const uniqueSourceCommits = sourceHistory.filter((id) => !targetCommitSet.has(id));

    // Collect all changes from unique source commits
    const sourceChanges: CodeChange[] = [];
    for (const commitId of uniqueSourceCommits) {
      const commit = this.commits.get(commitId);
      if (commit) {
        sourceChanges.push(...commit.changes);
      }
    }

    // Collect changes in target since branch point
    const sourceHistorySet = new Set(sourceHistory);
    const uniqueTargetCommits = targetHistory.filter((id) => !sourceHistorySet.has(id));
    const targetChanges: CodeChange[] = [];
    for (const commitId of uniqueTargetCommits) {
      const commit = this.commits.get(commitId);
      if (commit) {
        targetChanges.push(...commit.changes);
      }
    }

    // Detect conflicts between source and target changes
    const conflicts = this.detectConflicts([sourceChanges, targetChanges]);

    if (conflicts.length > 0) {
      return {
        success: false,
        conflicts,
        filesModified: [],
      };
    }

    // Apply source changes to target file system
    const targetFs = this.branchFileSystems.get(target) || this.fileSystem;
    const filesModified: string[] = [];

    for (const change of sourceChanges) {
      switch (change.changeType) {
        case 'create':
        case 'modify': {
          const existing = targetFs.get(change.filePath) || '';
          const newContent = this.applyDiff(existing, change.diff);
          targetFs.set(change.filePath, newContent);
          filesModified.push(change.filePath);
          break;
        }
        case 'delete':
          targetFs.delete(change.filePath);
          filesModified.push(change.filePath);
          break;
        case 'rename': {
          const content = targetFs.get(change.filePath) || '';
          targetFs.delete(change.filePath);
          const parts = change.diff.split(' -> ');
          if (parts.length === 2) {
            targetFs.set(parts[1].trim(), content);
          }
          filesModified.push(change.filePath);
          break;
        }
      }
    }

    // Create merge commit
    const mergeCommitId = this.generateId('merge');
    const mergeCommit: Commit = {
      id: mergeCommitId,
      message: `Merge branch '${source}' into '${target}'`,
      changes: sourceChanges,
      author: 'system',
      timestamp: Date.now(),
      parentId: targetBranch.headCommitId || null,
    };

    this.commits.set(mergeCommitId, mergeCommit);
    targetBranch.headCommitId = mergeCommitId;

    // Update target branch commit history
    const updatedTargetHistory = this.branchCommits.get(target) || [];
    updatedTargetHistory.push(...uniqueSourceCommits, mergeCommitId);
    this.branchCommits.set(target, updatedTargetHistory);

    // Mark source branch as merged
    sourceBranch.status = 'merged';

    return {
      success: true,
      mergedCommitId: mergeCommitId,
      conflicts: [],
      filesModified: [...new Set(filesModified)],
    };
  }

  // =========================================================================
  // Public utility methods
  // =========================================================================

  /**
   * Sets file content in the simulated file system.
   * Used for testing and initial state setup.
   */
  setFileContent(filePath: string, content: string): void {
    this.fileSystem.set(filePath, content);
  }

  /**
   * Gets file content from the simulated file system.
   */
  getFileContent(filePath: string): string | undefined {
    return this.fileSystem.get(filePath);
  }

  /**
   * Returns the number of stored checkpoints.
   */
  getCheckpointCount(): number {
    return this.checkpoints.size;
  }

  /**
   * Retrieves a checkpoint by task ID.
   */
  getCheckpoint(taskId: string): Checkpoint | undefined {
    return this.checkpoints.get(taskId);
  }

  // =========================================================================
  // Private helper methods
  // =========================================================================

  /**
   * Applies a diff to existing content.
   * Simplified implementation: appends the diff content.
   * In a real system, this would parse and apply unified diff format.
   */
  private applyDiff(existingContent: string, diff: string): string {
    // Simple simulation: if diff contains +lines, add them
    const lines = diff.split('\n');
    const addedLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        addedLines.push(line.substring(1));
      }
    }

    if (addedLines.length > 0) {
      return existingContent
        ? existingContent + '\n' + addedLines.join('\n')
        : addedLines.join('\n');
    }

    // If no +lines found, just append the diff as content
    return existingContent ? existingContent + '\n' + diff : diff;
  }

  /**
   * Finds all commits associated with a specific task.
   */
  private findCommitsForTask(taskId: string): Commit[] {
    const taskCommits: Commit[] = [];
    for (const commit of this.commits.values()) {
      if (commit.changes.some((c) => c.taskId === taskId)) {
        taskCommits.push(commit);
      }
    }
    return taskCommits;
  }

  /**
   * Finds commits after a given timestamp that are NOT from the specified task.
   */
  private findCommitsAfterCheckpoint(timestamp: number, excludeTaskId: string): Commit[] {
    const results: Commit[] = [];
    for (const commit of this.commits.values()) {
      if (commit.timestamp >= timestamp) {
        const hasOtherTaskChanges = commit.changes.some((c) => c.taskId !== excludeTaskId);
        if (hasOtherTaskChanges) {
          results.push(commit);
        }
      }
    }
    return results;
  }

  /**
   * Gets all changes for a specific task and file.
   */
  private getTaskChangesForFile(taskId: string, filePath: string): CodeChange[] {
    const changes: CodeChange[] = [];
    for (const commit of this.commits.values()) {
      for (const change of commit.changes) {
        if (change.taskId === taskId && change.filePath === filePath) {
          changes.push(change);
        }
      }
    }
    return changes;
  }

  /**
   * Groups an array of code changes by file path.
   */
  private groupChangesByFile(changes: CodeChange[]): Map<string, CodeChange[]> {
    const grouped = new Map<string, CodeChange[]>();
    for (const change of changes) {
      const existing = grouped.get(change.filePath);
      if (existing) {
        existing.push(change);
      } else {
        grouped.set(change.filePath, [change]);
      }
    }
    return grouped;
  }

  /**
   * Generates a unique ID with the given prefix.
   */
  private generateId(prefix: string): string {
    this.idCounter++;
    return `${prefix}_${Date.now()}_${this.idCounter}`;
  }
}
