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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Trip entity representing the trips table in database.
 *
 * Children (members, expenses, itinerary, packing, notes, fund entries ...) are removed by the
 * database's ON DELETE CASCADE, so the collections below are mapped without JPA cascade: deleting
 * a trip is a single DELETE instead of Hibernate loading and deleting every child row.
 */
@Entity
@Table(name = "trips")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = {"owner", "members", "expenses"})
public class Trip {

    public static final Set<String> BUDGET_TYPES = Set.of("solo", "shared", "separated");
    public static final Set<String> SEASONS = Set.of("spring", "summer", "autumn", "winter", "tropical");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "trip_id")
    private Long id;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", insertable = false, updatable = false)
    private User owner;

    @Column(nullable = false)
    private String name;

    @Column(name = "destination_country", nullable = false, length = 2)
    private String destinationCountry;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 500)
    private String image;

    @Column(name = "total_budget", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal budget = BigDecimal.ZERO;

    /** Maintained by trg_update_trip_spent. Never written from JPA; re-read after insert/update. */
    @Generated(event = {EventType.INSERT, EventType.UPDATE})
    @Column(name = "spent_amount", insertable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal spentAmount;

    /** GENERATED ALWAYS AS (total_budget - spent_amount) STORED. */
    @Generated(event = {EventType.INSERT, EventType.UPDATE})
    @Column(name = "remaining_budget", insertable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal remainingBudget;

    @Column(length = 3)
    private String currency;

    @Column(name = "budget_type", length = 20)
    @Builder.Default
    private String budgetType = "solo";

    /** spring | summer | autumn | winter | tropical, or null. CHECK chk_trips_season. */
    @Column(length = 20)
    private String season;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private TripStatus status = TripStatus.PLANNED;

    @Column(name = "is_archived")
    @Builder.Default
    private Boolean isArchived = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "trip")
    @Builder.Default
    private List<TripMember> members = new ArrayList<>();

    @OneToMany(mappedBy = "trip")
    @Builder.Default
    private List<Expense> expenses = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum TripStatus {
        PLANNED, ONGOING, COMPLETED
    }
}
