# Bounce Handling Design

## Overview

Track bounced emails, maintain a suppression list, and prevent sending to invalid addresses.

## Features

1. **Suppression List** - Database table of emails that should not receive mail
2. **Bounce Recording** - Log bounces with reason and timestamp
3. **Auto-Suppression** - Automatically add hard bounces to suppression list
4. **Pre-Send Check** - Filter out suppressed emails before sending
5. **Manual Management** - UI to view/add/remove suppressed emails
6. **Analytics** - Show bounce rates in campaign stats

## Database Schema

### suppression_list table
```sql
CREATE TABLE suppression_list (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,  -- 'hard_bounce', 'soft_bounce', 'complaint', 'manual'
  source TEXT,           -- campaign_id or 'manual'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### bounces table
```sql
CREATE TABLE bounces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES campaigns(id),
  email TEXT NOT NULL,
  bounce_type TEXT NOT NULL,  -- 'hard', 'soft'
  bounce_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

## API Endpoints

- `GET /api/suppression` - List suppressed emails (paginated, searchable)
- `POST /api/suppression` - Add email to suppression list
- `DELETE /api/suppression/:id` - Remove from suppression list
- `POST /api/suppression/import` - Bulk import suppressed emails
- `GET /api/suppression/export` - Export suppression list as CSV

## Implementation

### Backend Changes
1. Add database tables via migrations
2. Create suppression route with CRUD operations
3. Modify send.ts to filter out suppressed emails before sending
4. Add bounce recording when send fails with bounce error
5. Add suppression stats to analytics

### Frontend Changes
1. New "Suppression List" page in Settings or as sidebar item
2. Table with search, pagination
3. Add/Import/Export buttons
4. Show "X emails suppressed" in campaign send summary

## Send Flow Integration

```
Recipients → Filter Suppressed → Send → Log Result
                                    ↓
                              If Bounce → Record Bounce
                                    ↓
                              If Hard → Add to Suppression
```

## Bounce Detection

Since we use SMTP directly, bounces come as:
1. Immediate SMTP rejection (5xx errors) - Hard bounce
2. Deferred delivery (4xx errors) - Soft bounce

We'll detect from the error response during send.
