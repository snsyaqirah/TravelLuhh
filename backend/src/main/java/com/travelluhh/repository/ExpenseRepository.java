package com.travelluhh.repository;

import com.travelluhh.entity.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    List<Expense> findByTripId(Long tripId);

    List<Expense> findByTripIdOrderByExpenseDateDesc(Long tripId);

    /** Ledger order: newest date first, then newest entry first within a day. */
    @Query("SELECT e FROM Expense e WHERE e.trip.id = :tripId " +
           "ORDER BY e.expenseDate DESC, e.createdAt DESC, e.id DESC")
    List<Expense> findLedger(@Param("tripId") Long tripId);

    boolean existsByTripId(Long tripId);

    /** Total paid per payer, attributing by COALESCE(paid_by, added_by). userId is null for orphaned rows. */
    @Query("SELECT COALESCE(e.paidBy, e.addedBy) AS userId, SUM(e.amount) AS total " +
           "FROM Expense e WHERE e.trip.id = :tripId GROUP BY COALESCE(e.paidBy, e.addedBy)")
    List<PayerTotal> sumByPayer(@Param("tripId") Long tripId);

    interface PayerTotal {
        Long getUserId();
        BigDecimal getTotal();
    }
}
