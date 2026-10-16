package com.travelluhh.service;

import com.travelluhh.entity.Trip;
import com.travelluhh.entity.TripMember.MemberRole;
import com.travelluhh.entity.User;
import com.travelluhh.exception.ForbiddenException;
import com.travelluhh.exception.NotFoundException;
import com.travelluhh.repository.TripMemberRepository;
import com.travelluhh.repository.TripRepository;
import com.travelluhh.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Objects;
import java.util.Optional;

/**
 * The single place that decides who may touch a trip. Call it first in every trip-scoped
 * service method.
 *
 * Rules (API contract, Conventions):
 * - Owner = trips.owner_id. A trip_members row with role 'owner' for anyone else counts as editor.
 * - Read anything: any member. Write content: owner or editor. Members, allocations, delete: owner.
 * - Missing trip and non-member both get 404 "Trip not found" so trip ids can't be probed.
 * - Members lacking the role get 403.
 */
@Service
@RequiredArgsConstructor
public class TripAccessService {

    public static final String TRIP_NOT_FOUND = "Trip not found";
    public static final String VIEWER_CANNOT_EDIT = "Viewers can't change this trip";
    public static final String OWNER_ONLY = "Only the trip owner can do that";

    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;
    private final UserRepository userRepository;

    /** Result of an access check: who is asking, which trip, and the role they hold on it. */
    public record Access(User user, Trip trip, MemberRole role) {
        public boolean isOwner() {
            return role == MemberRole.owner;
        }
    }

    /** The authenticated user (Authentication#getName() is the email). */
    public User currentUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("Account not found"));
    }

    public Trip requireMember(Long tripId, String email) {
        return requireMember(tripId, currentUser(email));
    }

    public Trip requireEditor(Long tripId, String email) {
        return requireEditor(tripId, currentUser(email));
    }

    public Trip requireOwner(Long tripId, String email) {
        return requireOwner(tripId, currentUser(email));
    }

    public Trip requireMember(Long tripId, User user) {
        return require(tripId, user, MemberRole.viewer, TRIP_NOT_FOUND).trip();
    }

    public Trip requireEditor(Long tripId, User user) {
        return require(tripId, user, MemberRole.editor, TRIP_NOT_FOUND).trip();
    }

    public Trip requireOwner(Long tripId, User user) {
        return require(tripId, user, MemberRole.owner, TRIP_NOT_FOUND).trip();
    }

    /** Same checks, returning user + trip + role together for services that need all three. */
    public Access access(Long tripId, String email, MemberRole minimum) {
        return require(tripId, currentUser(email), minimum, TRIP_NOT_FOUND);
    }

    /**
     * Core check. notFoundMessage lets item-level endpoints (e.g. PUT /api/expenses/{id}) answer
     * "Expense not found" to non-members instead of revealing that the parent trip exists.
     */
    public Access require(Long tripId, User user, MemberRole minimum, String notFoundMessage) {
        Objects.requireNonNull(minimum, "minimum");
        if (tripId == null || user == null) {
            throw new NotFoundException(notFoundMessage);
        }
        Trip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new NotFoundException(notFoundMessage));
        MemberRole role = roleOf(trip, user.getId())
                .orElseThrow(() -> new NotFoundException(notFoundMessage));
        if (!role.atLeast(minimum)) {
            throw new ForbiddenException(minimum == MemberRole.owner ? OWNER_ONLY : VIEWER_CANNOT_EDIT);
        }
        return new Access(user, trip, role);
    }

    /** The user's role on the trip, or empty when they are not part of it. */
    public Optional<MemberRole> roleOf(Trip trip, Long userId) {
        if (trip == null || userId == null) {
            return Optional.empty();
        }
        if (Objects.equals(trip.getOwnerId(), userId)) {
            return Optional.of(MemberRole.owner);
        }
        return tripMemberRepository.findRole(trip.getId(), userId)
                .map(stored -> effectiveRole(trip.getOwnerId(), userId, stored));
    }

    /**
     * The role to show and enforce for a trip_members row: owner only for trips.owner_id, and a
     * stray 'owner' row for anyone else (legacy data) counts as editor.
     */
    public static MemberRole effectiveRole(Long ownerId, Long userId, MemberRole stored) {
        if (Objects.equals(ownerId, userId)) {
            return MemberRole.owner;
        }
        if (stored == null) {
            return MemberRole.viewer;
        }
        return stored == MemberRole.owner ? MemberRole.editor : stored;
    }

    /** Name used for the actor in activity rows: the user's name, or "Someone" when it is blank. */
    public static String actorName(User user) {
        if (user == null || user.getName() == null || user.getName().isBlank()) {
            return "Someone";
        }
        return user.getName().trim();
    }
}
