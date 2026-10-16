package com.travelluhh.repository;

import com.travelluhh.entity.TripMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface TripMemberRepository extends JpaRepository<TripMember, Long> {

    List<TripMember> findByTripId(Long tripId);

    Optional<TripMember> findByTripIdAndUserId(Long tripId, Long userId);

    /** Member row scoped to its trip, so a memberId from another trip is a 404, not a cross-trip edit. */
    Optional<TripMember> findByIdAndTripId(Long memberId, Long tripId);

    boolean existsByTripIdAndUserId(Long tripId, Long userId);

    long countByTripId(Long tripId);

    @Query("SELECT m.role FROM TripMember m WHERE m.trip.id = :tripId AND m.userId = :userId")
    Optional<TripMember.MemberRole> findRole(@Param("tripId") Long tripId, @Param("userId") Long userId);

    /** Members of one trip with their users in a single query, oldest first. */
    @Query("SELECT m FROM TripMember m JOIN FETCH m.user WHERE m.trip.id = :tripId " +
           "ORDER BY m.joinedAt ASC, m.id ASC")
    List<TripMember> findByTripIdWithUser(@Param("tripId") Long tripId);

    /** Members of many trips with their users in a single query (trip lists). */
    @Query("SELECT m FROM TripMember m JOIN FETCH m.user WHERE m.trip.id IN :tripIds " +
           "ORDER BY m.joinedAt ASC, m.id ASC")
    List<TripMember> findByTripIdInWithUser(@Param("tripIds") Collection<Long> tripIds);
}
