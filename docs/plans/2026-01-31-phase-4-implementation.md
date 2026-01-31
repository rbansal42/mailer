# Phase 4: Advanced Scheduling - Implementation Plan

**Date:** January 31, 2026
**Branch:** `feature/phase-4-scheduling`
**Worktree:** `/Volumes/Code/mailer/.worktrees/phase-4`

## Overview

Implement recurring campaigns, drip sequences, and timezone-aware delivery.

## Tasks

### Task 1: Database - Recurring Campaigns Table
**Priority:** High | **Parallelizable:** Yes

Add to `server/src/db/index.ts`:

```sql
CREATE TABLE IF NOT EXISTS recurring_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  template_id INTEGER REFERENCES templates(id),
  subject TEXT NOT NULL,
  recipient_source TEXT NOT NULL,
  recipient_data TEXT,
  schedule_cron TEXT NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  cc TEXT DEFAULT '[]',
  bcc TEXT DEFAULT '[]',
  enabled INTEGER DEFAULT 1,
  last_run_at DATETIME,
  next_run_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### Task 2: Database - Sequences Tables
**Priority:** High | **Parallelizable:** Yes (with T1)

Add to `server/src/db/index.ts`:

```sql
CREATE TABLE IF NOT EXISTS sequences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sequence_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sequence_id INTEGER REFERENCES sequences(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  template_id INTEGER REFERENCES templates(id),
  subject TEXT NOT NULL,
  delay_days INTEGER NOT NULL,
  delay_hours INTEGER DEFAULT 0,
  send_time TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sequence_id INTEGER REFERENCES sequences(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_data TEXT,
  current_step INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  next_send_at DATETIME,
  completed_at DATETIME,
  UNIQUE(sequence_id, recipient_email)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_next_send ON sequence_enrollments(next_send_at);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON sequence_enrollments(status);
```

---

### Task 3: Database - Scheduled Batches Table
**Priority:** High | **Parallelizable:** Yes (with T1, T2)

Add to `server/src/db/index.ts`:

```sql
CREATE TABLE IF NOT EXISTS scheduled_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES campaigns(id),
  scheduled_for DATETIME NOT NULL,
  recipient_emails TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scheduled_batches_status ON scheduled_batches(status, scheduled_for);
```

---

### Task 4: Service - Recurring Campaign Processor
**Priority:** High | **Parallelizable:** No (after T1)

Create `server/src/services/recurring-processor.ts`:

- `processRecurringCampaigns()` - Check and run due recurring campaigns
- `calculateNextRun(cronExpression, timezone)` - Calculate next run time
- `fetchRecipients(source, data)` - Get recipients from static/url/api
- Update `last_run_at` and `next_run_at` after each run

---

### Task 5: Service - Sequence Processor
**Priority:** High | **Parallelizable:** No (after T2)

Create `server/src/services/sequence-processor.ts`:

- `processSequenceSteps()` - Send due sequence emails
- `enrollRecipient(sequenceId, email, data)` - Enroll with initial next_send_at
- `advanceStep(enrollmentId)` - Move to next step, update next_send_at
- `pauseEnrollment(enrollmentId)` / `cancelEnrollment(enrollmentId)`
- `completeEnrollment(enrollmentId)` - Mark as completed

---

### Task 6: Service - Timezone Batch Processor
**Priority:** Medium | **Parallelizable:** No (after T3)

Create `server/src/services/timezone-processor.ts`:

- `createTimezoneBatches(campaignId, recipients, targetTime)` - Group by timezone
- `processScheduledBatches()` - Send due batches
- Helper: `getUtcTimeForLocal(localTime, timezone)` - Convert local to UTC

---

### Task 7: Routes - Recurring Campaigns CRUD
**Priority:** High | **Parallelizable:** Yes (after T4)

Create `server/src/routes/recurring.ts`:

- GET /api/recurring - List all recurring campaigns
- POST /api/recurring - Create new recurring campaign
- GET /api/recurring/:id - Get single recurring campaign
- PUT /api/recurring/:id - Update recurring campaign
- DELETE /api/recurring/:id - Delete recurring campaign
- POST /api/recurring/:id/run - Manually trigger a run

---

### Task 8: Routes - Sequences CRUD + Enrollments
**Priority:** High | **Parallelizable:** Yes (after T5)

Create `server/src/routes/sequences.ts`:

- GET /api/sequences - List all sequences
- POST /api/sequences - Create new sequence
- GET /api/sequences/:id - Get sequence with steps
- PUT /api/sequences/:id - Update sequence
- DELETE /api/sequences/:id - Delete sequence
- POST /api/sequences/:id/steps - Add step
- PUT /api/sequences/:id/steps/:stepId - Update step
- DELETE /api/sequences/:id/steps/:stepId - Delete step
- GET /api/sequences/:id/enrollments - List enrollments
- POST /api/sequences/:id/enroll - Enroll recipients
- PUT /api/sequences/:id/enrollments/:enrollmentId - Pause/cancel

---

### Task 9: Integrate into Scheduler
**Priority:** High | **Parallelizable:** No (after T4, T5, T6)

Update `server/src/services/scheduler.ts`:

- Add cron job for recurring campaigns (every minute)
- Add cron job for sequence processing (every minute)
- Add cron job for scheduled batches (every minute)
- Import and call the processor functions

---

### Task 10: Register Routes and Build
**Priority:** High | **Parallelizable:** No (after all)

Update `server/src/index.ts`:
- Import and mount recurring routes
- Import and mount sequences routes

Verify:
- TypeScript compiles
- Build succeeds
- Server starts

---

## Execution Plan

### Parallel Group 1
- **Task 1:** recurring_campaigns table
- **Task 2:** sequences tables
- **Task 3:** scheduled_batches table

### Sequential Group (after Group 1)
- **Task 4:** Recurring processor (after T1)
- **Task 5:** Sequence processor (after T2)
- **Task 6:** Timezone processor (after T3)

### Parallel Group 2 (after processors)
- **Task 7:** Recurring routes (after T4)
- **Task 8:** Sequences routes (after T5)

### Final Sequential
- **Task 9:** Scheduler integration
- **Task 10:** Register routes and build

---

## Files to Create/Modify

| File | Action | Task |
|------|--------|------|
| `server/src/db/index.ts` | Modify | T1, T2, T3 |
| `server/src/services/recurring-processor.ts` | Create | T4 |
| `server/src/services/sequence-processor.ts` | Create | T5 |
| `server/src/services/timezone-processor.ts` | Create | T6 |
| `server/src/routes/recurring.ts` | Create | T7 |
| `server/src/routes/sequences.ts` | Create | T8 |
| `server/src/services/scheduler.ts` | Modify | T9 |
| `server/src/index.ts` | Modify | T10 |
