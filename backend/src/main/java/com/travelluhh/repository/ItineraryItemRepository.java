package com.travelluhh.repository;

import com.travelluhh.entity.ItineraryItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ItineraryItemRepository extends JpaRepository<ItineraryItem, Long> {

    List<ItineraryItem> findByTripIdOrderByItemDateAscStartTimeAsc(Long tripId);

    List<ItineraryItem> findByTripIdOrderByItemDateAscStartTimeAscSortOrderAscIdAsc(Long tripId);

    Optional<ItineraryItem> findByIdAndTripId(Long id, Long tripId);
}
