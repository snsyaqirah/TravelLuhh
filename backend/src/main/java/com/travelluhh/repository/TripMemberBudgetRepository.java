package com.travelluhh.repository;

import com.travelluhh.entity.TripMemberBudget;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TripMemberBudgetRepository extends JpaRepository<TripMemberBudget, Long> {

    List<TripMemberBudget> findByTripIdOrderByIdAsc(Long tripId);

    Optional<TripMemberBudget> findByTripIdAndUserId(Long tripId, Long userId);

    @Query("SELECT COALESCE(SUM(b.allocatedBudget), 0) FROM TripMemberBudget b WHERE b.tripId = :tripId")
    BigDecimal sumAllocatedByTripId(@Param("tripId") Long tripId);

    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM TripMemberBudget b WHERE b.tripId = :tripId AND b.userId = :userId")
    int deleteByTripIdAndUserId(@Param("tripId") Long tripId, @Param("userId") Long userId);

    /** Drops allocations for users no longer in the given set (e.g. after a member is removed). */
    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM TripMemberBudget b WHERE b.tripId = :tripId AND b.userId NOT IN :userIds")
    int deleteByTripIdAndUserIdNotIn(@Param("tripId") Long tripId, @Param("userIds") Collection<Long> userIds);
}
