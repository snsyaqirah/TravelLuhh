-- TravelLuhh Database Schema
-- PostgreSQL 15+ | Neon Tech
--
-- Fresh database: run this file. It already includes every migration in backend/migrations/.
-- Existing database: do NOT run this file (it drops everything). Apply the files in
-- backend/migrations/ instead, e.g. psql "$DATABASE_URL" -f backend/migrations/002_revamp.sql
-- The backend refuses to start if the 002 tables/columns are missing (config/SchemaCheck.java).

-- ============================================
-- DROP (for re-runs during development)
-- Children first; CASCADE also removes the triggers that hang off each table.
-- ============================================
DROP TABLE IF EXISTS trip_fund_entries        CASCADE;
DROP TABLE IF EXISTS budget_alerts            CASCADE;
DROP TABLE IF EXISTS destination_notes        CASCADE;
DROP TABLE IF EXISTS itinerary_items          CASCADE;
DROP TABLE IF EXISTS trip_activities          CASCADE;
DROP TABLE IF EXISTS packing_items            CASCADE;
DROP TABLE IF EXISTS expense_sub_items        CASCADE;
DROP TABLE IF EXISTS expenses                 CASCADE;
DROP TABLE IF EXISTS trip_member_budgets      CASCADE;
DROP TABLE IF EXISTS trip_members             CASCADE;
DROP TABLE IF EXISTS trips                    CASCADE;
DROP TABLE IF EXISTS refresh_tokens           CASCADE;
DROP TABLE IF EXISTS email_verification_codes CASCADE;
DROP TABLE IF EXISTS users                    CASCADE;

-- ============================================
-- 1. USERS TABLE
-- ============================================
CREATE TABLE users (
    user_id         BIGSERIAL PRIMARY KEY,
    name            VARCHAR(100),                        -- NULL until complete-signup
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255),                        -- NULL for Google OAuth users
    avatar          VARCHAR(500),

    -- Auth
    auth_provider   VARCHAR(20)  DEFAULT 'local',        -- 'local' | 'google'
    google_id       VARCHAR(255) UNIQUE,
    email_verified  BOOLEAN      DEFAULT false,

    -- Profile (set during onboarding)
    country         VARCHAR(2),                          -- ISO-2 (MY, US, JP …)
    currency        VARCHAR(3)   DEFAULT 'USD',          -- ISO-4217
    onboarding_completed BOOLEAN DEFAULT false,

    -- Timestamps
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_users_auth_provider CHECK (auth_provider IN ('local', 'google'))
);

CREATE INDEX idx_users_email       ON users(email);
CREATE INDEX idx_users_google_id   ON users(google_id);

-- ============================================
-- 2. EMAIL VERIFICATION CODES TABLE
-- (signup OTP + forgot-password OTP)
-- ============================================
CREATE TABLE email_verification_codes (
    id          BIGSERIAL PRIMARY KEY,
    email       VARCHAR(255) NOT NULL,
    code        VARCHAR(10)  NOT NULL,           -- 6-digit OTP
    purpose     VARCHAR(20)  NOT NULL,           -- 'signup' | 'forgot_password'
    expires_at  TIMESTAMP    NOT NULL,
    used        BOOLEAN      DEFAULT false,
    attempts    INT          DEFAULT 0,          -- wrong guesses so far (002)
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_evc_purpose CHECK (purpose IN ('signup', 'forgot_password'))
);

CREATE INDEX idx_evc_email   ON email_verification_codes(email);
CREATE INDEX idx_evc_purpose ON email_verification_codes(purpose);

-- ============================================
-- 3. REFRESH TOKENS TABLE
-- ============================================
CREATE TABLE refresh_tokens (
    token_id    BIGSERIAL PRIMARY KEY,
    user_id     BIGINT       NOT NULL,
    token       VARCHAR(500) UNIQUE NOT NULL,
    expires_at  TIMESTAMP    NOT NULL,
    is_revoked  BOOLEAN      DEFAULT false,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_refresh_tokens_token      ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_user       ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_is_revoked ON refresh_tokens(is_revoked);

-- ============================================
-- 4. TRIPS TABLE
-- ============================================
CREATE TABLE trips (
    trip_id             BIGSERIAL PRIMARY KEY,
    owner_id            BIGINT       NOT NULL,
    name                VARCHAR(255) NOT NULL,
    destination_country VARCHAR(2)   NOT NULL,
    start_date          DATE         NOT NULL,
    end_date            DATE         NOT NULL,

    budget_type     VARCHAR(20)     DEFAULT 'solo',
    total_budget    DECIMAL(12, 2)  NOT NULL,
    spent_amount    DECIMAL(12, 2)  DEFAULT 0.00,
    remaining_budget DECIMAL(12, 2) GENERATED ALWAYS AS (total_budget - spent_amount) STORED,

    currency        VARCHAR(3)  DEFAULT 'USD',
    season          VARCHAR(20),                       -- spring | summer | autumn | winter | tropical
    description     TEXT,
    image           VARCHAR(500),
    notes           TEXT,
    status          VARCHAR(20) DEFAULT 'PLANNED',
    is_archived     BOOLEAN     DEFAULT false,
    created_at      TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (owner_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT chk_trips_dates       CHECK (end_date >= start_date),
    CONSTRAINT chk_trips_budget      CHECK (total_budget > 0),
    CONSTRAINT chk_trips_budget_type CHECK (budget_type IN ('solo', 'shared', 'separated')),
    CONSTRAINT chk_trips_status      CHECK (status IN ('PLANNED', 'ONGOING', 'COMPLETED')),
    CONSTRAINT chk_trips_season      CHECK (season IS NULL OR season IN ('spring', 'summer', 'autumn', 'winter', 'tropical'))
);

CREATE INDEX idx_trips_owner       ON trips(owner_id);
CREATE INDEX idx_trips_dates       ON trips(start_date, end_date);
CREATE INDEX idx_trips_is_archived ON trips(is_archived);

-- ============================================
-- 5. TRIP_MEMBERS TABLE
-- ============================================
CREATE TABLE trip_members (
    member_id   BIGSERIAL PRIMARY KEY,
    trip_id     BIGINT      NOT NULL,
    user_id     BIGINT      NOT NULL,
    role        VARCHAR(20) DEFAULT 'editor',
    joined_at   TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    created_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (trip_id) REFERENCES trips(trip_id)  ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id)  ON DELETE CASCADE,
    UNIQUE(trip_id, user_id),
    CONSTRAINT chk_trip_members_role CHECK (role IN ('owner', 'editor', 'viewer'))
);

CREATE INDEX idx_trip_members_trip ON trip_members(trip_id);
CREATE INDEX idx_trip_members_user ON trip_members(user_id);

-- ============================================
-- 6. TRIP_MEMBER_BUDGETS TABLE (separated budget)
-- ============================================
CREATE TABLE trip_member_budgets (
    budget_id        BIGSERIAL PRIMARY KEY,
    trip_id          BIGINT         NOT NULL,
    user_id          BIGINT         NOT NULL,
    allocated_budget DECIMAL(12, 2) NOT NULL,
    spent_amount     DECIMAL(12, 2) DEFAULT 0.00,
    remaining_budget DECIMAL(12, 2) GENERATED ALWAYS AS (allocated_budget - spent_amount) STORED,
    created_at       TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (trip_id) REFERENCES trips(trip_id)  ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id)  ON DELETE CASCADE,
    UNIQUE(trip_id, user_id),
    CONSTRAINT chk_tmb_allocated CHECK (allocated_budget > 0)
);

CREATE INDEX idx_tmb_trip ON trip_member_budgets(trip_id);
CREATE INDEX idx_tmb_user ON trip_member_budgets(user_id);

-- ============================================
-- 7. EXPENSES TABLE
-- ============================================
CREATE TABLE expenses (
    expense_id        BIGSERIAL PRIMARY KEY,
    trip_id           BIGINT         NOT NULL,
    added_by          BIGINT,                          -- who logged it
    paid_by           BIGINT,                          -- who paid; NULL = added_by (002)
    category          VARCHAR(50)    NOT NULL,
    amount            DECIMAL(12, 2) NOT NULL,         -- trip currency
    original_amount   DECIMAL(12, 2) NOT NULL,         -- what was paid, in original_currency
    original_currency VARCHAR(3)     NOT NULL,
    converted_amount  DECIMAL(12, 2) NOT NULL,         -- = amount
    currency          VARCHAR(3)     NOT NULL,         -- = trip currency
    fx_rate           DECIMAL(18, 8),                  -- original_amount x fx_rate ~= amount (002)
    date              DATE           NOT NULL,
    description       TEXT,
    notes             TEXT,                            -- (002)
    created_at        TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (trip_id)   REFERENCES trips(trip_id)  ON DELETE CASCADE,
    FOREIGN KEY (added_by)  REFERENCES users(user_id)  ON DELETE SET NULL,
    FOREIGN KEY (paid_by)   REFERENCES users(user_id)  ON DELETE SET NULL,
    CONSTRAINT chk_expenses_category CHECK (category IN (
        'accommodation', 'transportation', 'food', 'activities', 'shopping', 'other', 'bundle'
    )),
    CONSTRAINT chk_expenses_amount CHECK (amount >= 0)
);

CREATE INDEX idx_expenses_trip     ON expenses(trip_id);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_date     ON expenses(date);
CREATE INDEX idx_expenses_added_by ON expenses(added_by);
CREATE INDEX idx_expenses_paid_by  ON expenses(paid_by);

-- ============================================
-- 8. EXPENSE_SUB_ITEMS TABLE (optional breakdown for bundle expenses)
-- ============================================
CREATE TABLE expense_sub_items (
    sub_item_id BIGSERIAL PRIMARY KEY,
    expense_id  BIGINT         NOT NULL,
    description VARCHAR(255)   NOT NULL,
    amount      DECIMAL(12, 2) NOT NULL,
    category    VARCHAR(50),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (expense_id) REFERENCES expenses(expense_id) ON DELETE CASCADE
);

CREATE INDEX idx_sub_items_expense ON expense_sub_items(expense_id);

-- ============================================
-- 9. PACKING_ITEMS TABLE
-- ============================================
CREATE TABLE packing_items (
    item_id    BIGSERIAL PRIMARY KEY,
    trip_id    BIGINT       NOT NULL,
    added_by   BIGINT,
    label      VARCHAR(255) NOT NULL,
    category   VARCHAR(50),
    is_checked BOOLEAN      DEFAULT false,
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (trip_id)  REFERENCES trips(trip_id)  ON DELETE CASCADE,
    FOREIGN KEY (added_by) REFERENCES users(user_id)  ON DELETE SET NULL
);

CREATE INDEX idx_packing_trip ON packing_items(trip_id);

-- ============================================
-- 10. TRIP_ACTIVITIES TABLE
-- ============================================
CREATE TABLE trip_activities (
    activity_id BIGSERIAL PRIMARY KEY,
    trip_id     BIGINT       NOT NULL,
    user_id     BIGINT,
    actor_name  VARCHAR(100),
    action_type VARCHAR(50)  NOT NULL,
    description TEXT         NOT NULL,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (trip_id) REFERENCES trips(trip_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_activities_trip ON trip_activities(trip_id);
CREATE INDEX idx_activities_created ON trip_activities(created_at DESC);

-- ============================================
-- 11. ITINERARY_ITEMS TABLE
-- ============================================
CREATE TABLE itinerary_items (
    item_id     BIGSERIAL PRIMARY KEY,
    trip_id     BIGINT       NOT NULL,
    item_date   DATE         NOT NULL,
    start_time  TIME,
    end_time    TIME,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    location    VARCHAR(255),
    category    VARCHAR(50),
    sort_order  INTEGER      DEFAULT 0,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (trip_id) REFERENCES trips(trip_id) ON DELETE CASCADE
);

CREATE INDEX idx_itinerary_trip ON itinerary_items(trip_id);
CREATE INDEX idx_itinerary_date ON itinerary_items(item_date);

-- ============================================
-- 12. DESTINATION_NOTES TABLE
-- ============================================
CREATE TABLE destination_notes (
    note_id     BIGSERIAL PRIMARY KEY,
    trip_id     BIGINT       NOT NULL,
    note_type   VARCHAR(20)  DEFAULT 'custom',
    info_key    VARCHAR(50),
    title       VARCHAR(255),
    content     TEXT         NOT NULL,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (trip_id) REFERENCES trips(trip_id) ON DELETE CASCADE,
    CONSTRAINT chk_dn_type CHECK (note_type IN ('quick_info', 'custom'))
);

CREATE INDEX idx_dn_trip ON destination_notes(trip_id);
CREATE INDEX idx_dn_type ON destination_notes(note_type);
CREATE INDEX idx_dn_key  ON destination_notes(info_key);
-- One quick-info note per key per trip (the notes API upserts on it).
CREATE UNIQUE INDEX uq_dn_quick_info ON destination_notes(trip_id, info_key) WHERE note_type = 'quick_info';

-- ============================================
-- 13. BUDGET_ALERTS TABLE (unused by the app today)
-- ============================================
CREATE TABLE budget_alerts (
    alert_id     BIGSERIAL PRIMARY KEY,
    user_id      BIGINT      NOT NULL,
    trip_id      BIGINT      NOT NULL,
    alert_type   VARCHAR(50) NOT NULL,
    is_dismissed BOOLEAN     DEFAULT false,
    dismissed_at TIMESTAMP,
    created_at   TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (trip_id) REFERENCES trips(trip_id) ON DELETE CASCADE
);

CREATE INDEX idx_ba_user ON budget_alerts(user_id);
CREATE INDEX idx_ba_trip ON budget_alerts(trip_id);

-- ============================================
-- 14. TRIP_FUND_ENTRIES TABLE (travel fund, 002)
-- ============================================
CREATE TABLE trip_fund_entries (
    entry_id    BIGSERIAL      PRIMARY KEY,
    trip_id     BIGINT         NOT NULL,
    user_id     BIGINT,
    amount      DECIMAL(12, 2) NOT NULL,                -- trip currency; negative = withdrawal
    note        TEXT,
    entry_date  DATE           NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (trip_id) REFERENCES trips(trip_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chk_tfe_amount CHECK (amount <> 0)
);

CREATE INDEX idx_tfe_trip ON trip_fund_entries(trip_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- What a member has paid on a trip: expenses attributed to COALESCE(paid_by, added_by).
CREATE OR REPLACE FUNCTION member_paid_total(p_trip_id BIGINT, p_user_id BIGINT)
RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
    SELECT COALESCE(SUM(amount), 0) FROM expenses
    WHERE trip_id = p_trip_id AND COALESCE(paid_by, added_by) = p_user_id
$$;

-- trips.spent_amount = SUM(expenses.amount) for the trip. An UPDATE that moves an expense to
-- another trip also recomputes the trip it left.
CREATE OR REPLACE FUNCTION recalc_trip_spent(p_trip_id BIGINT)
RETURNS VOID
LANGUAGE sql AS $$
    UPDATE trips
    SET spent_amount = (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE trip_id = p_trip_id),
        updated_at   = CURRENT_TIMESTAMP
    WHERE trip_id = p_trip_id
$$;

CREATE OR REPLACE FUNCTION update_trip_spent()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM recalc_trip_spent(NEW.trip_id);
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM recalc_trip_spent(NEW.trip_id);
        IF OLD.trip_id IS DISTINCT FROM NEW.trip_id THEN
            PERFORM recalc_trip_spent(OLD.trip_id);
        END IF;
    ELSE
        PERFORM recalc_trip_spent(OLD.trip_id);
    END IF;
    RETURN NULL; -- AFTER trigger: the return value is ignored
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_trip_spent
AFTER INSERT OR UPDATE OR DELETE ON expenses
FOR EACH ROW EXECUTE FUNCTION update_trip_spent();

-- trip_member_budgets.spent_amount follows member_paid_total() for every budget type (rows only
-- exist once the owner allocates). An UPDATE that changes the trip or the payer recomputes both
-- the old and the new payer.
CREATE OR REPLACE FUNCTION recalc_member_budget_spent(p_trip_id BIGINT, p_user_id BIGINT)
RETURNS VOID
LANGUAGE sql AS $$
    UPDATE trip_member_budgets
    SET spent_amount = member_paid_total(p_trip_id, p_user_id),
        updated_at   = CURRENT_TIMESTAMP
    WHERE trip_id = p_trip_id AND user_id = p_user_id
$$;

CREATE OR REPLACE FUNCTION update_member_budget_spent()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM recalc_member_budget_spent(NEW.trip_id, COALESCE(NEW.paid_by, NEW.added_by));
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM recalc_member_budget_spent(NEW.trip_id, COALESCE(NEW.paid_by, NEW.added_by));
        IF OLD.trip_id IS DISTINCT FROM NEW.trip_id
           OR COALESCE(OLD.paid_by, OLD.added_by) IS DISTINCT FROM COALESCE(NEW.paid_by, NEW.added_by) THEN
            PERFORM recalc_member_budget_spent(OLD.trip_id, COALESCE(OLD.paid_by, OLD.added_by));
        END IF;
    ELSE
        PERFORM recalc_member_budget_spent(OLD.trip_id, COALESCE(OLD.paid_by, OLD.added_by));
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_member_budget_spent
AFTER INSERT OR UPDATE OR DELETE ON expenses
FOR EACH ROW EXECUTE FUNCTION update_member_budget_spent();

-- A new allocation starts from what the member has already paid, not from 0.
CREATE OR REPLACE FUNCTION init_member_budget_spent()
RETURNS TRIGGER AS $$
BEGIN
    NEW.spent_amount := member_paid_total(NEW.trip_id, NEW.user_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_init_member_budget_spent
BEFORE INSERT ON trip_member_budgets
FOR EACH ROW EXECUTE FUNCTION init_member_budget_spent();

-- Auto-update updated_at on all tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at             BEFORE UPDATE ON users             FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_trips_updated_at             BEFORE UPDATE ON trips             FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_trip_members_updated_at      BEFORE UPDATE ON trip_members      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_tmb_updated_at               BEFORE UPDATE ON trip_member_budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_expenses_updated_at          BEFORE UPDATE ON expenses          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_dn_updated_at                BEFORE UPDATE ON destination_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_ba_updated_at                BEFORE UPDATE ON budget_alerts     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_refresh_tokens_updated_at    BEFORE UPDATE ON refresh_tokens    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATIONS FOR EXISTING DATABASES
-- ============================================
-- Older hand-applied changes (dropping is_deleted, adding expense_sub_items, packing_items,
-- trip_activities, itinerary_items) are already part of the tables above; see git history for
-- the original snippets. Everything after that lives in backend/migrations/ and is idempotent:
--   002_revamp.sql  travel fund, expenses.paid_by/notes/fx_rate, OTP attempts, season CHECK,
--                   trigger fixes, original-amount backfill
