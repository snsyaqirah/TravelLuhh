package com.travelluhh.repository;

import com.travelluhh.entity.PackingItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PackingItemRepository extends JpaRepository<PackingItem, Long> {

    List<PackingItem> findByTripIdOrderByCreatedAtAsc(Long tripId);

    List<PackingItem> findByTripIdOrderByCreatedAtAscIdAsc(Long tripId);

    Optional<PackingItem> findByIdAndTripId(Long id, Long tripId);

    /** Lower-cased labels already on the list, so presets don't add duplicates. */
    @Query("SELECT LOWER(p.label) FROM PackingItem p WHERE p.tripId = :tripId")
    List<String> findLowerLabelsByTripId(@Param("tripId") Long tripId);
}
