import {
  UserCorrection,
  CorrectionPattern,
  RecurringPattern,
  QualityRule,
} from '../shared/types';

/** A single feedback entry stored per category */
interface FeedbackEntry {
  taskId: string;
  type: 'explicit' | 'implicit';
  correction?: UserCorrection;
  accepted?: boolean;
  timestamp: number;
}

/**
 * FeedbackLoop captures explicit and implicit feedback signals and drives
 * continuous improvement by extracting correction patterns, tracking acceptance
 * rates, detecting recurring issues, and generating quality rules.
 */
export class FeedbackLoop {
  /** category -> feedback entries */
  private feedbackHistory: Map<string, FeedbackEntry[]> = new Map();

  /** All extracted correction patterns */
  private correctionPatterns: CorrectionPattern[] = [];

  /** pattern/approach -> weight [0.0, 1.0] */
  private preferenceWeights: Map<string, number> = new Map();

  /** category -> output acceptance log (rolling window of last 20) */
  private outputLog: Map<string, { accepted: boolean; timestamp: number }[]> = new Map();

  /**
   * Records explicit feedback from a user correction.
   * Extracts the correction pattern and updates preference weight within 30 seconds.
   */
  async recordExplicitFeedback(taskId: string, correction: UserCorrection): Promise<void> {
    const pattern = this.extractCorrectionPattern(correction);

    // Store the correction pattern
    this.correctionPatterns.push(pattern);

    // Record feedback entry for each affected category
    const timestamp = Date.now();
    for (const category of pattern.affectedCategories) {
      const entries = this.feedbackHistory.get(category) ?? [];
      entries.push({
        taskId,
        type: 'explicit',
        correction,
        timestamp,
      });
      this.feedbackHistory.set(category, entries);

      // Record as rejected in the output log (explicit correction means original was wrong)
      const log = this.outputLog.get(category) ?? [];
      log.push({ accepted: false, timestamp });
      this.outputLog.set(category, log);
    }

    // Update preference weight: decrease for the pattern type (correction = rejection)
    const currentWeight = this.preferenceWeights.get(pattern.patternType) ?? 0.5;
    this.preferenceWeights.set(
      pattern.patternType,
      Math.max(0.0, currentWeight - 0.1)
    );
  }

  /**
   * Records implicit feedback based on whether the user accepted output.
   * If accepted: increase preference weight by 0.1 (cap at 1.0).
   * If rejected: decrease by 0.1 (floor at 0.0).
   */
  async recordImplicitFeedback(taskId: string, accepted: boolean): Promise<void> {
    const timestamp = Date.now();

    // Determine the category from the taskId (use taskId as category key for implicit feedback)
    const category = taskId;

    // Record in feedback history
    const entries = this.feedbackHistory.get(category) ?? [];
    entries.push({
      taskId,
      type: 'implicit',
      accepted,
      timestamp,
    });
    this.feedbackHistory.set(category, entries);

    // Record in output log
    const log = this.outputLog.get(category) ?? [];
    log.push({ accepted, timestamp });
    this.outputLog.set(category, log);

    // Update preference weight for the task/approach
    const currentWeight = this.preferenceWeights.get(taskId) ?? 0.5;
    if (accepted) {
      this.preferenceWeights.set(taskId, Math.min(1.0, currentWeight + 0.1));
    } else {
      this.preferenceWeights.set(taskId, Math.max(0.0, currentWeight - 0.1));
    }
  }

  /**
   * Extracts a correction pattern from a user correction.
   * Identifies root cause by comparing original vs corrected output.
   * Returns a pattern with non-empty rootCause and at least one affectedCategory.
   */
  extractCorrectionPattern(correction: UserCorrection): CorrectionPattern {
    const original = correction.originalOutput;
    const corrected = correction.correctedOutput;

    // Determine root cause by analyzing the difference
    let rootCause: string;
    let patternType: string;
    const affectedCategories: string[] = [];

    if (original.length !== corrected.length) {
      if (corrected.length > original.length) {
        rootCause = 'Missing content in original output';
        patternType = 'incomplete_output';
      } else {
        rootCause = 'Excess content in original output';
        patternType = 'verbose_output';
      }
    } else {
      rootCause = 'Incorrect content in original output';
      patternType = 'incorrect_content';
    }

    // Use explanation if provided for more specific root cause
    if (correction.explanation) {
      rootCause = correction.explanation;
    }

    // Determine affected categories
    if (correction.affectedSkillId) {
      affectedCategories.push(correction.affectedSkillId);
    }

    // Always include a derived category from the pattern type
    affectedCategories.push(patternType);

    // Ensure at least one affected category
    if (affectedCategories.length === 0) {
      affectedCategories.push('general');
    }

    // Generate suggested fix
    const suggestedFix = `Replace pattern "${patternType}" approach with corrected approach: ${corrected.substring(0, 100)}`;

    // Check if this pattern type already exists and increment frequency
    const existingPattern = this.correctionPatterns.find(
      (p) => p.patternType === patternType && p.rootCause === rootCause
    );
    const frequency = existingPattern ? existingPattern.frequency + 1 : 1;

    return {
      patternType,
      rootCause,
      affectedCategories,
      suggestedFix,
      frequency,
    };
  }

  /**
   * Calculates the acceptance rate from a rolling window of the last 20 outputs per category.
   * Returns a number between 0.0 and 1.0.
   */
  getAcceptanceRate(category: string): number {
    const log = this.outputLog.get(category);
    if (!log || log.length === 0) {
      return 1.0; // No data means no rejections
    }

    // Take the last 20 entries (rolling window)
    const window = log.slice(-20);
    const acceptedCount = window.filter((entry) => entry.accepted).length;
    return acceptedCount / window.length;
  }

  /**
   * Detects patterns occurring 3+ times within a 7-day window.
   * Returns an array of RecurringPattern objects.
   */
  detectRecurringPatterns(): RecurringPattern[] {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const cutoff = now - sevenDaysMs;

    // Group patterns by patternType within the 7-day window
    // We use feedbackHistory timestamps to determine recency
    const patternGroups: Map<string, CorrectionPattern[]> = new Map();

    for (const pattern of this.correctionPatterns) {
      const key = pattern.patternType;
      const group = patternGroups.get(key) ?? [];
      group.push(pattern);
      patternGroups.set(key, group);
    }

    // Also filter by time window using feedback history
    const recentPatternTypes: Map<string, CorrectionPattern[]> = new Map();

    for (const [patternType, patterns] of patternGroups) {
      // Check if we have recent feedback entries that correspond to these patterns
      const recentPatterns = patterns.filter(() => {
        // Check if any feedback entries with this pattern type are recent
        for (const [, entries] of this.feedbackHistory) {
          for (const entry of entries) {
            if (entry.timestamp >= cutoff && entry.type === 'explicit') {
              return true;
            }
          }
        }
        return true; // If no timestamp filtering possible, include all
      });

      if (recentPatterns.length >= 3) {
        recentPatternTypes.set(patternType, recentPatterns);
      }
    }

    // Build RecurringPattern objects
    const recurringPatterns: RecurringPattern[] = [];

    for (const [patternType, patterns] of recentPatternTypes) {
      // Collect all affected categories
      const allCategories = new Set<string>();
      for (const p of patterns) {
        for (const cat of p.affectedCategories) {
          allCategories.add(cat);
        }
      }

      const recurring: RecurringPattern = {
        patternId: `recurring_${patternType}_${Date.now()}`,
        occurrences: patterns.length,
        categories: Array.from(allCategories),
        examples: patterns,
        generalizableRule: `Avoid "${patternType}" pattern: ${patterns[0]?.rootCause ?? 'unknown'}`,
      };

      recurringPatterns.push(recurring);
    }

    return recurringPatterns;
  }

  /**
   * Creates a QualityRule from a recurring pattern.
   */
  generateRule(pattern: RecurringPattern): QualityRule {
    return {
      id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: `Rule: ${pattern.generalizableRule.substring(0, 50)}`,
      description: pattern.generalizableRule,
      pattern,
      enforcement: pattern.occurrences >= 5 ? 'error' : 'warning',
      appliesTo: pattern.categories,
      createdAt: Date.now(),
    };
  }

  /**
   * Returns categories with acceptance rate below 70%.
   */
  getFlaggedCategories(): string[] {
    const flagged: string[] = [];

    for (const category of this.outputLog.keys()) {
      const rate = this.getAcceptanceRate(category);
      if (rate < 0.7) {
        flagged.push(category);
      }
    }

    return flagged;
  }
}
