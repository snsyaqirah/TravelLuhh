package com.travelluhh.service;

import com.travelluhh.dto.member.AddMemberRequest;
import com.travelluhh.dto.member.UpdateMemberRoleRequest;
import com.travelluhh.dto.trip.TripResponse.MemberDto;
import com.travelluhh.entity.Trip;
import com.travelluhh.entity.TripMember;
import com.travelluhh.entity.TripMember.MemberRole;
import com.travelluhh.entity.User;
import com.travelluhh.exception.BadRequestException;
import com.travelluhh.exception.ConflictException;
import com.travelluhh.exception.NotFoundException;
import com.travelluhh.repository.TripMemberBudgetRepository;
import com.travelluhh.repository.TripMemberRepository;
import com.travelluhh.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;

/**
 * Trip members (API contract, Members). Anyone on the trip can list; only the owner adds, removes
 * or changes roles; any non-owner can leave. The owner is trips.owner_id and can't be demoted,
 * removed or leave. Removing someone keeps their expenses (added_by / paid_by stay) and drops
 * their separated-budget allocation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class MemberService {

    static final String NO_ACCOUNT = "No TravelLuhh account uses that email yet. Ask them to sign up first.";
    static final String MEMBER_NOT_FOUND = "Member not found";
    static final String ROLE_INVALID = "Role must be editor or viewer";
    static final String OWNER_ROLE_FIXED = "The owner's role can't change";
    static final String OWNER_CANNOT_BE_REMOVED = "The owner can't be removed from their own trip";
    static final String OWNER_CANNOT_LEAVE = "Owners can't leave their own trip. Transfer or delete the trip instead.";

    private final TripMemberRepository tripMemberRepository;
    private final TripMemberBudgetRepository budgetRepository;
    private final UserRepository userRepository;
    private final TripAccessService tripAccess;
    private final ActivityService activityService;

    // ── Queries ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<MemberDto> listMembers(Long tripId, String userEmail) {
        Trip trip = tripAccess.requireMember(tripId, userEmail);
        return roster(trip).stream()
                .map(m -> MemberDto.of(m, roleOf(trip, m)))
                .toList();
    }

    /**
     * Everyone on the trip with their user loaded: the owner first, then the others in join order.
     * The owner is always included, even on a legacy trip without an owner row (that entry is
     * built in memory, has a null id and must not be saved). Used by settlement and budgets too.
     */
    @Transactional(readOnly = true)
    public List<TripMember> roster(Trip trip) {
        List<TripMember> rows = tripMemberRepository.findByTripIdWithUser(trip.getId());
        Long ownerId = trip.getOwnerId();
        TripMember ownerRow = rows.stream()
                .filter(m -> Objects.equals(m.getUserId(), ownerId))
                .findFirst()
                .orElseGet(() -> TripMember.builder()
                        .userId(ownerId)
                        .user(userRepository.findById(ownerId).orElse(null))
                        .role(MemberRole.owner)
                        .joinedAt(trip.getCreatedAt())
                        .build());

        List<TripMember> result = new ArrayList<>(rows.size() + 1);
        result.add(ownerRow);
        for (TripMember m : rows) {
            if (!Objects.equals(m.getUserId(), ownerId)) {
                result.add(m);
            }
        }
        return result;
    }

    // ── Commands ─────────────────────────────────────────────────────────────

    /** Owner only. The invitee must already have an account (404) and not be on the trip (409). */
    public MemberDto addMember(Long tripId, AddMemberRequest request, String userEmail) {
        TripAccessService.Access access = tripAccess.access(tripId, userEmail, MemberRole.owner);
        Trip trip = access.trip();
        MemberRole role = parseRole(request.getRole(), MemberRole.editor);

        User invitee = findAccount(request.getEmail())
                .orElseThrow(() -> new NotFoundException(NO_ACCOUNT));
        if (Objects.equals(invitee.getId(), access.user().getId())) {
            throw new ConflictException("You're already on this trip");
        }
        if (Objects.equals(invitee.getId(), trip.getOwnerId())
                || tripMemberRepository.existsByTripIdAndUserId(tripId, invitee.getId())) {
            throw new ConflictException(name(invitee) + " is already on this trip");
        }

        TripMember member = TripMember.builder()
                .trip(trip)
                .userId(invitee.getId())
                .user(invitee)
                .role(role)
                .build();
        // Flush now so a concurrent duplicate hits UNIQUE(trip_id, user_id) here and becomes a 409.
        member = tripMemberRepository.saveAndFlush(member);

        logActivity(trip, access.user(), "member_added",
                name(access.user()) + " added " + name(invitee) + " as " + article(role));
        return MemberDto.of(member, role);
    }

    /** Owner only. The owner's own row can't change (400). */
    public MemberDto changeRole(Long tripId, Long memberId, UpdateMemberRoleRequest request, String userEmail) {
        TripAccessService.Access access = tripAccess.access(tripId, userEmail, MemberRole.owner);
        Trip trip = access.trip();
        TripMember member = findMember(tripId, memberId);
        if (isOwnerRow(trip, member)) {
            throw new BadRequestException(OWNER_ROLE_FIXED);
        }
        MemberRole role = parseRole(request.getRole(), null);
        MemberRole before = roleOf(trip, member);

        if (member.getRole() != role) {
            member.setRole(role);
            member = tripMemberRepository.save(member);
        }
        if (before != role) {
            logActivity(trip, access.user(), "member_role_changed",
                    name(access.user()) + " made " + name(member.getUser()) + " " + article(role));
        }
        return MemberDto.of(member, role);
    }

    /** Owner only; the owner can't be removed. Their expenses stay on the trip. */
    public void removeMember(Long tripId, Long memberId, String userEmail) {
        TripAccessService.Access access = tripAccess.access(tripId, userEmail, MemberRole.owner);
        Trip trip = access.trip();
        TripMember member = findMember(tripId, memberId);
        if (isOwnerRow(trip, member)) {
            throw new BadRequestException(OWNER_CANNOT_BE_REMOVED);
        }
        String removedName = name(member.getUser());
        dropMembership(tripId, member);
        logActivity(trip, access.user(), "member_removed",
                name(access.user()) + " removed " + removedName + " from the trip");
    }

    /** Any member except the owner. */
    public void leave(Long tripId, String userEmail) {
        TripAccessService.Access access = tripAccess.access(tripId, userEmail, MemberRole.viewer);
        if (access.isOwner()) {
            throw new BadRequestException(OWNER_CANNOT_LEAVE);
        }
        TripMember member = tripMemberRepository.findByTripIdAndUserId(tripId, access.user().getId())
                .orElseThrow(() -> new NotFoundException(TripAccessService.TRIP_NOT_FOUND));
        dropMembership(tripId, member);
        logActivity(access.trip(), access.user(), "member_left", name(access.user()) + " left the trip");
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private void dropMembership(Long tripId, TripMember member) {
        tripMemberRepository.delete(member);
        // Their allocation means nothing once they're off the trip; spend stays on the expenses.
        budgetRepository.deleteByTripIdAndUserId(tripId, member.getUserId());
    }

    private TripMember findMember(Long tripId, Long memberId) {
        if (memberId == null) {
            throw new NotFoundException(MEMBER_NOT_FOUND);
        }
        return tripMemberRepository.findByIdAndTripId(memberId, tripId)
                .orElseThrow(() -> new NotFoundException(MEMBER_NOT_FOUND));
    }

    /**
     * Emails are stored lower-cased, so the exact lookup (unique index) finds almost everyone; older rows saved
     * in mixed case are still found by the case-insensitive query.
     */
    private Optional<User> findAccount(String email) {
        if (email == null || email.isBlank()) {
            return Optional.empty();
        }
        String trimmed = email.trim();
        return userRepository.findByEmail(trimmed.toLowerCase(Locale.ROOT))
                .or(() -> userRepository.findByEmailIgnoreCase(trimmed));
    }

    static MemberRole parseRole(String raw, MemberRole fallback) {
        if (raw == null || raw.isBlank()) {
            if (fallback != null) return fallback;
            throw new BadRequestException(ROLE_INVALID);
        }
        return switch (raw.trim().toLowerCase(Locale.ROOT)) {
            case "editor" -> MemberRole.editor;
            case "viewer" -> MemberRole.viewer;
            default -> throw new BadRequestException(ROLE_INVALID);
        };
    }

    private static boolean isOwnerRow(Trip trip, TripMember member) {
        return Objects.equals(member.getUserId(), trip.getOwnerId());
    }

    private static MemberRole roleOf(Trip trip, TripMember member) {
        return TripAccessService.effectiveRole(trip.getOwnerId(), member.getUserId(), member.getRole());
    }

    private static String article(MemberRole role) {
        return role == MemberRole.editor ? "an editor" : "a viewer";
    }

    private static String name(User user) {
        return TripAccessService.actorName(user);
    }

    private void logActivity(Trip trip, User actor, String type, String text) {
        try {
            activityService.log(trip.getId(), actor.getId(), name(actor), type, text);
        } catch (RuntimeException e) {
            log.warn("Could not log {} for trip {}: {}", type, trip.getId(), e.getMessage());
        }
    }
}
