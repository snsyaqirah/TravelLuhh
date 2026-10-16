-- TravelLuhh migration 002: revamp
--
-- Apply once to an existing database (Neon or local), e.g.
--   psql "$DATABASE_URL" -f backend/migrations/002_revamp.sql
-- Idempotent: every statement is guarded, so running it again is a no-op.
-- Runs in one transaction: if anything fails, nothing is applied.
-- Fresh databases get the same DDL from backend/schema.sql and don't need this file.
--
-- What it does
--   1. trip_fund_entries table (travel fund) + index on trip_id
--   2. expenses.paid_by / notes / fx_rate
--   3. email_verification_codes.attempts (OTP attempt counter)
--   4. Backfill original_amount / original_currency / converted_amount on old expenses
--   5. trips.season CHECK (spring | summer | autumn | winter | tropical | NULL)
--   6. Expense triggers: safe when an UPDATE moves an expense between trips or payers;
--      member budgets attribute spend to COALESCE(paid_by, added_by)
--   7. Lists expenses whose currency differs from their trip's (they need a manual fix)
--   8. One quick-info note per (trip, key): drops older duplicates, then a partial unique index

BEGIN;

-- 1. Travel fund -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trip_fund_entries (
    entry_id    BIGSERIAL      PRIMARY KEY,
    trip_id     BIGINT         NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
    user_id     BIGINT         REFERENCES users(user_id) ON DELETE SET NULL,
    amount      DECIMAL(12, 2) NOT NULL,                -- trip currency; negative = withdrawal
    note        TEXT,
    entry_date  DATE           NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_tfe_amount CHECK (amount <> 0)
);

CREATE INDEX IF NOT EXISTS idx_tfe_trip ON trip_fund_entries(trip_id);

-- 2. Expenses: who paid, notes, exchange rate --------------------------------
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_by BIGINT NULL REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes   TEXT NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS fx_rate DECIMAL(18, 8) NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses(paid_by);

-- 3. OTP attempt counter -----------------------------------------------------
ALTER TABLE email_verification_codes ADD COLUMN IF NOT EXISTS attempts INT DEFAULT 0;

-- 4. Backfill the original-amount columns (they held the 0 / 'USD' placeholders) ----------
UPDATE expenses
SET original_amount   = amount,
    original_currency = currency,
    converted_amount  = amount
WHERE original_amount = 0;

-- 5. Season CHECK. season was never written by the app before, so anything unexpected is cleared.
-- (The column is in every schema.sql since the first release; ADD ... IF NOT EXISTS is a safety net.)
ALTER TABLE trips ADD COLUMN IF NOT EXISTS season VARCHAR(20);

UPDATE trips SET season = lower(btrim(season))
WHERE season IS NOT NULL AND season <> lower(btrim(season));

UPDATE trips SET season = NULL
WHERE season IS NOT NULL
  AND season NOT IN ('spring', 'summer', 'autumn', 'winter', 'tropical');

ALTER TABLE trips DROP CONSTRAINT IF EXISTS chk_trips_season;
ALTER TABLE trips ADD CONSTRAINT chk_trips_season
    CHECK (season IS NULL OR season IN ('spring', 'summer', 'autumn', 'winter', 'tropical'));

-- 6. Triggers ----------------------------------------------------------------

-- What a member has paid on a trip: expenses attributed to COALESCE(paid_by, added_by).
CREATE OR REPLACE FUNCTION member_paid_total(p_trip_id BIGINT, p_user_id BIGINT)
RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
    SELECT COALESCE(SUM(amount), 0) FROM expenses
    WHERE trip_id = p_trip_id AND COALESCE(paid_by, added_by) = p_user_id
$$;

-- trips.spent_amount = SUM(expenses.amount) for the trip. Same result as before; an UPDATE that
-- moves an expense to another trip now also recomputes the trip it left.
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

DROP TRIGGER IF EXISTS trg_update_trip_spent ON expenses;
CREATE TRIGGER trg_update_trip_spent
AFTER INSERT OR UPDATE OR DELETE ON expenses
FOR EACH ROW EXECUTE FUNCTION update_trip_spent();

-- trip_member_budgets.spent_amount follows member_paid_total(). It is kept current for every
-- budget type (rows only exist once the owner allocates), so switching a trip to 'separated'
-- later shows correct numbers straight away. An UPDATE that changes the trip or the payer
-- recomputes both the old and the new payer.
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

DROP TRIGGER IF EXISTS trg_update_member_budget_spent ON expenses;
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

DROP TRIGGER IF EXISTS trg_init_member_budget_spent ON trip_member_budgets;
CREATE TRIGGER trg_init_member_budget_spent
BEFORE INSERT ON trip_member_budgets
FOR EACH ROW EXECUTE FUNCTION init_member_budget_spent();

-- Re-attribute existing allocations with the new rule (only rows whose value changes).
UPDATE trip_member_budgets
SET spent_amount = member_paid_total(trip_id, user_id)
WHERE spent_amount IS DISTINCT FROM member_paid_total(trip_id, user_id);

-- 7. Expenses stored in a currency other than their trip's were summed raw before this release.
-- They are not changed automatically; list them with:
--   SELECT e.expense_id, e.trip_id, e.amount, e.currency, t.currency AS trip_currency, e.description
--   FROM expenses e JOIN trips t USING (trip_id) WHERE e.currency <> t.currency;
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM expenses e JOIN trips t USING (trip_id) WHERE e.currency <> t.currency;
    IF v_count > 0 THEN
        RAISE NOTICE '% expense(s) are in a different currency from their trip and need a manual fix (see step 7).', v_count;
    END IF;
END;
$$;

-- 8. Quick-info notes are upserted by (trip_id, info_key). Without a unique index two saves at the same moment
-- can both insert. Keep the most recently updated row of any duplicate set, then enforce one per key.
DELETE FROM destination_notes d
USING destination_notes k
WHERE d.note_type = 'quick_info'
  AND k.note_type = 'quick_info'
  AND d.trip_id = k.trip_id
  AND d.info_key = k.info_key
  AND (COALESCE(d.updated_at, d.created_at), d.note_id) < (COALESCE(k.updated_at, k.created_at), k.note_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dn_quick_info ON destination_notes(trip_id, info_key) WHERE note_type = 'quick_info';

COMMIT;
