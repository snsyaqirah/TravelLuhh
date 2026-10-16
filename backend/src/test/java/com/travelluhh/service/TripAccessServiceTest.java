package com.travelluhh.service;

import com.travelluhh.entity.Trip;
import com.travelluhh.entity.TripMember.MemberRole;
import com.travelluhh.entity.User;
import com.travelluhh.exception.ForbiddenException;
import com.travelluhh.exception.NotFoundException;
import com.travelluhh.repository.TripMemberRepository;
import com.travelluhh.repository.TripRepository;
import com.travelluhh.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TripAccessServiceTest {

    private static final long TRIP_ID = 9L;
    private static final long OWNER_ID = 1L;
    private static final long EDITOR_ID = 2L;
    private static final long VIEWER_ID = 3L;
    private static final long STRANGER_ID = 4L;
    private static final long STRAY_OWNER_ID = 5L;

    @Mock private TripRepository tripRepository;
    @Mock private TripMemberRepository tripMemberRepository;
    @Mock private UserRepository userRepository;

    private TripAccessService access;
    private Trip trip;

    @BeforeEach
    void setUp() {
        access = new TripAccessService(tripRepository, tripMemberRepository, userRepository);
        trip = Trip.builder().id(TRIP_ID).ownerId(OWNER_ID).name("Tokyo autumn").build();

        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
        when(tripRepository.findById(404L)).thenReturn(Optional.empty());
        when(tripMemberRepository.findRole(TRIP_ID, OWNER_ID)).thenReturn(Optional.of(MemberRole.owner));
        when(tripMemberRepository.findRole(TRIP_ID, EDITOR_ID)).thenReturn(Optional.of(MemberRole.editor));
        when(tripMemberRepository.findRole(TRIP_ID, VIEWER_ID)).thenReturn(Optional.of(MemberRole.viewer));
        when(tripMemberRepository.findRole(TRIP_ID, STRANGER_ID)).thenReturn(Optional.empty());
        when(tripMemberRepository.findRole(TRIP_ID, STRAY_OWNER_ID)).thenReturn(Optional.of(MemberRole.owner));
    }

    private static User user(long id) {
        return User.builder().id(id).email("u" + id + "@example.com").name("User " + id).build();
    }

    @Test
    void ownerPassesEveryLevel() {
        User owner = user(OWNER_ID);
        assertThat(access.requireMember(TRIP_ID, owner)).isSameAs(trip);
        assertThat(access.requireEditor(TRIP_ID, owner)).isSameAs(trip);
        assertThat(access.requireOwner(TRIP_ID, owner)).isSameAs(trip);
        // Ownership comes from trips.owner_id, without a member lookup.
        verify(tripMemberRepository, never()).findRole(TRIP_ID, OWNER_ID);
    }

    @Test
    void editorCanReadAndWriteButNotManage() {
        User editor = user(EDITOR_ID);
        assertThat(access.requireMember(TRIP_ID, editor)).isSameAs(trip);
        assertThat(access.requireEditor(TRIP_ID, editor)).isSameAs(trip);
        assertThatThrownBy(() -> access.requireOwner(TRIP_ID, editor))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Only the trip owner can do that");
    }

    @Test
    void viewerCanOnlyRead() {
        User viewer = user(VIEWER_ID);
        assertThat(access.requireMember(TRIP_ID, viewer)).isSameAs(trip);
        assertThatThrownBy(() -> access.requireEditor(TRIP_ID, viewer))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Viewers can't change this trip");
        assertThatThrownBy(() -> access.requireOwner(TRIP_ID, viewer))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Only the trip owner can do that");
    }

    @Test
    void nonMemberGets404NotForbidden() {
        User stranger = user(STRANGER_ID);
        for (MemberRole level : MemberRole.values()) {
            assertThatThrownBy(() -> access.require(TRIP_ID, stranger, level, TripAccessService.TRIP_NOT_FOUND))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessage("Trip not found");
        }
    }

    @Test
    void missingTripLooksExactlyLikeNonMembership() {
        assertThatThrownBy(() -> access.requireMember(404L, user(OWNER_ID)))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Trip not found");
        assertThatThrownBy(() -> access.requireMember(null, user(OWNER_ID)))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void itemEndpointsCanUseTheirOwnNotFoundMessage() {
        assertThatThrownBy(() -> access.require(TRIP_ID, user(STRANGER_ID), MemberRole.editor, "Expense not found"))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Expense not found");
        // A member lacking the role still learns why (403), since they can see the trip anyway.
        assertThatThrownBy(() -> access.require(TRIP_ID, user(VIEWER_ID), MemberRole.editor, "Expense not found"))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void strayOwnerRowIsTreatedAsEditor() {
        User stray = user(STRAY_OWNER_ID);
        assertThat(access.roleOf(trip, STRAY_OWNER_ID)).contains(MemberRole.editor);
        assertThat(access.requireEditor(TRIP_ID, stray)).isSameAs(trip);
        assertThatThrownBy(() -> access.requireOwner(TRIP_ID, stray)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void roleOfReportsEachRole() {
        assertThat(access.roleOf(trip, OWNER_ID)).contains(MemberRole.owner);
        assertThat(access.roleOf(trip, EDITOR_ID)).contains(MemberRole.editor);
        assertThat(access.roleOf(trip, VIEWER_ID)).contains(MemberRole.viewer);
        assertThat(access.roleOf(trip, STRANGER_ID)).isEmpty();
        assertThat(access.roleOf(trip, null)).isEmpty();
    }

    @Test
    void accessBundlesUserTripAndRole() {
        User editor = user(EDITOR_ID);
        when(userRepository.findByEmail(editor.getEmail())).thenReturn(Optional.of(editor));

        TripAccessService.Access result = access.access(TRIP_ID, editor.getEmail(), MemberRole.viewer);

        assertThat(result.user()).isSameAs(editor);
        assertThat(result.trip()).isSameAs(trip);
        assertThat(result.role()).isEqualTo(MemberRole.editor);
        assertThat(result.isOwner()).isFalse();
    }

    @Test
    void unknownEmailIsNotFound() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> access.requireMember(TRIP_ID, "ghost@example.com"))
                .isInstanceOf(NotFoundException.class);
        verify(tripRepository, never()).findById(anyLong());
    }

    @Test
    void effectiveRoleRules() {
        assertThat(TripAccessService.effectiveRole(1L, 1L, MemberRole.viewer)).isEqualTo(MemberRole.owner);
        assertThat(TripAccessService.effectiveRole(1L, 2L, MemberRole.owner)).isEqualTo(MemberRole.editor);
        assertThat(TripAccessService.effectiveRole(1L, 2L, MemberRole.viewer)).isEqualTo(MemberRole.viewer);
        assertThat(TripAccessService.effectiveRole(1L, 2L, null)).isEqualTo(MemberRole.viewer);
    }
}
