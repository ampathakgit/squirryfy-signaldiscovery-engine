import { SignalClusterInput } from './clusterer';

export type ScoringWeights = {
  attention: number;
  velocity: number;
  cross_source_confirmation: number;
  freshness: number;
  source_trust: number;
};

export class ScorerService {
  /**
   * Scores a cluster based on scoring rule weights and regional source weights.
   */
  static scoreCluster(
    cluster: SignalClusterInput,
    weights: ScoringWeights,
    sourceWeights: Record<string, number>,
    currentDate?: Date
  ): number {
    const now = currentDate ? currentDate.getTime() : Date.now();
    const signals = cluster.signals;
    if (signals.length === 0) return 0;

    // 1. Attention (0-100)
    // Average normalized score of the cluster signals
    const totalEngagementScore = signals.reduce((sum, sig) => sum + sig.normalizedScore, 0);
    const attentionScore = Math.round(totalEngagementScore / signals.length);

    // 2. Freshness (0-100)
    // Time diff in hours from the newest signal
    const newestTime = Math.max(...signals.map(s => s.publishedAt!.getTime()));
    const ageHours = Math.max(0, (now - newestTime) / (1000 * 60 * 60));
    // fresh = 100 points, drops to 0 at 24 hours (4.16 points per hour)
    const freshnessScore = Math.min(100, Math.max(0, Math.round(100 - ageHours * 4.16)));

    // 3. Velocity (0-100)
    // Velocity of attention: engagement score divided by age
    // Estimate age of the cluster based on average age of signals
    const avgPublishTime = signals.reduce((sum, s) => sum + s.publishedAt!.getTime(), 0) / signals.length;
    const avgAgeHours = Math.max(0, (now - avgPublishTime) / (1000 * 60 * 60));
    const velocityScore = Math.min(100, Math.round(attentionScore / (avgAgeHours + 1) * 3));

    // 4. Cross-Source Confirmation (0-100)
    // Count unique source IDs in the cluster
    const uniqueSources = new Set(signals.map(s => s.sourceId));
    let crossSourceScore = 0;
    if (uniqueSources.size === 1) {
      crossSourceScore = 30;
    } else if (uniqueSources.size === 2) {
      crossSourceScore = 70;
    } else if (uniqueSources.size >= 3) {
      crossSourceScore = 100;
    }

    // 5. Source Trust (0-100)
    // Calculate average source weight in the cluster based on DB config weights
    let totalTrust = 0;
    for (const sourceId of uniqueSources) {
      // Look up weight (default to 0.10 if not specified)
      const weight = sourceWeights[sourceId] ?? 0.10;
      totalTrust += weight;
    }
    const avgTrustWeight = totalTrust / uniqueSources.size;
    // Scale up to 0-100 (since weights sum to 1.0, a high trust source like 0.40 becomes 80 points)
    const sourceTrustScore = Math.min(100, Math.round(avgTrustWeight * 200));

    // Final weighted calculation
    const finalScore = 
      (weights.attention * attentionScore) +
      (weights.freshness * freshnessScore) +
      (weights.velocity * velocityScore) +
      (weights.cross_source_confirmation * crossSourceScore) +
      (weights.source_trust * sourceTrustScore);

    // Round to 2 decimal places
    const roundedScore = Math.round(finalScore * 100) / 100;

    // Log calculation details for debug/audit logs
    console.log(`[Scorer] Cluster: "${cluster.title.substring(0, 40)}" - Score: ${roundedScore} (Att:${attentionScore}, Fr:${freshnessScore}, Vel:${velocityScore}, Cross:${crossSourceScore}, Trust:${sourceTrustScore})`);

    return roundedScore;
  }
}
