import {
  SkillModule,
  SkillQuery,
  SkillOutcome,
  SkillVersion,
  SearchCriteria,
  TaskRequirements,
  FailureAnalysis,
} from '../shared/types';

/**
 * SkillEngine manages reusable skill modules with indexing, versioning,
 * confidence tracking, and multi-criteria search capabilities.
 */
export class SkillEngine {
  /** Primary storage: skillId -> SkillModule */
  private skills: Map<string, SkillModule> = new Map();

  /** Index: category -> set of skillIds */
  private categoryIndex: Map<string, Set<string>> = new Map();

  /** Index: language -> set of skillIds */
  private languageIndex: Map<string, Set<string>> = new Map();

  /** Index: domain -> set of skillIds */
  private domainIndex: Map<string, Set<string>> = new Map();

  /** Tracks consecutive failure count per skill */
  private failureTracker: Map<string, number> = new Map();

  /** Set of deactivated skill IDs (excluded from search/find) */
  private deactivatedSkills: Set<string> = new Set();

  /**
   * Finds a skill matching the query using indexed retrieval.
   * Returns the highest-confidence matching skill or null.
   * Target: <500ms (easily achieved with in-memory indexes).
   */
  async findSkill(query: SkillQuery): Promise<SkillModule | null> {
    const minConfidence = query.minConfidence ?? 0.5;

    // Start with candidates from the category index
    const categoryCandidates = this.categoryIndex.get(query.taskCategory);
    if (!categoryCandidates || categoryCandidates.size === 0) {
      return null;
    }

    let candidateIds = new Set(categoryCandidates);

    // Narrow by language if specified
    if (query.language) {
      const languageCandidates = this.languageIndex.get(query.language);
      if (languageCandidates) {
        candidateIds = this.intersect(candidateIds, languageCandidates);
      } else {
        return null;
      }
    }

    // Narrow by domain if specified
    if (query.domain) {
      const domainCandidates = this.domainIndex.get(query.domain);
      if (domainCandidates) {
        candidateIds = this.intersect(candidateIds, domainCandidates);
      } else {
        return null;
      }
    }

    // Filter out deactivated skills and those below minConfidence
    let bestSkill: SkillModule | null = null;
    for (const id of candidateIds) {
      if (this.deactivatedSkills.has(id)) {
        continue;
      }
      const skill = this.skills.get(id);
      if (skill && skill.confidenceScore >= minConfidence) {
        if (!bestSkill || skill.confidenceScore > bestSkill.confidenceScore) {
          bestSkill = skill;
        }
      }
    }

    return bestSkill;
  }

  /**
   * Generates a new skill module from task requirements.
   * Initial confidence: 0.1, version: 1, usage count: 0.
   */
  async generateSkill(taskRequirements: TaskRequirements): Promise<SkillModule> {
    const id = this.generateId();
    const now = Date.now();

    const skill: SkillModule = {
      id,
      version: 1,
      name: this.deriveSkillName(taskRequirements),
      description: taskRequirements.taskDescription,
      categories: [taskRequirements.domain],
      programmingLanguages: [taskRequirements.targetLanguage],
      domainContexts: [taskRequirements.domain],
      solutionTemplate: this.generateTemplate(taskRequirements),
      confidenceScore: 0.1,
      usageCount: 0,
      successRate: 0,
      createdAt: now,
      updatedAt: now,
      versionHistory: [
        {
          version: 1,
          skillId: id,
          template: this.generateTemplate(taskRequirements),
          changelog: 'Initial skill generation',
          confidenceScore: 0.1,
          createdAt: now,
          refinementSource: 'auto',
        },
      ],
    };

    // Store and index
    this.skills.set(id, skill);
    this.indexSkill(skill);
    this.failureTracker.set(id, 0);

    return skill;
  }

  /**
   * Records usage of a skill and updates confidence.
   * On success: confidence += 0.1 (capped at 1.0), usage count incremented.
   * On failure: confidence -= 0.2 (floor at 0.0), flag for refinement.
   * Deactivate if confidence hits 0 after 5+ consecutive failures.
   */
  async recordUsage(skillId: string, outcome: SkillOutcome): Promise<void> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    skill.usageCount += 1;
    skill.updatedAt = Date.now();

    if (outcome.success) {
      // Success: increment confidence, reset consecutive failures
      skill.confidenceScore = Math.min(1.0, skill.confidenceScore + 0.1);
      this.failureTracker.set(skillId, 0);
    } else {
      // Failure: decrement confidence, increment consecutive failures
      skill.confidenceScore = Math.max(0.0, skill.confidenceScore - 0.2);
      const consecutiveFailures = (this.failureTracker.get(skillId) ?? 0) + 1;
      this.failureTracker.set(skillId, consecutiveFailures);

      // Deactivate if confidence is 0 AND 5+ consecutive failures
      if (skill.confidenceScore === 0.0 && consecutiveFailures >= 5) {
        this.deactivatedSkills.add(skillId);
      }
    }

    // Update success rate
    this.updateSuccessRate(skill, outcome.success);
  }

  /**
   * Refines a skill based on failure analysis.
   * Creates a new version with incremented version number.
   * Resets consecutive failure count.
   */
  async refineSkill(skillId: string, failureAnalysis: FailureAnalysis): Promise<SkillModule> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    const now = Date.now();
    const newVersion = skill.version + 1;

    // Create improved template incorporating failure analysis
    const improvedTemplate = this.incorporateFailureAnalysis(
      skill.solutionTemplate,
      failureAnalysis
    );

    // Create version history entry
    const versionEntry: SkillVersion = {
      version: newVersion,
      skillId,
      template: improvedTemplate,
      changelog: `Refined based on failure analysis: ${failureAnalysis.rootCause}. Improvement: ${failureAnalysis.suggestedImprovement}`,
      confidenceScore: skill.confidenceScore,
      createdAt: now,
      refinementSource: 'failure_analysis',
    };

    // Update skill
    skill.version = newVersion;
    skill.solutionTemplate = improvedTemplate;
    skill.updatedAt = now;
    skill.versionHistory.push(versionEntry);

    // Reset consecutive failure count
    this.failureTracker.set(skillId, 0);

    return skill;
  }

  /**
   * Searches skills by multiple criteria with filtering.
   * Supports categories, languages, domains, minConfidence, minSuccessRate, and limit.
   */
  async searchSkills(criteria: SearchCriteria): Promise<SkillModule[]> {
    let candidateIds: Set<string> | null = null;

    // Gather candidates from category index
    if (criteria.categories && criteria.categories.length > 0) {
      const categoryIds = new Set<string>();
      for (const category of criteria.categories) {
        const ids = this.categoryIndex.get(category);
        if (ids) {
          for (const id of ids) {
            categoryIds.add(id);
          }
        }
      }
      candidateIds = categoryIds;
    }

    // Gather candidates from language index
    if (criteria.languages && criteria.languages.length > 0) {
      const languageIds = new Set<string>();
      for (const language of criteria.languages) {
        const ids = this.languageIndex.get(language);
        if (ids) {
          for (const id of ids) {
            languageIds.add(id);
          }
        }
      }
      candidateIds = candidateIds ? this.intersect(candidateIds, languageIds) : languageIds;
    }

    // Gather candidates from domain index
    if (criteria.domains && criteria.domains.length > 0) {
      const domainIds = new Set<string>();
      for (const domain of criteria.domains) {
        const ids = this.domainIndex.get(domain);
        if (ids) {
          for (const id of ids) {
            domainIds.add(id);
          }
        }
      }
      candidateIds = candidateIds ? this.intersect(candidateIds, domainIds) : domainIds;
    }

    // If no index criteria provided, consider all skills
    if (candidateIds === null) {
      candidateIds = new Set(this.skills.keys());
    }

    // Filter and collect results
    const results: SkillModule[] = [];
    for (const id of candidateIds) {
      if (this.deactivatedSkills.has(id)) {
        continue;
      }

      const skill = this.skills.get(id);
      if (!skill) {
        continue;
      }

      // Apply minConfidence filter
      if (criteria.minConfidence !== undefined && skill.confidenceScore < criteria.minConfidence) {
        continue;
      }

      // Apply minSuccessRate filter
      if (criteria.minSuccessRate !== undefined && skill.successRate < criteria.minSuccessRate) {
        continue;
      }

      results.push(skill);
    }

    // Sort by confidence (highest first)
    results.sort((a, b) => b.confidenceScore - a.confidenceScore);

    // Apply limit
    if (criteria.limit !== undefined && criteria.limit > 0) {
      return results.slice(0, criteria.limit);
    }

    return results;
  }

  // =========================================================================
  // Private Helper Methods
  // =========================================================================

  /** Intersects two sets, returning elements present in both */
  private intersect(setA: Set<string>, setB: Set<string>): Set<string> {
    const result = new Set<string>();
    for (const item of setA) {
      if (setB.has(item)) {
        result.add(item);
      }
    }
    return result;
  }

  /** Indexes a skill by its categories, languages, and domains */
  private indexSkill(skill: SkillModule): void {
    for (const category of skill.categories) {
      if (!this.categoryIndex.has(category)) {
        this.categoryIndex.set(category, new Set());
      }
      this.categoryIndex.get(category)!.add(skill.id);
    }

    for (const language of skill.programmingLanguages) {
      if (!this.languageIndex.has(language)) {
        this.languageIndex.set(language, new Set());
      }
      this.languageIndex.get(language)!.add(skill.id);
    }

    for (const domain of skill.domainContexts) {
      if (!this.domainIndex.has(domain)) {
        this.domainIndex.set(domain, new Set());
      }
      this.domainIndex.get(domain)!.add(skill.id);
    }
  }

  /** Generates a unique ID for a skill */
  private generateId(): string {
    return `skill_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /** Derives a skill name from task requirements */
  private deriveSkillName(requirements: TaskRequirements): string {
    const domain = requirements.domain;
    const language = requirements.targetLanguage;
    return `${domain}-${language}-skill`;
  }

  /** Generates a solution template from task requirements */
  private generateTemplate(requirements: TaskRequirements): string {
    const parts: string[] = [
      `// Skill Template: ${requirements.taskDescription}`,
      `// Language: ${requirements.targetLanguage}`,
      `// Domain: ${requirements.domain}`,
      `// Expected Behavior: ${requirements.expectedBehavior}`,
    ];

    if (requirements.constraints.length > 0) {
      parts.push(`// Constraints:`);
      for (const constraint of requirements.constraints) {
        parts.push(`//   - ${constraint.description}`);
      }
    }

    if (requirements.exampleInputs && requirements.exampleInputs.length > 0) {
      parts.push(`// Example Inputs:`);
      for (const input of requirements.exampleInputs) {
        parts.push(`//   - ${input}`);
      }
    }

    return parts.join('\n');
  }

  /** Incorporates failure analysis into an existing template */
  private incorporateFailureAnalysis(
    existingTemplate: string,
    analysis: FailureAnalysis
  ): string {
    const refinementNotes = [
      `\n// --- Refinement (failure_analysis) ---`,
      `// Root Cause: ${analysis.rootCause}`,
      `// Improvement: ${analysis.suggestedImprovement}`,
      `// Affected Patterns: ${analysis.affectedInputPatterns.join(', ')}`,
    ];

    return existingTemplate + refinementNotes.join('\n');
  }

  /** Updates the success rate based on a new outcome */
  private updateSuccessRate(skill: SkillModule, success: boolean): void {
    // Recalculate success rate as a running average
    const totalUsage = skill.usageCount;
    if (totalUsage === 1) {
      skill.successRate = success ? 1.0 : 0.0;
    } else {
      // Adjust success rate incrementally
      const previousSuccesses = Math.round(skill.successRate * (totalUsage - 1));
      const newSuccesses = previousSuccesses + (success ? 1 : 0);
      skill.successRate = newSuccesses / totalUsage;
    }
  }
}
