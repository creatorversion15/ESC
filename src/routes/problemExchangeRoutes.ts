import express from 'express';
import { type AuthRequest, optionalAuth, requireAdmin, requireAuth } from '../middleware/auth.ts';
import {
  adminCreateExchangeProblem,
  adminDeleteExchangeProblem,
  adminExportProblemsCsv,
  adminGetProblemExchangeStats,
  adminImportProblemsCsv,
  adminListProblemReports,
  adminListSolverInterests,
  adminReviewProblemReport,
  adminReviewSolverInterest,
  adminUpdateExchangeProblem,
  findMatchingTeamMembersForProblem,
  getExchangeProblemById,
  getMyProblemExchangeWorkspace,
  getProblemExchangeOverview,
  getRandomPublishedProblem,
  listExchangeProblems,
  submitCommunityProblem,
  submitProblemReport,
  submitSolverInterest,
  toggleSaveExchangeProblem,
  updateOwnPendingProblem,
} from '../db/problemExchangeRepository.ts';
import {
  validateProblemReportInput,
  validateProblemSubmission,
  validateSolverInterestInput,
} from '../utils/problemExchangeLogic.ts';
import { createAdminAuditLog } from '../db/escRepository.ts';
import { createNotificationSafe } from '../db/teamsAndTasksRepository.ts';

export function createProblemExchangeRouter() {
  const router = express.Router();

  /* ------------------------------------------------------------------------
   * PUBLIC / MEMBER PROBLEM EXCHANGE ENDPOINTS
   * ------------------------------------------------------------------------ */

  router.get('/problem-exchange/overview', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const overview = await getProblemExchangeOverview(req.user?.uid);
      res.json(overview);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load Problem Exchange overview' });
    }
  });

  router.get('/problem-exchange', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const category = typeof req.query.category === 'string' ? req.query.category : undefined;
      const industry = typeof req.query.industry === 'string' ? req.query.industry : undefined;
      const difficulty = typeof req.query.difficulty === 'string' ? req.query.difficulty : undefined;
      const impactLevel = typeof req.query.impactLevel === 'string' ? req.query.impactLevel : undefined;
      const skill = typeof req.query.skill === 'string' ? req.query.skill : undefined;
      const location = typeof req.query.location === 'string' ? req.query.location : undefined;
      const validationStatus =
        typeof req.query.validationStatus === 'string' ? req.query.validationStatus : undefined;
      const minScore = req.query.minScore !== undefined ? Number(req.query.minScore) : undefined;
      const maxScore = req.query.maxScore !== undefined ? Number(req.query.maxScore) : undefined;
      const featuredOnly = req.query.featured === '1' || req.query.featured === 'true';
      const topTenOnly = req.query.topTen === '1' || req.query.topTen === 'true';
      const sort = (typeof req.query.sort === 'string' ? req.query.sort : 'score_desc') as any;
      const page = req.query.page !== undefined ? Number(req.query.page) : 1;
      const pageSize = req.query.pageSize !== undefined ? Number(req.query.pageSize) : 18;

      const data = await listExchangeProblems({
        q,
        category,
        industry,
        difficulty,
        impactLevel,
        skill,
        location,
        validationStatus,
        minScore,
        maxScore,
        featuredOnly,
        topTenOnly,
        sort,
        page,
        pageSize,
        userUid: req.user?.uid,
        isAdminView: false,
      });

      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to query problems' });
    }
  });

  router.get('/problem-exchange/random', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const excludeId = typeof req.query.excludeId === 'string' ? req.query.excludeId : undefined;
      const problem = await getRandomPublishedProblem(excludeId, req.user?.uid);
      if (!problem) {
        res.status(404).json({ error: 'No published problems found' });
        return;
      }
      res.json(problem);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to discover random problem' });
    }
  });

  router.get('/problem-exchange/my', requireAuth, async (req: AuthRequest, res) => {
    try {
      const workspace = await getMyProblemExchangeWorkspace(req.user!.uid, req.user!.email);
      res.json(workspace);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load your Problem Exchange workspace' });
    }
  });

  router.post('/problem-exchange/submit', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const body = req.body || {};
      const payload = {
        title: String(body.title || ''),
        description: String(body.description || ''),
        category: String(body.category || ''),
        industry: String(body.industry || ''),
        location: String(body.location || ''),
        affectedUsers: String(body.affectedUsers || ''),
        whyItMatters: String(body.whyItMatters || ''),
        evidenceLinks: Array.isArray(body.evidenceLinks) ? body.evidenceLinks : [],
        attachmentName: typeof body.attachmentName === 'string' ? body.attachmentName : '',
        attachmentType: typeof body.attachmentType === 'string' ? body.attachmentType : '',
        attachmentDataUrl: typeof body.attachmentDataUrl === 'string' ? body.attachmentDataUrl : '',
        submitterUid: req.user?.uid || '',
        submitterName: String(body.submitterName || req.user?.name || ''),
        submitterEmail: String(body.submitterEmail || req.user?.email || ''),
      };

      const validation = validateProblemSubmission(payload);
      if (!validation.isValid) {
        res.status(400).json({ error: 'Validation failed', errors: validation.errors });
        return;
      }

      // Simple spam guard: reject excessive URLs inside description
      const urlMatches = payload.description.match(/https?:\/\//gi) || [];
      if (urlMatches.length > 5) {
        res.status(400).json({
          error: 'Please keep reference links inside the Evidence Links field instead of pasting many URLs into the description.',
        });
        return;
      }

      const result = await submitCommunityProblem(payload);
      if (result.duplicate) {
        res.status(409).json({
          error: `A closely matching problem already exists (${result.duplicate.problemCode}: "${result.duplicate.title}").`,
          duplicate: result.duplicate,
        });
        return;
      }

      if (result.problem) {
        await createNotificationSafe({
          recipientType: 'admin',
          title: `New Problem Exchange Submission (${result.problem.problemCode})`,
          description: `${payload.submitterName} submitted "${result.problem.title}" (${result.problem.category}) for ESC review.`,
          senderName: payload.submitterName,
          type: 'system',
          linkTab: 'problem_exchange',
          dedupeKey: `px_submit_${result.problem.id}`,
        }).catch(() => {});
      }

      res.status(201).json({
        message: 'THANK YOU. YOUR PROBLEM HAS BEEN SUBMITTED FOR ESC REVIEW.',
        problem: result.problem,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to submit problem' });
    }
  });

  router.patch('/problem-exchange/my/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const updated = await updateOwnPendingProblem(req.params.id, req.user!.uid, req.body || {});
      if (!updated) {
        res.status(404).json({
          error: 'Pending submission not found or already reviewed by ESC Admin.',
        });
        return;
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to update pending submission' });
    }
  });

  router.get('/problem-exchange/:id', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const incrementView = req.query.noView !== '1';
      const detail = await getExchangeProblemById(req.params.id, {
        userUid: req.user?.uid,
        isAdmin: req.user?.isAdmin,
        incrementView,
      });
      if (!detail) {
        res.status(404).json({ error: 'Problem not found' });
        return;
      }
      res.json(detail);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load problem details' });
    }
  });

  router.get('/problem-exchange/:id/matching-members', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const result = await findMatchingTeamMembersForProblem(req.params.id, req.user?.uid);
      if (!result) {
        res.status(404).json({ error: 'Problem not found' });
        return;
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to match ESC members' });
    }
  });

  router.post('/problem-exchange/:id/save', requireAuth, async (req: AuthRequest, res) => {
    try {
      const result = await toggleSaveExchangeProblem(req.user!.uid, req.params.id);
      if (!result) {
        res.status(404).json({ error: 'Problem not found' });
        return;
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to toggle saved status' });
    }
  });

  router.post('/problem-exchange/:id/solve', requireAuth, async (req: AuthRequest, res) => {
    try {
      const body = req.body || {};
      const skillsOffered = Array.isArray(body.skillsOffered)
        ? body.skillsOffered.map((s: any) => String(s).trim()).filter(Boolean)
        : String(body.skillsOffered || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

      const validation = validateSolverInterestInput({
        proposedApproach: String(body.proposedApproach || ''),
        teamPreference: String(body.teamPreference || ''),
        skillsOffered,
      });

      if (!validation.isValid) {
        res.status(400).json({ error: 'Validation failed', errors: validation.errors });
        return;
      }

      const result = await submitSolverInterest({
        problemId: req.params.id,
        userUid: req.user!.uid,
        userName: String(body.userName || req.user!.name || req.user!.email || 'ESC Member'),
        userEmail: req.user!.email || '',
        proposedApproach: String(body.proposedApproach),
        skillsOffered,
        lookingForTeammates: body.lookingForTeammates !== false,
        neededRoles: String(body.neededRoles || ''),
        teamPreference: body.teamPreference,
      });

      if (!result) {
        res.status(404).json({ error: 'Published problem not found' });
        return;
      }

      await createNotificationSafe({
        recipientType: 'admin',
        title: `Solver Interest Submitted — ${result.interest.problemTitle.slice(0, 60)}`,
        description: `${result.interest.userName} expressed interest in solving "${result.interest.problemTitle}" (${result.interest.teamPreference}). Status: Pending ESC Admin Review.`,
        senderName: result.interest.userName,
        type: 'system',
        relatedMemberUid: req.user!.uid,
        linkTab: 'problem_exchange',
        dedupeKey: `px_solve_${result.interest.id}_${Date.now()}`,
      }).catch(() => {});

      res.status(result.isNew ? 201 : 200).json({
        message:
          'Your solver interest has been submitted for ESC Admin review. Team formation and project approval proceed only after ESC Admin verification.',
        interest: result.interest,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to record solver interest' });
    }
  });

  router.post('/problem-exchange/:id/report', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const body = req.body || {};
      const validation = validateProblemReportInput({
        reason: String(body.reason || ''),
        details: String(body.details || ''),
      });
      if (!validation.isValid) {
        res.status(400).json({ error: 'Validation failed', errors: validation.errors });
        return;
      }

      const report = await submitProblemReport({
        problemId: req.params.id,
        reporterUid: req.user?.uid,
        reporterName: String(body.reporterName || req.user?.name || 'Community Member').trim(),
        reporterEmail: String(body.reporterEmail || req.user?.email || '').trim(),
        reason: body.reason,
        details: String(body.details),
        duplicateOfId: String(body.duplicateOfId || ''),
      });

      if (!report) {
        res.status(404).json({ error: 'Problem not found' });
        return;
      }

      await createNotificationSafe({
        recipientType: 'admin',
        title: `Problem Report (${report.reason.toUpperCase()})`,
        description: `${report.reporterName} flagged "${report.problemTitle}": ${report.details.slice(0, 140)}`,
        senderName: report.reporterName,
        type: 'system',
        linkTab: 'problem_exchange',
        dedupeKey: `px_report_${report.id}`,
      }).catch(() => {});

      res.status(201).json({
        message: 'Thank you. Your report has been logged for ESC Admin moderation.',
        report,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to submit report' });
    }
  });

  /* ------------------------------------------------------------------------
   * ADMIN PROBLEM EXCHANGE MANAGEMENT ENDPOINTS
   * ------------------------------------------------------------------------ */

  router.get('/admin/problem-exchange/stats', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const stats = await adminGetProblemExchangeStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load Problem Exchange stats' });
    }
  });

  router.get('/admin/problem-exchange/problems', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const data = await listExchangeProblems({
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        category: typeof req.query.category === 'string' ? req.query.category : undefined,
        publicationStatus:
          typeof req.query.publicationStatus === 'string' ? req.query.publicationStatus : 'all',
        validationStatus:
          typeof req.query.validationStatus === 'string' ? req.query.validationStatus : 'all',
        featuredOnly: req.query.featured === '1' || req.query.featured === 'true',
        topTenOnly: req.query.topTen === '1' || req.query.topTen === 'true',
        sort: (typeof req.query.sort === 'string' ? req.query.sort : 'recent') as any,
        page: req.query.page !== undefined ? Number(req.query.page) : 1,
        pageSize: req.query.pageSize !== undefined ? Number(req.query.pageSize) : 25,
        isAdminView: true,
      });
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to list problems for admin' });
    }
  });

  router.post('/admin/problem-exchange/problems', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      if (!String(req.body?.title || '').trim() || !String(req.body?.description || '').trim()) {
        res.status(400).json({ error: 'Title and description are required.' });
        return;
      }
      const created = await adminCreateExchangeProblem(req.body || {}, req.user!.email || req.user!.uid);
      await createAdminAuditLog({
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || '',
        action: 'PROBLEM_EXCHANGE_CREATED',
        targetType: 'ExchangeProblem',
        targetId: created.problemCode,
        details: `Created Problem Exchange entry ${created.problemCode}: ${created.title}`,
      }).catch(() => {});
      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to create problem' });
    }
  });

  router.patch('/admin/problem-exchange/problems/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const updated = await adminUpdateExchangeProblem(
        req.params.id,
        req.body || {},
        req.user!.email || req.user!.uid
      );
      if (!updated) {
        res.status(404).json({ error: 'Problem not found' });
        return;
      }

      await createAdminAuditLog({
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || '',
        action: `PROBLEM_EXCHANGE_UPDATED_${updated.publicationStatus.toUpperCase()}`,
        targetType: 'ExchangeProblem',
        targetId: updated.problemCode,
        details: `Updated ${updated.problemCode} (${updated.title}) — pub: ${updated.publicationStatus}, validation: ${updated.validationStatus}, score: ${updated.opportunityScore}, top10: ${updated.topTenRank ?? 'none'}`,
      }).catch(() => {});

      if (updated.submittedByUid && req.body?.publicationStatus) {
        await createNotificationSafe({
          recipientType: 'user',
          recipientUid: updated.submittedByUid,
          title: `Problem Submission ${updated.problemCode} — ${updated.publicationStatus.replace(/_/g, ' ').toUpperCase()}`,
          description: updated.adminNotes
            ? `"${updated.title}" status updated. ESC Admin note: ${updated.adminNotes}`
            : `Your submitted problem "${updated.title}" is now ${updated.publicationStatus.replace(/_/g, ' ')}.`,
          senderName: 'ESC Problem Exchange Desk',
          type: 'system',
          linkTab: 'problems',
          dedupeKey: `px_pub_${updated.id}_${updated.publicationStatus}_${Date.now()}`,
        }).catch(() => {});
      }

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to update problem' });
    }
  });

  router.delete('/admin/problem-exchange/problems/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const deleted = await adminDeleteExchangeProblem(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'Problem not found' });
        return;
      }
      await createAdminAuditLog({
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || '',
        action: 'PROBLEM_EXCHANGE_DELETED',
        targetType: 'ExchangeProblem',
        targetId: req.params.id,
        details: `Deleted Problem Exchange entry ${req.params.id}`,
      }).catch(() => {});
      res.json({ deleted: true });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to delete problem' });
    }
  });

  router.get('/admin/problem-exchange/solver-interests', requireAuth, requireAdmin, async (req, res) => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const items = await adminListSolverInterests(status);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load solver interests' });
    }
  });

  router.patch('/admin/problem-exchange/solver-interests/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const status = String(req.body?.status || '').trim();
      if (!['pending_review', 'under_review', 'approved_for_team_formation', 'declined'].includes(status)) {
        res.status(400).json({ error: 'Invalid solver interest status.' });
        return;
      }
      const updated = await adminReviewSolverInterest(
        req.params.id,
        status as any,
        String(req.body?.adminNotes || '')
      );
      if (!updated) {
        res.status(404).json({ error: 'Solver interest application not found.' });
        return;
      }

      await createAdminAuditLog({
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || '',
        action: `PROBLEM_SOLVER_${status.toUpperCase()}`,
        targetType: 'ExchangeSolverInterest',
        targetId: updated.id,
        details: `Reviewed solver interest by ${updated.userName} for "${updated.problemTitle}" → ${status}`,
      }).catch(() => {});

      await createNotificationSafe({
        recipientType: 'user',
        recipientUid: updated.userUid,
        title: `Solver Application Update — ${updated.problemTitle.slice(0, 50)}`,
        description:
          status === 'approved_for_team_formation'
            ? `Your solver interest for "${updated.problemTitle}" has been approved for ESC team formation. You can now proceed to Startup Teams in your dashboard.`
            : `Your solver interest for "${updated.problemTitle}" status is now ${status.replace(/_/g, ' ')}.${updated.adminNotes ? ` Note: ${updated.adminNotes}` : ''}`,
        senderName: 'ESC Admin Team',
        type: 'system',
        linkTab: 'problems',
        dedupeKey: `px_solver_rev_${updated.id}_${status}_${Date.now()}`,
      }).catch(() => {});

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to review solver interest' });
    }
  });

  router.get('/admin/problem-exchange/reports', requireAuth, requireAdmin, async (req, res) => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const items = await adminListProblemReports(status);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to load problem reports' });
    }
  });

  router.patch('/admin/problem-exchange/reports/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const status = String(req.body?.status || '').trim();
      if (!['open', 'reviewing', 'resolved', 'dismissed'].includes(status)) {
        res.status(400).json({ error: 'Invalid report status.' });
        return;
      }
      const updated = await adminReviewProblemReport(
        req.params.id,
        status as any,
        String(req.body?.adminNotes || ''),
        req.user!.email || req.user!.uid
      );
      if (!updated) {
        res.status(404).json({ error: 'Report not found.' });
        return;
      }

      await createAdminAuditLog({
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || '',
        action: `PROBLEM_REPORT_${status.toUpperCase()}`,
        targetType: 'ExchangeProblemReport',
        targetId: updated.id,
        details: `Updated report on "${updated.problemTitle}" (${updated.reason}) → ${status}`,
      }).catch(() => {});

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to update report' });
    }
  });

  router.post('/admin/problem-exchange/import-csv', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const csvText = String(req.body?.csvText || '');
      const publishImmediately = req.body?.publishImmediately !== false;
      if (!csvText.trim()) {
        res.status(400).json({ error: 'CSV content is empty.' });
        return;
      }
      const result = await adminImportProblemsCsv(
        csvText,
        req.user!.email || req.user!.uid,
        publishImmediately
      );

      await createAdminAuditLog({
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || '',
        action: 'PROBLEM_EXCHANGE_CSV_IMPORT',
        targetType: 'ExchangeProblem',
        targetId: `csv_${Date.now()}`,
        details: `Imported ${result.importedCount} problems via CSV (${result.skippedCount} skipped).`,
      }).catch(() => {});

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to import CSV' });
    }
  });

  router.get('/admin/problem-exchange/export-csv', requireAuth, requireAdmin, async (req, res) => {
    try {
      const publicationStatus =
        typeof req.query.publicationStatus === 'string' ? req.query.publicationStatus : 'all';
      const csv = await adminExportProblemsCsv(publicationStatus);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="esc-problem-exchange.csv"');
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to export CSV' });
    }
  });

  return router;
}
