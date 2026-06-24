import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { VersionController } from './version-controller';
import { CodeChange } from '../shared/types';

// =============================================================================
// Custom Arbitraries
// =============================================================================

/** Generates valid file paths */
const arbFilePath = fc
  .array(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')), {
      minLength: 1,
      maxLength: 10,
    }),
    { minLength: 1, maxLength: 4 }
  )
  .map((segments) => 'src/' + segments.join('/') + '.ts');

/** Generates file content strings */
const arbFileContent = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ\n0123456789'.split('')),
  { minLength: 1, maxLength: 200 }
);

/** Generates unique task IDs */
const arbTaskId = fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
  minLength: 4,
  maxLength: 12,
}).map((s) => 'task-' + s);

/** Generates unique agent IDs */
const arbAgentId = fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
  minLength: 4,
  maxLength: 8,
}).map((s) => 'agent-' + s);

/** Generates a valid unified diff with hunk header for a given line range */
function makeDiff(startLine: number, lineCount: number, content: string): string {
  return `@@ -${startLine},${lineCount} +${startLine},${lineCount} @@\n+${content}`;
}

/** Generates a CodeChange for a given file path with specific line range */
function arbCodeChangeForFile(
  filePath: string,
  agentId: string,
  taskId: string,
  startLine: number,
  lineCount: number
): fc.Arbitrary<CodeChange> {
  return arbFileContent.map((content) => ({
    filePath,
    changeType: 'modify' as const,
    diff: makeDiff(startLine, lineCount, content),
    agentId,
    taskId,
  }));
}

/** Generates a CodeChange object with a proper unified diff */
const arbCodeChange = fc.record({
  filePath: arbFilePath,
  changeType: fc.constantFrom('create' as const, 'modify' as const),
  diff: fc.tuple(
    fc.integer({ min: 1, max: 50 }),
    fc.integer({ min: 1, max: 10 }),
    arbFileContent
  ).map(([start, count, content]) => makeDiff(start, count, content)),
  agentId: arbAgentId,
  taskId: arbTaskId,
});

// =============================================================================
// Property Tests
// =============================================================================

describe('VersionController - Property Tests', () => {
  // Feature: autonomous-coding-agent, Property 30: Checkpoint captures all affected files
  describe('Property 30: Checkpoint captures all affected files', () => {
    it('checkpoint SHALL contain file snapshots for every affected file with pre-modification content', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbTaskId,
          fc.array(fc.tuple(arbFilePath, arbFileContent), { minLength: 1, maxLength: 10 })
            .map((pairs) => {
              // Deduplicate file paths
              const seen = new Set<string>();
              return pairs.filter(([path]) => {
                if (seen.has(path)) return false;
                seen.add(path);
                return true;
              });
            })
            .filter((pairs) => pairs.length > 0),
          async (taskId, filePairs) => {
            const vc = new VersionController();

            // Set up initial file contents (the pre-modification state)
            for (const [filePath, content] of filePairs) {
              vc.setFileContent(filePath, content);
            }

            const affectedFiles = filePairs.map(([path]) => path);

            // Create checkpoint for the task
            const checkpoint = await vc.createCheckpoint(taskId, affectedFiles);

            // Verify: checkpoint contains snapshots for every affected file
            expect(checkpoint.fileSnapshots.length).toBe(affectedFiles.length);

            const snapshotPaths = checkpoint.fileSnapshots.map((s) => s.filePath);
            for (const filePath of affectedFiles) {
              expect(snapshotPaths).toContain(filePath);
            }

            // Verify: each snapshot's content matches the file's pre-modification state
            for (const [filePath, originalContent] of filePairs) {
              const snapshot = checkpoint.fileSnapshots.find((s) => s.filePath === filePath);
              expect(snapshot).toBeDefined();
              expect(snapshot!.content).toBe(originalContent);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    // **Validates: Requirements 11.1**
  });

  // Feature: autonomous-coding-agent, Property 31: Rollback isolation
  describe('Property 31: Rollback isolation', () => {
    it('rolling back task A SHALL preserve all of task B changes unchanged', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbTaskId,
          arbTaskId,
          arbAgentId,
          arbAgentId,
          // Generate two disjoint sets of file paths with content
          fc.tuple(
            fc.array(fc.tuple(arbFilePath, arbFileContent, arbFileContent), { minLength: 1, maxLength: 5 }),
            fc.array(fc.tuple(arbFilePath, arbFileContent, arbFileContent), { minLength: 1, maxLength: 5 })
          ).map(([setA, setB]) => {
            // Ensure file paths are disjoint between sets and unique within each set
            const allPaths = new Set<string>();
            const uniqueA = setA.filter(([path]) => {
              if (allPaths.has(path)) return false;
              allPaths.add(path);
              return true;
            });
            const uniqueB = setB.filter(([path]) => {
              if (allPaths.has(path)) return false;
              allPaths.add(path);
              return true;
            });
            return [uniqueA, uniqueB] as const;
          }).filter(([a, b]) => a.length > 0 && b.length > 0),
          async (taskIdA, taskIdB, agentA, agentB, [filesA, filesB]) => {
            // Ensure task IDs are different
            if (taskIdA === taskIdB) return;

            const vc = new VersionController();

            // Set up initial file state for both sets
            for (const [path, initialContent] of filesA) {
              vc.setFileContent(path, initialContent);
            }
            for (const [path, initialContent] of filesB) {
              vc.setFileContent(path, initialContent);
            }

            // Create checkpoint for task A
            const pathsA = filesA.map(([p]) => p);
            await vc.createCheckpoint(taskIdA, pathsA);

            // Task A commits changes to its files
            const changesA: CodeChange[] = filesA.map(([path, , newContent]) => ({
              filePath: path,
              changeType: 'modify' as const,
              diff: `@@ -1,1 +1,1 @@\n+${newContent}`,
              agentId: agentA,
              taskId: taskIdA,
            }));
            await vc.commitChanges(taskIdA, changesA, 'Task A changes');

            // Create checkpoint for task B
            const pathsB = filesB.map(([p]) => p);
            await vc.createCheckpoint(taskIdB, pathsB);

            // Task B commits changes to its files
            const changesB: CodeChange[] = filesB.map(([path, , newContent]) => ({
              filePath: path,
              changeType: 'modify' as const,
              diff: `@@ -1,1 +1,1 @@\n+${newContent}`,
              agentId: agentB,
              taskId: taskIdB,
            }));
            await vc.commitChanges(taskIdB, changesB, 'Task B changes');

            // Record task B's file contents after commit (before rollback of A)
            const taskBContentsBeforeRollback = new Map<string, string>();
            for (const [path] of filesB) {
              taskBContentsBeforeRollback.set(path, vc.getFileContent(path) || '');
            }

            // Roll back task A
            const result = await vc.rollback(taskIdA);
            expect(result.success).toBe(true);

            // Verify: task B's files are completely unchanged
            for (const [path] of filesB) {
              const contentAfterRollback = vc.getFileContent(path);
              const contentBeforeRollback = taskBContentsBeforeRollback.get(path);
              expect(contentAfterRollback).toBe(contentBeforeRollback);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    // **Validates: Requirements 11.3**
  });

  // Feature: autonomous-coding-agent, Property 32: Merge conflict proactive detection
  describe('Property 32: Merge conflict proactive detection', () => {
    it('overlapping line range changes from different agents SHALL be detected as conflicts', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbFilePath,
          arbAgentId,
          arbAgentId,
          arbTaskId,
          arbTaskId,
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 1, max: 10 }),
          arbFileContent,
          arbFileContent,
          async (filePath, agentA, agentB, taskA, taskB, startLine, lineCount, contentA, contentB) => {
            // Ensure agents and tasks are distinct
            if (agentA === agentB) return;
            if (taskA === taskB) return;

            const vc = new VersionController();

            // Create two sets of changes from different agents that modify
            // overlapping line ranges in the same file
            const changesFromAgentA: CodeChange[] = [
              {
                filePath,
                changeType: 'modify',
                diff: makeDiff(startLine, lineCount, contentA),
                agentId: agentA,
                taskId: taskA,
              },
            ];

            const changesFromAgentB: CodeChange[] = [
              {
                filePath,
                changeType: 'modify',
                diff: makeDiff(startLine, lineCount, contentB),
                agentId: agentB,
                taskId: taskB,
              },
            ];

            // Detect conflicts between the two change sets
            const conflicts = vc.detectConflicts([changesFromAgentA, changesFromAgentB]);

            // Verify: at least one MergeConflict is detected
            expect(conflicts.length).toBeGreaterThanOrEqual(1);

            // Verify: the conflict references the correct file
            const hasConflictForFile = conflicts.some((c) => c.filePath === filePath);
            expect(hasConflictForFile).toBe(true);

            // Verify: the conflict includes both agent IDs
            const conflict = conflicts.find((c) => c.filePath === filePath)!;
            expect(conflict.agentIds).toContain(agentA);
            expect(conflict.agentIds).toContain(agentB);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('partially overlapping line ranges SHALL also be detected as conflicts', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbFilePath,
          arbAgentId,
          arbAgentId,
          arbTaskId,
          arbTaskId,
          fc.integer({ min: 1, max: 40 }),
          fc.integer({ min: 3, max: 15 }),
          fc.integer({ min: 1, max: 5 }),
          arbFileContent,
          arbFileContent,
          async (filePath, agentA, agentB, taskA, taskB, startLineA, lineCountA, overlap, contentA, contentB) => {
            if (agentA === agentB) return;
            if (taskA === taskB) return;

            const vc = new VersionController();

            // Agent B starts partway through Agent A's range (partially overlapping)
            const startLineB = startLineA + lineCountA - overlap;
            const lineCountB = overlap + 3;

            // Only test when there's genuine overlap
            const endA = startLineA + lineCountA - 1;
            const endB = startLineB + lineCountB - 1;
            if (startLineB > endA) return; // no overlap, skip

            const changesA: CodeChange[] = [
              {
                filePath,
                changeType: 'modify',
                diff: makeDiff(startLineA, lineCountA, contentA),
                agentId: agentA,
                taskId: taskA,
              },
            ];

            const changesB: CodeChange[] = [
              {
                filePath,
                changeType: 'modify',
                diff: makeDiff(startLineB, lineCountB, contentB),
                agentId: agentB,
                taskId: taskB,
              },
            ];

            const conflicts = vc.detectConflicts([changesA, changesB]);

            // Verify: at least one conflict is detected for the overlapping file
            expect(conflicts.length).toBeGreaterThanOrEqual(1);
            expect(conflicts.some((c) => c.filePath === filePath)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    // **Validates: Requirements 11.5**
  });
});
