package com.travelluhh.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * An expense, always stored in the trip currency (amount + currency) so the spent triggers can
 * sum it directly. What the user actually paid is kept in original_amount / original_currency.
 */
@Entity
@Table(name = "expenses")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = {"trip", "addedByUser", "paidByUser"})
public class Expense {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "expense_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trip_id", nullable = false)
    private Trip trip;

    @Column(name = "added_by")
    private Long addedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "added_by", insertable = false, updatable = false)
    private User addedByUser;

    /** Who paid. NULL on rows created before 002_revamp; read it as COALESCE(paid_by, added_by). */
    @Column(name = "paid_by")
    private Long paidBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "paid_by", insertable = false, updatable = false)
    private User paidByUser;

    @Column(columnDefinition = "TEXT")
    private String description;

    /** Trip currency. */
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "original_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal originalAmount;

    @Column(name = "original_currency", nullable = false, length = 3)
    private String originalCurrency;

    /** Always equals amount; kept because the column is NOT NULL in the existing schema. */
    @Column(name = "converted_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal convertedAmount;

    /** Always the trip currency. */
    @Column(nullable = false, length = 3)
    private String currency;

    /** originalAmount x fxRate ~= amount. Null when the expense was entered in the trip currency. */
    @Column(name = "fx_rate", precision = 18, scale = 8)
    private BigDecimal fxRate;

    // DB column is named "date", not "expense_date"
    @Column(name = "date", nullable = false)
    private LocalDate expenseDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private ExpenseCategory category;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /** Payer used for settlement and member budgets; mirrors COALESCE(paid_by, added_by) in SQL. */
    public Long effectivePayerId() {
        return paidBy != null ? paidBy : addedBy;
    }

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        // Never let the NOT NULL money columns fall back to junk defaults.
        if (originalAmount == null) originalAmount = amount;
        if (originalCurrency == null) originalCurrency = currency;
        if (convertedAmount == null) convertedAmount = amount;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum ExpenseCategory {
        accommodation,
        transportation,
        food,
        activities,
        shopping,
        other,
        bundle
    }
}
