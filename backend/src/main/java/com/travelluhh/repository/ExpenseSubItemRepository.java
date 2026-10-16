package com.travelluhh.repository;

import com.travelluhh.entity.ExpenseSubItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface ExpenseSubItemRepository extends JpaRepository<ExpenseSubItem, Long> {

    List<ExpenseSubItem> findByExpenseId(Long expenseId);

    /** Sub-items for a whole ledger in one query. */
    List<ExpenseSubItem> findByExpenseIdInOrderByIdAsc(Collection<Long> expenseIds);

    /** Bulk delete (one statement), used when an edit replaces the sub-items. */
    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM ExpenseSubItem s WHERE s.expenseId = :expenseId")
    int deleteByExpenseId(@Param("expenseId") Long expenseId);
}
