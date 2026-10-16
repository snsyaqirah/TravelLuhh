package com.travelluhh.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * The schema is applied by hand (ddl-auto: none), so a database that never got
 * backend/migrations/002_revamp.sql would only fail later with SQL errors mid-request.
 * This checks for the revamp's tables/columns at startup and stops the app with a message that
 * says exactly what to run.
 *
 * app.schema-check: fail (default) stops startup, warn only logs, off skips the check.
 */
@Slf4j
@Component
public class SchemaCheck implements ApplicationRunner {

    static final String MIGRATION_FILE = "backend/migrations/002_revamp.sql";

    /** table, column (null = the table itself). */
    private static final String[][] REQUIRED = {
            {"trip_fund_entries", null},
            {"expenses", "paid_by"},
            {"expenses", "notes"},
            {"expenses", "fx_rate"},
            {"email_verification_codes", "attempts"},
            {"trips", "season"},
    };

    private final JdbcTemplate jdbc;
    private final String mode;

    public SchemaCheck(JdbcTemplate jdbc, @Value("${app.schema-check:fail}") String mode) {
        this.jdbc = jdbc;
        this.mode = mode == null ? "fail" : mode.trim().toLowerCase(Locale.ROOT);
    }

    @Override
    public void run(ApplicationArguments args) {
        if ("off".equals(mode)) {
            log.info("Schema check skipped (app.schema-check=off)");
            return;
        }

        List<String> missing = findMissing();
        if (missing.isEmpty()) {
            log.info("Schema check passed: revamp tables and columns are present");
            return;
        }

        String message = "Database schema is out of date. Missing: " + String.join(", ", missing) + ". "
                + "Run " + MIGRATION_FILE + " against this database once (it is safe to re-run), "
                + "for example: psql \"$DATABASE_URL\" -f " + MIGRATION_FILE + " , then restart. "
                + "To start anyway, set app.schema-check=warn (or SCHEMA_CHECK=warn).";
        if ("warn".equals(mode)) {
            log.warn(message);
            return;
        }
        throw new IllegalStateException(message);
    }

    List<String> findMissing() {
        List<String> missing = new ArrayList<>();
        for (String[] item : REQUIRED) {
            String table = item[0];
            String column = item[1];
            boolean present = column == null ? tableExists(table) : columnExists(table, column);
            if (!present) {
                missing.add(column == null ? "table " + table : table + "." + column);
            }
        }
        return missing;
    }

    private boolean tableExists(String table) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables "
                        + "WHERE table_schema = current_schema() AND table_name = ?",
                Integer.class, table);
        return count != null && count > 0;
    }

    private boolean columnExists(String table, String column) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE table_schema = current_schema() AND table_name = ? AND column_name = ?",
                Integer.class, table, column);
        return count != null && count > 0;
    }
}
