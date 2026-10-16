package com.travelluhh.repository;

import com.travelluhh.entity.TripFundEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TripFundEntryRepository extends JpaRepository<TripFundEntry, Long> {

    /** Newest first, with the user joined so userName needs no extra query. */
    @Query("SELECT f FROM TripFundEntry f LEFT JOIN FETCH f.user WHERE f.tripId = :tripId " +
           "ORDER BY f.entryDate DESC, f.createdAt DESC, f.id DESC")
    List<TripFundEntry> findByTripIdNewestFirst(@Param("tripId") Long tripId);

    Optional<TripFundEntry> findByIdAndTripId(Long id, Long tripId);

    boolean existsByTripId(Long tripId);

    @Query("SELECT COALESCE(SUM(f.amount), 0) FROM TripFundEntry f WHERE f.tripId = :tripId")
    BigDecimal sumAmountByTripId(@Param("tripId") Long tripId);

    /** Saved totals for many trips in one grouped query. Trips with no entries are absent. */
    @Query("SELECT f.tripId AS tripId, SUM(f.amount) AS total FROM TripFundEntry f " +
           "WHERE f.tripId IN :tripIds GROUP BY f.tripId")
    List<TripTotal> sumAmountByTripIds(@Param("tripIds") Collection<Long> tripIds);

    interface TripTotal {
        Long getTripId();
        BigDecimal getTotal();
    }
}
