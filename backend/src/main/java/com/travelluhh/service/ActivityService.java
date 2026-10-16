package com.travelluhh.service;

import com.travelluhh.dto.activity.ActivityResponse;
import com.travelluhh.entity.TripActivity;
import com.travelluhh.entity.TripMember.MemberRole;
import com.travelluhh.repository.TripActivityRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Set;

/**
 * The trip logbook (table trip_activities).
 *
 * {@link #log} never throws and never joins the caller's transaction:
 * - Inside a transaction the row is written only once that transaction has committed, so a
 *   rolled-back change leaves no entry and a logging failure can't roll back the change.
 * - The write runs in its own REQUIRES_NEW transaction, which is the only kind that persists when
 *   called from an after-commit hook (TripService logs trip_created that way).
 * The hook used is afterCompletion, not afterCommit: Spring snapshots the afterCommit callbacks
 * before running them, so one registered from inside another afterCommit callback would be
 * dropped, while the afterCompletion list is read after all afterCommit callbacks have run.
 */
@Slf4j
@Service
public class ActivityService {

    /** Every actionType the frontend knows (API contract, Activity). */
    public static final Set<String> ACTION_TYPES = Set.of(
            "trip_created", "trip_updated",
            "expense_added", "expense_updated", "expense_deleted",
            "itinerary_added", "itinerary_updated", "itinerary_deleted",
            "packing_added", "packing_checked", "packing_unchecked", "packing_deleted", "packing_preset",
            "member_added", "member_removed", "member_role_changed", "member_left",
            "fund_added", "fund_deleted", "note_saved", "note_deleted", "budgets_updated");

    private static final int MAX_ACTOR = 100;       // trip_activities.actor_name VARCHAR(100)
    private static final int MAX_TYPE = 50;         // trip_activities.action_type VARCHAR(50)
    private static final int MAX_DESCRIPTION = 1000;

    private final TripActivityRepository activityRepository;
    private final TransactionTemplate requiresNew;
    private final TripAccessService tripAccess;

    public ActivityService(TripActivityRepository activityRepository,
                           PlatformTransactionManager transactionManager,
                           TripAccessService tripAccess) {
        this.activityRepository = activityRepository;
        this.tripAccess = tripAccess;
        this.requiresNew = new TransactionTemplate(transactionManager);
        this.requiresNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    // ── Feed ─────────────────────────────────────────────────────────────────

    /** GET /api/trips/{tripId}/activity: any member; newest first, at most 100 rows. */
    @Transactional(readOnly = true)
    public List<ActivityResponse> getActivities(Long tripId, String userEmail) {
        tripAccess.access(tripId, userEmail, MemberRole.viewer);
        return getActivities(tripId);
    }

    /** No access check: callers must have checked membership already. */
    @Transactional(readOnly = true)
    public List<ActivityResponse> getActivities(Long tripId) {
        return activityRepository.findTop100ByTripIdOrderByCreatedAtDescIdDesc(tripId).stream()
                .map(ActivityResponse::from)
                .toList();
    }

    // ── Logging ──────────────────────────────────────────────────────────────

    /**
     * Records one logbook line, e.g. log(9, 2, "Siti", "fund_added", "Siti put MYR 200.00 in the tabung").
     * description is the full sentence shown in the feed, starting with the actor's name.
     */
    public void log(Long tripId, Long userId, String actorName, String actionType, String description) {
        if (tripId == null || actionType == null || description == null) {
            log.warn("Skipped an activity row with missing fields (trip {}, type {})", tripId, actionType);
            return;
        }
        if (!ACTION_TYPES.contains(actionType)) {
            log.warn("Unknown activity type '{}' for trip {}; writing it anyway", actionType, tripId);
        }
        TripActivity row = TripActivity.builder()
                .tripId(tripId)
                .userId(userId)
                .actorName(truncate(actorName, MAX_ACTOR))
                .actionType(truncate(actionType, MAX_TYPE))
                .description(truncate(description, MAX_DESCRIPTION))
                .build();

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            try {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCompletion(int status) {
                        if (status == STATUS_COMMITTED) {
                            write(row);
                        }
                    }
                });
                return;
            } catch (RuntimeException e) {
                log.debug("Could not defer activity row, writing now: {}", e.getMessage());
            }
        }
        write(row);
    }

    private void write(TripActivity row) {
        try {
            requiresNew.executeWithoutResult(status -> activityRepository.save(row));
        } catch (RuntimeException e) {
            // The logbook is a convenience; the change it describes has already been saved.
            log.warn("Could not write {} activity for trip {}: {}", row.getActionType(), row.getTripId(), e.getMessage());
        }
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.length() <= max ? trimmed : trimmed.substring(0, max - 3) + "...";
    }
}
