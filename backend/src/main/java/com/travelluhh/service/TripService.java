package com.travelluhh.service;

import com.travelluhh.dto.trip.CreateTripRequest;
import com.travelluhh.dto.trip.TripResponse;
import com.travelluhh.dto.trip.UpdateTripRequest;
import com.travelluhh.entity.Trip;
import com.travelluhh.entity.TripMember;
import com.travelluhh.entity.TripMember.MemberRole;
import com.travelluhh.entity.User;
import com.travelluhh.exception.BadRequestException;
import com.travelluhh.exception.ForbiddenException;
import com.travelluhh.repository.ExpenseRepository;
import com.travelluhh.repository.TripFundEntryRepository;
import com.travelluhh.repository.TripMemberRepository;
import com.travelluhh.repository.TripRepository;
import com.travelluhh.util.Decimals;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class TripService {

    static final String BUDGET_DIGITS = "Budget can have at most 10 digits and 2 decimals";

    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;
    private final ExpenseRepository expenseRepository;
    private final TripFundEntryRepository fundEntryRepository;
    private final TripAccessService tripAccess;
    private final ActivityService activityService;

    // ── Commands ─────────────────────────────────────────────────────────────

    public TripResponse createTrip(CreateTripRequest request, String userEmail) {
        User user = tripAccess.currentUser(userEmail);
        requireBudgetSize(request.getBudget());
        requireDateOrder(request.getStartDate(), request.getEndDate());

        Trip trip = Trip.builder()
                .ownerId(user.getId())
                .owner(user)
                .name(request.getName().trim())
                .destinationCountry(upper(request.getDestinationCountry()))
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .description(request.getDescription())
                .image(blankToNull(request.getImage()))
                .budget(request.getBudget())
                .currency(upper(request.getCurrency()))
                .budgetType(normalizeBudgetType(request.getBudgetType(), "solo"))
                .season(normalizeSeason(request.getSeason()))
                .notes(request.getNotes())
                .status(request.getStatus() != null ? request.getStatus() : Trip.TripStatus.PLANNED)
                .isArchived(false)
                .build();
        trip = tripRepository.save(trip);

        // user is set in memory so the response needs no extra lookup (the column is insertable=false).
        TripMember ownerMember = TripMember.builder()
                .trip(trip)
                .userId(user.getId())
                .user(user)
                .role(MemberRole.owner)
                .build();
        tripMemberRepository.save(ownerMember);

        // The activity row references the new trip, so it can only be written once the trip is committed.
        Long tripId = trip.getId();
        String text = displayName(user) + " created the trip " + quote(trip.getName());
        afterCommit(() -> activityService.log(tripId, user.getId(), displayName(user), "trip_created", text));

        return toResponses(List.of(trip), user.getId()).get(0);
    }

    /** Partial update. Owner or editor; changing budgetType or isArchived is owner only. */
    public TripResponse updateTrip(Long tripId, UpdateTripRequest request, String userEmail) {
        TripAccessService.Access access = tripAccess.access(tripId, userEmail, MemberRole.editor);
        Trip trip = access.trip();
        requireBudgetSize(request.getBudget());
        List<String> changed = new ArrayList<>();

        String budgetType = normalizeBudgetType(request.getBudgetType(), null);
        if (budgetType != null && !budgetType.equals(trip.getBudgetType())) {
            requireOwner(access);
            trip.setBudgetType(budgetType);
            changed.add("budget type");
        }

        Boolean archive = request.getIsArchived();
        boolean archivedNow = Boolean.TRUE.equals(trip.getIsArchived());
        boolean archiveChanged = archive != null && archive != archivedNow;
        if (archiveChanged) {
            requireOwner(access);
            trip.setIsArchived(archive);
        }

        LocalDate start = request.getStartDate() != null ? request.getStartDate() : trip.getStartDate();
        LocalDate end = request.getEndDate() != null ? request.getEndDate() : trip.getEndDate();
        requireDateOrder(start, end);
        if (!start.equals(trip.getStartDate()) || !end.equals(trip.getEndDate())) {
            trip.setStartDate(start);
            trip.setEndDate(end);
            changed.add("dates");
        }

        String currency = upper(request.getCurrency());
        if (currency != null && !currency.equals(trip.getCurrency())) {
            // Every expense and fund entry is stored in the trip currency; switching would silently
            // reinterpret them all.
            if (expenseRepository.existsByTripId(tripId) || fundEntryRepository.existsByTripId(tripId)) {
                throw new BadRequestException("This trip already has entries in " + trip.getCurrency()
                        + ", so its currency can't change.");
            }
            trip.setCurrency(currency);
            changed.add("currency");
        }

        if (request.getName() != null && !request.getName().trim().equals(trip.getName())) {
            trip.setName(request.getName().trim());
            changed.add("name");
        }
        String country = upper(request.getDestinationCountry());
        if (country != null && !country.equals(trip.getDestinationCountry())) {
            trip.setDestinationCountry(country);
            changed.add("destination");
        }
        if (request.getBudget() != null
                && (trip.getBudget() == null || request.getBudget().compareTo(trip.getBudget()) != 0)) {
            trip.setBudget(request.getBudget());
            changed.add("budget");
        }
        if (request.getSeason() != null) {
            String season = normalizeSeason(request.getSeason());
            if (!Objects.equals(season, trip.getSeason())) {
                trip.setSeason(season);
                changed.add("season");
            }
        }
        if (request.getDescription() != null && !request.getDescription().equals(trip.getDescription())) {
            trip.setDescription(request.getDescription());
            changed.add("description");
        }
        if (request.getImage() != null && !Objects.equals(blankToNull(request.getImage()), trip.getImage())) {
            trip.setImage(blankToNull(request.getImage()));
            changed.add("cover image");
        }
        if (request.getNotes() != null && !request.getNotes().equals(trip.getNotes())) {
            trip.setNotes(request.getNotes());
            changed.add("notes");
        }
        if (request.getStatus() != null && request.getStatus() != trip.getStatus()) {
            trip.setStatus(request.getStatus());
            changed.add("status");
        }

        // Flush now so the generated remaining_budget is re-read before the response is built.
        trip = tripRepository.saveAndFlush(trip);

        User actor = access.user();
        if (archiveChanged) {
            logActivity(tripId, actor, "trip_updated", displayName(actor)
                    + (archive ? " archived the trip" : " moved the trip out of the archive"));
        }
        if (!changed.isEmpty()) {
            logActivity(tripId, actor, "trip_updated",
                    displayName(actor) + " updated the trip: " + String.join(", ", changed));
        }
        return toResponses(List.of(trip), actor.getId()).get(0);
    }

    /** Owner only. Children go with it through ON DELETE CASCADE. */
    public void deleteTrip(Long tripId, String userEmail) {
        Trip trip = tripAccess.requireOwner(tripId, userEmail);
        tripRepository.delete(trip);
    }

    // ── Queries ──────────────────────────────────────────────────────────────

    /** archived: "false" (default), "true" or "all". */
    @Transactional(readOnly = true)
    public List<TripResponse> getAllTripsForUser(String userEmail, String archived) {
        User user = tripAccess.currentUser(userEmail);
        String filter = archived == null || archived.isBlank() ? "false" : archived.trim().toLowerCase(Locale.ROOT);
        List<Trip> trips = switch (filter) {
            case "false" -> tripRepository.findForUser(user.getId(), false);
            case "true" -> tripRepository.findForUser(user.getId(), true);
            case "all" -> tripRepository.findAllForUser(user.getId());
            default -> throw new BadRequestException("archived must be true, false or all");
        };
        return toResponses(trips, user.getId());
    }

    @Transactional(readOnly = true)
    public List<TripResponse> getAllTripsForUser(String userEmail) {
        return getAllTripsForUser(userEmail, "false");
    }

    @Transactional(readOnly = true)
    public TripResponse getTripById(Long tripId, String userEmail) {
        TripAccessService.Access access = tripAccess.access(tripId, userEmail, MemberRole.viewer);
        return toResponses(List.of(access.trip()), access.user().getId()).get(0);
    }

    // ── Mapping ──────────────────────────────────────────────────────────────

    /**
     * Two queries for any number of trips: members joined with users, and saved totals grouped by
     * trip. Spent comes from trips.spent_amount (trigger-maintained), never from summing expenses.
     */
    private List<TripResponse> toResponses(List<Trip> trips, Long viewerId) {
        if (trips.isEmpty()) {
            return List.of();
        }
        List<Long> ids = trips.stream().map(Trip::getId).toList();
        Map<Long, List<TripMember>> membersByTrip = tripMemberRepository.findByTripIdInWithUser(ids).stream()
                .collect(Collectors.groupingBy(m -> m.getTrip().getId()));
        Map<Long, BigDecimal> savedByTrip = fundEntryRepository.sumAmountByTripIds(ids).stream()
                .collect(Collectors.toMap(TripFundEntryRepository.TripTotal::getTripId,
                        TripFundEntryRepository.TripTotal::getTotal));

        return trips.stream()
                .map(t -> toResponse(t, membersByTrip.getOrDefault(t.getId(), List.of()),
                        savedByTrip.getOrDefault(t.getId(), BigDecimal.ZERO), viewerId))
                .toList();
    }

    private TripResponse toResponse(Trip trip, List<TripMember> members, BigDecimal saved, Long viewerId) {
        Long ownerId = trip.getOwnerId();
        List<TripResponse.MemberDto> memberDtos = members.stream()
                // Owner first, then by join order (the query already sorts by joinedAt).
                .sorted(Comparator.comparing((TripMember m) -> !Objects.equals(m.getUserId(), ownerId)))
                .map(m -> TripResponse.MemberDto.of(m, effectiveRole(ownerId, m)))
                .toList();

        // The owner's member row already carries the owner's user; fall back to the association.
        User owner = members.stream()
                .filter(m -> Objects.equals(m.getUserId(), ownerId))
                .map(TripMember::getUser)
                .filter(Objects::nonNull)
                .findFirst()
                .orElseGet(trip::getOwner);

        String myRole = Objects.equals(ownerId, viewerId)
                ? MemberRole.owner.name()
                : members.stream()
                        .filter(m -> Objects.equals(m.getUserId(), viewerId))
                        .findFirst()
                        .map(m -> effectiveRole(ownerId, m).name())
                        .orElse(null);

        BigDecimal spent = trip.getSpentAmount() != null ? trip.getSpentAmount() : BigDecimal.ZERO;
        BigDecimal budget = trip.getBudget() != null ? trip.getBudget() : BigDecimal.ZERO;
        BigDecimal remaining = trip.getRemainingBudget() != null ? trip.getRemainingBudget() : budget.subtract(spent);

        return TripResponse.builder()
                .id(trip.getId())
                .ownerId(ownerId)
                .owner(TripResponse.OwnerDto.of(owner))
                .name(trip.getName())
                .destinationCountry(trip.getDestinationCountry())
                .startDate(trip.getStartDate())
                .endDate(trip.getEndDate())
                .description(trip.getDescription())
                .image(trip.getImage())
                .budget(trip.getBudget())
                .currency(trip.getCurrency())
                .budgetType(trip.getBudgetType())
                .season(trip.getSeason())
                .notes(trip.getNotes())
                .status(trip.getStatus())
                .isArchived(Boolean.TRUE.equals(trip.getIsArchived()))
                .createdAt(trip.getCreatedAt())
                .updatedAt(trip.getUpdatedAt())
                .members(memberDtos)
                .memberCount(memberDtos.size())
                .totalExpenses(spent)
                .spentAmount(spent)
                .remainingBudget(remaining)
                .savedAmount(saved != null ? saved : BigDecimal.ZERO)
                .myRole(myRole)
                .build();
    }

    private static MemberRole effectiveRole(Long ownerId, TripMember member) {
        return TripAccessService.effectiveRole(ownerId, member.getUserId(), member.getRole());
    }

    // ── Validation ───────────────────────────────────────────────────────────

    private static void requireOwner(TripAccessService.Access access) {
        if (!access.isOwner()) {
            throw new ForbiddenException(TripAccessService.OWNER_ONLY);
        }
    }

    /**
     * total_budget is DECIMAL(12, 2). The DTO's @Digits already says so; this repeats it with cheap
     * precision/scale reads so no caller can hand a value like 1e20000000 to the database layer.
     */
    private static void requireBudgetSize(BigDecimal budget) {
        if (!Decimals.fits(budget, 10, 2)) {
            throw new BadRequestException(BUDGET_DIGITS);
        }
    }

    private static void requireDateOrder(LocalDate start, LocalDate end) {
        if (start != null && end != null && end.isBefore(start)) {
            throw new BadRequestException("End date can't be before the start date");
        }
    }

    /** Lower-cased season, null for blank. Anything outside chk_trips_season is a 400. */
    static String normalizeSeason(String season) {
        if (season == null || season.isBlank()) {
            return null;
        }
        String value = season.trim().toLowerCase(Locale.ROOT);
        if (!Trip.SEASONS.contains(value)) {
            throw new BadRequestException("Season must be spring, summer, autumn, winter or tropical");
        }
        return value;
    }

    private static String normalizeBudgetType(String budgetType, String fallback) {
        if (budgetType == null || budgetType.isBlank()) {
            return fallback;
        }
        String value = budgetType.trim().toLowerCase(Locale.ROOT);
        if (!Trip.BUDGET_TYPES.contains(value)) {
            throw new BadRequestException("Budget type must be solo, shared or separated");
        }
        return value;
    }

    // ── Activity feed ────────────────────────────────────────────────────────

    private void logActivity(Long tripId, User actor, String type, String text) {
        try {
            activityService.log(tripId, actor.getId(), displayName(actor), type, text);
        } catch (RuntimeException e) {
            log.warn("Could not log {} for trip {}: {}", type, tripId, e.getMessage());
        }
    }

    private static void afterCommit(Runnable task) {
        Runnable safe = () -> {
            try {
                task.run();
            } catch (RuntimeException e) {
                log.warn("Could not write activity after commit: {}", e.getMessage());
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    safe.run();
                }
            });
        } else {
            safe.run();
        }
    }

    // ── Small helpers ────────────────────────────────────────────────────────

    private static String upper(String code) {
        return code == null || code.isBlank() ? null : code.trim().toUpperCase(Locale.ROOT);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String displayName(User user) {
        return TripAccessService.actorName(user);
    }

    private static String quote(String s) {
        if (s == null || s.isBlank()) return "a trip";
        String trimmed = s.trim();
        return "\"" + (trimmed.length() > 80 ? trimmed.substring(0, 77) + "..." : trimmed) + "\"";
    }
}
