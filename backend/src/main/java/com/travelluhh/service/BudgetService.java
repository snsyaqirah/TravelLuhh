package com.travelluhh.service;

import com.travelluhh.dto.budget.BudgetAllocationRequest;
import com.travelluhh.dto.budget.MemberBudgetResponse;
import com.travelluhh.entity.Trip;
import com.travelluhh.entity.TripMember;
import com.travelluhh.entity.TripMember.MemberRole;
import com.travelluhh.entity.TripMemberBudget;
import com.travelluhh.entity.User;
import com.travelluhh.exception.BadRequestException;
import com.travelluhh.repository.ExpenseRepository;
import com.travelluhh.repository.TripMemberBudgetRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Per-person budgets on separated trips (table trip_member_budgets, API contract, Budget allocations).
 *
 * Only allocated_budget is ever written. spent_amount is filled by the database (from what the
 * member paid, COALESCE(paid_by, added_by)) and remaining_budget is generated. allocated_budget has
 * CHECK > 0, so an allocation of 0 deletes the row.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class BudgetService {

    static final String NOT_SEPARATED = "Per-person budgets are only for separated trips. Switch the budget type first.";

    /** DECIMAL(12, 2): 10 digits before the point. */
    private static final BigDecimal MAX_ALLOCATION = new BigDecimal("9999999999.99");

    private final TripMemberBudgetRepository budgetRepository;
    private final ExpenseRepository expenseRepository;
    private final MemberService memberService;
    private final TripAccessService tripAccess;
    private final ActivityService activityService;

    /** Any member. One row per person on the trip; anyone without an allocation shows allocated 0. */
    @Transactional(readOnly = true)
    public List<MemberBudgetResponse> getBudgets(Long tripId, String userEmail) {
        Trip trip = tripAccess.requireMember(tripId, userEmail);
        return toResponses(trip, memberService.roster(trip));
    }

    /**
     * Owner only, separated trips only. Upserts the listed people; anyone not listed keeps their
     * allocation. Everything is validated before anything is written.
     */
    public List<MemberBudgetResponse> updateBudgets(Long tripId, List<BudgetAllocationRequest> allocations,
                                                    String userEmail) {
        TripAccessService.Access access = tripAccess.access(tripId, userEmail, MemberRole.owner);
        Trip trip = access.trip();
        if (!"separated".equalsIgnoreCase(trip.getBudgetType())) {
            throw new BadRequestException(NOT_SEPARATED);
        }
        if (allocations == null) {
            throw new BadRequestException("Send a list of budgets");
        }

        List<TripMember> roster = memberService.roster(trip);
        Map<Long, TripMember> people = roster.stream()
                .collect(Collectors.toMap(TripMember::getUserId, Function.identity(), (a, b) -> a, LinkedHashMap::new));
        Map<Long, BigDecimal> wanted = validate(allocations, people);

        // Rows left over from people who are no longer on the trip.
        budgetRepository.deleteByTripIdAndUserIdNotIn(tripId, people.keySet());
        Map<Long, TripMemberBudget> existing = budgetRepository.findByTripIdOrderByIdAsc(tripId).stream()
                .collect(Collectors.toMap(TripMemberBudget::getUserId, Function.identity(), (a, b) -> a));

        List<String> changes = new ArrayList<>();
        for (Map.Entry<Long, BigDecimal> e : wanted.entrySet()) {
            Long userId = e.getKey();
            BigDecimal amount = e.getValue();
            TripMemberBudget row = existing.get(userId);
            String who = TripAccessService.actorName(people.get(userId).getUser());

            if (amount.signum() == 0) {
                if (row != null) {
                    budgetRepository.delete(row);
                    changes.add(who + " none");
                }
            } else if (row == null) {
                budgetRepository.save(TripMemberBudget.builder()
                        .tripId(tripId)
                        .userId(userId)
                        .allocatedBudget(amount)
                        .build());
                changes.add(who + " " + ExpenseService.formatMoney(amount, trip.getCurrency()));
            } else if (row.getAllocatedBudget() == null || row.getAllocatedBudget().compareTo(amount) != 0) {
                row.setAllocatedBudget(amount);
                budgetRepository.save(row);
                changes.add(who + " " + ExpenseService.formatMoney(amount, trip.getCurrency()));
            }
        }
        // Writes go out now so the generated spent/remaining values are re-read for the response.
        budgetRepository.flush();

        if (!changes.isEmpty()) {
            User actor = access.user();
            logActivity(tripId, actor, TripAccessService.actorName(actor)
                    + " updated the budget split: " + String.join(", ", changes));
        }
        return toResponses(trip, roster);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** userId → allocation (2 dp), in request order. Throws 400 on the first bad entry. */
    private static Map<Long, BigDecimal> validate(List<BudgetAllocationRequest> allocations,
                                                  Map<Long, TripMember> people) {
        Map<Long, BigDecimal> wanted = new LinkedHashMap<>();
        for (BudgetAllocationRequest a : allocations) {
            if (a == null || a.getUserId() == null) {
                throw new BadRequestException("Each budget needs a userId");
            }
            if (!people.containsKey(a.getUserId())) {
                throw new BadRequestException("Everyone in the split must be on this trip");
            }
            BigDecimal amount = a.getAllocated();
            if (amount == null) {
                throw new BadRequestException("Each budget needs an amount");
            }
            if (amount.signum() < 0) {
                throw new BadRequestException("A budget can't be negative");
            }
            if (amount.stripTrailingZeros().scale() > 2) {
                throw new BadRequestException("Budgets can have at most 2 decimal places");
            }
            if (amount.compareTo(MAX_ALLOCATION) > 0) {
                throw new BadRequestException("That budget is too large");
            }
            if (wanted.put(a.getUserId(), amount.setScale(2, RoundingMode.UNNECESSARY)) != null) {
                throw new BadRequestException("Each person can appear only once");
            }
        }
        return wanted;
    }

    private List<MemberBudgetResponse> toResponses(Trip trip, List<TripMember> roster) {
        Long tripId = trip.getId();
        Map<Long, TripMemberBudget> rows = budgetRepository.findByTripIdOrderByIdAsc(tripId).stream()
                .collect(Collectors.toMap(TripMemberBudget::getUserId, Function.identity(), (a, b) -> a));
        // People without a row have no trigger-maintained spend, so it comes from the expenses.
        Map<Long, BigDecimal> paid = new HashMap<>();
        for (var total : expenseRepository.sumByPayer(tripId)) {
            if (total.getUserId() != null && total.getTotal() != null) {
                paid.put(total.getUserId(), total.getTotal());
            }
        }

        List<MemberBudgetResponse> result = new ArrayList<>(roster.size());
        for (TripMember m : roster) {
            TripMemberBudget row = rows.get(m.getUserId());
            BigDecimal allocated = row != null ? money(row.getAllocatedBudget()) : money(null);
            BigDecimal spent = row != null && row.getSpentAmount() != null
                    ? money(row.getSpentAmount())
                    : money(paid.get(m.getUserId()));
            BigDecimal remaining = row != null && row.getRemainingBudget() != null
                    ? money(row.getRemainingBudget())
                    : allocated.subtract(spent);
            User user = m.getUser();
            result.add(MemberBudgetResponse.builder()
                    .userId(m.getUserId())
                    .name(TripAccessService.actorName(user))
                    .avatar(user != null ? user.getAvatar() : null)
                    .allocated(allocated)
                    .spent(spent)
                    .remaining(remaining)
                    .build());
        }
        return result;
    }

    private static BigDecimal money(BigDecimal value) {
        return (value != null ? value : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    private void logActivity(Long tripId, User actor, String text) {
        try {
            activityService.log(tripId, actor.getId(), TripAccessService.actorName(actor), "budgets_updated", text);
        } catch (RuntimeException e) {
            log.warn("Could not log budgets_updated for trip {}: {}", tripId, e.getMessage());
        }
    }
}
