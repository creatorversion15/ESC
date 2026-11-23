import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../src/db/index';
import { exchangeProblems } from '../src/db/schema';
import {
  buildAllExchangeProblemSeeds,
  validateExchangeSeedDataset,
} from '../src/data/problemExchange/index';

async function main() {
  const records = buildAllExchangeProblemSeeds();
  const validation = validateExchangeSeedDataset(records);

  if (!validation.ok) {
    console.error('❌ Seed dataset validation failed:');
    for (const err of validation.errors) {
      console.error('  -', err);
    }
    process.exit(1);
  }

  console.log(
    `✅ Validated ${validation.totalCount} distinct original problems across ${Object.keys(validation.categoryCounts).length} categories (Top 10 curated: ${validation.topTenCount}).`
  );

  const chunkSize = 100;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    await db
      .insert(exchangeProblems)
      .values(chunk)
      .onConflictDoUpdate({
        target: exchangeProblems.id,
        set: {
          problemCode: sql`excluded.problem_code`,
          title: sql`excluded.title`,
          normalizedTitle: sql`excluded.normalized_title`,
          description: sql`excluded.description`,
          category: sql`excluded.category`,
          industry: sql`excluded.industry`,
          affectedUsers: sql`excluded.affected_users`,
          realWorldContext: sql`excluded.real_world_context`,
          currentChallenges: sql`excluded.current_challenges`,
          currentWorkarounds: sql`excluded.current_workarounds`,
          whyItMatters: sql`excluded.why_it_matters`,
          potentialImpact: sql`excluded.potential_impact`,
          impactLevel: sql`excluded.impact_level`,
          difficulty: sql`excluded.difficulty`,
          skillsRequired: sql`excluded.skills_required`,
          location: sql`excluded.location`,
          developmentOpportunities: sql`excluded.development_opportunities`,
          suggestedResearchQuestions: sql`excluded.suggested_research_questions`,
          scoreSeverity: sql`excluded.score_severity`,
          scorePeopleAffected: sql`excluded.score_people_affected`,
          scoreFrequency: sql`excluded.score_frequency`,
          scoreUrgency: sql`excluded.score_urgency`,
          scorePotentialImpact: sql`excluded.score_potential_impact`,
          scoreFeasibility: sql`excluded.score_feasibility`,
          opportunityScore: sql`excluded.opportunity_score`,
          isFeatured: sql`excluded.is_featured`,
          topTenRank: sql`excluded.top_ten_rank`,
          updatedAt: sql`NOW()`,
        },
      });
    console.log(`  ↳ Upserted batch ${i + 1}..${Math.min(i + chunkSize, records.length)}`);
  }

  const summary = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(DISTINCT normalized_title)::int AS distinct_titles,
      COUNT(DISTINCT category)::int AS categories,
      COUNT(top_ten_rank)::int AS top10_count
    FROM exchange_problems
    WHERE publication_status = 'published'
  `);

  console.log('📊 Cloud SQL verification:', summary.rows[0]);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seed script failed:', err);
  process.exit(1);
});
