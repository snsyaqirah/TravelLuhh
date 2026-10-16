package com.travelluhh.repository;

import com.travelluhh.entity.Trip;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TripRepository extends JpaRepository<Trip, Long> {

    List<Trip> findByOwnerId(Long ownerId);

    /** Trips the user owns or is a member of, filtered by archive state (NULL counts as not archived). */
    @Query("SELECT t FROM Trip t LEFT JOIN FETCH t.owner " +
           "WHERE (t.ownerId = :userId OR EXISTS (" +
           "    SELECT m.id FROM TripMember m WHERE m.trip = t AND m.userId = :userId)) " +
           "AND COALESCE(t.isArchived, false) = :archived " +
           "ORDER BY t.startDate DESC, t.id DESC")
    List<Trip> findForUser(@Param("userId") Long userId, @Param("archived") boolean archived);

    /** Every trip the user owns or is a member of, archived or not. */
    @Query("SELECT t FROM Trip t LEFT JOIN FETCH t.owner " +
           "WHERE t.ownerId = :userId OR EXISTS (" +
           "    SELECT m.id FROM TripMember m WHERE m.trip = t AND m.userId = :userId) " +
           "ORDER BY t.startDate DESC, t.id DESC")
    List<Trip> findAllForUser(@Param("userId") Long userId);
}
