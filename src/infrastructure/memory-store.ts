import {
  MemoryEntry,
  MemoryQuery,
  MemoryNamespace,
  ProjectContext,
  TimeRange,
  DecayConfig,
  DecayReport,
} from '../shared/types';

/**
 * Computes a simple relevance score based on keyword/tag matching
 * between a query string and a memory entry's content and metadata.
 */
function computeRelevanceScore(entry: MemoryEntry, query: MemoryQuery): number {
  const queryTerms = query.semanticQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (queryTerms.length === 0) {
    return 0;
  }

  let matchCount = 0;
  const contentLower = entry.content.toLowerCase();
  const tags = entry.metadata.tags.map((t) => t.toLowerCase());

  for (const term of queryTerms) {
    // Check content match
    if (contentLower.includes(term)) {
      matchCount++;
    }
    // Check tag match (higher weight)
    if (tags.some((tag) => tag.includes(term))) {
      matchCount += 2;
    }
    // Check domain match
    if (entry.metadata.domain && entry.metadata.domain.toLowerCase().includes(term)) {
      matchCount++;
    }
    // Check language match
    if (entry.metadata.language && entry.metadata.language.toLowerCase().includes(term)) {
      matchCount++;
    }
  }

  // Normalize score to [0, 1] range
  const maxPossibleScore = queryTerms.length * 5; // max matches per term
  return Math.min(matchCount / maxPossibleScore, 1);
}

/**
 * Checks whether an entry falls within the specified time range.
 */
function isWithinTimeRange(entry: MemoryEntry, timeRange?: TimeRange): boolean {
  if (!timeRange) {
    return true;
  }
  return entry.createdAt >= timeRange.start && entry.createdAt <= timeRange.end;
}

/**
 * NamespacedStore provides namespace-isolated access to the MemoryStore.
 * Queries against one namespace NEVER return entries from another.
 */
export class NamespacedStore {
  private readonly namespace: MemoryNamespace;
  private readonly memoryStore: MemoryStore;

  constructor(namespace: MemoryNamespace, memoryStore: MemoryStore) {
    this.namespace = namespace;
    this.memoryStore = memoryStore;
  }

  /**
   * Stores an entry in this namespace. Overrides the entry's namespace
   * to ensure it belongs to this namespaced store.
   */
  async store(entry: MemoryEntry): Promise<string> {
    const namespacedEntry: MemoryEntry = {
      ...entry,
      namespace: this.namespace,
    };
    return this.memoryStore.store(namespacedEntry);
  }

  /**
   * Retrieves entries matching the query, scoped to this namespace only.
   */
  async retrieve(query: MemoryQuery): Promise<MemoryEntry[]> {
    const namespacedQuery: MemoryQuery = {
      ...query,
      namespace: this.namespace,
    };
    return this.memoryStore.retrieve(namespacedQuery);
  }
}

/**
 * MemoryStore provides persistent storage with semantic retrieval
 * across multiple namespaces. Uses in-memory Maps for storage with
 * separate indexes per namespace for isolation.
 */
export class MemoryStore {
  /** Primary storage: entry ID -> MemoryEntry */
  private entries: Map<string, MemoryEntry> = new Map();

  /** Namespace index: namespace -> Set of entry IDs */
  private namespaceIndex: Map<MemoryNamespace, Set<string>> = new Map();

  /** Project index: projectId -> Set of entry IDs */
  private projectIndex: Map<string, Set<string>> = new Map();

  /** Project context storage: projectId -> ProjectContext */
  private projectContexts: Map<string, ProjectContext> = new Map();

  /** Counter for generating unique IDs */
  private idCounter = 0;

  constructor() {
    // Initialize namespace indexes
    const namespaces: MemoryNamespace[] = ['project', 'patterns', 'preferences', 'decisions', 'lessons'];
    for (const ns of namespaces) {
      this.namespaceIndex.set(ns, new Set());
    }
  }

  /**
   * Stores a memory entry and returns its ID.
   * If the entry has no ID, one is generated.
   */
  async store(entry: MemoryEntry): Promise<string> {
    const id = entry.id || this.generateId();
    const storedEntry: MemoryEntry = {
      ...entry,
      id,
      createdAt: entry.createdAt || Date.now(),
      lastAccessed: entry.lastAccessed || Date.now(),
      accessCount: entry.accessCount || 0,
    };

    // Store in primary map
    this.entries.set(id, storedEntry);

    // Update namespace index
    const nsIndex = this.namespaceIndex.get(storedEntry.namespace);
    if (nsIndex) {
      nsIndex.add(id);
    } else {
      this.namespaceIndex.set(storedEntry.namespace, new Set([id]));
    }

    // Update project index if projectId is present
    if (storedEntry.metadata.projectId) {
      const projectIds = this.projectIndex.get(storedEntry.metadata.projectId);
      if (projectIds) {
        projectIds.add(id);
      } else {
        this.projectIndex.set(storedEntry.metadata.projectId, new Set([id]));
      }
    }

    return id;
  }

  /**
   * Retrieves entries matching the query with semantic similarity.
   * Uses keyword/tag matching as a simplified semantic similarity measure.
   * Supports maxResults, minRelevance, and timeRange filtering.
   * Updates accessCount and lastAccessed on retrieved entries.
   */
  async retrieve(query: MemoryQuery): Promise<MemoryEntry[]> {
    let candidateIds: Set<string>;

    // If namespace is specified, only search within that namespace
    if (query.namespace) {
      candidateIds = this.namespaceIndex.get(query.namespace) || new Set();
    } else {
      // Search across all namespaces
      candidateIds = new Set(this.entries.keys());
    }

    // If projectId is specified, intersect with project index
    if (query.projectId) {
      const projectIds = this.projectIndex.get(query.projectId) || new Set();
      candidateIds = new Set([...candidateIds].filter((id) => projectIds.has(id)));
    }

    // Score and filter candidates
    const scoredEntries: Array<{ entry: MemoryEntry; score: number }> = [];

    for (const id of candidateIds) {
      const entry = this.entries.get(id);
      if (!entry) continue;

      // Apply time range filter
      if (!isWithinTimeRange(entry, query.timeRange)) {
        continue;
      }

      // Compute relevance score
      const score = computeRelevanceScore(entry, query);

      // Apply minimum relevance filter
      if (query.minRelevance !== undefined && score < query.minRelevance) {
        continue;
      }

      scoredEntries.push({ entry, score });
    }

    // Sort by relevance score (descending)
    scoredEntries.sort((a, b) => b.score - a.score);

    // Apply maxResults limit
    const maxResults = query.maxResults || 10;
    const results = scoredEntries.slice(0, maxResults);

    // Update access tracking on retrieved entries
    const now = Date.now();
    return results.map(({ entry, score }) => {
      const updatedEntry: MemoryEntry = {
        ...entry,
        accessCount: entry.accessCount + 1,
        lastAccessed: now,
        relevanceScore: score,
      };
      // Update the stored entry
      this.entries.set(entry.id, updatedEntry);
      return updatedEntry;
    });
  }

  /**
   * Retrieves project-specific context.
   * Returns null if no context exists for the given projectId.
   */
  async getProjectContext(projectId: string): Promise<ProjectContext | null> {
    return this.projectContexts.get(projectId) || null;
  }

  /**
   * Stores project context for later retrieval.
   */
  async setProjectContext(projectId: string, context: ProjectContext): Promise<void> {
    this.projectContexts.set(projectId, context);
  }

  /**
   * Returns a namespace-scoped view of the store.
   * Operations on the returned NamespacedStore only affect and query
   * entries within the specified namespace.
   */
  getNamespace(ns: MemoryNamespace): NamespacedStore {
    return new NamespacedStore(ns, this);
  }

  /**
   * Returns current capacity usage in bytes (approximate).
   * Estimates based on JSON serialization of stored entries.
   */
  getCapacityUsage(): number {
    let totalBytes = 0;
    for (const entry of this.entries.values()) {
      // Approximate size: content + metadata serialization
      totalBytes += entry.content.length * 2; // UTF-16
      totalBytes += JSON.stringify(entry.metadata).length * 2;
      totalBytes += entry.embedding.length * 8; // 64-bit floats
      totalBytes += 200; // overhead for other fields
    }
    return totalBytes;
  }

  /**
   * Returns the total number of stored entries.
   */
  getEntryCount(): number {
    return this.entries.size;
  }

  /**
   * Applies the relevance-decay algorithm to manage memory capacity.
   * 
   * 1. Checks if current capacity exceeds config.capacityThreshold
   * 2. If yes, iterates through all entries and:
   *    - Calculates time since last access (in days)
   *    - Reduces relevanceScore by (timeSinceAccess * config.decayRate)
   *    - PRESERVES entries with relevanceScore >= config.highImpactBoost (never archives these)
   *    - ARCHIVES (deletes) entries with relevanceScore < config.preservationThreshold
   *      AND that don't qualify as high-impact
   * 3. Returns a DecayReport with counts of processed, archived, preserved entries and space reclaimed
   */
  async applyDecay(config: DecayConfig): Promise<DecayReport> {
    const now = Date.now();
    const report: DecayReport = {
      entriesProcessed: 0,
      entriesArchived: 0,
      entriesPreserved: 0,
      spaceReclaimed: 0,
      timestamp: now,
    };

    // Step 1: Check if current capacity exceeds the threshold
    const currentCapacity = this.getCapacityUsage();
    if (currentCapacity <= config.capacityThreshold) {
      // Capacity is within limits, no decay needed
      return report;
    }

    // Step 2: Iterate through all entries and apply decay
    const entriesToArchive: string[] = [];
    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    for (const [id, entry] of this.entries) {
      report.entriesProcessed++;

      // Calculate time since last access in days
      const timeSinceAccessMs = now - entry.lastAccessed;
      const timeSinceAccessDays = timeSinceAccessMs / MS_PER_DAY;

      // Reduce relevance score by time-based decay
      const decayedScore = entry.relevanceScore - (timeSinceAccessDays * config.decayRate);

      // Update the entry's relevance score
      const updatedEntry: MemoryEntry = {
        ...entry,
        relevanceScore: decayedScore,
      };
      this.entries.set(id, updatedEntry);

      // PRESERVE entries with relevanceScore >= highImpactBoost (never archive these)
      if (decayedScore >= config.highImpactBoost) {
        report.entriesPreserved++;
        continue;
      }

      // ARCHIVE entries with relevanceScore < preservationThreshold
      // that don't qualify as high-impact
      if (decayedScore < config.preservationThreshold) {
        entriesToArchive.push(id);
      } else {
        report.entriesPreserved++;
      }
    }

    // Step 3: Archive (delete) low-relevance entries and calculate space reclaimed
    for (const id of entriesToArchive) {
      const entry = this.entries.get(id);
      if (!entry) continue;

      // Calculate approximate size of this entry for space reclaimed
      const entrySize =
        entry.content.length * 2 +
        JSON.stringify(entry.metadata).length * 2 +
        entry.embedding.length * 8 +
        200;
      report.spaceReclaimed += entrySize;

      // Remove from primary storage
      this.entries.delete(id);

      // Remove from namespace index
      const nsIndex = this.namespaceIndex.get(entry.namespace);
      if (nsIndex) {
        nsIndex.delete(id);
      }

      // Remove from project index
      if (entry.metadata.projectId) {
        const projectIds = this.projectIndex.get(entry.metadata.projectId);
        if (projectIds) {
          projectIds.delete(id);
        }
      }

      report.entriesArchived++;
    }

    return report;
  }

  /**
   * Generates a unique ID for new entries.
   */
  private generateId(): string {
    this.idCounter++;
    return `mem_${Date.now()}_${this.idCounter}`;
  }
}
