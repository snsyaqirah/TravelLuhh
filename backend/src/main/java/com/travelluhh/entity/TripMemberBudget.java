package com.travelluhh.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Per-member allocation for separated-budget trips (table trip_member_budgets).
 *
 * spent_amount is maintained by the database (trg_init_member_budget_spent on insert,
 * trg_update_member_budget_spent on expense changes) and remaining_budget is a generated column,
 * so both are read-only here and re-read by Hibernate after every insert/update.
 * allocated_budget has CHECK > 0: delete the row instead of saving 0.
 */
@Entity
@Table(name = "trip_member_budgets")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = "user")
public class TripMemberBudget {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "budget_id")
    private Long id;

    @Column(name = "trip_id", nullable = false)
    private Long tripId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    @Column(name = "allocated_budget", nullable = false, precision = 12, scale = 2)
    private BigDecimal allocatedBudget;

    @Generated(event = {EventType.INSERT, EventType.UPDATE})
    @Column(name = "spent_amount", insertable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal spentAmount;

    @Generated(event = {EventType.INSERT, EventType.UPDATE})
    @Column(name = "remaining_budget", insertable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal remainingBudget;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
