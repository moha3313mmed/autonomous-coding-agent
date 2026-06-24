// =============================================================================
// Reasoning Engine - Interface Layer
// =============================================================================
// Produces structured reasoning chains with problem decomposition, constraint
// identification, alternative evaluation, and decision justification.
// Implements conflict resolution maximizing project goal alignment.
// =============================================================================

import { Constraint } from '../shared/types';

// =============================================================================
// Supporting Interfaces
// =============================================================================

export interface ReasoningProblem {
  description: string;
  constraints: Constraint[];
  context: string;
  projectGoals: string[];
}

export interface ReasoningChain {
  id: string;
  steps: ReasoningStep[];
  conclusion: string;
  confidenceScore: number;
  checkpoints: ReasoningCheckpoint[];
}

export interface ReasoningStep {
  stepIndex: number;
  type: 'decomposition' | 'constraint_identification' | 'alternative_evaluation' | 'decision_justification';
  content: string;
  parentPremise: string | null;
  timestamp: number;
}

export interface ReasoningCheckpoint {
  afterStep: number;
  currentSubProblem: string;
  resolvedConstraints: string[];
  unresolvedConstraints: string[];
  conclusionsSoFar: string[];
}

export interface ReasoningTrace {
  decisionId: string;
  chain: ReasoningChain;
  createdAt: number;
}

export interface ConflictResolution {
  selectedResolution: string;
  tradeOffs: Array<{ constraint: string; impact: string; goalsAffected: string[] }>;
  goalsSatisfied: number;
  totalGoals: number;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_STEPS = 50;
const TIMEOUT_MS = 60_000;
const CHECKPOINT_THRESHOLD = 10;

// =============================================================================
// ReasoningEngine Class
// =============================================================================

export class ReasoningEngine {
  private traces: Map<string, ReasoningTrace> = new Map();

  /**
   * Produces a structured reasoning chain with problem decomposition,
   * constraint identification, alternative evaluation, and decision justification.
   *
   * Safety limits: max 50 steps, 60 second timeout -> return partial result.
   * Checkpoint insertion: when steps exceed 10, insert a checkpoint summarizing state.
   * Confidence score 0-1 based on: number of alternatives evaluated, constraint coverage, goal alignment.
   */
  async generateReasoningChain(problem: ReasoningProblem): Promise<ReasoningChain> {
    const startTime = Date.now();
    const chainId = this.generateId();
    const steps: ReasoningStep[] = [];
    const checkpoints: ReasoningCheckpoint[] = [];
    const resolvedConstraints: string[] = [];
    const unresolvedConstraints = problem.constraints.map(c => c.description);

    // Step 1: Problem decomposition
    const decompositionStep = this.createStep(
      steps.length,
      'decomposition',
      `Decomposing problem: ${problem.description}. Context: ${problem.context}. Sub-problems identified from ${problem.constraints.length} constraints and ${problem.projectGoals.length} goals.`,
      null
    );
    steps.push(decompositionStep);

    if (this.isTimedOut(startTime) || steps.length >= MAX_STEPS) {
      return this.buildChain(chainId, steps, checkpoints, problem, resolvedConstraints);
    }

    // Step 2: Constraint identification
    for (const constraint of problem.constraints) {
      if (this.isTimedOut(startTime) || steps.length >= MAX_STEPS) break;

      const constraintStep = this.createStep(
        steps.length,
        'constraint_identification',
        `Identified constraint: "${constraint.description}" (type: ${constraint.type}, priority: ${constraint.priority}, enforceable: ${constraint.enforceable})`,
        decompositionStep.content
      );
      steps.push(constraintStep);
      resolvedConstraints.push(constraint.description);
      unresolvedConstraints.splice(unresolvedConstraints.indexOf(constraint.description), 1);

      // Insert checkpoint if steps exceed threshold
      if (steps.length > CHECKPOINT_THRESHOLD && steps.length % CHECKPOINT_THRESHOLD === 1) {
        checkpoints.push(this.createCheckpoint(steps.length - 1, problem, resolvedConstraints, unresolvedConstraints));
      }
    }

    if (this.isTimedOut(startTime) || steps.length >= MAX_STEPS) {
      return this.buildChain(chainId, steps, checkpoints, problem, resolvedConstraints);
    }

    // Step 3: Alternative evaluation
    const alternatives = this.generateAlternatives(problem);
    for (const alternative of alternatives) {
      if (this.isTimedOut(startTime) || steps.length >= MAX_STEPS) break;

      const evalStep = this.createStep(
        steps.length,
        'alternative_evaluation',
        `Evaluating alternative: "${alternative.description}". Goals satisfied: ${alternative.goalsSatisfied}/${problem.projectGoals.length}. Trade-offs: ${alternative.tradeOffs.join(', ') || 'none'}`,
        steps[steps.length - 1].content
      );
      steps.push(evalStep);

      // Insert checkpoint if steps exceed threshold
      if (steps.length > CHECKPOINT_THRESHOLD && steps.length % CHECKPOINT_THRESHOLD === 1) {
        checkpoints.push(this.createCheckpoint(steps.length - 1, problem, resolvedConstraints, unresolvedConstraints));
      }
    }

    if (this.isTimedOut(startTime) || steps.length >= MAX_STEPS) {
      return this.buildChain(chainId, steps, checkpoints, problem, resolvedConstraints);
    }

    // Step 4: Decision justification
    const bestAlternative = alternatives.length > 0
      ? alternatives.reduce((best, alt) => alt.goalsSatisfied > best.goalsSatisfied ? alt : best, alternatives[0])
      : { description: 'Default approach based on constraints', goalsSatisfied: 0, tradeOffs: [] };

    const justificationStep = this.createStep(
      steps.length,
      'decision_justification',
      `Decision: Selected "${bestAlternative.description}" as it satisfies ${bestAlternative.goalsSatisfied}/${problem.projectGoals.length} project goals with acceptable trade-offs.`,
      steps[steps.length - 1].content
    );
    steps.push(justificationStep);

    // Final checkpoint if needed
    if (steps.length > CHECKPOINT_THRESHOLD && checkpoints.length === 0) {
      checkpoints.push(this.createCheckpoint(steps.length - 1, problem, resolvedConstraints, unresolvedConstraints));
    }

    const chain = this.buildChain(chainId, steps, checkpoints, problem, resolvedConstraints);

    // Store trace for auditability
    const trace: ReasoningTrace = {
      decisionId: chainId,
      chain,
      createdAt: Date.now(),
    };
    this.traces.set(chainId, trace);

    return chain;
  }

  /**
   * Enumerates trade-offs and selects resolution maximizing alignment with stated goals.
   * Conflict resolution: rank by number of project goals satisfied, select max.
   */
  resolveConflicts(constraints: Constraint[], projectGoals: string[]): ConflictResolution {
    if (constraints.length === 0) {
      return {
        selectedResolution: 'No conflicts to resolve',
        tradeOffs: [],
        goalsSatisfied: projectGoals.length,
        totalGoals: projectGoals.length,
      };
    }

    // Generate possible resolutions by prioritizing different constraints
    const resolutions = constraints.map(constraint => {
      const goalsAffected = this.findAffectedGoals(constraint, projectGoals);
      const otherConstraints = constraints.filter(c => c !== constraint);
      const tradeOffs = otherConstraints.map(other => ({
        constraint: other.description,
        impact: `Deprioritized in favor of "${constraint.description}"`,
        goalsAffected: this.findAffectedGoals(other, projectGoals),
      }));

      // Count how many goals are satisfied by prioritizing this constraint
      const goalsSatisfied = projectGoals.filter(goal =>
        this.isGoalSatisfiedByConstraint(goal, constraint, otherConstraints)
      ).length;

      return {
        constraint,
        resolution: `Prioritize "${constraint.description}" (${constraint.priority} priority, ${constraint.type} type)`,
        tradeOffs,
        goalsSatisfied,
      };
    });

    // Select resolution that maximizes project goals satisfied
    const bestResolution = resolutions.reduce((best, current) =>
      current.goalsSatisfied > best.goalsSatisfied ? current : best,
      resolutions[0]
    );

    return {
      selectedResolution: bestResolution.resolution,
      tradeOffs: bestResolution.tradeOffs,
      goalsSatisfied: bestResolution.goalsSatisfied,
      totalGoals: projectGoals.length,
    };
  }

  /**
   * Retrieves auditable trace for a past decision.
   */
  getReasoningTrace(decisionId: string): ReasoningTrace | null {
    return this.traces.get(decisionId) ?? null;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private createStep(
    stepIndex: number,
    type: ReasoningStep['type'],
    content: string,
    parentPremise: string | null
  ): ReasoningStep {
    return {
      stepIndex,
      type,
      content,
      parentPremise,
      timestamp: Date.now(),
    };
  }

  private createCheckpoint(
    afterStep: number,
    problem: ReasoningProblem,
    resolvedConstraints: string[],
    unresolvedConstraints: string[]
  ): ReasoningCheckpoint {
    return {
      afterStep,
      currentSubProblem: problem.description,
      resolvedConstraints: [...resolvedConstraints],
      unresolvedConstraints: [...unresolvedConstraints],
      conclusionsSoFar: resolvedConstraints.map(c => `Resolved: ${c}`),
    };
  }

  private buildChain(
    id: string,
    steps: ReasoningStep[],
    checkpoints: ReasoningCheckpoint[],
    problem: ReasoningProblem,
    resolvedConstraints: string[]
  ): ReasoningChain {
    const alternativesEvaluated = steps.filter(s => s.type === 'alternative_evaluation').length;
    const constraintsCovered = resolvedConstraints.length;
    const totalConstraints = problem.constraints.length;
    const goalAlignment = problem.projectGoals.length > 0
      ? Math.min(alternativesEvaluated / Math.max(problem.projectGoals.length, 1), 1)
      : 0;

    // Confidence score 0-1 based on: alternatives evaluated, constraint coverage, goal alignment
    const constraintCoverage = totalConstraints > 0 ? constraintsCovered / totalConstraints : 1;
    const alternativeScore = Math.min(alternativesEvaluated / 3, 1); // normalize to max 3 alternatives
    const confidenceScore = Math.min(
      (constraintCoverage * 0.4 + alternativeScore * 0.3 + goalAlignment * 0.3),
      1
    );

    const conclusion = steps.length > 0
      ? steps[steps.length - 1].content
      : 'No conclusion reached (empty reasoning chain)';

    return {
      id,
      steps,
      conclusion,
      confidenceScore: Math.round(confidenceScore * 100) / 100,
      checkpoints,
    };
  }

  private generateAlternatives(problem: ReasoningProblem): Array<{
    description: string;
    goalsSatisfied: number;
    tradeOffs: string[];
  }> {
    // Generate alternatives based on project goals and constraints
    const alternatives: Array<{
      description: string;
      goalsSatisfied: number;
      tradeOffs: string[];
    }> = [];

    if (problem.projectGoals.length === 0) {
      alternatives.push({
        description: 'Apply constraints directly without trade-offs',
        goalsSatisfied: 0,
        tradeOffs: [],
      });
      return alternatives;
    }

    // Alternative 1: Prioritize all enforceable constraints
    const enforceableConstraints = problem.constraints.filter(c => c.enforceable);
    alternatives.push({
      description: `Enforce all ${enforceableConstraints.length} enforceable constraints strictly`,
      goalsSatisfied: Math.min(
        Math.ceil(problem.projectGoals.length * (enforceableConstraints.length / Math.max(problem.constraints.length, 1))),
        problem.projectGoals.length
      ),
      tradeOffs: problem.constraints.filter(c => !c.enforceable).map(c => c.description),
    });

    // Alternative 2: Balance constraints by priority
    const highPriorityConstraints = problem.constraints.filter(c => c.priority === 'critical' || c.priority === 'high');
    alternatives.push({
      description: `Prioritize ${highPriorityConstraints.length} high-priority constraints, relax low-priority ones`,
      goalsSatisfied: Math.min(
        Math.ceil(problem.projectGoals.length * (highPriorityConstraints.length / Math.max(problem.constraints.length, 1))),
        problem.projectGoals.length
      ),
      tradeOffs: problem.constraints.filter(c => c.priority === 'low' || c.priority === 'medium').map(c => c.description),
    });

    // Alternative 3: Maximize goal coverage
    alternatives.push({
      description: 'Maximize project goal coverage with selective constraint relaxation',
      goalsSatisfied: problem.projectGoals.length,
      tradeOffs: problem.constraints.filter(c => c.priority === 'low').map(c => c.description),
    });

    return alternatives;
  }

  private findAffectedGoals(constraint: Constraint, projectGoals: string[]): string[] {
    // Determine which goals are affected by this constraint
    // Use a simple heuristic: constraints affect goals that share keywords
    return projectGoals.filter(goal => {
      const goalWords = goal.toLowerCase().split(/\s+/);
      const constraintWords = constraint.description.toLowerCase().split(/\s+/);
      return goalWords.some(word => constraintWords.includes(word) && word.length > 3);
    });
  }

  private isGoalSatisfiedByConstraint(
    goal: string,
    prioritizedConstraint: Constraint,
    otherConstraints: Constraint[]
  ): boolean {
    // A goal is satisfied if the prioritized constraint supports it
    // or if no other constraint conflicts with it
    const goalWords = goal.toLowerCase().split(/\s+/);
    const constraintWords = prioritizedConstraint.description.toLowerCase().split(/\s+/);
    const directMatch = goalWords.some(word => constraintWords.includes(word) && word.length > 3);

    if (directMatch) return true;

    // If no direct conflict from other constraints, assume satisfied
    const hasConflict = otherConstraints.some(c =>
      c.priority === 'critical' && !c.enforceable
    );

    return !hasConflict;
  }

  private isTimedOut(startTime: number): boolean {
    return Date.now() - startTime >= TIMEOUT_MS;
  }

  private generateId(): string {
    return `reasoning-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}
