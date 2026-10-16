package com.travelluhh.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

import java.time.LocalDateTime;

/**
 * TripMember entity representing the trip_members table in database.
 * The trip owner also has a row here with role = owner; trips.owner_id stays the source of truth.
 */
@Entity
@Table(name = "trip_members")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = {"trip", "user"})
public class TripMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "member_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trip_id", nullable = false)
    private Trip trip;

    @Column(name = "user_id")
    private Long userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    // Matches the DB default ('editor'); callers should still set the role explicitly.
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private MemberRole role = MemberRole.editor;

    @Column(name = "joined_at")
    private LocalDateTime joinedAt;

    @PrePersist
    protected void onCreate() {
        if (joinedAt == null) {
            joinedAt = LocalDateTime.now();
        }
    }

    /** Stored as the lowercase name. Compare privilege with rank()/atLeast(), never ordinal(). */
    public enum MemberRole {
        owner, editor, viewer;

        /** 0 = viewer, 1 = editor, 2 = owner. */
        public int rank() {
            return switch (this) {
                case owner -> 2;
                case editor -> 1;
                case viewer -> 0;
            };
        }

        public boolean atLeast(MemberRole other) {
            return rank() >= other.rank();
        }
    }
}
